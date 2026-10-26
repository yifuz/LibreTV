export type Direction = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown';
export const TV_BACK_EVENT = 'libretv:tv-back';
const FOCUSABLE = 'a[href],button,input:not([type="hidden"]),select,textarea,[tabindex]';

export function remoteKey(event: Pick<KeyboardEvent, 'key' | 'keyCode'>): string {
  if (['Escape', 'Backspace', 'BrowserBack', 'GoBack'].includes(event.key) || [10009, 461].includes(event.keyCode)) return 'Back';
  if (event.key && event.key !== 'Unidentified') return event.key;
  return ({ 13: 'Enter', 27: 'Back', 8: 'Back', 37: 'ArrowLeft', 38: 'ArrowUp', 39: 'ArrowRight', 40: 'ArrowDown' } as Record<number, string>)[event.keyCode] || '';
}

/** 优先选择同一行／列的目标，避免方向键斜跳到另一排卡片。 */
export function spatialTarget<T>(current: DOMRect, candidates: { target: T; rect: DOMRect }[], direction: Direction): T | undefined {
  const horizontal = direction === 'ArrowLeft' || direction === 'ArrowRight';
  const sign = direction === 'ArrowLeft' || direction === 'ArrowUp' ? -1 : 1;
  const x = current.left + current.width / 2;
  const y = current.top + current.height / 2;
  let best: T | undefined;
  let bestScore = Infinity;
  for (const { target, rect } of candidates) {
    const dx = rect.left + rect.width / 2 - x;
    const dy = rect.top + rect.height / 2 - y;
    const forward = sign * (horizontal ? dx : dy);
    if (forward <= 1) continue;
    const side = Math.abs(horizontal ? dy : dx);
    const overlaps = horizontal
      ? Math.min(current.bottom, rect.bottom) > Math.max(current.top, rect.top)
      : Math.min(current.right, rect.right) > Math.max(current.left, rect.left);
    const score = (overlaps ? 0 : 10000) + forward + side * 2;
    if (score < bestScore) { best = target; bestScore = score; }
  }
  return best;
}

function visible(element: HTMLElement): boolean {
  if (element.tabIndex < 0 || element.matches(':disabled') || element.closest('[hidden],[inert],[aria-hidden="true"]')) return false;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
  }
  return true;
}

function modalScope(): HTMLElement | undefined {
  const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"]')).filter((node) => !node.closest('[hidden]') && (!document.fullscreenElement || document.fullscreenElement.contains(node)));
  return [...dialogs].reverse().find((node) => node.getAttribute('role') === 'alertdialog') ?? dialogs[dialogs.length - 1];
}

function focus(element: HTMLElement): void {
  element.focus({ preventScroll: true });
  element.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
}

/** 返回 true 表示已消费事件；开放的下拉框和文本输入仍使用各自原生操作。 */
export function handleTvKey(event: KeyboardEvent, onBack: () => void): boolean {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return false;
  const key = remoteKey(event);
  const target = document.activeElement as HTMLElement | null;
  const editing = target?.matches('input,textarea,[contenteditable="true"]') || target?.isContentEditable;
  const popup = target?.closest<HTMLElement>('[aria-haspopup="listbox"][aria-expanded="true"]');
  const consume = () => { event.preventDefault(); event.stopPropagation(); return true; };

  if (key === 'Back') {
    if (event.key === 'Backspace' && editing) return false;
    if (event.repeat) return consume();
    if (popup) { popup.click(); return consume(); }
    if (editing) { target?.blur(); return consume(); }
    const dialog = modalScope();
    if (dialog) {
      dialog.querySelector<HTMLElement>('[data-tv-close],button[aria-label="关闭"]')?.click();
      return consume();
    }
    if (document.fullscreenElement && document.exitFullscreen) {
      void document.exitFullscreen().catch(() => {});
      return consume();
    }
    const webFullscreen = document.querySelector('.tv-player-web-fullscreen');
    if (webFullscreen) { webFullscreen.classList.remove('tv-player-web-fullscreen'); return consume(); }
    const playerBack = new Event(TV_BACK_EVENT, { cancelable: true });
    if (!document.dispatchEvent(playerBack)) return consume();
    onBack();
    return consume();
  }

  if (popup || target?.closest('[role="listbox"],[role="tablist"],[data-channel-list]')) return false;
  if (key === 'Enter') {
    if (editing || target?.tagName === 'SELECT' || target?.matches('[data-tv-player]')) return false;
    if (target?.matches(FOCUSABLE) && visible(target)) { target.click(); return consume(); }
    return false;
  }
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) return false;
  if (editing && (key !== 'ArrowDown' || target?.getAttribute('aria-expanded') === 'true')) return false;
  if (target?.tagName === 'SELECT' && (key === 'ArrowUp' || key === 'ArrowDown')) return false;
  if (target?.matches('[data-tv-player]') && (key === 'ArrowLeft' || key === 'ArrowRight')) return false;
  const scope = modalScope() ?? document.fullscreenElement ?? document.querySelector<HTMLElement>('.tv-player-web-fullscreen') ?? document;
  const elements = [
    ...(scope instanceof HTMLElement && scope.matches(FOCUSABLE) ? [scope] : []),
    ...scope.querySelectorAll<HTMLElement>(FOCUSABLE),
  ].filter(visible);
  if (!elements.length) return false;
  const next = target && elements.includes(target)
    ? spatialTarget(target.getBoundingClientRect(), elements.filter((element) => element !== target).map((element) => ({ target: element, rect: element.getBoundingClientRect() })), key as Direction)
    : elements[0];
  if (next) focus(next);
  return consume();
}
