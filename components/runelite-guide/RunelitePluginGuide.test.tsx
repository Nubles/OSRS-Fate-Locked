import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  RUNELITE_GUIDE_CHAPTERS,
  RUNELITE_GUIDE_PRESETS,
  RUNELITE_GUIDE_RESOURCES,
  RUNELITE_GUIDE_SCREENSHOTS,
  RUNELITE_GUIDE_SETTINGS,
  RUNELITE_PANEL_SECTIONS,
} from '../../data/runeliteGuide';
import { RunelitePluginGuide } from './RunelitePluginGuide';

describe('RunelitePluginGuide', () => {
  it('renders the complete, authentic player handbook', () => {
    const html = renderToStaticMarkup(
      <RunelitePluginGuide onClose={() => undefined} />,
    );
    const decodedHtml = html
      .replaceAll('&amp;', '&')
      .replaceAll('&quot;', '"')
      .replaceAll('&#x27;', "'");

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="runelite-guide-title"');
    expect(html).toContain('Five-minute setup');
    expect(html).toContain('Jump to Install');
    expect(html).toContain('Jump to Connect');
    expect(html).toContain('Vanilla');
    expect(html).toContain('Chunked mode is not finished');

    for (const chapter of RUNELITE_GUIDE_CHAPTERS) {
      expect(html).toContain(`id="runelite-guide-${chapter.id}"`);
      expect(decodedHtml).toContain(chapter.title);
    }

    expect(html.match(/data-guide-chapter-panel=/g)).toHaveLength(
      RUNELITE_GUIDE_CHAPTERS.length,
    );
    expect(html.match(/data-guide-chapter-header=/g)).toHaveLength(
      RUNELITE_GUIDE_CHAPTERS.length,
    );
    expect(html.match(/data-guide-panel-section=/g)).toHaveLength(
      RUNELITE_PANEL_SECTIONS.length,
    );
    expect(html.match(/data-guide-preset=/g)).toHaveLength(
      RUNELITE_GUIDE_PRESETS.length,
    );
    expect(html.match(/data-guide-resource=/g)).toHaveLength(
      RUNELITE_GUIDE_RESOURCES.length,
    );
    expect(html).toContain('data-guide-troubleshooting=');
    expect(html).toContain('data-guide-glossary-row=');
    const officialSupportPanel = html.match(
      /<section(?=[^>]*aria-labelledby="runelite-guide-support-links")(?=[^>]*class="([^"]*)")[^>]*>/,
    );
    expect(officialSupportPanel?.[1]).toContain('rounded-lg');
    expect(officialSupportPanel?.[1]).not.toContain('rounded-xl');

    const officialSupportHeading = html.match(
      /<h3(?=[^>]*id="runelite-guide-support-links")(?=[^>]*class="([^"]*)")[^>]*>/,
    );
    expect(officialSupportHeading?.[1]).toContain('text-lg');
    expect(officialSupportHeading?.[1]).not.toContain('font-serif');


    for (const section of RUNELITE_PANEL_SECTIONS) {
      expect(decodedHtml).toContain(section);
    }

    for (const setting of RUNELITE_GUIDE_SETTINGS) {
      expect(decodedHtml).toContain(setting.label);
    }

    for (const screenshot of RUNELITE_GUIDE_SCREENSHOTS) {
      expect(html).toContain(screenshot.src);
    }

    for (const preset of RUNELITE_GUIDE_PRESETS) {
      expect(decodedHtml).toContain(preset.title);
    }

    for (const resource of RUNELITE_GUIDE_RESOURCES) {
      expect(html).toContain(`href="${resource.href}"`);
    }
    expect(html.match(/rel="noopener noreferrer"/g)?.length).toBeGreaterThanOrEqual(
      RUNELITE_GUIDE_RESOURCES.length,
    );

    expect(html).toContain('Troubleshooting');
    expect(html).toContain('Glossary');
    expect(
      html.match(/aria-label="Close RuneLite Plugin Guide"/g),
    ).toHaveLength(2);
  });
});
