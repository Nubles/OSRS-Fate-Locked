import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Download, Image as ImageIcon, X } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useProfiles } from '../context/ProfileContext';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { SectionGuide } from './SectionGuide';
import { getGameMode } from '../config/gameModes';
import { showToast } from '../utils/toast';
import { visibleAreaUnlocks } from '../data/areaMapPolicy';
import { BANK_IDS } from '../data/banks';
import { completionPercent } from '../utils/completion';
import { chunkTotals } from '../utils/runProgress';
import { buildShareCardStats } from '../utils/shareCard';
import { useIsOsrsUi } from '../utils/uiStyle';
import { OsrsTitleBar } from './osrs/OsrsWindowChrome';
import { RS_BOLD, RS_FONT, RS_SMALL, loadRitualFonts } from './rituals/ritualAssets';
import { CARD_H, CARD_W, describeShareCard, drawShareCard, type ShareCardStyle } from './ShareCardCanvas';

/** Per-viewer choices for the card, kept outside the save. */
const STYLE_KEY = 'fate_share_card_style_v1';
const ZOOM_KEY = 'fate_share_card_zoom_v1';

const readChoice = (key: string): string | null => {
  try { return localStorage.getItem(key); } catch { return null; }
};
const writeChoice = (key: string, value: string) => {
  try { localStorage.setItem(key, value); } catch { /* storage blocked: the choice lasts this visit */ }
};

const STYLES: { id: ShareCardStyle; label: string }[] = [
  { id: 'osrs', label: 'OSRS' },
  { id: 'tracker', label: 'Tracker' },
];

