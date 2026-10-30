/** The command palette's shortcut as this player's keyboard labels it: ⌘K on Apple devices, Ctrl+K everywhere else. */
export const paletteShortcut = (): string => {
  if (typeof navigator === 'undefined') return 'Ctrl+K';
  const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform
    || navigator.platform || navigator.userAgent;
  return /mac|iphone|ipad/i.test(platform) ? '⌘K' : 'Ctrl+K';
};
