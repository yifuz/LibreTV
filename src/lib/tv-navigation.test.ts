// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleTvKey, remoteKey, spatialTarget, TV_BACK_EVENT } from './tv-navigation';

const rect = (x: number, y: number, width = 80, height = 100) => new DOMRect(x, y, width, height);
function button(id: string, x: number, y: number, parent: HTMLElement = document.body) {
  const element = document.createElement('button');
  element.id = id;
  element.getBoundingClientRect = () => rect(x, y);
  parent.append(element);
  return element;
}
function key(value: string, onBack = vi.fn()) {
  const event = new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true });
  return { handled: handleTvKey(event, onBack), event, onBack };
}
beforeEach(() => { document.body.innerHTML = ''; });

describe('TV spatial focus and activation', () => {
  it('moves across a card grid and avoids diagonal jumps', () => {
    const a = button('a', 0, 0);
    const b = button('b', 100, 0);
    const c = button('c', 0, 130);
    button('diagonal', 90, 70);
    a.focus();
    expect(key('ArrowRight').handled).toBe(true);
    expect(document.activeElement).toBe(b);
    a.focus(); key('ArrowDown');
    expect(document.activeElement).toBe(c);
    expect(spatialTarget(rect(0, 0), [{ target: 'left', rect: rect(-100, 0) }], 'ArrowRight')).toBeUndefined();
  });

  it('ignores hidden/disabled/background targets and stays inside the top dialog', () => {
    const background = button('background', 0, 0);
    const hidden = button('hidden', 100, 0); hidden.hidden = true;
    button('disabled', 120, 0).disabled = true;
    const dialog = document.createElement('div');
    dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('role', 'dialog'); document.body.append(dialog);
    const first = button('first', 0, 100, dialog);
    const second = button('second', 100, 100, dialog);
    background.focus(); key('ArrowRight');
    expect(document.activeElement).toBe(first);
    key('ArrowRight'); expect(document.activeElement).toBe(second);
    key('ArrowDown'); expect(document.activeElement).toBe(second);
  });

  it('activates the focused item exactly once and leaves editable keys alone', () => {
    const item = button('item', 0, 0);
    const clicked = vi.fn(); item.onclick = clicked; item.focus();
    expect(key('Enter').event.defaultPrevented).toBe(true);
    expect(clicked).toHaveBeenCalledTimes(1);
    const input = document.createElement('input'); document.body.append(input); input.focus();
    expect(key('ArrowLeft').handled).toBe(false);
    expect(key('Backspace').handled).toBe(false);
    expect(key('Enter').handled).toBe(false);
  });

  it('lets an open dropdown handle its own selection and closes only that dropdown on Back', () => {
    const popup = button('popup', 0, 0);
    popup.setAttribute('aria-haspopup', 'listbox'); popup.setAttribute('aria-expanded', 'true');
    popup.focus(); const clicked = vi.fn(); popup.onclick = clicked;
    expect(key('ArrowDown').handled).toBe(false);
    expect(key('Enter').handled).toBe(false);
    const result = key('Escape');
    expect(clicked).toHaveBeenCalledTimes(1);
    expect(result.onBack).not.toHaveBeenCalled();
  });

  it('leaves video seek/activate keys to the player while allowing focus to move below it', () => {
    const player = document.createElement('div'); player.tabIndex = 0; player.dataset.tvPlayer = '';
    player.getBoundingClientRect = () => rect(0, 0); document.body.append(player);
    const next = button('episodes', 0, 150); player.focus();
    expect(key('ArrowRight').handled).toBe(false);
    expect(key('Enter').handled).toBe(false);
    key('ArrowDown'); expect(document.activeElement).toBe(next);
  });
});

describe('TV Back handling', () => {
  it('recognizes standard and legacy remote return keys', () => {
    expect(remoteKey({ key: 'Unidentified', keyCode: 10009 })).toBe('Back');
    expect(remoteKey({ key: '', keyCode: 461 })).toBe('Back');
    expect(remoteKey({ key: 'BrowserBack', keyCode: 0 })).toBe('Back');
    expect(remoteKey({ key: 'Unidentified', keyCode: 40 })).toBe('ArrowDown');
  });

  it('cancels only the upper confirmation dialog instead of navigating away', () => {
    document.body.innerHTML = '<div role="dialog" aria-modal="true"><button aria-label="关闭">drawer</button></div><div role="alertdialog" aria-modal="true"><button data-tv-close>cancel</button><button>delete</button></div>';
    const cancel = vi.fn(); const drawer = vi.fn();
    (document.querySelector('[data-tv-close]') as HTMLElement).onclick = cancel;
    (document.querySelector('[aria-label="关闭"]') as HTMLElement).onclick = drawer;
    const result = key('Escape');
    expect(cancel).toHaveBeenCalledTimes(1); expect(drawer).not.toHaveBeenCalled(); expect(result.onBack).not.toHaveBeenCalled();
  });

  it('exits native fullscreen or player web fullscreen before navigating', () => {
    const exit = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document, 'fullscreenElement', { value: document.body, configurable: true });
    Object.defineProperty(document, 'exitFullscreen', { value: exit, configurable: true });
    const first = key('BrowserBack');
    expect(exit).toHaveBeenCalledTimes(1); expect(first.onBack).not.toHaveBeenCalled();
    Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
    const listener = (event: Event) => event.preventDefault();
    document.addEventListener(TV_BACK_EVENT, listener);
    expect(key('BrowserBack').onBack).not.toHaveBeenCalled();
    document.removeEventListener(TV_BACK_EVENT, listener);
    expect(key('BrowserBack').onBack).toHaveBeenCalledTimes(1);
  });
});
