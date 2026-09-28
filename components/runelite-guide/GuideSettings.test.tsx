import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RUNELITE_SETTING_SECTIONS } from '../../data/runeliteWording';
import { RUNELITE_GUIDE_SETTINGS } from '../../data/runeliteGuide';
import { GuideSettings, describeColour } from './GuideSettings';

describe('describeColour', () => {
  it('reads RuneLite’s #aarrggbb as a colour and how see-through it is', () => {
    expect(describeColour('#6e10b981')).toEqual({ css: 'rgba(16, 185, 129, 0.43)', label: '#10b981 · 43%' });
    expect(describeColour('#FF10B981')).toEqual({ css: 'rgba(16, 185, 129, 1)', label: '#10b981 · 100%' });
    expect(describeColour('On')).toBeNull();
    expect(describeColour('#10b981')).toBeNull();
  });
});

describe('GuideSettings', () => {
  it('lists every setting under its section, in RuneLite’s order', () => {
    const html = renderToStaticMarkup(<GuideSettings />);
    const sections = [...html.matchAll(/data-guide-settings-section="([^"]+)"/g)].map(match => match[1]);
    expect(sections).toEqual([...RUNELITE_SETTING_SECTIONS]);
    const rows = [...html.matchAll(/data-guide-setting="([^"]+)"/g)].map(match => match[1]);
    expect(rows).toEqual(RUNELITE_SETTING_SECTIONS.flatMap(section =>
      RUNELITE_GUIDE_SETTINGS.filter(setting => setting.section === section).map(setting => setting.key)));
  });

  it('gives each setting its default, its choices, and what to expect', () => {
    const html = renderToStaticMarkup(<GuideSettings />)
      .replaceAll('&quot;', '"')
      .replaceAll('&#x27;', "'")
      .replaceAll('&amp;', '&');
    for (const setting of RUNELITE_GUIDE_SETTINGS) {
      expect(html, setting.key).toContain(`data-default-value="${setting.defaultValue}"`);
      expect(html, setting.key).toContain(setting.purpose);
      expect(html, setting.key).toContain(setting.visibleResult);
      expect(html, setting.key).toContain(setting.changeWhen);
      if (setting.options) expect(html, setting.key).toContain(setting.options.join(' · '));
    }
    expect(html).toContain('background-color:rgba(16, 185, 129, 0.43)');
    expect(html).toContain('#10b981 · 43%</span>');
  });
});
