import React, { Suspense, useRef } from 'react';
import { lazyWithRetry } from '../../utils/lazyRetry';
import { PanelErrorBoundary } from '../PanelErrorBoundary';
import { PaneFallback } from '../LoadingFallback';
import { OsrsWorldList } from './OsrsWorldList';
import './osrs-world.css';

const RegionMap = lazyWithRetry(() => import('../RegionMap').then(m => ({ default: m.RegionMap })));

/**
 * The dashboard's World tab in the OSRS layout. Map view is the World board
 * (Regions side panel, framed map, footer), drawn by RegionMap in its OSRS
 * mode; List view is the WorldAdvisors board's advisor and region
 * directory (OsrsWorldList). Map / List switch at the foot of the left
 * panel in both. Same rules and handlers as the classic tab.
 */

interface Props {
  worldView: 'LIST' | 'MAP';
  onWorldView: (v: 'LIST' | 'MAP') => void;
  searchQuery: string;
  showOnlyActionable: boolean;
  onUnlockArea: (area: string) => void;
  suspendModals: boolean;
}

export const OsrsWorldTab: React.FC<Props> = ({ worldView, onWorldView, searchQuery, showOnlyActionable, onUnlockArea, suspendModals }) => {
  const viewButtons = (
    <>
      <button type="button" className={`osrs-btn${worldView === 'MAP' ? ' is-on' : ''}`} aria-pressed={worldView === 'MAP'} onClick={() => onWorldView('MAP')} title="Map View">Map</button>
      <button type="button" className={`osrs-btn${worldView === 'LIST' ? ' is-on' : ''}`} aria-pressed={worldView === 'LIST'} onClick={() => onWorldView('LIST')} title="List View">List</button>
    </>
  );
  // RegionMap is memoised on the run's unlocks; it reads the buttons from here.
  const viewButtonsRef = useRef<React.ReactNode>(viewButtons);
  viewButtonsRef.current = viewButtons;

  return (
    <div className="h-full" style={{ padding: '2px 3px 3px' }}>
      {worldView === 'MAP' ? (
        <PanelErrorBoundary name="Region map">
          <Suspense fallback={<PaneFallback />}>
            <RegionMap osrs osrsSideFooter={viewButtonsRef} />
          </Suspense>
        </PanelErrorBoundary>
      ) : (
        <OsrsWorldList searchQuery={searchQuery} showOnlyActionable={showOnlyActionable} onUnlockArea={onUnlockArea}
          suspendModals={suspendModals} viewButtons={viewButtons} />
      )}
    </div>
  );
};

export default OsrsWorldTab;
