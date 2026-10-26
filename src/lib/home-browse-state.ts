'use client';

import { create } from 'zustand';
import { DOUBAN_SECTIONS, parseDoubanBrowseOptions, type DoubanCategory, type DoubanSort } from './douban-browse';

export interface BrowseFilters { sort: DoubanSort; region: string; genre: string; year: string }
export const DEFAULT_BROWSE_FILTERS: BrowseFilters = { sort: 'hot', region: '', genre: '', year: '' };
const STORAGE_KEY = 'libretv-home-filters-v1';
const defaultFilters = () => Object.fromEntries(DOUBAN_SECTIONS.map(({ id }) => [id, { ...DEFAULT_BROWSE_FILTERS }])) as Record<DoubanCategory, BrowseFilters>;

export function normalizeBrowseFilters(category: DoubanCategory, value: unknown): BrowseFilters {
  if (!value || typeof value !== 'object') return { ...DEFAULT_BROWSE_FILTERS };
  const input = value as Record<string, unknown>;
  const result = { ...DEFAULT_BROWSE_FILTERS };
  // 一个过期或损坏的字段不会抹掉其他仍然有效的筛选。
  for (const field of ['sort', 'region', 'genre', 'year'] as const) {
    if (typeof input[field] !== 'string') continue;
    try {
      const parsed = parseDoubanBrowseOptions(new URLSearchParams({ category, ...result, [field]: input[field] as string }));
      Object.assign(result, { [field]: parsed[field] });
    } catch { /* 忽略未知筛选。 */ }
  }
  return result;
}

interface BrowseState {
  ready: boolean;
  filters: Record<DoubanCategory, BrowseFilters>;
  setFilters: (category: DoubanCategory, patch: Partial<BrowseFilters>) => void;
}

export const useHomeBrowseState = create<BrowseState>((set, get) => ({
  ready: false,
  filters: defaultFilters(),
  setFilters(category, patch) {
    const filters = { ...get().filters, [category]: normalizeBrowseFilters(category, { ...get().filters[category], ...patch }) };
    set({ filters });
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters)); } catch { /* 隐私模式继续使用内存。 */ }
  },
}));

export function hydrateHomeBrowseFilters(): void {
  if (useHomeBrowseState.getState().ready) return;
  const filters = defaultFilters();
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
    for (const { id } of DOUBAN_SECTIONS) filters[id] = normalizeBrowseFilters(id, saved?.[id]);
  } catch { /* 首次访问或损坏的存储使用默认值。 */ }
  useHomeBrowseState.setState({ ready: true, filters });
}

export interface BrowsePosition { y: number; focusId?: string }
// 浏览位置只保留在当前应用会话；推荐分页由根 QueryClient 保留，不重放网络请求。
let position: BrowsePosition | undefined;
export function getHomeBrowsePosition(): BrowsePosition | undefined { return position; }
export function saveHomeBrowsePosition(): void {
  if (typeof window === 'undefined' || document.querySelector('[aria-modal="true"]')) return;
  position = {
    y: window.scrollY,
    focusId: (document.activeElement as HTMLElement | null)?.dataset.browseFocus,
  };
}
