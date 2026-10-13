/**
 * Proof that this tracker wrote the browser save during a page-hide.
 *
 * Leaving the page writes the newest save to localStorage synchronously, with
 * no time to hash it for the sidecar (`__mirrorMeta`). The next load then sees
 * a save that differs from the recovery journal. Other pages on the same
 * address (nubles.github.io) can produce exactly that state by rewriting the
 * save, so recovery accepts the newer save only when this mark, written just
 * before it, names exactly its bytes. Otherwise the player chooses on the
 * recovery screen. This guards against other apps, not a deliberate attacker:
 * a script on the same address could forge the mark too.
 */
export const LIFECYCLE_MARK_VERSION = 1;

export const profileLifecycleMarkKey = (storageKey: string): string =>
  `${storageKey}__lifecycleMark`;

/** Two independent 32-bit FNV-1a passes over the UTF-16 code units, as hex. */
export const lifecycleFingerprint = (data: string): string => {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ data.length;
  for (let index = 0; index < data.length; index += 1) {
    const unit = data.charCodeAt(index);
    a = Math.imul(a ^ unit, 0x01000193) >>> 0;
    b = Math.imul(b ^ unit ^ (index & 0xff), 0x5bd1e995) >>> 0;
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
};

export const createLifecycleMark = (data: string): string => JSON.stringify({
  version: LIFECYCLE_MARK_VERSION,
  length: data.length,
  fingerprint: lifecycleFingerprint(data),
});

/** True only when the mark was written for exactly these bytes. */
export const lifecycleMarkMatches = (markRaw: string | null | undefined, data: string): boolean => {
  if (typeof markRaw !== 'string') return false;
  try {
    const mark = JSON.parse(markRaw) as { version?: unknown; length?: unknown; fingerprint?: unknown } | null;
    return mark !== null
      && typeof mark === 'object'
      && mark.version === LIFECYCLE_MARK_VERSION
      && mark.length === data.length
      && mark.fingerprint === lifecycleFingerprint(data);
  } catch {
    return false;
  }
};
