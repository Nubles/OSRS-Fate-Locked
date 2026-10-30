import { useEffect, useRef } from 'react';
import { useGame } from '../context/GameContext';
import { playFateSound, soundForEvent } from '../utils/fateSounds';

/**
 * Plays the sound for each new game event (utils/fateSounds.ts). App mounts
 * it only while Settings > Sounds is on, so nothing loads or plays otherwise.
 * Loads and saves aren't game events, so they stay silent.
 */
const FateSounds = (): null => {
  const { lastEvent } = useGame();
  const seen = useRef(lastEvent?.id ?? null);
  useEffect(() => {
    if (!lastEvent || lastEvent.id === seen.current) return;
    seen.current = lastEvent.id;
    const sound = soundForEvent(lastEvent.type);
    if (sound) playFateSound(sound);
  }, [lastEvent]);
  return null;
};

export default FateSounds;
