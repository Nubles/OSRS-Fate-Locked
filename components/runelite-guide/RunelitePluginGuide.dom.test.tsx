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
      <button
        ref={openerRef}
        type="button"
        data-testid="guide-opener"
        onClick={() => setOpen(true)}
      >
        RuneLite guide
      </button>
      {open && (
        <RunelitePluginGuide
          onClose={() => setOpen(false)}
          returnFocusTarget={openerRef.current}
        />
      )}
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

const runOpenGuideLifecycle = async (
  callback: (host: HTMLDivElement) => Promise<void>,
) => {
  const host = await mount();
  await openGuide(host);
  try {
    await callback(host);
  } finally {
    await unmount(host);
  }
};

afterEach(async () => {
  vi.restoreAllMocks();
  for (const { host, root } of mountedRoots.splice(0).reverse()) {
    await act(async () => {
      root.unmount();
    });
    host.remove();
  }
});

describe('RunelitePluginGuide navigation and focus', () => {
  it('navigates with reduced motion, closes on Escape, and restores focus', async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });

    const host = await mount();
    const opener = await openGuide(host);


    const guardianLink = host.querySelector<HTMLAnchorElement>(
      'a[href="#runelite-guide-guardian"]',
    );
    if (!guardianLink) throw new Error('Missing guide navigation');

    await act(async () => {
      guardianLink.click();
    });

    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: 'auto',
      block: 'start',
    });
    expect(guardianLink.getAttribute('aria-current')).toBe('location');
    expect(guardianLink.className).toContain('border-amber-400/40');
    expect(guardianLink.className).toContain('bg-amber-400/10');

    const inactiveLink = host.querySelector<HTMLAnchorElement>(
      'a[href="#runelite-guide-what-it-does"]',
    );
    expect(inactiveLink?.className).toContain('border-transparent');

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('renders the bounded Fate Locked shell with grouped contents and fixed regions', async () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    const host = await mount();
    await openGuide(host);

    const backdrop = host.querySelector<HTMLElement>('[data-runelite-guide-backdrop]');
    const shell = host.querySelector<HTMLElement>('[data-runelite-guide-shell]');
    const header = host.querySelector<HTMLElement>('[data-runelite-guide-header]');
    const body = host.querySelector<HTMLElement>('[data-runelite-guide-body]');
    const scrollRegion = host.querySelector<HTMLElement>('[data-runelite-guide-scroll-region]');
    const footer = host.querySelector<HTMLElement>('[data-runelite-guide-footer]');
    const desktopNav = host.querySelector<HTMLElement>(
      '[data-runelite-guide-nav="desktop"]',
    );
    const groupLabels = new Set(
      Array.from(host.querySelectorAll<HTMLElement>('[data-guide-nav-group]'))
        .map(node => node.dataset.guideNavGroup),
    );

    expect(shell).toBeTruthy();
    expect(backdrop?.className).toContain('bg-black/85');
    expect(shell?.className).toContain('max-w-[96rem]');
    expect(shell?.className).toContain('max-h-[92vh]');
    expect(shell?.className).toContain('bg-[#171717]');
    expect(shell?.className).toContain('border-amber-400/30');
    expect(header?.parentElement).toBe(shell);
    expect(body?.parentElement).toBe(shell);
    expect(footer?.parentElement).toBe(shell);
    expect(scrollRegion?.className).toContain('overflow-y-auto');
    expect(desktopNav).toBeTruthy();
    expect(groupLabels).toEqual(new Set([
      'Getting started',
      'Panel sections',
      'Configuration',
      'Help',
    ]));
    expect(host.querySelector('[data-guide-overview]')).toBeTruthy();
    expect(host.querySelector('[data-guide-quick-start]')).toBeTruthy();
    const quickStart = host.querySelector<HTMLElement>('[data-guide-quick-start]');
    const informativeLabels = [
      ...Array.from(
        host.querySelectorAll<HTMLElement>(
          '[data-runelite-guide-nav] > p, [data-guide-nav-group] > h2, [data-runelite-guide-nav] a > span:first-child',
        ),
      ),
      host.querySelector<HTMLElement>('[data-runelite-guide-footer] p:last-child'),
    ].filter((node): node is HTMLElement => Boolean(node));
    expect(informativeLabels.length).toBeGreaterThan(0);
    for (const label of informativeLabels) {
      expect(label.className).toContain('text-gray-400');
      expect(label.className).not.toMatch(/\btext-gray-(500|600)\b/);
    }
    const quickStartHeading = host.querySelector<HTMLElement>('#runelite-guide-quick-start');
    const quickStartIcon = quickStart?.querySelector<HTMLElement>('div > span');
    const quickStartActions = Array.from(quickStart?.querySelectorAll<HTMLButtonElement>('button') ?? []);
    if (!quickStartHeading || !quickStartIcon || quickStartActions.length !== 5) {
      throw new Error('Missing quick-start presentation elements');
    }
    expect(quickStartHeading.className).toContain('font-sans');
    expect(quickStartHeading.className).not.toContain('font-serif');
    expect(quickStartIcon.className).toContain('rounded-lg');
    expect(quickStartIcon.className).not.toContain('rounded-xl');
    for (const action of quickStartActions) {
      expect(action.className).toContain('rounded-lg');
      expect(action.className).toContain('bg-[#252525]');
      expect(action.className).not.toContain('bg-black/20');
    }

    const mobileContents = host.querySelector<HTMLDetailsElement>(
      '[data-runelite-guide-mobile-contents]',
    );
    const mobileGuardian = host.querySelector<HTMLAnchorElement>(
      '[data-runelite-guide-nav="mobile"] a[href="#runelite-guide-guardian"]',
    );
    if (!mobileContents || !mobileGuardian) {
      throw new Error('Missing mobile guide contents');
    }
    await act(async () => {
      mobileContents.open = true;
      mobileGuardian.click();
    });
    expect(mobileContents.open).toBe(false);
    expect(scrollIntoView).toHaveBeenCalled();
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
