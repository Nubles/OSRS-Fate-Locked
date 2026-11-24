import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ACTIVITY_ACCESS_AREAS, NO_HARD_LOCATION_GATE } from '../data/activityAccess';
import { AREA_ALIAS_POLICIES } from '../data/areaMapPolicy';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import { QUEST_DATA } from '../data/questData';
import { DISCORD_IN_GAME_AREA_NAMES, DISCORD_UNGATED_REASONS, buildDiscordAreaGuide, discordLookupKey } from '../utils/discordAreaGuide';

const FILE = new URL('../public/discord-area-guide.json', import.meta.url);
const WRITE = process.env.FATE_DISCORD_AREAS === 'write';

describe('the Discord area guide', () => {
  const guide = buildDiscordAreaGuide();

  it('names each gated boss under the areas that open it', () => {
    const area = (name: string) => guide.areas.find(entry => entry.name === name);
    expect(area('Lava Maze')?.region).toBe('Wilderness');
    expect(area('Lava Maze')?.bosses).toContain('Chaos Fanatic');
    expect(area('Chaos Temple')?.bosses).toEqual(expect.arrayContaining(['Venenatis', "Vet'ion"]));
    expect(area("Rogues' Castle")?.bosses).toContain('Callisto');
    expect(area('Varrock')).toMatchObject({ region: 'Misthalin' });
    expect(area('Varrock')?.chunks).toBeGreaterThan(0);
    expect(area("Void Knights' Outpost")?.routes).toContain("Squire's boat from Port Sarim");
  });

  // Audit areas d1 0: banks came from chunk ownership only, so the three banks that sit on
  // their place's entrance chunk were listed under the surface area outside.
  it('lists each bank under the area it stands in, not the area of its entrance chunk', () => {
    const area = (name: string) => guide.areas.find(entry => entry.name === name);
    expect(area('Keldagrim')?.banks).toContain('Keldagrim bank and Blast Furnace chest');
    expect(area('Mor Ul Rek (TzHaar City)')?.banks).toContain('Mor Ul Rek (TzHaar City) banks');
    expect(area('Zanaris')?.banks).toContain('Zanaris bank');
    expect(area('Mountain Camp')?.banks).not.toContain('Keldagrim bank and Blast Furnace chest');
    expect(area('Musa Point')?.banks).not.toContain('Mor Ul Rek (TzHaar City) banks');
    expect(area('Lumbridge')?.banks).not.toContain('Zanaris bank');
  });

  // Audit areas d1 2: a quest came in when any one of its alternative routes named the area,
  // so Plague City, whose eight item routes can all do without Waterbirth Island, was said to need it.
  it('lists a quest only under the areas it needs, not under one of its alternative routes', () => {
    const area = (name: string) => guide.areas.find(entry => entry.name === name);
    for (const name of ['Waterbirth Island', 'Rimmington', 'Zanaris']) expect(area(name)?.quests).not.toContain('Plague City');
    expect(area('Varrock')?.quests).not.toContain('Monkey Madness I');
    expect(area('Varrock')?.quests).not.toContain('RFD: Start (The Cook)');
    for (const entry of guide.areas) {
      for (const name of entry.quests) {
        const quest = Object.values(QUEST_DATA).find(candidate => candidate.name === name)!;
        const needs = (regions: string[] = [], locations: { standardAreas: string[] }[] = []) =>
          regions.includes(entry.name) || locations.some(location => location.standardAreas.includes(entry.name));
        const needed = needs(quest.regions, quest.locations)
          || (Boolean(quest.oneOf?.length) && quest.oneOf!.every(option => needs(option.regions, option.locations)));
        expect(needed, `${entry.name}: ${name}`).toBe(true);
      }
    }
    // Every one of Troll Romance's routes needs Catherby, so it still needs Catherby.
    expect(area('Catherby')?.quests).toContain('Troll Romance');
  });

  // The live bot (fate-locked-discord src/area.ts parseAreaGuide) reads v 1, these eight keys
  // with these types, and ignores any other key: new keys may only be added, and only optionally.
  it('keeps every key the live bot reads and adds only optional ones', () => {
    expect(Object.keys(guide)).toEqual(['v', 'areas', 'ungated']);
    expect(guide.v).toBe(1);
    const old = ['name', 'region', 'chunks', 'bosses', 'activities', 'quests', 'banks', 'routes'];
    for (const entry of guide.areas) {
      const keys = Object.keys(entry);
      expect(keys.slice(0, old.length), entry.name).toEqual(old);
      expect(keys.slice(old.length).every(key => key === 'aliases' || key === 'diaryTasks'), entry.name).toBe(true);
      expect(typeof entry.name === 'string' && typeof entry.region === 'string' && typeof entry.chunks === 'number').toBe(true);
      for (const key of ['bosses', 'activities', 'quests', 'banks', 'routes', 'aliases', 'diaryTasks'] as const) {
        const value = entry[key];
        if (key === 'aliases' || key === 'diaryTasks') {
          if (value === undefined) continue;
          expect(value.length, `${entry.name} ${key} is left out when empty`).toBeGreaterThan(0);
        }
        expect(Array.isArray(value) && value.every(item => typeof item === 'string'), `${entry.name} ${key}`).toBe(true);
      }
    }
  });

  // Audit bot-commands d2 0: /area knew each place by one name, so the tracker's own
  // aliases and the game's current map names got "No area, boss or activity is called".
  it('carries the tracker aliases and current in-game names on their areas', () => {
    const area = (name: string) => guide.areas.find(entry => entry.name === name);
    const gate = (name: string) => guide.areas.filter(entry => [...entry.bosses, ...entry.activities].includes(name));
    for (const [alias, policy] of Object.entries(AREA_ALIAS_POLICIES)) {
      if (area(policy.canonical)?.aliases?.includes(alias)) continue;
      // A name that is already a boss or activity answers as that, with its areas.
      expect(gate(alias).map(entry => entry.name), alias).toContain(policy.canonical);
      expect(guide.areas.some(entry => entry.aliases?.includes(alias)), alias).toBe(false);
    }
    expect(area('Goblin Village')?.aliases).toContain('Ice Mountain');
    expect(area('Taverley')?.aliases).toEqual(expect.arrayContaining(["Heroes' Guild", 'Chaos Temple (Asgarnia)']));
    expect(area('Iorwerth Camp')?.aliases).toContain('Elf Camp');
    for (const [name, aliases] of Object.entries(DISCORD_IN_GAME_AREA_NAMES)) {
      expect(area(name)?.aliases, name).toEqual(expect.arrayContaining([...aliases]));
    }
    expect(area('Wilderness Volcano')?.aliases).toEqual(['Blighted Volcano']);
    expect(area('Paterdomus')?.aliases).toEqual(['Paterdomus Temple']);
    expect(area('Piscarilius')?.aliases).toEqual(['Port Piscarilius']);
    // 'Chaos Temple' stays the Wilderness area; the Asgarnian one is found only by a name that says so.
    expect(area('Chaos Temple')?.region).toBe('Wilderness');
    expect(area('Chaos Temple')?.aliases).toBeUndefined();
  });

  it('never gives two things the same name once the bot normalises it', () => {
    const owners = new Map<string, string>();
    const claim = (name: string, owner: string) => {
      const key = discordLookupKey(name);
      const previous = owners.get(key);
      expect(previous === undefined || previous === owner, `${name} (${owner}) collides with ${previous}`).toBe(true);
      owners.set(key, owner);
    };
    // Areas first, then the bosses and activities (one gate may sit under several areas).
    // An activity may share its area's name (Castle Wars), as long as that area opens it.
    for (const entry of guide.areas) claim(entry.name, `area ${entry.name}`);
    for (const entry of guide.areas) {
      for (const name of [...entry.bosses, ...entry.activities]) {
        const area = guide.areas.find(candidate => discordLookupKey(candidate.name) === discordLookupKey(name));
        if (area) expect([...area.bosses, ...area.activities], `${name} shares an area's name`).toContain(name);
        else claim(name, `gate ${name}`);
      }
    }
    for (const entry of guide.ungated) claim(entry.name, `ungated ${entry.name}`);
    for (const entry of guide.areas) {
      for (const alias of entry.aliases ?? []) claim(alias, `alias of ${entry.name}`);
    }
    expect(discordLookupKey("Kree'arra")).toBe('kreearra');
    expect(discordLookupKey('Chaos Temple (Asgarnia)')).toBe('chaos temple asgarnia');
  });

  // Audit bot-commands d1 0: the guide held no diary tasks, so /area said nothing in the
  // tracker was gated on Agility Pyramid, Fountain of Rune, Mudskipper Point or the
  // Wilderness God Wars Dungeon, though the Journal blocks eight diary tasks on them.
  it('lists the diary tasks the Journal blocks until the area is open', () => {
    const area = (name: string) => guide.areas.find(entry => entry.name === name);
    expect(area('Agility Pyramid')?.diaryTasks).toEqual([
      'Desert Easy: Sell some artefacts to Simon Templeton.',
      'Desert Medium: Climb to the summit of the Agility Pyramid.',
    ]);
    expect(area('Fountain of Rune')?.diaryTasks).toContain('Wilderness Easy: Cast Low Alchemy at the Fountain of Rune.');
    expect(area('Mudskipper Point')?.diaryTasks).toContain('Falador Medium: Kill a Mogre at Mudskipper Point.');
    expect(area('Wilderness God Wars Dungeon')?.diaryTasks?.map(task => task.split(':')[0]))
      .toEqual(['Wilderness Medium', 'Wilderness Medium', 'Wilderness Hard', 'Wilderness Elite']);
    // A task any one of several areas can meet needs none of them: Kill a Vulture takes
    // Menaphos, Agility Pyramid or Sophanem, so it is listed under none of the three.
    for (const name of ['Menaphos', 'Agility Pyramid', 'Sophanem']) {
      expect(area(name)?.diaryTasks ?? [], name).not.toContain('Desert Easy: Kill a Vulture');
    }
    // A route choice counts when every route needs the area. Golden Warbler is caught in
    // Ruins of Uzer or at the Uzer Hunter chunks, and those chunks are painted Ruins of
    // Uzer too, so in Vanilla the Journal blocks it until Ruins of Uzer is open.
    expect(area('Ruins of Uzer')?.diaryTasks).toContain('Desert Easy: Catch a Golden Warbler.');
    // A task met only at chunks counts for the area those chunks are painted: the Black
    // Salamander chunk lies in Chaos Temple.
    expect(area('Chaos Temple')?.diaryTasks).toContain('Wilderness Hard: Catch a Black Salamander in the Wilderness.');
    // A real choice of areas still needs none of them: Orange Salamander takes Ruins of
    // Uzer or Sophanem.
    for (const name of ['Ruins of Uzer', 'Sophanem']) {
      expect(area(name)?.diaryTasks ?? [], name).not.toContain('Desert Medium: Catch an Orange Salamander.');
    }
    // Both ends of a carpet ride are needed.
    for (const name of ['Shantay Pass', 'Pollnivneach']) {
      expect(area(name)?.diaryTasks, name).toContain('Desert Easy: Travel from the Shantay Pass to Pollnivneach by Magic Carpet.');
    }
    // Diary and tier order, as the Journal lists them.
    const order = [...new Set(ALL_DIARY_TASKS.map(task => task.tierId))];
    for (const entry of guide.areas) {
      const tiers = (entry.diaryTasks ?? []).map(task => order.indexOf(task.slice(0, task.indexOf(':'))));
      expect(tiers.every(index => index >= 0), entry.name).toBe(true);
      expect(tiers, entry.name).toEqual([...tiers].sort((a, b) => a - b));
    }
  });

  // Audit bot-commands d1 1: the guide took gates only from ACTIVITY_ACCESS_AREAS, so /area
  // told players seven bosses and activities a Key can roll did not exist.
  it('names the bosses and activities no single area opens, with a reason', () => {
    expect(guide.ungated.map(entry => entry.name).sort()).toEqual([
      'Abyssal Sire', 'Barracuda Trials', 'Forestry', 'Impetuous Impulses', 'Mahogany Homes', 'Mimic', 'Shooting Stars',
    ]);
    expect(guide.ungated.find(entry => entry.name === 'Abyssal Sire')?.kind).toBe('boss');
    expect(guide.ungated.find(entry => entry.name === 'Mimic')?.kind).toBe('boss');
    expect(guide.ungated.find(entry => entry.name === 'Forestry')?.kind).toBe('activity');
    const gates = new Set(guide.areas.flatMap(entry => [...entry.bosses, ...entry.activities]));
    for (const entry of guide.ungated) {
      expect(NO_HARD_LOCATION_GATE.has(entry.name), entry.name).toBe(true);
      expect(gates.has(entry.name), `${entry.name} is also a gate`).toBe(false);
      expect(Object.hasOwn(ACTIVITY_ACCESS_AREAS, entry.name), entry.name).toBe(false);
      expect(entry.reason, entry.name).toBe(DISCORD_UNGATED_REASONS[entry.name]);
      expect(entry.reason, entry.name).toMatch(/^[A-Z][^\u2014]*\.$/);
    }
  });

  it(WRITE ? 'writes public/discord-area-guide.json' : 'matches public/discord-area-guide.json (npm run discord:areas)', () => {
    const text = `${JSON.stringify(guide)}\n`;
    if (WRITE) writeFileSync(FILE, text);
    expect(readFileSync(FILE, 'utf8')).toBe(text);
  });
});
