import { describe, expect, it } from 'vitest';
import { TableType } from '../types';
import { initialState } from '../context/GameContext';
// @ts-expect-error Node types are intentionally excluded from the browser app.
import { readFileSync } from 'node:fs';
import { AGILITY_COURSES, buildChunkSkillNodes, chunkSkillNodesSource, factCell, GUILD_CHUNKS, oreShopSmithingLevel, RUNE_ALTAR_RUINS } from './chunkSkillNodesBuild';
import { CHUNK_SKILL_SERVICES, CHUNK_SKILL_TIERS } from '../data/chunkSkillNodes';
import chunkDoc from '../public/chunk-content.json';
import { chunkedSkillNeeds, chunkedSkillRollable, chunkedTrainingTiers, chunkFactLevel } from './chunkedSkillPool';
import { chunkedSkillHasRoom, mercyBlocker, skillsWithRoom } from './chunkedFate';
import { randomUnlockPool } from './gameEngine';
import { chunkKey, getChunkFrontier } from './chunkAdjacency';
import { FARMING_PATCH_LIST, MERCHANTS_LIST } from '../data/items';

const fresh = () => ({ ...initialState.unlocks, chunks: [] as string[] });
type Unlocks = ReturnType<typeof fresh>;
const withTiers = (tiers: Record<string, number>, over: Partial<Unlocks> = {}): Unlocks =>
  ({ ...fresh(), ...over, skills: { ...fresh().skills, ...tiers } });
/** A run whose level in each skill sits at the cap of its tier (tier 2 → level 20), so levels never hold content back. */
const atCap = (tiers: Record<string, number>, over: Partial<Unlocks> = {}): Unlocks => {
  const run = withTiers(tiers, over);
  const levels = { ...run.levels };
  for (const [skill, tier] of Object.entries(run.skills)) if (tier > 0) levels[skill] = Math.max(levels[skill] ?? 1, tier >= 10 ? 99 : tier * 10);
  return { ...run, levels: { ...levels, ...over.levels } };
};
const built = buildChunkSkillNodes(chunkDoc as unknown as Parameters<typeof buildChunkSkillNodes>[0]);
const levelsIn = (chunk: string) => built.nodes[chunk] ?? {};
/** Every land chunk a run can ever own without sailing: the frontier closure from the start chunk. */
const landClosure = (): string[] => {
  let owned: string[] = [];
  for (;;) {
    const next = getChunkFrontier(owned).map(chunkKey);
    if (next.length === 0) return owned;
    owned = [...owned, ...next];
  }
};
const skillPool = (unlocks: ReturnType<typeof fresh>, mode: string) =>
  randomUnlockPool(unlocks, mode, 'key', TableType.SKILLS).map(({ item }) => item);

