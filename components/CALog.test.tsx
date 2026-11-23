// @vitest-environment jsdom
import React from 'react';
import { render, renderHook, screen, fireEvent, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { CALog, useCAJournal } from './CALog';
import { ALL_CA_TASKS } from '../data/caTasks';
const game = vi.hoisted(() => ({ unlocks: { cas: [] as string[], completedTasks: [] as string[], bosses: [] }, advisorsEnabled: false, completeCATask: vi.fn(), completeCATier: vi.fn() }));
vi.mock('../context/GameContext', () => ({ useGame: () => game }));
vi.mock('./JournalInsights', () => ({ CAInsights: () => null }));
vi.mock('./EntityLocations', () => ({ EntityLocations: () => null }));
vi.mock('./WikiLink', () => ({ WikiLink: () => null }));
beforeEach(() => {
  const data: Record<string, string> = {};
  vi.stubGlobal('localStorage', { getItem: (key: string) => data[key] ?? null, setItem: (key: string, value: string) => { data[key] = value; } });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); game.unlocks.cas = []; game.unlocks.completedTasks = []; });
describe('CA reward filters', () => {
  it('shows no available rewards and six locked tiers at zero points', () => {
    render(<CALog />);
    fireEvent.click(screen.getByRole('button', { name: /Available\s*0/i }));
    expect(screen.queryByText('Easy Tier')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Locked\s*6/i }));
    expect(screen.getByText('Easy Tier')).toBeTruthy();
    expect(screen.getByText('Grandmaster Tier')).toBeTruthy();
  });
  it('separates an earned but unrecorded reward from locked and completed rewards', () => {
    game.unlocks.completedTasks = ALL_CA_TASKS.filter(t => t.tierId === 'Easy').map(t => t.id);
    const view = render(<CALog />);
    fireEvent.click(screen.getByRole('button', { name: /Available\s*1/i }));
    expect(screen.getByText('Easy Tier')).toBeTruthy();
    expect(screen.queryByText('Medium Tier')).toBeNull();
    game.unlocks.cas = ['Easy'];
    view.rerender(<CALog />);
    expect(screen.queryByText('Easy Tier')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Done\s*1/i }));
    expect(screen.getByText('Easy Tier')).toBeTruthy();
  });
});

describe('CA search', () => {
  it("finds a task by its own name, the row's text, ignoring case and apostrophes", () => {
    for (const term of ['Noxious Foe', 'noxious foe', 'barrows novice']) {
      const { result } = renderHook(() => useCAJournal(term));
      expect(result.current.filteredCAs.map(ca => ca.id)).toEqual(['Easy']);
    }
    const defence = ALL_CA_TASKS.find(task => task.name?.includes("'"))!;
    const { result } = renderHook(() => useCAJournal(defence.name!.replace(/'/g, '')));
    expect(result.current.filteredCAs.map(ca => ca.id)).toContain(defence.tierId);
  });

  it('still finds a tier by its name, a boss and a task text', () => {
    expect(renderHook(() => useCAJournal('Elite')).result.current.filteredCAs.map(ca => ca.id)).toContain('Elite');
    expect(renderHook(() => useCAJournal('Aberrant Spectre')).result.current.filteredCAs.map(ca => ca.id)).toContain('Easy');
    expect(renderHook(() => useCAJournal('Open the Barrows chest 10 times')).result.current.filteredCAs.map(ca => ca.id)).toEqual(['Easy']);
  });
});
