import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./fetch-utils', () => ({ fetchUpstream: vi.fn(), getCache: vi.fn(), setCache: vi.fn() }));
import { fetchUpstream, getCache, setCache } from './fetch-utils';
import { fetchDoubanBrowse } from './douban';
import type { DoubanBrowseOptions } from './douban-browse';

const options: DoubanBrowseOptions = { category: 'movie', sort: 'hot', region: '', genre: '', year: '', start: 0, limit: 24 };
const subject = (id: number) => ({ id: String(id), title: `Title ${id}`, cover: 'https://img1.doubanio.com/example.jpg', rate: '8.1' });
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getCache).mockReturnValue(undefined);
});

describe('Douban upstream pagination', () => {
  it('returns 24 cards and a real next offset using one lookahead item', async () => {
    vi.mocked(fetchUpstream).mockResolvedValue(new Response(JSON.stringify({ data: Array.from({ length: 25 }, (_, i) => subject(i + 1)) })));
    const result = await fetchDoubanBrowse(options);
    expect(result.items).toHaveLength(24);
    expect(result.items[23].id).toBe('24');
    expect(result.nextStart).toBe(24);
    expect(String(vi.mocked(fetchUpstream).mock.calls[0][0])).toContain('limit=25');
  });

  it('finishes pagination when the upstream has no lookahead, including an empty last page', async () => {
    for (const count of [0, 7, 24]) {
      vi.mocked(fetchUpstream).mockResolvedValue(new Response(JSON.stringify({ data: Array.from({ length: count }, (_, i) => subject(i + 25)) })));
      const result = await fetchDoubanBrowse({ ...options, start: 24 });
      expect(result.items).toHaveLength(count);
      expect(result.nextStart).toBeNull();
    }
  });

  it('does not collapse pagination offsets after duplicate or malformed upstream cards', async () => {
    vi.mocked(fetchUpstream).mockResolvedValue(new Response(JSON.stringify({ data: [subject(1), subject(1), { id: 'bad' }, ...Array.from({ length: 22 }, (_, i) => subject(i + 2))] })));
    const result = await fetchDoubanBrowse(options);
    expect(new Set(result.items.map((item) => item.id)).size).toBe(result.items.length);
    expect(result.items.some((item) => !item.title)).toBe(false);
    expect(result.nextStart).toBe(24);
  });

  it('separates filter combinations in the cache', async () => {
    vi.mocked(fetchUpstream).mockImplementation(async () => new Response(JSON.stringify({ data: [subject(1)] })));
    await fetchDoubanBrowse(options);
    await fetchDoubanBrowse({ ...options, category: 'tv', genre: '悬疑', region: '中国大陆' });
    await fetchDoubanBrowse({ ...options, year: '2024' });
    await fetchDoubanBrowse({ ...options, year: '2025' });
    const keys = vi.mocked(setCache).mock.calls.map((call) => call[0]).filter((key) => key.startsWith('douban-browse:'));
    expect(new Set(keys).size).toBe(4);
  });

  it('reports an invalid upstream response instead of presenting a successful empty category', async () => {
    vi.mocked(fetchUpstream).mockImplementation(async () => new Response(JSON.stringify({ error: 'rate limited' })));
    await expect(fetchDoubanBrowse(options)).rejects.toThrow('豆瓣推荐');
  });
});

describe('Extended recommendation cache lifetimes', () => {
  it.each([['hot', 6], ['latest', 6], ['rating', 24]] as const)(
    'reuses %s results for %i hours and only fetches upstream again after expiry', async (sort, hours) => {
      const realCache = await vi.importActual<typeof import('./fetch-utils')>('./fetch-utils');
      vi.mocked(getCache).mockImplementation(realCache.getCache);
      vi.mocked(setCache).mockImplementation(realCache.setCache);
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-10-21T00:00:00Z'));
      try {
        vi.mocked(fetchUpstream).mockImplementation(async (address) => new Response(JSON.stringify(
          String(address).includes('m.douban.com')
            ? { items: [{ id: '1', rating: { count: 1000 } }], total: 1 }
            : { data: [subject(1)] }
        )));
        const first = await fetchDoubanBrowse({ ...options, sort });
        const initialCalls = vi.mocked(fetchUpstream).mock.calls.length;
        expect(initialCalls).toBe(sort === 'latest' ? 2 : 1);

        vi.advanceTimersByTime(30 * 60_000);
        expect(await fetchDoubanBrowse({ ...options, sort })).toBe(first);
        expect(fetchUpstream).toHaveBeenCalledTimes(initialCalls);

        vi.advanceTimersByTime(hours * 60 * 60_000 - 30 * 60_000 - 1);
        expect(await fetchDoubanBrowse({ ...options, sort })).toBe(first);
        expect(fetchUpstream).toHaveBeenCalledTimes(initialCalls);

        vi.advanceTimersByTime(2);
        expect(await fetchDoubanBrowse({ ...options, sort })).not.toBe(first);
        // Both the final page and its underlying list / metadata caches must expire.
        expect(fetchUpstream).toHaveBeenCalledTimes(initialCalls * 2);
      } finally { vi.useRealTimers(); }
    }
  );
});

