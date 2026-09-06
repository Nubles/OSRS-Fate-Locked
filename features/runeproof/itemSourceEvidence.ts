import type { UnlockState } from '../../types';
import { MERCHANTS_LIST, SKILLS_LIST } from '../../data/items';
import { catalogQuest, completedQuestIds } from '../../data/questCatalog';
import { actualSkillLevel } from '../../utils/skillLevels';
import { chunkUnlocked, placeOf } from '../../utils/chunkLocations';

export interface ItemSourceRecord {
  itemName: string; kind: 'spawn' | 'shop' | 'monster'; hostName: string; cx: number; cy: number;
  rawRequirements: { raw: string; origin: 'ENTITY' | 'CHUNK_ENTRY' }[];
}
export interface ItemSourceEvidenceProvider {
  readonly ready: boolean;
  itemSourceRecords(name: string): readonly ItemSourceRecord[];
}
export interface ItemSourceCandidate extends ItemSourceRecord {
  acquisition?: 'READY' | 'LOCKED' | 'UNKNOWN';
  geography: 'unlocked' | 'locked'; placeLabel: string;
  knownMissingGates: string[]; unknowns: string[];
}
export interface ItemSourceEvidence {
  clause: string; matchedItem?: string; quantity?: number;
  status: 'candidates' | 'unknown'; sources: ItemSourceCandidate[]; summary: string;
}
const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();

/** Candidate geography only. Neither a source record nor an owned chunk proves legal acquisition/use. */
export function itemSourceEvidence(clause: string, unlocks: UnlockState, mode: string | undefined, provider: ItemSourceEvidenceProvider): ItemSourceEvidence {
  const unknown = (summary: string): ItemSourceEvidence => ({ clause, status: 'unknown', sources: [], summary });
  if (typeof clause !== 'string' || !clause.trim()) return unknown('No exact item has been identified.');
  if (!provider.ready) return unknown('Item source data is still loading.');
  const trimmed = clause.trim();
  // Do not turn natural-language choices, acquisition notes or recommendations
  // into a mandatory item. Compound item names must await explicit reviewed IDs.
  if (/\b(?:or|and|either|any|optional|recommended|obtained|obtainable|provided|during|before|after|bring|requires?)\b|[;:\n\r]|\s[—–-]\s/i.test(trimmed)) {
    return unknown('This item clause contains a choice or note; its exact source needs review.');
  }
  const numbered = trimmed.match(/^([1-9]\d*)\s+(?:x\s+)?(.+)$/i);
  const quantity = numbered ? Number(numbered[1]) : 1;
  if (!Number.isSafeInteger(quantity) || quantity > 1000000) return unknown('The item quantity needs review.');
  const name = numbered ? numbered[2] : trimmed;
  return lookupItemSources(clause, name, quantity, unlocks, mode, provider);
}

/** A source-linked item identity, kept separate from its surrounding clause.
 * Unknown quantities stay unknown; a reference is not a mandatory item or a legal supply proof.
 */
export function itemReferenceSourceEvidence(reference: { name: string; quantity: number | null }, unlocks: UnlockState, mode: string | undefined, provider: ItemSourceEvidenceProvider): ItemSourceEvidence {
  const quantity = reference.quantity;
  if (typeof reference.name !== 'string' || !reference.name.trim()
    || (quantity !== null && (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 1000000))) {
    return { clause: reference.name, status: 'unknown', sources: [], summary: 'The source item identity or quantity needs review.' };
  }
  return lookupItemSources(reference.name, reference.name.trim(), quantity ?? undefined, unlocks, mode, provider);
}

