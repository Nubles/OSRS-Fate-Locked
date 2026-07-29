export type AuditCoverage = 'VERIFIED' | 'PARTIAL' | 'UNKNOWN';

export interface RuneProofSourceAudit {
  sourceVersion: string;
  questCoverage: AuditCoverage;
  chunkCoverage: AuditCoverage;
  acquisitionCoverage: AuditCoverage;
}

export function requireRuneProofSources(
  audit: RuneProofSourceAudit,
): RuneProofSourceAudit {
  const checks: Array<[keyof RuneProofSourceAudit, string]> = [
    ['questCoverage', 'quest'],
    ['chunkCoverage', 'chunk'],
    ['acquisitionCoverage', 'acquisition'],
  ];
  for (const [key, label] of checks) {
    if (audit[key] !== 'VERIFIED') {
      throw new Error(`RuneProof requires verified ${label} coverage`);
    }
  }
  return Object.freeze({ ...audit });
}
