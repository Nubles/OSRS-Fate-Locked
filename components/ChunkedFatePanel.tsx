import React, { useEffect, useMemo, useState } from 'react';
import { useGame } from '../context/GameContext';
import { Sparkles } from './OsrsIcon';
import { BREAKTHROUGH_CHANCE } from '../config/economy';
import { DROP_RATES } from '../constants';
import { DropSource } from '../types';
import { breakthroughTier, mercyBlocker, pendingBreakthroughs, tierCap } from '../utils/chunkedFate';
import { chunksToExplore, exploreBlocker, exploreRollsLeft, exploreThings, exploredIn } from '../utils/chunkExplore';
import { chunkLabel } from '../utils/chunkAdjacency';
import { tierBand } from '../utils/skillTiers';
import { chunkContentService } from '../services/ChunkContentService';
import { chunkedQuestRows } from './QuestDoabilityPanel';

/** How many chunks the exploring list shows before "and N more". */
const EXPLORE_SHOWN = 4;

/**
 * Chunked runs' fate-driven extras on the Keys screen: exploring rolls for
 * each new chunk, a Breakthrough roll for each capped skill, and Fate's Mercy
 * once nothing else is left. Loaded lazily from the Keys screen because the
 * quest check needs the chunk content. `osrs` draws it in the OSRS layout's
 * stone rows (osrs-spend.css) instead of the classic cards; `compact` lists
 * one chunk to explore, for the OSRS layout's small Keys panel.
 */
export const ChunkedFatePanel: React.FC<{ osrs?: boolean; compact?: boolean }> = ({ osrs = false, compact = false }) => {
  const game = useGame();
  const { unlocks, gameModeId, pendingUnlock, rollBreakthrough, callOnFate, exploreChunk } = game;
  const waiting = pendingBreakthroughs(game);
  const mercyOpen = mercyBlocker(game) === null;
  const explore = chunksToExplore(game);

  const [ready, setReady] = useState(() => chunkContentService.ready);
  useEffect(() => {
    if (mercyOpen && !ready) chunkContentService.init().then(() => setReady(true));
  }, [mercyOpen, ready]);
  // Mercy stays shut while a quest in the run's chunks is doable now.
  const doableQuests = useMemo(
    () => (mercyOpen && ready ? chunkedQuestRows(unlocks, gameModeId).filter(row => row.bucket === 'DOABLE').map(row => row.id) : []),
    [mercyOpen, ready, unlocks, gameModeId],
  );

  if (waiting.length === 0 && !mercyOpen && explore.length === 0) return null;
  const chance = Math.round(BREAKTHROUGH_CHANCE * 100);
  const exploreChance = DROP_RATES[DropSource.CHUNK_EXPLORE];
  const mercyText = !ready
    ? 'Checking your chunks for quests you can still do…'
    : doableQuests.length > 0
      ? `Opens once you have done what your chunks offer: ${doableQuests.length === 1 ? `${doableQuests[0]} is` : `${doableQuests.length} quests are`} doable now.`
      : 'You have no Keys and every skill you can train is capped. Fate draws one neighbouring chunk or skill tier for you.';
  const shown = explore.slice(0, compact ? 1 : EXPLORE_SHOWN);
  const more = explore.length - shown.length;
  const exploreIntro = `The first time you do something new in a chunk you unlocked, roll once at ${exploreChance}%. Tick what you did.`;

  const thingButtons = (chunk: string, className: string) => exploreThings(chunk)
    .filter(thing => !exploredIn(game, chunk).includes(thing.fact))
    .map(thing => {
      const blocker = exploreBlocker(game, chunk, thing.fact);
      return (
        <button
          key={thing.fact}
          type="button"
          className={className}
          disabled={blocker !== null || !!pendingUnlock}
          title={blocker ?? `${thing.label} in ${chunkLabel(chunk)}: roll once at ${exploreChance}%.`}
          onClick={e => exploreChunk(chunk, thing.fact, e.clientX, e.clientY)}
        >
          {thing.label}
        </button>
      );
    });

  if (osrs) {
    return (
      <div className="ofate">
        {shown.length > 0 && (
          <div className="ospend-note ofate-block">
            <div className="ospend-note-words">
              <span className="t">Explore your new chunks</span>
              <span className="s">{exploreIntro}</span>
            </div>
            {shown.map(chunk => (
              <div key={chunk} className="ofate-row">
                <span className="ofate-name">{chunkLabel(chunk)}</span>
                <span className="ofate-left">{exploreRollsLeft(game, chunk)} left</span>
                <span className="ofate-things">{thingButtons(chunk, 'osrs-btn ofate-btn')}</span>
              </div>
            ))}
            {more > 0 && <span className="ofate-more">And {more} more chunk{more === 1 ? '' : 's'} to explore.</span>}
          </div>
        )}
        {waiting.length > 0 && (
          <div className="ospend-note ofate-block">
            <div className="ospend-note-words">
              <span className="t">Breakthrough{waiting.length === 1 ? '' : 's'} ready</span>
              <span className="s">A skill at its cap gets one {chance}% roll to open its next tier, if your chunks can train it there.</span>
            </div>
            {waiting.map(skill => {
              const tier = breakthroughTier(game, skill) ?? 0;
              return (
                <div key={skill} className="ofate-row">
                  <span className="ofate-name">{skill}</span>
                  <span className="ofate-left">Level {tierCap(tier - 1)}. Roll for {tierBand(tier).label}.</span>
                  <button type="button" className="osrs-btn ofate-btn" onClick={() => rollBreakthrough(skill)} disabled={!!pendingUnlock}>Roll</button>
                </div>
              );
            })}
          </div>
        )}
        {mercyOpen && (
          <div className="ospend-note ofate-block">
            <div className="ofate-row">
              <span className="ospend-note-words">
                <span className="t">Fate's Mercy</span>
                <span className="s">{mercyText}</span>
              </span>
              <button type="button" className="osrs-btn ofate-btn" onClick={callOnFate} disabled={!ready || doableQuests.length > 0}>Call on Fate</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="pb-3 grid gap-2">
      {shown.length > 0 && (
        <div className="w-full rounded-lg border border-emerald-500/40 bg-emerald-950/20 p-3 grid gap-2">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-300">Explore your new chunks</h3>
            <p className="text-[11px] font-mono leading-snug text-emerald-200/70">{exploreIntro}</p>
          </div>
          <ul className="grid gap-1.5">
            {shown.map(chunk => (
              <li key={chunk} className="rounded border border-white/10 bg-black/30 px-3 py-2 grid gap-1.5">
                <span className="text-xs text-gray-200">
                  <b className="text-emerald-200">{chunkLabel(chunk)}</b>: {exploreRollsLeft(game, chunk)} roll{exploreRollsLeft(game, chunk) === 1 ? '' : 's'} left
                </span>
                <span className="flex flex-wrap gap-1.5">
                  {thingButtons(chunk, 'rounded border border-emerald-400/60 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-40')}
                </span>
              </li>
            ))}
          </ul>
          {more > 0 && <p className="text-[11px] text-emerald-200/60">And {more} more chunk{more === 1 ? '' : 's'} to explore.</p>}
        </div>
      )}

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
              <p className="text-[11px] font-mono leading-snug text-sky-200/70">{mercyText}</p>
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
