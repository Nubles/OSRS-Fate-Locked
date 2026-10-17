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
});
