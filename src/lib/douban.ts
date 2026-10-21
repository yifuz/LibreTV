import type { DoubanItem } from './types';
import { fetchUpstream, getCache, setCache } from './fetch-utils';
import { DOUBAN_CACHE_TTL_MS, DOUBAN_LATEST_MIN_RATINGS, DOUBAN_SECTIONS, doubanBrowseUrl, type DoubanBrowseOptions, type DoubanBrowseResponse } from './douban-browse';

/**
 * 豆瓣推荐数据获取（服务端直连，带内存缓存与降级链）。
 * 旧版在浏览器里经公共 CORS 代理请求豆瓣（隐私差且不稳定），
 * 重构后由服务端直连，仅在直连被拒时降级到公共代理。
 */

const DOUBAN_API = 'https://movie.douban.com/j/search_subjects';
const ACCESS_COOLDOWN_KEY = 'douban-access-limited';
class DoubanAccessLimitedError extends Error {
  constructor() { super('豆瓣暂时限制访问，请稍后再试'); }
}
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

interface DoubanRawSubject {
  id: string;
  title: string;
  cover: string;
  rate: string;
  url?: string;
}

function fallbackProxies(): string[] {
  const proxies: string[] = [];
  if (process.env.FALLBACK_CORS_PROXY) proxies.push(process.env.FALLBACK_CORS_PROXY);
  return proxies;
}

export async function fetchDoubanRecommend(
  type: 'movie' | 'tv',
  tag: string,
  pageStart: number,
  pageSize: number
): Promise<DoubanItem[]> {
  const cacheKey = `douban:${type}:${tag}:${pageStart}:${pageSize}`;
  const cached = getCache<DoubanItem[]>(cacheKey);
  if (cached) return cached;

  const target = `${DOUBAN_API}?type=${type}&tag=${encodeURIComponent(tag)}&sort=recommend&page_limit=${pageSize}&page_start=${pageStart}`;

  let raw: DoubanRawSubject[] | undefined;

  // 1) 服务端直连
  try {
    const res = await fetchUpstream(target, {
      timeoutMs: 8000,
      headers: { 'User-Agent': UA, Referer: 'https://movie.douban.com/', Accept: 'application/json' },
    });
    if (res.ok) {
      const data = (await res.json()) as { subjects?: DoubanRawSubject[] };
      raw = data.subjects;
    }
  } catch {
    // 忽略，走降级
  }

  // 2) 降级：经 FALLBACK_CORS_PROXY
  if (!raw) {
    for (const proxy of fallbackProxies()) {
      try {
        const res = await fetchUpstream(proxy + encodeURIComponent(target), {
          timeoutMs: 8000,
          headers: { Accept: 'application/json' },
        });
        if (res.ok) {
          const data = (await res.json()) as { subjects?: DoubanRawSubject[] };
          raw = data.subjects;
          if (raw) break;
        }
      } catch {
        // 继续尝试下一个
      }
    }
  }

  if (!raw) throw new Error('豆瓣推荐获取失败');

  const items: DoubanItem[] = raw.map((s) => ({
    id: s.id,
    title: s.title,
    cover: s.cover,
    rating: s.rate && s.rate !== '0' ? s.rate : undefined,
    isTv: type === 'tv',
  }));

  setCache(cacheKey, items, DOUBAN_CACHE_TTL_MS.hot);
  return items;
}

/** Only fixed Douban endpoints and deployment-configured fallback proxies are used. */
async function fetchBrowseJson<T>(target: string, field: 'data' | 'items', ttlMs: number): Promise<T> {
  const cacheKey = `douban-json:${target}`;
  const cached = getCache<T>(cacheKey);
  if (cached) return cached;
  if (getCache<boolean>(ACCESS_COOLDOWN_KEY)) throw new DoubanAccessLimitedError();
  const attempts = [target, ...fallbackProxies().map((proxy) => proxy + encodeURIComponent(target))];
  for (const address of attempts) {
    try {
      const response = await fetchUpstream(address, {
        timeoutMs: 8000, retries: 0,
        headers: { 'User-Agent': UA, Referer: 'https://movie.douban.com/', Accept: 'application/json' },
      });
      if (response.status === 429) {
        setCache(ACCESS_COOLDOWN_KEY, true, 5 * 60_000);
        throw new DoubanAccessLimitedError();
      }
      if (!response.ok) continue;
      const data = await response.json();
      if (data?.r === 1 && typeof data.msg === 'string' && /异常请求|登录再试|访问频繁/.test(data.msg)) {
        setCache(ACCESS_COOLDOWN_KEY, true, 5 * 60_000);
        throw new DoubanAccessLimitedError();
      }
      if (data && Array.isArray(data[field])) {
        setCache(cacheKey, data, ttlMs);
        return data as T;
      }
    } catch (error) {
      if (error instanceof DoubanAccessLimitedError) throw error;
      // Try only deployment-configured fallbacks for ordinary network failures.
    }
  }
  throw new Error('豆瓣推荐暂时无法读取，请稍后重试');
}

interface DoubanMetadata {
  id: string;
  card_subtitle?: string;
  rating?: { count?: number; value?: number };
}

