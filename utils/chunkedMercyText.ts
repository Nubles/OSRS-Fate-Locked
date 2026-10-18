/**
 * The line the Keys screen shows while Fate's Mercy is shut and the run holds
 * no Keys, saying what keeps it shut. Only the lazily loaded Chunked panel
 * uses it, so its wording stays out of the entry chunk.
 */
import { SKILLS_LIST } from '../data/items';
import { mercyBlocker, mercyQuietLeft, mercyRitualInReach, pendingBreakthroughs, skillsWithRoom, tierCap, type FateState } from './chunkedFate';

const RITUAL_NAMES = { CHAOS: 'the Ritual of Chaos', CARTOGRAPHER: 'the Ritual of the Cartographer' } as const;

/** Null when Mercy is open, when the run still holds a Key (the reason is plain), outside Chunked, or while a reveal plays. */
/** "2 days 5 hours", "40 minutes": how long until the quiet spell opens Mercy anyway. */
const quietText = (ms: number): string => {
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(hours / 24);
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;
  if (days > 0) return hours % 24 ? `${plural(days, 'day')} ${plural(hours % 24, 'hour')}` : plural(days, 'day');
  if (hours > 0) return plural(hours, 'hour');
  return plural(Math.max(1, Math.ceil(ms / 60_000)), 'minute');
};

export const mercyShutReason = (state: FateState, doableQuests?: readonly string[], now: number = Date.now()): string | null => {
  const blocker = mercyBlocker(state, doableQuests, now);
  // Skill room, exploring and quests are the tracker's guesses: if the run
  // can't really do them, Mercy opens anyway after a quiet spell.
  const anyway = ` If you can't, and nothing new comes for ${quietText(mercyQuietLeft(state, now))}, it opens anyway.`;
  if (blocker === null || blocker === 'not_chunked' || blocker === 'pending_unlock' || state.keys > 0) return null;
  const waits = "Fate's Mercy waits";
  switch (blocker) {
    case 'keys': {
      const held = state.specialKeys > 0 ? 'an Omni-Key' : 'a Chaos Key';
      return `${waits} while you hold ${held}. Spend it first.`;
    }
    case 'fate': {
      const ritual = mercyRitualInReach(state)!;
      return ritual.free
        ? `${waits} while a free ${RITUAL_NAMES[ritual.id].replace(/^the /, '')} is yours to cast at the Void Altar.`
        : `${waits} while you have ${state.fatePoints ?? 0} Fate: enough for ${RITUAL_NAMES[ritual.id]} (${ritual.cost} Fate) at the Void Altar.`;
    }
    case 'skill_room': {
      const [first, ...rest] = skillsWithRoom(state);
      const tier = state.unlocks.skills[first] ?? 0;
      const level = state.unlocks.levels[first] ?? 1;
      return rest.length === 0
        ? `${waits} while ${first} can still level in your chunks: level ${level} of its tier cap ${tierCap(tier)}.${anyway}`
        : `${waits} while ${first} and ${rest.length} more skill${rest.length === 1 ? '' : 's'} can still level in your chunks below their tier cap.${anyway}`;
    }
    case 'breakthrough': {
      const [first] = pendingBreakthroughs(state);
      return `${waits} until you roll the Breakthrough for ${first}.`;
    }
    case 'explore':
      return `${waits} until you take the exploring rolls your new chunks still offer.${anyway}`;
    case 'quest':
      return `${waits} while ${doableQuests!.length === 1 ? `${doableQuests![0]} is` : `${doableQuests!.length} quests are`} doable in your chunks.${anyway}`;
    case 'nothing_left': {
      // "Everything is open" only when it is: every skill at 99 (an empty pool
      // already means no frontier chunk is left).
      const unfinished = SKILLS_LIST.filter(skill => (state.unlocks.levels[skill] ?? 1) < 99);
      if (unfinished.length === 0) return "Fate's Mercy has nothing left to draw: every chunk and skill tier it could open is open.";
      return `Fate's Mercy has nothing it can draw for you: no chunk, skill tier, patch type or guild it could open would let you train ${unfinished.length === 1 ? unfinished[0] : `${unfinished[0]} or ${unfinished.length - 1} other skill${unfinished.length === 2 ? '' : 's'}`} further.`;
    }
  }
};
