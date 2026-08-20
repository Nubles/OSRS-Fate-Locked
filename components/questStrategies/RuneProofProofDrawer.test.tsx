// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { RuneProofCoachModel } from '../../utils/questStrategies/coach';
import { RuneProofProofDrawer } from './RuneProofProofDrawer';

afterEach(cleanup);

const proof: RuneProofCoachModel['proof'] = {
  source: {
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
  },
  sourceLines: [{
    id: 'cooks-assistant-1',
    section: 'Quick guide',
    sourceOrder: 1,
    rawText: 'Bring a pot, bucket, and egg to the Cook.',
  }],
  diagnostics: ['Route budget and source wording are retained for proof.'],
};

describe('RuneProofProofDrawer', () => {
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
            ...proof.source,
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
