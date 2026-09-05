export type ChangelogSection = 'added' | 'changed' | 'fixed' | 'balance';

export interface LinkedChangelogNote {
  text: string;
  link: {
    label: string;
    href: string;
  };
}

export type ChangelogNote = string | LinkedChangelogNote;

export interface ChangelogRelease {
  id: string;
  title: string;
  date: string;
  sections: Partial<Record<ChangelogSection, readonly ChangelogNote[]>>;
}

export const CHANGELOG_RELEASES = [
  {
    id: '2026-09-05-requirement-reliability',
    title: 'Requirements and Save Checks',
    date: '2026-09-05',
    sections: {
      fixed: [
        'Quest, diary, activity and Slayer checks now use your attained levels separately from unlocked training and equipment tiers.',
        'Missing items, partial quest progress and other untracked conditions ask for confirmation; unknown requirements remain visible instead of appearing ready.',
        'Alternative diary routes, shared area access and RuneProof requirement checks now stay consistent across planning screens.',
        'Save history checks identify incomplete or migrated history without presenting it as independently verified gameplay.',
        'Older imports can reach their compensation choices, and onboarding controls fit small mobile screens.',
      ],
    },
  },
  {
    id: '2026-09-04-runelite-relay-reliability',
    title: 'RuneLite Relay Reliability',
    date: '2026-09-04',
    sections: {
      fixed: [
        'Connecting RuneLite no longer leaves the tracker polling retired event routes in the background.',
        'The stream overlay now checks for updates less aggressively, reducing relay outages during long sessions.',
      ],
    },
  },
  {
    id: '2026-09-03-quest-area-access',
    title: 'Quest Area Access Corrected',
    date: '2026-09-03',
    sections: {
      fixed: [
        'Enter the Abyss can now be completed from the default Misthalin area without unlocking the entire Wilderness.',
        'Clock Tower, Hazeel Cult, Sheep Herder, and Tower of Life now correctly accept East Ardougne instead of requiring every Kandarin subarea.',
        'The complete 210-entry quest and miniquest catalogue now checks exact tracked areas instead of requiring entire parent regions.',
        'The Slug Menace now describes the Edgeville Abyss route accurately.',
      ],
    },
  },
  {
    id: '2026-09-02-shop-category-accuracy',
    title: 'Shops Stay in Their Lane',
    date: '2026-09-02',
    sections: {
      fixed: [
        'Shop unlocks now follow each store\'s actual stock and speciality, including Scavvo\'s rune armour, ore merchants, pubs, cape sellers, and reward exchanges.',
        'Every placed shop and stock-bearing item source now receives a consistent merchant category instead of silently bypassing its unlock.',
      ],
    },
  },
  {
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
  },
  {
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
  },
  {
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
  },
  {
    id: '2026-08-25-crash-safe-saves',
    title: 'Crash-Safe Saves',
    date: '2026-08-25',
    sections: {
      added: [
        'Progress now keeps a transactional local recovery journal with timed restore points.',
      ],
      fixed: [
        'Corrupt or interrupted browser saves now stop for recovery instead of silently starting over.',
        'Full browser storage now clears disposable caches and retries profile saves safely.',
        'Interrupted profile cleanup now resumes after reload without restoring the deleted profile.',
      ],
    },
  },
  {
    id: '2026-08-25-region-storage-recovery',
    title: 'Regions & Saves Recovered',
    date: '2026-08-25',
    sections: {
      fixed: [
        'Completed continents now consistently unlock their quests and diaries, including Wilderness diary tasks.',
        'Full browser storage no longer crashes the app during reload while recording optional interface state.',
        'When a profile save reaches the browser limit, disposable caches are cleared and the profile save is retried safely.',
      ],
    },
  },
  {
    id: '2026-08-22-runeproof-wave-one',
    title: 'RuneProof Begins',
    date: '2026-08-22',
    sections: {
      added: [
        "RuneProof launches with five reviewed F2P quest guides: Cook's Assistant, Sheep Shearer, The Restless Ghost, Rune Mysteries, and Imp Catcher.",
        'Every step shows its chunk, and temporary maps close straight back to the same quest and active step.',
      ],
      changed: [
        'RuneProof now recommends a reachable local Imp source instead of waiting for Falador when another unlocked source is available.',
        'RuneProof confirmation tracks guide progress only: it does not complete your Journal quest or grant Keys, Fate rolls, or rewards.',
      ],
    },
  },
  {
    id: '2026-08-20-fate-analytics-dashboard',
    title: 'Your Fate, Explained',
    date: '2026-08-20',
    sections: {
      added: [
        'Fate Analytics now provides nine visual views covering luck over time, outcomes, roll distributions, sources, streaks, probability calibration, Key rewards, the activity calendar, and notable moments.',
        'The activity calendar can move through older selected history, while chart summaries and accessible labels keep the same information available without relying on colour alone.',
      ],
      changed: [
        'Dashboard, category table, and Fate Report now use shared filters for range, source, category, and Exact-only views.',
        'Expected wins, luck delta, calibration, and scoreable success rates now use one clearly labelled scoreable cohort while overall attempts and genuine wins remain visible.',
      ],
      fixed: [
        'Pity interventions are now separated from genuine RNG wins, and Standard Keys remain separate from Omni-Keys throughout the statistics.',
        'Older saves and malformed history now degrade safely with coverage disclosures instead of distorting confirmed odds, rewards, or dated views.',
        'Large histories now aggregate efficiently, and cumulative expectation bands remain within possible success counts.',
      ],
    },
  },
  {
    id: '2026-08-16-wyrmscraig-content',
    title: 'Wyrmscraig Has Arrived',
    date: '2026-08-16',
    sections: {
      added: [
        'Fallen From Grace and The Mad Angel are now tracked across quests, bosses, requirements, and the Collection Log.',
        'Hunter, Mining, and Crafting Tier 6 now list Goat Hunting, Sunstone Mining, and Sunstone Golem Crafting with their Wyrmscraig requirements.',
      ],
      fixed: [
        'The August source refresh adds the latest shortcuts, drop-table corrections, Collection Log items, and the corrected Grandmaster tier for Maggot King Speed Chaser.',
      ],
    },
  },
  {
    id: '2026-08-08-complete-bank-pool',
    title: 'Every Bank Has Its Place',
    date: '2026-08-08',
    sections: {
      fixed: [
        'Bank-locked modes now include every reviewed fixed-location bank, chest, deposit box, and deposit service, including Wyrmscraig and Sangvesti access.',
        'Bank rolls now use clear facility names for reviewed underground and instanced access chunks.',
        'The temporary Forestry Woodcutting Leprechaun is represented as one virtual bank unlock without a fixed chunk.',
      ],
    },
  },
  {
    id: '2026-08-04-polished-chunk-info',
    title: 'Clearer Chunk Info',
    date: '2026-08-04',
    sections: {
      changed: [
        'Chunk Info section headers now use familiar OSRS interface icons, with a Lucide fallback when artwork is unavailable.',
        'Chunk Info now leads with a clear availability summary and keeps detailed content in readable expandable groups.',
        'Entry requirements, entrances, and banks now share one consistent Access & facilities card.',
        'Locked content stays readable and explains its requirement without striking through the full name.',
      ],
    },
  },
  {
    id: '2026-08-04-discord-community-link',
    title: 'Official Discord Community',
    date: '2026-08-04',
    sections: {
      added: [
        'The command-centre header now includes a direct link to the official Fate Locked Ironman Discord community.',
      ],
    },
  },
  {
    id: '2026-08-02-one-physical-chunk-one-unlock',
    title: 'One Chunk, One Unlock',
    date: '2026-08-02',
    sections: {
      changed: [
        "Heroes' Guild, Ice Mountain, Ranging Guild, Otto's Grotto, and the Resource Area now share their physical chunk's single area unlock.",
        'Existing saves automatically keep the canonical area and receive one regular Key for each duplicate overlap they previously purchased.',
        'Chunk data is refreshed to the reviewed 2 August Chunk Picker revision, including newly named waters around Ardeaglais, Auchrie, and Wyrmscraig.',
        'Chunk Info now shows each reviewed entrance as locked with its chunk or available.',
      ],
      fixed: [
        "Unlocking Otto's Grotto now visibly unlocks the Baxtorian Falls chunk containing it.",
        'Twenty-four boundary chunks now use the correct parent continent, fixing labels such as Falador · Misthalin and Port Sarim · Karamja.',
        'Named dungeon, cave, mine, and basement task unlocks now follow their reviewed physical entrances instead of being omitted.',
      ],
    },
  },
  {
    id: '2026-08-02-profile-metadata-integrity',
    title: 'Safer Profile Management',
    date: '2026-08-02',
    sections: {
      fixed: [
        'Damaged profile lists now recover every valid browser save they can find instead of leaving the app on a blank screen.',
        'Creating, renaming, switching, and deleting profiles in multiple tabs no longer silently loses profile-list changes.',
        'Profiles that are still open in another tab cannot be deleted until that tab switches away or closes.',
      ],
    },
  },
  {
    id: '2026-08-02-weighted-fate',
    title: 'Weighted Fate & Milestone Keys',
    date: '2026-08-02',
    sections: {
      balance: [
        'Failed rolls now award +1/+2/+3 Fate based on the activity tier.',
        'Pity Keys use the active pity threshold, and any Fate overflow carries onto the fresh bar.',
        'Skill levels 30, 40, 50, 60, 70, 80, 90, and 99 now award a guaranteed Chaos Key.',
        'The independent 2% Chaos Key chance on skill levels is unchanged and can stack with a guaranteed milestone Key.',
      ],
    },
  },

  {
    id: '2026-08-01-cross-tab-safety',
    title: 'Safer Multi-Tab Play',
    date: '2026-08-01',
    sections: {
      added: [
        'A clear warning now appears when the same profile is open in another tab, with takeover, reload, and export recovery actions.',
      ],
      fixed: [
        'Two browser tabs can no longer silently overwrite the same profile while both appear to be saving.',
      ],
    },
  },
  {
    id: '2026-08-01-save-recovery',
    title: 'Safer Browser Saves',
    date: '2026-08-01',
    sections: {
      added: [
        'A persistent recovery banner now appears if this browser cannot save your latest progress, with Retry save and Export backup actions.',
      ],
      fixed: [
        'Failed browser writes no longer crash the app or silently discard the newest in-tab progress.',
        'Closing the page now warns you while any profile still has progress waiting to be saved.',
      ],
    },
  },
  {
    id: '2026-07-28-quest-chunk-audit',
    title: 'Verified Quest & Chunk Requirements',
    date: '2026-07-28',
    sections: {
      added: [
        'Learning the Ropes and The Blood Moon Rises are now included in the official quest list.',
      ],
      changed: [
        'All 190 quests and 19 miniquests now have reviewed requirement evidence; three remaining source discrepancies are documented and conservatively gated.',
        'The reviewed Chunk Picker source is now pinned, and chunk data refreshes are generated deterministically.',
      ],
      fixed: [
        'Quest cards now show exact required chunks once and separate incomplete Chunk Picker evidence under Known steps.',
        "Witch's Potion now checks Rimmington.",
        "Murder Mystery now checks Sinclair Mansion and Seers' Village.",
        'Quest completion remains strict: unmet machine requirements cannot be bypassed by manual confirmation, and rejected and repeated completions grant no extra rolls.',
      ],
    },
  },
  {
    id: '2026-07-28-runelite-guide-native-theme',
    title: 'RuneLite Guide Visual Refresh',
    date: '2026-07-28',
    sections: {
      changed: [
        'The RuneLite Plugin Guide now uses the same compact panels, navigation, typography, and amber control styling as the Fate Locked companion while preserving every chapter, setting, and authentic screenshot.',
      ],
    },
  },
  {
    id: '2026-07-28-runelite-guide',
    title: 'RuneLite Plugin Guide',
    date: '2026-07-28',
    sections: {
      added: [
        'A complete RuneLite Plugin Guide now covers installation, connection, every panel section and setting, overlays, privacy, recommended configurations, and troubleshooting with annotated screenshots from the live plugin.',
      ],
      fixed: [
        'Annotated RuneLite handbook screenshots now load correctly when the companion is hosted on GitHub Pages.',
      ],
    },
  },
  {
    id: '2026-07-28-tirannwn-area-accuracy',
    title: 'Tirannwn Area Accuracy',
    date: '2026-07-28',
    sections: {
      changed: [
        'Elf Camp is now treated as Iorwerth Camp everywhere and no longer appears in new area rolls.',
      ],
      fixed: [
        'Existing saves with both camp names now keep one unlock and receive one regular Key refund.',
        'Tirannwn completion totals and RuneLite exports now use the canonical Iorwerth Camp unlock.',
      ],
    },
  },
  {
    id: '2026-07-28-runelite-companion-update',
    title: 'RuneLite Companion Update',
    date: '2026-07-28',
    sections: {
      added: [
        'Connect the companion to RuneLite with one guided, copyable pairing command.',
      ],
      changed: [
        {
          text: 'The RuneLite Plugin Hub update has been approved and is now live. View the merged',
          link: {
            label: 'Plugin Hub PR #14395',
            href: 'https://github.com/runelite/plugin-hub/pull/14395',
          },
        },
        'RuneLite reads your app-authored run rules while detected gameplay events remain local to RuneLite.',
        'The complete RuneLite experience now lives in one panel with collapsible sections.',
      ],
      fixed: [
        'RuneLite controls no longer appear clipped or overlap adjacent colour settings.',
        'Run balances are now labelled Keys, Omni Keys, and Chaos Keys.',
      ],
    },
  },
  {
    id: '2026-07-26-vanilla-key-safety-valve',
    title: 'Vanilla Key Safety Valve',
    date: '2026-07-26',
    sections: {
      balance: [
        'Bosses now provide a finite, diminishing Vanilla key reserve.',
        'Brutus joins Farm Keys as a one-key early safety valve.',
        'The first three clue-earned Standard Keys share 25%, 15%, and 10% minimum chances.',
        'Standard and Chaos boss/minigame rolls now respect hard location access.',
        'The Codex now correctly explains that Vanilla area unlocks can be scattered.',
      ],
    },
  },
  {
    id: '2026-07-25-exact-skill-key-odds',
    title: 'Exact Skill Key Odds',
    date: '2026-07-25',
    sections: {
      added: [
        'Skill cards now show the exact Key chance for the next level.',
      ],
      changed: [
        'Skill level-up Key odds now use exact Level ÷ 5 values, including decimal chances such as 8.2% at level 41.',
        'Roll feedback, history, timelapses, and statistics now display Key rolls and chances to one decimal place.',
      ],
      fixed: [
        'Mode-modified rolls now show their base and effective chances clearly, and decimal roll details persist correctly after reloading.',
      ],
    },
  },
  {
    id: '2026-07-23-tracker-accuracy',
    title: 'Tracker Accuracy & Combat Powers',
    date: '2026-07-23',
    sections: {
      added: ["A What's New dialog now summarizes each player-facing release."],
      changed: [
        'Arcana is now called Combat Powers, covering spellbooks, prayers, and special combat systems such as Dwarf Cannon.',
        'Achievement Diaries now contain all 492 current tasks from the reviewed official source.',
        'Combat Achievements now contain all 646 current tasks, including the Maggot King achievements.',
        'Combat Achievement rewards now use cumulative points across every task tier.',
      ],
      fixed: [
        'Dragon Claws now list Chambers of Xeric instead of Tormented Demons.',
        'A Porcine of Interest now checks both Draynor Village and South Falador Farm.',
        'Recent quest skill, combat, prerequisite, and access requirements were refreshed.',
        'Quest and diary recommendations now respect unlocked skill-method caps as well as recorded levels.',
        'Exports now capture the run currently visible on screen.',
        'Malformed or oversized imports and backups are now rejected without overwriting progress.',
        'File imports, sync-code imports, and backup restores now report their real outcomes.',
        'Deleting a profile now also clears its local backups and profile-specific settings.',
      ],
    },
  },
] as const satisfies readonly ChangelogRelease[];

export const LATEST_CHANGELOG: ChangelogRelease = CHANGELOG_RELEASES[0];
