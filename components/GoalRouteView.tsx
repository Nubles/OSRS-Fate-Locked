import React, { useMemo } from 'react';
import { CheckCircle2, Circle, Route, Dices, Map as MapIcon, BookOpen, Swords, Package } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { buildGoalRoute } from '../utils/goalRoute';
import { WikiLink } from './WikiLink';
import { EntityLocations } from './EntityLocations';
import { SOURCE_TYPE_KINDS } from '../utils/chunkLocations';

/**
 * "Route to goal" — the expanded planning view for a pinned goal: the full
 * transitive quest chain in completion order, every region / skill tier /
 * diary / item source the goal needs (met ✓ vs missing), and which key
 * tables are most likely to advance it on the next spend.
 */

const Tick: React.FC<{ met: boolean }> = ({ met }) =>
  met
    ? <CheckCircle2 size={11} className="text-green-400 shrink-0" />
    : <Circle size={11} className="text-gray-600 shrink-0" />;

const Head: React.FC<{ icon: React.ReactNode; label: string; done: number; total: number }> = ({ icon, label, done, total }) => (
  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
    {icon}{label}
    <span className={`font-mono ${done === total ? 'text-green-500' : 'text-gray-600'}`}>({done}/{total})</span>
  </div>
);

export const GoalRouteView: React.FC<{ goalId: string }> = ({ goalId }) => {
  const gameState = useGame();
  const route = useMemo(
    () => buildGoalRoute(goalId, gameState as any),
    // unlocks is the only input the route reads that changes during play
    [goalId, gameState.unlocks],
  );

  if (!route) return null;

  const met = (xs: { met: boolean }[]) => xs.filter(x => x.met).length;

  return (
    <div className="bg-[#161616] border border-cyan-500/20 rounded-lg p-3 text-[11px] animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/5">
        <Route size={13} className="text-cyan-400" />
        <span className="font-bold text-cyan-200">Route to {route.goalId}</span>
        <span className="ml-auto font-mono text-[10px] text-gray-500">
          {route.completedSteps}/{route.totalSteps} steps · {route.percentage}%
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
        {route.quests.length > 0 && (
          <div className="md:col-span-2">
            <Head icon={<BookOpen size={11} />} label="Quest chain (in order)" done={met(route.quests)} total={route.quests.length} />
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {route.quests.map((q, i) => (
                <span key={q.name} className="flex items-center gap-1">
                  <Tick met={q.met} />
                  <span className="text-gray-600 font-mono text-[9px]">{i + 1}.</span>
                  <WikiLink name={q.name} className={`hover:underline decoration-dotted underline-offset-2 ${q.met ? 'text-green-300/80 line-through' : 'text-gray-300'}`} />
                </span>
              ))}
            </div>
          </div>
        )}

        {route.regions.length > 0 && (
          <div>
            <Head icon={<MapIcon size={11} />} label="Regions" done={met(route.regions)} total={route.regions.length} />
            {route.regions.map(r => (
              <div key={r.name} className="flex items-center gap-1.5 py-px">
                <Tick met={r.met} />
                <span className={r.met ? 'text-green-300/80' : 'text-gray-300'}>{r.name}</span>
                {r.detail && !r.met && <span className="text-gray-600 text-[9px]">({r.detail})</span>}
              </div>
            ))}
          </div>
        )}

        {route.skills.length > 0 && (
          <div>
            <Head icon={<Swords size={11} />} label="Skill tiers" done={met(route.skills)} total={route.skills.length} />
            {route.skills.map(s => (
              <div key={s.skill} className="flex items-center gap-1.5 py-px">
                <Tick met={s.met} />
                <span className={s.met ? 'text-green-300/80' : 'text-gray-300'}>{s.skill}</span>
                <span className="ml-auto font-mono text-[9px] text-gray-500">
                  {!s.unlocked ? 'locked' : `${s.haveLevel}/${s.needLevel}`}
                  <span className={`ml-1.5 px-1 rounded ${s.tierHave >= s.tierNeeded ? 'bg-green-900/50 text-green-300' : 'bg-purple-950/60 text-purple-300'}`}>
                    T{s.tierNeeded}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}

        {(route.diaries.length > 0 || route.questPoints) && (
          <div>
            <Head icon={<BookOpen size={11} />} label="Diaries & QP"
              done={met(route.diaries) + (route.questPoints?.met ? 1 : 0)}
              total={route.diaries.length + (route.questPoints ? 1 : 0)} />
            {route.diaries.map(d => (
              <div key={d.name} className="flex items-center gap-1.5 py-px">
                <Tick met={d.met} />
                <span className={d.met ? 'text-green-300/80' : 'text-gray-300'}>{d.name}</span>
              </div>
            ))}
            {route.questPoints && (
              <div className="flex items-center gap-1.5 py-px">
                <Tick met={route.questPoints.met} />
                <span className={route.questPoints.met ? 'text-green-300/80' : 'text-gray-300'}>
                  Quest Points {route.questPoints.have}/{route.questPoints.need}
                </span>
              </div>
            )}
          </div>
        )}

        {route.sources.length > 0 && (
          <div className="md:col-span-2">
            <Head icon={<Package size={11} />} label="Item sources" done={route.sources.filter(s => s.available).length} total={route.sources.length} />
            {route.sources.map(s => (
              <div key={`${s.type}:${s.name}`} className="py-px">
                <div className="flex items-center gap-1.5">
                  <Tick met={s.available} />
                  <span className="text-[9px] font-bold uppercase text-gray-600 bg-white/5 px-1 rounded shrink-0">{s.type}</span>
                  <WikiLink name={s.name} className={`hover:underline decoration-dotted underline-offset-2 ${s.available ? 'text-green-300/80' : 'text-gray-300'}`} />
                  {!s.available && s.missing.length > 0 && (
                    <span className="text-gray-600 text-[9px] truncate" title={s.missing.join('\n')}>— {s.missing[0]}{s.missing.length > 1 ? ` +${s.missing.length - 1}` : ''}</span>
                  )}
                </div>
                <EntityLocations name={s.name} kinds={SOURCE_TYPE_KINDS[s.type]} cap={3} className="ml-5" />
              </div>
            ))}
          </div>
        )}

        {route.tables.length > 0 && (
          <div className="md:col-span-2">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-fuchsia-300/90 mb-1">
              <Dices size={11} /> Best key tables for this goal
            </div>
            {route.tables.map(t => (
              <div key={t.table} className="flex items-center gap-2 py-0.5">
                <span className="font-bold text-fuchsia-200 w-28 shrink-0">{t.table}</span>
                <span className="font-mono text-[10px] text-amber-300 shrink-0">
                  {Math.round(t.odds * 100)}%
                </span>
                <span className="text-gray-500 text-[10px] truncate" title={t.needed.join(', ')}>
                  {t.needed.length} of {t.poolRemaining} locked draws help — {t.needed.slice(0, 4).join(', ')}{t.needed.length > 4 ? '…' : ''}
                </span>
              </div>
            ))}
          </div>
        )}
        {route.tables.length === 0 && route.percentage < 100 && (
          <div className="md:col-span-2 text-gray-600 text-[10px]">
            No key table advances this goal right now — the remaining steps are quests, levels or tasks you complete in-game.
          </div>
        )}
      </div>
    </div>
  );
};
