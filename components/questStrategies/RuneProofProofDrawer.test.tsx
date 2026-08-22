// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { RuneProofCoachModel } from '../../utils/questStrategies/coach';
import type { ChunkPickerWalkthroughSource } from '../../utils/questWalkthroughs/model';
import { RuneProofProofDrawer } from './RuneProofProofDrawer';

afterEach(cleanup);

const chunkPickerSource: ChunkPickerWalkthroughSource = {
    kind: 'CHUNK_PICKER_REVIEW',
    wikiTitle: "Cook's Assistant/Quick guide",
    wikiRevision: '123456',
    wikiRevisionTimestamp: '2026-08-20T00:00:00Z',
    wikiUrl: 'https://oldschool.runescape.wiki/w/Cook%27s_Assistant/Quick_guide?oldid=123456',
    wikiLicence: 'CC BY-NC-SA 3.0',
    wikiLicenceUrl: 'https://creativecommons.org/licenses/by-nc-sa/3.0/',
    chunkPickerRepository: 'source-chunk/chunk-picker-v2',
    chunkPickerCommit: 'abc123',
    chunkPickerLicenceStatus: 'PERMISSION_RECORDED',
    permissionReference: 'review-record-1',
};

const proof: RuneProofCoachModel['proof'] = {
  source: chunkPickerSource,
  sourceLines: [{
    id: 'cooks-assistant-1',
    section: 'Quick guide',
    sourceOrder: 1,
    rawText: 'Bring a pot, bucket, and egg to the Cook.',
  }],
  diagnostics: ['Route budget and source wording are retained for proof.'],
};

describe('RuneProofProofDrawer', () => {
  it('shows independent public guide provenance without rendering Chunk Picker fields', async () => {
    const user = userEvent.setup();
    render(
      <RuneProofProofDrawer
        proof={{
          source: {
            kind: 'INDEPENDENT_REVIEW',
            author: 'Fate Locked',
            authoredAt: '2026-08-22',
            methodology: 'Independently authored quest steps and F2P chunk locations.',
            wikiTitle: "Cook's Assistant/Quick guide",
            wikiRevision: '15240921',
            wikiRevisionTimestamp: '2026-08-22T00:00:00Z',
            wikiUrl: 'https://oldschool.runescape.wiki/w/Cook%27s_Assistant/Quick_guide?oldid=15240921',
            wikiLicence: 'CC BY-NC-SA 3.0',
            wikiLicenceUrl: 'https://creativecommons.org/licenses/by-nc-sa/3.0/',
          },
          sourceLines: [],
          diagnostics: [],
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Proof and sources' }));

    expect(screen.getByText('Independently authored by Fate Locked on 2026-08-22.')).toBeTruthy();
    expect(screen.getByText('Independently authored quest steps and F2P chunk locations.')).toBeTruthy();
    expect(screen.queryByText(/Chunk Picker/)).toBeNull();
    expect(screen.getByRole('heading', { level: 4, name: 'Guide notes' })).toBeTruthy();
  });

  it('keeps revision, raw source wording, and diagnostics hidden until its accessible disclosure opens', async () => {
    const user = userEvent.setup();
    render(<RuneProofProofDrawer proof={proof} />);

    const disclosure = screen.getByRole('button', { name: 'Proof and sources' });
    expect(disclosure.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Wiki revision: 123456')).toBeNull();
    expect(screen.queryByText('Bring a pot, bucket, and egg to the Cook.')).toBeNull();
    expect(screen.queryByText('Route budget and source wording are retained for proof.')).toBeNull();

    await user.click(disclosure);

    expect(disclosure.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Wiki revision: 123456')).toBeTruthy();
    expect(screen.getByRole('link', {
      name: "Cook's Assistant/Quick guide",
    })).toBeTruthy();
    expect(screen.getByText('Chunk Picker reuse status: PERMISSION_RECORDED')).toBeTruthy();
    expect(screen.getByText('Review record: review-record-1')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 4, name: 'Provenance' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 4, name: 'Reviewed source wording' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 4, name: 'Route diagnostics' })).toBeTruthy();
    expect(screen.getByText('Bring a pot, bucket, and egg to the Cook.')).toBeTruthy();
    expect(screen.getByText('Route budget and source wording are retained for proof.')).toBeTruthy();
  });

  it('reports an unverified chunk-picker reuse status without inventing a review record', async () => {
    const user = userEvent.setup();
    render(
      <RuneProofProofDrawer
        proof={{
          ...proof,
          source: {
            ...chunkPickerSource,
            chunkPickerLicenceStatus: 'UNVERIFIED',
            permissionReference: undefined,
          },
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Proof and sources' }));

    expect(screen.getByText('Chunk Picker reuse status: UNVERIFIED')).toBeTruthy();
    expect(screen.queryByText(/Review record:/)).toBeNull();
  });
});
