/**
 * Placement and keyboard movement for a drop-down menu that opens under a
 * button. The menu is portalled to document.body (components/DropdownMenu.tsx),
 * so it is placed in viewport pixels from the button's rectangle.
 */

export interface AnchorRect {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface MenuPlacement {
  top: number;
  left: number;
  maxHeight: number;
}

/** Space kept between the menu and the window's edges. */
export const MENU_EDGE_MARGIN = 8;
/** Gap between the button and the menu. */
export const MENU_ANCHOR_GAP = 4;
/** The menu never gets shorter than this; a short window scrolls the page instead. */
export const MENU_MIN_HEIGHT = 160;

/**
 * Right-aligns the menu with the button's right edge, just below it, and
 * keeps it inside the window: pushed right when the button sits near the
 * left edge (a phone's wrapped tool row), left when near the right edge.
 * maxHeight lets a long menu scroll inside itself on a short window.
 */
export function placeMenuBelow(
  anchor: AnchorRect,
  viewport: { width: number; height: number },
  menuWidth: number,
): MenuPlacement {
  const top = Math.round(anchor.bottom + MENU_ANCHOR_GAP);
  const maxLeft = viewport.width - menuWidth - MENU_EDGE_MARGIN;
  const wanted = anchor.right - menuWidth;
  const left = Math.round(Math.max(MENU_EDGE_MARGIN, Math.min(wanted, maxLeft)));
  const maxHeight = Math.max(MENU_MIN_HEIGHT, Math.floor(viewport.height - top - MENU_EDGE_MARGIN));
  return { top, left, maxHeight };
}

/**
 * Which item a key moves focus to: arrows step and wrap, Home and End jump
 * to the ends. `current` is -1 when focus is not on an item yet. Returns
 * null for keys the menu does not handle.
 */
export function nextMenuIndex(current: number, count: number, key: string): number | null {
  if (count <= 0) return null;
  switch (key) {
    case 'ArrowDown': return current < 0 ? 0 : (current + 1) % count;
    case 'ArrowUp': return current < 0 ? count - 1 : (current - 1 + count) % count;
    case 'Home': return 0;
    case 'End': return count - 1;
    default: return null;
  }
}
