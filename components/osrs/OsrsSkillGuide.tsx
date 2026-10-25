import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SKILL_UNLOCK_DATA } from '../../data/skillUnlocks';
import { tierBand } from '../../utils/skillTiers';
import { skillChunkNodesByTier, skillStations } from '../../utils/skillChunkNodes';
import { chunkContentService } from '../../services/ChunkContentService';
import { summarisePlaces, showChunkOnMap } from '../../utils/chunkLocations';
import { useGame } from '../../context/GameContext';
import { skillGatherNote } from '../../utils/skillGatherNote';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { formatKeyPercent } from '../../utils/keyRoll';
import { levelUpKeyChance } from '../../utils/keyChance';
import { tierCap } from '../../utils/chunkedFate';
import { chunkedPastCapText, levelBoostNote } from '../SkillRollOdds';
import { isSkillChaosMilestone, LEVEL_CHAOS_CHANCE } from '../../config/economy';
import { TIER_GEMS, roman, skillIconSrc, tint } from './OsrsDashGems';
import { OsrsTierMark } from './OsrsTierMark';
import { useTierMarks } from '../../utils/uiStyle';
import { SetLevelControl } from '../SetLevelControl';
import './osrs-dashboard.css';

/**
 * The skill detail as the OSRS skill guide window: the skill's level and tier
 * gem at the top, Map Gathering / Skill Unlocks tabs, the Tier I..X ladder on
 * the left and the chosen tier's resources or unlocks on the right. Same
 * data, filters, map jumps and close behaviour as the classic modal.
 */

interface Props {
  skill: string;
  currentTier: number;
  onClose: () => void;
}

type Tab = 'gather' | 'unlocks';
type Rung = number | 'stations';

const NAV_PATH = 'M1 6l8-5-3 10-1-4z';
const LOCK_PATH = 'M1 6h8v5H1zM3 6V4a2 2 0 0 1 4 0v2';

/** Places a gatherable node is found, reachable first; click to jump the map there. */
const OsrsRegionPicker: React.FC<{ node: string; onJump: (cx: number, cy: number) => void }> = ({ node, onJump }) => {
  const { unlocks, gameModeId } = useGame();
  const [expanded, setExpanded] = useState(false);
  const places = useMemo(() => {
    const hit = chunkContentService.entityLocations(node, ['object']);
    return hit ? summarisePlaces(hit.locations, unlocks, gameModeId) : [];
  }, [node, unlocks, gameModeId]);

  if (places.length === 0) return <p className="osrs-dash-tan-s" style={{ margin: 0, padding: '2px 0' }}>No mapped locations found.</p>;
  const reachable = places.filter(p => p.unlocked);
  const locked = places.filter(p => !p.unlocked);
  const shown = expanded ? places : places.slice(0, 6);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span className="osrs-dash-tan-s">
        {reachable.length > 0
          ? `Go to ${node} — ${reachable.length} unlocked place${reachable.length === 1 ? '' : 's'}:`
          : `${node} isn't in any unlocked area yet. Locations:`}
      </span>
      <div className="osrs-dash-places">
        {shown.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => onJump(p.cx, p.cy)}
            className={`osrs-dash-place${p.unlocked ? ' is-on' : ''}`}
            title={p.unlocked ? `Jump to ${p.label}` : `${p.label} — area locked (preview)`}
          >
            <svg aria-hidden="true" width="10" height="12" viewBox="0 0 10 12"><path d={p.unlocked ? NAV_PATH : LOCK_PATH} fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.subArea ?? p.region ?? p.label}</span>
          </button>
        ))}
      </div>
      {places.length > 6 && (
        <button type="button" className="osrs-dash-linkbtn" onClick={() => setExpanded(e => !e)}>
          {expanded ? 'show fewer' : `+${places.length - 6} more place${places.length - 6 === 1 ? '' : 's'}${locked.length ? ' (incl. locked)' : ''}`}
        </button>
      )}
    </div>
  );
};

