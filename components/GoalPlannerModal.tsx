import React, { useMemo, useState } from 'react';
import {
  Target, Search, X, MapPin, BookOpen, Award, Dumbbell,
  CheckCircle2, Circle, ArrowRight, Star, Compass, Route,
} from 'lucide-react';
import { useGame } from '../context/GameContext';
import {
  listGoalTargets, planForTarget, GoalTarget, GoalPlan, PlanStep, GoalKind,
} from '../utils/goalPlanner';
import { getQuestStatus, getDiaryStatus } from '../utils/journalStatus';
import { QUEST_DATA } from '../data/questData';
import { DIARY_DATA } from '../data/diaryData';
import { useEscapeKey } from '../hooks/useEscapeKey';

/**
 * Goal Planner — the reverse of the advisors.
 *
 * The player picks any target (a quest, diary tier, or region) and gets the
 * full ordered roadmap to unlock it: regions to open, skill levels to train,
 * and every prerequisite quest sequenced so prereqs always come first.
 *
 * All reasoning lives in utils/goalPlanner.ts; this is purely presentational.
 */

interface Props {
  onClose: () => void;
}

const KIND_META: Record<GoalKind, { icon: React.ReactNode; label: string; color: string }> = {
  quest: { icon: <BookOpen size={13} />, label: 'Quest', color: 'text-blue-300' },
  diary: { icon: <Award size={13} />, label: 'Diary', color: 'text-green-300' },
  region: { icon: <MapPin size={13} />, label: 'Region', color: 'text-emerald-300' },
};

// Status of a target in the current snapshot — drives the picker dot.
type TargetState = 'done' | 'ready' | 'locked';

function targetState(t: GoalTarget, unlocks: any): TargetState {
  if (t.kind === 'quest') {
    const s = getQuestStatus(QUEST_DATA[t.id], unlocks);
    return s === 'COMPLETED' ? 'done' : s === 'AVAILABLE' ? 'ready' : 'locked';
  }
  if (t.kind === 'diary') {
    const s = getDiaryStatus(DIARY_DATA[t.id], unlocks);
    return s === 'COMPLETED' ? 'done' : s === 'AVAILABLE' ? 'ready' : 'locked';
  }
  return unlocks.regions.includes(t.id) ? 'done' : 'locked';
}

const STATE_DOT: Record<TargetState, string> = {
  done: 'bg-emerald-500',
  ready: 'bg-amber-400',
  locked: 'bg-gray-600',
};

const STEP_ICON: Record<PlanStep['kind'], React.ReactNode> = {
  region: <MapPin size={12} />,
  skill: <Dumbbell size={12} />,
  qp: <Star size={12} />,
  quest: <BookOpen size={12} />,
};

