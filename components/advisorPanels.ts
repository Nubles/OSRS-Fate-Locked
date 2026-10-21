/**
 * The Advisor panels, loaded together on demand. Advisors are off by default,
 * so the Dashboard loads this chunk only once a player turns them on, and the
 * advisor rankings (quest/diary impact, frontier and skill bottlenecks) stay
 * out of the entry chunk every visit downloads first.
 */
export { SkillAdvisorPanel } from './SkillAdvisorPanel';
export { RegionAdvisorPanel } from './RegionAdvisorPanel';
export { FrontierAdvisorPanel } from './FrontierAdvisorPanel';
export { JournalNextBest } from './JournalNextBest';
