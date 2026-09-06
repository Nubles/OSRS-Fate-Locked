// @vitest-environment jsdom
import React, { act, useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChangelogRelease } from '../data/changelog';
import type { FateCompensationChoice, FateCompensationState } from '../types';
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

const linkedReleases: readonly ChangelogRelease[] = [
  {
    id: '2026-07-28-linked-note',
    title: 'Linked release',
    date: '2026-07-28',
    sections: {
      added: ['Added note'],
      changed: [
        {
          text: 'The RuneLite Plugin Hub update has been approved and is now live. View the merged',
          link: {
            label: 'Plugin Hub PR #14395',
            href: 'https://github.com/runelite/plugin-hub/pull/14395',
          },
        },
      ],
    },
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

const pendingCompensation: FateCompensationState = {
  releaseId: '2026-07-26-latest',
  status: 'pending',
  chaosKeys: 2,
  pityKeys: 1,
  fatePoints: 5,
};

class RenderErrorBoundary extends React.Component<
  React.PropsWithChildren,
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed
      ? <span data-testid="render-failed">Render failed</span>
      : this.props.children;
  }
}

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

describe('ChangelogModal linked notes', () => {
  it('renders the review PR as a safe new-tab link while preserving string notes', async () => {
    const { host } = await mount(
      <RenderErrorBoundary>
        <ChangelogModal releases={linkedReleases} onClose={() => undefined} />
      </RenderErrorBoundary>,
    );
    const link = host.querySelector<HTMLAnchorElement>(
      'a[href="https://github.com/runelite/plugin-hub/pull/14395"]',
    );

    expect(link).not.toBeNull();
    expect(link?.textContent).toBe('Plugin Hub PR #14395');
    expect(link?.target).toBe('_blank');
    expect(link?.rel.split(/\s+/).sort()).toEqual(['noopener', 'noreferrer']);
    expect(link?.closest('li')?.textContent).toBe(
      'The RuneLite Plugin Hub update has been approved and is now live. View the merged Plugin Hub PR #14395.',
    );
    expect(host.textContent).toContain('Added note');
  });
});

describe('ChangelogModal compensation choices', () => {
  it('blocks every dismiss path while pending and emits each explicit choice once', async () => {
    const onClose = vi.fn();
    const choices: FateCompensationChoice[] = [];
    const { host } = await mount(
      <ChangelogModal
        releases={releases}
        onClose={onClose}
        compensation={pendingCompensation}
        onResolveCompensation={choice => choices.push(choice)}
      />,
    );

    const headerClose = findCloseButton(host);
    const footerClose = Array.from(host.querySelectorAll('button'))
      .find(button => button.textContent === 'Got it') as HTMLButtonElement;
    expect(headerClose.disabled).toBe(true);
    expect(footerClose.disabled).toBe(true);
    await click(headerClose);
    await click(footerClose);
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).not.toHaveBeenCalled();

    for (const [label, choice] of [
      ['Continue without compensation', 'none'],
      ['Claim Chaos Keys only', 'chaos'],
      ['Claim full compensation', 'full'],
    ] as const) {
      const button = Array.from(host.querySelectorAll('button'))
        .find(candidate => candidate.textContent === label) as HTMLButtonElement;
      await click(button);
      expect(choices.at(-1)).toBe(choice);
    }
    expect(choices).toEqual(['none', 'chaos', 'full']);
  });

  it('restores close behavior after resolution and hides claim controls', async () => {
    const onClose = vi.fn();
    const { host, root } = await mount(
      <ChangelogModal
        releases={releases}
        onClose={onClose}
        compensation={pendingCompensation}
        onResolveCompensation={() => undefined}
      />,
    );

    await act(async () => {
      root.render(
        <ChangelogModal
          releases={releases}
          onClose={onClose}
          compensation={{ ...pendingCompensation, status: 'full', choice: 'full' }}
          onResolveCompensation={() => undefined}
        />,
      );
    });

    expect(host.textContent).not.toContain('Claim full compensation');
    expect(findCloseButton(host).disabled).toBe(false);
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders no claim controls for a not-eligible offer', async () => {
    const { host } = await mount(
      <ChangelogModal
        releases={releases}
        onClose={() => undefined}
        compensation={{ ...pendingCompensation, status: 'not_eligible' }}
        onResolveCompensation={() => undefined}
      />,
    );

    expect(host.textContent).not.toContain('Continue without compensation');
    expect(host.textContent).not.toContain('Claim Chaos Keys only');
    expect(host.textContent).not.toContain('Claim full compensation');
  });
});

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
