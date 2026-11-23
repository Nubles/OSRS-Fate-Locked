// Strategy Guide facts from the deep audit pass of 23 November 2026, each checked
// against the OSRS Wiki that day. Each block names the pages it follows.
import { describe, expect, it } from 'vitest';
import { STRATEGY_DATABASE as S } from './requirements';
import { QUEST_DATA } from './questData';
import { analyzeRequirement } from '../utils/strategyRequirement';
import { createFreshState } from '../context/GameContext';
import { REGIONS_LIST, SKILLS_LIST, MINIGAMES_LIST, GUILDS_LIST, BOSSES_LIST, MERCHANTS_LIST } from './items';

/** Every area, quest and Key held, every skill at 99 unless a level is given. */
const everything = ({ levels = {} as Record<string, number>, quests = Object.keys(QUEST_DATA) } = {}) => {
  const u = createFreshState().unlocks;
  u.regions = [...REGIONS_LIST];
  u.skills = Object.fromEntries(SKILLS_LIST.map(s => [s, 10]));
  u.levels = { ...Object.fromEntries(SKILLS_LIST.map(s => [s, 99])), ...levels };
  u.quests = quests;
  u.minigames = [...MINIGAMES_LIST];
  u.guilds = [...GUILDS_LIST];
  u.bosses = [...BOSSES_LIST];
  u.merchants = [...MERCHANTS_LIST];
  return u;
};
const ready = (key: string, u = everything()) => analyzeRequirement(S[key], u, 'vanilla').isFullyPlayable;

describe('Slayer Helmet (Wiki: Black mask, Slayer helmet, Cave horror)', () => {
  // The black mask drops only from cave horrors on Mos Le'Harmless: 58 Slayer and Cabin Fever.
  // The helmet takes 55 Crafting and 10 Defence to wear.
  it('asks for the black mask route and the Defence to wear it', () => {
    expect(S['Slayer Helmet']).toMatchObject({
      regions: ['Islands & Others'],
      skills: { Crafting: 55, Slayer: 58, Defence: 10 },
      quests: ['Cabin Fever'],
    });
    expect(ready('Slayer Helmet')).toBe(true);
    expect(ready('Slayer Helmet', everything({ levels: { Slayer: 57 } }))).toBe(false);
    expect(ready('Slayer Helmet', everything({ quests: Object.keys(QUEST_DATA).filter(q => q !== 'Cabin Fever') }))).toBe(false);
  });
});

