import type { DoubanItem } from './types';

export const DOUBAN_PAGE_SIZE = 24;
export const DOUBAN_LATEST_MIN_RATINGS = 500;
export type DoubanCategory = 'movie' | 'tv' | 'variety' | 'anime';
export type DoubanSort = 'hot' | 'latest' | 'rating';

/** Keep client freshness, query retention and upstream caches on the same policy. */
export const DOUBAN_CACHE_TTL_MS: Readonly<Record<DoubanSort, number>> = {
  hot: 6 * 60 * 60_000,
  latest: 6 * 60 * 60_000,
  rating: 24 * 60 * 60_000,
};

export const DOUBAN_SECTIONS: ReadonlyArray<{
  id: DoubanCategory;
  title: string;
  tag: string;
  genres: readonly string[];
}> = [
  { id: 'movie', title: '电影', tag: '电影', genres: ['剧情', '喜剧', '动作', '爱情', '科幻', '悬疑', '恐怖', '动画', '纪录片', '战争'] },
  { id: 'tv', title: '电视剧', tag: '电视剧', genres: ['剧情', '喜剧', '爱情', '悬疑', '犯罪', '科幻', '古装', '武侠'] },
  { id: 'variety', title: '综艺', tag: '综艺', genres: ['真人秀', '脱口秀', '音乐', '歌舞'] },
  { id: 'anime', title: '动漫', tag: '动画', genres: ['喜剧', '奇幻', '冒险', '科幻', '动作', '家庭'] },
];

export const DOUBAN_REGIONS = ['中国大陆', '中国香港', '中国台湾', '美国', '日本', '韩国', '英国', '法国'] as const;
export const DOUBAN_SORTS: ReadonlyArray<{ id: DoubanSort; title: string }> = [
  { id: 'hot', title: '热门' }, { id: 'latest', title: '最新' }, { id: 'rating', title: '高分' },
];

// Recent titles can be selected by year; older titles use decade ranges.
const currentYear = new Date().getUTCFullYear();
export const DOUBAN_YEARS: ReadonlyArray<{ value: string; title: string }> = [
  ...Array.from({ length: currentYear - 1999 }, (_, index) => {
    const year = String(currentYear - index);
    return { value: year, title: year };
  }),
  { value: '1990-1999', title: '1990–1999' },
  { value: '1980-1989', title: '1980–1989' },
  { value: '1970-1979', title: '1970–1979' },
  { value: '1900-1969', title: '更早（1900–1969）' },
];

export interface DoubanBrowseOptions {
  category: DoubanCategory;
  sort: DoubanSort;
  region: string;
  genre: string;
  year: string;
  start: number;
  limit: number;
}

export interface DoubanBrowseResponse {
  items: DoubanItem[];
  nextStart: number | null;
  cache?: { updatedAt: number; stale: boolean };
}

export function nextDoubanPage(lastPage: DoubanBrowseResponse, pages: DoubanBrowseResponse[]): number | undefined {
  const previousIds = new Set(pages.slice(0, -1).flatMap((page) => page.items.map((item) => item.id)));
  if (lastPage.items.length && !lastPage.items.some((item) => !previousIds.has(item.id))) return undefined;
  return lastPage.nextStart ?? undefined;
}

/** Shared validation keeps UI filters and upstream query parameters in sync. */
export function parseDoubanBrowseOptions(params: URLSearchParams): DoubanBrowseOptions {
  const section = DOUBAN_SECTIONS.find((entry) => entry.id === params.get('category'));
  if (!section) throw new Error('无效的推荐分类');
  const sort = params.get('sort') || 'hot';
  if (!DOUBAN_SORTS.some((entry) => entry.id === sort)) throw new Error('无效的排序方式');
  const region = params.get('region') || '';
  if (region && !DOUBAN_REGIONS.some((entry) => entry === region)) throw new Error('无效的地区');
  const genre = params.get('genre') || '';
  if (genre && !section.genres.includes(genre)) throw new Error('该分类不支持此类型');
  const year = params.get('year') || '';
  if (year && !DOUBAN_YEARS.some((entry) => entry.value === year)) throw new Error('无效的年份');
  const start = Number(params.get('start') || 0);
  const limit = Number(params.get('limit') || DOUBAN_PAGE_SIZE);
  if (!Number.isSafeInteger(start) || start < 0) throw new Error('无效的分页起点');
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) throw new Error('每页数量必须为 1–50');
  return { category: section.id, sort: sort as DoubanSort, region, genre, year, start, limit };
}

export function doubanBrowseUrl(options: DoubanBrowseOptions): string {
  const section = DOUBAN_SECTIONS.find((entry) => entry.id === options.category)!;
  const sorts: Record<DoubanSort, string> = { hot: 'U', latest: 'R', rating: 'S' };
  const params = new URLSearchParams({
    tags: section.tag, sort: sorts[options.sort], range: options.sort === 'latest' ? '1,10' : '0,10',
    start: String(options.start),
    // One extra item determines whether another real upstream page exists.
    limit: String(options.limit + 1),
  });
  if (options.region) params.set('countries', options.region);
  if (options.genre) params.set('genres', options.genre);
  if (options.year) {
    const [from, to = from] = options.year.split('-');
    params.set('year_range', `${from},${to}`);
  }
  return `https://movie.douban.com/j/new_search_subjects?${params}`;
}
