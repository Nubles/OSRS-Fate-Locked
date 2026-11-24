import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { QUEST_DATA } from '../data/questData';
import { buildDiscordAreaGuide } from '../utils/discordAreaGuide';

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

  it(WRITE ? 'writes public/discord-area-guide.json' : 'matches public/discord-area-guide.json (npm run discord:areas)', () => {
    const text = `${JSON.stringify(guide)}\n`;
    if (WRITE) writeFileSync(FILE, text);
    expect(readFileSync(FILE, 'utf8')).toBe(text);
  });
});
