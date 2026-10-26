// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHomeBrowsePosition } from './use-home-browse-position';
import { getHomeBrowsePosition, saveHomeBrowsePosition } from '@/lib/home-browse-state';

let root: Root;
let host: HTMLDivElement;
function Probe({ active }: { active: boolean }) {
  useHomeBrowsePosition(active);
  return createElement('button', { 'data-browse-focus': 'anime:42' }, 'Anime card');
}
beforeEach(() => {
  vi.useFakeTimers(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(() => fn(0), 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true });
  vi.spyOn(window, 'scrollTo').mockImplementation((options) => { window.scrollY = (options as ScrollToOptions).top ?? 0; });
  document.body.innerHTML = ''; saveHomeBrowsePosition();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('Recommendation scroll and focus restoration', () => {
  it('restores the original position and focused card after returning from search', async () => {
    await act(async () => { root.render(createElement(Probe, { active: true })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(40); });
    const card = host.querySelector('button')!; card.focus(); window.scrollY = 1234; saveHomeBrowsePosition();
    await act(async () => { root.render(createElement(Probe, { active: false })); });
    window.scrollY = 0; card.blur(); window.dispatchEvent(new Event('scroll'));
    expect(getHomeBrowsePosition()?.y).toBe(1234);
    await act(async () => { root.render(createElement(Probe, { active: true })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(40); });
    expect(window.scrollY).toBe(1234);
    expect(document.activeElement).toBe(card);
  });

  it('does not overwrite the page position while a dialog locks background scrolling', () => {
    window.scrollY = 900; saveHomeBrowsePosition();
    const modal = document.createElement('div'); modal.setAttribute('aria-modal', 'true'); document.body.append(modal);
    window.scrollY = 0; saveHomeBrowsePosition();
    expect(getHomeBrowsePosition()?.y).toBe(900);
  });
});
