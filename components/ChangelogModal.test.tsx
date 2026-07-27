import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ChangelogRelease } from '../data/changelog';
import { shouldAutoOpenAfterOnboarding } from '../utils/changelogModalState';
import { resolveFocusRestorationTarget } from '../hooks/useFocusTrap';
import { ChangelogModal, toggleExpandedRelease } from './ChangelogModal';

const releases: readonly ChangelogRelease[] = [
  {
    id: '2026-07-26-latest',
    title: 'Latest release',
    date: '2026-07-26',
    sections: {
      added: ['Added note'],
      changed: ['Changed note'],
      fixed: ['Fixed note'],
      balance: ['Balance note'],
    },
  },
  {
    id: '2026-07-23-previous',
    title: 'Previous release',
    date: '2026-07-23',
    sections: {
      fixed: ['Previous fix'],
    },
  },
];

const renderModal = (history: readonly ChangelogRelease[] = releases): string =>
  renderToStaticMarkup(<ChangelogModal releases={history} onClose={() => undefined} />);

const releaseButton = (markup: string, id: string): string =>
  markup.match(new RegExp(`<button[^>]*id="changelog-release-toggle-${id}"[^>]*>`))?.[0] ?? '';

describe('ChangelogModal initial render', () => {
  it('renders every release newest-first with stable expanded controls', () => {
    const markup = renderModal();
    const latestButton = releaseButton(markup, '2026-07-26-latest');
    const previousButton = releaseButton(markup, '2026-07-23-previous');

    expect(markup.indexOf('Latest release')).toBeLessThan(markup.indexOf('Previous release'));
    expect(markup).toContain('dateTime="2026-07-26"');
    expect(markup).toContain('dateTime="2026-07-23"');
    expect(latestButton).toContain('aria-expanded="true"');
    expect(latestButton).toContain('aria-controls="changelog-release-2026-07-26-latest"');
    expect(previousButton).toContain('aria-expanded="false"');
    expect(previousButton).toContain('aria-controls="changelog-release-2026-07-23-previous"');
    expect(markup).toContain('id="changelog-release-2026-07-26-latest"');
    expect(markup).toContain('id="changelog-release-2026-07-23-previous"');
  });

  it('renders every supported section, including Balance, for an expanded release', () => {
    const markup = renderModal();

    expect(markup).toContain('Added');
    expect(markup).toContain('Changed');
    expect(markup).toContain('Fixed');
    expect(markup).toContain('Balance');
    expect(markup).toContain('Balance note');
  });

  it('omits absent and empty section headings', () => {
    const markup = renderModal([
      {
        id: '2026-07-26-small',
        title: 'Small release',
        date: '2026-07-26',
        sections: { added: ['Only this heading belongs here'], changed: [] },
      },
    ]);

    expect(markup).toContain('Added');
    expect(markup).not.toContain('Changed');
    expect(markup).not.toContain('Fixed');
    expect(markup).not.toContain('Balance');
  });
});

describe('changelog auto-open eligibility', () => {
  it('waits for onboarding and opens only for an unseen latest release', () => {
    const latestId = '2026-07-26-latest';

    expect(shouldAutoOpenAfterOnboarding(false, latestId, null)).toBe(false);
    expect(shouldAutoOpenAfterOnboarding(true, latestId, latestId)).toBe(false);
    expect(shouldAutoOpenAfterOnboarding(true, latestId, '2026-07-23-previous')).toBe(true);
  });
});

describe('ChangelogModal focus restoration', () => {
  it('prefers the persistent manual trigger and otherwise retains auto-open focus', () => {
    const utilityButton = { id: 'utility-button' };
    const activeBody = { id: 'document-body' };

    expect(resolveFocusRestorationTarget(utilityButton, activeBody)).toBe(utilityButton);
    expect(resolveFocusRestorationTarget(null, activeBody)).toBe(activeBody);
  });
});

describe('toggleExpandedRelease', () => {
  it('opens an older release without collapsing the latest release or changing seen state', () => {
    const latestId = '2026-07-26-latest';
    const latestSeenId = latestId;
    const expanded = toggleExpandedRelease(new Set([latestId]), '2026-07-23-previous');

    expect([...expanded]).toEqual([latestId, '2026-07-23-previous']);
    expect(latestSeenId).toBe(latestId);
  });

  it('collapses only the release that is toggled', () => {
    const expanded = toggleExpandedRelease(
      new Set(['2026-07-26-latest', '2026-07-23-previous']),
      '2026-07-23-previous',
    );

    expect([...expanded]).toEqual(['2026-07-26-latest']);
  });
});
