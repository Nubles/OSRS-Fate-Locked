// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import type { GuideScreenshot as GuideScreenshotData } from '../../data/runeliteGuide';
import { GuideScreenshot } from './GuideScreenshot';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const screenshot: GuideScreenshotData = {
  id: 'demo',
  src: '/guides/runelite/demo.png',
  title: 'Demo connection',
  alt: 'Demo RuneLite panel.',
  callouts: [
    {
      id: 'connect',
      marker: 1,
      x: 0.25,
      y: 0.4,
      label: 'Connect tracker',
      body: 'Open the private confirmation page.',
    },
    {
      id: 'state',
      marker: 2,
      x: 0.7,
      y: 0.6,
      label: 'Connection state',
      body: 'Wait for Connected before relying on rules.',
    },
  ],
};

const mountedRoots: Array<{ host: HTMLDivElement; root: Root }> = [];

const mount = async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  mountedRoots.push({ host, root });
  await act(async () => {
    root.render(<GuideScreenshot screenshot={screenshot} />);
  });
  return host;
};

afterEach(async () => {
  for (const { host, root } of mountedRoots.splice(0).reverse()) {
    await act(async () => {
      root.unmount();
    });
    host.remove();
  }
});

describe('GuideScreenshot', () => {
  it('renders an authentic image with responsive markers and accessible callouts', async () => {
    const host = await mount();
    const markers = host.querySelectorAll<HTMLElement>('[data-guide-marker]');
    const imageStage = host.querySelector<HTMLElement>('[data-guide-image-stage]');
    const markerLayer = host.querySelector<HTMLElement>('[data-guide-marker-layer]');
    const original = host.querySelector<HTMLAnchorElement>('a');

    expect(host.querySelector('img')?.getAttribute('src')).toBe('/guides/runelite/demo.png');
    expect(imageStage).toBeTruthy();
    expect(imageStage?.contains(host.querySelector('img'))).toBe(true);
    expect(markerLayer?.parentElement).toBe(imageStage);
    expect(markerLayer?.className).toContain('inset-0');
    expect(markers).toHaveLength(2);
    expect(markers[0]?.style.left).toBe('25%');
    expect(markers[0]?.style.top).toBe('40%');
    expect(host.textContent).toContain('1. Connect tracker');
    expect(host.textContent).toContain('2. Connection state');
    expect(original?.target).toBe('_blank');
    expect(original?.rel.split(/\s+/).sort()).toEqual(['noopener', 'noreferrer']);
  });

  it('keeps the title and callouts when the source image is unavailable', async () => {
    const host = await mount();
    const image = host.querySelector<HTMLImageElement>('img');
    if (!image) throw new Error('Missing guide image');

    await act(async () => {
      image.dispatchEvent(new Event('error'));
    });

    expect(host.querySelector('img')).toBeNull();
    expect(host.textContent).toContain('Demo connection');
    expect(host.textContent).toContain('Image unavailable');
    expect(host.textContent).toContain('1. Connect tracker');
    expect(host.querySelectorAll('[data-guide-marker]')).toHaveLength(0);
  });
});
