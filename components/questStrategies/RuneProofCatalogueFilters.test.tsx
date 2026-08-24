// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  filterRuneProofCatalogue,
  RuneProofCatalogueFilters,
  type RuneProofCatalogueFilterState,
} from './RuneProofCatalogueFilters';
import {
  catalogueSummary,
  makeCatalogueSummaries,
} from '../../utils/questStrategies/testFixtures';

afterEach(cleanup);

const ALL_FILTERS: RuneProofCatalogueFilterState = {
  query: '',
  kind: 'ALL',
  membership: 'ALL',
  series: 'ALL',
  readiness: 'ALL',
  milestone: 'ALL',
  reviewStatus: 'ALL',
};

describe('RuneProof catalogue filters', () => {
  it('preserves exact unfiltered counts and combines every dimension', () => {
    const summaries = makeCatalogueSummaries(210);
    expect(filterRuneProofCatalogue(summaries, ALL_FILTERS)).toHaveLength(210);
    expect(filterRuneProofCatalogue(summaries, {
      ...ALL_FILTERS,
      kind: 'quest',
    })).toHaveLength(191);
    expect(filterRuneProofCatalogue(summaries, {
      ...ALL_FILTERS,
      kind: 'miniquest',
    })).toHaveLength(19);
    expect(filterRuneProofCatalogue(summaries, {
      ...ALL_FILTERS,
      membership: 'F2P',
    })).toHaveLength(23);
    expect(filterRuneProofCatalogue(summaries, {
      ...ALL_FILTERS,
      membership: 'MEMBERS',
    })).toHaveLength(187);
    const wanted = {
      ...ALL_FILTERS,
      query: 'match',
      kind: 'quest',
      membership: 'MEMBERS',
      series: 'Dragonkin',
      readiness: 'BLOCKED',
      milestone: 4,
      reviewStatus: 'PREVIEW_VALIDATED',
    } as const;
    const matching = catalogueSummary({
      questId: 'Dragon match',
      kind: 'quest',
      membership: 'MEMBERS',
      series: 'Dragonkin',
      proofState: 'BLOCKED',
      milestone: 4,
      reviewStatus: 'PREVIEW_VALIDATED',
    });
    const nearMisses = [
      catalogueSummary({ ...matching, questId: 'No wyrm here' }),
      catalogueSummary({ ...matching, questId: 'Match kind', kind: 'miniquest' }),
      catalogueSummary({ ...matching, questId: 'Match membership', membership: 'F2P' }),
      catalogueSummary({ ...matching, questId: 'Match series', series: 'Mahjarrat' }),
      catalogueSummary({ ...matching, questId: 'Match readiness', proofState: 'READY' }),
      catalogueSummary({ ...matching, questId: 'Match milestone', milestone: 3 }),
      catalogueSummary({ ...matching, questId: 'Match review', reviewStatus: 'NO_PACK' }),
    ];
    expect(filterRuneProofCatalogue([matching, ...nearMisses], wanted)
      .map(value => value.questId)).toEqual(['Dragon match']);
  });

  it('searches quest IDs and series case-insensitively', () => {
    const questMatch = catalogueSummary({ questId: 'Dragon Slayer', series: 'None' });
    const seriesMatch = catalogueSummary({ questId: 'A Tail of Two Cats', series: 'DRAGONKIN' });
    const miss = catalogueSummary({ questId: 'Cook\'s Assistant', series: 'Lumbridge' });

    expect(filterRuneProofCatalogue([questMatch, seriesMatch, miss], {
      ...ALL_FILTERS,
      query: 'dragon',
    }).map(value => value.questId)).toEqual(['Dragon Slayer', 'A Tail of Two Cats']);
  });

  it('preserves kind and membership distributions when a miniquest has no pack', () => {
    const summaries = makeCatalogueSummaries(210, {
      noPackQuestIds: new Set(['Quest 210']),
    });

    expect(filterRuneProofCatalogue(summaries, {
      ...ALL_FILTERS,
      kind: 'quest',
    })).toHaveLength(191);
    expect(filterRuneProofCatalogue(summaries, {
      ...ALL_FILTERS,
      kind: 'miniquest',
    })).toHaveLength(19);
    expect(filterRuneProofCatalogue(summaries, {
      ...ALL_FILTERS,
      membership: 'F2P',
    })).toHaveLength(23);
    expect(filterRuneProofCatalogue(summaries, {
      ...ALL_FILTERS,
      membership: 'MEMBERS',
    })).toHaveLength(187);
    expect(summaries[209]).toMatchObject({
      questId: 'Quest 210',
      kind: 'miniquest',
      membership: 'MEMBERS',
      packDisposition: 'NO_PACK',
      proofState: 'NEEDS_REVIEW',
      playable: false,
    });
  });

  it('emits complete immutable states for every labelled control', () => {
    const onChange = vi.fn();
    render(<RuneProofCatalogueFilters
      value={ALL_FILTERS}
      seriesOptions={['Dragonkin']}
      resultCount={210}
      totalCount={210}
      onChange={onChange}
    />);

    fireEvent.change(screen.getByLabelText('Search RuneProof objectives'), {
      target: { value: 'dragon' },
    });
    fireEvent.change(screen.getByLabelText('Objective kind'), {
      target: { value: 'miniquest' },
    });
    fireEvent.change(screen.getByLabelText('Membership'), {
      target: { value: 'MEMBERS' },
    });
    fireEvent.change(screen.getByLabelText('Series'), {
      target: { value: 'Dragonkin' },
    });
    fireEvent.change(screen.getByLabelText('Readiness'), {
      target: { value: 'CONFIRM' },
    });
    fireEvent.change(screen.getByLabelText('Review status'), {
      target: { value: 'PUBLIC_APPROVED' },
    });

    expect(onChange.mock.calls.map(([value]) => value)).toEqual([
      { ...ALL_FILTERS, query: 'dragon' },
      { ...ALL_FILTERS, kind: 'miniquest' },
      { ...ALL_FILTERS, membership: 'MEMBERS' },
      { ...ALL_FILTERS, series: 'Dragonkin' },
      { ...ALL_FILTERS, readiness: 'CONFIRM' },
      { ...ALL_FILTERS, reviewStatus: 'PUBLIC_APPROVED' },
    ]);
    expect(onChange.mock.calls.every(([value]) => Object.isFrozen(value))).toBe(true);
    expect(Object.isFrozen(ALL_FILTERS)).toBe(false);
  });

  it('emits a deterministic reset and keeps focus on the activated control', () => {
    const onChange = vi.fn();
    render(<RuneProofCatalogueFilters
      value={{ ...ALL_FILTERS, query: 'dragon', kind: 'quest' }}
      seriesOptions={['Dragonkin']}
      resultCount={1}
      totalCount={210}
      onChange={onChange}
    />);
    expect(screen.getByText('Showing 1 of 210 objectives')).toBeTruthy();
    const reset = screen.getByRole('button', { name: 'Reset RuneProof filters' });
    reset.focus();
    fireEvent.click(reset);
    expect(onChange).toHaveBeenCalledWith(ALL_FILTERS);
    expect(document.activeElement).toBe(reset);
  });

  it.each([
    ['1', 1],
    ['2', 2],
    ['3', 3],
    ['4', 4],
    ['5', 5],
    ['ALL', 'ALL'],
    ['unexpected', 'ALL'],
  ] as const)('converts milestone %s to the exact filter union', (value, expected) => {
    const onChange = vi.fn();
    render(<RuneProofCatalogueFilters
      value={ALL_FILTERS}
      seriesOptions={[]}
      resultCount={210}
      totalCount={210}
      onChange={onChange}
    />);
    fireEvent.change(screen.getByLabelText('Milestone'), {
      target: { value },
    });
    expect(onChange).toHaveBeenCalledWith({ ...ALL_FILTERS, milestone: expected });
  });
});
