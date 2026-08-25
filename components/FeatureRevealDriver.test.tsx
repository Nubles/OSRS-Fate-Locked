// @vitest-environment jsdom

import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FeatureRevealDriver } from './FeatureRevealDriver';

vi.mock('../context/ProfileContext', () => ({
  useProfiles: () => ({ activeProfileId: 'quota-profile' }),
}));

vi.mock('../hooks/useFeatureGates', () => ({
  useFeatureGates: () => new Set(['ctrl:LOG']),
}));

vi.mock('../utils/toast', () => ({ showToast: vi.fn() }));
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
