import { describe, expect, it } from 'vitest';
import type { AnalyticsCoverage } from '../../utils/fateAnalytics';
import { dataQualityNotes } from './AnalyticsControls';

const clean: AnalyticsCoverage = {
  attempts: 10,
  exactOutcomes: 10,
  exactProbabilities: 10,
  legacyEstimates: 0,
  unscoreableProbabilities: 0,
  exactRewardEvents: 3,
  unverifiedRewardEvents: 0,
  invalidTimestamps: 0,
  unknownSources: 0,
  inconsistentEntries: 0,
  veracHitThroughs: 0,
};

describe('dataQualityNotes', () => {
  it('says nothing for a clean history', () => {
    expect(dataQualityNotes(clean)).toEqual([]);
  });

  it("tells a player their Verac wins aren't judged, without calling them inconsistent", () => {
    expect(dataQualityNotes({ ...clean, veracHitThroughs: 1 })).toEqual(['1 win came from Verac hitting through a miss and is not judged.']);
    expect(dataQualityNotes({ ...clean, veracHitThroughs: 2 })).toEqual(['2 wins came from Verac hitting through a miss and are not judged.']);
  });
});
