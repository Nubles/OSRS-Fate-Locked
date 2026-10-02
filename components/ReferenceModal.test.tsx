import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFreshState, GameProvider, prepareKeyRollAction } from '../context/GameContext';
import { ReferenceModal } from './ReferenceModal';
import { unlockableAreas } from '../utils/freeAreas';
import { MISTHALIN_AREAS } from '../constants';
import { CHUNKED_MILESTONE_INTERVAL, STARTING_KEYS } from '../config/economy';
import { GAME_MODES } from '../config/gameModes';
import { DropSource } from '../types';
import { DROP_RATES } from '../config/rules';

const CHUNKED_LAND = 'In Chunked, land only comes from Chunk unlocks and the Ritual of the Cartographer.';

/** The highest Omni die that still gives an Omni-Key: the chance the roll engine really uses. */
const engineOmniChance = (source: DropSource): number => {
  const state = { ...createFreshState(), gameModeId: 'vanilla' };
  for (let chance = 100; chance > 0; chance--) {
    // Die 0 is the Key roll (a success here); die 2 is the Omni roll.
    const dice = (_purpose: string, index = 0, max = 100) => index === 0 ? 1 : index === 2 ? chance : max;
    if (prepareKeyRollAction(state, source, 100, 1, dice).payload.omni) return chance;
  }
  return 0;
};

type CodexTab = 'core' | 'economy' | 'modes' | 'drops' | 'unlocks' | 'altar';

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

describe('ReferenceModal Core Rules', () => {
  it('says how many Keys a new run starts with', () => {
    expect(renderCodex('core')).toContain(`You start with ${STARTING_KEYS} Keys`);
  });
});

describe('ReferenceModal Omni-Keys', () => {
  it('says an Omni-Key comes on top of the Key, never that it upgrades one', () => {
    const core = renderCodex('core');
    const drops = renderCodex('drops');
    const economy = renderCodex('economy');
    const unlocks = renderCodex('unlocks');
    expect(core).toContain('to give a bonus Omni-Key as well as the Key');
    expect(drops).toContain('to give a bonus Omni-Key as well as the Key');
    expect(economy).toContain('Either way, you keep the Key.');
    expect(economy).toContain('A bonus on a successful roll, on top of the Key');
    expect(unlocks).toContain('You get them as a bonus on successful rolls, or for 5 Keys at the Void Altar.');
    for (const page of [core, drops, economy, unlocks]) {
      expect(page).not.toMatch(/upgrades? to an Omni|upgrading a successful roll|Rare upgrade|lucky upgrade|rolls for an upgrade|gacha/);
    }
  });

  it('says Omni-Keys cannot pick land in Chunked', () => {
    expect(renderCodex('core', 'chunked')).toContain(CHUNKED_LAND);
    expect(renderCodex('unlocks', 'chunked')).toContain(CHUNKED_LAND);
    expect(renderCodex('economy', 'chunked')).toContain(CHUNKED_LAND);
    expect(renderCodex('core')).not.toContain(CHUNKED_LAND);
  });

  it('shows the raised Omni-Key chances the roll engine uses', () => {
    const drops = renderCodex('drops');
    const raised: Array<[string, DropSource]> = [
      ['pet drops', DropSource.PET], ['Grandmaster quests', DropSource.QUEST_GRANDMASTER],
      ['raids', DropSource.RAID], ['Elite diaries', DropSource.DIARY_ELITE], ['high-tier bosses', DropSource.BOSS_HIGH],
    ];
    for (const [label, source] of raised) {
      expect(drops, label).toContain(`${label} <b>${engineOmniChance(source)}%</b>`);
    }
    expect(renderCodex('economy')).toContain(`or ${engineOmniChance(DropSource.QUEST_GRANDMASTER)}% for a Grandmaster quest`);
  });
});

describe('ReferenceModal Unlock Systems land', () => {
  it('describes the Chunked start chunk and frontier as the code builds them', () => {
    const unlocks = renderCodex('unlocks', 'chunked');
    expect(unlocks).toContain('each a square of 64 by 64 tiles');
    expect(unlocks).toContain('You start in one free chunk: central Lumbridge, with the castle, church and shops.');
    expect(unlocks).toContain('Fate picks a random chunk from the frontier');
    expect(unlocks).not.toMatch(/courtyard|random tile|granularity/);
  });
});

