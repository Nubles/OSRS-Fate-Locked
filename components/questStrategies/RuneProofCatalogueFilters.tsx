import type {
  RuneProofCatalogueReviewStatus,
  RuneProofCatalogueSummary,
} from '../../data/questWalkthroughLoader';
import type { RuneProofProofState } from '../../utils/questStrategies/packModel';

export interface RuneProofCatalogueFilterState {
  readonly query: string;
  readonly kind: 'ALL' | 'quest' | 'miniquest';
  readonly membership: 'ALL' | 'F2P' | 'MEMBERS';
  readonly series: 'ALL' | string;
  readonly readiness: 'ALL' | RuneProofProofState;
  readonly milestone: 'ALL' | 1 | 2 | 3 | 4 | 5;
  readonly reviewStatus: 'ALL' | RuneProofCatalogueReviewStatus;
}

export const DEFAULT_RUNE_PROOF_FILTERS: RuneProofCatalogueFilterState =
  Object.freeze({
    query: '',
    kind: 'ALL',
    membership: 'ALL',
    series: 'ALL',
    readiness: 'ALL',
    milestone: 'ALL',
    reviewStatus: 'ALL',
  });

export const filterRuneProofCatalogue = (
  summaries: readonly RuneProofCatalogueSummary[],
  filters: RuneProofCatalogueFilterState,
): readonly RuneProofCatalogueSummary[] => {
  const query = filters.query.trim().toLocaleLowerCase();
  return summaries.filter(summary => (
    (query.length === 0
      || summary.questId.toLocaleLowerCase().includes(query)
      || summary.series?.toLocaleLowerCase().includes(query) === true)
    && (filters.kind === 'ALL' || summary.kind === filters.kind)
    && (filters.membership === 'ALL' || summary.membership === filters.membership)
    && (filters.series === 'ALL' || summary.series === filters.series)
    && (filters.readiness === 'ALL' || summary.proofState === filters.readiness)
    && (filters.milestone === 'ALL' || summary.milestone === filters.milestone)
    && (filters.reviewStatus === 'ALL' || summary.reviewStatus === filters.reviewStatus)
  ));
};

const milestoneFromDom = (
  value: string,
): RuneProofCatalogueFilterState['milestone'] => {
  switch (value) {
    case '1': return 1;
    case '2': return 2;
    case '3': return 3;
    case '4': return 4;
    case '5': return 5;
    case 'ALL':
    default:
      return 'ALL';
  }
};

const READINESS_OPTIONS: readonly RuneProofProofState[] = [
  'READY',
  'CONFIRM',
  'BLOCKED',
  'NEEDS_REVIEW',
  'COMPLETE',
];

const REVIEW_STATUS_OPTIONS: readonly RuneProofCatalogueReviewStatus[] = [
  'NO_PACK',
  'REJECTED',
  'DRAFT',
  'PREVIEW_VALIDATED',
  'MILESTONE_APPROVED',
  'PUBLIC_APPROVED',
];

export interface RuneProofCatalogueFiltersProps {
  readonly value: RuneProofCatalogueFilterState;
  readonly seriesOptions: readonly string[];
  readonly resultCount: number;
  readonly totalCount: number;
  readonly onChange: (value: RuneProofCatalogueFilterState) => void;
}

export function RuneProofCatalogueFilters({
  value,
  seriesOptions,
  resultCount,
  totalCount,
  onChange,
}: RuneProofCatalogueFiltersProps) {
  const emit = (change: Partial<RuneProofCatalogueFilterState>) => {
    onChange(Object.freeze({ ...value, ...change }));
  };

  return (
    <section aria-label="RuneProof catalogue filters">
      <p>Showing {resultCount} of {totalCount} objectives</p>

      <label>
        Search RuneProof objectives
        <input
          type="search"
          aria-label="Search RuneProof objectives"
          value={value.query}
          onChange={event => emit({ query: event.currentTarget.value })}
        />
      </label>

      <label>
        Objective kind
        <select
          aria-label="Objective kind"
          value={value.kind}
          onChange={event => emit({
            kind: event.currentTarget.value === 'quest'
              ? 'quest'
              : event.currentTarget.value === 'miniquest'
                ? 'miniquest'
                : 'ALL',
          })}
        >
          <option value="ALL">All kinds</option>
          <option value="quest">Quests</option>
          <option value="miniquest">Miniquests</option>
        </select>
      </label>

      <label>
        Membership
        <select
          aria-label="Membership"
          value={value.membership}
          onChange={event => emit({
            membership: event.currentTarget.value === 'F2P'
              ? 'F2P'
              : event.currentTarget.value === 'MEMBERS'
                ? 'MEMBERS'
                : 'ALL',
          })}
        >
          <option value="ALL">All memberships</option>
          <option value="F2P">Free-to-play</option>
          <option value="MEMBERS">Members</option>
        </select>
      </label>

      <label>
        Series
        <select
          aria-label="Series"
          value={value.series}
          onChange={event => emit({
            series: event.currentTarget.value === 'ALL'
              ? 'ALL'
              : event.currentTarget.value,
          })}
        >
          <option value="ALL">All series</option>
          {seriesOptions.map(series => (
            <option key={series} value={series}>{series}</option>
          ))}
        </select>
      </label>

      <label>
        Readiness
        <select
          aria-label="Readiness"
          value={value.readiness}
          onChange={event => emit({
            readiness: READINESS_OPTIONS.find(option => option === event.currentTarget.value)
              ?? 'ALL',
          })}
        >
          <option value="ALL">All readiness states</option>
          {READINESS_OPTIONS.map(readiness => (
            <option key={readiness} value={readiness}>{readiness}</option>
          ))}
        </select>
      </label>

      <label>
        Milestone
        <select
          aria-label="Milestone"
          value={value.milestone}
          onChange={event => emit({ milestone: milestoneFromDom(event.currentTarget.value) })}
        >
          <option value="ALL">All milestones</option>
          {[1, 2, 3, 4, 5].map(milestone => (
            <option key={milestone} value={milestone}>{milestone}</option>
          ))}
        </select>
      </label>

      <label>
        Review status
        <select
          aria-label="Review status"
          value={value.reviewStatus}
          onChange={event => emit({
            reviewStatus: REVIEW_STATUS_OPTIONS.find(option => option === event.currentTarget.value)
              ?? 'ALL',
          })}
        >
          <option value="ALL">All review statuses</option>
          {REVIEW_STATUS_OPTIONS.map(status => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      </label>

      <button
        type="button"
        aria-label="Reset RuneProof filters"
        onClick={() => onChange(DEFAULT_RUNE_PROOF_FILTERS)}
      >
        Reset filters
      </button>
    </section>
  );
}
