import React, { useMemo, useState } from 'react';
import {
  Trophy, X, BookOpen, Dumbbell, MapPin, Shield, Map, Swords,
  Skull, Gamepad2, Library, Crown, Star, Sparkles, Flame, Lock, CheckCircle2,
  type LucideIcon,
} from 'lucide-react';
import { useGame } from '../context/GameContext';
import {
  evaluateAchievements, EvaluatedAchievement, AchievementIcon, AchievementCategory,
} from '../utils/achievements';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface Props {
  onClose: () => void;
}

/** Map an achievement's icon key to a lucide glyph. Shared with the reveal. */
export const ACHIEVEMENT_ICON: Record<AchievementIcon, LucideIcon> = {
  quest: BookOpen,
  skill: Dumbbell,
  region: MapPin,
  equipment: Shield,
  diary: Map,
  combat: Swords,
  boss: Skull,
  minigame: Gamepad2,
  collection: Library,
  trophy: Trophy,
  crown: Crown,
  star: Star,
  map: Map,
  sparkles: Sparkles,
  flame: Flame,
};

const CATEGORY_ORDER: AchievementCategory[] = [
  'Quests', 'Skills', 'Regions', 'Equipment', 'Diaries', 'Combat', 'Activities', 'Collection', 'Mastery',
];

export const AchievementsModal: React.FC<Props> = ({ onClose }) => {
  const { unlocks } = useGame();
  useEscapeKey(onClose, true);

  const all = useMemo(() => evaluateAchievements(unlocks), [unlocks]);
  const earnedCount = all.filter((a) => a.earned).length;
  const pct = all.length > 0 ? Math.round((earnedCount / all.length) * 100) : 0;

  const [filter, setFilter] = useState<AchievementCategory | 'ALL'>('ALL');

  const shown = useMemo(() => {
    const list = filter === 'ALL' ? all : all.filter((a) => a.category === filter);
    // Earned first, then closest-to-earned (by pct desc).
    return [...list].sort(
      (a, b) => Number(b.earned) - Number(a.earned) || b.pct - a.pct,
    );
  }, [all, filter]);

  const categories: Array<AchievementCategory | 'ALL'> = ['ALL', ...CATEGORY_ORDER];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Achievements"
    >
      <div
        className="bg-[#161616] border border-white/10 rounded-xl shadow-2xl w-full max-w-3xl h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-white/10 bg-[#1b1b1b] shrink-0">
          <div className="p-2 bg-amber-900/20 rounded-lg border border-amber-500/30 text-amber-400">
            <Trophy size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-white leading-none">Achievements</h2>
            <p className="text-[11px] text-gray-500 mt-1">
              {earnedCount} of {all.length} earned · {pct}% complete
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

        {/* Overall progress */}
        <div className="px-4 pt-3 shrink-0">
          <div className="h-1.5 bg-black/50 rounded-full overflow-hidden border border-white/5">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Category filter */}
        <div className="px-4 py-3 flex flex-wrap gap-1.5 shrink-0">
          {categories.map((c) => {
            const isActive = filter === c;
            const count = c === 'ALL' ? all.length : all.filter((a) => a.category === c).length;
            if (count === 0) return null;
            return (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border transition-colors ${
                  isActive
                    ? 'bg-amber-900/30 border-amber-500/40 text-amber-300'
                    : 'bg-[#1a1a1a] border-white/10 text-gray-500 hover:text-gray-300'
                }`}
              >
                {c === 'ALL' ? 'All' : c}
              </button>
            );
          })}
        </div>

        {/* Badge grid */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {shown.map((a) => (
              <AchievementCard key={a.id} a={a} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const AchievementCard: React.FC<{ a: EvaluatedAchievement }> = ({ a }) => {
  const Icon = ACHIEVEMENT_ICON[a.icon] ?? Trophy;
  return (
    <div
      className={`relative flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
        a.earned
          ? 'bg-gradient-to-r from-amber-900/20 to-transparent border-amber-500/30'
          : 'bg-[#1a1a1a] border-white/5'
      }`}
    >
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${
          a.earned
            ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
            : 'bg-black/30 border-white/5 text-gray-600'
        }`}
      >
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`text-[12px] font-bold truncate ${a.earned ? 'text-amber-200' : 'text-gray-400'}`}>
            {a.title}
          </span>
          {a.earned ? (
            <CheckCircle2 size={12} className="text-amber-400 shrink-0" aria-hidden />
          ) : (
            <Lock size={10} className="text-gray-600 shrink-0" aria-hidden />
          )}
        </div>
        <p className="text-[10px] text-gray-500 truncate">{a.description}</p>
        {!a.earned && (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 h-[3px] bg-black/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500/60 rounded-full transition-all duration-500"
                style={{ width: `${a.pct}%` }}
              />
            </div>
            <span className="text-[9px] text-gray-600 font-mono shrink-0">
              {a.current}/{a.target}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
