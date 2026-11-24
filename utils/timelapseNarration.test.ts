import { describe, expect, it } from 'vitest';
import { TableType, type LogEntry } from '../types';
import { tableDisplayName } from './tableDisplay';
import { BANK_BY_ID, BANK_IDS } from '../data/banks';
import { detectMilestones, narrate, timelapseBarsFit } from './timelapseNarration';

const rollSuccess = (
  over: Partial<LogEntry> = {},
): LogEntry => ({
  id: 'roll',
  timestamp: 1,
  type: 'ROLL_SUCCESS',
  source: 'Attack Level 41',
  message: 'Key Found!',
  ...over,
});

describe('timelapse milestones', () => {
  it('labels start-area milestone Keys without naming a retired mode', () => {
    // Chunked's start-chunk Keys use the XTREME_MILESTONE entry type too.
    const milestones = detectMilestones([
      { id: 'start', timestamp: 1, type: 'LEVEL_UP', message: 'Attack level 2' },
      { id: 'chunk-key', timestamp: 2, type: 'XTREME_MILESTONE', message: 'Chunked milestone: Total Level 50 gives a guaranteed Key.' },
    ]);
    expect(milestones.find(m => m.index === 1)?.label).toBe('Start-area milestone Key');
    expect(milestones.map(m => m.label).join(' ')).not.toContain('Xtreme');
  });
});

describe('timelapse roll narration', () => {
  it('formats decimal roll values and thresholds with the shared precision', () => {
    expect(narrate(rollSuccess({ rollValue: 42.1, threshold: 8.2 })))
      .toBe('Attack Level 41 yields a key. 42.1 vs 8.2%.');
  });

  it('keeps one decimal place for integer roll values and thresholds', () => {
    expect(narrate(rollSuccess({ rollValue: 42, threshold: 8 })))
      .toBe('Attack Level 41 yields a key. 42.0 vs 8.0%.');
  });

  it('preserves question marks for legacy missing roll fields', () => {
    expect(narrate(rollSuccess()))
      .toBe('Attack Level 41 yields a key. ? vs ?.');
  });
});

describe('timelapseBarsFit', () => {
  it('gives every entry its own bar while the strip is wide enough', () => {
    // 1,392px: the strip on a 1440px screen.
    expect(timelapseBarsFit(60, 1392)).toBe(true);
    expect(timelapseBarsFit(464, 1392)).toBe(true);
  });

  it('packs the bars once a run is too long for the strip', () => {
    expect(timelapseBarsFit(465, 1392)).toBe(false);
    // A real run of 1,219 entries, on a desktop and on a 390px phone.
    expect(timelapseBarsFit(1219, 1392)).toBe(false);
    expect(timelapseBarsFit(1219, 342)).toBe(false);
    expect(timelapseBarsFit(115, 342)).toBe(false);
    expect(timelapseBarsFit(114, 342)).toBe(true);
  });

  it('keeps the spaced bars until the strip has been measured', () => {
    expect(timelapseBarsFit(5000, 0)).toBe(true);
  });
});

describe('timelapse pity narration', () => {
  const pity = (meta?: Record<string, unknown>): LogEntry => ({
    id: 'pity', timestamp: 1, type: 'PITY', message: 'MAX FATE REACHED! Pity Key granted.', result: 'SUCCESS',
    ...(meta ? { meta } : {}),
  });

  it("names the entry's own pity threshold", () => {
    // A legacy Casual run's Pity Key came at 30 Fate, not 50.
    expect(narrate(pity({ fateGained: 1, pityThreshold: 30 })))
      .toBe('Fate, grown heavy at 30, tips the scales. A key regardless.');
    expect(narrate(pity({ pityThreshold: 50 })))
      .toBe('Fate, grown heavy at 50, tips the scales. A key regardless.');
  });

  it('leaves the number out for an older entry that does not record one', () => {
    expect(narrate(pity())).toBe('Fate, grown heavy, tips the scales. A key regardless.');
    expect(narrate(pity({ fateGained: 1 }))).toBe('Fate, grown heavy, tips the scales. A key regardless.');
    expect(narrate(pity({ pityThreshold: 'lots' }))).toBe('Fate, grown heavy, tips the scales. A key regardless.');
    expect(narrate(pity({ pityThreshold: 0 }))).toBe('Fate, grown heavy, tips the scales. A key regardless.');
  });
});

