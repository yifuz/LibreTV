import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const auth = vi.hoisted(() => ({ checked: true, verified: true, openLogin: () => {} }));
vi.mock('./auth', () => ({ useAuth: () => auth }));
vi.mock('@/lib/store', () => ({ useAppStore: (selector: (state: unknown) => unknown) => selector({ doubanEnabled: true, recommendSource: 'douban' }) }));
vi.mock('@/lib/client-api', () => ({ api: { douban: vi.fn() } }));
vi.mock('./video-card', async () => {
  const react = await import('react');
  return { DoubanCard: ({ item }: { item: { id: string; title: string } }) => react.createElement('button', { 'data-card-id': item.id }, item.title) };
});
import { RecommendSection } from './douban-section';

let client: QueryClient;
beforeEach(() => {
  vi.stubGlobal('React', React);
  auth.verified = true;
  client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  for (const category of ['movie', 'tv', 'variety', 'anime']) {
    client.setQueryData(['douban-browse', category, 'hot', '', '', ''], { pages: [{ items: Array.from({ length: 24 }, (_, index) => ({ id: `${category}-${index}`, title: `${category} ${index}`, cover: '' })), nextStart: 24 }], pageParams: [0] });
  }
});
afterEach(() => { client.clear(); vi.unstubAllGlobals(); });
const render = () => renderToStaticMarkup(React.createElement(QueryClientProvider, { client }, React.createElement(RecommendSection, { onPick: () => {} })));

describe('Four-category recommendation layout', () => {
  it('labels fallback recommendations without hiding cached cards', () => {
    client.setQueryData(['douban-browse', 'movie', 'hot', '', '', ''], { pages: [{ items: [{ id: 'saved', title: 'Saved film', cover: '' }], nextStart: null, cache: { stale: true, updatedAt: Date.now() - 86400000 } }], pageParams: [0] });
    const html = render();
    expect(html).toContain('豆瓣暂时不可用');
    expect(html).toContain('保存的推荐');
    expect(html).toContain('Saved film');
  });
  it('renders 24 cards and separate filters/load-more controls in every section', () => {
    const html = render();
    for (const [category, title] of [['movie', '电影'], ['tv', '电视剧'], ['variety', '综艺'], ['anime', '动漫']]) {
      const section = html.match(new RegExp(`<section id="recommend-${category}"[\\s\\S]*?</section>`))?.[0] || '';
      expect(section.match(/data-card-id=/g)).toHaveLength(24);
      expect(section).toContain(`aria-label="${title}地区"`);
      expect(section).toContain(`aria-label="${title}类型"`);
      expect(section).toContain(`aria-label="${title}年份"`);
      expect(section).toContain('全部年份');
      expect(section).toContain(`<option value="${new Date().getUTCFullYear()}">`);
      expect(section).toContain('<option value="1990-1999">1990–1999</option>');
      expect(section).toContain(`aria-label="加载更多${title}"`);
      expect(section).toContain('按豆瓣近期热度推荐');
    }
  });
  it('an exhausted category does not hide the other categories load-more buttons', () => {
    client.setQueryData(['douban-browse', 'movie', 'hot', '', '', ''], { pages: [{ items: [{ id: 'last', title: 'Last film', cover: '' }], nextStart: null }], pageParams: [0] });
    const html = render();
    expect(html).not.toContain('aria-label="加载更多电影"');
    expect(html).toContain('aria-label="加载更多电视剧"');
  });
  it('keeps recommendation data behind the existing login gate', () => {
    auth.verified = false;
    const html = render();
    expect(html).not.toContain('data-card-id=');
    expect(html).toContain('登录后查看综艺推荐');
  });
  it('offers continuation when a bounded filter scan has no accepted cards yet', () => {
    client.setQueryData(['douban-browse', 'variety', 'hot', '', '', ''], { pages: [{ items: [], nextStart: 200 }], pageParams: [0] });
    const html = render();
    expect(html).toContain('暂未找到符合条件的推荐，可以继续查找');
    expect(html).toContain('继续查找');
    expect(html).toContain('aria-label="加载更多综艺"');
  });
});
