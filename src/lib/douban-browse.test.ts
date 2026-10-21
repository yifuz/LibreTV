import { describe, expect, it } from 'vitest';
import { DOUBAN_YEARS, doubanBrowseUrl, nextDoubanPage, parseDoubanBrowseOptions } from './douban-browse';

describe('Douban browse filters', () => {
  it('combines category, region, genre, year, sort and actual page offset', () => {
    const options = parseDoubanBrowseOptions(new URLSearchParams('category=variety&sort=latest&region=中国大陆&genre=真人秀&year=2015&start=24&limit=24'));
    const target = new URL(doubanBrowseUrl(options));
    expect(target.pathname).toBe('/j/new_search_subjects');
    expect(Object.fromEntries(target.searchParams)).toEqual({ tags: '综艺', sort: 'R', range: '1,10', start: '24', limit: '25', countries: '中国大陆', genres: '真人秀', year_range: '2015,2015' });
  });

  it('uses recent heat for popular titles while keeping high-score ordering unrestricted', () => {
    const hot = parseDoubanBrowseOptions(new URLSearchParams('category=movie'));
    expect(new URL(doubanBrowseUrl(hot)).searchParams.get('sort')).toBe('U');
    const rating = new URL(doubanBrowseUrl({ ...hot, sort: 'rating' }));
    expect(rating.searchParams.get('sort')).toBe('S');
    expect(rating.searchParams.get('range')).toBe('0,10');
  });

  it('maps every year preset to an inclusive upstream range and leaves all-years unrestricted', () => {
    expect(DOUBAN_YEARS[0].value).toBe(String(new Date().getUTCFullYear()));
    for (const { value } of DOUBAN_YEARS) {
      const options = parseDoubanBrowseOptions(new URLSearchParams({ category: 'movie', year: value }));
      const [from, to = from] = value.split('-');
      expect(new URL(doubanBrowseUrl(options)).searchParams.get('year_range')).toBe(`${from},${to}`);
    }
    const defaults = parseDoubanBrowseOptions(new URLSearchParams('category=movie'));
    expect(defaults.year).toBe('');
    expect(new URL(doubanBrowseUrl(defaults)).searchParams.has('year_range')).toBe(false);
  });

  it('rejects filters that would silently request another category or an invalid page', () => {
    for (const query of ['category=unknown', 'category=movie&sort=U', 'category=variety&genre=科幻', 'category=tv&region=内网', 'category=anime&start=-24', 'category=anime&start=abc', 'category=movie&limit=100', 'category=movie&year=latest', 'category=movie&year=2024,2025', 'category=tv&year=1999-1990', `category=anime&year=${new Date().getUTCFullYear() + 1}`]) {
      expect(() => parseDoubanBrowseOptions(new URLSearchParams(query))).toThrow();
    }
  });

  it('stops repeated or exhausted upstream pages while preserving real next offsets', () => {
    const first = { items: [{ id: '1', title: 'One', cover: '' }], nextStart: 24 };
    const second = { items: [{ id: '2', title: 'Two', cover: '' }], nextStart: 48 };
    expect(nextDoubanPage(first, [first])).toBe(24);
    expect(nextDoubanPage(second, [first, second])).toBe(48);
    expect(nextDoubanPage({ ...first, nextStart: 48 }, [first, first])).toBeUndefined();
    expect(nextDoubanPage({ ...second, nextStart: null }, [first, second])).toBeUndefined();
    expect(nextDoubanPage({ items: [], nextStart: 200 }, [first, { items: [], nextStart: 200 }])).toBe(200);
  });
});
