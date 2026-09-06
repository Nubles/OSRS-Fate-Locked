// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UnlockState } from '../../types';
import { QuestItemSources } from './QuestItemSources';

vi.mock('./sourceClauses', () => ({ getSourceClauseInterpretation: () => ({
  structure: 'choice', routes: [
    { id: 'egg', label: 'Egg route', items: [{ name: 'Egg', quantity: 2, availability: 'required' }] },
    { id: 'milk', label: 'Milk route', items: [{ name: 'Bucket of milk', quantity: null, availability: 'conditional' }] },
  ], references: [], unresolved: [], source: { page: "Cook's Assistant", revisionId: 123 },
}) }));
afterEach(cleanup);
const unlocks: UnlockState = { equipment: {}, skills: {}, levels: {}, regions: [], chunks: ['50,54'], mobility: [], arcana: [], housing: [],
  merchants: [], minigames: [], bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [], quests: [], diaries: [], cas: [], completedTasks: [], collectionLog: {} };

describe('quest item source alternatives', () => {
  it('keeps complete alternatives separate and defers candidate lookup until the item is opened', async () => {
    const user = userEvent.setup();
    const lookup = vi.fn((name: string) => [{ itemName: name, kind: 'shop' as const, hostName: 'Example shop', cx: 50, cy: 54,
      rawRequirements: [{ raw: 'Use the General Stores', origin: 'ENTITY' as const }] }]);
    const { container } = render(<QuestItemSources questId="example" clauseIndex={0} label="example" unlocks={unlocks} mode="chunked"
      provider={{ ready: true, itemSourceRecords: lookup }} />);
    expect(lookup).not.toHaveBeenCalled();
    await user.click(screen.getByText('Check source access'));
    await screen.findByText('Choose one complete alternative below.');
    expect(screen.getByText('Egg route')).toBeTruthy();
    expect(screen.getByText('Milk route')).toBeTruthy();
    expect(screen.getByText(/Quantity: see the full requirement above/)).toBeTruthy();
    expect(lookup).not.toHaveBeenCalled();
    await user.click(screen.getByText('Sources for Egg'));
    await user.click(await screen.findByRole('button', { name: 'Example shop' }));
    await user.click(screen.getByRole('checkbox', { name: 'Show locked locations' }));
    await user.click(screen.getByText('Location details'));
    await screen.findByText('Unlock: General Stores');
    expect(lookup).toHaveBeenCalledWith('Egg');
    expect(lookup).not.toHaveBeenCalledWith('Bucket of milk');
    expect(container.querySelector('.rp-access-source.rp-access-locked')).not.toBeNull();
    expect(container.querySelector('.rp-access-source.rp-access-met')).toBeNull();
    expect(screen.getByRole('img', { name: 'Example shop source locations' }).querySelector('rect')?.getAttribute('stroke')).toBe('#f87171');
    expect(screen.queryByText('Requirement met')).toBeNull();
  });
  it('groups duplicate NPC records and maps all accessible chunks without admitting known gates', async () => {
    const user = userEvent.setup();
    const record = (cx: number, cy: number, gated = false) => ({ itemName: 'Egg', kind: 'monster' as const, hostName: 'Imp', cx, cy,
      rawRequirements: gated ? [{ raw: 'Use the General Stores', origin: 'ENTITY' as const }] : [] });
    const { container } = render(<QuestItemSources questId="example" clauseIndex={0} label="example"
      unlocks={{ ...unlocks, chunks: ['50,54', '50,53', '49,53'] }} mode="chunked"
      provider={{ ready: true, itemSourceRecords: () => [record(50,54), record(50,54), record(50,53), record(49,53,true), record(48,53)] }} />);
    await user.click(screen.getByText('Check source access'));
    await user.click(await screen.findByText('Sources for Egg'));
    const imp = await screen.findByRole('button', { name: 'Imp' });
    expect(screen.getAllByRole('button', { name: 'Imp' })).toHaveLength(1);
    await user.click(imp);
    const map = screen.getByRole('img', { name: 'Imp source locations' });
    expect(map.querySelectorAll('rect')).toHaveLength(2);
    expect([...map.querySelectorAll('rect')].every(rect => rect.getAttribute('stroke') === '#67e8f9')).toBe(true);
    await user.click(screen.getByRole('checkbox', { name: 'Show locked locations' }));
    expect(map.querySelectorAll('rect')).toHaveLength(4);
    expect(map.querySelectorAll('rect[stroke="#f87171"]')).toHaveLength(2);
    expect(container.querySelector('.rp-access-source.rp-access-met')).toBeNull();
  });

});

