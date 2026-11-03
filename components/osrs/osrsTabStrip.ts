import { createContext, useContext } from 'react';

/**
 * The OSRS shell's fixed tab strip: one row under the backup notice, drawn at
 * the same height and left edge on every screen (home, Keys, Journal). The
 * Progression window's OsrsDashTabs portals its tab buttons into it, so only
 * the panels below the strip change between screens. null outside the shell.
 */
export const OsrsTabStripContext = createContext<HTMLElement | null>(null);

export const useOsrsTabStrip = (): HTMLElement | null => useContext(OsrsTabStripContext);
