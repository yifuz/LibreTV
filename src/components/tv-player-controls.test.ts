// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TvPlayerControls } from './tv-player-controls';
import { useTvMode } from '@/lib/tv-mode';

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div'); host.dataset.tvPlayer = ''; document.body.append(host); root = createRoot(host);
  useTvMode.setState({ enabled: true });
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

describe('Focusable TV playback controls', () => {
  it('activates play/pause and requests fullscreen on the whole player including controls', async () => {
    const toggle = vi.fn(); const fullscreen = vi.fn().mockResolvedValue(undefined);
    host.requestFullscreen = fullscreen;
    await act(async () => root.render(createElement(TvPlayerControls, { onToggle: toggle })));
    await act(async () => { host.querySelectorAll('button')[0].click(); host.querySelectorAll('button')[1].click(); });
    expect(toggle).toHaveBeenCalledTimes(1); expect(fullscreen).toHaveBeenCalledTimes(1); expect(host.classList.contains('tv-player-web-fullscreen')).toBe(false);
  });
  it('falls back to web fullscreen when the browser refuses native fullscreen', async () => {
    host.requestFullscreen = vi.fn().mockRejectedValue(new Error('unsupported'));
    await act(async () => root.render(createElement(TvPlayerControls, { onToggle() {} })));
    await act(async () => host.querySelectorAll('button')[1].click());
    expect(host.classList.contains('tv-player-web-fullscreen')).toBe(true);
  });
});
