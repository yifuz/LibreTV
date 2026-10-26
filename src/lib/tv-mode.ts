'use client';

import { create } from 'zustand';

const STORAGE_KEY = 'libretv-tv-mode';
export const useTvMode = create<{ enabled: boolean; setEnabled: (enabled: boolean) => void }>((set) => ({
  enabled: false,
  setEnabled(enabled) {
    set({ enabled });
    try { localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0'); } catch { /* 仍可在本次会话使用。 */ }
  },
}));

export function detectTvMode(userAgent: string): boolean {
  return /SmartTV|SMART-TV|HbbTV|Tizen|Web0S|WebOS|GoogleTV|Android TV|\bAFT\w*\b|BRAVIA/i.test(userAgent);
}

export function hydrateTvMode(): void {
  const override = new URLSearchParams(window.location.search).get('tv');
  let saved: string | null = null;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* 存储可能被禁止。 */ }
  const enabled = override === '1' || (override !== '0' && (saved === '1' || (saved !== '0' && detectTvMode(navigator.userAgent))));
  if (override === '1' || override === '0') useTvMode.getState().setEnabled(enabled);
  else useTvMode.setState({ enabled });
}
