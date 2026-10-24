import { describe, expect, it } from 'vitest';
import {
  CHUNK_PX, chunkBox, fogPath, fogState, markLine, outlineEdges, spinHopTimes, spinHops, spinWindow, THREAD_LEANING_LINE, threadLine, threadStart,
} from './fateMap';

describe('the fate map geometry', () => {
  it('puts a chunk at ((cx-15)*192, (65-cy)*192) on the world map image', () => {
    expect(chunkBox('50,50')).toEqual({ x: 35 * CHUNK_PX, y: 15 * CHUNK_PX });
    expect(chunkBox('15,65')).toEqual({ x: 0, y: 0 });
  });

  it('fogs land the run neither holds nor has on its frontier', () => {
    const held = new Set(['50,50']);
    const frontier = new Set(['51,50']);
    expect(fogState('50,50', held, frontier)).toBe('held');
    expect(fogState('51,50', held, frontier)).toBe('frontier');
    expect(fogState('52,50', held, frontier)).toBe('fog');
  });

  it('cuts one hole in the fog per clear chunk, duplicates once', () => {
    const d = fogPath(['50,50', '51,50', '50,50'], 100, 50);
    expect(d.startsWith('M0 0H100V50H0Z')).toBe(true);
    expect(d.match(/M/g)).toHaveLength(3);
    expect(d).toContain(`M${35 * CHUNK_PX} ${15 * CHUNK_PX}h192v192h-192Z`);
  });

  it('outlines a set of chunks on its outside edges only', () => {
    expect(outlineEdges(new Set(['50,50']))).toHaveLength(4);
    // Two chunks side by side share one edge: 6 outside edges.
    expect(outlineEdges(new Set(['50,50', '51,50']))).toHaveLength(6);
  });

  it('starts the thread at the held chunk nearest it, ties to the first key', () => {
    expect(threadStart(['50,50', '51,50', '49,50'], '55,51')).toBe('51,50');
    expect(threadStart(['50,51', '51,50'], '51,51')).toBe('50,51');
    expect(threadStart([], '55,51')).toBeUndefined();
  });

  it('names the thread and the marks in the words the map shows', () => {
    expect(threadLine('the Barrows')).toBe("Fate's Thread: the Barrows. One Chunks Key draw in six goes to the frontier chunks nearest it.");
    expect(markLine('CURSED')).toBe("Fate's omen: Cursed, a bane");
    expect(markLine('FORTUNATE')).toBe("Fate's omen: Fortunate, a boon");
    expect(THREAD_LEANING_LINE).toBe("Nearest Fate's Thread: 1 in 6 Chunks draws go to these");
    for (const line of [threadLine('the Barrows'), THREAD_LEANING_LINE]) expect(line).not.toMatch(/x2|twice/i);
  });
});

describe('the Chunks Key spin', () => {
  const held = new Set(['49,50', '50,50', '50,51']);
  const frontier = new Set(['51,50', '51,51', '48,50', '50,52', '49,51', '50,49']);

  it('centres its window on the drawn chunk, with the run as it was before the draw', () => {
    const w = spinWindow('51,51', held, frontier, new Set(['52,51', '51,52']));
    expect(w.cx0).toBe(48);
    expect(w.cyTop).toBe(53);
    expect(w.cells).toHaveLength(35);
    expect(w.drawn).toEqual({ col: 3, row: 2 });
    const at = (key: string) => w.cells.find(c => c.key === key)!;
    expect(at('51,51')).toMatchObject({ drawn: true, state: 'frontier', col: 3, row: 2 });
    expect(at('50,50').state).toBe('held');
    expect(at('51,50').state).toBe('frontier');
    expect(at('54,49').state).toBe('fog');
    expect(at('52,51')).toMatchObject({ state: 'fog', newFrontier: true });
  });

  it('keeps its window on the map image at the edges', () => {
    expect(spinWindow('15,65', new Set(), new Set())).toMatchObject({ cx0: 15, cyTop: 65, drawn: { col: 0, row: 0 } });
    expect(spinWindow('62,32', new Set(), new Set())).toMatchObject({ cx0: 56, cyTop: 36, drawn: { col: 6, row: 4 } });
  });

  it('hops the frontier and lands on the drawn chunk, never twice running on one cell', () => {
    let seed = 7;
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const pool = ['51,50', '48,50', '50,52', '49,51'];
    for (let n = 2; n < 14; n++) {
      const path = spinHops(pool, '51,51', n, rand);
      expect(path).toHaveLength(n);
      expect(path[path.length - 1]).toBe('51,51');
      expect(path[path.length - 2]).not.toBe('51,51');
      for (let i = 1; i < path.length; i++) expect(path[i]).not.toBe(path[i - 1]);
      for (const key of path) expect([...pool, '51,51']).toContain(key);
    }
  });

  it('lands at once when the drawn chunk is the only frontier in view', () => {
    expect(spinHops([], '51,51', 10, Math.random)).toEqual(['51,51']);
    expect(spinHops(['51,51'], '51,51', 10, Math.random)).toEqual(['51,51']);
  });

  it('slows its hops down and lands on time', () => {
    const t = spinHopTimes(10, 1500);
    expect(t).toHaveLength(10);
    expect(t[0]).toBe(0);
    expect(t[9]).toBe(1500);
    for (let i = 2; i < t.length; i++) expect(t[i] - t[i - 1]).toBeGreaterThanOrEqual(t[i - 1] - t[i - 2]);
    expect(spinHopTimes(1, 1500)).toEqual([0]);
  });
});
