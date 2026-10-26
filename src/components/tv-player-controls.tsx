'use client';

import type { MouseEvent } from 'react';
import { useTvMode } from '@/lib/tv-mode';

/** 电视上可用方向键聚焦的播放控件；不依赖播放器内部鼠标控制条。 */
export function TvPlayerControls({ onToggle }: { onToggle: () => void }) {
  const enabled = useTvMode((state) => state.enabled);
  if (!enabled) return null;
  const fullscreen = (event: MouseEvent<HTMLButtonElement>) => {
    const player = event.currentTarget.closest<HTMLElement>('[data-tv-player]');
    const webFullscreen = () => player?.classList.add('tv-player-web-fullscreen');
    if (document.fullscreenElement && document.exitFullscreen) {
      void document.exitFullscreen().catch(() => {});
    } else if (player?.classList.contains('tv-player-web-fullscreen')) {
      player.classList.remove('tv-player-web-fullscreen');
    } else if (player?.requestFullscreen) {
      void player.requestFullscreen().catch(webFullscreen);
    } else webFullscreen();
  };
  return (
    <div className="absolute bottom-3 left-3 z-30 flex gap-2 rounded-lg bg-black/80 p-2 text-white">
      <button type="button" className="px-3 rounded hover:bg-white/20" onClick={onToggle}>播放／暂停</button>
      <button type="button" className="px-3 rounded hover:bg-white/20" onClick={fullscreen}>全屏</button>
    </div>
  );
}
