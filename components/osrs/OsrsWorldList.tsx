import React, { useEffect, useMemo, useState } from 'react';
import { MISTHALIN_AREAS, REGION_GROUPS, wikiUrlFor } from '../../constants';
import { useGame } from '../../context/GameContext';
import { isAreaReachable } from '../../utils/reachability';
import { rankLockedRegions } from '../../utils/regionAdvisor';
import { rankFrontierChunks } from '../../utils/frontierAdvisor';
import { chunkRegion } from '../../utils/chunkAdjacency';
import { chunkContentService } from '../../services/ChunkContentService';
import { displayAreaName } from '../../data/areaMapPolicy';
import { NoteTrigger } from '../NoteTrigger';
import { itemSrc } from './OsrsDashGems';
import './osrs-world.css';

/**
 * The World tab's List view in the OSRS layout (WorldAdvisors board, fitted
 * to the Progression window): the Region Advisor (Frontier Advisor in
 * Chunked) above a region directory in the board's list-row style, and the
 * chosen region's areas beside it with the same Omni-Key unlock and notes
 * as the classic list. Same rules (isAreaReachable) and handlers.
 */

interface Props {
  searchQuery: string;
  showOnlyActionable: boolean;
  onUnlockArea: (area: string) => void;
  suspendModals: boolean;
  viewButtons: React.ReactNode;
}

const MISTHALIN = 'Misthalin';

interface AdvisorRow { id: string; title: string; meta?: string; region?: string; quests: string[]; diaries: string[]; cascadeQuests: string[]; score: number; cascadeScore: number }