const StepRow: React.FC<{ step: PlanStep; index?: number }> = ({ step, index }) => (
  <div
    className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md border text-left transition-colors ${
      step.done
        ? 'bg-emerald-950/20 border-emerald-500/15'
        : 'bg-[#1a1a1a] border-white/5'
    }`}
  >
    {step.done ? (
      <CheckCircle2 size={14} className="text-emerald-500 shrink-0" aria-hidden />
    ) : (
      <Circle size={14} className="text-gray-600 shrink-0" aria-hidden />
    )}
    {typeof index === 'number' && (
      <span className="text-[9px] font-mono font-bold text-gray-600 w-4 shrink-0 text-right" aria-hidden>
        {index}.
      </span>
    )}
    <span className="text-gray-500 shrink-0" aria-hidden>{STEP_ICON[step.kind]}</span>
    <span className={`text-[11px] font-semibold truncate flex-1 ${step.done ? 'text-gray-500 line-through' : 'text-gray-200'}`}>
      {step.label}
    </span>
    {step.detail && (
      <span className="text-[9px] text-gray-500 font-mono shrink-0">{step.detail}</span>
    )}
  </div>
);

const PlanSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  steps: PlanStep[];
  numbered?: boolean;
}> = ({ title, icon, steps, numbered }) => {
  if (steps.length === 0) return null;
  const doneCount = steps.filter((s) => s.done).length;
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5 px-0.5">
        <span className="text-gray-400" aria-hidden>{icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300">{title}</span>
        <span className="text-[9px] text-gray-600 font-mono">{doneCount}/{steps.length}</span>
        <div className="flex-1 h-px bg-white/5" />
      </div>
      <div className="space-y-1">
        {steps.map((s, i) => (
          <StepRow key={`${s.kind}:${s.id}`} step={s} index={numbered ? i + 1 : undefined} />
        ))}
      </div>
    </div>
  );
};

export const GoalPlannerModal: React.FC<Props> = ({ onClose }) => {
  const { unlocks } = useGame();
  useEscapeKey(onClose, true);

  const targets = useMemo(() => listGoalTargets(), []);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<{ kind: GoalKind; id: string } | null>(null);

  // Filter + lightweight ranking: incomplete & matching first.
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q
      ? targets.filter((t) => t.label.toLowerCase().includes(q) || t.group.toLowerCase().includes(q))
      : targets;
    return matched
      .map((t) => ({ t, state: targetState(t, unlocks) }))
      .sort((a, b) => {
        // Ready-to-start first, then locked, then done; alpha within.
        const rank = (s: TargetState) => (s === 'ready' ? 0 : s === 'locked' ? 1 : 2);
        return rank(a.state) - rank(b.state) || a.t.label.localeCompare(b.t.label);
      });
  }, [targets, query, unlocks]);

  const plan: GoalPlan | null = useMemo(
    () => (selected ? planForTarget(selected.kind, selected.id, unlocks) : null),
    [selected, unlocks],
  );

  const totalSteps = plan ? plan.steps.length : 0;
  const doneSteps = plan ? plan.steps.filter((s) => s.done).length : 0;
  const pct = totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Goal Planner"
    >
      <div
        className="bg-[#161616] border border-white/10 rounded-xl shadow-2xl w-full max-w-3xl h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-white/10 bg-[#1b1b1b] shrink-0">
          <div className="p-2 bg-cyan-900/20 rounded-lg border border-cyan-500/30 text-cyan-400">
            <Route size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-white leading-none flex items-center gap-2">
              Goal Planner
            </h2>
            <p className="text-[11px] text-gray-500 mt-1">
              Pick a target — get the full ordered roadmap to unlock it.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 flex min-h-0">
          {/* Picker column */}
          <div className="w-[44%] border-r border-white/10 flex flex-col min-h-0">
            <div className="p-2.5 border-b border-white/5 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-3.5 h-3.5" aria-hidden />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search quests, diaries, regions…"
                  className="bg-black/30 border border-white/10 rounded-lg py-1.5 pl-8 pr-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/40 w-full transition-colors"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-1.5 space-y-0.5">
              {results.length === 0 && (
                <p className="text-[11px] text-gray-600 italic text-center py-6">No matches.</p>
              )}
              {results.map(({ t, state }) => {
                const isSel = selected?.kind === t.kind && selected?.id === t.id;
                const meta = KIND_META[t.kind];
                return (
                  <button
                    key={`${t.kind}:${t.id}`}
                    onClick={() => setSelected({ kind: t.kind, id: t.id })}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left transition-colors group ${
                      isSel ? 'bg-cyan-900/25 border border-cyan-500/30' : 'border border-transparent hover:bg-white/5'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATE_DOT[state]}`} aria-hidden />
                    <span className={`shrink-0 ${meta.color}`} aria-hidden>{meta.icon}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[11px] font-semibold text-gray-200 truncate">{t.label}</span>
                      <span className="block text-[9px] text-gray-600 truncate">{meta.label} · {t.group}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Plan column */}
          <div className="flex-1 flex flex-col min-h-0">
            {!plan ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-3">
                <Target size={32} className="text-gray-700" aria-hidden />
                <p className="text-sm text-gray-500 font-semibold">Choose a goal</p>
                <p className="text-[11px] text-gray-600 max-w-[260px]">
                  Select any quest, diary tier, or region on the left to see exactly
                  what stands between you and it — in the order to tackle it.
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                {/* Plan header */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={KIND_META[plan.targetKind].color} aria-hidden>
                      {KIND_META[plan.targetKind].icon}
                    </span>
                    <h3 className="text-sm font-bold text-white truncate">{plan.targetLabel}</h3>
                  </div>

                  {plan.alreadyDone ? (
                    <p className="text-[11px] text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 size={13} /> Already complete — nothing left to do!
                    </p>
                  ) : plan.alreadyReachable && plan.targetKind !== 'region' ? (
                    <p className="text-[11px] text-amber-300 flex items-center gap-1.5">
                      <Compass size={13} /> Available right now — go do it!
                    </p>
                  ) : (
                    <p className="text-[11px] text-gray-500">
                      <span className="text-gray-300 font-bold">{plan.remaining}</span> step
                      {plan.remaining !== 1 ? 's' : ''} remaining
                    </p>
                  )}

                  {/* Progress bar */}
                  {totalSteps > 0 && (
                    <div className="mt-2">
                      <div className="h-1.5 bg-black/50 rounded-full overflow-hidden border border-white/5">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-[9px] text-gray-600 font-mono mt-1 text-right">
                        {doneSteps}/{totalSteps} prerequisites met
                      </p>
                    </div>
                  )}
                </div>

                {plan.steps.length === 0 ? (
                  <p className="text-[11px] text-gray-600 italic text-center py-4">
                    No prerequisites — this target is wide open.
                  </p>
                ) : (
                  <>
                    <PlanSection title="Regions to unlock" icon={<MapPin size={12} />} steps={plan.regionSteps} />
                    <PlanSection title="Skills to train" icon={<Dumbbell size={12} />} steps={plan.skillSteps} />
                    {plan.qpStep && (
                      <PlanSection title="Quest points" icon={<Star size={12} />} steps={[plan.qpStep]} />
                    )}
                    <PlanSection
                      title="Quests in order"
                      icon={<ArrowRight size={12} />}
                      steps={plan.questSteps}
                      numbered
                    />
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
