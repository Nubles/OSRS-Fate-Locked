/**
 * Whether a RuneLite profile is worth publishing again. Every relay publish is
 * one of the free plan's 1,000 KV writes a day, shared by every player, and
 * every action in the tracker (a note, a ticked task, a setting) bumps the
 * run's revision and schedules a publish. The bundle the relay would store
 * then differs from the last one only in when it was built (`exportedAt`) and
 * the revision counter (`runRevision`); RuneLite enforces and shows nothing
 * from either that needs the newer value: its freshness follows the relay's
 * replies, and an event stamped with an older revision is still this run's
 * (utils/fateEventEligibility.ts). So the publisher compares a fingerprint of
 * everything else and skips a publish whose fingerprint it already sent.
 */

/** The fields that change on every build without changing anything RuneLite uses. */
const VOLATILE_FIELDS = ['exportedAt', 'runRevision'] as const;

/** Re-publish an unchanged profile after this long anyway, so the relay's copy and its export time never get old while the tracker is in use. */
export const RELAY_REPUBLISH_UNCHANGED_MS = 24 * 60 * 60 * 1000;

const withoutVolatile = (value: unknown): unknown => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
  const copy: Record<string, unknown> = { ...(value as Record<string, unknown>) };
  for (const field of VOLATILE_FIELDS) delete copy[field];
  return copy;
};

/**
 * The text a bundle's fingerprint is taken of: the bundle as JSON without the
 * volatile fields, at its root and in `rules`, where the v4 bundle repeats them.
 */
export function relayFingerprintSource(bundle: unknown): string {
  const root = withoutVolatile(bundle);
  if (root !== null && typeof root === 'object' && !Array.isArray(root) && 'rules' in root) {
    (root as Record<string, unknown>).rules = withoutVolatile((root as Record<string, unknown>).rules);
  }
  return JSON.stringify(root);
}

/** SHA-256 of relayFingerprintSource, in hex, or null where the browser can't hash (the publish then always goes out). */
export async function relayFingerprint(bundle: unknown): Promise<string | null> {
  const subtle = (globalThis as { crypto?: Crypto }).crypto?.subtle;
  if (!subtle) return null;
  try {
    const digest = await subtle.digest('SHA-256', new TextEncoder().encode(relayFingerprintSource(bundle)));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

/** What the publisher remembers of the last publish that worked, per pairing code. */
export interface RelayPublishedRecord {
  code: string;
  fingerprint: string;
  runRevision: number;
  /** When it was sent (ms). */
  at: number;
}

/**
 * Whether a profile built now can be skipped: the last publish for this
 * pairing code worked, had the same fingerprint, came from this revision or
 * an earlier one (a restored older save goes out again, so RuneLite's
 * revision never runs ahead of the run's), and is under a day old.
 */
export function canSkipRelayPublish(
  record: RelayPublishedRecord | null,
  code: string,
  fingerprint: string | null | undefined,
  runRevision: number,
  now: number,
): boolean {
  if (!record || !fingerprint) return false;
  return record.code === code
    && record.fingerprint === fingerprint
    && runRevision >= record.runRevision
    && now >= record.at
    && now - record.at < RELAY_REPUBLISH_UNCHANGED_MS;
}

/** A stored record as JSON, or null when it isn't one. */
export function parseRelayPublishedRecord(raw: string | null): RelayPublishedRecord | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    return value && typeof value.code === 'string' && typeof value.fingerprint === 'string'
      && Number.isSafeInteger(value.runRevision) && Number.isFinite(value.at)
      ? { code: value.code, fingerprint: value.fingerprint, runRevision: value.runRevision, at: value.at }
      : null;
  } catch {
    return null;
  }
}
