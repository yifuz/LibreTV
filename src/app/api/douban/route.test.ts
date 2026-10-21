import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/douban', () => ({ fetchDoubanBrowse: vi.fn(), fetchDoubanRecommend: vi.fn() }));
import { GET } from './route';
import { fetchDoubanBrowse, fetchDoubanRecommend } from '@/lib/douban';
import { SESSION_COOKIE, signSession } from '@/lib/auth';

const oldPassword = process.env.PASSWORD;
beforeEach(() => { vi.resetAllMocks(); process.env.PASSWORD = 'douban-route-test'; });
afterEach(() => { if (oldPassword === undefined) delete process.env.PASSWORD; else process.env.PASSWORD = oldPassword; });
const request = (query: string, authenticated = true) => new Request(`http://localhost/api/douban?${query}`, { headers: authenticated ? { cookie: `${SESSION_COOKIE}=${signSession().token}` } : {} });

describe('Douban route', () => {
  it('does not call upstream before authentication or after invalid filter input', async () => {
    expect((await GET(request('category=movie', false))).status).toBe(401);
    expect((await GET(request('category=variety&genre=科幻'))).status).toBe(400);
    expect((await GET(request('category=movie&year=invalid'))).status).toBe(400);
    expect(fetchDoubanBrowse).not.toHaveBeenCalled();
  });
  it('passes section filters and next-page metadata without changing them', async () => {
    vi.mocked(fetchDoubanBrowse).mockResolvedValue({ items: [], nextStart: 48 });
    const response = await GET(request('category=anime&sort=rating&region=日本&genre=奇幻&year=2024&start=24&limit=24'));
    expect(response.status).toBe(200);
    expect(fetchDoubanBrowse).toHaveBeenCalledWith({ category: 'anime', sort: 'rating', region: '日本', genre: '奇幻', year: '2024', start: 24, limit: 24 });
    expect(await response.json()).toEqual({ items: [], nextStart: 48 });
  });
  it('keeps existing type/tag clients working', async () => {
    vi.mocked(fetchDoubanRecommend).mockResolvedValue([]);
    expect((await GET(request('type=tv&tag=综艺&pageStart=24&pageSize=24'))).status).toBe(200);
    expect(fetchDoubanRecommend).toHaveBeenCalledWith('tv', '综艺', 24, 24);
  });
  it('returns a retryable error for a failed upstream', async () => {
    vi.mocked(fetchDoubanBrowse).mockRejectedValue(new Error('豆瓣暂时不可用'));
    expect((await GET(request('category=tv'))).status).toBe(502);
  });
});
