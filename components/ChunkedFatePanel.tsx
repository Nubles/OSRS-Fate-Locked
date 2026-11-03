import { confirmThen } from '../utils/spendConfirm';
import React, { useEffect, useMemo, useState } from 'react';
import { useGame } from '../context/GameContext';
import { Sparkles } from './OsrsIcon';
import { BREAKTHROUGH_CHANCE, FATE_MARK_CURSED_ODDS, FATE_MARK_FORTUNATE_ODDS } from '../config/economy';
import { DROP_RATES } from '../constants';
import { keyChance } from '../utils/keyChance';
import { DropSource } from '../types';
import { breakthroughTier, mercyBlocker, pendingBreakthroughs, tierCap } from '../utils/chunkedFate';
import { mercyShutReason } from '../utils/chunkedMercyText';
import { chunksToExplore, exploreBlocker, exploreRollsLeft, exploreThings, exploredIn } from '../utils/chunkExplore';
import { chunkPlaceLabel } from '../utils/chunkPlaceLabel';
import { tierBand } from '../utils/skillTiers';
import { chunkContentService } from '../services/ChunkContentService';
import { chunkedQuestRows } from './QuestDoabilityPanel';
import { REGION_CHUNKS } from '../data/regionChunks';

/** The regions a Chunked run can unseal. */
const REGION_COUNT = Object.keys(REGION_CHUNKS).length;

/** How many chunks the exploring list shows before "and N more". */
const EXPLORE_SHOWN = 4;

/** What a waiting Breakthrough row says about the skill's level and its tier cap. */
export const breakthroughRowText = (skill: string, level: number, tier: number): string => {
  const cap = tierCap(tier - 1);
  const where = level > cap
    ? `${skill} is level ${level}, past its tier ${tier - 1} cap of ${cap}.`
    : `${skill} reached level ${cap}, its tier ${tier - 1} cap.`;
  return `${where} Roll for levels ${tierBand(tier).label}.`;
};

/**
 * Chunked runs' fate-driven extras on the Keys screen: exploring rolls for
 * each new chunk, a Breakthrough roll for each capped skill, and Fate's Mercy
 * once nothing else is left. While Mercy is shut and the run holds no Keys,
 * a line says what keeps it shut. Loaded lazily from the Keys screen because
 * the quest check needs the chunk content. `osrs` draws it in the OSRS
 * layout's stone rows (osrs-spend.css) instead of the classic cards;
 * `compact` lists one chunk to explore, for the OSRS layout's small Keys panel.
 */