describe('Chunked Skills rolls', () => {
  it('reads data/chunkSkillNodes.ts as generated from public/chunk-content.json', () => {
    expect(readFileSync('data/chunkSkillNodes.ts', 'utf8'))
      .toBe(chunkSkillNodesSource(buildChunkSkillNodes(chunkDoc as unknown as Parameters<typeof buildChunkSkillNodes>[0])));
  });

  it('only rolls skills the Lumbridge Castle start chunk can train', () => {
    const pool = skillPool(fresh(), 'chunked');
    expect(pool).toEqual(['Attack', 'Strength', 'Defence', 'Thieving', 'Crafting', 'Magic', 'Woodcutting']);
    // The castle's furnace has no ore, its butterflies are scenery, and its
    // trees give no logs until Woodcutting is open. A fresh run can't fight
    // (no combat style), so its goblins give no bones, meat or Hitpoints XP,
    // and with every equipment slot at tier 0 it can't hold a bow.
    for (const skill of ['Sailing', 'Construction', 'Agility', 'Herblore', 'Slayer', 'Runecraft', 'Mining', 'Smithing', 'Hunter', 'Firemaking', 'Fletching', 'Prayer', 'Cooking', 'Ranged', 'Hitpoints']) {
      expect(pool).not.toContain(skill);
    }
    expect(skillPool(withTiers({ Attack: 1 }), 'chunked')).toEqual(expect.arrayContaining(['Prayer', 'Cooking', 'Hitpoints']));
  });

  it('needs a node the next tier can reach: the castle\'s level-20 fishing spot is out of reach at tier 0', () => {
    expect(chunkedTrainingTiers([]).get('Fishing')).toBe(2);
    expect(chunkedSkillRollable('Fishing', fresh())).toBe(false);
    // Tier 1 doesn't reach it; at the tier-1 cap (level 10), tier 2 still needs level 20 first.
    expect(chunkedSkillRollable('Fishing', atCap({ Fishing: 1 }))).toBe(false);
    expect(chunkedSkillRollable('Fishing', atCap({ Fishing: 1 }, { levels: { ...fresh().levels, Fishing: 20 } }))).toBe(true);
    // Lumbridge Swamp's small-net spot opens Fishing from level 1.
    expect(chunkedSkillRollable('Fishing', { ...fresh(), chunks: ['50,49'] })).toBe(true);
    expect(chunkedSkillRollable('Mining', { ...fresh(), chunks: ['50,49'] })).toBe(true);
  });

  it('opens a skill trained at a station only once the run has its input (content review 9, play review 2)', () => {
    // Logs: Woodcutting must reach the castle's trees.
    expect(chunkedSkillRollable('Firemaking', withTiers({ Woodcutting: 1 }))).toBe(true);
    expect(chunkedSkillRollable('Fletching', withTiers({ Woodcutting: 1 }))).toBe(true);
    // Ore: the castle's furnace needs a rock the run can mine (or an ore shop).
    expect(chunkedSkillRollable('Smithing', fresh())).toBe(false);
    expect(chunkedSkillRollable('Smithing', withTiers({}, { chunks: ['50,49'] }))).toBe(false);
    expect(chunkedSkillRollable('Smithing', withTiers({ Mining: 1 }, { chunks: ['50,49'] }))).toBe(true);
    // Food and bones: Lumbridge's cows, goblins and chickens, once the run can fight them.
    expect(chunkedSkillRollable('Cooking', fresh())).toBe(false);
    expect(chunkedSkillRollable('Prayer', fresh())).toBe(false);
    expect(chunkedSkillRollable('Cooking', withTiers({ Strength: 1 }))).toBe(true);
    expect(chunkedSkillRollable('Prayer', withTiers({ Strength: 1 }))).toBe(true);
    // Hitpoints only gains XP alongside a combat style (play review, strict runs).
    expect(chunkedSkillRollable('Hitpoints', fresh())).toBe(false);
    expect(chunkedSkillRollable('Hitpoints', withTiers({ Magic: 1 }))).toBe(true);
  });

  it('rolls Agility from a chunk holding a course start, at the course level (content review 1)', () => {
    expect(chunkedSkillRollable('Agility', fresh())).toBe(false);
    // Gnome Stronghold course (level 1) is tier 1.
    expect(chunkedSkillRollable('Agility', withTiers({}, { chunks: ['38,53'] }))).toBe(true);
    // Draynor rooftop is tier 1 too, but needs level 10: a level-1 player can't use it (deadlock audit, dead end 2).
    expect(chunkedSkillRollable('Agility', withTiers({}, { chunks: ['48,51'] }))).toBe(false);
    expect(chunkedSkillRollable('Agility', withTiers({}, { chunks: ['48,51'], levels: { ...fresh().levels, Agility: 10 } }))).toBe(true);
    // Varrock rooftop (30) opens at tier 3, once the player's level reaches 30.
    expect(chunkedSkillRollable('Agility', withTiers({}, { chunks: ['50,53'] }))).toBe(false);
    expect(chunkedSkillRollable('Agility', atCap({ Agility: 2 }, { chunks: ['50,53'] }))).toBe(false);
    expect(chunkedSkillRollable('Agility', atCap({ Agility: 2 }, { chunks: ['50,53'], levels: { ...fresh().levels, Agility: 30 } }))).toBe(true);
    // Canifis (40) also needs Priest in Peril, which its entry needs (content review 12).
    const canifis = { ...fresh().levels, Agility: 40 };
    expect(chunkedSkillRollable('Agility', withTiers({ Agility: 3 }, { chunks: ['54,54'], levels: canifis }))).toBe(false);
    expect(chunkedSkillRollable('Agility', withTiers({ Agility: 3 }, { chunks: ['54,54'], quests: ['Priest in Peril'], levels: canifis }))).toBe(true);
    for (const { course, chunk, level } of AGILITY_COURSES) expect(levelsIn(chunk).Agility, course).toBe(level);
  });

  it('rolls Sailing from a port once Pandemonium is done (content review 2)', () => {
    expect(levelsIn('47,50').Sailing).toBe(1);
    expect(chunkedSkillRollable('Sailing', withTiers({}, { chunks: ['47,50'] }))).toBe(false);
    expect(chunkedSkillRollable('Sailing', withTiers({}, { chunks: ['47,50'], quests: ['Pandemonium'] }))).toBe(true);
    expect(chunkedSkillRollable('Sailing', withTiers({}, { quests: ['Pandemonium'] }))).toBe(false);
  });

  it('can roll every skill once a run owns all the land it can walk to and has done Pandemonium and Druidic Ritual', () => {
    const chunks = landClosure();
    expect(chunks.length).toBeGreaterThan(300);
    const quests = ['Pandemonium', 'Druidic Ritual', 'Priest in Peril', 'Rune Mysteries'];
    const opened = atCap({ Woodcutting: 1, Mining: 1, Fishing: 1, Farming: 1 }, {
      chunks, quests, farming: [...FARMING_PATCH_LIST], merchants: [...MERCHANTS_LIST], equipment: { ...fresh().equipment, Weapon: 1 },
    });
    const pool = skillPool(opened, 'chunked');
    expect(pool).toEqual(expect.arrayContaining(['Agility', 'Sailing', 'Herblore', 'Farming', 'Construction', 'Hunter', 'Runecraft', 'Smithing']));
    // Sailing still waits on Pandemonium.
    expect(skillPool({ ...opened, quests: ['Druidic Ritual'] }, 'chunked')).not.toContain('Sailing');
    expect(skillPool({ ...opened, quests: ['Pandemonium'] }, 'chunked')).not.toContain('Herblore');
  });

  it('keeps Herblore shut until Druidic Ritual and a usable herb patch (play review 1, economy review 6)', () => {
    // Falador's herb patch needs Farming 9 (guam): tier 1 and level 9.
    const farmer = { ...fresh().levels, Farming: 9 };
    const falador = (over: Partial<Unlocks>, tiers: Record<string, number> = { Farming: 1 }) => withTiers(tiers, { chunks: ['47,51'], levels: farmer, ...over });
    expect(chunkedSkillRollable('Herblore', falador({ farming: ['Herb'] }))).toBe(false);
    expect(chunkedSkillRollable('Herblore', falador({ farming: ['Herb'], quests: ['Druidic Ritual'] }))).toBe(true);
    expect(chunkedSkillRollable('Herblore', falador({ farming: ['Herb'], quests: ['Druidic Ritual'], levels: fresh().levels }))).toBe(false);
    expect(chunkedSkillRollable('Herblore', falador({ farming: ['Allotment'], quests: ['Druidic Ritual'] }))).toBe(false);
    expect(chunkedSkillRollable('Herblore', falador({ farming: ['Herb'], quests: ['Druidic Ritual'] }, {}))).toBe(false);
  });

  it('counts Farming only for the run\'s patch types, each at its own crop level (content review 8)', () => {
    // Port Sarim's only patch is the spirit tree (83), North Al Kharid's a cactus (55).
    expect(levelsIn('47,50').Farming).toBe(83);
    expect(levelsIn('51,50').Farming).toBe(55);
    expect(chunkedSkillRollable('Farming', withTiers({}, { chunks: ['47,50'], farming: ['Spirit Tree'] }))).toBe(false);
    // At tier 8 the cap is 80, so the spirit tree waits for a level of 83 from elsewhere.
    expect(chunkedSkillRollable('Farming', atCap({ Farming: 8 }, { chunks: ['47,50'], farming: ['Spirit Tree'] }))).toBe(false);
    expect(chunkedSkillRollable('Farming', withTiers({ Farming: 8 }, { chunks: ['47,50'], farming: ['Spirit Tree'], levels: { ...fresh().levels, Farming: 83 } }))).toBe(true);
    expect(chunkedSkillRollable('Farming', withTiers({ Farming: 8 }, { chunks: ['47,50'], farming: [] }))).toBe(false);
    // Tree patches are Farming (oak, 15), never Woodcutting.
    expect(levelsIn('45,53').Farming).toBe(15);
    expect(chunkedSkillRollable('Farming', withTiers({}, { chunks: ['47,51'], farming: ['Allotment'] }))).toBe(true);
    // The Farming Guild's patches need the guild (and its 45 Farming).
    const guild = withTiers({ Farming: 4 }, { chunks: ['19,58'], farming: [...FARMING_PATCH_LIST] });
    expect(chunkedTrainingTiers(guild.chunks, guild).get('Farming')).toBeUndefined();
    expect(chunkedTrainingTiers(guild.chunks, { ...guild, guilds: ['Farming Guild'] }).get('Farming')).toBe(5);
  });

  it('reads each chunk\'s skill facts at their real skill and level (content review 8)', () => {
    // Canifis' "Tall tree" starts the rooftop course; nothing there is cut.
    expect(levelsIn('54,54').Woodcutting).toBeUndefined();
    // Each Mysterious ruins at its own altar's level.
    for (const [chunk, { altar, level }] of Object.entries(RUNE_ALTAR_RUINS)) expect(levelsIn(chunk).Runecraft, altar).toBe(level);
    // Varrock's "Rift" leads to the Abyss; it is no altar.
    expect(levelsIn('51,53').Runecraft).toBeUndefined();
    // The Shipwrights' Workbench and sawmills give no Construction; a house portal does.
    expect(levelsIn('47,50').Construction).toBeUndefined();
    expect(levelsIn('51,54').Construction).toBeUndefined();
    expect(levelsIn('46,50').Construction).toBe(1);
    // The Fishing Guild needs 68 Fishing.
    expect(levelsIn('40,53').Fishing).toBe(GUILD_CHUNKS['40,53'].level);
    // Ambient butterflies and the Museum's specimen rocks train nothing.
    expect(levelsIn('50,50').Hunter).toBeUndefined();
    expect(levelsIn('50,53').Mining).toBeUndefined();
    // A rune altar's own altar is not a Prayer altar.
    expect(levelsIn('46,51').Prayer).toBeUndefined();
  });

  it('round-trips a tier-10 fact: the Wrath altar (95) is stored as "0" and read back as tier 10 (content review 13)', () => {
    expect(chunkedTrainingTiers(['38,44']).get('Runecraft')).toBe(10);
    // With essence (Rune Mysteries, Mining, Aubury in Varrock 50,53) and level 95.
    const wrath = { chunks: ['38,44', '50,53'], quests: ['Rune Mysteries'], levels: { ...fresh().levels, Runecraft: 95 } };
    expect(chunkedSkillRollable('Runecraft', withTiers({ Runecraft: 9, Mining: 1 }, wrath))).toBe(true);
    expect(chunkedSkillRollable('Runecraft', withTiers({ Runecraft: 8, Mining: 1 }, wrath))).toBe(false);
  });

  it('maps every Mysterious ruins a chunk can reach to its altar', () => {
    const doc = chunkDoc as unknown as { chunks: Record<string, { o?: [string, number][] }>; interiors: Record<string, { content: { o?: [string, number][] }; entrances: { chunkId: string; requirements: string[] }[] }> };
    const keyOf = (id: string) => `${Math.floor(Number(id) / 256)},${Number(id) % 256}`;
    const hasRuins = (entry: { o?: [string, number][] }) => (entry.o ?? []).some(([name]) => name === 'Mysterious ruins');
    const chunks = new Set<string>();
    for (const [id, entry] of Object.entries(doc.chunks)) if (hasRuins(entry)) chunks.add(keyOf(id));
    for (const interior of Object.values(doc.interiors)) {
      if (hasRuins(interior.content)) for (const route of interior.entrances) if (route.requirements.length === 0) chunks.add(keyOf(route.chunkId));
    }
    expect([...chunks].sort()).toEqual(Object.keys(RUNE_ALTAR_RUINS).sort());
  });

  it('leaves Vanilla Skills rolls open to every skill', () => {
    expect(skillPool(fresh(), 'vanilla')).toContain('Sailing');
  });
});

