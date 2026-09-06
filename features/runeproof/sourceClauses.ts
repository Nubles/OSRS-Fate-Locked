import data from '../../data/runeproofItemClauses.json';

export interface SourceClauseItem {
  kind: 'item' | 'reference';
  /** Canonical Wiki link title; it may still describe a class, action or non-item. */
  name: string; quantity: number | null;
  availability: 'required' | 'quest-available' | 'conditional'; sourceText: string;
  identityEvidence?: { itemId: number; revision: string; sourcePath: string; nodeId: string };
}
export interface SourceClauseInterpretation {
  questId: string; clauseIndex: number; label: string;
  structure: 'single' | 'choice' | 'bundle' | 'unreviewed';
  routes: { id: string; label: string; items: SourceClauseItem[] }[];
  /** Source leads only; this array is never a required AND bundle. */
  references: SourceClauseItem[];
  unresolved: string[];
  source: { page: string; revisionId: number; revisionTimestamp: string };
}

/** A changed canonical label invalidates the interpretation instead of reusing stale item routes. */
export function getSourceClauseInterpretation(questId: string, clauseIndex: number, label: string): SourceClauseInterpretation | null {
  if (!Number.isSafeInteger(clauseIndex) || clauseIndex < 0 || !Object.hasOwn(data.entries, questId)) return null;
  const entries = data.entries as unknown as Record<string, SourceClauseInterpretation[]>;
  const entry = entries[questId][clauseIndex];
  if (!entry || entry.questId !== questId || entry.clauseIndex !== clauseIndex || entry.label !== label || !entry.source?.revisionId) return null;
  return entry;
}
