import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { hostHash, pointsAtRetiredFeed, RETIRED_FEED_HOST_HASH } from './starFeedOverride';

// A made-up retired subdomain: the real one is only ever stored as a hash.
const OLD = hostHash('example-old');

describe('pointsAtRetiredFeed', () => {
  it('matches a worker under the retired subdomain, whatever its name or path', () => {
    expect(pointsAtRetiredFeed('https://star-proxy.example-old.workers.dev/', OLD)).toBe(true);
    expect(pointsAtRetiredFeed('https://other.example-old.workers.dev/feed?x=1', OLD)).toBe(true);
    expect(pointsAtRetiredFeed('HTTPS://STAR-PROXY.EXAMPLE-OLD.WORKERS.DEV/', OLD)).toBe(true);
    expect(pointsAtRetiredFeed('https://a.b.example-old.workers.dev/', OLD)).toBe(true);
  });

  it('leaves every other address alone', () => {
    expect(pointsAtRetiredFeed('', OLD)).toBe(false);
    expect(pointsAtRetiredFeed('https://star-proxy.example-new.workers.dev/', OLD)).toBe(false);
    expect(pointsAtRetiredFeed('https://example-old.workers.dev/', OLD)).toBe(false);
    expect(pointsAtRetiredFeed('https://star-proxy.example-old.example.com/', OLD)).toBe(false);
    expect(pointsAtRetiredFeed('https://my-own-proxy.someone.workers.dev/', OLD)).toBe(false);
  });

  it('never treats the current default feed as retired', () => {
    expect(pointsAtRetiredFeed('https://star-proxy.fatelocked.workers.dev/')).toBe(false);
    expect(hostHash('fatelocked')).not.toBe(RETIRED_FEED_HOST_HASH);
  });

  it('is the check the World map uses for a saved override', () => {
    const src = readFileSync(fileURLToPath(new URL('../components/RegionMap.tsx', import.meta.url)), 'utf8');
    expect(src).toContain('pointsAtRetiredFeed(ls)');
    // The default the map falls back to is the address the test above clears.
    expect(src).toContain("const DEFAULT_STAR_FEED = 'https://star-proxy.fatelocked.workers.dev/';");
    // No workers.dev subdomain other than the current one is spelled out.
    const spelled = [...src.matchAll(/\.([a-z0-9-]+)\.workers\.dev/gi)].map((m) => m[1].toLowerCase());
    expect([...new Set(spelled)]).toEqual(['fatelocked']);
  });
});
