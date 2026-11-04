import { describe, expect, it } from 'vitest';
import type { LogEntry } from '../../types';
import { SUB_AREA_CHUNKS } from '../../data/subAreaChunks';
import { buildFilmTimeline, ownedChunksForAreas, TICKER_LINES } from './timeline';
import { chunkRect, filmLayout } from './painter';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 1, 12);
let n = 0;
const entry = (dayOffset: number, type: LogEntry['type'], message: string, meta?: Record<string, unknown>): LogEntry => ({
  id: `e${n++}`, timestamp: T0 + dayOffset * DAY + n, type, message, meta,
});
const unlockArea = (day: number, area: string) => entry(day, 'UNLOCK', `Unlocked ${area}`, { item: area, category: 'Regions', cost: 1, costType: 'key' });
const key = (c: { cx: number; cy: number }) => `${c.cx},${c.cy}`;
const vanilla = { chunked: false, finalRegions: [] as string[], finalChunks: [] as string[] };

describe('ownedChunksForAreas', () => {
  it('starts with free Misthalin and adds an Area’s own chunks', () => {
    const start = ownedChunksForAreas([]);
    expect(start.has('50,50')).toBe(true); // Lumbridge
    const falador = SUB_AREA_CHUNKS['Falador'].map(key);
    expect(falador.some(k => start.has(k))).toBe(false);
    const after = ownedChunksForAreas(['Falador']);
    for (const k of falador) expect(after.has(k)).toBe(true);
  });
});

describe('buildFilmTimeline', () => {
  it('counts rolls, Keys won and unlocks, and opens land at the step it was unlocked', () => {
    const log = [
      entry(0, 'ROLL_FAIL', 'No Key.'),
      entry(0, 'ROLL_SUCCESS', 'Key!'),
      unlockArea(0, 'Falador'),
      entry(2, 'PITY', 'Pity Key'),
      entry(2, 'UNLOCK', 'Unlocked Strength', { item: 'Strength', category: 'Skills' }),
    ];
    const t = buildFilmTimeline(log, vanilla);
    expect(t.steps).toHaveLength(5);
    const last = t.steps[4];
    expect(last).toMatchObject({ day: 3, rolls: 3, keysWon: 2, unlocks: 2 });
    expect(last.ticker[0]).toEqual({ text: 'Strength I', kind: 'skill' });
    expect(last.ticker[1]).toEqual({ text: 'Falador', kind: 'area' });
    const falador = SUB_AREA_CHUNKS['Falador'].map(key);
    expect(t.steps[2].added.sort()).toEqual([...falador].sort());
    expect(t.start).toContain('50,50');
    expect(t.start.some(k => falador.includes(k))).toBe(false);
  });

  it('puts several log lines in a step when the log is long, and keeps the ticker short', () => {
    const log = Array.from({ length: 100 }, (_, i) => entry(i / 10, 'UNLOCK', `Unlocked Thing ${i}`, { item: `Thing ${i}`, category: 'Merchants' }));
    const t = buildFilmTimeline(log, { ...vanilla, maxSteps: 10 });
    expect(t.steps).toHaveLength(10);
    expect(t.steps[9].unlocks).toBe(100);
    expect(t.steps[9].ticker).toHaveLength(TICKER_LINES);
    expect(t.steps[9].ticker[0].text).toBe('Thing 99');
  });

  it('ends on the live map when the log misses an Area', () => {
    const t = buildFilmTimeline([entry(0, 'ROLL_FAIL', 'No Key.')], { ...vanilla, finalRegions: ['Falador'] });
    expect(t.steps).toHaveLength(2);
    expect(t.steps[1].added).toEqual(expect.arrayContaining(SUB_AREA_CHUNKS['Falador'].map(key)));
  });

  it('lists underground Areas that have no square on the map', () => {
    const t = buildFilmTimeline([unlockArea(0, 'Keldagrim')], vanilla);
    expect(t.offMap).toEqual(['Keldagrim']);
    expect(t.steps[0].added).toEqual([]);
  });

  it('follows chunks in Chunked, including the Cartographer’s', () => {
    const log = [
      entry(0, 'UNLOCK', 'Unlocked Lumbridge Swamp (50,49)', { item: '50,49', category: 'Chunks' }),
      entry(1, 'ALTAR', 'Cartographer charted (51,50)', { ritual: 'CARTOGRAPHER', chunk: '51,50' }),
    ];
    const t = buildFilmTimeline(log, { chunked: true, finalRegions: [], finalChunks: ['50,49', '51,50'] });
    expect(t.start).toEqual(['50,50']);
    expect(t.steps[0].added).toEqual(['50,49']);
    expect(t.steps[1].added).toEqual(['51,50']);
    expect(t.steps).toHaveLength(2);
  });

  it('raises skill and gear tiers as they are unlocked, ending on the run’s tiers now', () => {
    const skill = (day: number, name: string) => entry(day, 'UNLOCK', `Unlocked ${name}`, { item: name, category: 'Skills' });
    const gear = (day: number, slot: string) => entry(day, 'UNLOCK', `Unlocked ${slot}`, { item: slot, category: 'Equipment' });
    const log = [skill(0, 'Attack'), gear(1, 'Legs'), skill(2, 'Attack'), skill(2, 'Hitpoints')];
    const t = buildFilmTimeline(log, {
      ...vanilla,
      // Attack 3 now but the log shows only 2: it started at 1. The log never
      // shows the Ring's tiers, so the run had them from the start. Hitpoints is free.
      finalSkills: { Attack: 3, Hitpoints: 10 },
      finalGear: { Legs: 1, Ring: 2 },
    });
    expect(t.opening.skills).toMatchObject({ Attack: 1, Hitpoints: 10, Mining: 0 });
    expect(t.opening.gear).toMatchObject({ Legs: 0, Ring: 2 });
    expect(t.steps[0]).toMatchObject({ raised: ['skill:Attack'], skills: { Attack: 2 } });
    expect(t.steps[0].ticker[0].text).toBe('Attack II');
    expect(t.steps[1]).toMatchObject({ raised: ['gear:Legs'], gear: { Legs: 1 } });
    expect(t.steps[2].skills.Attack).toBe(3);
    expect(t.steps[3].skills.Hitpoints).toBe(10);
    expect(t.steps[3].raised).toEqual([]);
    expect(t.steps).toHaveLength(4);
    expect(t.steps[3]).toMatchObject({ skills: { Attack: 3 }, gear: { Legs: 1, Ring: 2 } });
  });

  it('makes no steps for an empty log', () => {
    expect(buildFilmTimeline([], vanilla).steps).toEqual([]);
  });
});

describe('film layout', () => {
  it('fits the whole map inside the frame for both shapes', () => {
    for (const shape of ['wide', 'tall'] as const) {
      const l = filmLayout(shape);
      expect(l.map.x + l.map.w).toBeLessThanOrEqual(l.width);
      expect(l.map.y + l.map.h).toBeLessThanOrEqual(l.height);
      const nw = chunkRect('15,65', l.map);
      expect(nw.x).toBeCloseTo(l.map.x);
      expect(nw.y).toBeCloseTo(l.map.y);
      const se = chunkRect('62,32', l.map);
      expect(se.x + se.w).toBeCloseTo(l.map.x + l.map.w);
      expect(se.y + se.h).toBeCloseTo(l.map.y + l.map.h);
    }
  });
});