describe('ReferenceModal Smart Play', () => {
  it('says a success wipes Fate, and shows the rates and Omni-Key chances the code uses', () => {
    const economy = renderCodex('economy');
    expect(economy).toContain('Failed rolls give Fate, but any successful roll resets it to 0, so spend it first: 8 on Clarity before a big roll, or 25 on a Chaos Key.');
    expect(economy).toContain('Any successful roll resets them to 0, so spend them at the Void Altar before that.');
    expect(economy).not.toMatch(/banks Fate|save toward a Chaos Key|fuel for the Void Altar/);
    expect(economy).toContain(`Konar ${DROP_RATES[DropSource.SLAYER_KONAR]}%, Duradel ${DROP_RATES[DropSource.SLAYER_DURADEL]}%, boss tasks ${DROP_RATES[DropSource.SLAYER_BOSS]}%`);
    expect(economy).toContain(`a guaranteed Key and a ${engineOmniChance(DropSource.QUEST_GRANDMASTER)}% Omni-Key chance`);
    expect(economy).toContain(`Only pet drops (${engineOmniChance(DropSource.PET)}%) have a better Omni-Key chance.`);
    expect(economy).toContain(`Raids give ${engineOmniChance(DropSource.RAID)}%, Elite diaries ${engineOmniChance(DropSource.DIARY_ELITE)}% and high-tier bosses ${engineOmniChance(DropSource.BOSS_HIGH)}%.`);
  });

  it('prices the Gambit as a minimum stake and marks the Cartographer as Chunked only', () => {
    const economy = renderCodex('economy');
    expect(economy).toContain('All Fate (min 15)');
    expect(economy).toContain('Ritual of the Cartographer (Chunked only)');
  });
});

describe('ReferenceModal Game Modes', () => {
  it('says what differs between the modes instead of the retired rule knobs', () => {
    const modes = renderCodex('modes');
    const shared = GAME_MODES[0].rules;
    expect(modes).toContain('What Differs Between the Modes');
    expect(modes).toContain('you unlock named areas, and all of Misthalin is free from the start');
    expect(modes).toContain('roll at no less than 25%, 15% and 10%');
    expect(modes).toContain(`every ${CHUNKED_MILESTONE_INTERVAL} total levels gives a guaranteed Key`);
    expect(modes).toContain(`a Pity Key at ${shared.pityThreshold} Fate Points, a ${shared.omniChanceBase}% base Omni-Key chance`);
    expect(modes).toContain('Your mode is fixed as soon as you apply it.');
    expect(modes).not.toMatch(/Rule Knobs|Region Modifiers|Omni base|permanently locked|verified history/);
  });

  it('has no Region Bonuses tab', () => {
    expect(renderCodex('core')).not.toContain('Region Bonuses');
  });
});

describe('ReferenceModal Void Altar', () => {
  it("names the Gambit's price per Key as the run's mode sets it", () => {
    expect(renderCodex('altar')).toContain('Win: 1 Key per 15 staked');
    expect(renderCodex('altar', 'casual')).toContain('Win: 1 Key per 9 staked');
    expect(renderCodex('altar', 'hardcore')).toContain('Win: 1 Key per 23 staked');
  });
});

describe('ReferenceModal Vanilla policy', () => {
  it('explains weighted failure Fate, Chaos milestones, and pity overflow', () => {
    const drops = renderCodex('drops');
    const economy = renderCodex('economy');
    const core = renderCodex('core');

    expect(drops).toContain('Levels 2-19: +1 Fate');
    expect(drops).toContain('Levels 20-79: +2 Fate');
    expect(drops).toContain('Levels 80-99: +3 Fate');
    expect(drops).toContain('Every skill gives a guaranteed Chaos Key at levels 30, 40, 50, 60, 70, 80, 90 and 99.');
    expect(drops).toContain('Each level-up also has a separate 2% chance of one, milestones included.');
    expect(drops).not.toMatch(/Rare Level-Up|2% Chance on Level Up/);
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
    expect(unlocks).toContain('In Vanilla, Keys and Chaos Keys only unlock bosses and minigames you can reach with the areas you own.');
    expect(unlocks).toContain('If none can be reached, nothing is unlocked. You keep the Key.');
    expect(unlocks).toContain('An Omni-Key can still pick one you can');
    expect(unlocks).toContain('In Vanilla the areas you roll don&#x27;t have to touch each other.');
    expect(unlocks).toContain('Only Chunked makes you grow out from land you hold.');
    expect(unlocks).toContain('Guaranteed at skill levels 30, 40, 50, 60, 70, 80, 90 and 99, a 2% chance on every level-up, or the Ritual of Chaos.');
    expect(unlocks).toContain('Every eligible entry is equally likely, so big tables such as Areas and Banks come up most.');
    expect(renderCodex('unlocks', 'chunked')).toContain('so big tables such as Banks come up most.');
  });

  it('labels the Vanilla policy as inactive outside Vanilla', () => {
    expect(renderCodex('economy', 'chunked')).toContain('Vanilla-only (not active for this run)');
  });
});

describe('ReferenceModal Areas table size', () => {
  // The spend-table card's count badge, followed by its "Areas" heading.
  const areasEntry = (markup: string) => markup.match(
    /title="(\d+) entries">\d+<\/div><div class="min-w-0"><h4[^>]*>Areas<\/h4>/,
  );

  it("counts the run's own Areas list, including legacy Xtreme's locked Misthalin areas", () => {
    const counts = (mode: string) => Number(areasEntry(renderCodex('unlocks', mode))?.[1]);
    expect(counts('vanilla')).toBe(unlockableAreas('vanilla').length);
    expect(counts('xtreme')).toBe(unlockableAreas('xtreme').length);
    expect(counts('xtreme')).toBe(counts('vanilla') + MISTHALIN_AREAS.filter(area => area !== 'Lumbridge').length);
  });
});
