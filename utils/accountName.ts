/**
 * A character's name as the tracker compares it: trimmed, single-spaced and lower case. A module of
 * its own, so startup code that compares names doesn't bring in the event protocol's parser.
 */
export function normalizeAccountName(account: string): string {
  return account.trim().replace(/\s+/g, ' ').toLowerCase();
}
