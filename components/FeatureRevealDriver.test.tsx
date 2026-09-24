// @vitest-environment jsdom

import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FeatureRevealDriver } from './FeatureRevealDriver';

vi.mock('../context/ProfileContext', () => ({
  useProfiles: () => ({ activeProfileId: 'quota-profile' }),
}));

vi.mock('../hooks/useFeatureGates', () => ({
  useFeatureGates: () => new Set(['ctrl:LOG']),
}));

const toast = vi.hoisted(() => vi.fn());
vi.mock('../utils/toast', () => ({ showToast: toast }));
vi.mock('../utils/flash', () => ({ flashSelector: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('FeatureRevealDriver storage recovery', () => {
  it('keeps the app mounted when the feature-seen record cannot be written', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError');
      },
    });

    expect(() => render(<FeatureRevealDriver />)).not.toThrow();
  });

  it('does not re-celebrate visible features on every render when the record cannot be written', () => {
    vi.useFakeTimers();
    try {
      toast.mockClear();
      vi.stubGlobal('localStorage', {
        getItem: () => null,
        setItem: () => {
          throw new DOMException('full', 'QuotaExceededError');
        },
      });

      const { rerender } = render(<FeatureRevealDriver />);
      rerender(<FeatureRevealDriver />);
      rerender(<FeatureRevealDriver />);
      act(() => { vi.runAllTimers(); });

      expect(toast).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the app mounted when feature storage is completely unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
    });

    expect(() => render(<FeatureRevealDriver />)).not.toThrow();
  });
});
