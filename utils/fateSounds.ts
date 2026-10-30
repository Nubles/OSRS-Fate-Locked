/**
 * Fate Locked's own small sound set, synthesised with the Web Audio API so
 * there are no sound files: a soft thunk on a missed roll, a chime on a Key
 * and a short rising fanfare on an unlock. Played only when Settings > Sounds
 * is on (components/FateSounds.tsx), and kept quiet.
 */
export type FateSound = 'miss' | 'key' | 'unlock';

let context: AudioContext | null = null;
const audio = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  context ??= new Ctor();
  if (context.state === 'suspended') void context.resume().catch(() => undefined);
  return context;
};

const VOLUME = 0.22;

/** One note: a wave from `freq` (gliding to `to`), starting `at` seconds from now, fading over `length`. */
const note = (ac: AudioContext, type: OscillatorType, freq: number, at: number, length: number, peak: number, to?: number) => {
  const start = ac.currentTime + at;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, start + length);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak * VOLUME, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + length + 0.05);
};

export const playFateSound = (sound: FateSound): void => {
  const ac = audio();
  if (!ac) return;
  if (sound === 'miss') {
    note(ac, 'sine', 150, 0, 0.16, 0.9, 70);
  } else if (sound === 'key') {
    note(ac, 'triangle', 988, 0, 0.45, 0.7);
    note(ac, 'triangle', 1319, 0.08, 0.55, 0.6);
  } else {
    // C5, E5, G5, then C6 held.
    [523, 659, 784].forEach((freq, i) => note(ac, 'square', freq, i * 0.09, 0.12, 0.25));
    note(ac, 'triangle', 1047, 0.27, 0.6, 0.7);
  }
};

/** The sound for a game event, or null for events that stay silent. */
export const soundForEvent = (type: string): FateSound | null => {
  if (type === 'ROLL_FAIL') return 'miss';
  if (type === 'ROLL_SUCCESS' || type === 'ROLL_OMNI' || type === 'ROLL_PITY') return 'key';
  if (type === 'UNLOCK') return 'unlock';
  return null;
};
