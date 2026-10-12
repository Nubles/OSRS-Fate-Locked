import React from 'react';
import {
  CLUE_ONBOARDING_MINIMUMS,
  effectiveVanillaClueRate,
  type vanillaBossKeyStage,
} from '../config/vanillaKeyEconomy';
import { useGame } from '../context/GameContext';
import { isF2PMode } from '../config/gameModes';

/** Whether this is a Free-to-play run; false where no game is loaded. */
const useIsF2P = (): boolean => {
  try {
    return isF2PMode(useGame().gameModeId);
  } catch {
    return false;
  }
};

type BossKeyProgressProps = {
  stage: ReturnType<typeof vanillaBossKeyStage>;
};

export const BossKeyProgress: React.FC<BossKeyProgressProps> = ({ stage }) => {
  // Pets are members only, so a Free-to-play boss has none to roll.
  const isF2P = useIsF2P();
  return (
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
      <p className="mt-0.5 text-gray-500">{isF2P
        ? 'This boss no longer rolls for Keys or Fate. Its Combat Achievements and Collection Log items still roll.'
        : 'This boss no longer rolls for Keys or Fate. Its Combat Achievements, Collection Log items and pet still roll.'}</p>
    ) : stage.nextRate !== null ? (
      <p className="mt-0.5 text-gray-500">{stage.nextRate}% next</p>
    ) : null}
  </div>
  );
};

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