function lookupItemSources(clause: string, name: string, quantity: number | undefined, unlocks: UnlockState, mode: string | undefined, provider: ItemSourceEvidenceProvider): ItemSourceEvidence {
  const unknown = (summary: string): ItemSourceEvidence => ({ clause, status: 'unknown', sources: [], summary });
  if (!provider.ready) return unknown('Item source data is still loading.');
  const records = provider.itemSourceRecords(name).filter(record => typeof record.itemName === 'string' && normalize(record.itemName) === normalize(name));
  if (!records.length) return unknown('No exact spawn, shop or monster source is recorded for this item. Other ways to obtain it may exist.');
  const sources: ItemSourceCandidate[] = [];
  const seen = new Set<string>();
  for (const record of records) {
    if (!['spawn', 'shop', 'monster'].includes(record.kind) || !record.hostName?.trim()
      || !Number.isInteger(record.cx) || !Number.isInteger(record.cy) || record.cx < 0 || record.cy < 0 || record.cx > 255 || record.cy > 255
      || !Array.isArray(record.rawRequirements)) continue;
    const knownMissingGates: string[] = [], unknowns: string[] = [];
    for (const requirement of record.rawRequirements) {
      if (!requirement || typeof requirement.raw !== 'string' || !['ENTITY', 'CHUNK_ENTRY'].includes(requirement.origin)) { unknowns.push('Invalid source access evidence.'); continue; }
      const raw = requirement.raw.trim();
      const merchant = MERCHANTS_LIST.find(id => normalize(`Use the ${id}`) === normalize(raw));
      if (merchant) { if (!unlocks.merchants.includes(merchant)) knownMissingGates.push(`Unlock: ${merchant}`); continue; }
      const completed = raw.match(/^(.+?)\s+complete the quest$/i);
      const quest = completed ? catalogQuest(completed[1]) : requirement.origin === 'CHUNK_ENTRY' ? catalogQuest(raw) : null;
      if (quest) { if (!completedQuestIds(unlocks.quests).has(quest.id)) knownMissingGates.push(`Complete ${quest.data.name}`); continue; }
      const skillMatch = requirement.origin === 'CHUNK_ENTRY' ? raw.match(/^(.+?)\s+level\s+(\d+)$/i) : null;
      const skill = skillMatch && SKILLS_LIST.find(id => normalize(id) === normalize(skillMatch[1]));
      const level = skillMatch ? Number(skillMatch[2]) : 0;
      if (skill && level > 0 && level <= 99) { if (actualSkillLevel(unlocks, skill) < level) knownMissingGates.push(`${skill} ${level}`); continue; }
      unknowns.push(raw || 'Unclassified source requirement.');
    }
    const hasShopPermission = record.rawRequirements.some(requirement => requirement && typeof requirement.raw === 'string' && MERCHANTS_LIST.some(id => normalize(requirement.raw) === normalize(`Use the ${id}`)));
    const locationUnlocked = chunkUnlocked(record.cx, record.cy, unlocks, mode);
    const acquisition = !locationUnlocked || knownMissingGates.length ? 'LOCKED' as const
      : unknowns.length || record.kind === 'monster' || (record.kind === 'shop' && !hasShopPermission) ? 'UNKNOWN' as const : 'READY' as const;
    if (record.kind === 'shop' && !hasShopPermission) unknowns.push('The required shop permission has not been identified.');
    if (record.kind === 'monster') unknowns.push('Combat access, required equipment and drop conditions need review.');
    if (acquisition !== 'READY') unknowns.push('This acquisition route has not been established.');
    const candidate = { ...record, acquisition, rawRequirements: record.rawRequirements.filter(requirement => requirement && typeof requirement.raw === 'string').map(requirement => ({ ...requirement })),
      geography: chunkUnlocked(record.cx, record.cy, unlocks, mode) ? 'unlocked' as const : 'locked' as const,
      placeLabel: placeOf(record.cx, record.cy).label, knownMissingGates: [...new Set(knownMissingGates)], unknowns: [...new Set(unknowns)] };
    const identity = JSON.stringify([candidate.kind, candidate.hostName, candidate.cx, candidate.cy, candidate.rawRequirements]);
    if (!seen.has(identity)) { seen.add(identity); sources.push(candidate); }
  }
  if (!sources.length) return unknown('The recorded source locations need review.');
  return { clause, matchedItem: records[0].itemName, quantity, status: 'candidates', sources,
    summary: 'An accessible ground spawn or unlocked shop provides an acquisition route. Required equipment and item-use methods are checked separately.' };
}
