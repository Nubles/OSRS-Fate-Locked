import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Share2, Download, Copy } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useProfiles } from '../context/ProfileContext';
import { REGION_GROUPS, MISTHALIN_AREAS } from '../constants';
import {
  MAP_IMAGE, MAP_BOUNDS, CHUNK_TILES,
  tileToPixel, ChunkCoord,
} from '../utils/mapCoords';
import { ensureChain, verifyChain, computeRunId, replayInvariants } from '../utils/integrity';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { getGameMode } from '../config/gameModes';

// ---- mini-map drawing -------------------------------------------------------

const CARD_MAP_W = 380;
const CARD_MAP_H = 268;
// Match html2canvas scale exactly so it copies our canvas 1:1 (no re-sampling).
const MAP_OVERSAMPLE = 2;

const ALWAYS_UNLOCKED = new Set(['Misthalin']);

const drawMiniMap = (
  canvas: HTMLCanvasElement,
  draftChunks: Record<string, ChunkCoord[]>,
  unlockedRegions: string[],
) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = MAP_IMAGE.src;

  const W = CARD_MAP_W * MAP_OVERSAMPLE;
  const H = CARD_MAP_H * MAP_OVERSAMPLE;

  const render = () => {
    // Ensure internal buffer matches oversampled target
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;

    ctx.imageSmoothingEnabled = true;
    (ctx as any).imageSmoothingQuality = 'high';

    ctx.clearRect(0, 0, W, H);

    // Multi-pass halving downscale: halving each step lets the browser apply
    // clean bilinear filtering per pass, preserving detail far better than a
    // single-shot drawImage from 6145×4353 → final.
    let srcW: number = MAP_IMAGE.width;
    let srcH: number = MAP_IMAGE.height;
    let src: CanvasImageSource = img;
    while (srcW > W * 2 && srcH > H * 2) {
      const nextW = Math.round(srcW / 2);
      const nextH = Math.round(srcH / 2);
      const step = document.createElement('canvas');
      step.width = nextW; step.height = nextH;
      const sctx = step.getContext('2d')!;
      sctx.imageSmoothingEnabled = true;
      (sctx as any).imageSmoothingQuality = 'high';
      sctx.drawImage(src, 0, 0, nextW, nextH);
      src = step;
      srcW = nextW;
      srcH = nextH;
    }
    ctx.drawImage(src, 0, 0, W, H);

    // Dim the map
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, W, H);

    // Scale factors: image pixel → card pixel (oversampled)
    const sx = W / MAP_IMAGE.width;
    const sy = H / MAP_IMAGE.height;

    // Chunk size in card pixels
    const TILE_W = MAP_BOUNDS.tileMaxX - MAP_BOUNDS.tileMinX;
    const TILE_H = MAP_BOUNDS.tileMaxY - MAP_BOUNDS.tileMinY;
    const chunkPx = (CHUNK_TILES / TILE_W) * MAP_IMAGE.width * sx;
    const chunkPy = (CHUNK_TILES / TILE_H) * MAP_IMAGE.height * sy;

    const unlockedSet = new Set(unlockedRegions);
    const parentContinent: Record<string, string> = {};
    for (const [cont, subs] of Object.entries(REGION_GROUPS)) {
      for (const s of subs) parentContinent[s] = cont;
    }
    for (const s of MISTHALIN_AREAS) parentContinent[s] = 'Misthalin';

    const isUnlocked = (region: string) => {
      if (ALWAYS_UNLOCKED.has(region)) return true;
      if (unlockedSet.has(region)) return true;
      const cont = parentContinent[region];
      if (cont) {
        if (ALWAYS_UNLOCKED.has(cont) || unlockedSet.has(cont)) return true;
        const siblings = cont === 'Misthalin' ? MISTHALIN_AREAS : (REGION_GROUPS[cont] ?? []);
        if (siblings.length > 0 && siblings.every(s => unlockedSet.has(s) || ALWAYS_UNLOCKED.has(s))) return true;
      }
      const children = region === 'Misthalin' ? MISTHALIN_AREAS : REGION_GROUPS[region];
      if (children?.length && children.every(s => unlockedSet.has(s) || ALWAYS_UNLOCKED.has(s))) return true;
      return false;
    };

    for (const [region, chunks] of Object.entries(draftChunks)) {
      const unlocked = isUnlocked(region);
      ctx.fillStyle = unlocked ? 'rgba(16,185,129,0.55)' : 'rgba(239,68,68,0.45)';
      for (const { cx, cy } of chunks) {
        const { px, py } = tileToPixel({ tx: cx * CHUNK_TILES, ty: (cy + 1) * CHUNK_TILES });
        ctx.fillRect(px * sx, py * sy, chunkPx, chunkPy);
      }
    }

    // Subtle grid
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 0.5 * MAP_OVERSAMPLE;
    for (let x = 0; x <= W; x += chunkPx) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y <= H; y += chunkPy) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
  };

  if (img.complete) render();
  else img.onload = render;
};

