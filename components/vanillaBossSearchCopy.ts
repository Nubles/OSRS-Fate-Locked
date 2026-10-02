export const VANILLA_BOSS_SEARCH_PLACEHOLDER = 'Search bosses...';

export const vanillaBossSearchEmptyMessage = (query: string): string =>
  `No bosses match "${query}".`;

/**
 * What a boss card should tell the player before they log a kill. Brutus is
 * fought once in The Ides of Milk and again only after it (wiki: Brutus). A
 * note, never a lock: logging by hand stays free.
 */
export const vanillaBossNote = (bossName: string, quests: readonly string[]): string | undefined =>
  bossName === 'Brutus' && !quests.includes('The Ides of Milk')
    ? 'Repeat kills need The Ides of Milk'
    : undefined;
