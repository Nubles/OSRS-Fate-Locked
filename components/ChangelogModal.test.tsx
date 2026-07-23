import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ChangelogRelease } from '../data/changelog';
import { ChangelogModal } from './ChangelogModal';

const release: ChangelogRelease = {
  id: 'release-1',
  title: 'Tracker Accuracy',
  date: '23 July 2026',
  sections: {
    added: ['A permanent changelog is now available.'],
    changed: [],
    fixed: ['Quest access is now accurate.'],
  },
};

describe('ChangelogModal', () => {
  it('renders a labelled modal with two accessible close controls', () => {
    const markup = renderToStaticMarkup(
      <ChangelogModal release={release} onClose={vi.fn()} />,
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain('aria-labelledby="changelog-title"');
    expect(markup).toContain('aria-describedby="changelog-summary"');
    expect(markup).toContain('aria-label="Close What&#x27;s New"');
    expect(markup).toContain('Got it');
    expect(markup.match(/type="button"/g)).toHaveLength(2);
  });

  it('renders release content with a normal separator and omits empty sections', () => {
    const markup = renderToStaticMarkup(
      <ChangelogModal release={release} onClose={vi.fn()} />,
    );

    expect(markup).toContain("What&#x27;s New \u2014 23 July 2026");
    expect(markup).toContain('Tracker Accuracy');
    expect(markup).toContain('Added');
    expect(markup).toContain('Fixed');
    expect(markup).not.toContain('changelog-changed');
  });
});