export const ShareModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const game = useGame();
  const { activeProfileName } = useProfiles();
  const osrs = useIsOsrsUi();
  const { unlocks, history, gameModeId, customMode, linkedAccount } = game;
  const dialogRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useFocusTrap(dialogRef);
  useEscapeKey(onClose, true);

  const [style, setStyle] = useState<ShareCardStyle>(() => (readChoice(STYLE_KEY) === 'tracker' ? 'tracker' : 'osrs'));
  const [zoom, setZoom] = useState(() => readChoice(ZOOM_KEY) !== 'off');
  const [drawn, setDrawn] = useState(false);
  const [drawError, setDrawError] = useState(false);
  const [redraw, setRedraw] = useState(0);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');

  const stats = useMemo(() => buildShareCardStats({
    unlocks, history, gameModeId, customMode, linkedAccount,
    profileName: activeProfileName,
    keys: game.keys, specialKeys: game.specialKeys, chaosKeys: game.chaosKeys, fatePoints: game.fatePoints,
    restoreCount: game.restoreCount,
    now: Date.now(),
  }), [unlocks, history, gameModeId, customMode, linkedAccount, activeProfileName,
    game.keys, game.specialKeys, game.chaosKeys, game.fatePoints, game.restoreCount]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    setDrawn(false);
    setDrawError(false);
    (async () => {
      await loadRitualFonts(3000);
      if (cancelled) return;
      // Draw off to the side, then copy in, so a half-drawn card never shows.
      const work = document.createElement('canvas');
      await drawShareCard(work, stats, { style, zoom, fonts: { plain: RS_FONT, bold: RS_BOLD, small: RS_SMALL } });
      if (cancelled) return;
      canvas.width = work.width;
      canvas.height = work.height;
      canvas.getContext('2d')?.drawImage(work, 0, 0);
      setDrawn(true);
    })().catch(() => { if (!cancelled) setDrawError(true); });
    return () => { cancelled = true; };
  }, [stats, style, zoom, redraw]);

  const pickStyle = (next: ShareCardStyle) => { setStyle(next); writeChoice(STYLE_KEY, next); };
  const toggleZoom = () => setZoom(z => { writeChoice(ZOOM_KEY, z ? 'off' : 'on'); return !z; });

  const fileName = `fate-locked-${stats.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'run'}-${new Date().toISOString().slice(0, 10)}.png`;

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas || !drawn) return;
    const link = document.createElement('a');
    link.download = fileName;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const copyImage = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !drawn) return;
    try {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob || typeof ClipboardItem === 'undefined') throw new Error('Clipboard images unsupported');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      showToast('Card copied. Paste it into Discord or anywhere else.');
    } catch {
      showToast('This browser can’t copy images. Use Download PNG instead.');
    }
  }, [drawn]);

  // The copied text summary (Discord-friendly), unchanged from the old Stats card.
  const isChunked = gameModeId === 'chunked';
  const generateTextSummary = () => {
    const totalRegions = isChunked ? chunkTotals(unlocks).unlocked : visibleAreaUnlocks(unlocks.regions).length;
    const totalEquipTiers = (Object.values(unlocks.equipment) as number[]).reduce((a, b) => a + b, 0);
    const totalLevel = (Object.values(unlocks.levels) as number[]).reduce((a, b) => a + b, 0);
    return `**Fate Locked Ironman** (${getGameMode(gameModeId).name} mode)
Progression: ${completionPercent(unlocks, gameModeId, customMode)}% | Total Level: ${totalLevel}
Keys: ${game.keys} | Omni: ${game.specialKeys} | Chaos: ${game.chaosKeys}
${isChunked ? 'Chunks' : 'Areas'}: ${totalRegions} Unlocked
Gear Tiers: ${totalEquipTiers}
Bosses: ${unlocks.bosses.length} | Minigames: ${unlocks.minigames.length}
Banks: ${(unlocks.banks ?? []).length}/${BANK_IDS.length}
${stats.restored ? `${stats.restored}\n` : ''}#OSRS #FateLocked`;
  };

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(generateTextSummary());
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch {
      showToast('Copy failed. Your browser blocked the clipboard.');
    }
  };

  const preview = (
    <div className="relative w-full">
      <canvas
        ref={canvasRef}
        width={CARD_W}
        height={CARD_H}
        role="img"
        aria-label={`Share card: ${describeShareCard(stats)}`}
        className={`block w-full h-auto ${osrs ? 'owb-share-card' : 'rounded-md border border-white/10 bg-black'} transition-opacity ${drawn ? 'opacity-100' : 'opacity-40'}`}
        style={{ aspectRatio: `${CARD_W} / ${CARD_H}` }}
      />
      {!drawn && (
        <div className={`absolute inset-0 flex items-center justify-center text-sm ${osrs ? 'owb-sub' : 'text-gray-300'}`} aria-live="polite">
          {drawError ? 'The card could not be drawn.' : 'Drawing card…'}
        </div>
      )}
    </div>
  );

  const footNote = (
    <p className={`text-[11px] font-mono text-center ${osrs ? 'owb-sub' : 'text-gray-500'}`}>
      Run ID: {stats.runId ?? 'not started'} · {stats.history.detail}{stats.restored && ` · ${stats.restored}`}
      {stats.history.ok ? '' : ' (not shown on the card)'}
    </p>
  );

  const zoomBox = (
    <label className={`flex items-center gap-2 cursor-pointer select-none ${osrs ? 'owb-share-zoom' : 'text-xs text-gray-300'}`}>
      <input id="share-card-zoom" type="checkbox" checked={zoom} onChange={toggleZoom} className="accent-amber-500" />
      Zoom to my land
    </label>
  );

  if (osrs) {
    // OSRS layout: one stone window with the Journal's title bar and stone tabs for the two looks.
    return (
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Share run"
        tabIndex={-1}
        onClick={onClose}
        className="fixed inset-0 z-[100] owb-share-backdrop"
      >
        <div className="osrs-win owb-win owb-share" onClick={e => e.stopPropagation()}>
          <OsrsTitleBar title="Share Run" onClose={onClose} tools={<SectionGuide id="SHARE" />} />
          <div className="owb-tabs" role="group" aria-label="Card style">
            {STYLES.map(s => (
              <button key={s.id} type="button" className="owb-tab" aria-pressed={style === s.id} onClick={() => pickStyle(s.id)}>
                {s.label}
              </button>
            ))}
            <span className="ml-auto pb-1">{zoomBox}</span>
          </div>
          <div className="owb-share-body custom-scrollbar flex flex-col items-center gap-3">
            {preview}
            <div className="owb-share-actions">
              <button type="button" className="osrs-btn" onClick={download} disabled={!drawn}>Download PNG</button>
              <button type="button" className="osrs-btn" onClick={copyImage} disabled={!drawn}>Copy image</button>
              <button type="button" className="osrs-btn" onClick={copySummary}>
                {copyStatus === 'copied' ? <span className="owb-ok">Copied!</span> : 'Copy Summary'}
              </button>
              {drawError && <button type="button" className="osrs-btn" onClick={() => setRedraw(n => n + 1)}>Try again</button>}
            </div>
            {footNote}
          </div>
        </div>
      </div>
    );
  }

  const button = 'flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40';

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Share run"
      tabIndex={-1}
      onClick={onClose}
      className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
    >
      <div
        className="mx-auto my-auto w-full max-w-5xl bg-[#0f1115] border border-white/10 rounded-xl shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 sm:px-5 py-3 border-b border-white/10">
          <div className="text-sm font-semibold text-gray-200">Share Run</div>
          <div role="group" aria-label="Card style" className="flex items-center gap-1 p-1 bg-black/40 rounded-full border border-white/10">
            {STYLES.map(s => (
              <button
                key={s.id}
                type="button"
                aria-pressed={style === s.id}
                onClick={() => pickStyle(s.id)}
                className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider transition-colors ${style === s.id ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          {zoomBox}
          <SectionGuide id="SHARE" className="px-1" />
          <button type="button" onClick={onClose} aria-label="Close" className="ml-auto text-gray-500 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="p-3 sm:p-5 flex flex-col items-center gap-4">
          {preview}

          <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
            <button type="button" onClick={download} disabled={!drawn} className={`${button} bg-emerald-700 hover:bg-emerald-600 text-white`}>
              <Download size={15} /> Download PNG
            </button>
            <button type="button" onClick={copyImage} disabled={!drawn} className={`${button} bg-white/10 hover:bg-white/15 text-white border border-white/10`}>
              <ImageIcon size={15} /> Copy image
            </button>
            <button type="button" onClick={copySummary} className={`${button} bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10`}>
              {copyStatus === 'copied' ? <span className="text-green-400">Copied!</span> : <><Copy size={15} /> Copy Summary</>}
            </button>
            {drawError && (
              <button type="button" onClick={() => setRedraw(n => n + 1)} className={`${button} bg-white/5 hover:bg-white/10 text-amber-300 border border-white/10`}>
                Try again
              </button>
            )}
          </div>

          {footNote}
        </div>
      </div>
    </div>
  );
};
