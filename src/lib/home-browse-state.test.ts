// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hydrateHomeBrowseFilters, normalizeBrowseFilters, useHomeBrowseState } from './home-browse-state';

beforeEach(() => { sessionStorage.clear(); useHomeBrowseState.setState({ ready: false }); });

describe('Recommendation filter memory', () => {
  it('restores independent category filters after a new hydration', () => {
    hydrateHomeBrowseFilters();
    useHomeBrowseState.getState().setFilters('anime', { region: '日本', genre: '奇幻', year: '2024', sort: 'latest' });
    useHomeBrowseState.getState().setFilters('movie', { region: '美国', sort: 'rating' });
    useHomeBrowseState.setState({ ready: false });
    hydrateHomeBrowseFilters();
    const { filters } = useHomeBrowseState.getState();
    expect(filters.anime).toEqual({ region: '日本', genre: '奇幻', year: '2024', sort: 'latest' });
    expect(filters.movie.region).toBe('美国');
    expect(filters.tv.sort).toBe('hot');
  });

  it('rejects invalid fields without discarding other valid filters', () => {
    expect(normalizeBrowseFilters('variety', { sort: 'rating', genre: '科幻', year: '2024', region: 'Moon' })).toEqual({ sort: 'rating', genre: '', year: '2024', region: '' });
    expect(normalizeBrowseFilters('movie', null).sort).toBe('hot');
  });

  it('continues in memory if browser storage is blocked or malformed', () => {
    sessionStorage.setItem('libretv-home-filters-v1', 'broken');
    hydrateHomeBrowseFilters();
    expect(useHomeBrowseState.getState().ready).toBe(true);
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    useHomeBrowseState.getState().setFilters('tv', { year: '2023' });
    expect(useHomeBrowseState.getState().filters.tv.year).toBe('2023');
    spy.mockRestore();
  });
});
