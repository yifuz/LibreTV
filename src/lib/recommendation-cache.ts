import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const STALE_RETENTION_MS = 7 * 24 * 60 * 60_000;
const FAILURE_RETRY_MS = 60_000;
const MAX_BYTES = 16 * 1024 * 1024;

interface Entry {
  value: unknown;
  updatedAt: number;
  expiresAt: number;
  staleUntil: number;
  retryAt: number;
}

export interface CachedRecommendation<T> {
  value: T;
  updatedAt: number;
  stale: boolean;
}

interface CacheOptions {
  filePath?: string;
  maxEntries?: number;
  maxBytes?: number;
  now?: () => number;
}

/** 单实例推荐缓存：有界 LRU、原子落盘、请求合并及有限期的失败兜底。 */
export class RecommendationCache {
  private entries = new Map<string, Entry>();
  private inFlight = new Map<string, Promise<CachedRecommendation<unknown>>>();
  private failures = new Map<string, { error: unknown; retryAt: number }>();
  private cooldownUntil = 0;
  private loading?: Promise<void>;
  private writing = Promise.resolve();
  private warned = false;
  private now: () => number;

  constructor(private options: CacheOptions = {}) {
    this.now = options.now ?? (() => Date.now());
  }

  private trim(): void {
    const now = this.now();
    for (const [key, entry] of this.entries) {
      if (entry.staleUntil <= now) this.entries.delete(key);
    }
    let bytes = Buffer.byteLength(JSON.stringify([...this.entries]));
    const maxBytes = this.options.maxBytes ?? MAX_BYTES;
    const maxEntries = this.options.maxEntries ?? 500;
    while (this.entries.size > maxEntries || bytes > maxBytes) {
      const key = this.entries.keys().next().value;
      if (key === undefined) break;
      const entry = this.entries.get(key)!;
      bytes -= Buffer.byteLength(JSON.stringify([key, entry])) + 1;
      this.entries.delete(key);
    }
    for (const [key, failure] of this.failures) {
      if (failure.retryAt <= now) this.failures.delete(key);
    }
    while (this.failures.size > maxEntries) this.failures.delete(this.failures.keys().next().value!);
  }

  private warn(): void {
    if (this.warned) return;
    this.warned = true;
    console.warn('[LibreTV] 推荐缓存文件不可用，当前进程继续使用内存缓存。请检查缓存目录权限。');
  }

  private ready(): Promise<void> {
    return this.loading ??= (async () => {
      const file = this.options.filePath;
      if (!file) return;
      try {
        if ((await stat(file)).size > 2 * (this.options.maxBytes ?? MAX_BYTES)) throw new Error('Cache too large');
        const snapshot = JSON.parse(await readFile(file, 'utf8'));
        if (snapshot.version !== 1 || !Array.isArray(snapshot.entries)) throw new Error('Invalid cache');
        for (const pair of snapshot.entries) {
          if (!Array.isArray(pair) || pair.length !== 2) continue;
          const [key, entry] = pair;
          if (typeof key !== 'string' || !entry || typeof entry !== 'object' || !('value' in entry)) continue;
          if (![entry.updatedAt, entry.expiresAt, entry.staleUntil, entry.retryAt].every(Number.isFinite)) continue;
          if (entry.updatedAt > entry.expiresAt || entry.expiresAt > entry.staleUntil) continue;
          this.entries.set(key, entry);
        }
        if (Number.isFinite(snapshot.cooldownUntil)) this.cooldownUntil = snapshot.cooldownUntil;
        this.trim();
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') this.warn();
      }
    })();
  }

  private persist(): Promise<void> {
    const file = this.options.filePath;
    if (!file) return Promise.resolve();
    this.writing = this.writing.then(async () => {
      const temporary = `${file}.${randomUUID()}.tmp`;
      try {
        await mkdir(dirname(file), { recursive: true });
        const snapshot = JSON.stringify({ version: 1, cooldownUntil: this.cooldownUntil, entries: [...this.entries] });
        await writeFile(temporary, snapshot, { encoding: 'utf8', mode: 0o600 });
        await rename(temporary, file);
      } finally {
        await unlink(temporary).catch(() => {});
      }
    }).catch(() => this.warn());
    return this.writing;
  }

  async getCooldownUntil(): Promise<number> {
    await this.ready();
    return this.cooldownUntil;
  }

  async setCooldownUntil(until: number): Promise<void> {
    await this.ready();
    this.cooldownUntil = Math.max(this.cooldownUntil, until);
    await this.persist();
  }

  async remember<T>(key: string, ttlMs: number, load: () => Promise<T>, allowStale = true): Promise<CachedRecommendation<T>> {
    await this.ready();
    let entry = this.entries.get(key);
    if (entry && entry.staleUntil <= this.now()) {
      this.entries.delete(key);
      entry = undefined;
    }
    if (entry) {
      this.entries.delete(key);
      this.entries.set(key, entry);
      if (entry.expiresAt > this.now() || (allowStale && entry.retryAt > this.now())) {
        return { value: entry.value as T, updatedAt: entry.updatedAt, stale: entry.expiresAt <= this.now() };
      }
    }
    const running = this.inFlight.get(key);
    if (running) return running as Promise<CachedRecommendation<T>>;
    const failure = this.failures.get(key);
    if (failure && failure.retryAt > this.now()) throw failure.error;

    const pending = (async (): Promise<CachedRecommendation<T>> => {
      try {
        const value = await load();
        const updatedAt = this.now();
        this.entries.delete(key);
        this.entries.set(key, { value, updatedAt, expiresAt: updatedAt + ttlMs, staleUntil: updatedAt + ttlMs + STALE_RETENTION_MS, retryAt: 0 });
        this.failures.delete(key);
        this.trim();
        await this.persist();
        return { value, updatedAt, stale: false };
      } catch (error) {
        // 不延长原始有效期：旧内容不能因为连续失败而永久保鲜。
        if (allowStale && entry && entry.staleUntil > this.now()) {
          entry.retryAt = this.now() + FAILURE_RETRY_MS;
          await this.persist();
          return { value: entry.value as T, updatedAt: entry.updatedAt, stale: true };
        }
        this.failures.set(key, { error, retryAt: this.now() + FAILURE_RETRY_MS });
        this.trim();
        throw error;
      }
    })();
    this.inFlight.set(key, pending);
    try { return await pending; }
    finally { this.inFlight.delete(key); }
  }
}

// Next.js 的不同服务端模块共用一个实例；客户端不导入本模块。
const globals = globalThis as typeof globalThis & { __libretvRecommendationCache?: RecommendationCache };
export const recommendationCache = globals.__libretvRecommendationCache ??= new RecommendationCache({
  filePath: resolve(process.env.RECOMMEND_CACHE_DIR || '.local/cache', 'douban-v1.json'),
});
