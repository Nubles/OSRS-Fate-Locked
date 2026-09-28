import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { GuideSetting } from '../../data/runeliteGuide';
import { GuideSettingsTable } from './GuideSettingsTable';

const settings: readonly GuideSetting[] = [
  {
    key: 'enabled',
    section: 'Alerts',
    label: 'Enabled warning',
    defaultValue: 'On',
    purpose: 'Explains a locked action.',
    visibleResult: 'A visible warning appears.',
    changeWhen: 'Turn it off when another channel is enough.',
  },
  {
    key: 'optional',
    section: 'Alerts',
    label: 'Optional warning',
    defaultValue: 'Off',
    purpose: 'Adds an extra notification.',
    visibleResult: 'RuneLite sends a native notification.',
    changeWhen: 'Turn it on when RuneLite is not focused.',
  },
];

const shownDifferently: readonly GuideSetting[] = [
  {
    key: 'choice',
    section: 'Display',
    label: 'A choice',
    defaultValue: 'Compact',
    options: ['Off', 'Compact', 'Detailed'],
    purpose: 'Picks how much to show.',
    visibleResult: 'More or less of it.',
    changeWhen: 'When you want more.',
  },
  {
    key: 'colour',
    section: 'Custom colours',
    label: 'A colour',
    defaultValue: '#6e10b981',
    purpose: 'Colours unlocked land.',
    visibleResult: 'Unlocked land in that colour.',
    changeWhen: 'When it is hard to see.',
  },
];

describe('GuideSettingsTable', () => {
  it('lists the options of a choice, and shows a colour as its swatch and opacity', () => {
    const markup = renderToStaticMarkup(<GuideSettingsTable settings={shownDifferently} />);

    expect(markup).toContain('data-guide-setting-options="true">Off · Compact · Detailed</p>');
    expect(markup).toContain('data-default-value="Compact"');
    expect(markup).toContain('data-default-value="#6e10b981"');
    expect(markup).toContain('background-color:rgba(16, 185, 129, 0.43)');
    expect(markup.replace(/<!-- -->/g, '')).toContain('#10b981 · 43%');
    expect(markup.match(/data-guide-setting-options/g)).toHaveLength(1);
  });

  it('renders every setting as a compact native row with labeled fields', () => {
    const markup = renderToStaticMarkup(<GuideSettingsTable settings={settings} />);

    expect(markup).toContain('data-guide-settings-list="true"');
    expect(markup.match(/data-guide-setting-card=/g)).toHaveLength(settings.length);
    expect(markup.match(/data-guide-setting-fields=/g)).toHaveLength(settings.length);
    expect(markup).not.toContain('<table');
    expect(markup).not.toContain('rounded-2xl');
    expect(markup).not.toContain('rounded-full');
    expect(markup).toContain('What it does');
    expect(markup).toContain('What you see');
    expect(markup).toContain('Change it when');
    expect(markup).toContain('Enabled warning');
    expect(markup).toContain('Optional warning');
    expect(markup).toContain('Explains a locked action.');
    expect(markup).toContain('A visible warning appears.');
    expect(markup).toContain('Turn it off when another channel is enough.');
    expect(markup).toContain('Adds an extra notification.');
    expect(markup).toContain('RuneLite sends a native notification.');
    expect(markup).toContain('Turn it on when RuneLite is not focused.');
    expect(markup).toContain('data-default-value="On"');
    expect(markup).toContain('data-default-value="Off"');
    expect(markup).toContain('data-guide-setting-card="enabled"');
    expect(markup).toContain('data-guide-setting-card="optional"');
    const fieldLabels = markup.match(/<dt class="[^"]*">/g) ?? [];
    expect(fieldLabels).toHaveLength(6);
    for (const label of fieldLabels) {
      expect(label).toContain('text-gray-400');
      expect(label).not.toContain('text-gray-500');
    }
  });
});
