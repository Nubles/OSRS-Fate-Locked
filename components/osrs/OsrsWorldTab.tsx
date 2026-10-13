import React, { Suspense } from 'react';
import { MISTHALIN_AREAS, REGION_GROUPS, REGION_ICONS, wikiUrlFor } from '../../constants';
import { useGame } from '../../context/GameContext';
import { isAreaReachable } from '../../utils/reachability';
import { lazyWithRetry } from '../../utils/lazyRetry';
import { NoteTrigger } from '../NoteTrigger';
import { PanelErrorBoundary } from '../PanelErrorBoundary';
import { PaneFallback } from '../LoadingFallback';
import { RegionAdvisorPanel } from '../RegionAdvisorPanel';
import { FrontierAdvisorPanel } from '../FrontierAdvisorPanel';
import './osrs-dashboard.css';

const RegionMap = lazyWithRetry(() => import('../RegionMap').then(m => ({ default: m.RegionMap })));

/**
 * The dashboard's World tab in the OSRS layout: a Map / List switch, the
 * region map in an inset frame, and in List view each region group as an
 * OSRS window of area slots (green: reachable, purple: buy with an
 * Omni-Key, dark: locked). Same rules and handlers as the classic tab.
 */

interface Props {
  worldView: 'LIST' | 'MAP';
  onWorldView: (v: 'LIST' | 'MAP') => void;
  searchQuery: string;
  showOnlyActionable: boolean;
  onUnlockArea: (area: string) => void;
  suspendModals: boolean;
}

const AreaChip: React.FC<{ area: string; free: boolean; canUnlock: boolean; onUnlock: () => void; showLock?: boolean }> = ({ area, free, canUnlock, onUnlock, showLock = true }) => {
  if (free) {
    return (
      <a href={wikiUrlFor(area)} target="_blank" rel="noopener noreferrer" className="osrs-dash-area is-free"
        data-examine-name={area} data-examine={`${area}. Unlocked: you can go here.`}>
        {area}
      </a>
    );
  }
  return (
    <button type="button" onClick={() => canUnlock && onUnlock()} disabled={!canUnlock}
      className={`osrs-dash-area ${canUnlock ? 'is-buy' : 'is-locked'}`}
      title={canUnlock ? `Unlock ${area} with an Omni-Key` : undefined}
      data-examine-name={area} data-examine={`${area}. Locked.`}>
      {area}
      {(showLock || canUnlock) && (
        <svg aria-hidden="true" width="9" height="11" viewBox="0 0 12 14"><rect x="1.5" y="6" width="9" height="7" fill="currentColor" /><path d="M3.5 6V4a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
      )}
    </button>
  );
};

