// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { RuneProofBranchSelector } from './RuneProofBranchSelector';
import { branchOption } from '../../utils/questStrategies/testFixtures';

afterEach(cleanup);

it('requires an explicit route button and reports switch consequences', () => {
  const onSelectBranch = vi.fn();
  const local = branchOption('local', {
    selected: true,
    recommended: true,
    pinned: true,
    progress: { completed: 1, total: 3 },
  });
  const remote = branchOption('remote', {
    selected: false,
    recommended: false,
    pinned: false,
    state: 'BLOCKED',
    switchConsequence: { sharedRetained: 2, inactive: 3, reactivated: 1 },
  });
  const { rerender } = render(<RuneProofBranchSelector
    branches={[local, remote]}
    onSelectBranch={onSelectBranch}
  />);
  expect(screen.getByText(/2 shared confirmations stay active/i)).toBeTruthy();
  expect(screen.getByText(/3 become inactive/i)).toBeTruthy();
  expect(screen.getByText('Recommended')).toBeTruthy();
  expect(screen.getByText('Pinned')).toBeTruthy();
  expect(screen.getByText('1/3 complete')).toBeTruthy();
  expect(screen.getByText('Blocked')).toBeTruthy();
  const remoteButton = screen.getByRole('button', { name: 'Use Remote route' }) as HTMLButtonElement;
  expect(remoteButton.disabled).toBe(false);
  fireEvent.click(remoteButton);
  expect(onSelectBranch).toHaveBeenCalledTimes(1);
  expect(onSelectBranch).toHaveBeenCalledWith('remote');
  expect(screen.getByRole('article', { name: 'Local route' })
    .getAttribute('aria-current')).toBe('true');
  rerender(<RuneProofBranchSelector
    branches={[
      { ...local, selected: false },
      { ...remote, selected: true, pinned: true },
    ]}
    onSelectBranch={onSelectBranch}
  />);
  expect(document.activeElement).toBe(screen.getByRole('article', { name: 'Remote route' }));
});

it('hides for one branch and disables needs-review routes', () => {
  const { rerender } = render(<RuneProofBranchSelector
    branches={[branchOption('main', { selected: true })]}
    onSelectBranch={vi.fn()}
  />);
  expect(screen.queryByRole('group', { name: 'Quest route' })).toBeNull();
  rerender(<RuneProofBranchSelector
    branches={[
      branchOption('main', { selected: true }),
      branchOption('unknown', { state: 'NEEDS_REVIEW' }),
    ]}
    onSelectBranch={vi.fn()}
  />);
  const unavailable = screen.getByRole('button', { name: 'Use Unknown route' }) as HTMLButtonElement;
  expect(unavailable.disabled).toBe(true);
});

it('does not move focus until the requested branch is actually selected', () => {
  const local = branchOption('local', { selected: true });
  const remote = branchOption('remote', { selected: false });
  const { rerender } = render(<RuneProofBranchSelector
    branches={[local, remote]}
    onSelectBranch={vi.fn()}
  />);
  const remoteButton = screen.getByRole('button', { name: 'Use Remote route' });
  remoteButton.focus();
  fireEvent.click(remoteButton);
  rerender(<RuneProofBranchSelector
    branches={[{ ...local }, { ...remote }]}
    onSelectBranch={vi.fn()}
  />);
  expect(document.activeElement).not.toBe(screen.getByRole('article', { name: 'Remote route' }));
  expect(document.activeElement).toBe(remoteButton);
  rerender(<RuneProofBranchSelector
    branches={[{ ...local, selected: false }, { ...remote, selected: true }]}
    onSelectBranch={vi.fn()}
  />);
  expect(document.activeElement).toBe(screen.getByRole('article', { name: 'Remote route' }));
});

it('keeps the selected route disabled without disabling reviewed blocked routes', () => {
  render(<RuneProofBranchSelector
    branches={[
      branchOption('local', { selected: true, state: 'READY' }),
      branchOption('remote', { state: 'BLOCKED' }),
    ]}
    onSelectBranch={vi.fn()}
  />);
  const local = screen.getByRole('article', { name: 'Local route' });
  const remote = screen.getByRole('article', { name: 'Remote route' });
  expect((within(local).getByRole('button', { name: 'Use Local route' }) as HTMLButtonElement).disabled)
    .toBe(true);
  expect((within(remote).getByRole('button', { name: 'Use Remote route' }) as HTMLButtonElement).disabled)
    .toBe(false);
});