export const ChunkedFatePanel: React.FC<{ osrs?: boolean; compact?: boolean }> = ({ osrs = false, compact = false }) => {
  const game = useGame();
  const { unlocks, gameModeId, pendingUnlock, fateLand, rituals } = game;
  // With "Ask before Key clicks" on, each roll asks Yes or No first (utils/spendConfirm.ts).
  const rollBreakthrough = (skill: string) => confirmThen(`Roll a Breakthrough for ${skill}?`, () => game.rollBreakthrough(skill));
  const callOnFate = () => confirmThen("Call on Fate's Mercy?", () => game.callOnFate());
  const exploreChunk = (chunk: string, fact: string, x?: number, y?: number) =>
    confirmThen('Roll for a Key for exploring this?', () => game.exploreChunk(chunk, fact, x, y));
  const rollGilded = (chunk: string, x?: number, y?: number) =>
    confirmThen("Roll this Gilded chunk's Key?", () => game.rollGilded(chunk, x, y));
  const waiting = pendingBreakthroughs(game);
  // Everything but the quest check, which needs the chunk content.
  const needsQuestCheck = mercyBlocker(game) === null;
  const explore = chunksToExplore(game);

  const [ready, setReady] = useState(() => chunkContentService.ready);
  useEffect(() => {
    if (needsQuestCheck && !ready) chunkContentService.init().then(() => setReady(true));
  }, [needsQuestCheck, ready]);
  // Mercy stays shut while a quest in the run's chunks is doable now. This
  // list only shows why; the call lists the quests again from the chunk
  // content itself (GameContext's callOnFate, utils/mercyQuests.ts).
  const doableQuests = useMemo(
    () => (needsQuestCheck && ready ? chunkedQuestRows(unlocks, gameModeId).filter(row => row.bucket === 'DOABLE').map(row => row.id) : []),
    [needsQuestCheck, ready, unlocks, gameModeId],
  );
  const mercyOpen = needsQuestCheck && ready && mercyBlocker(game, doableQuests) === null;
  const showMercy = needsQuestCheck;
  // Why Mercy is shut, when the run has no Keys: a skill with room, Fate for a
  // ritual, a waiting roll or a doable quest. Shown in place of the button.
  const shutReason = needsQuestCheck
    ? (ready ? mercyShutReason(game, doableQuests) : null)
    : mercyShutReason(game);

  // Fate's Thread and the omens still running (utils/fateLand.ts).
  const thread = fateLand?.thread;
  const fulfilled = fateLand?.fulfilled ?? 0;
  const gilded = fateLand?.gilded ?? [];
  const cursed = rituals?.cursedRollsLeft ?? 0;
  // The chances the rolls are made against, a curse or the run's boosts included.
  const gildedChance = keyChance(game, DropSource.FATE_MARK, DROP_RATES[DropSource.FATE_MARK]) ?? 0;
  const threadText = thread
    ? `Fate has tied a thread to ${chunkPlaceLabel(thread)}. One Chunks draw in six goes to the frontier chunks nearest it. Gain it and fate grants you a free ritual.${fulfilled > 0 ? ` Threads fulfilled: ${fulfilled}.` : ''}`
    : null;
  const fortunate = rituals?.fortunateRollsLeft ?? 0;
  const clouded = rituals?.cloudedRollsLeft ?? 0;
  const rolls = (n: number) => (n === 1 ? 'Key roll is' : `${n} Key rolls are`);
  const omens: { text: string; bane: boolean }[] = [
    ...(fortunate > 0 ? [{ text: `Fortunate: your next ${rolls(fortunate)} ${FATE_MARK_FORTUNATE_ODDS}% better.`, bane: false }] : []),
    ...(cursed > 0 ? [{ text: `Cursed: your next ${rolls(cursed)} ${FATE_MARK_CURSED_ODDS}% worse, but each fail among them gives double Fate.`, bane: true }] : []),
    ...(clouded > 0 ? [{ text: `Clouded: your next ${clouded === 1 ? 'Key roll gives' : `${clouded} Key rolls give`} no Fate if ${clouded === 1 ? 'it fails' : 'they fail'}.`, bane: true }] : []),
    ...(fateLand?.tangled ? [{ text: "Tangled: Fate's Thread doesn't pull your next chunk.", bane: true }] : []),
    ...((fateLand?.pull ?? 0) > 0 ? [{ text: `Waystone: your next ${fateLand!.pull === 1 ? 'Chunks draw leans' : `${fateLand!.pull} Chunks draws lean`} toward Fate's Thread.`, bane: false }] : []),
  ];
  // Fated sites found and regions unsealed (utils/fateLand.ts).
  const sitesHeld = Object.keys(fateLand?.sites ?? {}).filter(key => (unlocks.chunks ?? []).includes(key)).length;
  const tally = fateLand?.sites && fateLand.seals
    ? `Fated sites found: ${sitesHeld} of ${Object.keys(fateLand.sites).length}. Regions unsealed: ${Object.keys(fateLand.seals).length} of ${REGION_COUNT}.`
    : null;
  const omensShown = omens.length > 0;

  if (waiting.length === 0 && !showMercy && !shutReason && explore.length === 0 && !threadText && gilded.length === 0 && !omensShown) return null;
  const chance = Math.round(BREAKTHROUGH_CHANCE * 100);
  const exploreChance = keyChance(game, DropSource.CHUNK_EXPLORE, DROP_RATES[DropSource.CHUNK_EXPLORE]) ?? 0;
  const mercyText = needsQuestCheck && !ready
    ? 'Checking your chunks for quests you can still do…'
    : shutReason
      ?? 'You have no Keys, not enough Fate for a ritual, and every skill you can train is at its tier cap. Fate draws one neighbouring chunk or skill tier for you, free.';
  const shown = explore.slice(0, compact ? 1 : EXPLORE_SHOWN);
  const more = explore.length - shown.length;
  const exploreIntro = `The first time you do something new in a chunk you unlocked, roll once at ${exploreChance}%. Tick what you did.`;
  const breakthroughIntro = `A skill at its tier cap gets one ${chance}% roll to open its next tier, if your chunks give you a way to train it. Each tier rolls once. Levels past the cap roll no Keys.`;

  const things = (chunk: string) => exploreThings(chunk)
    .filter(thing => !exploredIn(game, chunk).includes(thing.fact))
    .map(thing => ({ thing, blocker: exploreBlocker(game, chunk, thing.fact) }));
  const thingButtons = (chunk: string, className: string) => things(chunk).map(({ thing, blocker }) => (
    <button
      key={thing.fact}
      type="button"
      className={className}
      disabled={blocker !== null || !!pendingUnlock}
      title={blocker ?? `${thing.label} in ${chunkPlaceLabel(chunk)}: roll once at ${exploreChance}%.`}
      onClick={e => exploreChunk(chunk, thing.fact, e.clientX, e.clientY)}
    >
      {thing.label}
    </button>
  ));
  // Why a thing is greyed out, printed rather than only in a tooltip (phones have no hover).
  const thingReasons = (chunk: string): string | null => {
    const lines = things(chunk).filter(({ blocker }) => blocker !== null)
      .map(({ thing, blocker }) => `${thing.label}: ${blocker!.charAt(0).toLowerCase()}${blocker!.slice(1)}`);
    return lines.length > 0 ? lines.join(' ') : null;
  };

  if (osrs) {
    return (
      <div className="ofate">
        {(threadText || gilded.length > 0 || omensShown) && (
          <div className="ospend-note ofate-block">
            <div className="ospend-note-words">
              <span className="t">Fate's Thread</span>
              {threadText && <span className="s">{threadText}</span>}
            </div>
            {tally && <span className="s">{tally}</span>}
            {gilded.map((chunk, i) => (
              <div key={`${chunk}-${i}`} className="ofate-row">
                <span className="ofate-name">{chunkPlaceLabel(chunk)}</span>
                <span className="ofate-left">Gilded by fate: one free Key roll at {gildedChance}%.</span>
                <button type="button" className="osrs-btn ofate-btn" disabled={!!pendingUnlock} onClick={e => rollGilded(chunk, e.clientX, e.clientY)}>Roll</button>
              </div>
            ))}
            {omens.map(o => <span key={o.text} className="ofate-more" style={{ color: o.bane ? '#ff3030' : '#0dc10d' }}>{o.text}</span>)}
          </div>
        )}
        {shown.length > 0 && (
          <div className="ospend-note ofate-block">
            <div className="ospend-note-words">
              <span className="t">Explore your new chunks</span>
              <span className="s">{exploreIntro}</span>
            </div>
            {shown.map(chunk => {
              const why = thingReasons(chunk);
              return (
                <div key={chunk} className="ofate-row">
                  <span className="ofate-name">{chunkPlaceLabel(chunk)}</span>
                  <span className="ofate-left">{exploreRollsLeft(game, chunk)} left</span>
                  <span className="ofate-things">{thingButtons(chunk, 'osrs-btn ofate-btn')}</span>
                  {why && <span className="ofate-why">{why}</span>}
                </div>
              );
            })}
            {more > 0 && <span className="ofate-more">And {more} more chunk{more === 1 ? '' : 's'} to explore.</span>}
          </div>
        )}
        {waiting.length > 0 && (
          <div className="ospend-note ofate-block">
            <div className="ospend-note-words">
              <span className="t">Breakthrough{waiting.length === 1 ? '' : 's'} ready</span>
              <span className="s">{breakthroughIntro}</span>
            </div>
            {waiting.map(skill => {
              const tier = breakthroughTier(game, skill) ?? 0;
              return (
                <div key={skill} className="ofate-row">
                  <span className="ofate-name">{skill}</span>
                  <span className="ofate-left">{breakthroughRowText(skill, unlocks.levels[skill] ?? 1, tier)}</span>
                  <button type="button" className="osrs-btn ofate-btn" onClick={() => rollBreakthrough(skill)} disabled={!!pendingUnlock}>Roll</button>
                </div>
              );
            })}
          </div>
        )}
        {(showMercy || shutReason) && (
          <div className="ospend-note ofate-block">
            <div className="ofate-row">
              <span className="ospend-note-words">
                <span className="t">Fate's Mercy</span>
                <span className="s">{mercyText}</span>
              </span>
              {showMercy && (
                <button type="button" className="osrs-btn ofate-btn" onClick={() => callOnFate()} disabled={!mercyOpen}>Call on Fate</button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="pb-3 grid gap-2">
      {(threadText || gilded.length > 0 || omensShown) && (
        <div className="w-full rounded-lg border border-yellow-500/40 bg-yellow-950/20 p-3 grid gap-2">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-yellow-300">Fate's Thread</h3>
            {threadText && <p className="text-[11px] font-mono leading-snug text-yellow-200/70">{threadText}</p>}
            {tally && <p className="text-[11px] font-mono leading-snug text-yellow-200/70">{tally}</p>}
          </div>
          {gilded.length > 0 && (
            <ul className="grid gap-1.5">
              {gilded.map((chunk, i) => (
                <li key={`${chunk}-${i}`} className="flex items-center justify-between gap-3 rounded border border-white/10 bg-black/30 px-3 py-2">
                  <span className="text-xs text-gray-200 min-w-0"><b className="text-yellow-200">{chunkPlaceLabel(chunk)}</b> is Gilded by fate: one free Key roll at {gildedChance}%.</span>
                  <button
                    type="button"
                    onClick={e => rollGilded(chunk, e.clientX, e.clientY)}
                    disabled={!!pendingUnlock}
                    className="shrink-0 rounded border border-yellow-400/60 bg-yellow-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-yellow-200 hover:bg-yellow-500/25 disabled:opacity-40"
                  >
                    Roll
                  </button>
                </li>
              ))}
            </ul>
          )}
          {omens.map(o => <p key={o.text} className={`text-[11px] ${o.bane ? 'text-red-300/80' : 'text-green-300/80'}`}>{o.text}</p>)}
        </div>
      )}
      {shown.length > 0 && (
        <div className="w-full rounded-lg border border-emerald-500/40 bg-emerald-950/20 p-3 grid gap-2">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-300">Explore your new chunks</h3>
            <p className="text-[11px] font-mono leading-snug text-emerald-200/70">{exploreIntro}</p>
          </div>
          <ul className="grid gap-1.5">
            {shown.map(chunk => {
              const why = thingReasons(chunk);
              return (
                <li key={chunk} className="rounded border border-white/10 bg-black/30 px-3 py-2 grid gap-1.5">
                  <span className="text-xs text-gray-200">
                    <b className="text-emerald-200">{chunkPlaceLabel(chunk)}</b>: {exploreRollsLeft(game, chunk)} roll{exploreRollsLeft(game, chunk) === 1 ? '' : 's'} left
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    {thingButtons(chunk, 'rounded border border-emerald-400/60 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-40')}
                  </span>
                  {why && <span className="text-[11px] text-emerald-200/60">{why}</span>}
                </li>
              );
            })}
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
            <p className="text-[11px] font-mono leading-snug text-amber-200/70">{breakthroughIntro}</p>
          </div>
          <ul className="grid gap-1.5">
            {waiting.map(skill => {
              const tier = breakthroughTier(game, skill) ?? 0;
              return (
                <li key={skill} className="flex items-center justify-between gap-3 rounded border border-white/10 bg-black/30 px-3 py-2">
                  <span className="text-xs text-gray-200 min-w-0">{breakthroughRowText(skill, unlocks.levels[skill] ?? 1, tier)}</span>
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

      {(showMercy || shutReason) && (
        <div className="w-full rounded-lg border border-sky-400/40 bg-sky-950/20 p-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-sky-500/15 rounded-full border border-sky-400/40 shrink-0"><Sparkles className="text-sky-300 w-5 h-5" /></div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold uppercase tracking-widest text-sky-300">Fate's Mercy</h3>
              <p className="text-[11px] font-mono leading-snug text-sky-200/70">{mercyText}</p>
            </div>
          </div>
          {showMercy && (
            <button
              type="button"
              onClick={() => callOnFate()}
              disabled={!mercyOpen}
              className="shrink-0 rounded border border-sky-400/60 bg-sky-500/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-sky-200 hover:bg-sky-500/25 disabled:opacity-40"
            >
              Call on Fate
            </button>
          )}
        </div>
      )}
    </div>
  );
};