/** Region Advisor (named-area modes) or Frontier Advisor (Chunked), ranked the classic way. */
const useAdvisor = (): { heading: string; caption: string; sub: string; empty: string; rows: AdvisorRow[] } => {
  const { unlocks, gameModeId } = useGame();
  const chunked = gameModeId === 'chunked';
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (chunked && !chunkContentService.ready) chunkContentService.init().then((ok) => { if (ok) setTick((t) => t + 1); });
  }, [chunked]);
  const rows = useMemo<AdvisorRow[]>(() => {
    if (!chunked) {
      return rankLockedRegions(unlocks, gameModeId).map((r) => ({
        id: r.id, title: displayAreaName(r.id), meta: r.region, region: r.region,
        quests: r.newQuestNames, diaries: r.newDiaryIds, cascadeQuests: r.cascadeQuestNames, score: r.score, cascadeScore: r.cascadeScore,
      }));
    }
    return rankFrontierChunks(
      unlocks, gameModeId,
      chunkContentService.ready ? (cx, cy) => chunkContentService.contentFor(cx, cy) : undefined,
      chunkContentService.ready ? (cx, cy) => chunkContentService.hasBank(cx, cy) : undefined,
    ).map((r) => {
      const bits: string[] = [];
      if (r.newSkills.length > 0) bits.push(`trains ${r.newSkills.join(', ')}`);
      if (r.content?.hasBank) bits.push('bank');
      if (r.content && r.content.shops > 0) bits.push(`${r.content.shops} shop${r.content.shops > 1 ? 's' : ''}`);
      if (r.content && r.content.monsters > 0) bits.push(`${r.content.monsters} monster${r.content.monsters > 1 ? 's' : ''}`);
      return {
        id: r.key, title: r.label, meta: bits.join(' · ') || undefined, region: chunkRegion(r.key),
        quests: r.newQuestNames, diaries: r.newDiaryIds, cascadeQuests: r.cascadeQuestNames, score: r.score, cascadeScore: r.sortScore,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocks, gameModeId, chunked, tick]);
  return chunked
    ? { heading: 'Frontier Advisor', caption: 'by what opens', sub: 'What your rollable chunks are worth. Hope for the top ones.', empty: 'No frontier yet. Roll your first chunk to open one.', rows }
    : { heading: 'Region Advisor', caption: 'by unlock chain', sub: 'Unlock these areas for the most forward progress.', empty: 'All areas unlocked. Impressive!', rows };
};

export const OsrsWorldList: React.FC<Props> = ({ searchQuery, showOnlyActionable, onUnlockArea, suspendModals, viewButtons }) => {
  const { unlocks, specialKeys, gameModeId, advisorsEnabled } = useGame();
  const adv = useAdvisor();
  const q = searchQuery.toLowerCase();
  const canOmni = gameModeId !== 'chunked' && specialKeys > 0;

  // Every region with its areas, filtered the classic way (search, Actionable).
  const groups = useMemo(() => {
    const all: [string, string[]][] = [[MISTHALIN, MISTHALIN_AREAS], ...Object.entries(REGION_GROUPS)];
    return all.map(([group, areas]) => {
      const got = areas.filter((a) => isAreaReachable(a, unlocks, gameModeId)).length;
      const matchesGroup = group.toLowerCase().includes(q);
      const shown = areas.filter((a) => {
        const free = isAreaReachable(a, unlocks, gameModeId);
        if (searchQuery && !matchesGroup && !a.toLowerCase().includes(q)) return false;
        if (showOnlyActionable && !free && !canOmni) return false;
        return true;
      });
      const hidden = (searchQuery && !matchesGroup && shown.length === 0)
        || (group !== MISTHALIN && showOnlyActionable && got === 0 && !canOmni);
      return { group, areas, got, shown, hidden };
    }).filter((g) => !g.hidden);
  }, [unlocks, gameModeId, q, searchQuery, showOnlyActionable, canOmni]);

  const [selGroup, setSelGroup] = useState<string>(MISTHALIN);
  const [flashArea, setFlashArea] = useState<string | null>(null);
  const current = groups.find((g) => g.group === selGroup) ?? groups[0];

  const pickAdvisor = (row: AdvisorRow) => {
    if (row.region && groups.some((g) => g.group === row.region)) setSelGroup(row.region);
    setFlashArea(row.id);
    window.setTimeout(() => {
      document.querySelector(`[data-owl-area="${CSS.escape(row.id)}"]`)?.scrollIntoView({ block: 'center' });
    }, 30);
    window.setTimeout(() => setFlashArea((a) => (a === row.id ? null : a)), 1800);
  };

  const top = adv.rows.slice(0, 4);
  const topScore = top[0]?.cascadeScore || top[0]?.score || 1;

  return (
    <div className="owl-root">
      <div className="owl-left">
        {advisorsEnabled && <section className="osrs-inner owl-adv" aria-label={adv.heading}>
          <div className="owl-sec-head">
            <img className="osrs-px" src={itemSrc(1538)} alt="" aria-hidden="true" width={23} height={20} style={{ objectFit: 'contain' }} />
            <h3>{adv.heading}</h3>
            <span className="owl-muted-s">{adv.caption}</span>
          </div>
          {top.length > 0 && <p className="owl-sub">{adv.sub}</p>}
          <div role="group" className="owl-adv-list">
            {top.length === 0 && <div className="owl-empty">{adv.empty}</div>}
            {top.map((a, i) => {
              const pct = topScore > 0 ? Math.max(4, Math.round(((a.cascadeScore || a.score) / topScore) * 100)) : 0;
              const names = a.cascadeQuests.slice(0, 3);
              const more = a.cascadeQuests.length - names.length;
              return (
                <button key={a.id} type="button" className={`owl-adv-row${i === 0 ? ' is-top' : ''}`} onClick={() => pickAdvisor(a)}
                  aria-label={`${a.title}: unlocks ${a.quests.length} quests and ${a.diaries.length} diary tiers directly`}>
                  <span className="owl-rank">{i + 1}.</span>
                  <span className="owl-adv-mid">
                    <span className="owl-adv-title"><b>{a.title}</b>{a.meta && <span>{a.meta}</span>}</span>
                    <span className="owl-adv-bar" title={`Cascade impact score: ${a.cascadeScore}`}><span style={{ width: `${pct}%` }} /></span>
                    {a.score > 0 ? (
                      <span className="owl-adv-pills">
                        {a.quests.length > 0 && <span className="owl-pill"><img className="osrs-px" src={`${import.meta.env.BASE_URL}osrs-ui/quest_point_icon.png`} alt="" aria-hidden="true" width={14} height={14} />+{a.quests.length} quest{a.quests.length === 1 ? '' : 's'}</span>}
                        {a.diaries.length > 0 && <span className="owl-pill">+{a.diaries.length} diary tier{a.diaries.length === 1 ? '' : 's'}</span>}
                        <span className="owl-names">{names.join(' · ')}</span>
                        {more > 0 && <span className="owl-more">+{more} more</span>}
                      </span>
                    ) : <span className="owl-names">No new unlocks, but available to complete</span>}
                  </span>
                  <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" style={{ alignSelf: 'center' }}><path d="M2 10L10 2M4 2h6v6" fill="none" stroke={i === 0 ? '#ffff00' : '#8a7c66'} strokeWidth="2" /></svg>
                </button>
              );
            })}
          </div>
          {adv.rows.length > top.length && <div className="owl-foot-note">{adv.rows.length - top.length} more ranked lower</div>}
        </section>}

        <section className="osrs-inner owl-dir" aria-label="Regions">
          <div className="owl-sec-head" style={{ paddingBottom: 2 }}>
            <img className="osrs-px" src={itemSrc(1538)} alt="" aria-hidden="true" width={23} height={20} style={{ objectFit: 'contain' }} />
            <h3>Regions</h3>
            <span className="owl-yellow-s" style={{ marginLeft: 'auto' }}>{groups.reduce((n, g) => n + g.got, 0)}/{groups.reduce((n, g) => n + g.areas.length, 0)} areas</span>
          </div>
          <p className="owl-sub" style={{ borderBottom: '1px solid var(--osrs-inner-ring, #4f4434)', paddingBottom: 5 }}>Tutorial Island is completed onboarding: always free, with no area roll required.</p>
          <div className="owl-dir-list">
            {groups.map((g) => {
              const on = current?.group === g.group;
              const all = g.got === g.areas.length;
              return (
                <button key={g.group} type="button" className={`owl-dir-row${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => setSelGroup(g.group)}
                  data-region-card={g.group} data-examine-name={g.group} data-examine={`${g.group}. ${g.got} of ${g.areas.length} areas unlocked.`}>
                  <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" style={{ flexShrink: 0 }}><path d="M3 1l4 4-4 4" fill="none" stroke="#c8b897" strokeWidth="2" /></svg>
                  {g.got > 0
                    ? <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" style={{ flexShrink: 0 }}><path d="M1 6l3 3 7-7" fill="none" stroke="#0dc10d" strokeWidth="2" /></svg>
                    : <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" style={{ flexShrink: 0 }}><rect x="2" y="5" width="8" height="6" fill="#b83030" /><path d="M4 5V3.5a2 2 0 0 1 4 0V5" fill="none" stroke="#b83030" strokeWidth="1.5" /></svg>}
                  <span className="owl-dir-name" style={{ color: g.got > 0 ? '#ffffff' : '#8a7c66' }}>{g.group === MISTHALIN ? 'Misthalin (Starter Area)' : g.group}</span>
                  <span className="owl-dir-count" style={{ color: all ? '#0dc10d' : g.got > 0 ? '#ffff00' : '#6f6250' }}>{all ? 'Unlocked' : `${g.got}/${g.areas.length}`}</span>
                </button>
              );
            })}
            {groups.length === 0 && <div className="owl-empty">No regions match "{searchQuery}".</div>}
          </div>
          <div className="owl-viewbtns">{viewButtons}</div>
        </section>
      </div>

      {current && (
        <section className="osrs-win owl-areas" aria-label={current.group}>
          <div className="owl-areas-head">
            <h3>{current.group === MISTHALIN ? 'Misthalin (Starter Area)' : current.group}</h3>
            <span className="owl-yellow-s">{current.got} / {current.areas.length} unlocked</span>
            <span className="owl-legend"><span style={{ color: '#0dc10d' }}>Unlocked</span>{canOmni && <span style={{ color: '#c77dff' }}>Omni-Key</span>}<span style={{ color: '#ff3030' }}>Locked</span></span>
            <span className="oact-note"><NoteTrigger id={current.group} title={current.group} suspendModals={suspendModals} /></span>
          </div>
          <div className="osrs-inner owl-area-list">
            {current.shown.map((area) => {
              const free = isAreaReachable(area, unlocks, gameModeId);
              const canUnlock = !free && canOmni;
              return (
                <div key={area} className={`owl-area${flashArea === area ? ' is-flash' : ''}`} data-owl-area={area}
                  data-examine-name={area} data-examine={`${area}. ${free ? 'Unlocked: you can go here.' : 'Locked.'}`}>
                  {free
                    ? <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" style={{ flexShrink: 0 }}><path d="M1 6l3 3 7-7" fill="none" stroke="#0dc10d" strokeWidth="2" /></svg>
                    : <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" style={{ flexShrink: 0 }}><rect x="2" y="5" width="8" height="6" fill={canUnlock ? '#c77dff' : '#6f6250'} /><path d="M4 5V3.5a2 2 0 0 1 4 0V5" fill="none" stroke={canUnlock ? '#c77dff' : '#6f6250'} strokeWidth="1.5" /></svg>}
                  <a className="owl-area-name" href={wikiUrlFor(area)} target="_blank" rel="noopener noreferrer" style={{ color: free ? '#ffffff' : canUnlock ? '#c77dff' : '#8a7c66' }}>{displayAreaName(area)}</a>
                  {free ? <span className="owl-tag" style={{ background: '#0f3a0f', color: '#0dc10d' }}>Unlocked</span>
                    : canUnlock ? (
                      <button type="button" className="osrs-btn owl-omni" onClick={() => onUnlockArea(area)} title={`Unlock ${area} with an Omni-Key`}>
                        <img className="osrs-px" src={itemSrc('omni_key')} alt="" aria-hidden="true" width={18} height={16} />Unlock
                      </button>
                    ) : <span className="owl-tag" style={{ background: '#3a1414', color: '#ff5050' }}>Locked</span>}
                </div>
              );
            })}
            {current.shown.length === 0 && <div className="owl-empty">Nothing to show here with these filters.</div>}
          </div>
          <div className="oact-msg" style={{ borderTop: 0, border: '2px solid #000', marginTop: 0 }}>
            <img className="osrs-px" src={itemSrc('omni_key')} alt="" aria-hidden="true" width={27} height={24} />
            <span>{gameModeId === 'chunked'
              ? 'In Chunked mode, chunks are the only territory: an area opens as you unlock its chunks.'
              : <>Roll the Areas table with a Key, or spend an Omni-Key to pick a locked area. You have <span style={{ color: '#7f0000' }}>{specialKeys} Omni-Key{specialKeys === 1 ? '' : 's'}</span>.</>}</span>
          </div>
        </section>
      )}
    </div>
  );
};

export default OsrsWorldList;
