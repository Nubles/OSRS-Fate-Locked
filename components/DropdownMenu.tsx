import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { nextMenuIndex, placeMenuBelow, type MenuPlacement } from '../utils/dropdownMenu';

const ITEM_SELECTOR = '[role="menuitem"], [role="menuitemcheckbox"]';

interface DropdownMenuProps {
  /** The button that opens the menu: it places the menu and gets focus back. */
  anchorRef: React.RefObject<HTMLElement | null>;
  /** Called to close the menu; focus has already gone back to the button when it should. */
  onClose: () => void;
  label: string;
  width: number;
  className?: string;
  children: React.ReactNode;
}

/**
 * A drop-down menu rendered on document.body, with a full-window layer behind
 * it that takes the click that closes it. Rendered inside the header, the
 * layer only covered the header (its backdrop blur makes it the box that
 * fixed children fill), so clicks elsewhere went through to the page.
 * Escape, Tab or a click outside closes it and puts focus back on the button;
 * the arrow keys, Home and End move between items.
 */
export const DropdownMenu: React.FC<DropdownMenuProps> = ({ anchorRef, onClose, label, width, className = '', children }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<MenuPlacement | null>(null);

  const closeToAnchor = useCallback(() => {
    anchorRef.current?.focus({ preventScroll: true });
    onClose();
  }, [anchorRef, onClose]);
  useEscapeKey(closeToAnchor);

  useLayoutEffect(() => {
    const measure = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      if (anchor) setPlace(placeMenuBelow(anchor, { width: window.innerWidth, height: window.innerHeight }, width));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [anchorRef, width]);

  // Focus the first item once placed, so the keyboard lands in the menu.
  const placed = place !== null;
  useLayoutEffect(() => {
    if (placed) menuRef.current?.querySelector<HTMLElement>(ITEM_SELECTOR)?.focus({ preventScroll: true });
  }, [placed]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Tab') {
      event.preventDefault();
      closeToAnchor();
      return;
    }
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []);
    const next = nextMenuIndex(items.indexOf(document.activeElement as HTMLElement), items.length, event.key);
    if (next === null) return;
    event.preventDefault();
    items[next].focus();
  };

  return createPortal(
    <>
      <div className="fixed inset-0 z-[90]" data-testid="menu-dismiss" aria-hidden="true" onClick={closeToAnchor} />
      <div
        ref={menuRef}
        role="menu"
        aria-label={label}
        onKeyDown={onKeyDown}
        className={`fixed z-[91] overflow-y-auto custom-scrollbar ${className}`}
        style={{ width, top: place?.top ?? 0, left: place?.left ?? 0, maxHeight: place?.maxHeight, visibility: placed ? undefined : 'hidden' }}
      >
        {children}
      </div>
    </>,
    document.body,
  );
};
