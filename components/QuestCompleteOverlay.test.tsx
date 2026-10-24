// @vitest-environment jsdom

import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuestCompleteOverlay } from './QuestCompleteOverlay';

const game = vi.hoisted(() => ({
  lastEvent: null as null | { id: string; type: string; meta?: Record<string, unknown> },
}));

vi.mock('../context/GameContext', () => ({ useGame: () => game }));

afterEach(() => {
  cleanup();
  game.lastEvent = null;
});

// QuestLog completes the quest (which rolls), then announces it.
const completeQuestWithRoll = (
  rerender: (ui: React.ReactElement) => void,
  event: NonNullable<typeof game.lastEvent>,
) => {
  act(() => {
    window.dispatchEvent(new CustomEvent('fate:quest-complete', { detail: { name: "Cook's Assistant" } }));
    game.lastEvent = event;
    rerender(<QuestCompleteOverlay />);
  });
};

describe('QuestCompleteOverlay', () => {
  it("says a failed quest roll found no Key, never 'Reward unlocked'", () => {
    game.lastEvent = { id: 'earlier', type: 'ROLL_SUCCESS', meta: { standardKeysAwarded: 1 } };
    const { rerender } = render(<QuestCompleteOverlay />);
    completeQuestWithRoll(rerender, {
      id: 'quest-roll', type: 'ROLL_FAIL', meta: { fateBefore: 0, fateAfter: 1, pityThreshold: 50 },
    });
    // The wiki scroll can't load here, so this is the fallback card.
    fireEvent.error(screen.getByAltText("Cook's Assistant reward scroll"));

    expect(screen.getByText('No Key: +1 Fate (1/50)')).toBeTruthy();
    expect(screen.queryByText(/Reward unlocked/i)).toBeNull();
    expect(screen.queryByText('Key found!')).toBeNull();
    expect(screen.getByRole('dialog').getAttribute('aria-label')).toBe("Cook's Assistant complete. No Key: +1 Fate (1/50)");
  });

  it('names the Key a winning quest roll found', () => {
    const { rerender } = render(<QuestCompleteOverlay />);
    completeQuestWithRoll(rerender, { id: 'quest-roll', type: 'ROLL_OMNI', meta: { standardKeysAwarded: 1 } });
    expect(screen.getByText('Key and Omni-Key found!')).toBeTruthy();
  });

  it("doesn't show an earlier roll as the quest's", () => {
    game.lastEvent = { id: 'earlier', type: 'ROLL_SUCCESS', meta: { standardKeysAwarded: 1 } };
    const { rerender } = render(<QuestCompleteOverlay />);
    act(() => {
      window.dispatchEvent(new CustomEvent('fate:quest-complete', { detail: { name: "Cook's Assistant" } }));
    });
    rerender(<QuestCompleteOverlay />);
    expect(screen.getByText("Cook's Assistant")).toBeTruthy();
    expect(screen.queryByText('Key found!')).toBeNull();
  });
});