export const OsrsSkillGuide: React.FC<Props> = ({ skill, currentTier, onClose }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);
  const game = useGame();
  const { unlocks, gameModeId } = game;
  const level = unlocks.levels[skill] || 1;
  // The chance the next level-up rolls against, boosts included; null past a Chunked tier cap.
  const levelChance = levelUpKeyChance(game, skill);
  const unlockData = SKILL_UNLOCK_DATA[skill] || {};
  const tiers = Array.from({ length: 10 }, (_, i) => i + 1);

  const [tab, setTab] = useState<Tab>('unlocks');
  const [openNode, setOpenNode] = useState<string | null>(null);
  const [rung, setRung] = useState<Rung>(Math.max(1, currentTier));

  const [chunksReady, setChunksReady] = useState(chunkContentService.ready);
  useEffect(() => { if (!chunksReady) chunkContentService.init().then(ok => ok && setChunksReady(true)); }, [chunksReady]);
  const nodesByTier = useMemo(() => (chunksReady ? skillChunkNodesByTier(skill) : {}), [skill, chunksReady]);
  const stations = useMemo(() => (chunksReady ? skillStations(skill) : []), [skill, chunksReady]);
  const hasGathering = Object.keys(nodesByTier).length > 0 || stations.length > 0;
  useEffect(() => {
    if (!hasGathering) return;
    setTab('gather');
    // A production skill gathers nothing by tier: open on its stations.
    if (!(nodesByTier[Math.max(1, currentTier)]?.length) && stations.length) setRung('stations');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasGathering]);

  const jump = (cx: number, cy: number) => { showChunkOnMap(cx, cy); onClose(); };

  const [query, setQuery] = useState('');
  const [unlockedOnly, setUnlockedOnly] = useState(false);
  const q = query.trim().toLowerCase();
  const nodesFor = (tier: number) => (nodesByTier[tier] ?? []).filter(n => !q || n.name.toLowerCase().includes(q));
  const benefitsFor = (tier: number) => (unlockData[tier] ?? []).filter(b => !q || b.toLowerCase().includes(q));

  const visibleTiers = tiers.filter(t => {
    if (unlockedOnly && currentTier < t) return false;
    if (tab === 'gather') return nodesFor(t).length > 0;
    return q ? benefitsFor(t).length > 0 : true;
  });
  const visibleStations = (tab === 'gather' && (!unlockedOnly || currentTier >= 1))
    ? stations.filter(s => !q || s.name.toLowerCase().includes(q))
    : [];
  const noMatches = (q || unlockedOnly) && visibleTiers.length === 0 && (tab !== 'gather' || visibleStations.length === 0);

  // The Stations rung only exists on the gather tab; fall back to a tier elsewhere.
  const showStationsRung = tab === 'gather' && stations.length > 0;
  const sel: Rung = rung === 'stations' && !showStationsRung ? Math.max(1, currentTier) : rung;

  const curGem = currentTier > 0 ? TIER_GEMS[currentTier - 1] : null;
  // Gem names go with the gems: with numerals a tier is just Tier I..X.
  const gemNames = useTierMarks() === 'gems';
  const named = (t: number) => (gemNames ? ` · ${TIER_GEMS[t - 1].name}` : '');
  const contentTo = currentTier > 0 ? tierBand(currentTier).max : 0;
  const nextLevel = level + 1;
  const oddsId = `skill-guide-odds-${skill.toLowerCase().replace(/\s+/g, '-')}`;

  const tierCount = (t: number) => (tab === 'gather' ? nodesFor(t).length : benefitsFor(t).length);

  let body: React.ReactNode;
  if (sel === 'stations') {
    body = visibleStations.length === 0
      ? <div className="osrs-dash-empty">{q ? `No resources match “${query}”.` : 'No stations to show.'}</div>
      : visibleStations.map((n) => {
        const isOpen = openNode === n.name;
        return (
          <div key={n.name} className="osrs-dash-guiderow">
            <button type="button" className="osrs-dash-node" onClick={() => setOpenNode(isOpen ? null : n.name)} aria-expanded={isOpen}>
              <svg aria-hidden="true" width="8" height="10" viewBox="0 0 8 10" style={{ transform: isOpen ? 'rotate(90deg)' : undefined, flexShrink: 0 }}><path d="M1 1l5 4-5 4" fill="none" stroke="#c8b897" strokeWidth="2" /></svg>
              <span className="osrs-slot" style={{ width: 38, height: 34, flexShrink: 0 }}><img className="osrs-px" src={skillIconSrc(skill)} alt="" aria-hidden="true" width={25} height={25} /></span>
              <span className="osrs-dash-node-name">{n.name}</span>
              <span className="osrs-dash-yellow-s" style={{ color: 'var(--osrs-orange, #ff981f)' }}>station</span>
              <span className="osrs-dash-muted-s" title={`${n.chunks} chunks`} style={{ width: 76, textAlign: 'right' }}>{n.chunks} chunk{n.chunks === 1 ? '' : 's'}</span>
            </button>
            {isOpen && <div style={{ padding: '2px 10px 8px 64px' }}><OsrsRegionPicker node={n.name} onJump={jump} /></div>}
          </div>
        );
      });
  } else {
    const t = sel;
    const owned = currentTier >= t;
    const blocked = unlockedOnly && !owned;
    if (blocked) {
      body = <div className="osrs-dash-empty">This tier is locked. Turn off Unlocked to preview it.</div>;
    } else if (tab === 'gather') {
      const nodes = nodesFor(t);
      body = nodes.length === 0
        ? <div className="osrs-dash-empty">{q ? `No resources match “${query}” in this tier.` : 'Nothing to gather is unlocked by this tier. It raises your cap only.'}</div>
        : nodes.map((n) => {
          const isOpen = openNode === n.name;
          return (
            <div key={n.name} className="osrs-dash-guiderow">
              <button type="button" className="osrs-dash-node" onClick={() => setOpenNode(isOpen ? null : n.name)} aria-expanded={isOpen}>
                <svg aria-hidden="true" width="8" height="10" viewBox="0 0 8 10" style={{ transform: isOpen ? 'rotate(90deg)' : undefined, flexShrink: 0 }}><path d="M1 1l5 4-5 4" fill="none" stroke="#c8b897" strokeWidth="2" /></svg>
                <span className="osrs-slot" style={{ width: 38, height: 34, flexShrink: 0 }}><img className="osrs-px" src={skillIconSrc(skill)} alt="" aria-hidden="true" width={25} height={25} style={{ filter: owned ? undefined : 'grayscale(1) brightness(.55)' }} /></span>
                <span className="osrs-dash-node-name" style={{ color: owned ? '#fff' : 'var(--osrs-muted, #8a7c66)' }}>{n.name}</span>
                <span className="osrs-dash-yellow-s" style={{ width: 34, textAlign: 'right' }}>L{n.level}</span>
                <span className="osrs-dash-muted-s" title={`${n.chunks} chunks`} style={{ width: 76, textAlign: 'right' }}>{n.chunks} chunk{n.chunks === 1 ? '' : 's'}</span>
              </button>
              {isOpen && <div style={{ padding: '2px 10px 8px 64px' }}><OsrsRegionPicker node={n.name} onJump={jump} /></div>}
            </div>
          );
        });
    } else {
      const benefits = benefitsFor(t);
      body = benefits.length === 0
        ? <div className="osrs-dash-empty">{q ? `No unlocks match “${query}” in this tier.` : 'No specific unlocks recorded for this tier.'}</div>
        : benefits.map((line, idx) => {
          const m = /^Lvl (\d+):\s*(.*)$/.exec(line);
          return (
            <div key={idx} className="osrs-dash-guiderow osrs-dash-benefit">
              <span style={{ width: 34, textAlign: 'right', fontFamily: 'RSBold, sans-serif', color: owned ? 'var(--osrs-yellow, #ff0)' : '#7d705c' }}>{m ? m[1] : ''}</span>
              <span className="osrs-slot" style={{ width: 38, height: 34, flexShrink: 0 }}><img className="osrs-px" src={skillIconSrc(skill)} alt="" aria-hidden="true" width={25} height={25} style={{ filter: owned ? undefined : 'grayscale(1) brightness(.55)' }} /></span>
              <span style={{ color: owned ? '#fff' : 'var(--osrs-muted, #8a7c66)' }}>{m ? m[2] : line}</span>
            </div>
          );
        });
    }
  }

  const head = (() => {
    if (sel === 'stations') {
      return { title: 'Stations', sub: 'Usable from level 1', color: 'var(--osrs-orange, #ff981f)', bg: 'var(--osrs-inner, #2e271e)', edge: 'var(--osrs-inner-ring, #4f4434)', state: '', stateColor: '', gem: null as number | null };
    }
    const g = TIER_GEMS[sel - 1];
    const owned = sel <= currentTier;
    return {
      title: `Tier ${roman(sel)}${named(sel)}`, sub: `Levels ${tierBand(sel).label}`, color: g.color,
      bg: owned ? tint(g.color, 0.16) : 'var(--osrs-inner, #2e271e)', edge: owned ? g.color : 'var(--osrs-inner-ring, #4f4434)',
      state: owned ? 'Active' : (sel === currentTier + 1 ? 'Next Unlock' : 'Locked'),
      stateColor: owned ? 'var(--osrs-green, #0dc10d)' : (sel === currentTier + 1 ? 'var(--osrs-yellow, #ff0)' : 'var(--osrs-red, #ff3030)'),
      gem: sel,
    };
  })();

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={`${skill} skill detail`} tabIndex={-1}
      className="fixed inset-0 z-[200] flex items-center justify-center p-2" style={{ background: 'rgba(0,0,0,.6)' }}>
      <div className="osrs-win osrs-dash-guide-win">
        <div className="osrs-dash-wintitle" style={{ borderBottom: 0 }}>
          <h2 className="osrs-title">{skill} Progression</h2>
          <button type="button" onClick={onClose} className="osrs-dash-close" aria-label="Close">
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="2" /></svg>
          </button>
        </div>

        <div className="osrs-inner osrs-dash-guidehero">
          <span className="osrs-slot" style={{ width: 52, height: 48, flexShrink: 0 }}>
            <img className="osrs-px" src={skillIconSrc(skill)} alt={skill} width={25} height={25} />
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ font: "32px 'RSBold', sans-serif", lineHeight: '26px', color: 'var(--osrs-yellow, #ff0)' }}>Level {level}</span>
            <span className="osrs-dash-tan-s">
              {currentTier > 0 ? `Content to level ${contentTo} · train past your tier, use only what is unlocked` : 'No tier unlocked yet'}
            </span>
          </span>
          <span className="osrs-dash-guidehero-tier">
            <OsrsTierMark tier={currentTier} size="hero" />
            <span style={{ display: 'flex', flexDirection: 'column', lineHeight: '17px' }}>
              <span style={{ fontFamily: 'RSBold, sans-serif', color: curGem ? curGem.color : 'var(--osrs-red, #ff3030)' }}>
                {curGem ? `Current: Tier ${roman(currentTier)}${named(currentTier)}` : 'Current: Tier 0'}
              </span>
              <span className="osrs-dash-tan-s">Max: Tier X{named(10)}</span>
            </span>
            {currentTier > 0 && level < 99 && (
              <span className="osrs-dash-odds" tabIndex={0} aria-describedby={oddsId}>
                Next Lv {nextLevel} · {levelChance === null ? 'no roll' : `${formatKeyPercent(levelChance)} Key`}
                <span id={oddsId} role="tooltip" className="osrs-tooltip osrs-dash-odds-tip">
                  {levelChance === null
                    ? chunkedPastCapText(tierCap(currentTier))
                    : isSkillChaosMilestone(nextLevel)
                    ? `Level ${nextLevel} also gives a guaranteed Chaos Key, and a separate ${LEVEL_CHAOS_CHANCE}% chance of another.`
                    : `Each level-up also has a separate ${LEVEL_CHAOS_CHANCE}% chance of a Chaos Key.`}
                  {levelChance !== null && levelBoostNote(levelChance, nextLevel)}
                </span>
              </span>
            )}
          </span>
        </div>

        <SetLevelControl skill={skill} variant="osrs" />

        <div role="tablist" aria-label="Skill detail sections" className="osrs-dash-tabrow" style={{ padding: '0 4px', flexShrink: 0 }}>
          <div className="osrs-dash-tablist">
            {([['gather', 'Map Gathering'], ['unlocks', 'Skill Unlocks']] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className="osrs-tab"
                onClick={() => { setTab(id); setOpenNode(null); }}
                disabled={id === 'gather' && !hasGathering}
                style={id === 'gather' && !hasGathering ? { color: '#7d705c', cursor: 'default' } : undefined}
              >
                {label}
                {id === 'gather' && hasGathering && (
                  <span style={{ marginLeft: 6, fontFamily: 'RSSmall, sans-serif', color: 'var(--osrs-yellow, #ff0)' }}>{Object.values(nodesByTier).flat().length + stations.length}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="osrs-chat" style={{ flexShrink: 0, padding: '6px 10px', lineHeight: '18px' }}>
          {tab === 'gather'
            ? skillGatherNote(gameModeId)
            : 'Unlocking a tier grants access to training methods and equipment within that level range. You may train beyond your unlocked tier, but you can only use unlocked content.'}
        </div>

        {(tab === 'unlocks' || hasGathering) && (
          <div style={{ flexShrink: 0, display: 'flex', gap: 6 }}>
            <label className="osrs-dash-search" style={{ flex: 1, width: 'auto', height: 28 }}>
              <svg aria-hidden="true" width="13" height="13" viewBox="0 0 14 14"><circle cx="6" cy="6" r="4.5" fill="none" stroke="#c8b897" strokeWidth="2" /><path d="M9.5 9.5l3.5 3.5" stroke="#c8b897" strokeWidth="2" /></svg>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={tab === 'gather' ? 'Filter resources... (e.g. yew, lobster)' : 'Filter unlocks...'}
                aria-label="Filter skill progression"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} aria-label="Clear filter" style={{ all: 'unset', cursor: 'pointer', color: 'var(--osrs-tan, #c8b897)', fontFamily: 'RSBold, sans-serif' }}>x</button>
              )}
            </label>
            <button
              type="button"
              aria-pressed={unlockedOnly}
              onClick={() => setUnlockedOnly(v => !v)}
              className={`osrs-btn osrs-dash-uo${unlockedOnly ? ' is-on' : ''}`}
              style={{ height: 28 }}
              title="Show only tiers you've unlocked"
            >
              <svg aria-hidden="true" width="12" height="14" viewBox="0 0 12 14"><path d="M2 7h8v6H2zM4 7V4a2 2 0 0 1 4 0" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
              Unlocked
            </button>
          </div>
        )}

        {tab === 'gather' && !hasGathering && (
          <p className="osrs-dash-tan-s" style={{ margin: 0 }}>This skill has no gatherable map resources — see Skill Unlocks for what it offers.</p>
        )}
        {tab === 'gather' && hasGathering && !chunksReady && (
          <p className="osrs-dash-tan-s" style={{ margin: 0 }}>Loading map resources...</p>
        )}
        {noMatches && (
          <p className="osrs-dash-tan-s" style={{ margin: 0 }}>No {tab === 'gather' ? 'resources' : 'unlocks'} match{q && ` “${query}”`}{unlockedOnly && ' in unlocked tiers'}.</p>
        )}

        <div className="osrs-dash-guidebody">
          <div className="osrs-inner osrs-dash-rungs" role="group" aria-label="Tier ladder">
            {showStationsRung && (
              <button type="button" aria-pressed={sel === 'stations'} onClick={() => { setRung('stations'); setOpenNode(null); }}
                className="osrs-dash-rung" disabled={unlockedOnly && currentTier < 1}
                style={sel === 'stations' ? { background: 'var(--osrs-selected, #5a4c3a)', boxShadow: 'inset 0 0 0 1px var(--osrs-yellow, #ff0)' } : undefined}>
                <img className="osrs-px" src={skillIconSrc(skill)} alt="" aria-hidden="true" width={25} height={25} style={{ margin: '0 1px' }} />
                <span style={{ display: 'flex', flexDirection: 'column', lineHeight: '16px', minWidth: 0 }}>
                  <span style={{ fontFamily: 'RSBold, sans-serif', color: 'var(--osrs-orange, #ff981f)' }}>Stations</span>
                  <span className="osrs-dash-tan-s" style={{ whiteSpace: 'nowrap' }}>Usable from level 1</span>
                </span>
                <span className="osrs-dash-yellow-s" style={{ marginLeft: 'auto' }}>{visibleStations.length || ''}</span>
              </button>
            )}
            {TIER_GEMS.map((g, i) => {
              const t = i + 1;
              const owned = t <= currentTier;
              const next = t === currentTier + 1;
              const on = sel === t;
              const hidden = unlockedOnly && !owned;
              const n = tierCount(t);
              return (
                <button
                  key={g.name}
                  type="button"
                  aria-pressed={on}
                  disabled={hidden}
                  onClick={() => { setRung(t); setOpenNode(null); }}
                  className="osrs-dash-rung"
                  style={{
                    opacity: hidden ? 0.35 : undefined,
                    background: on ? tint(g.color, 0.18) : (owned ? '#352d23' : 'transparent'),
                    boxShadow: on ? `inset 0 0 0 1px ${g.color}` : undefined,
                  }}
                >
                  <OsrsTierMark tier={t} size="row" look={owned ? 'on' : (next ? 'next' : 'off')} framed />
                  <span style={{ display: 'flex', flexDirection: 'column', lineHeight: '16px', minWidth: 0, overflow: 'hidden' }}>
                    <span style={{ fontFamily: 'RSBold, sans-serif', color: owned ? g.color : (next ? 'var(--osrs-orange, #ff981f)' : '#7d705c') }}>Tier {roman(t)}</span>
                    <span className="osrs-dash-tan-s" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Levels {tierBand(t).label}{named(t)}</span>
                  </span>
                  <span style={{ marginLeft: 'auto', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: '15px', whiteSpace: 'nowrap' }}>
                    <span style={{ font: "16px 'RSSmall', sans-serif", color: owned ? 'var(--osrs-green, #0dc10d)' : (next ? 'var(--osrs-yellow, #ff0)' : '#7d705c') }}>
                      {owned ? 'Active' : (next ? 'Next Unlock' : 'Locked')}
                    </span>
                    <span className="osrs-dash-yellow-s">{n ? `${n} ${tab === 'gather' ? 'to gather' : (n === 1 ? 'unlock' : 'unlocks')}` : ''}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div style={{ minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="osrs-sh" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: head.bg, border: '1px solid #000', boxShadow: `inset 0 0 0 1px ${head.edge}` }}>
              {head.gem
                ? <OsrsTierMark tier={head.gem} size="hero" look={head.gem <= currentTier ? 'on' : (head.gem === currentTier + 1 ? 'next' : 'off')} />
                : <img className="osrs-px" src={skillIconSrc(skill)} alt="" aria-hidden="true" width={25} height={25} />}
              <span style={{ display: 'flex', flexDirection: 'column', lineHeight: '18px' }}>
                <span style={{ fontFamily: 'RSBold, sans-serif', color: head.color }}>{head.title}</span>
                <span style={{ color: 'var(--osrs-tan, #c8b897)' }}>{head.sub}</span>
              </span>
              <span style={{ marginLeft: 'auto', color: head.stateColor }}>{head.state}</span>
            </div>
            <div className="osrs-inner custom-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              {body}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OsrsSkillGuide;