describe('Recent heat and moderately filtered latest releases', () => {
  const metadata = (id: number, count = 500, genre = '剧情') => ({ id: String(id), rating: { count, value: 6 }, card_subtitle: `2026 / 中国大陆 / ${genre} / Director / Cast` });
  const mockFeeds = (ordered: ReturnType<typeof subject>[], details: ReturnType<typeof metadata>[]) => {
    vi.mocked(fetchUpstream).mockImplementation(async (address) => {
      const url = new URL(String(address));
      if (url.hostname === 'm.douban.com') return new Response(JSON.stringify({ items: details, total: details.length }));
      const start = Number(url.searchParams.get('start'));
      const count = Number(url.searchParams.get('limit'));
      return new Response(JSON.stringify({ data: ordered.slice(start, start + count) }));
    });
  };

  it('filters by actual vote count, preserves release order, and resumes at the first accepted lookahead', async () => {
    const ordered = Array.from({ length: 90 }, (_, i) => subject(i + 1));
    mockFeeds(ordered, ordered.map((_, i) => metadata(i + 1, i % 3 === 0 ? 499 : 500)));
    const first = await fetchDoubanBrowse({ ...options, sort: 'latest' });
    expect(first.items).toHaveLength(24);
    expect(first.items.map((item) => item.id)).toEqual(ordered.filter((_, i) => i % 3 !== 0).slice(0, 24).map((item) => item.id));
    expect(first.nextStart).toBe(37);
    expect(first.items.every((item) => item.ratingCount! >= 500)).toBe(true);
    const second = await fetchDoubanBrowse({ ...options, sort: 'latest', start: first.nextStart! });
    expect(second.items).toHaveLength(24);
    expect(second.items[0].id).toBe('38');
    expect(second.items.some((item) => first.items.some((other) => other.id === item.id))).toBe(false);
  });

  it('keeps a low-scoring but sufficiently reviewed new release and excludes missing or invalid counts', async () => {
    mockFeeds([subject(1), { ...subject(2), rate: '2.1' }, subject(3), subject(4), subject(5)], [metadata(1, 499), metadata(2, 500), metadata(3, NaN), metadata(4, -1)]);
    const result = await fetchDoubanBrowse({ ...options, sort: 'latest' });
    expect(result.items.map((item) => item.id)).toEqual(['2']);
    expect(result.items[0].rating).toBe('2.1');
    expect(result.nextStart).toBeNull();
  });

  it('fills a page across rejected batches instead of treating the first empty filtered batch as exhaustion', async () => {
    const ordered = Array.from({ length: 80 }, (_, i) => subject(i + 1));
    mockFeeds(ordered, ordered.map((_, i) => metadata(i + 1, i < 50 ? 10 : 800)));
    const result = await fetchDoubanBrowse({ ...options, sort: 'latest' });
    expect(result.items).toHaveLength(24);
    expect(result.items[0].id).toBe('51');
    expect(result.nextStart).toBe(74);
  });

  it('bounds empty scans and retains a continuation when more upstream candidates remain', async () => {
    const ordered = Array.from({ length: 250 }, (_, i) => subject(i + 1));
    mockFeeds(ordered, ordered.map((_, i) => metadata(i + 1, 1)));
    const result = await fetchDoubanBrowse({ ...options, sort: 'latest' });
    expect(result).toEqual({ items: [], nextStart: 200 });
    const second = await fetchDoubanBrowse({ ...options, sort: 'latest', start: 200 });
    expect(second.nextStart).toBeNull();
  });

  it('drops wrongly tagged sitcoms from popular variety while retaining recent-heat order and unrated new shows', async () => {
    mockFeeds([subject(1), { ...subject(2), rate: '' }, subject(3)], [metadata(1, 90000, '喜剧'), metadata(2, 0, '真人秀'), metadata(3, 700, '脱口秀')]);
    const result = await fetchDoubanBrowse({ ...options, category: 'variety' });
    expect(result.items.map((item) => item.id)).toEqual(['2', '3']);
    expect(vi.mocked(fetchUpstream).mock.calls.every(([url]) => new URL(String(url)).searchParams.get('sort') === 'U')).toBe(true);
  });

  it('enriches animation movies and series without changing their combined release order', async () => {
    const calls: URL[] = [];
    vi.mocked(fetchUpstream).mockImplementation(async (address) => {
      const url = new URL(String(address)); calls.push(url);
      if (url.hostname !== 'm.douban.com') return new Response(JSON.stringify({ data: [subject(3), subject(1), subject(2)] }));
      return new Response(JSON.stringify({ items: url.pathname.includes('/movie/') ? [metadata(1), metadata(2)] : [metadata(3)], total: 2 }));
    });
    const result = await fetchDoubanBrowse({ ...options, category: 'anime', sort: 'latest', year: '2024', region: '日本', genre: '奇幻' });
    expect(result.items.map((item) => item.id)).toEqual(['3', '1', '2']);
    const richCalls = calls.filter((url) => url.hostname === 'm.douban.com');
    expect(richCalls).toHaveLength(2);
    expect(richCalls.every((url) => url.searchParams.get('tags') === '动画,奇幻,日本,2024')).toBe(true);
  });

  it('uses supported decade tags to obtain counts for the entire older year range', async () => {
    mockFeeds([subject(1)], [metadata(1)]);
    await fetchDoubanBrowse({ ...options, sort: 'latest', year: '1900-1969' });
    const tags = vi.mocked(fetchUpstream).mock.calls.map(([url]) => new URL(String(url))).filter((url) => url.hostname === 'm.douban.com').map((url) => url.searchParams.get('tags'));
    expect(tags).toEqual(['电影,60年代', '电影,更早']);
  });

  it('leaves high-score results and the rating API parameters unchanged', async () => {
    mockFeeds([{ ...subject(1), rate: '9.9' }, { ...subject(2), rate: '8.1' }], []);
    const result = await fetchDoubanBrowse({ ...options, sort: 'rating' });
    expect(result.items.map((item) => item.id)).toEqual(['1', '2']);
    expect(fetchUpstream).toHaveBeenCalledTimes(1);
    const url = new URL(String(vi.mocked(fetchUpstream).mock.calls[0][0]));
    expect(url.searchParams.get('sort')).toBe('S');
    expect(url.searchParams.get('range')).toBe('0,10');
  });

  it('reports metadata outages instead of silently accepting unverified latest titles', async () => {
    vi.mocked(fetchUpstream).mockImplementation(async (address) => new Response(JSON.stringify(String(address).includes('m.douban.com') ? { error: 'unavailable' } : { data: [subject(1)] })));
    await expect(fetchDoubanBrowse({ ...options, sort: 'latest' })).rejects.toThrow('豆瓣推荐');
  });

  it('sets a cooldown on explicit rate limits instead of trying another access path', async () => {
    for (const response of [new Response(JSON.stringify({ msg: '检测到有异常请求，请登录再试!', r: 1 })), new Response('', { status: 429 })]) {
      vi.clearAllMocks();
      vi.mocked(fetchUpstream).mockResolvedValue(response);
      await expect(fetchDoubanBrowse(options)).rejects.toThrow('豆瓣暂时限制访问');
      expect(setCache).toHaveBeenCalledWith('douban-access-limited', true, 300000);
      expect(fetchUpstream).toHaveBeenCalledTimes(1);
    }
  });

  it('serves cached pages during a cooldown and makes no fresh upstream request', async () => {
    const cached = { items: [{ id: '1', title: 'Cached', cover: '' }], nextStart: null };
    vi.mocked(getCache).mockImplementation((key) => key.startsWith('douban-browse:') ? cached : true);
    expect(await fetchDoubanBrowse(options)).toBe(cached);
    expect(fetchUpstream).not.toHaveBeenCalled();
    vi.mocked(getCache).mockImplementation((key) => key === 'douban-access-limited' ? true : undefined);
    await expect(fetchDoubanBrowse(options)).rejects.toThrow('豆瓣暂时限制访问');
    expect(fetchUpstream).not.toHaveBeenCalled();
  });
});
