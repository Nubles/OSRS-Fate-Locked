// The Journal screen's footer counts come from the same ready lists as the
// bar above it, which is held at "checking routes" until the routes load
// (commit 82f1ccc). Without routes every owned area counts as reachable, so
// the footer must be held too, or it shows a "Ready" and "Keys waiting"
// that then drop.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(fileURLToPath(new URL('./OsrsJournalScreen.tsx', import.meta.url)), 'utf8');
const footer = source.slice(source.indexOf('<div className="ojs-foot">'), source.indexOf('ojs-foot-note'));

describe('Journal screen footer while routes load', () => {
  it('holds the Ready count and the Keys waiting estimate', () => {
    expect(source).toContain("const held = (text: string) => (routesPending ? 'checking routes' : text);");
    expect(footer).toContain('{held(String(readyCount))}');
    expect(footer).toContain('{held(keysWaitingText)}');
    expect(footer).not.toMatch(/\{readyCount\}|\{keysWaitingText\}/);
  });
});
