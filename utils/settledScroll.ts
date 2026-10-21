/**
 * Scroll an element into view, then once more when the scroll has settled.
 *
 * Long lists whose cards use `content-visibility: auto` (the Journal's quest
 * list) hold a guessed height for every card the browser hasn't drawn yet. A
 * long smooth jump draws the cards it passes, they take their real height,
 * and the target drifts by up to a card or two. Once the scroll ends and the
 * cards around the target have been drawn (a couple of frames), an instant
 * call lands it exactly, and one more catches what that drew. Both do nothing
 * when the card is already in place.
 */
export const SETTLE_FALLBACK_MS = 1000;

const afterFrames = (win: Window, frames: number, run: () => void): void => {
  if (frames <= 0) { run(); return; }
  win.requestAnimationFrame(() => afterFrames(win, frames - 1, run));
};

export const scrollIntoViewSettled = (
  el: HTMLElement,
  options: ScrollIntoViewOptions,
  doc: Document = el.ownerDocument,
): void => {
  el.scrollIntoView(options);
  let settled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const settle = (event?: Event) => {
    // Only the end of a scroll that moves this element counts.
    if (event && event.target instanceof Node && event.target !== doc && !event.target.contains(el)) return;
    if (settled) return;
    settled = true;
    doc.removeEventListener('scrollend', settle, true);
    if (timer !== undefined) clearTimeout(timer);
    const realign = () => { if (el.isConnected) el.scrollIntoView({ ...options, behavior: 'instant' }); };
    const win = doc.defaultView;
    if (!win) { realign(); return; }
    afterFrames(win, 2, () => { realign(); afterFrames(win, 2, realign); });
  };
  // scrollend doesn't bubble, so listen in the capture phase. Browsers
  // without it, and jumps that didn't need to scroll, use the timer.
  doc.addEventListener('scrollend', settle, true);
  timer = setTimeout(() => settle(), SETTLE_FALLBACK_MS);
};