describe('Karuulm Slayer Dungeon heat (Wiki: Karuulm Slayer Dungeon, Wyrm, Drake, Hydra)', () => {
  // Past the entrance chamber the player must wear boots of stone, boots of brimstone or granite
  // boots, unless they have the Kourend & Kebos Elite reward. Drakes and hydras live only there;
  // wyrms also live in the Wyrmscraig Cavern (partial Fallen From Grace), which needs no boots.
  const KARUULM = /\b(wyrms?|drakes?|drake's|hydras?)\b/i;
  const entries = Object.entries(S).filter(([key, req]) =>
    (KARUULM.test(key) || KARUULM.test(req.id) || key === 'Boots of Brimstone') && !key.startsWith('Karuulm Dungeon'));
  it('covers every entry whose content is past the entrance chamber', () => {
    expect(entries.map(([key]) => key)).toEqual(expect.arrayContaining([
      'Wyrms', 'Drakes', 'Hydras', "Drake's Tooth/Claw", 'Hydra Leather',
      'Boots of Brimstone', 'Dragon Harpoon (Wyrms)', 'Ferocious Gloves',
    ]));
  });
  it.each(entries)('%s asks for the heat-proof boots or the Kourend & Kebos Elite reward', (key, req) => {
    const line = (req.manualRequirements ?? []).find(m => /boots of stone, boots of brimstone or granite boots/.test(m));
    expect(line, key).toMatch(/Kourend & Kebos Elite/);
    expect(ready(key)).toBe(false);
  });
  it('offers the Wyrmscraig Cavern for the wyrms', () => {
    for (const key of ['Wyrms', 'Dragon Harpoon (Wyrms)']) {
      expect(S[key].manualRequirements?.join(' '), key).toMatch(/Wyrmscraig Cavern.*Fallen From Grace/);
    }
  });
  it('describes the 88 Agility pipe as the way to the Alchemical Hydra, past the hydras', () => {
    // Wiki 'Mysterious pipe': it skips the chamber with hydras and leads to the Alchemical Hydra.
    expect(S['Karuulm Dungeon (Upper)'].description).toMatch(/Alchemical Hydra/);
    expect(S['Karuulm Dungeon (Upper)'].description).not.toMatch(/to Hydras/);
  });
});

describe('Spiritual rangers and warriors (Wiki: God Wars Dungeon, Spiritual ranger, Spiritual warrior)', () => {
  // Entering the God Wars Dungeon needs partial Troll Stronghold or the full Easy Combat
  // Achievements tier; both monsters also live in the Wilderness God Wars Dungeon, which needs neither.
  it.each(['Spiritual Rangers', 'Spiritual Warriors'])('%s asks for the God Wars Dungeon entry', key => {
    expect(S[key].manualRequirements?.join(' ')).toMatch(/Troll Stronghold.*Easy Combat Achievement.*Wilderness God Wars Dungeon/);
    expect(S[key].quests).toBeUndefined();
    expect(ready(key)).toBe(false);
  });
});

describe('Red dragons in the Brimhaven Dungeon (Wiki: Brimhaven Dungeon, Vines, Stepping stones)', () => {
  // The vine toward the red dragons takes 22 Woodcutting; the 56 Agility stepping stones sit past
  // the 10 Woodcutting entrance vine.
  it('takes 22 Woodcutting, or 10 Woodcutting and 56 Agility', () => {
    expect(S['Red Dragons (Brimhaven)'].accessRoutes).toEqual([
      { label: '22 Woodcutting', skills: { Woodcutting: 22 } },
      { label: '56 Agility and 10 Woodcutting', skills: { Agility: 56, Woodcutting: 10 } },
    ]);
    expect(ready('Red Dragons (Brimhaven)', everything({ levels: { Woodcutting: 9, Agility: 99 } }))).toBe(false);
    expect(ready('Red Dragons (Brimhaven)', everything({ levels: { Woodcutting: 10, Agility: 56 } }))).toBe(true);
    expect(ready('Red Dragons (Brimhaven)', everything({ levels: { Woodcutting: 22, Agility: 1 } }))).toBe(true);
    expect(ready('Red Dragons (Brimhaven)', everything({ levels: { Woodcutting: 21, Agility: 55 } }))).toBe(false);
  });
  it('asks the Red Dragon Isle shortcut for the entrance vine too', () => {
    expect(S['Red Dragon Isle'].skills).toEqual({ Agility: 56, Woodcutting: 10 });
  });
});

describe('Guild cards named after a resource (Wiki: Amethyst crystals, Raw shark)', () => {
  it('asks the resource level, not only the door level', () => {
    expect(S['Mining Guild (Amethyst)'].skills).toEqual({ Mining: 92 });
    expect(S['Fishing Guild (Shark Fishing)'].skills).toEqual({ Fishing: 76 });
    expect(ready('Mining Guild (Amethyst)', everything({ levels: { Mining: 91 } }))).toBe(false);
    expect(ready('Fishing Guild (Shark Fishing)', everything({ levels: { Fishing: 75 } }))).toBe(false);
    expect(ready('Fishing Guild (Shark Fishing)')).toBe(true);
  });
});

describe('Smoke devils (Wiki: Smoke devil, Smoke Devil Dungeon)', () => {
  // "These require a minimum of 93 Slayer and an active Slayer task to be harmed. A slayer helmet,
  // slayer helmet (i), or a facemask is required to kill these." The gas mask also works.
  it('asks for the task and the face protection', () => {
    expect(S['Smoke Devils'].manualRequirements).toEqual(['Smoke devil Slayer task.', 'Wear a facemask, gas mask or Slayer helmet.']);
    expect(S['Occult Necklace'].manualRequirements).toEqual([
      'Smoke devil Slayer task or Thermonuclear smoke devil boss task.', 'Wear a facemask, gas mask or Slayer helmet.',
    ]);
    expect(ready('Smoke Devils')).toBe(false);
    expect(ready('Occult Necklace')).toBe(false);
  });
});
