'use client';

import { useEffect, useRef, useState } from 'react';

/** 分区接近视口 200px 且停留 120ms 后启用；快速划过不会沿途请求所有榜单。 */
export function useSectionVisible(active: boolean) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!active || visible || !ref.current) return;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) { clearTimeout(timer); timer = undefined; return; }
      if (timer) return;
      timer = setTimeout(() => { setVisible(true); observer.disconnect(); }, 120);
    }, { rootMargin: '200px' });
    observer.observe(ref.current);
    return () => { clearTimeout(timer); observer.disconnect(); };
  }, [active, visible]);
  return { ref, visible };
}
