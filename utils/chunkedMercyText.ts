/**
 * The line the Keys screen shows while Fate's Mercy is shut and the run holds
 * no Keys, saying what keeps it shut. Only the lazily loaded Chunked panel
 * uses it, so its wording stays out of the entry chunk.
 */
import { mercyBlocker, mercyRitualInReach, pendingBreakthroughs, skillsWithRoom, tierCap, type FateState } from './chunkedFate';

const RITUAL_NAMES = { CHAOS: 'the Ritual of Chaos', CARTOGRAPHER: 'the Ritual of the Cartographer' } as const;

/** Null when Mercy is open, when the run still holds a Key (the reason is plain), outside Chunked, or while a reveal plays. */
export const mercyShutReason = (state: FateState, doableQuests?: readonly string[]): string | null => {
  const blocker = mercyBlocker(state, doableQuests);
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
        ? `${waits} while ${first} can still level in your chunks: level ${level} of its tier cap ${tierCap(tier)}.`
        : `${waits} while ${first} and ${rest.length} more skill${rest.length === 1 ? '' : 's'} can still level in your chunks below their tier cap.`;
    }
    case 'breakthrough': {
      const [first] = pendingBreakthroughs(state);
      return `${waits} until you roll the Breakthrough for ${first}.`;
    }
    case 'explore':
      return `${waits} until you take the exploring rolls your new chunks still offer.`;
    case 'quest':
      return `${waits} while ${doableQuests!.length === 1 ? `${doableQuests![0]} is` : `${doableQuests!.length} quests are`} doable in your chunks.`;
    case 'nothing_left':
      return "Fate's Mercy has nothing left to draw: every chunk and skill tier it could open is open.";
  }
};
