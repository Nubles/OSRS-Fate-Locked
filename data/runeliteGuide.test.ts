import { describe, expect, it } from 'vitest';
import {
  RUNELITE_GUIDE_CHAPTERS,
  RUNELITE_GUIDE_CHAPTER_IDS,
  RUNELITE_GUIDE_FIGURES,
  RUNELITE_GUIDE_ICON,
  RUNELITE_GUIDE_NAV_GROUPS,
  type GuideBlock,
} from './runeliteGuide';
import { WIKI_UI_ICONS } from './wikiUiIcons';

const blocks = (): GuideBlock[] => RUNELITE_GUIDE_CHAPTERS.flatMap(chapter => [...chapter.blocks]);

const figuresUsed = (): string[] => blocks().flatMap(block => {
  if (block.kind === 'figure') return [block.figureId];
  if (block.kind === 'gallery') return block.items.map(item => item.figureId);
  return [];
});

describe('RuneLite guide chapters', () => {
  it('keeps its chapters in reading order, numbered as they come', () => {
    expect(RUNELITE_GUIDE_CHAPTERS.map(chapter => chapter.id)).toEqual([...RUNELITE_GUIDE_CHAPTER_IDS]);
    RUNELITE_GUIDE_CHAPTERS.forEach((chapter, index) => expect(chapter.number, chapter.id).toBe(index + 1));
    for (const chapter of RUNELITE_GUIDE_CHAPTERS) {
      expect(chapter.title.trim().length, chapter.id).toBeGreaterThan(2);
      expect(chapter.lede.trim().length, chapter.id).toBeGreaterThan(20);
      expect(chapter.blocks.length, chapter.id).toBeGreaterThan(0);
    }
  });

  it('lists every chapter once in its contents, in reading order', () => {
    expect(RUNELITE_GUIDE_NAV_GROUPS.flatMap(group => group.chapterIds)).toEqual([...RUNELITE_GUIDE_CHAPTER_IDS]);
  });

  it('marks each chapter with OSRS art the site already uses', () => {
    const osrsArt = new Set<string>(Object.values(WIKI_UI_ICONS));
    for (const chapter of RUNELITE_GUIDE_CHAPTERS) {
      expect(osrsArt.has(chapter.icon) || chapter.icon === RUNELITE_GUIDE_ICON, chapter.icon).toBe(true);
    }
    expect(osrsArt.has(RUNELITE_GUIDE_ICON)).toBe(true);
  });

  it('shows the settings, setups, troubleshooting, links and glossary once each', () => {
    for (const kind of ['settings', 'presets', 'troubleshooting', 'resources', 'glossary'] as const) {
      expect(blocks().filter(block => block.kind === kind), kind).toHaveLength(1);
    }
  });

  it('says what players need to know about privacy, Strict Mode and their run', () => {
    const text = JSON.stringify(RUNELITE_GUIDE_CHAPTERS);
    for (const phrase of [
      'does not upload gameplay data',
      'IP address',
      'off by default',
      'fails open',
      '60 seconds',
      'Keys',
      'Omni-Keys',
      'Chaos Keys',
      'Fate Points',
      'Shortest Path',
      'on your computer',
    ]) {
      expect(text, phrase).toContain(phrase);
    }
  });
});

describe('RuneLite guide pictures', () => {
  it('shows every picture it has, and has every picture it shows', () => {
    const used = new Set(figuresUsed());
    const known = new Set(RUNELITE_GUIDE_FIGURES.map(figure => figure.id));
    expect([...used].filter(id => !known.has(id))).toEqual([]);
    expect([...known].filter(id => !used.has(id))).toEqual([]);
    expect(known.size).toBe(RUNELITE_GUIDE_FIGURES.length);
  });

  it('numbers each picture’s notes from 1, each outlining something inside the picture', () => {
    for (const figure of RUNELITE_GUIDE_FIGURES) {
      expect(figure.callouts.map(callout => callout.marker), figure.id)
        .toEqual(figure.callouts.map((_, index) => index + 1));
      expect(new Set(figure.callouts.map(callout => callout.id)).size, figure.id).toBe(figure.callouts.length);
      for (const { id, box, label, body } of figure.callouts) {
        const [x, y, width, height] = box;
        const where = `${figure.id}/${id}`;
        expect(x, where).toBeGreaterThanOrEqual(0);
        expect(y, where).toBeGreaterThanOrEqual(0);
        expect(width, where).toBeGreaterThan(0);
        expect(height, where).toBeGreaterThan(0);
        expect(x + width, where).toBeLessThanOrEqual(1.001);
        expect(y + height, where).toBeLessThanOrEqual(1.001);
        expect(label.trim().length, where).toBeGreaterThan(2);
        expect(body.trim().length, where).toBeGreaterThan(10);
      }
    }
  });

  it('outlines whole rows of the plugin’s cards, so no note’s line crosses the card', () => {
    for (const figure of RUNELITE_GUIDE_FIGURES.filter(item => item.source === 'rendered')) {
      for (const { id, box } of figure.callouts) {
        expect(box[0] + box[2], `${figure.id}/${id} reaches the card’s right side`).toBeGreaterThan(0.92);
      }
    }
  });

  it('draws the plugin’s pictures at twice the detail, and says what each shows', () => {
    for (const figure of RUNELITE_GUIDE_FIGURES) {
      expect(figure.scale, figure.id).toBe(2);
      expect(figure.src, figure.id).toBe(`/guides/runelite/${figure.id}.png`);
      expect(figure.alt.trim().length, figure.id).toBeGreaterThan(20);
      expect(figure.title.trim().length, figure.id).toBeGreaterThan(2);
    }
  });
});
