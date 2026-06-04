import React, { useEffect, useRef, useState } from 'react';

/**
 * Renders a 3D entity model with Google's <model-viewer> web component, falling
 * back to the 2D sprite (`poster`) instantly and whenever there's no model / the
 * viewer can't load. The web component is lazy-loaded from a CDN the first time
 * a model is shown, so it costs nothing until used.
 *
 * Spike scope: proves the render + fallback + UX path. Models are supplied per
 * entity via data/entityModels.ts (see the IP note there) — this component does
 * not bundle any game assets.
 */

type ScriptState = 'none' | 'ready' | 'error';
let scriptState: ScriptState = 'none';
let scriptPromise: Promise<boolean> | null = null;

// Lazy-load (code-split) the bundled web component the first time a model shows,
// so it costs nothing until used and needs no external CDN at runtime.
function ensureModelViewer(): Promise<boolean> {
  if (scriptState === 'ready') return Promise.resolve(true);
  if (scriptState === 'error') return Promise.resolve(false);
  if (scriptPromise) return scriptPromise;
  scriptPromise = import('@google/model-viewer')
    .then(() => { scriptState = 'ready'; return true; })
    .catch(() => { scriptState = 'error'; return false; });
  return scriptPromise;
}

interface Props {
  /** URL of a .glb/.gltf model, or null/undefined to just show the sprite. */
  src?: string | null;
  /** 2D sprite shown instantly (and as the fallback). */
  poster?: string;
  alt: string;
  size?: number;
  /** Allow the user to orbit/zoom (off for ambient reveal use). */
  interactive?: boolean;
  /** Gentle auto-spin (respect the app's animations toggle). */
  autoRotate?: boolean;
  /** Fill the parent container (width/height 100%) instead of a fixed `size`. */
  fill?: boolean;
  /**
   * Per-model render rotation "roll pitch yaw" (e.g. "0deg -90deg 0deg") for the
   * handful of NPC models authored standing on end. Non-destructive — fixes the
   * pose at view time without touching the exported geometry.
   */
  orientation?: string;
  className?: string;
}

export const EntityModel: React.FC<Props> = ({
  src, poster, alt, size = 160, interactive = false, autoRotate = true, fill = false, orientation, className,
}) => {
  const dims = fill ? { width: '100%', height: '100%' } : { width: `${size}px`, height: `${size}px` };
  const [ready, setReady] = useState(scriptState === 'ready');
  const [failed, setFailed] = useState(false);
  const mvRef = useRef<any>(null);

  useEffect(() => {
    if (!src) return;
    let mounted = true;
    ensureModelViewer().then((ok) => {
      if (!mounted) return;
      if (ok) setReady(true); else setFailed(true);
    });
    return () => { mounted = false; };
  }, [src]);

  // Explicitly loop any baked-in clip (e.g. a boss's idle) once the model
  // loads. We don't rely on the `autoplay` attribute — model-viewer's auto
  // play can no-op on a clip with no name, and it wouldn't loop reliably.
  useEffect(() => {
    if (!src || !ready || !autoRotate) return;
    const el = mvRef.current;
    if (!el) return;
    const play = () => {
      try {
        if (el.availableAnimations && el.availableAnimations.length) {
          el.play({ repetitions: Infinity });
        }
      } catch { /* viewer not ready / no animations — ignore */ }
    };
    el.addEventListener('load', play);
    if (el.loaded) play();
    return () => el.removeEventListener('load', play);
  }, [src, ready, autoRotate]);

  const fallback = poster
    ? <img src={poster} alt={alt} style={{ ...dims, objectFit: 'contain' }} className={className} />
    : null;

  // No model, the loader failed, or the viewer isn't ready yet → show the sprite.
  if (!src || failed || !ready) return fallback;

  return React.createElement('model-viewer', {
    ref: mvRef,
    src,
    poster,
    alt,
    ...(interactive ? { 'camera-controls': true } : {}),
    // Spin + animation are both tied to the app's animations toggle (passed as
    // autoRotate) so "animations off" leaves the model fully still. `autoplay`
    // is a best-effort fallback; the real driver is the play() effect above.
    ...(autoRotate ? { 'auto-rotate': true, 'auto-rotate-delay': 0, 'rotation-per-second': '24deg', autoplay: true } : {}),
    ...(orientation ? { orientation } : {}),
    'interaction-prompt': 'none',
    'shadow-intensity': '0.6',
    exposure: '1.1',
    'environment-image': 'neutral',
    'touch-action': 'pan-y',
    loading: 'eager',
    style: { ...dims, background: 'transparent' },
    className,
  });
};
