import React, { useMemo } from 'react';
import { useGame } from '../context/GameContext';
import { DIARY_DATA } from '../data/diaryData';
import { caTasksForMode, questsForMode } from '../utils/modeContent';
import { isF2PMode } from '../config/gameModes';

/**
 * Journal hero — three radial completion rings (Quests / Diaries / Combat),
 * an at-a-glance read of overall progress across the whole journal.
 */
const Ring: React.FC<{ done: number; total: number; color: string; label: string; sub: string }> = ({ done, total, color, label, sub }) => {
  const pct = total > 0 ? done / total : 0;
  const r = 22, circ = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-black/30 border border-white/5 flex-1 min-w-0">
      <svg width="52" height="52" viewBox="0 0 52 52" className="shrink-0 -rotate-90">
        <circle cx="26" cy="26" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
        <circle cx="26" cy="26" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} style={{ transition: 'stroke-dashoffset .6s ease' }} />
        <text x="26" y="26" transform="rotate(90 26 26)" textAnchor="middle" dominantBaseline="central"
          className="fill-white font-bold" style={{ fontSize: 11 }}>{Math.round(pct * 100)}%</text>
      </svg>
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 truncate">{label}</div>
        <div className="text-sm font-bold text-white leading-tight">{done}<span className="text-[11px] text-gray-500 font-normal"> / {total}</span></div>
        <div className="text-[9px] text-gray-500 truncate">{sub}</div>
      </div>
    </div>
  );
};

export const JournalProgressRings: React.FC = () => {
  const { unlocks, gameModeId } = useGame();
  const f2p = isF2PMode(gameModeId);
  const stats = useMemo(() => {
    // Free-to-play counts only free-to-play quests and Combat Achievement tasks.
    const quests = questsForMode(gameModeId);
    const done = new Set(unlocks.quests);
    const questTotal = quests.length;
    const questDone = f2p ? quests.filter(q => done.has(q.id)).length : unlocks.quests.length;
    const qp = quests.reduce((a, q) => a + (done.has(q.id) ? q.points : 0), 0);
    const diaryTotal = Object.keys(DIARY_DATA).length;
    const diaryDone = unlocks.diaries.length;
    const caTasks = caTasksForMode(gameModeId);
    const caTotal = caTasks.length;
    const caDone = caTasks.filter(t => unlocks.completedTasks.includes(t.id)).length;
    return { questTotal, questDone, qp, diaryTotal, diaryDone, caTotal, caDone };
  }, [unlocks, gameModeId, f2p]);

  return (
    <div className="shrink-0 flex gap-2 px-2 pt-2">
      <Ring done={stats.questDone} total={stats.questTotal} color="#60a5fa" label="Quests" sub={`${stats.qp} QP`} />
      {!f2p && <Ring done={stats.diaryDone} total={stats.diaryTotal} color="#4ade80" label="Diaries" sub="tiers complete" />}
      <Ring done={stats.caDone} total={stats.caTotal} color="#f59e0b" label="Combat" sub="achievements" />
    </div>
  );
};
