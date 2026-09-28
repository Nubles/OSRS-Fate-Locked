// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import type { GuideCallout, GuideFigure as GuideFigureData } from '../../data/runeliteGuide';
import {
  GUIDE_FIGURE_SOURCES,
  GUIDE_MARKER_GUTTER,
  GuideFigure,
  GuideGalleryPicture,
  guideDisplaySize,
  placeMarkers,
  resolveGuideImageSrc,
} from './GuideFigure';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const demo: GuideFigureData = {
  id: 'demo',
  src: '/guides/runelite/demo.png',
  source: 'rendered',
  title: 'Demo card',
  alt: 'A demo card with two rows worth pointing at.',
  width: 400,
  height: 300,
  scale: 2,
  callouts: [
    { id: 'first', marker: 1, box: [0.05, 0.1, 0.9, 0.1], label: 'First row', body: 'The first thing to read.' },
    { id: 'second', marker: 2, box: [0.05, 0.14, 0.9, 0.1], label: 'Second row', body: 'Right below the first one.' },
  ],
};

const row = (id: string, y: number): GuideCallout =>
  ({ id, marker: 1, box: [0.1, y, 0.8, 0.02], label: 'Row', body: 'A row of the card.' });

const mounted: Array<{ host: HTMLDivElement; root: Root }> = [];
const mount = async (node: React.ReactNode) => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  mounted.push({ host, root });
  await act(async () => {
    root.render(node);
  });
  return host;
};

afterEach(async () => {
  for (const { host, root } of mounted.splice(0)) {
    await act(async () => {
      root.unmount();
    });
    host.remove();
  }
});

describe('placeMarkers', () => {
  it('puts each marker level with what it names, when there is room', () => {
    const [only] = placeMarkers([demo.callouts[0]], 400, 300);
    expect(only.markerY).toBeCloseTo(45);
    expect([only.x, only.y, only.width, only.height]).toEqual([20, 30, 360, 30]);
  });

  it('never lets two markers overlap, nor one leave the picture', () => {
    const crowded = Array.from({ length: 6 }, (_, index) => row(`row-${index}`, 0.9 + index * 0.01));
    const placed = placeMarkers(crowded, 200, 300);
    for (let i = 1; i < placed.length; i++) {
      expect(placed[i].markerY - placed[i - 1].markerY).toBeGreaterThanOrEqual(24);
    }
    expect(placed[placed.length - 1].markerY).toBe(288);
    expect(placeMarkers([row('top', 0)], 200, 300)[0].markerY).toBe(12);
  });

  it('keeps the markers in the order of what they name, top to bottom', () => {
    const placed = placeMarkers([row('lower', 0.8), row('upper', 0.1)], 200, 300);
    expect(placed.map(marker => marker.callout.id)).toEqual(['upper', 'lower']);
    expect(placed[0].markerY).toBeCloseTo(33);
  });
});

describe('guideDisplaySize', () => {
  it('shows the plugin’s pictures at the size they were drawn, and a capture at its size on screen', () => {
    expect(guideDisplaySize(demo)).toEqual({ width: 400, height: 300 });
    expect(guideDisplaySize({ ...demo, source: 'web-capture' })).toEqual({ width: 200, height: 150 });
  });
});

describe('GuideFigure', () => {
  it('outlines each named part, puts its marker beside the picture, and lists its notes', async () => {
    const host = await mount(<GuideFigure figure={demo} />);

    const image = host.querySelector('img');
    expect(image?.getAttribute('src')).toBe(resolveGuideImageSrc(demo.src));
    expect(image?.getAttribute('alt')).toBe(demo.alt);
    const overlay = host.querySelector('[data-guide-figure-overlay]');
    expect(overlay?.getAttribute('viewBox')).toBe(`0 0 ${400 + GUIDE_MARKER_GUTTER} 300`);
    expect(overlay?.querySelectorAll('rect')).toHaveLength(2);
    expect(host.querySelectorAll('[data-guide-marker-badge]')).toHaveLength(2);
    const notes = host.querySelectorAll<HTMLLIElement>('[data-guide-callout]');
    expect(Array.from(notes).map(note => note.textContent)).toEqual([
      '1First rowThe first thing to read.',
      '2Second rowRight below the first one.',
    ]);
    expect(host.querySelector('[data-guide-figure-source]')?.textContent).toContain(GUIDE_FIGURE_SOURCES.rendered);
    const badges = Array.from(host.querySelectorAll<HTMLElement>('[data-guide-marker-badge]'));
    const tops = badges.map(badge => parseFloat(badge.style.top));
    expect(tops[0]).toBeCloseTo(15);
    expect(tops[1] - tops[0]).toBeCloseTo((24 / 300) * 100);
  });

  it('lights up a part while its note is pointed at, and dims the rest', async () => {
    const host = await mount(<GuideFigure figure={demo} />);
    const second = host.querySelectorAll<HTMLLIElement>('[data-guide-callout]')[1];

    await act(async () => {
      second.focus();
    });

    const groups = host.querySelectorAll<SVGGElement>('[data-guide-marker]');
    expect(groups[0].getAttribute('opacity')).toBe('0.35');
    expect(groups[1].getAttribute('opacity')).toBe('1');
    expect(groups[1].querySelector('rect')?.getAttribute('stroke-width')).toBe('2.5');

    await act(async () => {
      second.blur();
    });
    expect(host.querySelector('[data-guide-marker]')?.getAttribute('opacity')).toBe('1');
  });

  it('keeps its notes when the picture can’t load', async () => {
    const host = await mount(<GuideFigure figure={demo} />);
    const image = host.querySelector('img');

    await act(async () => {
      image?.dispatchEvent(new Event('error'));
    });

    expect(host.querySelector('img')).toBeNull();
    expect(host.querySelector('[data-guide-figure-overlay]')).toBeNull();
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Picture unavailable');
    expect(host.querySelectorAll('[data-guide-callout]')).toHaveLength(2);
  });
});

describe('GuideGalleryPicture', () => {
  it('shows a picture of a set at the size it has in RuneLite, and says so when it can’t load', async () => {
    const host = await mount(<GuideGalleryPicture figure={demo} title="Before" body="Connect tracker starts." />);
    const image = host.querySelector('img');
    expect(image?.style.width).toBe('200px');
    expect(host.textContent).toContain('Before');
    expect(host.textContent).toContain('Connect tracker starts.');

    await act(async () => {
      image?.dispatchEvent(new Event('error'));
    });

    expect(host.querySelector('img')).toBeNull();
    expect(host.querySelector('[role="status"]')?.textContent).toBe('Picture unavailable');
  });
});

describe('resolveGuideImageSrc', () => {
  it('serves a picture from the site’s own path', () => {
    expect(resolveGuideImageSrc('/guides/runelite/here.png', '/OSRS-Fate-Locked/'))
      .toBe('/OSRS-Fate-Locked/guides/runelite/here.png');
    expect(resolveGuideImageSrc('/guides/runelite/here.png', '/OSRS-Fate-Locked'))
      .toBe('/OSRS-Fate-Locked/guides/runelite/here.png');
    expect(resolveGuideImageSrc('guides/runelite/here.png', '/')).toBe('/guides/runelite/here.png');
  });
});
