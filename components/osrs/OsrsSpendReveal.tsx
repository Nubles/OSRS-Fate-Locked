import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './osrs-spend.css';
import { getItemDescription } from '../VoidReveal';
import { EntityModel, preloadModelViewer } from '../EntityModel';
import { loadModelManifest, orientationFor } from '../../data/entityModels';
import { useModelFor } from '../../hooks/useModelFor';
import { bankFor } from '../../utils/bankPicture';
import { OsrsBankReveal } from './OsrsBankPicture';
import { OsrsAreaMap } from './OsrsAreaMap';
import { chunksForArea } from '../../utils/areaMapCut';
import { categoryColor, categoryRarity, rarityRank } from '../../utils/rarity';
import { tableDisplayName } from '../../utils/tableDisplay';
import { wikiUrlFor } from '../../constants';
import { TableType } from '../../types';
import { CHAOS_KEY_ICON, KEY_ICON, VOID_SEAL_ICON, osrsSkillIcon, tableSprite, withAlpha } from './OsrsSpendShared';
import { useRevealHost } from './OsrsKeysState';

/** The same props VoidReveal takes, so PendingUnlockReveal can hand either one the roll. */
export interface OsrsSpendRevealProps {
  itemName: string;
  itemType: string;
  itemImage?: string;
  onComplete: () => void;
  isChaos?: boolean;
  animationsEnabled: boolean;
  tier?: number;
  /** Draw inside the wide Spend Keys board's reveal window (when it is open) instead of over the screen. */
  docked?: boolean;
}

type Phase = 'altering' | 'reveal';

const sh: React.CSSProperties = { textShadow: '1px 1px 0 #000' };
const RS = (size = 16, family = 'RS'): React.CSSProperties => ({ font: `${size}px '${family}', sans-serif` });

/**
 * The unlock reveal as an OSRS interface window: the Void altering Fate while
 * the roll plays out, then a loot beam over the unlocked entry. The outcome is
 * already decided and saved by the time this mounts; the wait is only visual.
 */
