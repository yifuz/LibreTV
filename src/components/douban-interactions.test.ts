// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DoubanBrowseOptions } from '@/lib/douban-browse';

vi.mock('./auth', () => ({ useAuth: () => ({ checked: true, verified: true, openLogin() {} }) }));
vi.mock('@/lib/store', () => ({ useAppStore: (selector: (state: unknown) => unknown) => selector({ doubanEnabled: true, recommendSource: 'douban' }) }));
vi.mock('@/lib/client-api', () => ({ api: { douban: vi.fn() } }));
vi.mock('./video-card', async () => {
  const { createElement } = await import('react');
  return { DoubanCard: ({ item, onClick }: { item: { id: string; title: string }; onClick: () => void }) => createElement('button', { 'data-card': item.id, onClick }, item.title) };
});
import { RecommendSection } from './douban-section';
import { api } from '@/lib/client-api';
import { useHomeBrowseState } from '@/lib/home-browse-state';

let root: Root;
let host: HTMLDivElement;
let client: QueryClient;
const observers: Observer[] = [];
class Observer {
  target?: Element;
  disconnected = false;
  constructor(private callback: IntersectionObserverCallback) { observers.push(this); }
  observe(target: Element) { this.target = target; }
  disconnect() { this.disconnected = true; }
  emit(inside: boolean) { this.callback([{ target: this.target, isIntersecting: inside } as IntersectionObserverEntry], this as unknown as IntersectionObserver); }
}
const flush = async (ms = 1) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
const render = async (active = true) => { await act(async () => { root.render(createElement(QueryClientProvider, { client }, createElement(RecommendSection, { active, onPick() {} }))); }); await flush(); };
const click = async (element: Element | null) => { expect(element).toBeTruthy(); await act(async () => { (element as HTMLElement).click(); }); await flush(); };
const enter = async (category: string, inside = true) => {
  const observer = observers.findLast((item) => !item.disconnected && item.target?.getAttribute('data-recommend-category') === category)!;
  expect(observer).toBeTruthy(); await act(async () => observer.emit(inside));
};

beforeEach(() => {
  vi.useFakeTimers(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.stubGlobal('IntersectionObserver', Observer);
  observers.length = 0; sessionStorage.clear(); useHomeBrowseState.setState({ ready: false });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(api.douban).mockReset().mockImplementation(async (options: DoubanBrowseOptions) => ({
    items: Array.from({ length: 24 }, (_, i) => ({ id: `${options.category}-${options.start + i}`, title: `Card ${options.start + i}`, cover: '' })),
    nextStart: options.start === 0 ? 24 : null,
  }));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); client.clear(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('Recommendation loading and return navigation', () => {
  it('requests only the first category until another section stays near the viewport', async () => {
    await render();
    expect(vi.mocked(api.douban).mock.calls.map(([options]) => options.category)).toEqual(['movie']);
    await enter('tv'); await flush(50); await enter('tv', false); await flush(150);
    expect(api.douban).toHaveBeenCalledTimes(1);
    await enter('tv'); await flush(130);
    await flush();
    expect(vi.mocked(api.douban).mock.calls.map(([options]) => options.category)).toEqual(['movie', 'tv']);
    expect(host.querySelectorAll('[data-recommend-category="tv"] [data-card]')).toHaveLength(24);
    expect(host.querySelectorAll('[data-recommend-category="anime"] [data-card]')).toHaveLength(0);
  });

  it('restores the selected filters and both loaded pages without repeating requests', async () => {
    await render();
    await click(host.querySelector('[aria-label="电影类型"]'));
    await click(Array.from(host.querySelectorAll('[role="option"]')).find((node) => node.textContent === '科幻')!);
    await click(host.querySelector('[aria-label="加载更多电影"]'));
    expect(host.querySelectorAll('[data-recommend-category="movie"] [data-card]')).toHaveLength(48);
    const calls = vi.mocked(api.douban).mock.calls.length;
    await act(async () => root.unmount()); root = createRoot(host);
    await render();
    expect(host.querySelector('[aria-label="电影类型"]')?.textContent).toContain('科幻');
    expect(host.querySelectorAll('[data-recommend-category="movie"] [data-card]')).toHaveLength(48);
    expect(api.douban).toHaveBeenCalledTimes(calls);
  });

  it('does not request hidden recommendations while search results are active', async () => {
    await render(false);
    expect(api.douban).not.toHaveBeenCalled();
    await render();
    expect(api.douban).toHaveBeenCalledTimes(1);
    await render(false);
    await act(async () => useHomeBrowseState.getState().setFilters('movie', { region: '日本' }));
    await flush(150);
    expect(api.douban).toHaveBeenCalledTimes(1);
  });

  it('keeps the actual supported year choices available in the dropdown', async () => {
    await render(); await click(host.querySelector('[aria-label="电影年份"]'));
    const labels = Array.from(host.querySelectorAll('[role="option"]')).map((node) => node.textContent);
    expect(labels).toContain(String(new Date().getUTCFullYear()));
    expect(labels).toContain('1990–1999');
    expect(labels).toContain('更早（1900–1969）');
  });

  it('scrolls long year menus to the keyboard selection and commits it on Enter', async () => {
    const previous = HTMLElement.prototype.scrollIntoView;
    const scroll = vi.fn(); HTMLElement.prototype.scrollIntoView = scroll;
    try {
      await render(); await click(host.querySelector('[aria-label="电影年份"]'));
      const trigger = host.querySelector('[aria-label="电影年份"]')!;
      await act(async () => {
        for (let i = 0; i < 5; i++) trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      });
      expect(scroll).toHaveBeenCalled();
      await act(async () => trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
      expect(useHomeBrowseState.getState().filters.movie.year).toBe(String(new Date().getUTCFullYear() - 4));
    } finally {
      if (previous) HTMLElement.prototype.scrollIntoView = previous;
      else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
    }
  });
});