/** The rich API supplies actual vote counts; the browse API remains the ordering authority. */
async function browseMetadata(options: DoubanBrowseOptions, end: number): Promise<Map<string, DoubanMetadata>> {
  const section = DOUBAN_SECTIONS.find((entry) => entry.id === options.category)!;
  const types = options.category === 'anime' ? ['movie', 'tv'] : [options.category === 'movie' ? 'movie' : 'tv'];
  const years = options.year === '1900-1969' ? ['60年代', '更早']
    : [options.year.includes('-') ? `${options.year.slice(2, 4)}年代` : options.year];
  const streams = await Promise.all(types.flatMap((type) => years.map(async (year) => {
    const items: DoubanMetadata[] = [];
    // Cached prefixes cover every possible movie/TV position in a combined animation page.
    for (let start = 0; start < Math.min(end, 1000); start += 100) {
      const params = new URLSearchParams({
        start: String(start), count: '100', sort: options.sort === 'hot' ? 'U' : 'R',
        score_range: options.sort === 'latest' ? '1,10' : '0,10',
        tags: [section.tag, options.genre, options.region, year].filter(Boolean).join(','),
      });
      const data = await fetchBrowseJson<{ items: DoubanMetadata[]; total?: number }>(
        `https://m.douban.com/rexxar/api/v2/${type}/recommend?${params}`, 'items', DOUBAN_CACHE_TTL_MS[options.sort]);
      items.push(...data.items);
      if (!data.items.length || (typeof data.total === 'number' && start + 100 >= data.total)) break;
    }
    return items;
  })));
  return new Map(streams.flat().map((item) => [String(item.id), item]));
}

function browseItem(subject: DoubanRawSubject, options: DoubanBrowseOptions, metadata?: DoubanMetadata): DoubanItem {
  return {
    id: String(subject.id), title: subject.title, cover: subject.cover || '',
    rating: subject.rate && subject.rate !== '0' ? subject.rate : undefined,
    ...(metadata?.rating?.count !== undefined ? { ratingCount: metadata.rating.count } : {}),
    isTv: options.category === 'tv' || options.category === 'variety',
  };
}

/** Filtering uses raw upstream offsets, so removed items never create skipped pages. */
async function fetchFilteredBrowse(options: DoubanBrowseOptions): Promise<DoubanBrowseResponse> {
  const items: DoubanItem[] = [];
  const seen = new Set<string>();
  let start = options.start;
  // Bound each request; an unfinished scan exposes a continuation even if it found no cards.
  for (let batch = 0; batch < 4; batch++) {
    const target = doubanBrowseUrl({ ...options, start, limit: 49 });
    const { data: raw } = await fetchBrowseJson<{ data: DoubanRawSubject[] }>(target, 'data', DOUBAN_CACHE_TTL_MS[options.sort]);
    if (!raw.length) return { items, nextStart: null };
    const metadata = await browseMetadata(options, start + raw.length);
    for (let index = 0; index < raw.length; index++) {
      const subject = raw[index];
      const id = String(subject.id || '');
      if (!id || !subject.title || seen.has(id)) continue;
      seen.add(id);
      const details = metadata.get(id);
      const ratingCount = details?.rating?.count;
      if (options.sort === 'latest' && (typeof ratingCount !== 'number' || !Number.isFinite(ratingCount) || ratingCount < DOUBAN_LATEST_MIN_RATINGS)) continue;
      if (options.category === 'variety') {
        // Some user-tagged sitcoms appear in Douban's variety recommendations.
        const genres = details?.card_subtitle?.split('/')[2]?.trim().split(/\s+/) ?? [];
        if (!DOUBAN_SECTIONS.find((entry) => entry.id === 'variety')!.genres.some((genre) => genres.includes(genre))) continue;
      }
      if (items.length === options.limit) return { items, nextStart: start + index };
      items.push(browseItem(subject, options, details));
    }
    start += raw.length;
    if (raw.length < 50) return { items, nextStart: null };
  }
  return { items, nextStart: start };
}

/** Four independent Douban categories with upstream filtering and pagination. */
export async function fetchDoubanBrowse(options: DoubanBrowseOptions): Promise<DoubanBrowseResponse> {
  const target = doubanBrowseUrl(options);
  const cacheKey = `douban-browse:v2:${target}`;
  const ttlMs = DOUBAN_CACHE_TTL_MS[options.sort];
  const cached = getCache<DoubanBrowseResponse>(cacheKey);
  if (cached) return cached;
  if (options.sort === 'latest' || (options.sort === 'hot' && options.category === 'variety')) {
    const result = await fetchFilteredBrowse(options);
    setCache(cacheKey, result, ttlMs);
    return result;
  }
  const { data: raw } = await fetchBrowseJson<{ data: DoubanRawSubject[] }>(target, 'data', ttlMs);
  const seen = new Set<string>();
  const items: DoubanItem[] = [];
  for (const subject of raw.slice(0, options.limit)) {
    const id = String(subject.id || '');
    if (!id || !subject.title || seen.has(id)) continue;
    seen.add(id);
    items.push(browseItem(subject, options));
  }
  const result = { items, nextStart: raw.length > options.limit ? options.start + options.limit : null };
  setCache(cacheKey, result, ttlMs);
  return result;
}
