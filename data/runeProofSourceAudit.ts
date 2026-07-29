import chunkTransformAudit from './sources/chunk-content-transform-audit.json';
import questRequirementAudit from './sources/quest-requirement-audit.json';
import type { RuneProofSourceAudit } from '../utils/runeproof/sourceGate';

const hasVerifiedQuestAudit = questRequirementAudit.schemaVersion === 1
  && Array.isArray(questRequirementAudit.entries)
  && questRequirementAudit.entries.length > 0;

const hasVerifiedChunkAudit = chunkTransformAudit.schemaVersion === 1
  && typeof chunkTransformAudit.sourceCommit === 'string'
  && chunkTransformAudit.sourceCommit.length > 0;

export const runeProofSourceAudit: RuneProofSourceAudit = Object.freeze({
  sourceVersion: 'osrs-2026-07-29',
  questCoverage: hasVerifiedQuestAudit ? 'VERIFIED' : 'UNKNOWN',
  chunkCoverage: hasVerifiedChunkAudit ? 'VERIFIED' : 'UNKNOWN',
  // Task 5 must replace this after validating acquisition-source coverage.
  acquisitionCoverage: 'PARTIAL',
});
