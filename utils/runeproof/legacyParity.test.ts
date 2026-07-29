import { describe, expect, it } from 'vitest';
import { migrateSaveForTest } from '../../context/GameContext';
import { SKILLS_LIST } from '../../constants';
import { planForTarget } from '../goalPlanner';
import { compileProductionQuestGoals } from './goalCompiler';

const componentSources = import.meta.glob('../../components/{Dashboard,GoalTracker}.tsx', {
  eager: true, query: '?raw', import: 'default',
}) as Record<string, string>;

const componentSource = (name: string): string => {
  const source = Object.entries(componentSources).find(([path]) => path.endsWith('/' + name))?.[1];
  if (!source) throw new Error('Missing component source: ' + name);
  return source;
};
const maxedUnlocks = () => ({
  equipment: {},
  skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 10])),
  levels: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 99])),
  regions: [], chunks: [], mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
  bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [], quests: [], diaries: [],
  cas: [], completedTasks: [], collectionLog: {},
});

type DifferenceCategory =
  | 'RuneProof fixes an approximation'
  | 'RuneProof is UNKNOWN because proof coverage is incomplete'
  | 'Source data must be corrected before migration';

/**
 * Deliberately varied quest corpus retained while the old planner is available
 * to developers as a comparison aid.  The production surface must not use
 * its reachability answer.
 */
const legacyQuestCorpus: ReadonlyArray<readonly [string, DifferenceCategory]> = [
  ['Cook\'s Assistant', 'RuneProof is UNKNOWN because proof coverage is incomplete'],
  ['Demon Slayer', 'RuneProof is UNKNOWN because proof coverage is incomplete'],
  ['Doric\'s Quest', 'RuneProof is UNKNOWN because proof coverage is incomplete'],
  ['Ernest the Chicken', 'RuneProof is UNKNOWN because proof coverage is incomplete'],
  ['Goblin Diplomacy', 'RuneProof is UNKNOWN because proof coverage is incomplete'],
  ['Imp Catcher', 'RuneProof is UNKNOWN because proof coverage is incomplete'],
  ['The Restless Ghost', 'RuneProof is UNKNOWN because proof coverage is incomplete'],
  ['Romeo & Juliet', 'RuneProof is UNKNOWN because proof coverage is incomplete'],
  ['Sheep Shearer', 'RuneProof is UNKNOWN because proof coverage is incomplete'],
  ['Vampyre Slayer', 'RuneProof is UNKNOWN because proof coverage is incomplete'],
  ['Waterfall Quest', 'RuneProof is UNKNOWN because proof coverage is incomplete'],
  ['Witch\'s Potion', 'RuneProof is UNKNOWN because proof coverage is incomplete'],
  ['Witch\'s House', 'RuneProof is UNKNOWN because proof coverage is incomplete'],
  ['X Marks the Spot', 'RuneProof is UNKNOWN because proof coverage is incomplete'],
  ['Druidic Ritual', 'RuneProof is UNKNOWN because proof coverage is incomplete'],
  ['Lost City', 'RuneProof is UNKNOWN because proof coverage is incomplete'],
  ['Merlin\'s Crystal', 'RuneProof is UNKNOWN because proof coverage is incomplete'],
  ['Priest in Peril', 'RuneProof is UNKNOWN because proof coverage is incomplete'],
  ['Tree Gnome Village', 'RuneProof is UNKNOWN because proof coverage is incomplete'],
  ['Fight Arena', 'RuneProof is UNKNOWN because proof coverage is incomplete'],
  ['Dragon Slayer I', 'RuneProof is UNKNOWN because proof coverage is incomplete'],
  ['Desert Treasure I', 'RuneProof is UNKNOWN because proof coverage is incomplete'],
  ['Monkey Madness I', 'RuneProof is UNKNOWN because proof coverage is incomplete'],
  ['RFD: The Cook', 'RuneProof is UNKNOWN because proof coverage is incomplete'],
  ['Song of the Elves', 'RuneProof is UNKNOWN because proof coverage is incomplete'],
];

describe('legacy planner quarantine', () => {
  it('records a categorized RuneProof comparison corpus before legacy planner migration', () => {
    const runeProofGoals = new Map(compileProductionQuestGoals().map(goal => [goal.label, goal]));
    const knownCategories: DifferenceCategory[] = [
      'RuneProof fixes an approximation',
      'RuneProof is UNKNOWN because proof coverage is incomplete',
      'Source data must be corrected before migration',
    ];

    expect(legacyQuestCorpus).toHaveLength(25);
    for (const [questId, category] of legacyQuestCorpus) {
      // The legacy route is intentionally characterized, never used as the
      // expected result for RuneProof.
      expect(planForTarget('quest', questId, maxedUnlocks())).not.toBeNull();
      expect(runeProofGoals.get(questId)?.coverage).not.toBe('VERIFIED');
      expect(knownCategories).toContain(category);
    }
  });

  it('keeps legacy route claims out of the production goal tracker', () => {
    const goalTracker = componentSource('GoalTracker.tsx');
    expect(goalTracker).not.toContain("from './GoalRouteView'");
    expect(goalTracker).not.toContain('<GoalRouteView');
  });

  it('keeps the legacy modal available only behind the explicit development comparison gate', () => {
    const dashboard = componentSource('Dashboard.tsx');
    expect(dashboard).toContain("import.meta.env.DEV && import.meta.env.VITE_ENABLE_LEGACY_GOAL_PLANNER === 'true'");
    expect(dashboard).toContain('SHOW_LEGACY_GOAL_PLANNER && showGoalPlanner');
  });

  it('loads existing pinned goals without rewriting saved goal ids', () => {
    const saved = migrateSaveForTest({
      history: [],
      pinnedGoals: ['Dragon Slayer I', 'Ranarr Weed'],
    });

    expect(saved.pinnedGoals).toEqual(['Dragon Slayer I', 'Ranarr Weed']);
  });
});
