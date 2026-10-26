'use client';

import { useEffect } from 'react';
import { getHomeBrowsePosition, saveHomeBrowsePosition } from '@/lib/home-browse-state';

/** 站内返回先复用查询缓存，再恢复滚动与卡片焦点；搜索期间不覆盖推荐页位置。 */
export function useHomeBrowsePosition(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const saved = getHomeBrowsePosition();
    let restoring = Boolean(saved);
    let firstFrame = 0;
    let secondFrame = 0;
    if (saved) {
      firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(() => {
          if (saved.focusId) {
            const element = Array.from(document.querySelectorAll<HTMLElement>('[data-browse-focus]')).find((node) => node.dataset.browseFocus === saved.focusId);
            element?.focus({ preventScroll: true });
          }
          window.scrollTo({ top: saved.y, behavior: 'instant' });
          restoring = false;
        });
      });
    }
    const remember = () => { if (!restoring) saveHomeBrowsePosition(); };
    const onLink = (event: MouseEvent) => {
      const link = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>('a[href]');
      if (link && !link.getAttribute('href')?.startsWith('#')) remember();
    };
    window.addEventListener('scroll', remember, { passive: true });
    window.addEventListener('pagehide', remember);
    document.addEventListener('click', onLink, true);
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      window.removeEventListener('scroll', remember);
      window.removeEventListener('pagehide', remember);
      document.removeEventListener('click', onLink, true);
    };
  }, [active]);
}
