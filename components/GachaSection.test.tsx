import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TableType } from '../types';
import { SpendCard } from './GachaSection';

describe('SpendCard', () => {
  it('keeps View pool available when the player has no Keys', () => {
    const html = renderToStaticMarkup(
      <SpendCard
        type={TableType.BOSSES}
        label="Bosses"
        subLabel="Major Encounters"
        unlocked={0}
        total={10}
        disabled={false}
        keysAvailable={false}
        complete={false}
        onClick={() => undefined}
        onViewPool={() => undefined}
      />,
    );

    expect(html).toContain('View pool');
    expect(html).toContain('Need Keys');
    expect(html).toContain('aria-label="Roll Bosses"');
  });
});