describe('timelapse unlock narration', () => {
  const unlock = (category?: string): LogEntry => ({
    id: 'unlock', timestamp: 1, type: 'UNLOCK', message: 'Unlocked Zulrah',
    meta: { item: 'Zulrah', cost: 1, costType: 'key', ...(category === undefined ? {} : { category }) },
  });

  it.each(Object.values(TableType))('reads as a sentence for the %s table', table => {
    const line = narrate(unlock(table));
    expect(line).toBe(`Zulrah is unlocked under ${tableDisplayName(table)}.`);
    expect(line).not.toMatch(/bows open|a new|—/);
  });

  it('uses the names players see on Spend Keys', () => {
    expect(narrate(unlock(TableType.REGIONS))).toBe('Zulrah is unlocked under Areas.');
    expect(narrate(unlock(TableType.ARCANA))).toBe('Zulrah is unlocked under Combat Powers.');
    expect(narrate(unlock(TableType.FARMING_LAYERS))).toBe('Zulrah is unlocked under Farming.');
    expect(narrate(unlock(TableType.BOSSES))).toBe('Zulrah is unlocked under Bosses.');
  });

  it('names a chunk and a bank the way the History card does', () => {
    // Chunks are stored by key and banks by chunk id, in old saves and new.
    const chunk: LogEntry = {
      id: 'c', timestamp: 1, type: 'UNLOCK', message: 'Unlocked Lumbridge (49, 50)',
      meta: { item: '49,50', category: TableType.CHUNKS, cost: 1 },
    };
    expect(narrate(chunk)).toBe('Lumbridge (49, 50) is unlocked under Chunks.');
    const rift: LogEntry = { ...chunk, message: 'Unlocked Lumbridge (49, 50) · Rift', meta: { ...chunk.meta, cost: 0, costType: 'rift' } };
    expect(narrate(rift)).toBe('Lumbridge (49, 50) is unlocked under Chunks.');
    const bankId = BANK_IDS[0];
    const bankName = BANK_BY_ID[bankId].name;
    expect(bankName).not.toBe(bankId);
    const bank: LogEntry = {
      id: 'b', timestamp: 1, type: 'UNLOCK', message: `Unlocked ${bankName}`,
      meta: { item: bankId, category: TableType.BANKS, cost: 1 },
    };
    expect(narrate(bank)).toBe(`${bankName} is unlocked under Banks.`);
    expect(detectMilestones([chunk]).map(m => m.label)).toContain('First unlock: Lumbridge (49, 50)');
    expect(detectMilestones([bank]).map(m => m.label)).toContain(`First unlock: ${bankName}`);
  });

  it('keeps an unknown bank id or an odd chunk item as written', () => {
    expect(narrate({ id: 'b', timestamp: 1, type: 'UNLOCK', message: 'Unlocked', meta: { item: 'no-such-bank', category: TableType.BANKS } }))
      .toBe('no-such-bank is unlocked under Banks.');
    expect(narrate({ id: 'c', timestamp: 1, type: 'UNLOCK', message: 'Unlocked', meta: { item: 'Somewhere', category: TableType.CHUNKS } }))
      .toBe('Somewhere is unlocked under Chunks.');
  });

  it('still reads for an entry with no table', () => {
    expect(narrate(unlock())).toBe('Zulrah is unlocked.');
    expect(narrate({ id: 'u', timestamp: 1, type: 'UNLOCK', message: 'Unlocked' })).toBe('Something new is unlocked.');
  });
});

describe('timelapse altar narration', () => {
  const altar = (message: string): LogEntry => ({ id: 'altar', timestamp: 1, type: 'ALTAR', message });

  it("keeps the message's capitals and ends with one mark", () => {
    expect(narrate(altar('Void Gambit lost.'))).toBe('The altar flares: Void Gambit lost.');
    expect(narrate(altar('Void Gambit WON: 3 Keys!'))).toBe('The altar flares: Void Gambit WON: 3 Keys!');
    expect(narrate(altar("Saradomin's Ward"))).toBe("The altar flares: Saradomin's Ward.");
    expect(narrate(altar('Ritual of Clarity'))).toBe('The altar flares: Ritual of Clarity.');
    expect(narrate(altar('Cartographer charted Lumbridge (50,50)'))).toBe('The altar flares: Cartographer charted Lumbridge (50,50).');
  });

  it('still reads for an empty message', () => {
    expect(narrate(altar(''))).toBe('The altar flares.');
    expect(narrate(altar('  '))).toBe('The altar flares.');
  });
});
