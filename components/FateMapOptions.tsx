import React from 'react';
import { Cloud, Gem, Map as MapIcon, Sparkles } from 'lucide-react';
import type { FateMapPref } from '../utils/fateMapPrefs';
import { setFateMapPref, useFateMapPref } from '../utils/fateMapPrefsHook';

/**
 * Chunked's map options in the settings menu: fog over land the run doesn't
 * hold, fate's spin on chunk draws, fate's omens, and Fated sites and region seals on the map
 * (utils/fateMapPrefs.ts, per viewer). The OSRS header and the classic header each show them for a
 * Chunked run; the classic one loads this lazily.
 */
const OPTIONS: { pref: FateMapPref; label: string }[] = [
  { pref: 'fog', label: "Fog over land you don't hold" },
  { pref: 'spin', label: "Fate's spin on chunk draws" },
  { pref: 'marks', label: "Fate's omens on the map" },
  { pref: 'sites', label: 'Fated sites and region seals on the map' },
];

export const FateMapOptions: React.FC<{ osrs?: boolean }> = ({ osrs = false }) => {
  const fog = useFateMapPref('fog');
  const spin = useFateMapPref('spin');
  const marks = useFateMapPref('marks');
  const sites = useFateMapPref('sites');
  const value = { fog, spin, marks, sites };
  return (
    <>
      {OPTIONS.map(({ pref, label }) => {
        const on = value[pref];
        if (osrs) {
          return (
            <button key={pref} type="button" className="osrs-menu-item" onClick={() => setFateMapPref(pref, !on)} aria-pressed={on}>
              {label} <span className="osrs-menu-state" style={{ color: on ? '#00ff00' : '#ff3030' }}>{on ? 'on' : 'off'}</span>
            </button>
          );
        }
        const Icon = pref === 'fog' ? Cloud : pref === 'spin' ? MapIcon : pref === 'sites' ? Gem : Sparkles;
        return (
          <button key={pref} type="button" role="menuitemcheckbox" onClick={() => setFateMapPref(pref, !on)} aria-checked={on}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 focus-visible:outline-none focus-visible:bg-white/10 text-gray-300 hover:bg-white/5 hover:text-white">
            <Icon size={13} className={on ? 'text-amber-400' : 'text-gray-500'} />
            {label} <span className="ml-auto text-[10px] text-gray-500">{on ? 'on' : 'off'}</span>
          </button>
        );
      })}
    </>
  );
};

export default FateMapOptions;
