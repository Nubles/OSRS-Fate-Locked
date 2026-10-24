// @vitest-environment jsdom
import React from 'react';
// @ts-expect-error Node types are intentionally excluded from the browser app.
import { readFileSync } from 'node:fs';
// @ts-expect-error Node types are intentionally excluded from the browser app.
import { resolve } from 'node:path';
import { act, cleanup, render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QUEST_DATA } from '../data/questData';
import type { UnlockState } from '../types';
import { evaluateQuestEligibility } from '../utils/journalStatus';
import { QuestCard } from './QuestLog';
import { QuestCompleteOverlay } from './QuestCompleteOverlay';

// The celebration reads the quest's roll from the game; no roll has landed here.
vi.mock('../context/GameContext', async importOriginal => ({
  ...(await importOriginal<typeof import('../context/GameContext')>()),
  useGame: () => ({ lastEvent: null }),
}));

// Completing a quest on a long run froze the classic Journal for 2-3 s at 4x
// CPU. Nearly all of it was the browser restyling the page, not our code:
// - the finished quest's card moves in the list, and the sibling rules every
//   list carries (space-y, divide, "* + *") make the browser restyle every
//   card after it, about 17,000 elements;
// - the celebration mounted, then removed, its own <style> of keyframes, and a
//   stylesheet change restyles the page again.
// These tests pin the two fixes.

const styles = readFileSync(resolve('styles.css'), 'utf8');
const rule = (selector: string) => {
  const start = styles.indexOf(`${selector} {`);
  return start < 0 ? '' : styles.slice(start, styles.indexOf('}', start) + 1);
};

const unlocks: UnlockState = {
  equipment: {}, skills: {}, levels: {},
  regions: [], mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
  bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
  quests: [], diaries: [], cas: [], completedTasks: [], collectionLog: {},
};

afterEach(cleanup);

describe('classic quest cards skip restyling while off screen', () => {
  it('gives every quest card the journal-card class', () => {
    const quest = QUEST_DATA["Cook's Assistant"];
    const eligibility = evaluateQuestEligibility(quest, unlocks, 'vanilla');
    const html = renderToStaticMarkup(<QuestCard quest={{ ...quest, status: eligibility.status, eligibility }}
      unlocks={unlocks} gameModeId="vanilla" currentQP={0} onToggle={vi.fn()} />);
    const root = new DOMParser().parseFromString(html, 'text/html').body.firstElementChild!;
    expect(root.getAttribute('data-journal-id')).toBe("Cook's Assistant");
    expect(root.classList.contains('journal-card')).toBe(true);
  });

  it('lets the browser skip off-screen cards and remember their height', () => {
    expect(rule('.journal-card')).toMatch(/content-visibility:\s*auto;/);
    // `auto` keeps a card's real height once drawn, so the scrollbar and jump
    // targets stay put; without a size every unseen card would count as 0 px.
    expect(rule('.journal-card')).toMatch(/contain-intrinsic-size:\s*auto \d+px;/);
  });
});

describe('quest-complete celebration', () => {
  it('mounts no stylesheet of its own', () => {
    render(<QuestCompleteOverlay />);
    act(() => {
      window.dispatchEvent(new CustomEvent('fate:quest-complete', { detail: { name: "Cook's Assistant" } }));
    });
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.querySelectorAll('style')).toHaveLength(0);
  });

  it('finds its keyframes in the global stylesheet', () => {
    const source = readFileSync(resolve('components/QuestCompleteOverlay.tsx'), 'utf8');
    for (const name of ['qc-pop', 'qc-spark', 'qc-glow']) {
      expect(source).toContain(name);
      expect(styles).toContain(`@keyframes ${name} {`);
    }
  });
});
