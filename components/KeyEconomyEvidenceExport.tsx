import React, { useState } from 'react';
import type { LogEntry } from '../types';
import {
  buildKeyEconomyEvidence,
  stageForCompletion,
  type EvidenceStage,
} from '../utils/keyEconomyEvidence';

export interface KeyEconomyEvidenceExportProps {
  history: readonly LogEntry[];
  gameMode: string;
  completionPercent: number;
  appVersion: string;
}

const STAGE_COPY = {
  early: 'Early · 0–24% completion',
  mid: 'Mid · 25–74% completion',
  late: 'Late · 75–100% completion',
} as const;

const STAGE_NAMES: Record<EvidenceStage, string> = {
  early: 'Early',
  mid: 'Mid',
  late: 'Late',
};

export const KeyEconomyEvidenceExport: React.FC<KeyEconomyEvidenceExportProps> = ({
  history,
  gameMode,
  completionPercent,
  appVersion,
}) => {
  const suggestedStage = stageForCompletion(completionPercent);
  const [stage, setStage] = useState<EvidenceStage>(suggestedStage);
  const [hours, setHours] = useState('');
  const parsedHours = Number(hours);
  const canExport = Number.isFinite(parsedHours) && parsedHours > 0;

  const exportReport = () => {
    if (!canExport) return;

    const report = buildKeyEconomyEvidence(history, {
      reportId: crypto.randomUUID(),
      gameMode,
      stage,
      observedHours: parsedHours,
      appVersion,
    });
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `fate-key-evidence-${report.reportId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <form
      className="bg-[#1f1f1f] border border-white/5 rounded-lg p-5 space-y-4"
      onSubmit={(event) => event.preventDefault()}
    >
      <div>
        <h3 className="text-sm font-bold text-gray-200">Export aggregate evidence</h3>
        <p className="text-xs text-gray-500 mt-1">
          Suggested from current tracker completion: {STAGE_NAMES[suggestedStage]}.
        </p>
      </div>

      <label className="block text-xs font-bold uppercase tracking-wider text-gray-400" htmlFor="key-evidence-hours">
        Observed play-hours
        <input
          id="key-evidence-hours"
          type="number"
          min="0.1"
          step="0.1"
          value={hours}
          onChange={(event) => setHours(event.target.value)}
          className="mt-2 block w-full rounded border border-white/10 bg-[#161616] px-3 py-2 text-sm text-gray-100"
        />
      </label>

      <fieldset>
        <legend className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
          Reporting stage
        </legend>
        <div className="space-y-2">
          {(Object.keys(STAGE_COPY) as EvidenceStage[]).map((stageOption) => (
            <label key={stageOption} className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="radio"
                name="key-evidence-stage"
                value={stageOption}
                checked={stage === stageOption}
                onChange={() => setStage(stageOption)}
              />
              {STAGE_COPY[stageOption]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-1 text-xs text-gray-500">
        <p>No account name, run ID, raw history, or timestamps are exported.</p>
        <p>The JSON is downloaded locally and is not sent automatically.</p>
      </div>

      <button
        type="button"
        onClick={exportReport}
        disabled={!canExport}
        className="px-4 py-2 rounded bg-osrs-gold text-black text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
      >
        Download evidence JSON
      </button>
    </form>
  );
};
