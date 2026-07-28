import React from 'react';
import {
  CLUE_ONBOARDING_MINIMUMS,
  effectiveVanillaClueRate,
  type vanillaBossKeyStage,
} from '../config/vanillaKeyEconomy';

type BossKeyProgressProps = {
  stage: ReturnType<typeof vanillaBossKeyStage>;
};

export const BossKeyProgress: React.FC<BossKeyProgressProps> = ({ stage }) => (
  <div className="mt-1.5 text-[9px] font-mono leading-snug text-gray-400">
    <div className="flex items-center justify-between gap-2">
      <span>{stage.awarded} / {stage.cap} keys</span>
      {stage.capped ? (
        <span className="text-amber-300">Key reserve exhausted</span>
      ) : (
        <span className="text-emerald-300">{stage.currentRate}% current</span>
      )}
    </div>
    {stage.capped ? (
      <p className="mt-0.5 text-gray-500">Only this key/Fate roll is exhausted; ordinary loot, CAs, Collection Log, and pets still apply.</p>
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
        <span>Shared keys: {Math.min(awarded, CLUE_ONBOARDING_MINIMUMS.length)} / {CLUE_ONBOARDING_MINIMUMS.length}</span>
        <span className={onboardingActive ? 'text-emerald-300' : 'text-gray-300'}>
          {effectiveRate}% {onboardingActive ? 'onboarding rate' : 'tier rate'}
        </span>
      </div>
      <p className="mt-0.5 text-gray-500">
        {awarded >= CLUE_ONBOARDING_MINIMUMS.length
          ? 'Normal tier rates apply'
          : 'Shared across all clue tiers'}
      </p>
    </div>
  );
};
