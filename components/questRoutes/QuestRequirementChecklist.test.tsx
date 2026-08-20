// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuestRequirementChecklist } from './QuestRequirementChecklist';

afterEach(cleanup);

const rows = [
  {
    id: 'skill:Mining',
    label: 'Mining',
    detail: 'Level 15',
    statusText: 'Updates automatically',
    mode: 'ACCOUNT' as const,
    checked: true,
    disabled: true,
  },
  {
    id: 'region:Asgarnia',
    label: 'Asgarnia',
    statusText: 'Updates automatically',
    mode: 'ACCOUNT' as const,
    checked: false,
    disabled: true,
  },
  {
    id: 'manual:inventory',
    label: 'Inventory space',
    statusText: 'Confirm elsewhere',
    mode: 'MANUAL_GATE' as const,
    checked: false,
    disabled: true,
  },
  {
    id: 'item:clay',
    label: '6 Clay',
    statusText: 'Confirm possession',
    mode: 'MANUAL_ITEM' as const,
    checked: false,
    disabled: false,
    itemKey: 'clay',
  },
  {
    id: 'item:hammer',
    label: '1 Hammer',
    statusText: 'Provided during quest',
    mode: 'QUEST_PROVIDED' as const,
    checked: true,
    disabled: true,
    itemKey: 'hammer',
  },
];

describe('QuestRequirementChecklist', () => {
  it('renders clear row-mode state and instructions with native semantics', () => {
    render(
      <QuestRequirementChecklist
        questId="Doric's Quest"
        rows={rows}
        onSetItemConfirmed={() => undefined}
      />,
    );
    expect(screen.getByRole('region', { name: 'Quest requirements' })).toBeTruthy();
    const mining = screen.getByRole('checkbox', {
      name: 'Mining Level 15', description: 'Met Updates automatically',
    }) as HTMLInputElement;
    const region = screen.getByRole('checkbox', {
      name: 'Asgarnia', description: 'Not met Updates automatically',
    }) as HTMLInputElement;
    const clay = screen.getByRole('checkbox', {
      name: '6 Clay', description: 'Not obtained Confirm possession',
    }) as HTMLInputElement;
    expect(mining.disabled).toBe(true);
    expect(mining.checked).toBe(true);
    expect(region.disabled).toBe(true);
    expect(region.checked).toBe(false);
    expect(clay.disabled).toBe(false);
    expect(screen.getByRole('checkbox', {
      name: 'Inventory space', description: 'Needs confirmation Confirm elsewhere',
    })).toBeTruthy();
    expect(screen.getByRole('checkbox', {
      name: '1 Hammer', description: 'Obtained Provided during quest',
    })).toBeTruthy();
    expect(screen.getByText('2 / 5 satisfied')).toBeTruthy();
    expect(screen.getByText('Skills, quests, access, and other account requirements update automatically. Confirm item possession manually.')).toBeTruthy();
  });

  it('emits the canonical quest, item key, and next checked state', async () => {
    const onSetItemConfirmed = vi.fn();
    render(
      <QuestRequirementChecklist
        questId="Doric's Quest"
        rows={rows}
        onSetItemConfirmed={onSetItemConfirmed}
      />,
    );
    await userEvent.click(screen.getByRole('checkbox', { name: '6 Clay' }));
    expect(onSetItemConfirmed).toHaveBeenCalledWith("Doric's Quest", 'clay', true);
  });
});
