import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameProvider } from '../context/GameContext';
import { ReferenceModal } from './ReferenceModal';

type CodexTab = 'core' | 'economy' | 'drops' | 'unlocks';

const renderCodex = (tab: CodexTab, gameModeId = 'vanilla') => {
  const save = JSON.stringify({ gameModeId });
  vi.stubGlobal('localStorage', {
    getItem: () => save,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
  });

  return renderToStaticMarkup(
    <GameProvider storageKey="reference-modal-test">
      <ReferenceModal onClose={() => undefined} {...({ initialTab: tab } as {})} />
    </GameProvider>,
  );
};

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe('ReferenceModal Vanilla policy', () => {
  it('explains weighted failure Fate, Chaos milestones, and pity overflow', () => {
    const drops = renderCodex('drops');
    const economy = renderCodex('economy');
    const core = renderCodex('core');

    expect(drops).toContain('Levels 2-19: +1 Fate');
    expect(drops).toContain('Levels 20-79: +2 Fate');
    expect(drops).toContain('Levels 80-99: +3 Fate');
    expect(drops).toContain('30, 40, 50, 60, 70, 80, 90, 99');
    expect(drops).toContain('separate 2% Chaos chance on every level');
    expect(drops).toContain('overflow carries forward');
    expect(drops).toContain('Combat Achievements: Easy / Medium: +1 Fate; Hard / Elite: +2 Fate; Master / GM: +3 Fate.');
    expect(core).toContain('Failed rolls award +1 to +3 Fate by difficulty.');
    expect(economy).toContain('you would gain +3 Fate');
    expect(economy).toContain('Pity conversions keep any Fate overflow.');
    expect(core).not.toContain('Each failed roll adds 1 Fate Point.');
    expect(economy).not.toContain('Earned +1 per failed roll');
    expect(economy).not.toContain('reset to 0 the moment you get any Key');
    expect(economy).not.toContain("you'd gain a Fate Point");
  });

  it('documents the finite reserve, schedules, access safety valve, and scattered named areas in their existing tabs', () => {
    const economy = renderCodex('economy');
    const drops = renderCodex('drops');
    const unlocks = renderCodex('unlocks');

    expect(economy).toContain('118 finite boss safety-reserve Standard Keys');
    expect(drops).toContain('Brutus: 10% (1 key)');
    expect(drops).toContain('Low: 15% (1 key)');
    expect(drops).toContain('Mid: 30% → 15% (2 keys)');
    expect(drops).toContain('High: 50% → 25% (2 keys)');
    expect(drops).toContain('Raid: 65% → 32.5% → 16.25% (3 keys)');
    expect(drops).toContain('25% → 15% → 10%');
    expect(unlocks).toContain('Standard and Chaos random unlocks respect hard location access');
    expect(unlocks).toContain('empty eligible pool means no unlock occurs');
    expect(unlocks).toContain('Omni-Key direct unlocks bypass that filter with a warning');
    expect(unlocks).toContain('Vanilla named-area rolls can be scattered');
    expect(unlocks).toContain('Only Chunked mode enforces adjacent expansion');
  });

  it('labels the Vanilla policy as inactive outside Vanilla', () => {
    expect(renderCodex('economy', 'chunked')).toContain('Vanilla-only (not active for this run)');
  });
});
