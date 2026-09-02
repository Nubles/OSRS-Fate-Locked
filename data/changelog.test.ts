import { describe, expect, it } from 'vitest';
import {
  CHANGELOG_RELEASES,
  LATEST_CHANGELOG,
  type ChangelogSection,
} from './changelog';

const allowedSections = new Set<ChangelogSection>([
  'added',
  'changed',
  'fixed',
  'balance',
]);

describe('authored changelog releases', () => {
  it('keeps unique release ids in newest-first ISO date order', () => {
    const ids = CHANGELOG_RELEASES.map((release) => release.id);
    const dates = CHANGELOG_RELEASES.map((release) => release.date);

    expect(new Set(ids).size).toBe(ids.length);
    expect(dates).toEqual([...dates].sort((left, right) => right.localeCompare(left)));
    expect(LATEST_CHANGELOG.id).toBe('2026-09-02-shop-category-accuracy');
  });

  it('announces the shop category fixes exactly', () => {
    expect(LATEST_CHANGELOG).toEqual({
      id: '2026-09-02-shop-category-accuracy',
      title: 'Shops Stay in Their Lane',
      date: '2026-09-02',
      sections: {
        fixed: [
          'Shop unlocks now follow each store\'s actual stock and speciality, including Scavvo\'s rune armour, ore merchants, pubs, cape sellers, and reward exchanges.',
          'Every placed shop and stock-bearing item source now receives a consistent merchant category instead of silently bypassing its unlock.',
        ],
      },
    });
  });

  it('retains the diary geography corrections', () => {
    const diaryGeography = CHANGELOG_RELEASES.find(
      release => release.id === '2026-08-30-diary-geography',
    );

    expect(diaryGeography).toEqual({
      id: '2026-08-30-diary-geography',
      title: 'Achievement Diary Locations Corrected',
      date: '2026-08-30',
      sections: {
        fixed: [
          'Achievement Diary tasks now use their actual local areas instead of requiring an entire parent region.',
          "Sarah's Farm shop, Falador Farm tasks, the Combat Training Camp, Ancient Cavern, Gandius, Emir's Arena, and other misplaced tasks now use their correct unlocks.",
          'Tasks valid in several areas now accept any valid location, while player-owned-house tasks no longer require an unrelated overworld area.',
          'The Royal Titans requirement note now points to the Asgarnian Ice Dungeon.',
        ],
      },
    });
  });

  it('retains the synchronized requirement fixes', () => {
    const requirementReadiness = CHANGELOG_RELEASES.find(
      release => release.id === '2026-08-30-requirement-readiness',
    );

    expect(requirementReadiness).toEqual({
      id: '2026-08-30-requirement-readiness',
      title: 'Requirements Stay in Sync',
      date: '2026-08-30',
      sections: {
        fixed: [
          'Boss and minigame readiness now uses the same location requirements as the activity access map.',
          'Bounty Hunter now requires combat level 32 and confirmation of at least 12 hours of account play time.',
          'Soul Wars now requires combat level 40, total level 500, and confirmation that its tutorial is complete.',
          'Goal routes that depend on Dream Mentor now include its combat level 85 requirement.',
        ],
      },
    });
  });

  it('retains the previous combat eligibility release', () => {
    const combatEligibility = CHANGELOG_RELEASES.find(
      release => release.id === '2026-08-29-combat-level-eligibility',
    );

    expect(combatEligibility).toEqual({
      id: '2026-08-29-combat-level-eligibility',
      title: 'Combat Levels Count Correctly',
      date: '2026-08-29',
      sections: {
        fixed: [
          'Combat requirements now use your real OSRS combat level instead of reducing it to unlocked skill-method tiers.',
          'Slayer-master readiness now includes each master\'s location, quest, combat, Slayer, and Slayer-cape access routes.',
          'Soul Wars now correctly requires combat level 40 in activity readiness.',
        ],
      },
    });
  });

  it('announces the first public RuneProof quest pack accurately', () => {
    const runeProofWaveOne = CHANGELOG_RELEASES.find(
      release => release.id === '2026-08-22-runeproof-wave-one',
    );

    expect(runeProofWaveOne).toMatchObject({
      id: '2026-08-22-runeproof-wave-one',
      title: 'RuneProof Begins',
      date: '2026-08-22',
    });
    expect(runeProofWaveOne?.sections.added).toEqual(expect.arrayContaining([
      expect.stringMatching(/five reviewed F2P quest guides/i),
      expect.stringMatching(/temporary maps/i),
    ]));
    expect(runeProofWaveOne?.sections.changed).toEqual(expect.arrayContaining([
      expect.stringMatching(/reachable.*imp source/i),
      expect.stringMatching(/does not complete.*Journal/i),
    ]));
  });

  it('announces consistent continent access and storage-full recovery', () => {
    const regionStorageRecovery = CHANGELOG_RELEASES.find(
      release => release.id === '2026-08-25-region-storage-recovery',
    );

    expect(regionStorageRecovery).toMatchObject({
      id: '2026-08-25-region-storage-recovery',
      title: 'Regions & Saves Recovered',
      date: '2026-08-25',
    });
    expect(regionStorageRecovery?.sections.fixed).toEqual(expect.arrayContaining([
      expect.stringMatching(/completed continents.*quests.*diaries/i),
      expect.stringMatching(/browser storage.*reload/i),
      expect.stringMatching(/disposable caches.*profile/i),
    ]));
  });

  it('announces the accurate Fate Analytics dashboard', () => {
    const fateAnalytics = CHANGELOG_RELEASES.find(
      release => release.id === '2026-08-20-fate-analytics-dashboard',
    );

    expect(fateAnalytics).toMatchObject({
      id: '2026-08-20-fate-analytics-dashboard',
      title: 'Your Fate, Explained',
      date: '2026-08-20',
    });
    expect(fateAnalytics?.sections.added).toEqual(expect.arrayContaining([
      expect.stringMatching(/nine visual views/i),
      expect.stringMatching(/activity calendar/i),
    ]));
    expect(fateAnalytics?.sections.changed).toEqual(expect.arrayContaining([
      expect.stringMatching(/shared filters/i),
      expect.stringMatching(/scoreable/i),
    ]));
    expect(fateAnalytics?.sections.fixed).toEqual(expect.arrayContaining([
      expect.stringMatching(/pity/i),
      expect.stringMatching(/older saves/i),
    ]));
  });

  it('announces the Wyrmscraig content update', () => {
    const wyrmscraigRelease = CHANGELOG_RELEASES.find(
      release => release.id === '2026-08-16-wyrmscraig-content',
    );

    expect(wyrmscraigRelease).toMatchObject({
      id: '2026-08-16-wyrmscraig-content',
      title: 'Wyrmscraig Has Arrived',
      date: '2026-08-16',
    });
    expect(wyrmscraigRelease?.sections.added).toEqual(expect.arrayContaining([
      'Fallen From Grace and The Mad Angel are now tracked across quests, bosses, requirements, and the Collection Log.',
      'Hunter, Mining, and Crafting Tier 6 now list Goat Hunting, Sunstone Mining, and Sunstone Golem Crafting with their Wyrmscraig requirements.',
    ]));
    expect(wyrmscraigRelease?.sections.fixed).toEqual(expect.arrayContaining([
      'The August source refresh adds the latest shortcuts, drop-table corrections, Collection Log items, and the corrected Grandmaster tier for Maggot King Speed Chaser.',
    ]));
  });

  it('announces the latest physical-chunk unlock and source corrections', () => {
    const physicalChunkRelease = CHANGELOG_RELEASES.find(
      release => release.id === '2026-08-02-one-physical-chunk-one-unlock',
    );

    expect(physicalChunkRelease).toMatchObject({
      id: '2026-08-02-one-physical-chunk-one-unlock',
      title: 'One Chunk, One Unlock',
      date: '2026-08-02',
    });
    expect(physicalChunkRelease?.sections.changed).toContain(
      'Chunk data is refreshed to the reviewed 2 August Chunk Picker revision, including newly named waters around Ardeaglais, Auchrie, and Wyrmscraig.',
    );
    expect(physicalChunkRelease?.sections.fixed).toEqual(expect.arrayContaining([
      'Twenty-four boundary chunks now use the correct parent continent, fixing labels such as Falador \u00b7 Misthalin and Port Sarim \u00b7 Karamja.',
    ]));
    expect(JSON.stringify(physicalChunkRelease?.sections)).toContain(
      'Named dungeon, cave, mine, and basement task unlocks now follow their reviewed physical entrances instead of being omitted.',
    );
    expect(JSON.stringify(physicalChunkRelease?.sections)).toContain(
      'Chunk Info now shows each reviewed entrance as locked with its chunk or available.',
    );
  });

  it('announces the polished Chunk Info drawer', () => {
    const polishedChunkInfo = CHANGELOG_RELEASES.find(
      release => release.id === '2026-08-04-polished-chunk-info',
    );

    expect(polishedChunkInfo).toMatchObject({
      id: '2026-08-04-polished-chunk-info',
      title: 'Clearer Chunk Info',
      date: '2026-08-04',
    });
    expect(polishedChunkInfo?.sections.changed).toEqual(expect.arrayContaining([
      'Chunk Info now leads with a clear availability summary and keeps detailed content in readable expandable groups.',
      'Entry requirements, entrances, and banks now share one consistent Access & facilities card.',
      'Locked content stays readable and explains its requirement without striking through the full name.',
    ]));
  });

  it('announces the complete reviewed bank pool', () => {
    const bankPoolRelease = CHANGELOG_RELEASES.find(
      release => release.id === '2026-08-08-complete-bank-pool',
    );

    expect(bankPoolRelease).toMatchObject({
      id: '2026-08-08-complete-bank-pool',
      title: 'Every Bank Has Its Place',
      date: '2026-08-08',
    });
    expect(bankPoolRelease?.sections.fixed).toEqual(expect.arrayContaining([
      'Bank-locked modes now include every reviewed fixed-location bank, chest, deposit box, and deposit service, including Wyrmscraig and Sangvesti access.',
      'Bank rolls now use clear facility names for reviewed underground and instanced access chunks.',
      'The temporary Forestry Woodcutting Leprechaun is represented as one virtual bank unlock without a fixed chunk.',
    ]));
  });

  it('preserves the profile registry recovery and multi-tab safety release', () => {
    const profileMetadataIntegrity = CHANGELOG_RELEASES.find(
      release => release.id === '2026-08-02-profile-metadata-integrity',
    );

    expect(profileMetadataIntegrity).toMatchObject({
      id: '2026-08-02-profile-metadata-integrity',
      title: 'Safer Profile Management',
      date: '2026-08-02',
    });
    expect(profileMetadataIntegrity?.sections.fixed).toEqual(expect.arrayContaining([
      'Damaged profile lists now recover every valid browser save they can find instead of leaving the app on a blank screen.',
      'Creating, renaming, switching, and deleting profiles in multiple tabs no longer silently loses profile-list changes.',
      'Profiles that are still open in another tab cannot be deleted until that tab switches away or closes.',
    ]));
  });
  it('announces every weighted Fate balance rule', () => {
    const weightedFate = CHANGELOG_RELEASES.find(
      release => release.id === '2026-08-02-weighted-fate',
    );

    expect(weightedFate).toMatchObject({
      id: '2026-08-02-weighted-fate',
      date: '2026-08-02',
    });
    const balanceNotes = weightedFate?.sections.balance?.join(' ');
    expect(balanceNotes).toMatch(/\+1\/\+2\/\+3 Fate/);
    expect(balanceNotes).toMatch(/overflow/i);
    expect(balanceNotes).toMatch(/active pity threshold/i);
    expect(balanceNotes).not.toMatch(/50 Fate/i);
    expect(balanceNotes).toMatch(/guaranteed Chaos/i);
    expect(balanceNotes).toMatch(/independent 2%/i);
  });


  it('announces the cross-tab save ownership protections', () => {
    const crossTabSafety = CHANGELOG_RELEASES.find(
      release => release.id === '2026-08-01-cross-tab-safety',
    );

    expect(crossTabSafety).toMatchObject({
      id: '2026-08-01-cross-tab-safety',
      title: 'Safer Multi-Tab Play',
      date: '2026-08-01',
    });
    expect(crossTabSafety?.sections.added).toContain(
      'A clear warning now appears when the same profile is open in another tab, with takeover, reload, and export recovery actions.',
    );
    expect(crossTabSafety?.sections.fixed).toContain(
      'Two browser tabs can no longer silently overwrite the same profile while both appear to be saving.',
    );
  });

  it('announces the native RuneLite guide visual refresh', () => {
    const nativeTheme = CHANGELOG_RELEASES.find(
      release => release.id === '2026-07-28-runelite-guide-native-theme',
    );
    expect(nativeTheme).toMatchObject({
      id: '2026-07-28-runelite-guide-native-theme',
      title: 'RuneLite Guide Visual Refresh',
      date: '2026-07-28',
    });
    expect(nativeTheme?.sections.changed).toContain(
      'The RuneLite Plugin Guide now uses the same compact panels, navigation, typography, and amber control styling as the Fate Locked companion while preserving every chapter, setting, and authentic screenshot.',
    );
  });

  it('announces the complete player-facing RuneLite guide', () => {
    const completeGuide = CHANGELOG_RELEASES.find(
      release => release.id === '2026-07-28-runelite-guide',
    );
    expect(completeGuide).toMatchObject({
      id: '2026-07-28-runelite-guide',
      title: 'RuneLite Plugin Guide',
      date: '2026-07-28',
    });
    expect(completeGuide?.sections.added).toContain(
      'A complete RuneLite Plugin Guide now covers installation, connection, every panel section and setting, overlays, privacy, recommended configurations, and troubleshooting with annotated screenshots from the live plugin.',
    );
  });

  it('contains only non-empty, supported sections', () => {
    for (const release of CHANGELOG_RELEASES) {
      for (const [section, notes] of Object.entries(release.sections)) {
        expect(allowedSections.has(section as ChangelogSection)).toBe(true);
        expect(notes).toBeDefined();
        expect(notes?.length).toBeGreaterThan(0);
      }
    }
  });

  it('announces the quest location display fix in player language', () => {
    const questChunkAudit = CHANGELOG_RELEASES.find(
      release => release.id === '2026-07-28-quest-chunk-audit',
    );

    expect(questChunkAudit?.sections.fixed).toContain(
      'Quest cards now show exact required chunks once and separate incomplete Chunk Picker evidence under Known steps.',
    );
  });

  it('describes the complete RuneLite companion update in player language', () => {
    const runeliteCompanion = CHANGELOG_RELEASES.find(
      release => release.id === '2026-07-28-runelite-companion-update',
    );
    expect(runeliteCompanion).toMatchObject({
      id: '2026-07-28-runelite-companion-update',
      title: 'RuneLite Companion Update',
      date: '2026-07-28',
    });
    expect(runeliteCompanion?.sections.added).toContain(
      'Connect the companion to RuneLite with one guided, copyable pairing command.',
    );
    expect(runeliteCompanion?.sections.changed).toEqual(expect.arrayContaining([
      'RuneLite reads your app-authored run rules while detected gameplay events remain local to RuneLite.',
      'The complete RuneLite experience now lives in one panel with collapsible sections.',
    ]));
    expect(runeliteCompanion?.sections.changed).toContainEqual({
      text: 'The RuneLite Plugin Hub update has been approved and is now live. View the merged',
      link: {
        label: 'Plugin Hub PR #14395',
        href: 'https://github.com/runelite/plugin-hub/pull/14395',
      },
    });
    expect(runeliteCompanion?.sections.fixed).toEqual(expect.arrayContaining([
      'RuneLite controls no longer appear clipped or overlap adjacent colour settings.',
      'Run balances are now labelled Keys, Omni Keys, and Chaos Keys.',
    ]));
  });

  it('describes the Tirannwn area migration in player language', () => {
    const tirannwnAccuracy = CHANGELOG_RELEASES.find(
      release => release.id === '2026-07-28-tirannwn-area-accuracy',
    );

    expect(tirannwnAccuracy).toMatchObject({
      id: '2026-07-28-tirannwn-area-accuracy',
      title: 'Tirannwn Area Accuracy',
      date: '2026-07-28',
    });
    expect(tirannwnAccuracy?.sections.changed).toContain(
      'Elf Camp is now treated as Iorwerth Camp everywhere and no longer appears in new area rolls.',
    );
    expect(tirannwnAccuracy?.sections.fixed).toEqual(expect.arrayContaining([
      'Existing saves with both camp names now keep one unlock and receive one regular Key refund.',
      'Tirannwn completion totals and RuneLite exports now use the canonical Iorwerth Camp unlock.',
    ]));
  });

  it('records every approved Vanilla safety-valve balance change', () => {
    const vanillaSafetyValve = CHANGELOG_RELEASES.find(
      release => release.id === '2026-07-26-vanilla-key-safety-valve',
    );

    expect(vanillaSafetyValve?.sections.balance).toEqual([
      'Bosses now provide a finite, diminishing Vanilla key reserve.',
      'Brutus joins Farm Keys as a one-key early safety valve.',
      'The first three clue-earned Standard Keys share 25%, 15%, and 10% minimum chances.',
      'Standard and Chaos boss/minigame rolls now respect hard location access.',
      'The Codex now correctly explains that Vanilla area unlocks can be scattered.',
    ]);
  });

  it('preserves the prior tracker accuracy release', () => {
    const trackerAccuracy = CHANGELOG_RELEASES.find(
      release => release.id === '2026-07-23-tracker-accuracy',
    );

    expect(trackerAccuracy).toMatchObject({
      id: '2026-07-23-tracker-accuracy',
      title: 'Tracker Accuracy & Combat Powers',
      date: '2026-07-23',
    });
    expect(trackerAccuracy?.sections.added).toContain(
      "A What's New dialog now summarizes each player-facing release.",
    );
    expect(trackerAccuracy?.sections.changed).toContain(
      'Arcana is now called Combat Powers, covering spellbooks, prayers, and special combat systems such as Dwarf Cannon.',
    );
    expect(trackerAccuracy?.sections.fixed).toEqual(expect.arrayContaining([
      'Dragon Claws now list Chambers of Xeric instead of Tormented Demons.',
      'Quest and diary recommendations now respect unlocked skill-method caps as well as recorded levels.',
    ]));
  });
});
