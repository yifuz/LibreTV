'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { hydrateTvMode, useTvMode } from '@/lib/tv-mode';
import { handleTvKey } from '@/lib/tv-navigation';

export function TvNavigation() {
  const enabled = useTvMode((state) => state.enabled);
  const router = useRouter();
  const pathname = usePathname();
  const previousPath = useRef(pathname);
  const internalNavigation = useRef(false);
  useEffect(() => { hydrateTvMode(); }, []);
  useEffect(() => {
    if (previousPath.current !== pathname) internalNavigation.current = true;
    previousPath.current = pathname;
  }, [pathname]);
  useEffect(() => {
    document.documentElement.classList.toggle('tv-mode', enabled);
    if (!enabled) return;
    const onBack = () => {
      const url = new URL(window.location.href);
      if (url.pathname === '/') {
        if (url.searchParams.has('s')) router.replace('/', { scroll: false });
      } else if (internalNavigation.current) router.back();
      else router.replace('/');
    };
    const handler = (event: KeyboardEvent) => { handleTvKey(event, onBack); };
    document.addEventListener('keydown', handler, true);
    return () => { document.removeEventListener('keydown', handler, true); document.documentElement.classList.remove('tv-mode'); };
  }, [enabled, router]);
  return null;
}
