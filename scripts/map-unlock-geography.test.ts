import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';

it('pins the split names and boss entrances to source geography', () => {
  const source = JSON.parse(gunzipSync(readFileSync('data/sources/chunkpicker-chunkinfo-export.json.gz')).toString('utf8')).chunks;
  expect(source['10034'].Nickname).toBe('Khazard Battlefield');
  expect(source['10545'].Nickname).toBe('Port Khazard');
  expect(source['11835'].Nickname).toBe('Chaos Altar');
  expect(source['12856'].Nickname).toBe('Chaos Temple');
  const task = ALL_DIARY_TASKS.find(task => task.id === 'wild_elite_1')!;
  const entrances = task.locations!.map(location => location.chunkOptions.map(c => c.cx * 256 + c.cy));
  expect(entrances).toEqual([[13116, 12345], [13115, 12602], [12859, 12601]]);
  for (const [entrance, interior, monster] of [
    [13116, 13473, 'Callisto'], [12345, 13474, 'Artio'], [13115, 13727, 'Venenatis'],
    [12602, 13728, 'Spindel'], [12859, 13215, "Vet'ion"], [12601, 13216, "Calvar'ion"],
  ] as const) {
    const entry = source[entrance];
    expect(entry.Connect?.[interior] || Object.values(entry.Sections ?? {}).some((section: any) => section.Connect?.[interior]), String(entrance)).toBe(true);
    expect(source[interior].Monster[monster], monster).toBeGreaterThan(0);
  }
});
