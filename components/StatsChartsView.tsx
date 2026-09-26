import React from 'react';
import type { FateAnalyticsResult } from '../utils/fateAnalytics';
import { FairnessCharts } from './stats/FairnessCharts';
import { NotableMoments } from './stats/NotableMoments';
import { PrimaryAnalyticsCharts } from './stats/PrimaryAnalyticsCharts';
import { SecondaryAnalyticsCharts } from './stats/SecondaryAnalyticsCharts';

/** Dashboard charts consume the same immutable analytics result as every modal surface. */

interface Props {
  analytics: FateAnalyticsResult;
}

export const StatsChartsView: React.FC<Props> = ({ analytics }) => (
  <div className="space-y-4">
    <PrimaryAnalyticsCharts analytics={analytics} />
    <SecondaryAnalyticsCharts analytics={analytics} />
    <NotableMoments analytics={analytics} />
    <div className="pt-2"><FairnessCharts analytics={analytics} /></div>
  </div>
);

export default StatsChartsView;
