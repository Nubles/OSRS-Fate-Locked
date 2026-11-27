import { describe, expect, it } from 'vitest';
import { foldedIncludes, foldedRank } from './textFold';
import * as journal from '../components/osrs/OsrsJournalSearch';

describe('shared search folding', () => {
  it('ignores apostrophes, case and stray spaces', () => {
    expect(foldedIncludes("Warriors' Guild", 'warriors guild')).toBe(true);
    expect(foldedIncludes("Karil's coif", ' karils coif ')).toBe(true);
    expect(foldedIncludes("Karil's coif", 'dharoks')).toBe(false);
  });

  it('ranks the same name, then starts-with, then contains, on the folded text', () => {
    expect(foldedRank("Kree'arra", 'kreearra')).toBe(3);
    expect(foldedRank("K'ril Tsutsaroth", 'kril')).toBe(2);
    expect(foldedRank("Vet'ion", 'vetion ')).toBe(3);
    expect(foldedRank("Calvar'ion", 'arion')).toBe(1);
    expect(foldedRank('General Graardor', 'kril')).toBe(0);
    // A term of only punctuation falls back to the plain match.
    expect(foldedRank("K'ril Tsutsaroth", "'")).toBe(1);
    expect(foldedRank("K'ril Tsutsaroth", '   ')).toBe(0);
  });

  it('is the same folding the journal search re-exports', () => {
    expect(journal.foldedIncludes).toBe(foldedIncludes);
  });
});
