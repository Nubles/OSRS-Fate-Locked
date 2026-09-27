/**
 * Each bank as the RuneLite export decides it: its status, as the BANKS row
 * of its chunk gives it, and the chunks where the bank physically is. The
 * plugin can then warn inside Keldagrim, not only at its entrance, and
 * point to the nearest usable bank.
 */
import { BANKS } from '../data/banks';
import type { ChunkContent } from '../services/ChunkContentService';
import { chunkEntry } from './chunkEntry';
import { bankAccess, type ChunkPermissionContext, type PermissionStatus } from './chunkPermissionSnapshot';
import { bankFacilities } from './entityAccess';

export interface BankDecision {
  name: string;
  status: PermissionStatus;
  /** What stands in the way, when the checks say. */
  reason?: string;
  /** The bank's chunk, "cx,cy": where it is on the surface, or the entrance to it. */
  at: string;
  /**
   * The chunks its facilities are in: its own chunk when the facilities are
   * on the surface, and the interiors entered from it that hold one. A bank
   * with no facility found stays at its chunk.
   */
  physical: string[];
}

export interface BankDecisionSource {
  contentFor(cx: number, cy: number): ChunkContent | null;
  surfaceContentFor(cx: number, cy: number): ChunkContent | null;
  interiorsEnteredFrom(cx: number, cy: number): { sourceId: string; content: ChunkContent }[];
}

const keyOf = (id: number) => `${Math.floor(id / 256)},${id % 256}`;

/**
 * A decision for every bank with a chunk, keyed by bank id. A bank whose
 * chunk has no content reads UNKNOWN.
 */
export function bankDecisions(source: BankDecisionSource, context: ChunkPermissionContext): Record<string, BankDecision> {
  const decisions: Record<string, BankDecision> = {};
  for (const bank of BANKS) {
    if (!/^\d+$/.test(bank.id)) continue;
    const id = Number(bank.id);
    const coord = { cx: Math.floor(id / 256), cy: id % 256 };
    const at = keyOf(id);
    const content = source.contentFor(coord.cx, coord.cy);
    const entry = chunkEntry(coord, context.unlocks, context.gameModeId, context.reachableChunks);
    const access = content
      ? bankAccess(content, coord, context, entry)
      : { status: 'UNKNOWN' as const, reasons: ['No content for this chunk'] };
    const surface = source.surfaceContentFor(coord.cx, coord.cy);
    const physical = [
      ...(surface && bankFacilities(surface, bank.id).length ? [id] : []),
      ...source.interiorsEnteredFrom(coord.cx, coord.cy)
        .filter(({ sourceId, content: inside }) => /^\d+$/.test(sourceId) && bankFacilities(inside, bank.id).length)
        .map(({ sourceId }) => Number(sourceId)),
    ];
    decisions[bank.id] = {
      name: bank.name,
      status: access.status,
      ...(access.reasons.length ? { reason: access.reasons.join('; ') } : {}),
      at,
      physical: physical.length ? [...new Set(physical)].sort((a, b) => a - b).map(keyOf) : [at],
    };
  }
  return decisions;
}
