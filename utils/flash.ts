/**
 * The house "you landed here" affordance: a brief colored ring pulse on the
 * element a cross-panel jump arrives at. One implementation so every jump
 * (advisor rows, coach strip, toasts, palette) flashes identically instead
 * of each caller hand-rolling its own ring classes.
 */

const RINGS = {
  amber: ['ring-2', 'ring-amber-400/70'],
  cyan: ['ring-2', 'ring-cyan-400/70'],
} as const;

export type FlashColor = keyof typeof RINGS;

export const flashElement = (el: HTMLElement | null, color: FlashColor = 'amber', ms = 1800): void => {
  if (!el) return;
  const classes = RINGS[color];
  el.classList.add(...classes);
  window.setTimeout(() => el.classList.remove(...classes), ms);
};

/** Query + scroll into view + flash, in one call. No-op when nothing matches. */
export const flashSelector = (selector: string, color: FlashColor = 'amber', scroll = true): void => {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return;
  if (scroll) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  flashElement(el, color);
};
