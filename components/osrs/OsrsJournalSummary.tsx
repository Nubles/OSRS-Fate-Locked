import React from 'react';
import {
  useJournalSummaryModel, journalSummaryQuestSub, journalSummaryDiarySub, journalSummaryCASub,
} from '../JournalSummaryCard';
import { JournalIcon, type JournalKind } from './OsrsJournalParts';

/**
 * The home page Journal summary in the OSRS layout (board: Main.dc.html, left
 * column): an interface window titled Journal with "Do this next" and one row
 * each for Quests, Diary Tasks and Combat Achievements. Same numbers and the
 * same navigation as the classic card (useJournalSummaryModel).
 */

type Tab = 'QUESTS' | 'DIARIES' | 'CA';

interface Props {
  onNavClick: (tab: Tab) => void;
}

const KIND: Record<Tab, JournalKind> = { QUESTS: 'quest', DIARIES: 'diary', CA: 'ca' };

export const OsrsJournalSummary: React.FC<Props> = ({ onNavClick }) => {
  const { stats, recommendation, advisorsEnabled } = useJournalSummaryModel();
  const noneLeft = recommendation.tab === null;

  const rows: Array<{ key: Tab; label: string; value: string; headline: string; sub: string; active: boolean; examine: string }> = [
    {
      key: 'QUESTS',
      label: 'Quests',
      value: `${stats.quests.done}/${stats.quests.total}`,
      headline: `${stats.quests.done}/${stats.quests.total} done`,
      sub: journalSummaryQuestSub(stats),
      active: stats.quests.available > 0,
      examine: `Quests and miniquests: ${stats.quests.done} of ${stats.quests.total} done, ${stats.quests.available} ready to complete.`,
    },
    {
      key: 'DIARIES',
      label: 'Diary Tasks',
      value: `${stats.diaries.done}/${stats.diaries.total}`,
      headline: `${stats.diaries.done}/${stats.diaries.total} tasks done`,
      sub: journalSummaryDiarySub(stats),
      active: stats.diaries.doable > 0,
      examine: `Achievement Diary tasks: ${stats.diaries.done} of ${stats.diaries.total} done, ${stats.diaries.doable} doable now.`,
    },
    {
      key: 'CA',
      label: 'Combat Achievements',
      value: `${stats.ca.points.toLocaleString()}/${stats.ca.pointsTotal.toLocaleString()} pts`,
      headline: `${stats.ca.points}/${stats.ca.pointsTotal} points · ${stats.ca.done}/${stats.ca.total} rewards`,
      sub: `${journalSummaryCASub(stats)} · ${stats.ca.done}/${stats.ca.total} rewards`,
      active: stats.ca.left > 0,
      examine: `Combat Achievements: ${stats.ca.points} of ${stats.ca.pointsTotal} points, ${stats.ca.tasksDone} of ${stats.ca.tasksTotal} tasks, ${stats.ca.done} of ${stats.ca.total} reward tiers.`,
    },
  ];

  return (
    <section className="osrs-win ojr-sum" aria-label="Journal summary">
      <h2 className="ojr-sum-title">Journal</h2>
      <div className="osrs-inner" style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Recommended next action (advisory: hidden when advisors are off). */}
        {advisorsEnabled && (noneLeft ? (
          <div className="ojr-sum-next is-all">
            <div className="ojr-sum-head">{recommendation.headline}</div>
            <div className="ojr-sum-label">{recommendation.detail}</div>
          </div>
        ) : (
          <button
            type="button"
            className="ojr-sum-row"
            onClick={() => recommendation.tab && onNavClick(recommendation.tab)}
            aria-label={`Recommended: ${recommendation.headline} — ${recommendation.detail}`}
            data-examine={`Do this next: ${recommendation.headline}, ${recommendation.detail}.`}
            data-examine-name="Do this next"
          >
            <span className="ojr-sum-icon">{recommendation.tab && <JournalIcon kind={KIND[recommendation.tab]} />}</span>
            <span className="ojr-sum-label" style={{ color: 'var(--osrs-tan, #c8b897)', fontFamily: 'RSSmall, sans-serif' }}>Do this next</span>
            <span className="ojr-sum-open">Open</span>
            <span className="ojr-sum-head" style={{ gridColumn: '2 / span 2', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <span style={{ color: '#fff', fontFamily: 'RSBold, sans-serif' }}>{recommendation.headline}</span>
              <span style={{ color: '#ffff00', fontFamily: 'RSSmall, sans-serif' }}> {recommendation.detail}</span>
            </span>
          </button>
        ))}

        <div role="list" style={{ display: 'contents' }}>
          {rows.map(row => (
            <button
              key={row.key}
              type="button"
              role="listitem"
              className="ojr-sum-row"
              onClick={() => onNavClick(row.key)}
              aria-label={`${row.label}: ${row.headline}, ${row.sub}`}
              data-examine={row.examine}
              data-examine-name={row.label}
            >
              <span className="ojr-sum-icon"><JournalIcon kind={KIND[row.key]} /></span>
              <span className="ojr-sum-label">{row.label}</span>
              <span className="ojr-sum-val">{row.value}</span>
              <span className={`ojr-sum-sub${row.active ? '' : ' is-none'}`}>{row.sub}</span>
              <span className="ojr-sum-open">Open</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default OsrsJournalSummary;
