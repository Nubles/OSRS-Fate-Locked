// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PendingUnlockReveal } from './PendingUnlockReveal';
import { TableType, type GameState, type PendingUnlock } from '../types';
import { FATE_MAP_PREF_KEYS } from '../utils/fateMapPrefs';

vi.mock('./FateDrawsMap', () => ({
  default: ({ chunk, onDone }: { chunk: string; onDone: () => void }) => <button type="button" onClick={onDone}>spin {chunk}</button>,
}));
vi.mock('./VoidReveal', () => ({
  VoidReveal: ({ itemName }: { itemName: string }) => <div>reveal {itemName}</div>,
}));

const unlocks = { chunks: ['50,51'] } as unknown as GameState['unlocks'];
const chunk: PendingUnlock = { id: 'r1', table: TableType.CHUNKS, item: '50,51', costType: 'key', cost: 1 };

afterEach(() => { cleanup(); localStorage.clear(); });

describe("fate's spin before a chunk's reveal", () => {
  it('plays for a Chunked chunk draw, then hands on to the reveal', async () => {
    render(<PendingUnlockReveal pending={chunk} animationsEnabled onAccept={() => {}} chunkedUnlocks={unlocks} />);
    const spin = await screen.findByText('spin 50,51', undefined, { timeout: 5000 });
    expect(screen.queryByText(/^reveal/)).toBeNull();
    act(() => { fireEvent.click(spin); });
    expect(screen.getByText(/^reveal /)).toBeTruthy();
  });

  it('plays for a Mercy or Chaos Key chunk too', async () => {
    render(<PendingUnlockReveal pending={{ ...chunk, costType: 'mercy', cost: 0 }} animationsEnabled onAccept={() => {}} chunkedUnlocks={unlocks} />);
    expect(await screen.findByText('spin 50,51', undefined, { timeout: 5000 })).toBeTruthy();
    cleanup();
    render(<PendingUnlockReveal pending={{ ...chunk, costType: 'chaosKey' }} animationsEnabled onAccept={() => {}} chunkedUnlocks={unlocks} />);
    expect(await screen.findByText('spin 50,51', undefined, { timeout: 5000 })).toBeTruthy();
  });

  it('is skipped with animations off, with its toggle off, outside Chunked and for other tables', () => {
    const cases = [
      <PendingUnlockReveal key="a" pending={chunk} animationsEnabled={false} onAccept={() => {}} chunkedUnlocks={unlocks} />,
      <PendingUnlockReveal key="b" pending={chunk} animationsEnabled onAccept={() => {}} />,
      <PendingUnlockReveal key="c" pending={{ ...chunk, table: TableType.SKILLS, item: 'Attack' }} animationsEnabled onAccept={() => {}} chunkedUnlocks={unlocks} />,
    ];
    for (const ui of cases) {
      render(ui);
      expect(screen.getByText(/^reveal /)).toBeTruthy();
      cleanup();
    }
    localStorage.setItem(FATE_MAP_PREF_KEYS.spin, 'off');
    render(<PendingUnlockReveal pending={chunk} animationsEnabled onAccept={() => {}} chunkedUnlocks={unlocks} />);
    expect(screen.getByText(/^reveal /)).toBeTruthy();
  });
});
