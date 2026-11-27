import { WIKI_OVERRIDES } from '../data/assets';
import { QUEST_DATA } from '../data/questData';

/**
 * Miniquests that share their name with a minigame or raid page. Kept apart
 * from WIKI_OVERRIDES, which other screens use for the activity itself.
 */
const MINIQUEST_WIKI_PAGES: Readonly<Record<string, string>> = {
  'Vale Totems': 'Vale_Totems_(miniquest)',
  'The Fractured Archive': 'The_Fractured_Archive_(miniquest)',
};

/**
 * The Wiki page for a Quest Journal entry (quest or miniquest). Every screen
 * that links a QUEST_DATA entry goes through here. Import it only from lazy
 * components.
 */
export const questWikiUrl = (name: string): string => {
  // Recipe for Disaster steps have no pages of their own.
  if (name.startsWith('RFD:')) return 'https://oldschool.runescape.wiki/w/Recipe_for_Disaster';
  if (MINIQUEST_WIKI_PAGES[name]) return `https://oldschool.runescape.wiki/w/${MINIQUEST_WIKI_PAGES[name]}`;
  if (WIKI_OVERRIDES[name]) return `https://oldschool.runescape.wiki/w/${WIKI_OVERRIDES[name]}`;
  return `https://oldschool.runescape.wiki/w/${encodeURIComponent(name.replace(/ /g, '_'))}`;
};

/** The Wiki page for a quest named by its QUEST_DATA id, as diary requirements name them. */
export const questIdWikiUrl = (id: string): string => questWikiUrl(QUEST_DATA[id]?.name ?? id);

/**
 * Placeholder monsters on Combat Achievement tasks fought anywhere ('N/A',
 * as on Sit Back and Relax); they have no Wiki page, so they open the
 * Combat Achievements page.
 */
const CA_NO_MONSTER_PAGE: ReadonlySet<string> = new Set(['N/A', 'General']);

/** The Wiki page for a Combat Achievement task's monster. */
export const caMonsterWikiUrl = (monster: string): string => (
  CA_NO_MONSTER_PAGE.has(monster)
    ? 'https://oldschool.runescape.wiki/w/Combat_Achievements'
    : `https://oldschool.runescape.wiki/w/${encodeURIComponent(monster.replace(/ /g, '_'))}`
);
