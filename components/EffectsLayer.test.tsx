import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import * as effectsLayerModule from './EffectsLayer';

describe('roll feedback comparison', () => {
  it('renders pity as a failed natural roll above the threshold', () => {
    const RollFeedbackComparison = (
      effectsLayerModule as Record<string, unknown>
    ).RollFeedbackComparison as React.ComponentType<{
      roll: number;
      threshold: number;
      type: 'PITY';
    }>;

    expect(RollFeedbackComparison).toBeTypeOf('function');
    const html = renderToStaticMarkup(
      <RollFeedbackComparison roll={9.3} threshold={9.2} type="PITY" />,
    );
    expect(html).toContain('9.3 &gt; 9.2%');
  });
});