import React, { useEffect, useMemo, useState } from 'react';
import { useGame } from '../context/GameContext';
import { Sparkles } from './OsrsIcon';
import { BREAKTHROUGH_CHANCE } from '../config/economy';
import { breakthroughTier, mercyBlocker, pendingBreakthroughs, tierCap } from '../utils/chunkedFate';
import { tierBand } from '../utils/skillTiers';
import { chunkContentService } from '../services/ChunkContentService';
import { chunkedQuestRows } from './QuestDoabilityPanel';

/**
 * Chunked runs' fate-driven way out of a dead end: a Breakthrough roll for each
 * capped skill, and Fate's Mercy once nothing else is left. Loaded lazily from
 * the Keys screen because the quest check needs the chunk content.
 */
export const ChunkedFatePanel: React.FC = () => {
  const game = useGame();
  const { unlocks, gameModeId, pendingUnlock, rollBreakthrough, callOnFate } = game;
  const waiting = pendingBreakthroughs(game);
  const mercyOpen = mercyBlocker(game) === null;

  const [ready, setReady] = useState(() => chunkContentService.ready);
  useEffect(() => {
    if (mercyOpen && !ready) chunkContentService.init().then(() => setReady(true));
  }, [mercyOpen, ready]);
  // Mercy stays shut while a quest in the run's chunks is doable now.
  const doableQuests = useMemo(
    () => (mercyOpen && ready ? chunkedQuestRows(unlocks, gameModeId).filter(row => row.bucket === 'DOABLE').map(row => row.id) : []),
    [mercyOpen, ready, unlocks, gameModeId],
  );

  if (waiting.length === 0 && !mercyOpen) return null;
  const chance = Math.round(BREAKTHROUGH_CHANCE * 100);

  return (
    <div className="pb-3 grid gap-2">
      {waiting.length > 0 && (
        <div className="w-full rounded-lg border border-amber-500/40 bg-amber-950/20 p-3 grid gap-2">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-amber-300">
              Breakthrough{waiting.length === 1 ? '' : 's'} ready
            </h3>
            <p className="text-[11px] font-mono leading-snug text-amber-200/70">
              A skill at its cap gets one {chance}% roll to open its next tier, if your chunks can train it there.
            </p>
          </div>
          <ul className="grid gap-1.5">
            {waiting.map(skill => {
              const tier = breakthroughTier(game, skill) ?? 0;
              return (
                <li key={skill} className="flex items-center justify-between gap-3 rounded border border-white/10 bg-black/30 px-3 py-2">
                  <span className="text-xs text-gray-200 min-w-0">
                    <b className="text-amber-200">{skill}</b> reached level {tierCap(tier - 1)}. Roll for levels {tierBand(tier).label}.
                  </span>
                  <button
                    type="button"
                    onClick={() => rollBreakthrough(skill)}
                    disabled={!!pendingUnlock}
                    className="shrink-0 rounded border border-amber-400/60 bg-amber-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-200 hover:bg-amber-500/25 disabled:opacity-40"
                  >
                    Roll
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {mercyOpen && (
        <div className="w-full rounded-lg border border-sky-400/40 bg-sky-950/20 p-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-sky-500/15 rounded-full border border-sky-400/40 shrink-0"><Sparkles className="text-sky-300 w-5 h-5" /></div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold uppercase tracking-widest text-sky-300">Fate's Mercy</h3>
              <p className="text-[11px] font-mono leading-snug text-sky-200/70">
                {!ready
                  ? 'Checking your chunks for quests you can still do…'
                  : doableQuests.length > 0
                    ? `Opens once you have done what your chunks offer: ${doableQuests.length === 1 ? `${doableQuests[0]} is` : `${doableQuests.length} quests are`} doable now.`
                    : 'You have no Keys and every skill you can train is capped. Fate draws one neighbouring chunk or skill tier for you.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={callOnFate}
            disabled={!ready || doableQuests.length > 0}
            className="shrink-0 rounded border border-sky-400/60 bg-sky-500/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-sky-200 hover:bg-sky-500/25 disabled:opacity-40"
          >
            Call on Fate
          </button>
        </div>
      )}
    </div>
  );
};
