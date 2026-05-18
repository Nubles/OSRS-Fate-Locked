
import { LogEntry } from '../types';

export interface ChronicleSummary {
  title: string;
  startDate: string;
  daysActive: number;
  totalEvents: number;
  luckiestMoment: LogEntry | null;
  tragicMoment: LogEntry | null; // Highest roll that failed
  ritualsPerformed: number;
  pityRedemptions: number;
  omniKeysFound: number;
  majorUnlocks: LogEntry[];
  chaosFactor: string; // Narrative description of playstyle
}

export const generateChronicle = (history: LogEntry[]): ChronicleSummary => {
  if (history.length === 0) {
    return {
      title: "The Unwritten",
      startDate: "Unknown",
      daysActive: 0,
      totalEvents: 0,
      luckiestMoment: null,
      tragicMoment: null,
      ritualsPerformed: 0,
      pityRedemptions: 0,
      omniKeysFound: 0,
      majorUnlocks: [],
      chaosFactor: "Dormant"
    };
  }

  const startDate = new Date(history[0].timestamp).toLocaleDateString();
  const daysActive = Math.ceil((Date.now() - history[0].timestamp) / (1000 * 60 * 60 * 24));
  
  const rolls = history.filter(h => h.type === 'ROLL');
  const unlocks = history.filter(h => h.message.includes('Unlocked') || h.type === 'UNLOCK');
  const rituals = history.filter(h => h.type === 'ALTAR');
  const pity = history.filter(h => h.type === 'PITY');
  const omnis = history.filter(h => h.message.includes('Omni-Key') || (h.details && h.details.includes('Critical Success')));

  // Find Luckiest: Lowest successful roll
  const successes = rolls.filter(h => h.result === 'SUCCESS');
  const luckiest = successes.sort((a, b) => (a.rollValue || 100) - (b.rollValue || 100))[0] || null;

  // Find Tragic: Highest failed roll (excluding Pity triggers if possible, but high fail is tragic regardless)
  const fails = rolls.filter(h => h.result === 'FAIL');
  const tragic = fails.sort((a, b) => (b.rollValue || 0) - (a.rollValue || 0))[0] || null;

  // Determine Title based on stats
  let title = "The Novice";
  if (omnis.length > 2) title = "The Fate-Blessed";
  else if (pity.length > 5) title = "The Persistent";
  else if (rituals.length > 10) title = "The Occultist";
  else if (unlocks.length > 50) title = "The Conqueror";

  // Chaos Factor (Flavor text)
  let chaosFactor = "Balanced";
  const successRate = successes.length / (rolls.length || 1);
  if (successRate > 0.6) chaosFactor = "Charmingly Lucky";
  if (successRate < 0.3) chaosFactor = "Cursed by Zamorak";

  return {
    title,
    startDate,
    daysActive,
    totalEvents: history.length,
    luckiestMoment: luckiest,
    tragicMoment: tragic,
    ritualsPerformed: rituals.length,
    pityRedemptions: pity.length,
    omniKeysFound: omnis.length,
    majorUnlocks: unlocks,
    chaosFactor
  };
};
