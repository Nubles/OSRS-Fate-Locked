import React from 'react';
import {
  CLUE_ONBOARDING_MINIMUMS,
  effectiveVanillaClueRate,
  type vanillaBossKeyStage,
} from '../config/vanillaKeyEconomy';
import { SLAYER_FATIGUE_LEVEL_REST, SLAYER_FATIGUE_OTHER_REST, SLAYER_FATIGUE_PER_KEY } from '../utils/slayerFatigue';

type BossKeyProgressProps = {
  stage: ReturnType<typeof vanillaBossKeyStage>;
  /** What an emptied reserve still rolls for; minigames pass their own. */
  cappedText?: string;
};

const BOSS_CAPPED_TEXT = 'This boss no longer rolls for Keys or Fate. Its Combat Achievements, Collection Log items and pet still roll.';

export const BossKeyProgress: React.FC<BossKeyProgressProps> = ({ stage, cappedText = BOSS_CAPPED_TEXT }) => (
  <div className="mt-1.5 text-[9px] font-mono leading-snug text-gray-400">
    <div className="flex items-center justify-between gap-2">
      <span>{stage.awarded} of {stage.cap} Keys paid</span>
      {stage.capped ? (
        <span className="text-amber-300">All Keys paid</span>
      ) : (
        <span className="text-emerald-300">{stage.currentRate}% now</span>
      )}
    </div>
    {stage.capped ? (
      <p className="mt-0.5 text-gray-500">{cappedText}</p>
    ) : stage.nextRate !== null ? (
      <p className="mt-0.5 text-gray-500">{stage.nextRate}% next</p>
    ) : null}
  </div>
);

type ClueKeyProgressProps = {
  awarded: number;
  baseRate: number;
};

export const ClueKeyProgress: React.FC<ClueKeyProgressProps> = ({ awarded, baseRate }) => {
  const effectiveRate = effectiveVanillaClueRate(baseRate, awarded);
  const onboardingActive = awarded < CLUE_ONBOARDING_MINIMUMS.length && effectiveRate > baseRate;

  return (
    <div className="mt-1 text-[9px] font-mono leading-snug text-gray-400">
      <div className="flex items-center justify-between gap-2">
        <span>First clue Keys: {Math.min(awarded, CLUE_ONBOARDING_MINIMUMS.length)} of {CLUE_ONBOARDING_MINIMUMS.length}</span>
        <span className={onboardingActive ? 'text-emerald-300' : 'text-gray-300'}>
          {effectiveRate}% {onboardingActive ? 'for your first Keys' : 'tier rate'}
        </span>
      </div>
      <p className="mt-0.5 text-gray-500">
        {awarded >= CLUE_ONBOARDING_MINIMUMS.length
          ? 'Normal tier rates apply'
          : 'Counts Keys from every clue tier'}
      </p>
    </div>
  );
};

/** One line on the Slayer tab: how tired Slayer is, and how it rests (utils/slayerFatigue). */
export const slayerFatigueText = (fatigue: number): string => (fatigue > 0
  ? `Slayer fatigue −${fatigue}%, at most half a master's rate. Each Slayer Key adds ${SLAYER_FATIGUE_PER_KEY}%; a level-up rests ${SLAYER_FATIGUE_LEVEL_REST}%, any other roll ${SLAYER_FATIGUE_OTHER_REST}%.`
  : `Slayer is rested. Each Slayer Key tires it by ${SLAYER_FATIGUE_PER_KEY}%; level-ups and other rolls rest it.`);

export const SlayerFatigueNote: React.FC<{ fatigue: number }> = ({ fatigue }) => (
  <p className={`mb-3 text-[10px] font-mono leading-snug ${fatigue > 0 ? 'text-amber-300' : 'text-gray-400'}`} data-slayer-fatigue={fatigue}>
    {slayerFatigueText(fatigue)}
  </p>
);
