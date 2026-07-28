export const RUNELITE_PAIR_CODE_PATTERN = /^[0-9a-f]{32}$/;
export const RUNELITE_PAIR_HASH_PREFIX = '#runelite-pair=';
export const RUNELITE_PAIRING_SUCCESS_COPY =
  'Profile sent. Return to RuneLite; its Fate Locked panel will show Connected after the first valid import.';

export const isRunelitePairCode = (value: string): boolean =>
  RUNELITE_PAIR_CODE_PATTERN.test(value);

export const parseRunelitePairFragment = (hash: string): string | null => {
  if (!hash.startsWith(RUNELITE_PAIR_HASH_PREFIX)) return null;
  const code = hash.slice(RUNELITE_PAIR_HASH_PREFIX.length);
  return isRunelitePairCode(code) ? code : null;
};
