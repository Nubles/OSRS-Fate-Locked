import type { LogEntry } from '../../types';
import { isRollEntry } from '../../utils/logEntry';
import { formatKeyPercent, formatKeyRollValue } from '../../utils/keyRoll';
import { tableDisplayName } from '../../utils/tableDisplay';
import { CASKET_ICON, CHAOS_KEY_ICON, KEY_ICON, OMNI_KEY_ICON, ON_PARCHMENT, VOID_SEAL_ICON, osrsSkillIcon, tableSprite } from './OsrsSpendShared';

/** How history entries read as game messages; shared by History and the Spend Keys chat. */
export type Tone = keyof typeof ON_PARCHMENT;

const SKILL_TABLES = new Set(['Skills', 'SKILLS']);

export const look = (e: LogEntry): { tone: Tone; icon: string; dim: boolean; kind: string } => {
  switch (e.type) {
    case 'ROLL_SUCCESS': return { tone: 'success', icon: KEY_ICON, dim: false, kind: 'Roll: Key found' };
    case 'PITY': return { tone: 'success', icon: KEY_ICON, dim: false, kind: 'Roll: pity Key' };
    case 'ROLL_FAIL': return { tone: 'fail', icon: KEY_ICON, dim: true, kind: 'Roll: no Key' };
    case 'ROLL_OMNI': return { tone: 'void', icon: OMNI_KEY_ICON, dim: false, kind: 'Roll: Omni-Key' };
    case 'PET': return { tone: 'void', icon: OMNI_KEY_ICON, dim: false, kind: 'Pet' };
    case 'UNLOCK': {
      const cat = e.meta?.category as string | undefined;
      const item = e.meta?.item as string | undefined;
      const icon = cat && SKILL_TABLES.has(cat) && item ? osrsSkillIcon(item) : cat ? tableSprite(cat) : CASKET_ICON;
      return { tone: 'unlock', icon, dim: false, kind: 'Unlock' };
    }
    case 'ALTAR': return { tone: 'void', icon: VOID_SEAL_ICON, dim: false, kind: 'Void Altar ritual' };
    case 'LEVEL_UP': return { tone: 'level', icon: CHAOS_KEY_ICON, dim: false, kind: 'Level up' };
    case 'XTREME_MILESTONE': return { tone: 'success', icon: CHAOS_KEY_ICON, dim: false, kind: 'Xtreme milestone' };
    case 'COMPENSATION': return { tone: 'void', icon: OMNI_KEY_ICON, dim: false, kind: 'Compensation' };
    default: return { tone: 'plain', icon: CASKET_ICON, dim: false, kind: e.type };
  }
};

/** The blue speaker before the message: the roll's source, the unlock's table, or the system that wrote it. */
export const speaker = (e: LogEntry): string => {
  if (e.source) return e.source;
  if (e.type === 'UNLOCK' && e.meta?.category) return tableDisplayName(e.meta.category);
  if (e.type === 'ALTAR') return 'Void Altar';
  if (e.type === 'LEVEL_UP') return 'Level up';
  return '';
};

/** Game-message clock: 24-hour, like the game's chat timestamps. */
export const clock = (ts: number) =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });

/** Unlock lines already name the table, so their "Category: X" detail would only repeat it. */
export const lineDetails = (e: LogEntry) => (e.type === 'UNLOCK' ? '' : e.details ?? '');

export const examineFor = (e: LogEntry): string => {
  const parts = [`${look(e).kind}.`, e.message + (e.message.endsWith('.') || e.message.endsWith('!') ? '' : '.')];
  if (e.details) parts.push(e.details);
  if (isRollEntry(e) && e.rollValue !== undefined && e.threshold !== undefined) {
    parts.push(`Rolled ${formatKeyRollValue(e.rollValue)} against ${formatKeyPercent(e.threshold)}.`);
  }
  return parts.join(' ');
};
