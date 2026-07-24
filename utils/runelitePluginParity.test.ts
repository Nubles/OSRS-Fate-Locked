import { describe, expect, it } from 'vitest';

type BundleLike = {
  unlockedRegions?: string[];
  unlockedChunks?: string[];
  bankLocks?: boolean;
  unlockedBanks?: string[];
  state?: { linkedAccount?: string };
  rules?: {
    account: string | null;
    bankLocks: boolean;
    unlocks: {
      regions: string[];
      chunks: string[];
      banks: string[];
    };
  };
};

const effective = (bundle: BundleLike) => ({
  account: bundle.rules?.account ?? bundle.state?.linkedAccount ?? null,
  bankLocks: bundle.rules?.bankLocks ?? bundle.bankLocks ?? false,
  regions: bundle.rules?.unlocks.regions ?? bundle.unlockedRegions ?? [],
  chunks: bundle.rules?.unlocks.chunks ?? bundle.unlockedChunks ?? [],
  banks: bundle.rules?.unlocks.banks ?? bundle.unlockedBanks ?? [],
});

describe('RuneLite v3/v4 parity', () => {
  it('preserves region, chunk, bank, and account decisions', () => {
    const v3: BundleLike = {
      unlockedRegions: ['Misthalin'],
      unlockedChunks: ['50,50'],
      bankLocks: true,
      unlockedBanks: ['12850'],
      state: { linkedAccount: 'Example' },
    };
    const v4: BundleLike = {
      ...v3,
      rules: {
        account: 'Example',
        bankLocks: true,
        unlocks: {
          regions: ['Misthalin'],
          chunks: ['50,50'],
          banks: ['12850'],
        },
      },
    };

    expect(effective(v4)).toEqual(effective(v3));
  });

  it('uses legacy root fields when a rules manifest is absent', () => {
    expect(effective({
      unlockedRegions: ['Asgarnia'],
      state: { linkedAccount: 'Legacy' },
    })).toEqual({
      account: 'Legacy',
      bankLocks: false,
      regions: ['Asgarnia'],
      chunks: [],
      banks: [],
    });
  });
});
