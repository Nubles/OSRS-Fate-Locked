import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { LogEntry } from '../types';
import {
  downloadKeyEconomyEvidence,
  KeyEconomyEvidenceExport,
} from './KeyEconomyEvidenceExport';

describe('KeyEconomyEvidenceExport', () => {
  it('presents an explicit local aggregate-evidence export', () => {
    const html = renderToStaticMarkup(
      <KeyEconomyEvidenceExport
        history={[]}
        gameMode="vanilla"
        completionPercent={24}
        appVersion="test-build"
      />,
    );

    expect(html).toContain('Export aggregate evidence');
    expect(html).toContain('Observed play-hours');
    expect(html).toContain('Early');
    expect(html).toContain('0–24% completion');
    expect(html).toContain('No account name, run ID, raw history, or timestamps');
    expect(html).not.toContain('type="hidden"');
  });
  it('downloads the generated aggregate only after the explicit action', async () => {
    let downloadedBlob: Blob | undefined;
    let revokedUrl: string | undefined;
    let clickCount = 0;
    const anchor = {
      href: '',
      download: '',
      click: () => {
        clickCount += 1;
      },
    };
    const history: LogEntry[] = [{
      id: 'private-event-id',
      timestamp: 1_700_000_000_000,
      type: 'ROLL_FAIL',
      source: 'Boss (Mid)',
      result: 'FAIL',
      threshold: 20,
      message: '',
      meta: { fatePointsEarned: 1, linkedAccount: 'Sensitive Name' },
    }];

    const report = downloadKeyEconomyEvidence(
      history,
      {
        gameMode: 'vanilla',
        stage: 'mid',
        observedHours: 12.5,
        appVersion: 'test-build',
      },
      {
        randomUUID: () => '11111111-1111-4111-8111-111111111111',
        createObjectURL: (blob) => {
          downloadedBlob = blob;
          return 'blob:test-evidence';
        },
        revokeObjectURL: (url) => {
          revokedUrl = url;
        },
        createAnchor: () => anchor,
      },
    );

    expect(report.reportId).toBe('11111111-1111-4111-8111-111111111111');
    expect(anchor.href).toBe('blob:test-evidence');
    expect(anchor.download).toBe(
      'fate-key-evidence-11111111-1111-4111-8111-111111111111.json',
    );
    expect(clickCount).toBe(1);
    expect(revokedUrl).toBe('blob:test-evidence');
    expect(downloadedBlob?.type).toBe('application/json');
    const payload = await downloadedBlob?.text();
    expect(payload).toContain('"schemaVersion": 1');
    expect(payload).not.toContain('private-event-id');
    expect(payload).not.toContain('Sensitive Name');
    expect(payload).not.toContain('1700000000000');
  });
});
