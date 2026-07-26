import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { KeyEconomyEvidenceExport } from './KeyEconomyEvidenceExport';

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
});