export const OsrsWorldTab: React.FC<Props> = ({ worldView, onWorldView, searchQuery, showOnlyActionable, onUnlockArea, suspendModals }) => {
  const { unlocks, specialKeys, gameModeId, advisorsEnabled } = useGame();
  const q = searchQuery.toLowerCase();

  const misthalinFree = MISTHALIN_AREAS.filter(a => isAreaReachable(a, unlocks, gameModeId)).length;
  const misthalinAllFree = misthalinFree === MISTHALIN_AREAS.length;

  return (
    <div className="flex flex-col h-full overflow-hidden gap-1">
      <div className="osrs-inner osrs-dash-worldbar shrink-0">
        <h3 className="osrs-title" style={{ margin: 0 }}>Areas</h3>
        <span className="osrs-dash-tan-s" style={{ minWidth: 0 }}>Tutorial Island is completed onboarding: always free, with no area roll required.</span>
        <div role="group" aria-label="World view" style={{ marginLeft: 'auto', display: 'flex', gap: 3 }}>
          <button type="button" className={`osrs-btn${worldView === 'MAP' ? ' is-on' : ''}`} style={{ height: 26 }} aria-pressed={worldView === 'MAP'} onClick={() => onWorldView('MAP')} title="Map View">Map</button>
          <button type="button" className={`osrs-btn${worldView === 'LIST' ? ' is-on' : ''}`} style={{ height: 26 }} aria-pressed={worldView === 'LIST'} onClick={() => onWorldView('LIST')} title="List View">List</button>
        </div>
      </div>

      {worldView === 'MAP' ? (
        <div className="flex-1 overflow-hidden relative osrs-dash-mapframe">
          <PanelErrorBoundary name="Region map">
            <Suspense fallback={<PaneFallback />}>
              <RegionMap />
            </Suspense>
          </PanelErrorBoundary>
        </div>
      ) : (
        <div className="h-full overflow-y-auto pr-1 custom-scrollbar pb-4 flex flex-col gap-2">
          {advisorsEnabled && (gameModeId === 'chunked' ? <FrontierAdvisorPanel /> : <RegionAdvisorPanel />)}

          <section className="osrs-win osrs-dash-region" aria-label="Misthalin (Starter Area)">
            <div className="osrs-dash-region-head">
              <img className="osrs-px" src={`https://oldschool.runescape.wiki/images/${REGION_ICONS['Misthalin']}`} alt="" aria-hidden="true" width={22} height={22} />
              <span className="osrs-title">Misthalin (Starter Area)</span>
              <span className="osrs-dash-yellow-s" style={{ marginLeft: 'auto', color: misthalinAllFree ? 'var(--osrs-green, #0dc10d)' : undefined }}>
                {misthalinAllFree ? 'Unlocked' : `${misthalinFree}/${MISTHALIN_AREAS.length}`}
              </span>
              <NoteTrigger id="Misthalin" title="Misthalin" suspendModals={suspendModals} />
            </div>
            <div className="osrs-inner osrs-dash-areas">
              {MISTHALIN_AREAS.map(area => {
                const free = isAreaReachable(area, unlocks, gameModeId);
                const canUnlock = !free && gameModeId !== 'chunked' && specialKeys > 0;
                return <AreaChip key={area} area={area} free={free} canUnlock={canUnlock} onUnlock={() => onUnlockArea(area)} />;
              })}
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {Object.entries(REGION_GROUPS).map(([group, areas]) => {
              const unlockedCount = areas.filter(a => isAreaReachable(a, unlocks, gameModeId)).length;
              const matchesGroup = group.toLowerCase().includes(q);
              const matchesArea = areas.some(a => a.toLowerCase().includes(q));
              if (searchQuery && !matchesGroup && !matchesArea) return null;
              const canUnlockAny = gameModeId !== 'chunked' && specialKeys > 0;
              if (showOnlyActionable && unlockedCount === 0 && !canUnlockAny) return null;

              return (
                <section key={group} data-region-card={group} className="osrs-win osrs-dash-region" aria-label={group}
                  data-examine-name={group} data-examine={`${group}. ${unlockedCount} of ${areas.length} areas unlocked.`}>
                  <div className="osrs-dash-region-head">
                    <img className="osrs-px" src={`https://oldschool.runescape.wiki/images/${REGION_ICONS[group] || 'Globe_icon.png'}`} alt="" aria-hidden="true" width={22} height={22} />
                    <span className="osrs-title">{group}</span>
                    <span className="osrs-dash-yellow-s" style={{ marginLeft: 'auto' }}>{unlockedCount}/{areas.length}</span>
                    <NoteTrigger id={group} title={group} suspendModals={suspendModals} />
                  </div>
                  <div className="osrs-inner osrs-dash-areas">
                    {areas.map(area => {
                      const isUnlocked = isAreaReachable(area, unlocks, gameModeId);
                      const canUnlock = !isUnlocked && gameModeId !== 'chunked' && specialKeys > 0;
                      if (searchQuery && !matchesGroup && !area.toLowerCase().includes(q)) return null;
                      if (showOnlyActionable && !isUnlocked && !canUnlock) return null;
                      return <AreaChip key={area} area={area} free={isUnlocked} canUnlock={canUnlock} showLock={false} onUnlock={() => onUnlockArea(area)} />;
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default OsrsWorldTab;
