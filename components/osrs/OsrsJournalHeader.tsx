import React, { useMemo } from 'react';
import { useGame } from '../../context/GameContext';
import { journalRingStats } from '../JournalProgressRings';
import { JournalIcon } from './OsrsJournalParts';

/**
 * The Journal tab's header strip in the OSRS layout (board: Journal.dc.html):
 * quests with quest points, diary tasks and combat achievement tasks, the
 * same numbers as the classic progress rings.
 */
export const OsrsJournalHeader: React.FC = () => {
  const { unlocks } = useGame();
  const s = useMemo(() => journalRingStats(unlocks), [unlocks]);
  return (
    <div className="ojr-strip" role="group" aria-label="Journal progress">
      <span className="ojr-stat" data-examine={`${s.questDone} of ${s.questTotal} quests and miniquests done, ${s.qp} quest points.`} data-examine-name="Quests">
        <JournalIcon kind="quest" /><b>Quests &amp; miniquests</b> <span className="w">{s.questDone}/{s.questTotal}</span> · <span className="y">{s.qp} QP</span>
      </span>
      <span className="ojr-stat" data-examine={`${s.diaryDone} of ${s.diaryTotal} Achievement Diary tasks done.`} data-examine-name="Diaries">
        <JournalIcon kind="diary" /><b>Diaries</b> <span className="w">{s.diaryDone}/{s.diaryTotal}</span> tasks
      </span>
      <span className="ojr-stat" data-examine={`${s.caDone} of ${s.caTotal} Combat Achievement tasks done.`} data-examine-name="Combat">
        <JournalIcon kind="ca" /><b>Combat</b> <span className="w">{s.caDone}/{s.caTotal}</span> tasks
      </span>
    </div>
  );
};

export default OsrsJournalHeader;
