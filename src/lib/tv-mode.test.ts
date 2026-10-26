// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { detectTvMode, hydrateTvMode, useTvMode } from './tv-mode';

beforeEach(() => { localStorage.clear(); history.replaceState({}, '', '/'); useTvMode.setState({ enabled: false }); });
afterEach(() => vi.restoreAllMocks());

describe('TV mode preferences', () => {
  it('detects TV user agents without treating an ordinary Android phone as a TV', () => {
    expect(detectTvMode('Mozilla Tizen 7.0 SmartTV')).toBe(true);
    expect(detectTvMode('Mozilla Android AFTMM')).toBe(true);
    expect(detectTvMode('Mozilla Android 14 Mobile Chrome')).toBe(false);
  });
  it('respects the device preference and allows an explicit TV link to override it', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('SmartTV');
    useTvMode.getState().setEnabled(false); hydrateTvMode();
    expect(useTvMode.getState().enabled).toBe(false);
    history.replaceState({}, '', '/?tv=1'); hydrateTvMode();
    expect(useTvMode.getState().enabled).toBe(true);
    expect(localStorage.getItem('libretv-tv-mode')).toBe('1');
  });
});
