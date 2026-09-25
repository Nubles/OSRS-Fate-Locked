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
    id: '2026-09-25-runelite-safety-update',
    title: 'RuneLite Safety Update',
    date: '2026-09-25',
    sections: {
      changed: [
        'The RuneLite guide describes the plugin\'s safety update. Strict Mode stops only travel to places your rules prove locked, never walking, NPC, object, bank or equipment clicks, and says whether it is Active, Paused, Off or Inactive, and why.',
        'The guide also covers the plugin\'s quieter warnings: no chunk chat in places the tracker hasn\'t mapped, such as dungeons, and one warning sound as you enter locked ground. Connecting says Confirm in browser while it waits for you.',
      ],
      fixed: [
        'The Roll Inbox no longer says it is listening for RuneLite, which can\'t send it detections yet. Log level-ups, quests and diaries yourself for now.',
      ],
    },
  },
  {
    id: '2026-09-24-saves-keys-and-planners',
    title: 'Safer Saves, Fairer Keys and Accurate Planners',
    date: '2026-09-24',
    sections: {
      fixed: [
        'Resetting, importing or restoring a run no longer shows the recovery screen on every later visit. Earlier checkpoints stay restorable.',
        'Importing or restoring a save no longer splices in history from the run it replaces, or breaks the history check of saves made before history checks existed.',
        'Long runs can export and re-import their .fate backup again; saves above about 2 MB were refused. Saves with an unusual game-mode value load as Vanilla instead of crashing, and runs saved during an Aquarium reveal load again.',
        'Oracle search no longer runs a developer check that could replace your run with test data when you searched for "test", and its area status shows your mode\'s real starting area.',
        'First-run setup fits phone screens, so Next stays reachable, and the game-mode choice now appears before What\'s New. Players still owed the legacy Fate compensation see its choices at the top of What\'s New instead of being unable to close it.',
        'One Omni-key can no longer pay for two unlocks. Buying Clarity while Greed is waiting, or the reverse, no longer overwrites the first buff, and rituals you cannot afford are refused.',
        'Levelling a skill already at 99 no longer rolls for a reward, and Auto-Roll stops levelling skills after you leave its tab.',
        'Cartographer offers up to three frontier chunks and keeps the same offers until your run changes. History checks no longer mistake a charted Chaos Temple chunk for a Ritual of Chaos.',
        'The Codex now matches the game for Omni-key odds, its worked quest example, Storage, roll precision and the Chunked Sailing frontier, and no longer presents retired modes as current.',
        'Level-1 skilling diary tasks, such as the Gnome Stronghold lap and baking bread, need the skill unlocked before they count as doable. The Wilderness Easy Chaos Runecrafting temple task needs Enter the Abyss when reached through the Abyss.',
        'Champions\' Guild readiness can reach Ready once Varrock is unlocked, and Combat Achievement reward chips recognise the bosses you own.',
        'The Boss Planner and DPS Calculator count ammunition strength only for weapons that fire it, keep hit chance between 0% and 100%, and round prayer and magic bonuses as the game does. The 10% Attack and Strength prayers are labelled Improved Reflexes and Superhuman Strength.',
        'Monster max hits use the largest listed hit, so Tormented Demons, Dusk, Shellbane gryphons and other multi-attack bosses no longer read as low danger.',
        'The DPS Calculator uses the exact monster version you pick. Versions that share a game ID, such as Awakened Duke Sucellus, previously calculated against another version.',
        'Goal plans no longer count a quest\'s own Quest Points, or those of quests that need it first, toward its Quest Point requirement.',
        'The Quest Journal area filter lists every quest the chosen area gates. Choosing Varrock previously hid quests such as Demon Slayer and Rune Mysteries.',
        'The Cook\'s Assistant guide no longer marks later steps as needing checking because of items collected in earlier steps.',
        'Diary tasks that need an item, such as an axe, the Muddy key or Raiments of the Eye pieces, now ask you to confirm you have it instead of assuming you do.',
        'In RuneProof guides, confirming an item you already have completes only the steps that make it. Having an egg no longer ticks off the milk steps in Cook\'s Assistant, and having balls of wool no longer ticks off asking Fred for work.',
        'Timelapse shows replay notes as warnings rather than broken integrity and uses your mode\'s pity threshold. Chunked quest doability starts from the free starting chunk, so a new Chunked run no longer shows every quest as stranded.',
        'Discord announcements no longer repeat unlocks that arrive with an imported save or sync code, and keep working after a save made on a device with a wrong clock.',
        'Collection Log prices recover after a failed price download, a full browser storage no longer crashes the app from the Roll Inbox, and feature reveal messages no longer repeat when storage is full.',
        'Skill cards respond to Enter and Space, the guided tour no longer skips a step when Enter presses Next, and the Codex and Timelapse close buttons are labelled for screen readers.',
        'Auto-Roll errors and legacy mode descriptions no longer show garbled characters. Share text uses the Fate Locked Ironman name, and unlock sharing only reports a copy when it succeeds.',
        'Taking over saving from another tab keeps your progress on the next visit; the other tab\'s older save could replace it. A tab that gets saving back after the other tab closes loads that tab\'s newer progress, or asks which to keep if it has unsaved changes of its own.',
        'If the browser\'s recovery storage cannot be opened, startup offers Try again, Continue with browser save and Export browser save instead of staying closed.',
        'A tab restored with the browser\'s Back button can no longer write back a profile that was deleted in another tab.',
        'A RuneLite pairing belongs to the profile you paired. A tab showing another profile no longer publishes over it, and pairing or disconnecting in one tab applies to every tab.',
        'RuneLite is no longer sent a profile with empty rules when game data fails to load: the error shows with Retry and the last complete profile stays. A stalled send fails after 15 seconds instead of showing Sending… forever, and the pairing dialog can be closed after a failed send.',
        'RuneLite and the stream overlay pick up a profile published again after a day without publishing, instead of keeping the old one. The overlay ignores malformed or oversized updates instead of going blank, and follows the relay the app publishes to.',
        'The Equipment Lab\'s slot details and the DPS monster picker open over the whole screen instead of inside the Dashboard panel.',
        'A second unlock or achievement reveal gets its full time on screen instead of closing early.',
        'Keyboard focus stays put in Roll Inbox review choices, sync-code tabs and History filters. The guided tour keeps focus inside its card and returns it when the tour ends.',
        'Jumping to a quest or diary from a prerequisite chip or Next Best clears the filters and searches that would hide it.',
        'Wiki images that failed to load are tried again after a week instead of never.',
        'The Boss Planner assumes only the attack prayers you can use: Piety, Chivalry and Rigour need their Arcana unlock and levels, otherwise it uses the best lower prayer, and the plan names the prayer and potion it assumed. Monsters whose max hit isn\'t listed show Unknown danger instead of Low, kill times round correctly (2m 0s, not 1m 60s), and Magic accuracy matches the OSRS Wiki DPS calculator.',
        'The Frontier Advisor counts quests and diaries that need an exact chunk, and no longer ranks a chunk\'s content above reaching a new area. The Skill Advisor no longer suggests training a locked skill, and the Fate Forecast\'s key pace counts the gaps between keys, so its forecasts are no longer optimistic.',
        'Goal plans suggest a Skills key only when your tier caps the skill, turn quest locations into the areas (or, in Chunked, the chunks) that unlock them instead of place names such as North Taverley, and list skill steps from A to Z. A pinned quest\'s route shows its real progress instead of 0%.',
        'Warriors\' Guild readiness uses your tier-capped levels, matching its Falador diary task.',
        'RuneProof shows an error with Retry and Reload when its guides fail to load, instead of an empty quest list. Its other sources list the ones you can use before those behind a locked chunk, and keep a building\'s interior sources apart from those outside it. Sources in the Warriors\' Guild basement and Misthalin Manor are no longer shown as free to reach.',
        'Share cards, sync-code previews and Timelapse check a run\'s Fate against its own mode, so runs with pity off no longer show a replay warning, and the share card shows your mode\'s pity threshold. Its map colours each chunk by the area it belongs to, so Vanilla area unlocks show.',
        'The Void Gambit\'s minimum stake is the same in the Altar and the game in every legacy mode.',
        'Legacy Xtreme Start runs can roll the Misthalin areas they start without, such as Varrock, and Spend Keys, completion, the Codex and World Tour count them. Chunked runs can earn the area achievements for the areas their chunks reach.',
        'Enter the Abyss\'s Wizards\' Guild route needs Magic 66, the guild\'s entry level, and goal plans include that step. In Chunked runs, goal plans reach areas by unlocking any of their chunks.',
        'Roll Inbox entries follow the rules for completing the same thing by hand: progress already recorded, locked content and spent boss reserves pay nothing, a detected level-up pays the same start-area milestone keys, and Brutus kills are recognised.',
        'With the same profile open in two tabs, only the tab that is saving publishes to RuneLite, so an older tab can no longer send outdated unlocks.',
        'The Next Best menu closes when you click anywhere outside it or press Escape. Loading a tab dims only that tab, with animations on or off, and chunk details offer Retry if their data stops loading instead of loading forever.',
      ],
      added: [
        'The Boss Planner has a version picker for bosses with several versions, such as post-quest and Awakened fights or boss phases. It starts on the post-quest, normal or solo fight, or the opening phase, and remembers your choice on this device.',
      ],
      balance: [
        'Quest difficulties now match the official OSRS ratings. At First Light is Novice, Recipe for Disaster\'s Sir Amik Varze and King Awowogei parts are Master, and its finale is Grandmaster, so their key odds change to match.',
        'New Chunked runs no longer get a free key on their first level-up. While still in the start chunk, the first guaranteed key comes at total level 50, then every 25 levels. Existing runs keep their current schedule.',
      ],
      changed: [
        'Spend Keys cards show Blocked when a table\'s remaining unlocks are out of reach instead of offering a roll that cannot happen. Chunked no longer reads Done while land reached by Sailing remains, and Housing no longer counts the retired Aquarium.',
        'While one Void Altar buff is waiting, the other buff is disabled with an explanation.',
        'The RuneLite pairing dialog no longer says RuneLite requested the connection, since any website can open a pairing link. It asks you to continue only if you just pressed Connect tracker in RuneLite.',
        '"Export encrypted save" is now "Export save file (.fate)". The file was never encrypted, so the menu and the export message now say that anyone you share it with can read it.',
        'RuneLite updates are sent once your changes pause for a few seconds, at least once a minute during nonstop play, and straight away when you switch away from the tab, instead of after every action.',
        'The app\'s first download is about 10% smaller: onboarding, the command palette, the altar and other on-demand screens load when first needed.',
        'The Region Advisor ranks single areas you can roll instead of whole continents, and the Quest Advisor opens faster.',
      ],
    },
  },
  {
    id: '2026-09-24-unlocks-and-guide-saves',
    title: 'More Accurate Unlocks, Clearer Guides and Reliable Saves',
    date: '2026-09-24',
    sections: {
      fixed: [
        'Vanilla Doable, the Quest Journal and goal plans now use consistent area and requirement checks, including the Neck Tier 1 unlock for The Restless Ghost. Alternative routes and conditions needing confirmation stay visible.',
        'Achievement Diary suggestions and completion now check required equipment, travel, spell and shop unlocks, including Draynor rooftop Agility and Thessalia\'s Clothes Shops permission. Valid alternatives and exceptions are preserved.',
        'Sheep Shearer requires Crafting to spin wool, or confirmation that you already have 20 permitted balls of wool. Owned supplies can skip preparation without bypassing later quest requirements.',
        'Corrected known quest, Slayer, activity, farming and housing requirements, including partial quest milestones, prerequisite quests and alternative entry routes.',
        'All four basic elemental staves are Tier 1, and White Knight equipment shares Tier 2 with black. Reviewed material, cosmetic, ammunition and equipment-family variants now use consistent tiers; steel remains Tier 2.',
        'Combat tools use corrected magic-damage units, preserve light, standard and heavy ranged defence, apply each melee potion boost to its own skill, and include magic prayer damage.',
        'The Boss Planner and DPS Calculator offer attacks and stances supported by your equipped weapon. Weapons awaiting attack-option review show a checking message instead of a misleading estimate.',
        'Resource plans check ingredient access and skill caps, use corrected recipes and potion doses, and distinguish raid-only supplies. Training advice and its guide links have been reviewed.',
        'Banks, shops and activity access preserve their quest, diary and local entry requirements. Recognized merchant services, transport locations and resource map links have been corrected; unknown access stays marked for review.',
        'Guide item and step checks now travel with profile backups. Restoring an earlier save restores its guide progress too, and failed saves or competing tabs use the normal recovery controls.',
        'New Collection Log drops remain usable even when a browser retains older item mappings. Entries already identified as ambiguous keep their protection through backup, restore and transfer to another browser, while original counts are preserved.',
        'Run-history checks account for ritual changes and valid low rolls. New seeded runs are independent of generated IDs and timestamps; existing seeded runs retain their original algorithm.',
        'Restored legacy mode rules, included Sailing in automatic rolls, corrected Combat Achievement filters, and prevented outdated profile exports from overwriting a newly selected run.',
        'Share cards use the same completion percentage as the dashboard. Retired Aquarium no longer blocks 100%, Quest Cape achievements exclude optional miniquests, and the journal no longer celebrates while quests or diary rewards remain.',
        'Quest search totals match the filtered list. Share cards fit phone screens, retain keyboard focus, use a stable run ID and explain history checks as local checks with any replay warnings.',
        'Map share cards support current and older saved layouts, restore unlock colouring, and wait for the map to draw before exporting. Failed rendering offers a retry.',
        'Map content retains interior diary tasks, clue steps and ground spawns, with corrected entrances, Aldarin coverage, Family Crest locations and quest-start markers. Map and RuneLite permissions preserve pending confirmations, boss requirements and separate interior unlocks.',
        'Chunked ownership and reachability use the correct area and free starting chunk; farming tree patches use their own unlock. These corrections do not change Vanilla into a connected-chunk mode.',
      ],
      changed: [
        'RuneProof\'s five public guides now use one ordered walkthrough with an illustrated Still needed summary, named places and map links. Supporting details and coordinates are optional, and guide checkmarks remain separate from Journal completion and rewards.',
        'Game content, feature icons, rivals and milestones use OSRS Wiki artwork in place of emoji and generic artwork, with matching imagery across navigation, planners and achievements.',
        'Equipment and monster catalogues ship with each app version, so combat tools no longer depend on separate live downloads. Equipment variants and existing equipped item IDs are preserved.',
        'RuneLite equipment permissions include reviewed tiers only. Unreviewed estimates remain labelled in the gear browser and no longer create definitive in-game equipment warnings.',
        'Older ritual logs that lack exact costs are labelled as estimates. New ritual records retain their actual costs and rewards.',
        'Collection Log updates detect new items without inventing saved progress IDs. New entries await a reviewed app update, while historical records remain preserved for review.',
        'Manual online refresh requests a fresh Wise Old Man snapshot before reading the player data.',
      ],
    },
  },
  {
    id: '2026-09-21-content-and-access',
    title: 'More Complete Content and Access Checks',
    date: '2026-09-21',
    sections: {
      added: [
        'Interior shops, monsters, resources and quest stages now appear at their entrances, with access requirements preserved.',
        'Additional entrances cover the gorilla caves, Lumbridge cave network, Waterbirth, Brimhaven, the Temple of Light and rune essence teleports.',
        'Added A Ruff Situation, Crab Quest, nine Mad Angel combat achievements, and the latest collection-log drops.',
        'The merchant directory includes tanning, taxidermy, decanting and pet adoption services, plus missing reward-shop inventories.',
        'Keldagrim and the Blast Furnace now have a bank unlock at their surface entrance. Interior bank access retains its entry requirements.',
      ],
      fixed: [
        'Shop access now checks quest and location requirements consistently in the directory, chunk panels and RuneLite permissions. The Mad Angel uses its boss unlock.',
        'Quest stages distinguish permanent access from rooms that close after completion. Untracked payments, current Slayer assignments and deeper-dungeon doors remain unverified.',
        'Slayer locations recognise monster families and retain location-specific assignments. Unverified access is shown as needing review.',
        'Moved Venator collection-log entries retain their original progress and reward identity. Duplicate saved entries merge without adding their counts together.',
        'Failed shop and Slayer content loads now offer a retry. Content checks report unavailable sources and new quests instead of a false all-clear.',
      ],
      changed: [
        'In Chunked mode, completing Pandemonium and unlocking Sailing adds offshore land and documented boat landings to the frontier. The 624 land unlocks stay the same; ocean navigation does not spend a land unlock.',
        'Removed historical shop inventories from active sources and labelled shops with no default stock. Item-source coverage remains partial wherever the source data cannot prove completeness.',
      ],
    },
  },
  {
    id: '2026-09-12-unlock-consistency',
    title: 'Unlocks Stay Consistent',
    date: '2026-09-12',
    sections: {
      fixed: [
        'Random unlocks and their key cost are saved before the result appears. Reloading resumes the same reveal; Accept Destiny never charges twice.',
        'The Strategy Guide preserves quest requirements, parent unlocks and diary gates. Activity cards show combat, Quest Point and external entry requirements.',
        'Forecast and goal odds use the current eligible roll pool. Chunked territory now counts toward run completion and rival comparisons.',
        'Resource inventory and plans stay with their own run. Unverified sources and access requirements no longer silently count as available.',
        'Bank-name searches and Collection Log page aliases work correctly, and synchronized log totals refresh together.',
        'Chunked location checks now require the exact chunk, legacy parent unlocks agree across panels, and Wilderness diary tasks check the actual activity locations.',
        'Corrected transport, prayer, farming, housing and storage requirements, improved phone controls, and added keyboard access to unlock and Collection Log actions.',
      ],
      changed: [
        'Tutorial Island is free onboarding and no longer costs an area unlock. Existing purchases are refunded automatically.',
        'Khazard Battlefield and Chaos Altar have their own area unlocks. Existing owners keep access to the locations previously bundled with Port Khazard and Chaos Temple.',
        'Generic region terrain now explains its completion requirement and lists the remaining area unlocks.',
        'Collection Log unlock coverage now clearly describes source ownership; check activity readiness before attempting content.',
        'Older shared resource plans can be copied into the run you choose from the Resource Engine.',
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
