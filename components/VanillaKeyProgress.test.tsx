import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { vanillaBossKeyStage } from '../config/vanillaKeyEconomy';
import { BossKeyProgress, ClueKeyProgress } from './VanillaKeyProgress';

describe('BossKeyProgress', () => {
  it('shows the current chance before a boss key is awarded', () => {
    const markup = renderToStaticMarkup(
      <BossKeyProgress stage={vanillaBossKeyStage('Zulrah', 0)} />,
    );

    expect(markup).toContain('30% current');
    expect(markup).toContain('15% next');
  });

  it('shows the awarded reserve after a key', () => {
    const markup = renderToStaticMarkup(
      <BossKeyProgress stage={vanillaBossKeyStage('Zulrah', 1)} />,
    );

    expect(markup).toContain('1 / 2 keys');
  });

  it('marks an exhausted boss reserve without implying ordinary loot is disabled', () => {
    const markup = renderToStaticMarkup(
      <BossKeyProgress stage={vanillaBossKeyStage('Zulrah', 2)} />,
    );

    expect(markup).toContain('Key reserve exhausted');
    expect(markup).toContain('Only this key/Fate roll is exhausted');
  });
});

describe('ClueKeyProgress', () => {
  it('shows the shared onboarding floor when it exceeds the tier rate', () => {
    const markup = renderToStaticMarkup(<ClueKeyProgress awarded={1} baseRate={5} />);

    expect(markup).toContain('15% onboarding rate');
  });

  it('announces normal tier rates after the shared onboarding reserve', () => {
    const markup = renderToStaticMarkup(<ClueKeyProgress awarded={3} baseRate={5} />);

    expect(markup).toContain('Normal tier rates apply');
  });
});
