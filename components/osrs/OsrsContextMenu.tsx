import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useIsOsrsUi } from '../../utils/uiStyle';
import './osrs-options.css';

/**
 * OSRS right-click menu with Examine. Mounted once at the app root; renders
 * nothing outside the OSRS layout, where the browser's own menu keeps working.
 *
 * Attribute contract (other components opt in by adding these attributes):
 *   data-examine="<text>"         Required. Makes the element right-clickable;
 *                                 the value is the examine text, written like
 *                                 an OSRS game message ("A bag of runes.").
 *   data-examine-name="<name>"    Optional. The target name shown after the
 *                                 action ("Examine Krystilia"). Without it the
 *                                 option reads just "Examine".
 *   data-examine-kind="npc|item|object|player"
 *                                 Optional. Colours the name the way OSRS does:
 *                                 npc yellow, item orange (the default),
 *                                 object cyan, player white.
 * The nearest ancestor with data-examine wins, so a whole row or card can
 * carry it. Right-clicking anything without it shows the browser's menu.
 * The menu also opens from the keyboard (the Menu key or Shift+F10 on a
 * focused element), and closes on Escape, a click elsewhere, scrolling,
 * resizing, or when the pointer leaves it.
 *
 * Choosing Examine:
 *   1. dispatches `window` CustomEvent 'fate:osrs-examine' with
 *      detail { name, text } (name is '' when not given), so a chatbox can
 *      print it as a game message, and
 *   2. shows the text as a game message in a small parchment toast near the
 *      bottom of the window, unless a listener called preventDefault() on
 *      the event (the event is cancelable) because it printed the line itself.
 */

export const OSRS_EXAMINE_EVENT = 'fate:osrs-examine';
export type OsrsExamineDetail = { name: string; text: string };

const KIND_COLOURS: Record<string, string> = {
  npc: '#ffff00',
  item: '#ff9040',
  object: '#00ffff',
  player: '#ffffff',
};
const TOAST_MS = 5000;
const MAX_TOAST_LINES = 3;

type MenuState = {
  x: number;
  y: number;
  name: string;
  text: string;
  colour: string;
  trigger: HTMLElement;
};
type ToastLine = { id: number; text: string };

