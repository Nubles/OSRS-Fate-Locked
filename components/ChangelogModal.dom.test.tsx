// @vitest-environment jsdom
import React, { act, useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import type { ChangelogRelease } from '../data/changelog';
import { ChangelogModal } from './ChangelogModal';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const releases: readonly ChangelogRelease[] = [
  {
    id: '2026-07-26-latest',
    title: 'Latest release',
    date: '2026-07-26',
    sections: { added: ['Added note'] },
  },
];

const mountedRoots: Array<{ host: HTMLDivElement; root: Root }> = [];

const mount = async (element: React.ReactElement) => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  mountedRoots.push({ host, root });

  await act(async () => {
    root.render(element);
  });

  return { host, root };
};

const findButton = (host: HTMLElement, testId: string): HTMLButtonElement => {
  const button = host.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`);
  if (!button) throw new Error(`Missing ${testId} button`);
  return button;
};

const findCloseButton = (host: HTMLElement): HTMLButtonElement => {
  const button = host.querySelector<HTMLButtonElement>(`[aria-label="Close What's New"]`);
  if (!button) throw new Error('Missing close button');
  return button;
};

const click = async (button: HTMLButtonElement): Promise<void> => {
  await act(async () => {
    button.click();
  });
};

afterEach(async () => {
  for (const { host, root } of mountedRoots.splice(0).reverse()) {
    await act(async () => {
      root.unmount();
    });
    host.remove();
  }
});

const ManualOpenHarness = () => {
  const [showUtilityMenu, setShowUtilityMenu] = useState(true);
  const [showChangelog, setShowChangelog] = useState(false);
  const utilityButtonRef = useRef<HTMLButtonElement>(null);
  const changelogReturnFocusTarget = useRef<HTMLElement | null>(null);

  const openChangelogManually = (returnFocusTarget: HTMLElement | null) => {
    changelogReturnFocusTarget.current = returnFocusTarget;
    setShowChangelog(true);
  };

  const dismissChangelog = () => {
    setShowChangelog(false);
    changelogReturnFocusTarget.current = null;
  };

  return (
    <>
      <button ref={utilityButtonRef} type="button" data-testid="utility-gear">Utility gear</button>
      {showUtilityMenu && (
        <button
          type="button"
          data-testid="whats-new-menu-item"
          onClick={() => {
            setShowUtilityMenu(false);
            openChangelogManually(utilityButtonRef.current);
          }}
        >
          What&apos;s New
        </button>
      )}
      {showChangelog && (
        <ChangelogModal
          releases={releases}
          onClose={dismissChangelog}
          returnFocusTarget={changelogReturnFocusTarget.current}
        />
      )}
    </>
  );
};

const AutoOpenHarness = ({ shouldAutoOpen }: { shouldAutoOpen: boolean }) => {
  const [showChangelog, setShowChangelog] = useState(false);
  const autoOpenAttempted = useRef(false);

  useEffect(() => {
    if (shouldAutoOpen && !autoOpenAttempted.current) {
      autoOpenAttempted.current = true;
      setShowChangelog(true);
    }
  }, [shouldAutoOpen]);

  return (
    <>
      <button type="button" data-testid="auto-utility-gear">Utility gear</button>
      <button type="button" data-testid="pre-auto-focus">Previously focused control</button>
      {showChangelog && (
        <ChangelogModal
          releases={releases}
          onClose={() => setShowChangelog(false)}
          returnFocusTarget={null}
        />
      )}
    </>
  );
};

describe('ChangelogModal DOM focus restoration', () => {
  it('returns focus to the persistent gear after its transient menu opener unmounts', async () => {
    const { host } = await mount(<ManualOpenHarness />);
    const utilityGear = findButton(host, 'utility-gear');
    const menuItem = findButton(host, 'whats-new-menu-item');

    menuItem.focus();
    expect(document.activeElement).toBe(menuItem);

    await click(menuItem);

    expect(host.querySelector('[data-testid="whats-new-menu-item"]')).toBeNull();
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();

    await click(findCloseButton(host));

    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(utilityGear);
  });

  it('keeps auto-open restoration with the focus that preceded the modal', async () => {
    const { host, root } = await mount(<AutoOpenHarness shouldAutoOpen={false} />);
    const utilityGear = findButton(host, 'auto-utility-gear');
    const previouslyFocusedControl = findButton(host, 'pre-auto-focus');

    previouslyFocusedControl.focus();
    expect(document.activeElement).toBe(previouslyFocusedControl);

    await act(async () => {
      root.render(<AutoOpenHarness shouldAutoOpen />);
    });

    await click(findCloseButton(host));

    expect(document.activeElement).toBe(previouslyFocusedControl);
    expect(document.activeElement).not.toBe(utilityGear);
  });
});
