// @vitest-environment jsdom
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { EntryDetail } from './OsrsHistory';
import { TableType, type LogEntry } from '../../types';

afterEach(cleanup);

const unlock = (meta: Record<string, unknown>, details?: string): LogEntry => ({
  id: 'e', timestamp: 0, type: 'UNLOCK', message: 'Unlocked Attack tier 2 · Fate\'s Mercy', details,
  meta: { item: 'Attack', category: TableType.SKILLS, ...meta },
});

describe('History entry detail', () => {
  it("says a Fate's Mercy or Breakthrough unlock was free, not paid with 0 Keys", () => {
    const mercy = render(<EntryDetail entry={unlock({ cost: 0, costType: 'mercy' }, "Fate's Mercy: fate drew this from 18 entries.")} num={1} total={1} />);
    expect(mercy.container.textContent).toContain("Nothing: Fate's Mercy");
    expect(mercy.container.textContent).toContain('fate drew this from 18 entries');
    expect(mercy.container.textContent).not.toContain('0 Keys');
    mercy.unmount();
    const breakthrough = render(<EntryDetail entry={unlock({ cost: 0, costType: 'breakthrough' })} num={1} total={1} />);
    expect(breakthrough.container.textContent).toContain('Nothing: a Breakthrough');
    breakthrough.unmount();
    const key = render(<EntryDetail entry={unlock({ cost: 1, costType: 'key' })} num={1} total={1} />);
    expect(key.container.textContent).toContain('1 Key');
  });

  it('says a Rift chunk was free and keeps its details, from the meta fateLand stores (chunked-fate.d3[2])', () => {
    // The exact entry utils/fateLand.ts writes for a Rift's second chunk.
    const rift: LogEntry = {
      id: 'r', timestamp: 0, type: 'UNLOCK', message: 'Unlocked Draynor Village (48, 51) · Rift',
      details: 'A Rift: fate drew a second chunk. Nothing was spent.',
      meta: { item: '48,51', category: TableType.CHUNKS, cost: 0, costType: 'rift' },
    };
    const { container } = render(<EntryDetail entry={rift} num={1} total={1} />);
    expect(container.textContent).toContain('Paid withNothing: a Rift');
    expect(container.textContent).toContain('A Rift: fate drew a second chunk. Nothing was spent.');
    expect(container.textContent).not.toContain('0 Keys');
  });
});