export const OsrsContextMenu: React.FC = () => {
  const isOsrs = useIsOsrsUi();
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [toast, setToast] = useState<ToastLine[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const nextId = useRef(1);

  const openMenu = useRef<MenuState | null>(null);
  openMenu.current = menu;

  const close = useCallback((restoreFocus: boolean) => {
    const open = openMenu.current;
    if (open && restoreFocus && document.contains(open.trigger)) open.trigger.focus?.({ preventScroll: true });
    setMenu(null);
    setPos(null);
  }, []);

  // Open on right-click (or the keyboard menu key) over an examinable element.
  useEffect(() => {
    if (!isOsrs) return undefined;
    const onContextMenu = (event: MouseEvent) => {
      const start = event.target instanceof Element ? event.target : null;
      if (start && menuRef.current?.contains(start)) { event.preventDefault(); return; }
      const trigger = start?.closest<HTMLElement>('[data-examine]');
      const text = trigger?.dataset.examine?.trim();
      if (!trigger || !text) { setMenu(null); setPos(null); return; }
      event.preventDefault();
      let x = event.clientX;
      let y = event.clientY;
      if (x === 0 && y === 0) {
        // Keyboard-opened: anchor under the element's top-left corner.
        const rect = trigger.getBoundingClientRect();
        x = rect.left + Math.min(rect.width / 2, 60);
        y = rect.top + Math.min(rect.height / 2, 16);
      }
      const kind = (trigger.dataset.examineKind || '').toLowerCase();
      setPos(null);
      setMenu({
        x,
        y,
        name: (trigger.dataset.examineName || '').trim(),
        text,
        colour: KIND_COLOURS[kind] ?? KIND_COLOURS.item,
        trigger,
      });
    };
    document.addEventListener('contextmenu', onContextMenu);
    return () => document.removeEventListener('contextmenu', onContextMenu);
  }, [isOsrs]);

  // Leaving the OSRS layout closes everything.
  useEffect(() => {
    if (!isOsrs) { setMenu(null); setPos(null); setToast([]); }
  }, [isOsrs]);

  // Place the menu centred on the pointer, as OSRS does, kept on screen.
  useLayoutEffect(() => {
    if (!menu || !menuRef.current) return;
    const { width, height } = menuRef.current.getBoundingClientRect();
    const left = Math.round(Math.min(Math.max(menu.x - width / 2, 2), window.innerWidth - width - 2));
    const top = Math.round(Math.min(Math.max(menu.y - 4, 2), window.innerHeight - height - 2));
    setPos({ left, top });
  }, [menu]);

  useEffect(() => {
    if (menu && pos) itemRefs.current[0]?.focus({ preventScroll: true });
  }, [menu, pos]);

  // Close on a click elsewhere, Escape, scroll, resize or leaving the window.
  useEffect(() => {
    if (!menu) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) return;
      close(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close(true);
      }
    };
    const onScroll = (event: Event) => {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) return;
      close(false);
    };
    const onDismiss = () => close(false);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onDismiss);
    window.addEventListener('blur', onDismiss);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onDismiss);
      window.removeEventListener('blur', onDismiss);
    };
  }, [menu, close]);

  // Toast lines expire one by one.
  useEffect(() => {
    if (!toast.length) return undefined;
    const timer = window.setTimeout(() => setToast((lines) => lines.slice(1)), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const examine = () => {
    if (!menu) return;
    const detail: OsrsExamineDetail = { name: menu.name, text: menu.text };
    const handled = !window.dispatchEvent(new CustomEvent<OsrsExamineDetail>(OSRS_EXAMINE_EVENT, { detail, cancelable: true }));
    if (!handled) {
      const id = nextId.current++;
      setToast((lines) => [...lines, { id, text: menu.text }].slice(-MAX_TOAST_LINES));
    }
    close(true);
  };

  const onMenuKeyDown = (event: React.KeyboardEvent) => {
    const items = itemRefs.current.filter((el): el is HTMLButtonElement => !!el);
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    let next = -1;
    if (event.key === 'ArrowDown') next = (index + 1) % items.length;
    else if (event.key === 'ArrowUp') next = (index - 1 + items.length) % items.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else if (event.key === 'Tab') { event.preventDefault(); close(true); return; }
    if (next < 0) return;
    event.preventDefault();
    items[next]?.focus();
  };

  if (!isOsrs || typeof document === 'undefined') return null;

  return createPortal(
    <>
      {menu && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Choose Option"
          className="osrs-ctx"
          style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: -9999, visibility: 'hidden' }}
          onKeyDown={onMenuKeyDown}
          onMouseLeave={() => close(false)}
        >
          <div className="osrs-ctx-head" aria-hidden="true">Choose Option</div>
          <div className="osrs-ctx-list">
            <button
              ref={(el) => { itemRefs.current[0] = el; }}
              type="button"
              role="menuitem"
              className="osrs-ctx-opt"
              aria-label={menu.name ? `Examine ${menu.name}` : 'Examine'}
              onMouseEnter={(event) => event.currentTarget.focus({ preventScroll: true })}
              onClick={examine}
            >
              <span className="osrs-ctx-act">Examine</span>
              {menu.name && <span style={{ color: menu.colour }}>{' '}{menu.name}</span>}
            </button>
            <button
              ref={(el) => { itemRefs.current[1] = el; }}
              type="button"
              role="menuitem"
              className="osrs-ctx-opt"
              onMouseEnter={(event) => event.currentTarget.focus({ preventScroll: true })}
              onClick={() => close(true)}
            >
              <span className="osrs-ctx-act">Cancel</span>
            </button>
          </div>
        </div>
      )}
      <div className="osrs-examine-toast" role="status" aria-live="polite" hidden={!toast.length}>
        {toast.map((line) => <div key={line.id}>{line.text}</div>)}
      </div>
    </>,
    document.body,
  );
};
export default OsrsContextMenu;
