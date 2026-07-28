import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { GuideSetting } from '../../data/runeliteGuide';
import { GuideSettingsTable } from './GuideSettingsTable';

const settings: readonly GuideSetting[] = [
  {
    key: 'enabled',
    section: 'Warnings',
    label: 'Enabled warning',
    defaultValue: 'On',
    purpose: 'Explains a locked action.',
    visibleResult: 'A visible warning appears.',
    changeWhen: 'Turn it off when another channel is enough.',
  },
  {
    key: 'optional',
    section: 'Warnings',
    label: 'Optional warning',
    defaultValue: 'Off',
    purpose: 'Adds an extra notification.',
    visibleResult: 'RuneLite sends a native notification.',
    changeWhen: 'Turn it on when RuneLite is not focused.',
  },
];

describe('GuideSettingsTable', () => {
  it('renders every setting field in semantic rows and mobile cards', () => {
    const markup = renderToStaticMarkup(<GuideSettingsTable settings={settings} />);

    expect(markup).toContain('<table');
    expect(markup).toContain('scope="col"');
    expect(markup).toContain('Default');
    expect(markup).toContain('What it does');
    expect(markup).toContain('What you see');
    expect(markup).toContain('Change it when');
    expect(markup).toContain('Enabled warning');
    expect(markup).toContain('Optional warning');
    expect(markup).toContain('Explains a locked action.');
    expect(markup).toContain('A visible warning appears.');
    expect(markup).toContain('Turn it off when another channel is enough.');
    expect(markup).toContain('RuneLite sends a native notification.');
    expect(markup).toContain('data-default-value="On"');
    expect(markup).toContain('data-default-value="Off"');
    expect(markup).toContain('data-guide-setting-card="enabled"');
    expect(markup).toContain('data-guide-setting-card="optional"');
  });
});
