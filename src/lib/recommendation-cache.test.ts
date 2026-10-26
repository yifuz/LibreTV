import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RecommendationCache } from './recommendation-cache';

const directories: string[] = [];
async function cacheFile() {
  const directory = await mkdtemp(join(tmpdir(), 'libretv-cache-'));
  directories.push(directory);
  return join(directory, 'douban.json');
}
afterEach(async () => { vi.restoreAllMocks(); await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });

describe('Persistent recommendation cache', () => {
  it('restores fresh pages and access cooldown in a new instance without fetching', async () => {
    const filePath = await cacheFile();
    const first = new RecommendationCache({ filePath });
    const original = await first.remember('page', 10000, async () => ({ items: ['a'] }));
    await first.setCooldownUntil(Date.now() + 300000);
    const second = new RecommendationCache({ filePath });
    const load = vi.fn();
    expect(await second.remember('page', 10000, load)).toEqual(original);
    expect(await second.getCooldownUntil()).toBeGreaterThan(Date.now());
    expect(load).not.toHaveBeenCalled();
    expect(await readdir(join(filePath, '..'))).toEqual(['douban.json']);
  });

  it('retains the original age across restart and stops serving stale data after seven days', async () => {
    const filePath = await cacheFile();
    let now = 1_000_000;
    const first = new RecommendationCache({ filePath, now: () => now });
    await first.remember('page', 1000, async () => ['original']);
    now += 1001;
    const second = new RecommendationCache({ filePath, now: () => now });
    const failed = vi.fn().mockRejectedValue(new Error('offline'));
    expect(await second.remember('page', 1000, failed)).toEqual({ value: ['original'], updatedAt: 1_000_000, stale: true });
    await second.remember('page', 1000, failed);
    expect(failed).toHaveBeenCalledTimes(1);
    now += 7 * 24 * 60 * 60_000;
    await expect(second.remember('page', 1000, failed)).rejects.toThrow('offline');
  });

  it('evicts the least recently used entry and preserves other valid pages', async () => {
    const cache = new RecommendationCache({ maxEntries: 2 });
    await cache.remember('a', 10000, async () => 'a');
    await cache.remember('b', 10000, async () => 'b');
    await cache.remember('a', 10000, vi.fn());
    await cache.remember('c', 10000, async () => 'c');
    const load = vi.fn().mockResolvedValue('reloaded');
    expect((await cache.remember('a', 10000, load)).value).toBe('a');
    expect((await cache.remember('c', 10000, load)).value).toBe('c');
    expect(load).not.toHaveBeenCalled();
    await cache.remember('b', 10000, load);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('bounds snapshot size and keeps valid JSON after concurrent updates', async () => {
    const filePath = await cacheFile();
    const cache = new RecommendationCache({ filePath, maxBytes: 500 });
    await Promise.all(Array.from({ length: 10 }, (_, i) => cache.remember(`key-${i}`, 10000, async () => 'x'.repeat(150))));
    const snapshot = JSON.parse(await readFile(filePath, 'utf8'));
    expect(snapshot.entries.length).toBeGreaterThan(0);
    expect(snapshot.entries.length).toBeLessThan(10);
    expect(Buffer.byteLength(JSON.stringify(snapshot.entries))).toBeLessThanOrEqual(500);
  });

  it('releases a failed shared request and permits retry after the failure backoff', async () => {
    let now = 1;
    const cache = new RecommendationCache({ now: () => now });
    const load = vi.fn().mockRejectedValue(new Error('offline'));
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => cache.remember('page', 1000, load)));
    expect(results.every((result) => result.status === 'rejected')).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
    await expect(cache.remember('page', 1000, load)).rejects.toThrow('offline');
    expect(load).toHaveBeenCalledTimes(1);
    now += 60_001;
    load.mockResolvedValue('recovered');
    expect((await cache.remember('page', 1000, load)).value).toBe('recovered');
  });

  it('ignores corrupt snapshots and degrades to memory when persistence is unavailable', async () => {
    const filePath = await cacheFile();
    await writeFile(filePath, 'broken json');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cache = new RecommendationCache({ filePath });
    expect((await cache.remember('a', 10000, async () => 'ok')).value).toBe('ok');
    expect(warn).toHaveBeenCalledTimes(1);
    const unavailable = new RecommendationCache({ filePath: join(filePath, 'impossible.json') });
    expect((await unavailable.remember('a', 10000, async () => 'memory')).value).toBe('memory');
    const load = vi.fn();
    expect((await unavailable.remember('a', 10000, load)).value).toBe('memory');
    expect(load).not.toHaveBeenCalled();
  });
});
