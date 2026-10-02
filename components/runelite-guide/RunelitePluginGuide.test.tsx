import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  RUNELITE_GUIDE_CHAPTERS,
  RUNELITE_GUIDE_FIGURES,
  RUNELITE_GUIDE_GLOSSARY,
  RUNELITE_GUIDE_NAV_GROUPS,
  RUNELITE_GUIDE_PRESETS,
  RUNELITE_GUIDE_RESOURCES,
  RUNELITE_GUIDE_SETTINGS,
  RUNELITE_GUIDE_TROUBLESHOOTING,
} from '../../data/runeliteGuide';
import { RUNELITE_SETTING_SECTIONS } from '../../data/runeliteWording';
import { resolveGuideImageSrc } from './GuideFigure';
import { RunelitePluginGuide } from './RunelitePluginGuide';

const render = () => renderToStaticMarkup(<RunelitePluginGuide onClose={() => undefined} />);
const count = (html: string, attribute: string) => html.split(attribute).length - 1;
const decode = (html: string) => html
  .replaceAll('&lt;', '<')
  .replaceAll('&gt;', '>')
  .replaceAll('&quot;', '"')
  .replaceAll('&#x27;', "'")
  .replaceAll('&amp;', '&');

const blocks = RUNELITE_GUIDE_CHAPTERS.flatMap(chapter => [...chapter.blocks]);

describe('RunelitePluginGuide', () => {
  it('is one labelled dialog', () => {
    const html = render();
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="runelite-guide-title"');
    expect(html).toContain('aria-describedby="runelite-guide-summary"');
    expect(html).toContain('id="runelite-guide-title"');
    expect(html).toContain('RuneLite Plugin Guide');
    expect(count(html, 'aria-label="Close RuneLite Plugin Guide"')).toBe(1);
    expect(html).toContain('Back to the tracker');
  });

  it('has every chapter, in order, in its contents and on the page', () => {
    const html = decode(render());
    expect(count(html, 'data-guide-chapter="')).toBe(RUNELITE_GUIDE_CHAPTERS.length);
    expect(count(html, 'data-guide-nav-group="')).toBe(RUNELITE_GUIDE_NAV_GROUPS.length);
    let from = 0;
    for (const chapter of RUNELITE_GUIDE_CHAPTERS) {
      const at = html.indexOf(`id="runelite-guide-${chapter.id}"`, from);
      expect(at, chapter.id).toBeGreaterThan(-1);
      from = at;
      expect(html).toContain(`href="#runelite-guide-${chapter.id}"`);
      expect(html).toMatch(new RegExp(`<option value="${chapter.id}"( selected="")?>${chapter.number}\\. `));
      expect(html).toContain(`${chapter.number}. ${chapter.title}</option>`);
      expect(html).toContain(chapter.lede);
    }
  });

  it('shows every picture, each with its notes', () => {
    const html = decode(render());
    const figureBlocks = blocks.flatMap(block => (block.kind === 'figure' ? [block] : []));
    const galleryItems = blocks.flatMap(block => (block.kind === 'gallery' ? block.items : []));
    expect(count(html, 'data-guide-figure="')).toBe(figureBlocks.length);
    expect(count(html, 'data-guide-gallery-item="')).toBe(galleryItems.length);
    const notes = figureBlocks.reduce((total, block) => total
      + (RUNELITE_GUIDE_FIGURES.find(figure => figure.id === block.figureId)?.callouts.length ?? 0), 0);
    expect(count(html, 'data-guide-callout="')).toBe(notes);
    for (const figure of RUNELITE_GUIDE_FIGURES) {
      expect(html, figure.id).toContain(`src="${resolveGuideImageSrc(figure.src)}"`);
      expect(html, figure.id).toContain(`alt="${figure.alt}"`);
    }
  });

  it('lists every setting, setup, problem, link and word', () => {
    const html = decode(render());
    expect(count(html, 'data-guide-settings-section="')).toBe(RUNELITE_SETTING_SECTIONS.length);
    expect(count(html, 'data-guide-setting="')).toBe(RUNELITE_GUIDE_SETTINGS.length);
    expect(count(html, 'data-guide-preset="')).toBe(RUNELITE_GUIDE_PRESETS.length);
    expect(count(html, 'data-guide-troubleshooting="')).toBe(RUNELITE_GUIDE_TROUBLESHOOTING.length);
    expect(count(html, 'data-guide-glossary-row="')).toBe(RUNELITE_GUIDE_GLOSSARY.length);
    expect(count(html, 'data-guide-resource="')).toBe(RUNELITE_GUIDE_RESOURCES.length);
    for (const resource of RUNELITE_GUIDE_RESOURCES) {
      expect(html).toContain(`href="${resource.href}" target="_blank" rel="noopener noreferrer"`);
    }
    for (const setting of RUNELITE_GUIDE_SETTINGS) expect(html).toContain(setting.label);
  });

  it('keeps nothing fixed to the bottom of the screen, and draws its icons from OSRS art', () => {
    const html = render();
    expect(html).not.toContain('data-runelite-guide-footer');
    const wikiImages = html.match(/src="https:\/\/oldschool\.runescape\.wiki\/images\/[^"]+"/g) ?? [];
    expect(wikiImages.length).toBeGreaterThan(RUNELITE_GUIDE_CHAPTERS.length * 2);
  });
});