describe('Chunked deadlock audit (18 October 2026): nothing counts as trainable that the game would not allow', () => {
  /** A dry Chunked run: no Keys, no Fate, every Breakthrough spent, so only room or exploring could hold Fate's Mercy shut. */
  const dry = (unlocks: Unlocks) => ({
    ...initialState, gameModeId: 'chunked', keys: 0, specialKeys: 0, chaosKeys: 0, fatePoints: 0, pendingUnlock: null,
    chunkExplore: undefined, chunkedBreakthroughs: Object.fromEntries(Object.entries(unlocks.skills).map(([skill, tier]) => [skill, tier + 1])),
    unlocks,
  });
  const levels = (over: Record<string, number>) => ({ ...fresh().levels, ...over });

  it('counts Ranged, and Ranged as a combat style, only with the Weapon slot open (dead end 1)', () => {
    const weapon = (tier: number) => ({ ...fresh().equipment, Weapon: tier });
    expect(fresh().equipment.Weapon).toBe(0);
    expect(skillPool(fresh(), 'chunked')).not.toContain('Ranged');
    expect(skillPool(withTiers({}, { equipment: weapon(1) }), 'chunked')).toContain('Ranged');
    // Ranged drawn by Mercy on a fresh run used to hold Mercy shut for good.
    const ranged = withTiers({ Ranged: 1 });
    expect(chunkedSkillHasRoom('Ranged', ranged)).toBe(false);
    expect(chunkedSkillNeeds('Ranged', ranged)).toBe('a Weapon slot to hold a bow');
    expect(chunkedSkillRollable('Hitpoints', ranged)).toBe(false);
    expect(skillsWithRoom(dry(ranged))).toEqual([]);
    expect(mercyBlocker(dry(ranged), [])).toBeNull();
    // With a Weapon slot, Ranged trains and Hitpoints with it.
    const armed = withTiers({ Ranged: 1 }, { equipment: weapon(1) });
    expect(chunkedSkillHasRoom('Ranged', armed)).toBe(true);
    expect(chunkedSkillRollable('Hitpoints', armed)).toBe(true);
    // Magic needs no runes: it stays trainable and is a combat style.
    expect(chunkedSkillRollable('Magic', fresh())).toBe(true);
    expect(chunkedSkillRollable('Hitpoints', withTiers({ Magic: 1 }))).toBe(true);
  });

  it('compares the lowest usable level with the player\'s level, not just its tier (dead end 2)', () => {
    // Draynor rooftop: Agility 10 at tier 1.
    const draynor = { chunks: ['49,50', '48,50', '48,51'] };
    expect(chunkedSkillHasRoom('Agility', withTiers({ Agility: 1 }, draynor))).toBe(false);
    expect(mercyBlocker(dry(withTiers({ Agility: 1 }, draynor)), [])).toBeNull();
    expect(chunkedSkillHasRoom('Agility', withTiers({ Agility: 1 }, { ...draynor, levels: levels({ Agility: 10 }) }))).toBe(false); // at the tier-1 cap
    expect(chunkedSkillRollable('Agility', withTiers({ Agility: 1 }, { ...draynor, levels: levels({ Agility: 10 }) }))).toBe(true);
    // The Water altar: Runecraft 5, two chunks from the start (with essence from Aubury).
    const water = { chunks: ['50,49', '49,49', '50,53'], quests: ['Rune Mysteries'] };
    expect(chunkedSkillHasRoom('Runecraft', withTiers({ Runecraft: 1, Mining: 1 }, water))).toBe(false);
    expect(chunkedSkillHasRoom('Runecraft', withTiers({ Runecraft: 1, Mining: 1 }, { ...water, levels: levels({ Runecraft: 5 }) }))).toBe(true);
    // Bush patches: Farming 10 at tier 1 (the Champions' Guild's, 49,52).
    expect(built.patches['49,52'].Bush).toBe(10);
    const bush = { chunks: ['49,52'], farming: ['Bush'] };
    expect(chunkedSkillRollable('Farming', withTiers({}, bush))).toBe(false);
    expect(chunkedSkillRollable('Farming', withTiers({}, { ...bush, levels: levels({ Farming: 10 }) }))).toBe(true);
    // The generator keeps the exact level only above the tier's floor: 10 for Draynor, none for Gnome's level 1.
    expect(CHUNK_SKILL_TIERS['48,51']).toContain('B9'); // tier 1, nine levels above its floor
    expect([1, 10, 11, 20, 87, 91, 95].map(factCell)).toEqual(['1', 'B9', '2', 'C9', 'J6', '0', 'A4']);
    expect(levelsIn('38,53').Agility).toBe(1);
    for (const [chunk, facts] of Object.entries(built.nodes)) {
      for (const [fact, level] of Object.entries(facts)) expect(chunkFactLevel(chunk, fact), `${chunk} ${fact}`).toBe(level);
    }
  });

  it('counts Runecraft only with essence: Rune Mysteries, Mining and an essence mine teleport (dead end 3)', () => {
    const water = (over: Partial<Unlocks>, tiers: Record<string, number> = { Mining: 1 }) =>
      withTiers({ Runecraft: 1, ...tiers }, { chunks: ['50,49', '49,49'], levels: levels({ Runecraft: 5 }), ...over });
    expect(chunkedSkillHasRoom('Runecraft', water({}))).toBe(false);
    expect(chunkedSkillHasRoom('Runecraft', water({ quests: ['Rune Mysteries'] }))).toBe(false);          // no teleport owned
    expect(chunkedSkillHasRoom('Runecraft', water({ chunks: ['50,49', '49,49', '50,53'] }))).toBe(false); // Rune Mysteries not done
    expect(chunkedSkillHasRoom('Runecraft', water({ chunks: ['50,49', '49,49', '50,53'], quests: ['Rune Mysteries'] }, {}))).toBe(false); // no Mining
    expect(chunkedSkillHasRoom('Runecraft', water({ chunks: ['50,49', '49,49', '50,53'], quests: ['Rune Mysteries'] }))).toBe(true);
    // Aubury, Wizard Cromperty, Archmage Sedridor (the Wizards' Tower basement) and Brimstail.
    expect(Object.keys(CHUNK_SKILL_SERVICES.essence).sort()).toEqual(['37,53', '41,51', '48,49', '50,53']);
  });

  it('counts Construction only with a house from an estate agent and planks (dead end 5)', () => {
    const rimmington = ['49,50', '48,50', '47,50', '47,51', '46,50'];
    const builder = (chunks: string[], merchants: string[]) =>
      withTiers({ Construction: 1, Woodcutting: 1 }, { chunks: [...rimmington, ...chunks], merchants });
    expect(chunkedSkillHasRoom('Construction', builder([], []))).toBe(false);
    // Falador's estate agent sells the house; there are no planks yet.
    expect(chunkedSkillHasRoom('Construction', builder(['46,52'], ['Real Estate Agents']))).toBe(false);
    expect(chunkedSkillHasRoom('Construction', builder(['46,52', '51,54'], ['Real Estate Agents']))).toBe(false); // the sawmill's merchant is locked
    expect(chunkedSkillHasRoom('Construction', builder(['46,52', '51,54'], ['Real Estate Agents', 'Sawmill Operators']))).toBe(true);
    expect(chunkedSkillHasRoom('Construction', builder(['51,54'], ['Real Estate Agents', 'Sawmill Operators']))).toBe(false); // no estate agent
    expect(Object.keys(CHUNK_SKILL_SERVICES.estateAgent).sort()).toEqual(['26,48', '27,56', '41,51', '42,54', '46,52', '50,54']);
  });

  it('counts Hunter only with traps from a Hunter shop of an unlocked merchant type (dead end 6)', () => {
    // The desert warblers (Hunter 5) and Nardah's Hunter shop.
    const desert = (chunks: string[], merchants: string[]) =>
      withTiers({ Hunter: 1 }, { chunks: ['51,50', '51,49', '52,49', '53,49', ...chunks], merchants, levels: levels({ Hunter: 5 }) });
    expect(chunkedSkillHasRoom('Hunter', desert([], ['Hunter Shops']))).toBe(false);
    expect(chunkedSkillHasRoom('Hunter', desert(['53,45'], []))).toBe(false);
    expect(chunkedSkillHasRoom('Hunter', desert(['53,45'], ['Hunter Shops']))).toBe(true);
    // At level 1 the warblers are still out of reach.
    expect(chunkedSkillHasRoom('Hunter', { ...desert(['53,45'], ['Hunter Shops']), levels: fresh().levels })).toBe(false);
  });

  it('opens Smithing through an ore shop only with its merchant type, and never through a Thieving stall (dead end 7)', () => {
    const shantay = (merchants: string[]) => withTiers({}, { chunks: ['51,50', '51,49', '51,48'], merchants });
    expect(chunkedSkillRollable('Smithing', shantay([]))).toBe(false);
    expect(chunkedSkillRollable('Smithing', shantay(['General Stores']))).toBe(true);
    // Port Roberts' ore and silver stalls and Ardougne's silver stall are stolen from, not bought from.
    expect(built.oreShops['29,51']).toBeUndefined();
    expect(built.oreShops['41,51']).toBeUndefined();
    expect(chunkedSkillRollable('Smithing', withTiers({}, { chunks: ['29,51'], merchants: [...MERCHANTS_LIST] }))).toBe(false);
    // Deepfin Point's ore exchange sells copper and tin.
    expect(built.oreShops['30,43']).toEqual({ 'Ore Merchants': 1 });
    expect(chunkedSkillRollable('Smithing', withTiers({}, { chunks: ['30,43'], merchants: ['Ore Merchants'] }))).toBe(true);
    // Stock that trains no Smithing at level 1: iron ore first trains at 15.
    expect(oreShopSmithingLevel(['Coal', 'Gold bar'])).toBeNull();
    expect(oreShopSmithingLevel(['Iron ore', 'Coal'])).toBe(15);
    expect(oreShopSmithingLevel(['Copper ore', 'Tin ore'])).toBe(1);
  });

  it('needs a combat style for bones, meat and Slayer tasks, as for Hitpoints', () => {
    // Lumbridge's goblins and cows give bones and meat only to a run that can fight.
    expect(chunkedSkillNeeds('Prayer', fresh())).toMatch(/^bones/);
    expect(chunkedSkillRollable('Slayer', withTiers({}, { chunks: ['49,50', '48,50', '48,51'] }))).toBe(false);
    expect(chunkedSkillRollable('Slayer', withTiers({ Defence: 1 }, { chunks: ['49,50', '48,50', '48,51'] }))).toBe(true);
  });
});
