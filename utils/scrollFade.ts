import { useCallback, useEffect, useState } from 'react';

/**
 * Whether a scroll box has more content below its visible edge, so the OSRS
 * boards can fade their bottom edge (class "is-more") instead of showing a
 * row cut in half with no hint that it scrolls. Returns a callback ref for
 * the scroll box and the flag. Presentation only.
 */
export const useScrollMore = <T extends HTMLElement>(): [(el: T | null) => void, boolean] => {
  const [el, setEl] = useState<T | null>(null);
  const [more, setMore] = useState(false);
  const ref = useCallback((node: T | null) => setEl(node), []);

  useEffect(() => {
    if (!el) return;
    const update = () => setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 2);
    update();
    el.addEventListener('scroll', update, { passive: true });
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    resize?.observe(el);
    const mutate = typeof MutationObserver === 'undefined' ? null : new MutationObserver(update);
    mutate?.observe(el, { childList: true, subtree: true, characterData: true });
    return () => {
      el.removeEventListener('scroll', update);
      resize?.disconnect();
      mutate?.disconnect();
    };
  }, [el]);

  return [ref, more];
};
