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
    const opener = host.querySelector<HTMLButtonElement>('[data-testid="guide-opener"]');
    if (!opener) throw new Error('Missing guide opener');

    opener.focus();
    await act(async () => {
      opener.click();
    });

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

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});
