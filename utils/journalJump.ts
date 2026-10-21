/**
 * Where a Journal jump (a prerequisite chip, Next Best's "Open in the list",
 * the feed) lands the card it scrolls to.
 *
 * The classic Quest Journal's section header ("QUESTS (193)") sticks to the
 * top of the list. A card scrolled to the top with only a small margin ends up
 * under that header, which hides its name. The card lands a small gap below
 * the stuck header instead, measured from the header's real height.
 */
export const JUMP_GAP_PX = 8;

const px = (value: number | null | undefined): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;

/**
 * scroll-margin-top, in px, for a jump target in a list whose sticky header
 * is `stickyHeaderHeight` tall and sticks `stickyTop` px below the top of the
 * list's scroll area (the list's top padding plus the header's own `top`).
 * Rounded up, so a fractional header never overlaps the card.
 */
export const jumpScrollMargin = (stickyHeaderHeight?: number | null, stickyTop?: number | null): number => {
  const header = px(stickyHeaderHeight);
  return header > 0 ? Math.ceil(px(stickyTop) + header) + JUMP_GAP_PX : JUMP_GAP_PX;
};

/**
 * The sticky header of the Journal section holding `card`: the element marked
 * data-journal-sticky inside the nearest data-journal-section. Null when the
 * list has no sticky header (the OSRS layout, the Diary and CA journals).
 */
export const journalStickyHeaderFor = (card: Element): HTMLElement | null =>
  card.closest('[data-journal-section]')?.querySelector<HTMLElement>('[data-journal-sticky]') ?? null;

const scrollAreaOf = (el: Element): HTMLElement | null => {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll') return node;
  }
  return null;
};

/** Sets the card's scroll margin so a jump to it lands just below its section's sticky header. */
export const setJumpScrollMargin = (card: HTMLElement): void => {
  const header = journalStickyHeaderFor(card);
  let margin = JUMP_GAP_PX;
  if (header) {
    // A stuck header sits inside the list's top padding, at its own `top`.
    const area = scrollAreaOf(header);
    const stickyTop = (area ? parseFloat(getComputedStyle(area).paddingTop) : 0)
      + (parseFloat(getComputedStyle(header).top) || 0);
    margin = jumpScrollMargin(header.getBoundingClientRect().height, stickyTop);
  }
  card.style.scrollMarginTop = `${margin}px`;
};
