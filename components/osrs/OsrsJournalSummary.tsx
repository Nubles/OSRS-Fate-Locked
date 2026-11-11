import React from 'react';
import {
  useJournalSummaryModel, caPointsLabel, journalSummaryQuestSub, journalSummaryDiarySub, journalSummaryCASub,
  shownRecommendation, ROUTES_PENDING_LABEL,
} from '../JournalSummaryCard';
import { JournalIcon, type JournalKind } from './OsrsJournalParts';
import { openOsrsJournal, type OsrsJournalTab } from './OsrsJournalNav';

/**
 * The home page Journal card in the OSRS layout (board: Main.dc.html, left
 * column): a window titled Journal with one row each for Quests, Diary tasks
 * and Combat Achievements (icon, label, done count, what is ready now, Open).
 * Each row opens the full Journal window (screen 'journal') on its tab. The
 * numbers are the classic card's (useJournalSummaryModel). The classic card's
 * "Do this next" recommendation is the card title's right-click Examine.
 */

type Tab = 'QUESTS' | 'DIARIES' | 'CA';

interface Props {
  /** The classic card's navigation; the OSRS card opens the Journal window instead. */
  onNavClick?: (tab: Tab) => void;
}

const KIND: Record<Tab, JournalKind> = { QUESTS: 'quest', DIARIES: 'diary', CA: 'ca' };
const TAB: Record<Tab, OsrsJournalTab> = { QUESTS: 'quests', DIARIES: 'diaries', CA: 'combat' };

export const OsrsJournalSummary: React.FC<Props> = () => {
  const { stats, recommendation: worked, advisorsEnabled, routesPending } = useJournalSummaryModel();
  const recommendation = shownRecommendation(worked, routesPending);
  // What is ready or doable needs the routes: held for the moment they take to load.
  const ready = (count: number, some: string, none: string) => (
    routesPending ? { sub: ROUTES_PENDING_LABEL, active: false } : { sub: count > 0 ? some : none, active: count > 0 }
  );

  const rows: Array<{ key: Tab; label: string; value: string; sub: string; active: boolean; examine: string }> = [
    {
      key: 'QUESTS',
      // The count includes miniquests, so the label says so (the Quest list counts them apart).
      label: 'Quests & miniquests',
      value: `${stats.quests.done}/${stats.quests.total}`,
      ...ready(stats.quests.available, `${stats.quests.available} ready to complete`, 'None ready yet'),
      examine: `Quests and miniquests: ${stats.quests.done} of ${stats.quests.total} done. ${journalSummaryQuestSub(stats, routesPending)}.`,
    },
    {
      key: 'DIARIES',
      label: 'Diary tasks',
      value: `${stats.diaries.done}/${stats.diaries.total}`,
      ...ready(stats.diaries.doable, `${stats.diaries.doable} doable now`, 'None doable yet'),
      examine: `Achievement Diary tasks: ${stats.diaries.done} of ${stats.diaries.total} done. ${journalSummaryDiarySub(stats, routesPending)}.`,
    },
    {
      key: 'CA',
      label: 'Combat Achievements',
      value: caPointsLabel(stats),
      ...ready(stats.ca.doable, `${stats.ca.doable} doable now`, 'None at an unlocked boss'),
      examine: `Combat Achievements: ${stats.ca.points} of ${stats.ca.pointsTotal} points, ${stats.ca.tasksDone} of ${stats.ca.tasksTotal} tasks, ${stats.ca.done} of ${stats.ca.total} reward tiers. ${journalSummaryCASub(stats)}.${routesPending ? '' : ` ${stats.ca.doable} tasks at a boss you have unlocked.`}`,
    },
  ];

  const titleExamine = advisorsEnabled
    ? (recommendation.tab === null
        ? `${recommendation.headline} ${recommendation.detail}.`
        : `Do this next: ${recommendation.headline}, ${recommendation.detail}.`)
    : 'Your quests, Achievement Diary tasks and Combat Achievements.';

  return (
    <section className="osrs-win ojr-sum" aria-label="Journal summary" data-osrs-journal-card="">
      <h2 className="ojr-sum-title" data-examine={titleExamine} data-examine-name="Journal">Journal</h2>
      <div className="osrs-inner" style={{ display: 'flex', flexDirection: 'column' }} role="group">
        {rows.map(row => (
          <button
            key={row.key}
            type="button"
            className="ojr-sum-row"
            onClick={() => openOsrsJournal(TAB[row.key])}
            aria-label={`${row.label}: ${row.value}, ${row.sub}. Open the Journal.`}
            title="Open the Journal"
            data-examine={row.examine}
            data-examine-name={row.label}
          >
            <JournalIcon kind={KIND[row.key]} />
            <span className="ojr-sum-label">{row.label}</span>
            <span className={`ojr-sum-sub${row.active ? '' : ' is-none'}`}>{row.sub}</span>
            <span className="ojr-sum-val">{row.value}</span>
          </button>
        ))}
      </div>
    </section>
  );
};

export default OsrsJournalSummary;
