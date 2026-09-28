// @vitest-environment jsdom
import React, { act, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RunelitePluginGuide } from './RunelitePluginGuide';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mountedRoots: Array<{ host: HTMLDivElement; root: Root }> = [];

const GuideHarness = () => {
  const [open, setOpen] = useState(false);
  const openerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button ref={openerRef} type="button" data-testid="guide-opener" onClick={() => setOpen(true)}>
        RuneLite guide
      </button>
      {open && <RunelitePluginGuide onClose={() => setOpen(false)} returnFocusTarget={openerRef.current} />}
    </>
  );
};

const mount = async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  mountedRoots.push({ host, root });
  await act(async () => {
    root.render(<GuideHarness />);
  });
  return host;
};

const openGuide = async (host: HTMLDivElement) => {
  const opener = host.querySelector<HTMLButtonElement>('[data-testid="guide-opener"]');
  if (!opener) throw new Error('Missing guide opener');
  opener.focus();
  await act(async () => {
    opener.click();
  });
  return opener;
};

const unmount = async (host: HTMLDivElement) => {
  const index = mountedRoots.findIndex(entry => entry.host === host);
  if (index < 0) return;
  const [{ root }] = mountedRoots.splice(index, 1);
  await act(async () => {
    root.unmount();
  });
  host.remove();
};

const runOpenGuideLifecycle = async (callback: (host: HTMLDivElement) => Promise<void>) => {
  const host = await mount();
  await openGuide(host);
  try {
    await callback(host);
  } finally {
    await unmount(host);
  }
};

const reducedMotion = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
};

const spyOnScroll = () => {
  const scrollIntoView = vi.fn();
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView });
  return scrollIntoView;
};

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const { host, root } of mountedRoots.splice(0).reverse()) {
    await act(async () => {
      root.unmount();
    });
    host.remove();
  }
});

describe('RunelitePluginGuide navigation and focus', () => {
  it('jumps to a chapter from its contents, without motion when asked, and marks where you are', async () => {
    reducedMotion(true);
    const scrollIntoView = spyOnScroll();
    const host = await mount();
    const opener = await openGuide(host);

    const strictMode = host.querySelector<HTMLAnchorElement>('a[href="#runelite-guide-strict-mode"]');
    if (!strictMode) throw new Error('Missing guide contents');
    await act(async () => {
      strictMode.click();
    });

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
    expect(strictMode.getAttribute('aria-current')).toBe('location');
    expect(strictMode.className).toContain('border-amber-400');
    expect(host.querySelector('a[href="#runelite-guide-start"]')?.getAttribute('aria-current')).toBeNull();
    expect(host.querySelector<HTMLSelectElement>('[data-runelite-guide-nav="mobile"]')?.value).toBe('strict-mode');

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('jumps from the phone’s chapter menu and the introduction’s links, smoothly', async () => {
    reducedMotion(false);
    const scrollIntoView = spyOnScroll();
    const host = await mount();
    await openGuide(host);

    const menu = host.querySelector<HTMLSelectElement>('[data-runelite-guide-nav="mobile"]');
    if (!menu) throw new Error('Missing the chapter menu');
    await act(async () => {
      menu.value = 'here';
      menu.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'smooth', block: 'start' });
    expect(host.querySelector('a[href="#runelite-guide-here"]')?.getAttribute('aria-current')).toBe('location');

    const settings = host.querySelector<HTMLButtonElement>('[data-guide-quick-link="settings"]');
    if (!settings) throw new Error('Missing the introduction’s links');
    await act(async () => {
      settings.click();
    });
    expect(host.querySelector('a[href="#runelite-guide-settings"]')?.getAttribute('aria-current')).toBe('location');
    expect(menu.value).toBe('settings');
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });

  it('marks the chapter being read as the page scrolls', async () => {
    let report: IntersectionObserverCallback = () => undefined;
    const observed: Element[] = [];
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) {
        report = callback;
      }
      observe(node: Element) {
        observed.push(node);
      }
      disconnect() {}
    });
    const host = await mount();
    await openGuide(host);
    const cross = (entries: ReadonlyArray<readonly [string, boolean]>) => act(async () => {
      report(entries.map(([id, isIntersecting]) => ({
        target: host.querySelector(`#runelite-guide-${id}`),
        isIntersecting,
      })) as unknown as IntersectionObserverEntry[], {} as IntersectionObserver);
    });
    const reading = () => host.querySelector('a[aria-current="location"]')?.getAttribute('href');

    expect(observed.map(node => node.id)).toEqual(
      Array.from(host.querySelectorAll('[data-guide-chapter]')).map(node => node.id),
    );
    await cross([['status', true], ['sidebar', true]]);
    expect(reading()).toBe('#runelite-guide-sidebar');
    await cross([['here', true]]);
    expect(reading()).toBe('#runelite-guide-sidebar');
    await cross([['sidebar', false]]);
    expect(reading()).toBe('#runelite-guide-status');
    await cross([['status', false], ['here', false]]);
    expect(reading()).toBe('#runelite-guide-status');
  });

  it('closes from the end of the guide, back to where it was opened', async () => {
    spyOnScroll();
    const host = await mount();
    const opener = await openGuide(host);
    const back = Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
      .find(button => button.textContent === 'Back to the companion');
    if (!back) throw new Error('Missing the closing button');

    await act(async () => {
      back.click();
    });

    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('restores document overflow when an open guide lifecycle exits early', async () => {
    const previousRootOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'scroll';
    const sentinel = new Error('forced lifecycle failure');

    try {
      await expect(runOpenGuideLifecycle(async () => {
        expect(document.documentElement.style.overflow).toBe('hidden');
        expect(document.body.style.overflow).toBe('hidden');
        throw sentinel;
      })).rejects.toBe(sentinel);
      expect(document.documentElement.style.overflow).toBe('auto');
      expect(document.body.style.overflow).toBe('scroll');
    } finally {
      for (const { host } of [...mountedRoots].reverse()) {
        await unmount(host);
      }
      document.documentElement.style.overflow = previousRootOverflow;
      document.body.style.overflow = previousBodyOverflow;
    }
  });
});
