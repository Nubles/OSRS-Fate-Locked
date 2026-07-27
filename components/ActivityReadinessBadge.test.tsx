import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ActivityReadinessBadge } from './ActivityReadinessBadge';
import type { ActivityReadiness } from '../utils/activityReadiness';

const markup = (readiness: ActivityReadiness) => renderToStaticMarkup(
  <ActivityReadinessBadge readiness={readiness} />,
);

describe('ActivityReadinessBadge', () => {
  it('renders machine blockers and manual checks distinctly', () => {
    expect(markup({
      status: 'NOT_READY',
      blockers: [{ kind: 'area', label: "Void Knights' Outpost" }],
    })).toContain('Void Knights&#x27; Outpost');

    expect(markup({
      status: 'NEEDS_CONFIRMATION',
      checks: ['Complete Frozen key'],
    })).toContain('Confirm: Complete Frozen key');
  });

  it('keeps locked, ready, and not-ready labels distinct', () => {
    expect(markup({ status: 'LOCKED', blockers: [] })).toContain('Not owned');
    expect(markup({ status: 'READY' })).toContain('Ready');
    expect(markup({
      status: 'NOT_READY',
      blockers: [{ kind: 'combat', label: 'Combat level 40' }],
    })).toContain('Not ready');
  });
});
