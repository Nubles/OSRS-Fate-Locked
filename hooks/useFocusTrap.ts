import { RefObject, useEffect } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Prefers an explicit persistent trigger over the active element captured at mount. */
export const resolveFocusRestorationTarget = <Target>(
  explicitTarget: Target | null | undefined,
  previouslyFocused: Target | null,
): Target | null => explicitTarget ?? previouslyFocused;

/**
 * Traps keyboard focus inside the referenced element while `active` is true:
 *  - focuses the first focusable child on mount,
 *  - cycles Tab / Shift+Tab within the element instead of escaping behind it,
 *  - restores focus to an explicit persistent target, or the previously-focused element, on unmount.
 *
 * The referenced element should have `tabIndex={-1}` so it can receive focus
 * as a fallback when it contains no focusable children.
 */
export const useFocusTrap = (
  ref: RefObject<HTMLElement>,
  active = true,
  returnFocusTarget?: HTMLElement | null,
): void => {
  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    // Capture the target while the trap activates: a menu item can disappear
    // before this effect runs, but a persistent trigger remains focusable.
    const focusRestoreTarget = resolveFocusRestorationTarget(returnFocusTarget, previouslyFocused);

    const focusable = () =>
      Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        .filter(el => el.offsetParent !== null || el === document.activeElement);

    const initial = focusable();
    if (initial.length > 0) initial[0].focus();
    else node.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const activeEl = document.activeElement;

      if (e.shiftKey && (activeEl === first || activeEl === node)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && activeEl === last) {
        e.preventDefault();
        first.focus();
      }
    };

    node.addEventListener('keydown', onKeyDown);
    return () => {
      node.removeEventListener('keydown', onKeyDown);
      if (focusRestoreTarget && typeof focusRestoreTarget.focus === 'function') {
        focusRestoreTarget.focus();
      }
    };
  }, [ref, active]);
};
