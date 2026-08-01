// @vitest-environment jsdom

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  discardPendingSave,
  resetPendingSavesForTest,
  stagePendingSave,
} from '../utils/pendingSaves';
import { SaveRecoveryGuard } from './SaveRecoveryGuard';

describe('SaveRecoveryGuard', () => {
  beforeEach(resetPendingSavesForTest);

  afterEach(() => {
    cleanup();
    resetPendingSavesForTest();
  });

  it('guards unload only while any profile has staged data', () => {
    render(<SaveRecoveryGuard />);

    act(() => stagePendingSave('profile-a', 'data'));
    const protectedUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(protectedUnload);
    expect(protectedUnload.defaultPrevented).toBe(true);

    act(() => discardPendingSave('profile-a'));
    const safeUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(safeUnload);
    expect(safeUnload.defaultPrevented).toBe(false);
  });
});
