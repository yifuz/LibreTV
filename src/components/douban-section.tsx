'use client';

import { useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/client-api';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import type { DoubanItem } from '@/lib/types';
import { DoubanCard } from './video-card';
import { useAuth } from './auth';
import { DOUBAN_CACHE_TTL_MS, DOUBAN_LATEST_MIN_RATINGS, DOUBAN_PAGE_SIZE, DOUBAN_REGIONS, DOUBAN_SECTIONS, DOUBAN_SORTS, DOUBAN_YEARS, nextDoubanPage, type DoubanCategory, type DoubanSort } from '@/lib/douban-browse';

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

/** Douban is the default; alternative recommendation modes remain available in settings. */
export function RecommendSection({ onPick }: { onPick: (title: string) => void }) {
  const doubanEnabled = useAppStore((s) => s.doubanEnabled);
  const recommendSource = useAppStore((s) => s.recommendSource);

  if (!doubanEnabled) return null;
  if (recommendSource === 'bangumi') return <BangumiView onPick={onPick} />;
  if (recommendSource === 'hot-list') return <HotListView onPick={onPick} />;
  return <DoubanView onPick={onPick} />;
}

/** Each category owns its filters, cached pages, errors and next-page requests. */
function DoubanView({ onPick }: { onPick: (title: string) => void }) {
  return (
    <div className="space-y-10" aria-label="豆瓣分类推荐">
      <nav className="flex flex-wrap items-center gap-2" aria-label="推荐分区导航">
        <span className="text-xs text-faint mr-1">豆瓣推荐</span>
        {DOUBAN_SECTIONS.map((section) => (
          <a key={section.id} href={`#recommend-${section.id}`} className="px-3 py-1.5 rounded-full text-sm bg-chip text-muted hover:bg-hover hover:text-content transition-colors">
            {section.title}
          </a>
        ))}
      </nav>
      {DOUBAN_SECTIONS.map((section) => <DoubanCategorySection key={section.id} category={section.id} onPick={onPick} />)}
    </div>
  );
}

function DoubanCategorySection({ category, onPick }: { category: DoubanCategory; onPick: (title: string) => void }) {
  const section = DOUBAN_SECTIONS.find((entry) => entry.id === category)!;
  const { checked, verified, openLogin } = useAuth();
  const [sort, setSort] = useState<DoubanSort>('hot');
  const [region, setRegion] = useState('');
  const [genre, setGenre] = useState('');
  const [year, setYear] = useState('');
  const query = useInfiniteQuery({
    queryKey: ['douban-browse', category, sort, region, genre, year],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => api.douban({ category, sort, region, genre, year, start: pageParam, limit: DOUBAN_PAGE_SIZE }, signal),
    getNextPageParam: nextDoubanPage,
    enabled: verified === true,
    staleTime: (query) => query.state.data?.pages.some((page) => page.cache?.stale) ? 60_000 : DOUBAN_CACHE_TTL_MS[sort],
    gcTime: DOUBAN_CACHE_TTL_MS[sort],
    retry: false,
  });
  const seen = new Set<string>();
  const items = (query.data?.pages.flatMap((page) => page.items) ?? []).filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  const stalePage = query.data?.pages.find((page) => page.cache?.stale);

  return (
    <section id={`recommend-${category}`} aria-labelledby={`recommend-${category}-title`} className="scroll-mt-20" data-recommend-category={category}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 id={`recommend-${category}-title`} className="text-xl font-semibold text-content">{section.title}</h2>
        <div className="flex items-center gap-1 rounded-lg bg-chip p-0.5" role="group" aria-label={`${section.title}排序`}>
          {DOUBAN_SORTS.map((option) => (
            <button key={option.id} type="button" onClick={() => setSort(option.id)} aria-pressed={sort === option.id}
              className={cn('px-3 py-1.5 rounded-md text-sm transition-colors', sort === option.id ? 'bg-accent text-on-accent' : 'text-muted hover:text-content')}>
              {option.title}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-faint mb-3">
        {sort === 'hot' ? '按豆瓣近期热度推荐' : sort === 'latest' ? `按首映／首播时间排列 · 至少 ${DOUBAN_LATEST_MIN_RATINGS} 人评价` : '按豆瓣评分排列'}
      </p>
      {stalePage?.cache && (
        <div role="status" className="text-xs text-warning mb-3 flex flex-wrap items-center gap-2">
          <span>豆瓣暂时不可用，显示 {new Date(stalePage.cache.updatedAt).toLocaleString('zh-CN')} 保存的推荐。</span>
          <button type="button" className="btn-ghost btn-sm" disabled={query.isFetching} onClick={() => void query.refetch()}>重试</button>
        </div>
      )}
      <div className="flex flex-wrap gap-3 mb-4">
        <label className="flex items-center gap-2 text-xs text-muted">
          地区
          <select aria-label={`${section.title}地区`} className="input py-1.5 text-sm min-w-0" value={region} onChange={(event) => setRegion(event.target.value)}>
            <option value="">全部地区</option>
            {DOUBAN_REGIONS.map((country) => <option key={country} value={country}>{country}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-muted">
          类型
          <select aria-label={`${section.title}类型`} className="input py-1.5 text-sm min-w-0" value={genre} onChange={(event) => setGenre(event.target.value)}>
            <option value="">全部类型</option>
            {section.genres.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-muted">
          年份
          <select aria-label={`${section.title}年份`} className="input py-1.5 text-sm min-w-0" value={year} onChange={(event) => setYear(event.target.value)}>
            <option value="">全部年份</option>
            {DOUBAN_YEARS.map((option) => <option key={option.value} value={option.value}>{option.title}</option>)}
          </select>
        </label>
        {(region || genre || year || sort !== 'hot') && (
          <button type="button" className="text-xs text-accent hover:underline" onClick={() => { setSort('hot'); setRegion(''); setGenre(''); setYear(''); }}>重置筛选</button>
        )}
      </div>

      {checked && !verified ? (
        <div className="text-center py-8"><button type="button" onClick={openLogin} className="btn-ghost text-sm">登录后查看{section.title}推荐</button></div>
      ) : query.isPending ? <GridSkeleton count={DOUBAN_PAGE_SIZE} />
        : query.isError && items.length === 0 ? (
          <div role="alert" className="text-center py-8 space-y-3">
            <p className="text-sm text-faint">{query.error instanceof Error ? query.error.message : `豆瓣${section.title}推荐暂时无法加载`}</p>
            <button type="button" className="btn-ghost text-sm" onClick={() => void query.refetch()}>重试</button>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center text-sm text-faint py-8 space-y-3">
            <p>{query.hasNextPage ? '暂未找到符合条件的推荐，可以继续查找' : '当前筛选暂无推荐，试试其他条件'}</p>
            {query.hasNextPage && <button type="button" className="btn-ghost text-sm" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()} aria-label={`加载更多${section.title}`}>
              {query.isFetchingNextPage ? '查找中…' : query.isFetchNextPageError ? '查找失败，点击重试' : '继续查找'}
            </button>}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5" aria-busy={query.isFetchingNextPage}>
              {items.map((item) => <DoubanCard key={item.id} item={item} onClick={() => onPick(item.title)} />)}
            </div>
            <div className="flex flex-col items-center gap-2 mt-5">
              <p className="text-xs text-faint" aria-live="polite">已显示 {items.length} 部{!query.hasNextPage ? ' · 已加载全部结果' : ''}</p>
              {query.hasNextPage && (
                <button type="button" className="btn-ghost text-sm min-w-36" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()} aria-label={`加载更多${section.title}`}>
                  {query.isFetchingNextPage ? '加载中…' : query.isFetchNextPageError ? '加载失败，点击重试' : '加载更多'}
                </button>
              )}
            </div>
          </>
        )}
    </section>
  );
}

/** Bangumi 每日放送：星期筛选，一次拉全量无分页 */
function BangumiView({ onPick }: { onPick: (title: string) => void }) {
  const [weekday, setWeekday] = useState<number | 'all'>('all');

  const query = useQuery({
    queryKey: ['bangumi-calendar'],
    queryFn: ({ signal }) => api.bangumiCalendar(signal),
  });

  let items: DoubanItem[] = [];
  if (query.data) {
    items = weekday === 'all'
      ? query.data.days.flatMap((d) => d.items)
      : (query.data.days.find((d) => d.weekday === weekday)?.items ?? []);
  }

  return (
    <section aria-label="新番放送推荐">
      <div className="flex flex-wrap gap-1.5 mb-4">
        <ChipButton active={weekday === 'all'} onClick={() => setWeekday('all')}>
          全部
        </ChipButton>
        {WEEKDAYS.map((name, i) => (
          <ChipButton key={name} active={weekday === i + 1} onClick={() => setWeekday(i + 1)}>
            {name}
          </ChipButton>
        ))}
      </div>

      {query.isError ? (
        <p className="text-center text-sm text-faint py-8">推荐内容加载失败，可稍后重试或在设置中关闭</p>
      ) : query.isLoading ? (
        <GridSkeleton />
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
          {items.map((item) => (
            <DoubanCard key={item.id} item={item} onClick={() => onPick(item.title)} />
          ))}
        </div>
      )}
    </section>
  );
}

const HOT_LISTS = [
  { id: 'douban_movie_weekly', label: '电影周榜' },
  { id: 'douban_tv_chinese', label: '国产剧周榜' },
  { id: 'douban_tv_global', label: '海外剧周榜' },
  { id: 'douban_show_chinese', label: '国内综艺' },
  { id: 'douban_show_global', label: '海外综艺' },
  { id: 'baidu_teleplay', label: '百度热播剧' },
];

/** 影视热榜（60s API）：豆瓣五个周榜 + 百度热播剧，chips 切换 */
function HotListView({ onPick }: { onPick: (title: string) => void }) {
  const [listId, setListId] = useState(HOT_LISTS[0].id);

  const query = useQuery({
    queryKey: ['hot-list', listId],
    queryFn: ({ signal }) => api.hotList(listId, signal),
  });

  const items = query.data?.items ?? [];

  return (
    <section aria-label="影视榜单推荐">
      <div className="flex flex-wrap gap-1.5 mb-4">
        {HOT_LISTS.map((l) => (
          <ChipButton key={l.id} active={listId === l.id} onClick={() => setListId(l.id)}>
            {l.label}
          </ChipButton>
        ))}
      </div>

      {query.isError ? (
        <p className="text-center text-sm text-faint py-8">推荐内容加载失败，可稍后重试或在设置中关闭</p>
      ) : query.isLoading ? (
        <GridSkeleton />
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
          {items.map((item) => (
            <DoubanCard key={item.id} item={item} onClick={() => onPick(item.title)} />
          ))}
        </div>
      )}
    </section>
  );
}

function GridSkeleton({ count = 16 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <div className="aspect-[2/3] rounded-lg bg-chip animate-pulse" />
          <div className="h-3 mt-2 rounded bg-chip animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function ChipButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      className={cn(
        'px-2.5 py-1 rounded-full text-xs transition-colors',
        active ? 'bg-accent text-on-accent' : 'bg-chip text-muted hover:text-content hover:bg-hover'
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
