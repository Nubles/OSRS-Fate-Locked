import React, { useEffect, useRef, useState } from 'react';
import { openOsrsScreen, setOsrsKeysTab, useOsrsNav, type OsrsKeysTab } from '../../utils/osrsNav';
import { GUIDES } from '../SectionGuide';
import './osrs-farm.css';

/**
 * The wide Keys screen's own tab strip (Farm Keys / Spend Keys / History),
 * drawn as on the SpendRoll and History boards: stone tabs with their icons,
 * the screen's one-line hint, a "?" with the panel guide and a close button
 * back to the home screen.
 */
const UI = `${import.meta.env.BASE_URL}osrs-ui/`;
export const KEYS_TAB_ICONS: Record<OsrsKeysTab, { src: string; w: number; h: number }> = {
  farm: { src: `${UI}skills/slayer.png`, w: 18, h: 18 },
  spend: { src: `${UI}items/20546.png`, w: 20, h: 18 },
  history: { src: `${UI}quest_point_icon.png`, w: 18, h: 18 },
};
const TABS: { id: OsrsKeysTab; label: string; guide: string }[] = [
  { id: 'farm', label: 'Farm Keys', guide: 'FARM' },
  { id: 'spend', label: 'Spend Keys', guide: 'SPEND' },
  { id: 'history', label: 'History', guide: 'LOG' },
];

const GuidePop: React.FC<{ id: string; onClose: () => void; toggle: React.RefObject<HTMLButtonElement | null> }> = ({ id, onClose, toggle }) => {
  const guide = GUIDES[id];
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // A press on the "?" button is left to its own click, which closes the
    // guide; closing here too would reopen it on that click.
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current && !ref.current.contains(t) && !toggle.current?.contains(t)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [onClose, toggle]);
  if (!guide) return null;
  return (
    <div ref={ref} role="dialog" aria-label={guide.title} className="okeys-guide osrs-win">
      <span className="t">{guide.title}</span>
      <span className="b">{guide.blurb}</span>
      <ul>{guide.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
    </div>
  );
};

export const OsrsKeysTabs: React.FC<{ hint?: string; small?: boolean }> = ({ hint, small }) => {
  const { keysTab } = useOsrsNav();
  const [guide, setGuide] = useState(false);
  const guideBtn = useRef<HTMLButtonElement>(null);
  const cur = TABS.find(t => t.id === keysTab) ?? TABS[0];
  return (
    <div className="okeys-tabs" role="tablist" aria-label="Keys">
      {TABS.map(t => (
        <button key={t.id} type="button" role="tab" aria-selected={keysTab === t.id} className="okeys-tab" onClick={() => setOsrsKeysTab(t.id)}>
          <img className="osrs-px" src={KEYS_TAB_ICONS[t.id].src} alt="" aria-hidden="true" style={{ width: KEYS_TAB_ICONS[t.id].w, height: KEYS_TAB_ICONS[t.id].h }} />
          {t.label}
        </button>
      ))}
      {hint && <span className={`okeys-hint${small ? ' small' : ''}`}>{hint}</span>}
      <span className="okeys-tabs-tools">
        <button ref={guideBtn} type="button" className="osrs-btn okeys-sq" aria-label={`About ${cur.label}`} aria-expanded={guide} onClick={() => setGuide(g => !g)} style={{ fontFamily: "'RSBold', sans-serif" }}>?</button>
        <button type="button" className="osrs-btn okeys-sq" aria-label="Close the Keys screen" title="Back to the home screen" onClick={() => openOsrsScreen('home')}>
          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="2.5" /></svg>
        </button>
        {guide && <GuidePop id={cur.guide} onClose={() => setGuide(false)} toggle={guideBtn} />}
      </span>
    </div>
  );
};