// ---- helpers -----------------------------------------------------------------

const loadDraftChunks = (): Record<string, ChunkCoord[]> => {
  try {
    const raw = localStorage.getItem('fate-region-chunks-draft-v1');
    if (raw) return JSON.parse(raw);
    const backup = localStorage.getItem('fate-region-chunks-backup-v1');
    if (backup) return JSON.parse(backup);
  } catch { /* ignore */ }
  return {};
};

const formatDate = (ts: number) =>
  new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

const daysSince = (ts: number) =>
  Math.max(1, Math.floor((Date.now() - ts) / 86_400_000) + 1);

// ---- card component (off-screen) --------------------------------------------

interface CardInnerProps {
  profileName: string;
  stats: {
    rolls: number;
    successes: number;
    omnis: number;
    pities: number;
    unlocks: number;
    keys: number;
    specialKeys: number;
    chaosKeys: number;
  };
  regionsUnlocked: number;
  regionsTotal: number;
  fatePoints: number;
  firstTs: number;
  runId: string | null;
  integrityOk: boolean;
  modeName: string;
}

const CardInner = React.forwardRef<HTMLDivElement, CardInnerProps>(({
  profileName, stats, regionsUnlocked, regionsTotal,
  fatePoints, firstTs, runId, integrityOk, modeName,
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const draftChunks = loadDraftChunks();
  const { unlocks } = useGame();

  useEffect(() => {
    if (canvasRef.current) {
      drawMiniMap(canvasRef.current, draftChunks, unlocks.regions);
    }
  }, []);

  const days = daysSince(firstTs);
  const successRate = stats.rolls === 0 ? 0 : Math.round((stats.successes / stats.rolls) * 100);

  return (
    <div
      ref={ref}
      style={{ width: 800, height: 450, fontFamily: 'system-ui, sans-serif' }}
      className="relative overflow-hidden bg-[#0a0c0f] flex flex-col"
    >
      {/* Background grain texture */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/carbon-fibre.png")' }} />

      {/* Gold top border accent */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-amber-500 to-transparent" />

      {/* ---- Header ---- */}
      <div className="relative z-10 flex items-center justify-between px-6 pt-5 pb-3">
        <div>
          <div className="text-[10px] tracking-[0.25em] text-amber-500/80 uppercase font-semibold mb-0.5">
            Fate Locked Ironman · {modeName}
          </div>
          <div className="text-2xl font-bold text-white tracking-wide">{profileName}</div>
        </div>
        <div className="flex flex-col items-end gap-1.5 text-right">
          {/*
            html2canvas mis-renders flex vertical centering, so this pill uses
            the inline-layout + vertical-align: middle technique instead. The
            container's line-height defines the baseline strip, and every inline
            child aligns to the middle of the x-height, which html2canvas
            reproduces faithfully.
          */}
          {/* Vertical padding (not fixed height + line-height) centers the
              text reliably in html2canvas, which ignores half-leading. */}
          <div
            style={{
              display: 'inline-block',
              padding: '4px 11px',
              lineHeight: 1,
              borderRadius: 999,
              border: `1px solid ${integrityOk ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.5)'}`,
              background: integrityOk ? 'rgba(6,44,34,0.8)' : 'rgba(60,8,8,0.8)',
              color: integrityOk ? '#6ee7b7' : '#fca5a5',
              fontWeight: 600,
              fontSize: 11,
              letterSpacing: '0.04em',
              whiteSpace: 'nowrap',
            }}
          >
            {/* html2canvas pins text to the baseline (bottom of the box), so a
                relative upward shift — which it DOES honor — re-centers it. */}
            <span style={{ display: 'inline-block', position: 'relative', top: -8 }}>
              <span
                style={{
                  display: 'inline-block',
                  width: 8, height: 8, borderRadius: '50%',
                  verticalAlign: 'middle',
                  marginRight: 7,
                  background: integrityOk ? '#34d399' : '#f87171',
                  boxShadow: integrityOk ? '0 0 6px rgba(52,211,153,0.7)' : '0 0 6px rgba(248,113,113,0.7)',
                  // The dot is an inline-block box (not baseline-pinned like the
                  // text), so it didn't need the wrapper's upward shift — push it
                  // back down to sit level with the VERIFIED caps.
                  position: 'relative',
                  top: 7,
                }}
              />
              <span style={{ verticalAlign: 'middle' }}>
                {integrityOk ? 'VERIFIED' : 'UNVERIFIED'}
              </span>
            </span>
          </div>
          <div className="text-[10px] text-gray-500 font-mono" style={{ lineHeight: 1 }}>
            Day {days} · Since {formatDate(firstTs)}
          </div>
        </div>
      </div>

      {/* ---- Body ---- */}
      <div className="relative z-10 flex flex-1 gap-0 overflow-hidden">
        {/* Mini map */}
        <div className="relative flex-shrink-0">
          <canvas
            ref={canvasRef}
            width={CARD_MAP_W * MAP_OVERSAMPLE}
            height={CARD_MAP_H * MAP_OVERSAMPLE}
            style={{ display: 'block', width: CARD_MAP_W, height: CARD_MAP_H }}
          />
          {/* Regions overlay on map (inline-block + vertical-align so
              html2canvas renders the dot/text aligned, not flex). */}
          <div
            className="absolute bottom-2 left-2 bg-black/70 px-2.5 py-1 rounded font-mono text-white/80"
            style={{ fontSize: 10, lineHeight: '14px', whiteSpace: 'nowrap' }}
          >
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#10b981', verticalAlign: 'middle', marginRight: 6, position: 'relative', top: -1 }} />
            <span style={{ verticalAlign: 'middle' }}>{regionsUnlocked}/{regionsTotal} regions</span>
          </div>
        </div>

        {/* Stats column */}
        <div className="flex-1 flex flex-col justify-between px-5 py-3">
          {/* Big numbers */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <StatBlock label="Total Rolls" value={stats.rolls} />
            <StatBlock label="Success Rate" value={`${successRate}%`} />
            <StatBlock label="Keys Held" value={stats.keys} accent="text-amber-300" />
            <StatBlock label="Fate Points" value={`${fatePoints}/50`} />
            <StatBlock label="Omni-Keys" value={stats.omnis} accent="text-purple-300" />
            <StatBlock label="Chaos Keys" value={stats.chaosKeys} accent="text-rose-300" />
            <StatBlock label="Pity Keys" value={stats.pities} accent="text-sky-300" />
            <StatBlock label="Total Unlocks" value={stats.unlocks} accent="text-emerald-300" />
          </div>

          {/* Key inventory bar */}
          <div className="mt-3 border border-white/8 rounded-lg p-3 bg-white/[0.02]">
            <div className="text-[9px] tracking-widest text-gray-500 uppercase mb-2">Key Inventory</div>
            <div className="flex gap-4">
              <KeyChip label="Standard" count={stats.keys} color="amber" />
              <KeyChip label="Omni" count={stats.specialKeys} color="purple" />
              <KeyChip label="Chaos" count={stats.chaosKeys} color="rose" />
            </div>
          </div>
        </div>
      </div>

      {/* ---- Footer ---- */}
      <div className="relative z-10 flex items-center justify-between px-6 py-2.5 border-t border-white/5">
        <div className="text-[9px] font-mono text-gray-600 tracking-wider">
          {runId ?? 'run-not-started'}
        </div>
        <div className="text-[9px] tracking-[0.2em] text-amber-500/50 uppercase font-semibold">
          fatelocked.ironman
        </div>
      </div>

      {/* Bottom border accent */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
    </div>
  );
});

const StatBlock: React.FC<{ label: string; value: React.ReactNode; accent?: string }> = ({ label, value, accent = 'text-white' }) => (
  <div className="flex flex-col">
    <div className="text-[9px] tracking-[0.15em] uppercase text-gray-500 mb-1 leading-none">{label}</div>
    <div className={`text-xl font-bold font-mono leading-none tabular-nums ${accent}`}>{value}</div>
  </div>
);

const KeyChip: React.FC<{ label: string; count: number; color: 'amber' | 'purple' | 'rose' }> = ({ label, count, color }) => {
  const palette = {
    amber:  { border: 'rgba(245,158,11,0.35)',  text: '#fcd34d', bg: 'rgba(69,26,3,0.45)',  dot: '#f59e0b' },
    purple: { border: 'rgba(168,85,247,0.35)',  text: '#d8b4fe', bg: 'rgba(46,16,101,0.45)', dot: '#a855f7' },
    rose:   { border: 'rgba(244,63,94,0.35)',   text: '#fda4af', bg: 'rgba(76,5,25,0.45)',   dot: '#f43f5e' },
  }[color];
  // Center with text-align (not flex items-center): html2canvas mis-renders
  // flexbox centering, leaving the number/label hugging the left edge.
  return (
    <div
      style={{
        fontFamily: 'ui-monospace, monospace',
        textAlign: 'center',
        border: `1px solid ${palette.border}`,
        background: palette.bg,
        borderRadius: 6,
        padding: '6px 12px',
        minWidth: 72,
        color: palette.text,
      }}
    >
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          lineHeight: 1.15,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {count}
      </div>
      <div
        style={{
          fontSize: 9,
          marginTop: 3,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: '#9ca3af',
          lineHeight: 1.15,
        }}
      >
        {label}
      </div>
    </div>
  );
};

// ---- modal / trigger --------------------------------------------------------

export const RunCardModal: React.FC<{ onClose: () => void; embedded?: boolean }> = ({ onClose, embedded }) => {
  const { history, unlocks, keys, specialKeys, chaosKeys, fatePoints, gameModeId } = useGame();
  const { activeProfileName } = useProfiles();
  const cardRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);
  const [capturing, setCapturing] = useState(false);
  const [captured, setCaptured] = useState<string | null>(null);

  const chained = React.useMemo(() => ensureChain(history), [history]);
  const chainReport = React.useMemo(() => verifyChain(chained), [chained]);
  const replayData = React.useMemo(() => replayInvariants(chained), [chained]);
  const runId = React.useMemo(() => computeRunId(chained), [chained]);
  const firstTs = chained[0]?.timestamp ?? Date.now();

  const regionsTotal = Object.values(REGION_GROUPS).reduce((a, b) => a + b.length, 0) + MISTHALIN_AREAS.length;
  const regionsUnlocked = unlocks.regions.length + (MISTHALIN_AREAS.length); // Misthalin always unlocked

  const cardProps: CardInnerProps = {
    profileName: activeProfileName,
    stats: {
      ...replayData.final,
      keys,
      specialKeys,
      chaosKeys,
    },
    regionsUnlocked,
    regionsTotal,
    fatePoints,
    firstTs,
    runId,
    integrityOk: chainReport.ok,
    modeName: getGameMode(gameModeId).name,
  };

  const capture = useCallback(async () => {
    if (!cardRef.current) return;
    setCapturing(true);
    try {
      // Wait a tick for the (two-pass oversampled) canvas to finish drawing
      await new Promise(r => setTimeout(r, 500));
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#0a0c0f',
        scale: 2,
        logging: false,
      });
      setCaptured(canvas.toDataURL('image/png'));
    } finally {
      setCapturing(false);
    }
  }, []);

  useEffect(() => { capture(); }, []);

  const download = () => {
    if (!captured) return;
    const a = document.createElement('a');
    a.href = captured;
    a.download = `fate-locked-${activeProfileName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
  };

  const copyToClipboard = async () => {
    if (!captured) return;
    try {
      const blob = await (await fetch(captured)).blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    } catch {
      // Fallback: open in new tab for manual save
      window.open(captured, '_blank');
    }
  };

  const body = (
    <>
      {/* Preview */}
      <div className="p-5 flex flex-col items-center gap-4">
        {captured ? (
          <img src={captured} alt="Run card preview" className="rounded-lg shadow-xl w-full max-w-2xl border border-white/10" />
        ) : (
          <div className="w-full max-w-2xl h-[225px] bg-[#0a0c0f] rounded-lg border border-white/10 flex items-center justify-center">
            <div className="text-gray-500 text-sm animate-pulse">Rendering card…</div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={download}
            disabled={!captured}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-40 transition-colors"
          >
            <Download size={15} />
            Download PNG
          </button>
          <button
            onClick={copyToClipboard}
            disabled={!captured}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-medium disabled:opacity-40 transition-colors border border-white/10"
          >
            <Copy size={15} />
            Copy to Clipboard
          </button>
          <button
            onClick={capture}
            disabled={capturing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-sm disabled:opacity-40 transition-colors border border-white/10"
          >
            {capturing ? 'Rendering…' : 'Re-render'}
          </button>
        </div>

        <div className="text-[10px] font-mono text-gray-600 text-center">
          {runId ?? '—'} · {chainReport.ok ? '✓ chain verified' : `⚠ ${chainReport.brokenAt.length} broken links`}
        </div>
      </div>

      {/* Off-screen card (source for html2canvas) */}
      <div style={{ position: 'absolute', left: -9999, top: -9999, pointerEvents: 'none' }}>
        <CardInner ref={cardRef} {...cardProps} />
      </div>
    </>
  );

  // Embedded: host (merged ShareModal) provides the overlay + header.
  if (embedded) return body;

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Run card" tabIndex={-1} className="fixed inset-0 z-[110] bg-black/80 flex items-center justify-center p-6">
      <div className="bg-[#0f1115] border border-white/10 rounded-xl shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-200">
            <Share2 size={16} className="text-amber-400" /> Run Card
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
        </div>
        {body}
      </div>
    </div>
  );
};
