import { describe, expect, it } from 'vitest';
import { TableType } from '../types';
import { initialState } from '../context/GameContext';
// @ts-expect-error Node types are intentionally excluded from the browser app.
import { readFileSync } from 'node:fs';
import { AGILITY_COURSES, buildChunkSkillNodes, chunkSkillNodesSource, GUILD_CHUNKS, RUNE_ALTAR_RUINS } from './chunkSkillNodesBuild';
import chunkDoc from '../public/chunk-content.json';
import { chunkedSkillRollable, chunkedTrainingTiers } from './chunkedSkillPool';
import { randomUnlockPool } from './gameEngine';
import { chunkKey, getChunkFrontier } from './chunkAdjacency';
import { FARMING_PATCH_LIST } from '../data/items';

const fresh = () => ({ ...initialState.unlocks, chunks: [] as string[] });
type Unlocks = ReturnType<typeof fresh>;
const withTiers = (tiers: Record<string, number>, over: Partial<Unlocks> = {}): Unlocks =>
  ({ ...fresh(), ...over, skills: { ...fresh().skills, ...tiers } });
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
    expect(pool).toEqual(expect.arrayContaining(['Woodcutting', 'Attack', 'Prayer', 'Thieving', 'Cooking', 'Crafting']));
    // The castle's furnace has no ore, its butterflies are scenery, and its
    // trees give no logs until Woodcutting is open.
    for (const skill of ['Sailing', 'Construction', 'Agility', 'Herblore', 'Slayer', 'Runecraft', 'Mining', 'Smithing', 'Hunter', 'Firemaking', 'Fletching']) {
      expect(pool).not.toContain(skill);
    }
  });

  it('needs a node the next tier can reach: the castle\'s level-20 fishing spot is out of reach at tier 0', () => {
    expect(chunkedTrainingTiers([]).get('Fishing')).toBe(2);
    expect(chunkedSkillRollable('Fishing', fresh())).toBe(false);
    expect(chunkedSkillRollable('Fishing', { ...fresh(), skills: { ...fresh().skills, Fishing: 1 } })).toBe(true);
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
    // Port Roberts' ore stall sells ore with no Mining at all.
    expect(chunkedSkillRollable('Smithing', withTiers({}, { chunks: ['29,51'] }))).toBe(true);
    // Food and bones: Lumbridge's cows, goblins and chickens.
    expect(chunkedSkillRollable('Cooking', fresh())).toBe(true);
    expect(chunkedSkillRollable('Prayer', fresh())).toBe(true);
  });

  it('rolls Agility from a chunk holding a course start, at the course level (content review 1)', () => {
    expect(chunkedSkillRollable('Agility', fresh())).toBe(false);
    // Gnome Stronghold course (level 1) and Draynor rooftop (level 10) are tier 1.
    expect(chunkedSkillRollable('Agility', withTiers({}, { chunks: ['38,53'] }))).toBe(true);
    expect(chunkedSkillRollable('Agility', withTiers({}, { chunks: ['48,51'] }))).toBe(true);
    // Varrock rooftop (30) opens at tier 2.
    expect(chunkedSkillRollable('Agility', withTiers({}, { chunks: ['50,53'] }))).toBe(false);
    expect(chunkedSkillRollable('Agility', withTiers({ Agility: 2 }, { chunks: ['50,53'] }))).toBe(true);
    // Canifis (40) also needs Priest in Peril, which its entry needs (content review 12).
    expect(chunkedSkillRollable('Agility', withTiers({ Agility: 3 }, { chunks: ['54,54'] }))).toBe(false);
    expect(chunkedSkillRollable('Agility', withTiers({ Agility: 3 }, { chunks: ['54,54'], quests: ['Priest in Peril'] }))).toBe(true);
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
    const quests = ['Pandemonium', 'Druidic Ritual', 'Priest in Peril'];
    const opened = withTiers({ Woodcutting: 1, Mining: 1, Fishing: 1, Farming: 1 }, { chunks, quests, farming: [...FARMING_PATCH_LIST] });
    const pool = skillPool(opened, 'chunked');
    expect(pool).toEqual(expect.arrayContaining(['Agility', 'Sailing', 'Herblore', 'Farming', 'Construction', 'Hunter', 'Runecraft', 'Smithing']));
    // Sailing still waits on Pandemonium.
    expect(skillPool({ ...opened, quests: ['Druidic Ritual'] }, 'chunked')).not.toContain('Sailing');
    expect(skillPool({ ...opened, quests: ['Pandemonium'] }, 'chunked')).not.toContain('Herblore');
  });

  it('keeps Herblore shut until Druidic Ritual and a usable herb patch (play review 1, economy review 6)', () => {
    const falador = (over: Partial<Unlocks>, tiers: Record<string, number> = { Farming: 1 }) => withTiers(tiers, { chunks: ['47,51'], ...over });
    expect(chunkedSkillRollable('Herblore', falador({ farming: ['Herb'] }))).toBe(false);
    expect(chunkedSkillRollable('Herblore', falador({ farming: ['Herb'], quests: ['Druidic Ritual'] }))).toBe(true);
    expect(chunkedSkillRollable('Herblore', falador({ farming: ['Allotment'], quests: ['Druidic Ritual'] }))).toBe(false);
    expect(chunkedSkillRollable('Herblore', falador({ farming: ['Herb'], quests: ['Druidic Ritual'] }, {}))).toBe(false);
  });

  it('counts Farming only for the run\'s patch types, each at its own crop level (content review 8)', () => {
    // Port Sarim's only patch is the spirit tree (83), North Al Kharid's a cactus (55).
    expect(levelsIn('47,50').Farming).toBe(83);
    expect(levelsIn('51,50').Farming).toBe(55);
    expect(chunkedSkillRollable('Farming', withTiers({}, { chunks: ['47,50'], farming: ['Spirit Tree'] }))).toBe(false);
    expect(chunkedSkillRollable('Farming', withTiers({ Farming: 8 }, { chunks: ['47,50'], farming: ['Spirit Tree'] }))).toBe(true);
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
    expect(chunkedSkillRollable('Runecraft', withTiers({ Runecraft: 9 }, { chunks: ['38,44'] }))).toBe(true);
    expect(chunkedSkillRollable('Runecraft', withTiers({ Runecraft: 8 }, { chunks: ['38,44'] }))).toBe(false);
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
