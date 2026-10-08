import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildDiscordAreaGuide } from '../utils/discordAreaGuide';

const FILE = new URL('../public/discord-area-guide.json', import.meta.url);
const WRITE = process.env.FATE_DISCORD_AREAS === 'write';

describe('the Discord area guide', () => {
  const guide = buildDiscordAreaGuide();

  it('names each gated boss under the areas that open it', () => {
    const area = (name: string) => guide.areas.find(entry => entry.name === name);
    expect(area('Lava Maze')?.region).toBe('Wilderness');
    expect(area('Lava Maze')?.bosses).toContain('Chaos Fanatic');
    expect(area('Chaos Temple')?.bosses).toEqual(expect.arrayContaining(['Callisto', 'Venenatis', "Vet'ion"]));
    expect(area('Varrock')).toMatchObject({ region: 'Misthalin' });
    expect(area('Varrock')?.chunks).toBeGreaterThan(0);
    expect(area("Void Knights' Outpost")?.routes).toContain("Squire's boat from Port Sarim");
  });

  it(WRITE ? 'writes public/discord-area-guide.json' : 'matches public/discord-area-guide.json (npm run discord:areas)', () => {
    const text = `${JSON.stringify(guide)}\n`;
    if (WRITE) writeFileSync(FILE, text);
    expect(readFileSync(FILE, 'utf8')).toBe(text);
  });
});