const OsrsSpendReveal: React.FC<OsrsSpendRevealProps> = ({ itemName, itemType, itemImage, onComplete, isChaos = false, animationsEnabled, tier, docked = false }) => {
  const host = useRevealHost();
  const inDock = docked && !!host;
  const [phase, setPhase] = useState<Phase>(animationsEnabled ? 'altering' : 'reveal');
  const [imageError, setImageError] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const display = tableDisplayName(itemType);

  // Focus the window so a stray Space doesn't press buttons behind it.
  useEffect(() => { ref.current?.focus({ preventScroll: true }); }, [inDock]);

  // Fetch the 3D viewer and model list as the roll starts, so the model is
  // ready when the result shows instead of popping in after it.
  useEffect(() => { loadModelManifest().catch(() => {}); preloadModelViewer(); }, []);

  // Same timeline lengths as the classic reveal: 2.4s for a Key, 2.7s for a Chaos Key.
  useEffect(() => {
    if (!animationsEnabled) { setPhase('reveal'); return; }
    const t = setTimeout(() => setPhase('reveal'), isChaos ? 2700 : 2400);
    return () => clearTimeout(t);
  }, [isChaos, animationsEnabled]);

  const handleCopyFlex = async () => {
    const text = `Fate Locked Ironman Update\nJust unlocked: **${itemName}** (${display})!\n#OSRS #FateLocked`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return; /* clipboard blocked: nothing was copied, so don't claim it was */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const rarity = categoryRarity(itemType);
  const beam = isChaos ? '#ff3030' : categoryColor(itemType);
  const intense = isChaos || rarityRank(rarity) >= rarityRank('epic');
  const isRegion = itemType === TableType.REGIONS || itemType === TableType.CHUNKS;
  const isSkill = itemType === TableType.SKILLS;
  const model = useModelFor(itemName);
  const description = getItemDescription(itemType, itemName, tier);
  const title = phase === 'altering' ? 'Altering Fate...' : isChaos ? 'Chaos unlock' : `${display} unlocked`;
  const costIcon = isChaos ? CHAOS_KEY_ICON : KEY_ICON;
  const image = isSkill ? osrsSkillIcon(itemName) : itemImage;

  const bank = itemType === TableType.BANKS ? bankFor(itemName) : undefined;
  let shown: React.ReactNode;
  if (bank) {
    shown = <OsrsBankReveal bank={bank} animate={animationsEnabled} />;
  } else if (model) {
    // Skills show their skillcape: no skill-icon poster while the cape loads,
    // so a roll never shows the icon on one skill and the cape on another.
    shown = <EntityModel src={model} poster={isSkill ? undefined : itemImage} alt={itemName} size={220} interactive autoRotate={animationsEnabled} orientation={orientationFor(itemName)} />;
  } else if (isRegion && chunksForArea(itemName).length) {
    // An area has no single model: show its piece of the world map instead.
    shown = (
      <div style={{ position: 'relative' }}>
        <OsrsAreaMap name={itemName} maxWidth={340} maxHeight={210} />
        <span className="osrs-tooltip" style={{ position: 'absolute', left: 8, bottom: 6, lineHeight: '16px' }}>Now unlocked</span>
      </div>
    );
  } else if (image && !imageError && isRegion) {
    shown = (
      <div style={{ position: 'relative', maxWidth: 'min(340px, 80vw)', border: '2px solid #000', boxShadow: '0 0 0 1px var(--osrs-bevel-hi, #5c5244), 0 0 0 3px #000', background: '#0e0c0a' }}>
        <img src={image} alt={itemName} onError={() => setImageError(true)} style={{ display: 'block', maxWidth: '100%', maxHeight: 210, objectFit: 'contain' }} />
        <span className="osrs-tooltip" style={{ position: 'absolute', left: 8, bottom: 6, lineHeight: '16px' }}>Now unlocked</span>
      </div>
    );
  } else {
    shown = (
      <div className="osrs-slot" style={{ width: 104, height: 96, marginBottom: 30 }}>
        <img className="osrs-px" src={image && !imageError ? image : tableSprite(itemType)} alt={itemName} onError={() => setImageError(true)}
          style={{ width: isSkill ? 50 : 72, height: isSkill ? 50 : 64, objectFit: 'contain' }} />
      </div>
    );
  }

  const content = (
    <>
        <div style={{ position: 'relative', height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <h2 style={{ margin: 0, ...RS(16, 'RSBold'), color: phase === 'altering' ? '#c77dff' : isChaos ? '#ff3030' : '#ff981f', ...sh }}>{title}</h2>
          {phase === 'reveal' && (
            <button type="button" onClick={onComplete} aria-label="Close" className="osrs-btn" style={{ position: 'absolute', right: 2, top: 1, width: 24, height: 24, padding: 0 }}>
              <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><path d="M2 2l8 8M10 2l-8 8" stroke="#ff981f" strokeWidth="2.5" /></svg>
            </button>
          )}
        </div>

        {phase === 'altering' ? (
          <div className="osrs-inner ospend-rv-body" style={{ position: 'relative', minHeight: 420, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, background: '#120e0b' }}>
            <div style={{ position: 'relative', width: 260, height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="ospend-ring-a" style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px dashed ${isChaos ? '#6a1a1a' : '#4a2a66'}` }} />
              <div className="ospend-ring-b" style={{ position: 'absolute', inset: 26, borderRadius: '50%', border: `4px solid ${isChaos ? '#8a2020' : '#5e2f8a'}`, borderRightColor: '#000', borderBottomColor: isChaos ? '#331212' : '#2a1f33' }} />
              <div className="ospend-ring-c" style={{ position: 'absolute', inset: 56, borderRadius: '50%', border: `3px solid ${isChaos ? '#c43f3f' : '#8a3fc4'}`, borderLeftColor: '#000' }} />
              <div style={{ width: 104, height: 104, borderRadius: '50%', background: '#000', boxShadow: `0 0 0 3px ${isChaos ? '#331212' : '#2a1f33'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img className="osrs-px" src={isChaos ? CHAOS_KEY_ICON : VOID_SEAL_ICON} alt="" aria-hidden="true" style={{ width: 54, height: 48 }} />
              </div>
            </div>
            {/* The model loads and draws its first frame unseen while Fate is altered. */}
            {model && !bank && (
              <div aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, width: 220, height: 220, opacity: 0, pointerEvents: 'none' }}>
                <EntityModel src={model} alt="" size={220} autoRotate={false} orientation={orientationFor(itemName)} />
              </div>
            )}
            <span style={{ ...RS(16, 'RSBold'), color: isChaos ? '#ff3030' : '#c77dff', ...sh }}>{isChaos ? 'Chaos roll' : 'Altering Fate...'}</span>
            <span style={{ ...RS(), color: 'var(--osrs-tan, #c8b897)', ...sh, textAlign: 'center', padding: '0 12px' }}>
              {isChaos ? 'Your Chaos Key is spent on every table at once.' : `Your Key is spent on the ${display} table.`}
            </span>
          </div>
        ) : (
          <div className="osrs-inner ospend-rv-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 0 12px', gap: 8 }}>
            <div style={{ position: 'relative', alignSelf: 'stretch', height: 330, flexShrink: 0, overflow: 'hidden', background: '#1c1712', borderBottom: '1px solid #000' }}>
              {animationsEnabled && (
                <>
                  <div className="ospend-beam" style={{ position: 'absolute', left: '50%', bottom: 40, width: intense ? 84 : 60, height: 290, transform: 'translateX(-50%)', background: withAlpha(beam, 0.14) }} />
                  <div className="ospend-beam" style={{ position: 'absolute', left: '50%', bottom: 40, width: intense ? 40 : 28, height: 290, transform: 'translateX(-50%)', background: withAlpha(beam, 0.3) }} />
                  <div className="ospend-beam" style={{ position: 'absolute', left: '50%', bottom: 40, width: 8, height: 290, transform: 'translateX(-50%)', background: beam, boxShadow: 'inset 2px 0 0 rgba(255,255,255,.6)' }} />
                  <div style={{ position: 'absolute', left: '50%', bottom: 22, width: 260, height: 38, transform: 'translateX(-50%)', borderRadius: '50%', background: withAlpha(beam, 0.28) }} />
                </>
              )}
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 34, display: 'flex', justifyContent: 'center' }}>{shown}</div>
              <span style={{ position: 'absolute', left: 10, top: 8, ...RS(16, 'RSSmall'), color: beam, ...sh }}>
                {isChaos ? 'Chaos unlock' : `${rarity.charAt(0).toUpperCase()}${rarity.slice(1)} unlock`}
              </span>
              <span style={{ position: 'absolute', right: 10, top: 8, display: 'flex', alignItems: 'center', gap: 4, ...RS(16, 'RSSmall'), color: '#ff3030', ...sh }}>
                <img className="osrs-px" src={costIcon} alt="" aria-hidden="true" style={{ width: 22, height: 20 }} />-1 {isChaos ? 'Chaos Key' : 'Key'}
              </span>
            </div>
            <span style={{ ...RS(32, 'RSBold'), lineHeight: '30px', color: '#ffffff', textAlign: 'center', padding: '0 12px', overflowWrap: 'anywhere', ...sh }}>{itemName}</span>
            <span style={{ maxWidth: 460, ...RS(), lineHeight: '19px', color: 'var(--osrs-tan, #c8b897)', textAlign: 'center', padding: '0 12px', ...sh }}>{description}</span>
            <div className="ospend-rv-actions" style={{ marginTop: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <button type="button" className="osrs-btn" onClick={onComplete} style={{ width: 240, height: 36, fontFamily: "'RSBold', sans-serif" }}>Continue</button>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="osrs-btn" onClick={handleCopyFlex} style={{ width: 117, height: 28 }}>
                  {copied ? <span style={{ color: '#00ff00' }}>Copied!</span> : 'Share Flex'}
                </button>
                <a href={wikiUrlFor(itemName)} target="_blank" rel="noopener noreferrer" className="osrs-btn" style={{ width: 117, height: 28, textDecoration: 'none' }}>Wiki</a>
              </div>
            </div>
          </div>
        )}
    </>
  );

  if (inDock) {
    return createPortal(
      <div ref={ref} tabIndex={-1} role="dialog" aria-label={title} className="ospend-docked" style={{ color: '#ff981f', ...RS() }}>
        {content}
      </div>,
      host!,
    );
  }

  return (
    <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}
      style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,.6)', overflowY: 'auto', outline: 'none' }}>
      <div className="osrs-win" style={{ width: 'min(560px, 100%)', margin: 'auto', padding: 4, display: 'flex', flexDirection: 'column', gap: 4, color: '#ff981f', ...RS() }}>
        {content}
      </div>
    </div>
  );
};

export default OsrsSpendReveal;
