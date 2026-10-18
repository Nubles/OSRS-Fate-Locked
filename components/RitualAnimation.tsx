import React, { useEffect, useRef } from 'react';
import type { Ritual } from '../config/economy';
import { loadRitualFonts } from './rituals/ritualAssets';
import { RITUAL_SCENES } from './rituals/ritualScenes';
import { playScene, type RitualPlayer } from './rituals/ritualStage';

interface Props {
  ritual: Ritual['id'];
  /** The RITUAL event's meta. */
  meta: Record<string, unknown>;
  ownedChunks: readonly string[];
  onComplete: () => void;
}

/**
 * The full-screen moment after a Void Altar ritual. Each ritual has its own
 * scene (components/rituals/ritualScenes.ts). A click (or Space, like the
 * game's dialogs) skips to the last frame, which stays up until a second
 * click or Escape closes it. Like the app's other reveals it follows
 * the Animations setting only, not the system's reduced-motion setting:
 * Windows turns that on with "Animation effects" off, and the ritual then
 * showed only a still card for two seconds.
 */
export const RitualAnimation: React.FC<Props> = ({ ritual, meta, ownedChunks, onComplete }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<RitualPlayer | null>(null);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  // The scene plays once per mount: later prop changes don't restart it.
  const inputRef = useRef({ ritual, meta, ownedChunks });

  useEffect(() => {
    let cancelled = false;
    const { ritual: id, meta: m, ownedChunks: owned } = inputRef.current;
    loadRitualFonts().then(() => {
      const host = hostRef.current;
      if (cancelled || !host) return;
      playerRef.current = playScene(host, RITUAL_SCENES[id], { meta: m, ownedChunks: owned }, {
        reducedMotion: false,
        onDone: () => completeRef.current(),
      });
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') playerRef.current?.destroy();
      else if ((e.key === ' ' || e.key === 'Enter') && playerRef.current) {
        e.preventDefault();
        playerRef.current.skip();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelled = true;
      window.removeEventListener('keydown', onKey);
      const player = playerRef.current;
      playerRef.current = null;
      if (player) {
        // Unmounting is already the close; don't report it back.
        completeRef.current = () => {};
        player.destroy();
      }
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className="ritual-stage"
      role="dialog"
      aria-modal="true"
      aria-label="Ritual"
      onClick={() => playerRef.current?.skip()}
    />
  );
};
