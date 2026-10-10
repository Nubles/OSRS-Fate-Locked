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

/*
 * How to write a What's New entry. Players read these in the app and in the
 * Discord's #updates channel, so write them like a person posting an update,
 * not like release documentation. data/changelog.test.ts checks the limits.
 *
 * - Title: a few words in normal sentence case, like a forum post subject.
 *   "Pandemonium and the open sea", not "Pandemonium and the Shipyard Open
 *   the Way You Reach Them". 50 characters at most.
 * - One short line per bullet (160 characters at most) saying what changed
 *   for the player. Lead with the thing they'll notice.
 * - Skip the backstory: no "Before, it did X because Y", no how it was built.
 * - Plain words and contractions ("you're", "doesn't"). No em dashes.
 * - Six bullets at most. If there's more, keep what players will notice and
 *   drop the rest.
 * - Put the newest entry first and set LATEST_CHANGELOG_ID in
 *   data/changelogLatest.ts to its id.
 */
export const CHANGELOG_RELEASES = [
  {
    id: '2026-10-09-pandemonium-route',
    title: 'Pandemonium and the open sea',
    date: '2026-10-09',
    sections: {
      fixed: [
        'RuneLite no longer shows the sea, The Pandemonium and the Shipyard as Locked while you’re doing Pandemonium.',
        'Finished Pandemonium with Sailing and Port Sarim? The whole open sea is unlocked now, not just the bit by Port Sarim.',
        'The Shipyard is part of the sea now, not the Isle of Souls, so it unlocks with Sailing. Land total goes from 624 to 623.',
      ],
    },
  },
  {
    id: '2026-10-09-forgotten-cemetery-routes',
    title: 'More ways into the Forgotten Cemetery',
    date: '2026-10-09',
    sections: {
      fixed: [
        'Forgotten Cemetery plus Dark Warriors’ Fortress counts as a way in again, so the Ankou Diary task shows as doable.',
        'Dareeyak Teleport counts too. It lands just south of the cemetery.',
      ],
    },
  },
  {
    id: '2026-10-08-cut-off-chunks',
    title: 'Two chunks moved to their way in',
    date: '2026-10-08',
    sections: {
      changed: [
        'Auburn Valley Path is part of Darkfrost now, not Auburnvale. You can only walk into it from Darkfrost.',
        'Crash Site Cavern is part of the Barbarian Outpost now, not the Tree Gnome Stronghold, for the same reason.',
      ],
    },
  },
  {
    id: '2026-10-08-discord-feed-roles-area',
    title: 'Discord: live unlocks, roles and /area',
    date: '2026-10-08',
    sections: {
      added: [
        'Link your run in the Discord and your unlocks get posted in #live-unlocks. You also get your mode role, plus milestone roles as you go.',
        '/area tells you what an area unlocks, which quests need it, its banks and how to get there.',
        '/report sends a bug straight to us. /unlink turns the feed and roles off.',
      ],
    },
  },
  {
    id: '2026-10-08-walking-routes',
    title: 'Routes follow ground you can walk',
    date: '2026-10-08',
    sections: {
      fixed: [
        'Owned land next to owned land doesn’t count as connected any more if a river, cliff or wall is in the way.',
        'The eagles need Eagle Transport and the Keldagrim mine carts need Mine Carts before they count as a way to travel.',
        'RuneLite says Not ready (not Unlocked) for places you can’t reach yet, like Kourend or Varlamore without the boat. No plugin update needed.',
      ],
    },
  },
  {
    id: '2026-10-08-runelite-tiers-unlocks-outlines',
    title: 'Coming to RuneLite: tiers, unlocks, outlines',
    date: '2026-10-08',
    sections: {
      added: [
        'Next plugin update: trees, rocks and fishing spots your tier can’t use yet say (Locked), and clicking one tells you the tier you need.',
        'New unlocks get named in chat, shown in a banner, and glow gold on the world map until you visit. Announce new unlocks turns it off.',
        'Nearby banks, shops, skilling spots and monsters get outlined: red is locked, orange needs a higher tier, green is open.',
      ],
    },
  },
  {
    id: '2026-10-08-map-in-between-chunks',
    title: 'In-between land joins its areas',
    date: '2026-10-08',
    sections: {
      changed: [
        '77 bits of land that belonged to no area now unlock with the area next to them. Only Lucien’s Camp and Rock Island Prison are left out.',
        'Rellekka brings Ungael, the Island of Stone, the Cold War icebergs and the Fremennik Province. Vorkath needs Rellekka now.',
        'Ralos’ Rise, Tlati Rainforest, Auburnvale and East Ardougne pick up the land around them, like the Gemstone Crabs and Jorral’s Outpost.',
        'Wilderness: Chaos Temple brings the Bone Yard and Escape Caves, so Callisto, Venenatis and Vet’ion need it. The cape shops go with their nearest area.',
        'Desert: the Bandit Camp brings Jaldraocht Pyramid and the Desert Quarry. The Chasm of Fire is part of Shayzien now, so Yama needs Shayzien.',
        'You keep everything you own. Owning all of Kandarin or Kourend just no longer unlocks the Fremennik Province or the Custodia Pass.',
      ],
    },
  },
  {
    id: '2026-10-07-wilderness-boss-chunks',
    title: 'Wilderness bosses unlock with their areas',
    date: '2026-10-07',
    sections: {
      changed: [
        'The Crazy Archaeologist’s ruins unlock with Forgotten Cemetery instead of waiting for the whole Wilderness.',
        'The Chaos Fanatic now needs Lava Maze, and Artio and Spindel need Graveyard of Shadows, next to Calvar’ion.',
        'The Dareeyak Ruins come with Forgotten Cemetery, so the Trollheim shortcut and Crazy Archaeologist Diary tasks ask for that.',
        'You keep everything you already own.',
      ],
    },
  },
  {
    id: '2026-10-07-roll-data-audit',
    title: 'Requirements checked against the Wiki',
    date: '2026-10-07',
    sections: {
      fixed: [
        'Callisto, Venenatis and Vet’ion need the Medium Wilderness Diary or their Slayer task, like their lairs do in game.',
        'Morytania bosses need Priest in Peril, and the Colosseum and Hueycoatl need Children of the Sun.',
        'Zalcano needs 70 Mining and Smithing, Nex needs Desert Treasure I, and Phosani’s Nightmare no longer needs a Nightmare kill first.',
        'Lots of minigame, shortcut and skill levels corrected, like the Sorceress’s Garden, Puro-Puro and the Colossal pouch (25 Runecraft).',
        'The Spice Pouch is gone from Storage since it isn’t a real item. If you rolled it you keep it, but it doesn’t count toward completion.',
        'At First Light rolls as an Intermediate quest now, matching the Wiki.',
      ],
    },
  },
  {
    id: '2026-10-07-steady-unlock-reveal',
    title: 'Unlock rolls stay put',
    date: '2026-10-07',
    sections: {
      fixed: [
        'Rolling an unlock no longer blanks the page, shows the reveal twice or jumps you back to the top.',
      ],
    },
  },
  {
    id: '2026-10-07-discord-progress',
    title: 'Show your run in the Discord',
    date: '2026-10-07',
    sections: {
      added: [
        'Discord notifications has a new Fate Locked Discord section. Get a link code, then type /link with it in the Discord.',
        'Once linked, anyone can check your run with /progress. It shows your mode, land, quests, diaries, CAs and last five unlocks.',
        'Your save never leaves your device. Stop sharing removes the summary, and /unlink removes the link.',
      ],
    },
  },
  {
    id: '2026-10-07-journal-quest-count',
    title: 'Ready quests counted once',
    date: '2026-10-07',
    sections: {
      fixed: [
        'The Dashboard’s Journal summary matches the Quest Log now, so quests you can’t reach don’t count as ready.',
        'Miniquests get counted separately, like “6 quests and 3 miniquests ready”.',
      ],
    },
  },
  {
    id: '2026-10-07-corsair-cove-foundry-bank',
    title: 'Corsair Cove by boat',
    date: '2026-10-07',
    sections: {
      fixed: [
        'Captain Tock’s ship from Rimmington counts as a way to Corsair Cove.',
        'The Giants’ Foundry bank chest has its proper name now (it was called Desert Battlefield). You keep it if you had it.',
      ],
    },
  },
  {
    id: '2026-10-03-pet-omni-keys',
    title: 'Pets give an Omni-Key and follow you',
    date: '2026-10-04',
    sections: {
      balance: [
        'The poll has spoken: each new pet gives an Omni-Key instead of a Key. Each pet only counts once.',
        'Claiming a pet isn’t a roll, so your Fate stays put and Clarity or Greed waits for your next real roll.',
      ],
      added: [
        'Farm Keys → Activities has a New Pet card. Search for the pet by name or where it’s from (“vorkath”, “cox”) and claim it.',
        'Logged pets before this? What’s New asks you to name them so each gets its Omni-Key, and you pick what’s fair in return.',
        'Your newest pet follows you around in 3D in the bottom-left corner. Click its name to see all your pets.',
        'RuneLite puts new pets in its Roll inbox with a chat reminder. Paste it into the tracker and pick which pet it was.',
      ],
    },
  },
  {
    id: '2026-10-04-slayer-cave-ankou',
    title: 'Diary places checked against the Wiki',
    date: '2026-10-04',
    sections: {
      fixed: [
        'Every Diary task’s locations were checked against the Wiki, and more spots count now, like the Abyss for rune altars.',
        'The Ankou task counts the Wilderness Slayer Cave too, so Chaos Temple is enough.',
        'A few tasks pointed at the wrong place and point at the right one now, like the Trollheim shortcut and the crystal-bow elves.',
        'RuneLite stops adding kills of a Vanilla boss that’s out of Keys to your Roll inbox.',
      ],
      changed: [
        'Diary tasks with a choice of ways list each one and what it still needs when you hover them.',
        'The Waka canoe, temple trek and Snowy Hunter eagle need both ends now. Tasks you’ve ticked stay ticked.',
      ],
    },
  },
  {
    id: '2026-10-02-paste-from-runelite',
    title: 'Paste from RuneLite',
    date: '2026-10-02',
    sections: {
      added: [
        'The Roll Inbox has a Paste from RuneLite button. Hit Copy for tracker in RuneLite, paste it in, and roll when you’re ready.',
        'RuneLite has a World map borders setting: show your unlocked outline, the chunk grid, both or neither.',
      ],
      changed: [
        'Logging by hand still works the same. Just skip anything you’ve already logged.',
      ],
      fixed: [
        'Strict Mode’s description now says everything it blocks, including teleport types you haven’t unlocked.',
        'Locked-area alerts send a RuneLite notification when you’ve turned that on, not just when the sound plays.',
        'RuneLite’s progress percentage matches the area count next to it.',
      ],
    },
  },
  {
    id: '2026-10-02-online-backup',
    title: 'Online backup',
    date: '2026-10-02',
    sections: {
      added: [
        'Sync Code → Online keeps an encrypted copy of your run, so clearing your browser doesn’t lose it. It backs up as you play.',
        'Your backup code is the only way in. Save it somewhere safe, nobody (us included) can reset it.',
        'To get a run back on any browser, go to Sync Code → Online → Restore a run and enter the code.',
        'The tracker asks once if you want backup on. Not now means it won’t ask again.',
      ],
      changed: [
        'The export reminder stays quiet while you have an online backup from the last week.',
      ],
    },
  },
  {
    id: '2026-10-02-plain-rules',
    title: 'Rules and help that match the game',
    date: '2026-10-02',
    sections: {
      fixed: [
        'The Rules page says what you really start with: 3 Keys and all of Misthalin (one Lumbridge chunk in Chunked).',
        'Chaos Keys, Omni-Keys and every way to earn a Key are explained properly now.',
        'Vanilla bosses aren’t called repeatable any more. Each pays 1 to 3 Keys, then stops.',
        'Smart Play stopped telling you to save Fate, since any successful roll resets it.',
      ],
      changed: [
        'The Rival is out for now. If you set one up it stays in your save.',
        'Plainer wording all over the tracker, and the Rules page explains how Vanilla and Chunked differ.',
      ],
    },
  },
  {
    id: '2026-10-02-diary-unlock-gates',
    title: 'Diary tasks need guilds, patches and rooms',
    date: '2026-10-02',
    sections: {
      fixed: [
        'Diary tasks inside a guild need that guild unlocked first, like the Magic Guild or the Woodcutting Guild redwoods.',
        'Tasks that use a farming patch need that patch, like the Catherby limpwurt needing the Flower patch.',
        'Tasks in your house need the room or mount they use, like the Menagerie for the pet rock.',
        'This only changes what the Journal calls doable. You can still log any task by hand.',
      ],
    },
  },
  {
    id: '2026-10-02-diary-accuracy',
    title: 'Diary tasks checked against the game',
    date: '2026-10-02',
    sections: {
      fixed: [
        'Morytania tasks need Priest in Peril, so “Kill a Ghoul” isn’t doable at the start of a run any more.',
        'Tasks that named the wrong area point at the right one, and trips like boats and carpets need both ends.',
        'Tasks that use a shop, minigame or boss need it unlocked, like Sbott’s tanning or the fire cape.',
        'Zanaris tasks need a dramen or lunar staff equipped. Tasks needing part of a quest no longer ask for all of it.',
      ],
    },
  },
  {
    id: '2026-10-02-quest-areas',
    title: 'Quests ask for every place they need',
    date: '2026-10-02',
    sections: {
      fixed: [
        'Quests need every area their steps happen in, so they don’t show as ready before you can reach it all.',
        'Some quests asked for the wrong area and ask for the right one now, like Enakhra’s Lament and The Grand Tree.',
        'Quests that need a shop-only item need that shop, like Clothes Shops for Prince Ali Rescue’s pink skirt.',
        'Some quests accept a choice of routes now, like What Lies Below’s three ways to the Chaos Altar.',
        'You can still complete any quest by hand.',
      ],
    },
  },
  {
    id: '2026-10-02-shops-and-guilds',
    title: 'Shops, guilds and banks match the game',
    date: '2026-10-02',
    sections: {
      fixed: [
        'Farming Guild patches open at their real levels: 65 Farming for most, 85 for the fruit tree, spirit tree, celastrus and redwood.',
        'Banks inside guilds need the guild, and quest-locked banks like Shilo Village and Lletya need their quest.',
        'Trees, rocks, stalls and fishing spots open at the game’s levels, and shops are sorted under what they actually sell.',
        'Mine Carts no longer needs The Giant Dwarf. Keldagrim still does.',
      ],
      added: [
        'Ten shops the map was missing, like Kjut’s Kebabs, Dusuri’s Star Shop and the Barbarian Assault reward shop.',
      ],
    },
  },
  {
    id: '2026-10-02-slayer-rewards',
    title: 'Slayer rewards add their tasks',
    date: '2026-10-02',
    sections: {
      fixed: [
        'Slayer rewards that add a task, like Seeing Red or Watch the Birdie, now add it to the Slayer panel and RuneLite.',
        'Tasks no longer say “access needs review” for something the task itself already covers.',
      ],
      added: [
        'Buy Like a Boss and Konar, Nieve, Duradel and Krystilia can give boss tasks for bosses you’ve unlocked.',
      ],
    },
  },
  {
    id: '2026-10-02-ritual-of-greed',
    title: 'Greed pays on an Omni-Key too',
    date: '2026-10-02',
    sections: {
      balance: [
        'The Ritual of Greed gives 2 Keys on an Omni-Key roll as well, instead of getting used up for nothing.',
      ],
      fixed: [
        'Greed’s description explains what happens on a Pity Key fail and with a Vanilla boss that has 1 Key left.',
      ],
    },
  },
  {
    id: '2026-10-02-slayer-tasks',
    title: 'Slayer tasks ask what the masters ask',
    date: '2026-10-02',
    sections: {
      fixed: [
        'Slayer tasks ask for the other levels the masters do, like 20 Defence for basilisks and 50 Magic for cave krakens.',
        'Krystilia’s abyssal demon, dust devil, jelly and nechryael tasks need I Wildy More Slayer.',
        'A few wrong levels fixed, like basilisks needing 40 Slayer from Vannaka and Mortimer.',
      ],
    },
  },
  {
    id: '2026-10-02-boss-fights',
    title: 'Boss fights need their boss',
    date: '2026-10-02',
    sections: {
      fixed: [
        'Monsters that are part of a boss fight count as that boss now, like the Dagannoth Kings, Barrows brothers and Jad.',
        'Artio and Spindel need the hard Wilderness Diary or their Slayer task, same as Calvar’ion.',
        'Galvek is off the Bosses table since you only fight him once. If you unlocked him you get the Key back.',
        'Combat Achievements show where to fight for 179 more tasks, and say “Boss not unlocked” when you don’t have it.',
      ],
    },
  },
  {
    id: '2026-10-02-map-areas',
    title: 'Places join the area they’re in',
    date: '2026-10-02',
    sections: {
      fixed: [
        'Places left outside every area belong to the area they’re in now, like the Giants’ Foundry and Kraken Cove.',
        'The Fremennik Slayer Dungeon unlocks with Mountain Camp instead of needing all of Kandarin.',
        'Boss and minigame rolls need the area their entrance is in, like the Corporeal Beast needing Chaos Temple.',
        'Two bank unlocks that didn’t open any bank are gone. If you already had the bank they lead to, you get the Key back.',
      ],
    },
  },
  {
    id: '2026-09-29-stranded-areas',
    title: 'Places you can’t reach yet',
    date: '2026-09-29',
    sections: {
      fixed: [
        'The Diary Journal won’t call a task doable in an owned area you can’t get to. Unlocked transport like fairy rings counts.',
        'The Quest Log says “No route to” for owned places you can’t reach, instead of “Ready to complete”.',
        '12 Diary tasks point at the right area now, like mining clay at the Ruins of Uzer.',
        'Map chunks that aren’t part of any area say there’s nothing to unlock, instead of asking you to unlock them.',
      ],
      changed: [
        'The Rules page explains the challenge in plainer words.',
      ],
    },
  },
  {
    id: '2026-09-29-roll-inbox-groundwork',
    title: 'Getting ready for RuneLite’s Roll Inbox',
    date: '2026-09-29',
    sections: {
      added: [
        'The RuneLite sync sends boss, quest and diary names ready for the next plugin update. The current plugin ignores them.',
      ],
      changed: [
        'The Roll Inbox is ready for RuneLite to fill it. Logging by hand, rolling and spending Keys work the same.',
      ],
    },
  },
  {
    id: '2026-09-29-group-ironman-titles',
    title: 'Group ironman titles',
    date: '2026-09-29',
    sections: {
      fixed: [
        'Group irons can pick their title on Sync & Roll when Wise Old Man calls them Regular. It’s remembered per character.',
      ],
      changed: [
        'Every ironman title on Sync & Roll shows its chat badge.',
      ],
    },
  },
  {
    id: '2026-09-28-runelite-guide-redesign',
    title: 'RuneLite guide redesigned',
    date: '2026-09-28',
    sections: {
      changed: [
        'The RuneLite guide is now twelve short chapters, with contents that follow you as you read.',
        'Its pictures come straight from the plugin, with numbered notes beside them. Hover a note to light up its part.',
      ],
    },
  },
  {
    id: '2026-09-28-runelite-sidebar-and-display',
    title: 'New RuneLite sidebar and display',
    date: '2026-09-28',
    sections: {
      added: [
        'The RuneLite plugin has a new sidebar with a status card up top telling you if your rules are current.',
        'Locked land shows as fog on the world map and minimap, and locked areas alert you once instead of every chunk.',
        'The Here card lists what’s around you. Click something and the game’s arrow points you to the nearest one.',
      ],
      changed: [
        'All settings live under Fate Locked Ironman in RuneLite’s config, with colour-blind safe colours. Your old choices carry over.',
        'The RuneLite guide is rewritten to match.',
      ],
    },
  },
  {
    id: '2026-09-28-void-gambit-payout',
    title: 'Void Gambit pays per minimum stake',
    date: '2026-09-28',
    sections: {
      fixed: [
        'A won Void Gambit pays 1 Key per minimum stake for your mode: 1 per 9 Fate in Casual, 1 per 23 in Hardcore.',
        'The Void Altar and the Codex show the price. Vanilla and Chunked are unchanged.',
      ],
    },
  },
  {
    id: '2026-09-27-runelite-update',
    title: 'RuneLite plugin update',
    date: '2026-09-27',
    sections: {
      added: [
        'The plugin takes its answers from the tracker now, so the sea and dungeons have lock states and the HUD says why a chunk is locked.',
        'Strict Mode knows every teleport and blocks ones that go to a locked place. Fairy rings, charters and boats are never blocked.',
      ],
      changed: [
        'The RuneLite guide matches the current plugin.',
      ],
    },
  },
  {
    id: '2026-09-27-fate-analytics',
    title: 'Fate Analytics redesigned',
    date: '2026-09-27',
    sections: {
      changed: [
        'Fate Analytics opens with your luck in plain words: a verdict, how far ahead or behind the odds you are, and a luck meter.',
        'Every chart has a plain title and a one-line takeaway, and the activity calendar is a weekly heatmap.',
        'The Fate Report has a Copy summary button for sharing.',
      ],
      fixed: [
        'Patterned bars and donut slices show up properly now.',
      ],
    },
  },
  {
    id: '2026-09-27-diary-bosses-and-routes',
    title: 'Diary tasks check bosses and routes',
    date: '2026-09-27',
    sections: {
      fixed: [
        'Diary tasks in an owned area you can’t get to show “No route to” instead of Can do.',
        'Diary tasks that mean fighting a boss need that boss unlocked, like the Giant Mole or Zulrah. Completed tasks stay completed.',
      ],
    },
  },
  {
    id: '2026-09-27-runelite-groundwork',
    title: 'Getting ready for the next RuneLite update',
    date: '2026-09-27',
    sections: {
      fixed: [
        'Things inside eight more buildings and dungeons need their area, like the Slayer Tower and the Warriors’ Guild.',
        'A RuneLite sync during a profile switch waits for the switch, so it can’t mix up two runs.',
      ],
      added: [
        'The RuneLite sync sends the tracker’s own answers ready for the next plugin update. The current plugin ignores them.',
      ],
    },
  },
  {
    id: '2026-09-26-diary-travel',
    title: 'Diary tasks need a way there',
    date: '2026-09-26',
    sections: {
      fixed: [
        'Diary tasks on an island you own only count as doable once you can get there.',
        'Pest Control tasks need a way to the outpost, like Port Sarim’s boat or the Minigame Teleport.',
        'Tasks done inside a minigame need that minigame unlocked. Completed tasks stay completed.',
        'The Journal and goal plans suggest the trip and the transport that gets you there.',
      ],
    },
  },
  {
    id: '2026-09-26-runelite-pairing-privacy',
    title: 'RuneLite pairing privacy',
    date: '2026-09-26',
    sections: {
      fixed: [
        'Disconnect removes your published profile from the relay straight away.',
      ],
      changed: [
        'The pairing dialog only shows the last four characters of the code, so it’s safe on stream.',
      ],
    },
  },
  {
    id: '2026-09-25-clearer-names',
    title: 'Clearer shop and bank names',
    date: '2026-09-25',
    sections: {
      fixed: [
        'Amulet Shops and Jewellery Shops say which shops they unlock.',
        'The Ardougne banks are called Ardougne north bank and Ardougne south bank. Banks you own stay unlocked.',
      ],
    },
  },
  {
    id: '2026-09-25-herblore-sailing-quests',
    title: 'Herblore and Sailing need their quests',
    date: '2026-09-25',
    sections: {
      fixed: [
        'Herblore needs Druidic Ritual and Sailing needs Pandemonium, same as the game.',
        'The Skill Advisor won’t suggest either before its quest, and goal plans add the quest for you.',
        'Got Herblore levels but no Druidic Ritual? Mark it complete to unblock those tasks. Nothing you’ve done gets undone.',
      ],
    },
  },
  {
    id: '2026-09-25-runelite-safety-update',
    title: 'RuneLite safety update',
    date: '2026-09-25',
    sections: {
      changed: [
        'Strict Mode only stops travel to places your rules lock. It never blocks walking, NPCs, objects, banks or gear.',
        'Quieter warnings: no chunk chat in unmapped places like dungeons, and one sound when you step onto locked ground.',
      ],
      fixed: [
        'The Roll Inbox no longer says it’s listening for RuneLite. Log things yourself for now.',
      ],
    },
  },
  {
    id: '2026-09-24-saves-keys-and-planners',
    title: 'Safer saves, fairer Keys, better planners',
    date: '2026-09-24',
    sections: {
      fixed: [
        'Lots of save fixes: no more recovery screen on every visit, big saves export again, and two tabs can’t overwrite each other.',
        'One Omni-Key can’t pay for two unlocks, and buying Clarity and Greed together no longer wipes the first one.',
        'The Boss Planner and DPS Calculator do the maths the way the game does, and dangerous bosses no longer read as low danger.',
        'Diary tasks that need an item ask you to confirm you have it, and goal plans are more accurate.',
      ],
      added: [
        'The Boss Planner has a version picker for bosses with more than one fight, like Awakened bosses.',
      ],
      balance: [
        'Quest difficulties match the official ratings, and new Chunked runs get their first free Key at total level 50.',
      ],
    },
  },
  {
    id: '2026-09-24-unlocks-and-guide-saves',
    title: 'More accurate unlocks and clearer guides',
    date: '2026-09-24',
    sections: {
      fixed: [
        'Doable, the Quest Journal and goal plans all use the same area and requirement checks now.',
        'Diary tasks check gear, travel, spells and shops, and lots of quest, Slayer and activity requirements are fixed.',
        'Combat tools fixed: magic damage, ranged defence and potion boosts all work properly.',
        'Guide progress is saved with your backups, so restoring a save restores it too.',
      ],
      changed: [
        'RuneProof’s guides are one walkthrough each, with a Still needed summary and map links.',
        'Emoji and generic pictures are swapped for OSRS Wiki artwork.',
      ],
    },
  },
  {
    id: '2026-09-21-content-and-access',
    title: 'More content and access checks',
    date: '2026-09-21',
    sections: {
      added: [
        'Shops, monsters and quest steps inside buildings show at their entrances.',
        'A Ruff Situation, Crab Quest, nine Mad Angel combat achievements and the latest collection log drops.',
        'Keldagrim and the Blast Furnace get a bank unlock.',
      ],
      fixed: [
        'Shop access checks quests and locations the same way everywhere, including RuneLite.',
        'If shop or Slayer data fails to load you get a Retry button.',
      ],
      changed: [
        'In Chunked, Pandemonium plus Sailing adds offshore land to your frontier. Sailing the ocean doesn’t use a land unlock.',
      ],
    },
  },
  {
    id: '2026-09-12-unlock-consistency',
    title: 'Unlocks stay consistent',
    date: '2026-09-12',
    sections: {
      fixed: [
        'Unlocks save before the reveal shows, so reloading picks up where you were and you’re never charged twice.',
        'Forecasts use the right roll pool, and Chunked land counts toward completion.',
      ],
      changed: [
        'Tutorial Island is free and doesn’t cost an area unlock. If you bought it, you’ve been refunded.',
        'Khazard Battlefield and Chaos Altar have their own unlocks. If you owned them through Port Khazard or Chaos Temple, you keep them.',
      ],
    },
  },
  {
    id: '2026-09-04-runelite-relay-reliability',
    title: 'More reliable RuneLite connection',
    date: '2026-09-04',
    sections: {
      fixed: [
        'Connecting RuneLite doesn’t leave old checks running in the background any more.',
        'The stream overlay checks for updates less often, so long sessions don’t knock the connection out.',
      ],
    },
  },
  {
    id: '2026-09-03-quest-area-access',
    title: 'Quest areas fixed',
    date: '2026-09-03',
    sections: {
      fixed: [
        'Enter the Abyss can be done from Misthalin without the whole Wilderness.',
        'Clock Tower, Hazeel Cult, Sheep Herder and Tower of Life take East Ardougne instead of all of Kandarin.',
        'All 210 quests and miniquests check the exact areas they use, not whole regions.',
      ],
    },
  },
  {
    id: '2026-09-02-shop-category-accuracy',
    title: 'Shops sorted by what they sell',
    date: '2026-09-02',
    sections: {
      fixed: [
        'Shop unlocks follow what each shop actually sells, like Scavvo’s rune armour and the ore merchants.',
        'Every shop has a category now, so none skip their unlock.',
      ],
    },
  },
  {
    id: '2026-08-30-diary-geography',
    title: 'Diary locations fixed',
    date: '2026-08-30',
    sections: {
      fixed: [
        'Diary tasks use the area they’re in, not the whole region around it.',
        'Tasks you can do in more than one place accept any of them.',
        'House tasks no longer need an unrelated area.',
      ],
    },
  },
  {
    id: '2026-08-30-requirement-readiness',
    title: 'Requirements stay in sync',
    date: '2026-08-30',
    sections: {
      fixed: [
        'Boss and minigame readiness uses the same location checks as the access map.',
        'Bounty Hunter needs combat 32 and 12 hours played. Soul Wars needs combat 40, total level 500 and its tutorial.',
        'Goals that go through Dream Mentor include its combat 85 requirement.',
      ],
    },
  },
  {
    id: '2026-08-29-combat-level-eligibility',
    title: 'Combat levels count properly',
    date: '2026-08-29',
    sections: {
      fixed: [
        'Combat requirements use your real combat level, not one capped by your skill tiers.',
        'Slayer masters check their location, quest, combat and Slayer requirements.',
      ],
    },
  },
  {
    id: '2026-08-25-crash-safe-saves',
    title: 'Crash-safe saves',
    date: '2026-08-25',
    sections: {
      added: [
        'Your progress is backed up locally with restore points as you play.',
      ],
      fixed: [
        'A broken or interrupted save stops for recovery instead of quietly starting over.',
        'When browser storage is full, the tracker clears caches and tries the save again.',
      ],
    },
  },
  {
    id: '2026-08-25-region-storage-recovery',
    title: 'Regions and saves fixed',
    date: '2026-08-25',
    sections: {
      fixed: [
        'Finishing a continent unlocks its quests and diaries properly, Wilderness tasks included.',
        'A full browser storage no longer crashes the tracker on reload.',
      ],
    },
  },
  {
    id: '2026-08-22-runeproof-wave-one',
    title: 'RuneProof is here',
    date: '2026-08-22',
    sections: {
      added: [
        'RuneProof launches with five F2P quest guides: Cook’s Assistant, Sheep Shearer, The Restless Ghost, Rune Mysteries and Imp Catcher.',
        'Every step shows its chunk, and the map takes you straight back to your step.',
      ],
      changed: [
        'Ticking steps in RuneProof only tracks the guide. It doesn’t complete the quest or give Keys.',
      ],
    },
  },
  {
    id: '2026-08-20-fate-analytics-dashboard',
    title: 'Fate Analytics',
    date: '2026-08-20',
    sections: {
      added: [
        'Fate Analytics has nine views of your luck: over time, by source, streaks, Key rewards, an activity calendar and more.',
      ],
      changed: [
        'The dashboard, tables and Fate Report share the same filters.',
      ],
      fixed: [
        'Pity Keys are kept apart from real wins, and Standard Keys apart from Omni-Keys.',
        'Older saves and long histories load without throwing the numbers off.',
      ],
    },
  },
  {
    id: '2026-08-16-wyrmscraig-content',
    title: 'Wyrmscraig is here',
    date: '2026-08-16',
    sections: {
      added: [
        'Fallen From Grace and The Mad Angel are tracked in quests, bosses, requirements and the collection log.',
        'Tier 6 Hunter, Mining and Crafting list goat hunting, sunstone mining and sunstone golem crafting.',
      ],
      fixed: [
        'The latest shortcuts, drop tables and collection log items from the Wiki.',
      ],
    },
  },
  {
    id: '2026-08-08-complete-bank-pool',
    title: 'Every bank has its place',
    date: '2026-08-08',
    sections: {
      fixed: [
        'Every fixed bank, chest and deposit box is in the bank pool, Wyrmscraig and Sangvesti included.',
        'Underground and instanced banks have clear names.',
        'The Forestry Leprechaun is its own bank unlock.',
      ],
    },
  },
  {
    id: '2026-08-04-polished-chunk-info',
    title: 'Clearer chunk info',
    date: '2026-08-04',
    sections: {
      changed: [
        'Chunk Info leads with what’s available, with OSRS icons and the details tucked into groups you can open.',
        'Entry requirements, entrances and banks share one Access & facilities card.',
        'Locked things stay readable and say what they need, instead of being struck through.',
      ],
    },
  },
  {
    id: '2026-08-04-discord-community-link',
    title: 'Join the Discord',
    date: '2026-08-04',
    sections: {
      added: [
        'There’s a link to the Fate Locked Discord in the header now.',
      ],
    },
  },
  {
    id: '2026-08-02-one-physical-chunk-one-unlock',
    title: 'One chunk, one unlock',
    date: '2026-08-02',
    sections: {
      changed: [
        'Places that share a chunk, like the Heroes’ Guild and Ice Mountain, share one area unlock. You get a Key back for each double-up.',
        'Chunk data is updated to the 2 August Chunk Picker, with new waters around Wyrmscraig.',
        'Chunk Info shows whether each entrance is locked.',
      ],
      fixed: [
        'Unlocking Otto’s Grotto unlocks its chunk at Baxtorian Falls.',
        '24 border chunks show the right region, so no more “Falador · Misthalin”.',
      ],
    },
  },
  {
    id: '2026-08-02-profile-metadata-integrity',
    title: 'Safer profiles',
    date: '2026-08-02',
    sections: {
      fixed: [
        'A damaged profile list recovers every save it can find instead of showing a blank screen.',
        'Changing profiles in two tabs no longer loses changes, and a profile open in another tab can’t be deleted.',
      ],
    },
  },
  {
    id: '2026-08-02-weighted-fate',
    title: 'Weighted Fate and milestone Keys',
    date: '2026-08-02',
    sections: {
      balance: [
        'Failed rolls give +1, +2 or +3 Fate depending on the activity tier.',
        'Extra Fate past the pity bar carries over to the next bar.',
        'Skill levels 30, 40, 50, 60, 70, 80, 90 and 99 each give a guaranteed Chaos Key.',
        'The 2% Chaos Key chance on every level is still there and can stack with a milestone Key.',
      ],
    },
  },

  {
    id: '2026-08-01-cross-tab-safety',
    title: 'Safer play across tabs',
    date: '2026-08-01',
    sections: {
      added: [
        'You get a warning when the same profile is open in another tab, with options to take over, reload or export.',
      ],
      fixed: [
        'Two tabs can’t quietly overwrite the same profile any more.',
      ],
    },
  },
  {
    id: '2026-08-01-save-recovery',
    title: 'Safer browser saves',
    date: '2026-08-01',
    sections: {
      added: [
        'If your browser can’t save, a banner tells you and offers Retry save and Export backup.',
      ],
      fixed: [
        'A failed save no longer crashes the tracker or loses your latest progress.',
        'Closing the page warns you if something hasn’t saved yet.',
      ],
    },
  },
  {
    id: '2026-07-28-quest-chunk-audit',
    title: 'Quest and chunk requirements checked',
    date: '2026-07-28',
    sections: {
      added: [
        'Learning the Ropes and The Blood Moon Rises are in the quest list.',
      ],
      changed: [
        'All 190 quests and 19 miniquests have checked requirements.',
      ],
      fixed: [
        'Quest cards show each required chunk once.',
        'Witch’s Potion checks Rimmington, and Murder Mystery checks Sinclair Mansion and Seers’ Village.',
        'Repeating a quest completion doesn’t give extra rolls.',
      ],
    },
  },
  {
    id: '2026-07-28-runelite-guide-native-theme',
    title: 'RuneLite guide refresh',
    date: '2026-07-28',
    sections: {
      changed: [
        'The RuneLite guide matches the look of the tracker now. Every chapter and screenshot is still there.',
      ],
    },
  },
  {
    id: '2026-07-28-runelite-guide',
    title: 'RuneLite plugin guide',
    date: '2026-07-28',
    sections: {
      added: [
        'A full RuneLite guide: installing, connecting, every setting, overlays, privacy and fixes, with screenshots.',
      ],
      fixed: [
        'Guide screenshots load properly now.',
      ],
    },
  },
  {
    id: '2026-07-28-tirannwn-area-accuracy',
    title: 'Tirannwn areas fixed',
    date: '2026-07-28',
    sections: {
      changed: [
        'Elf Camp is Iorwerth Camp everywhere and won’t come up in rolls.',
      ],
      fixed: [
        'If you had both camps, you keep one and get a Key back.',
      ],
    },
  },
  {
    id: '2026-07-28-runelite-companion-update',
    title: 'RuneLite plugin is live',
    date: '2026-07-28',
    sections: {
      added: [
        'Connect to RuneLite with one pairing command you can copy.',
      ],
      changed: [
        {
          text: 'The RuneLite plugin is approved and live on the Plugin Hub. See',
          link: {
            label: 'Plugin Hub PR #14395',
            href: 'https://github.com/runelite/plugin-hub/pull/14395',
          },
        },
        'RuneLite reads your run rules from the tracker. What it sees in game stays in RuneLite.',
        'Everything lives in one RuneLite panel with sections you can collapse.',
      ],
      fixed: [
        'RuneLite controls don’t get cut off or overlap the colour settings.',
        'Balances are labelled Keys, Omni Keys and Chaos Keys.',
      ],
    },
  },
  {
    id: '2026-07-26-vanilla-key-safety-valve',
    title: 'Vanilla Key safety valve',
    date: '2026-07-26',
    sections: {
      balance: [
        'Each boss has a small stash of Vanilla Keys, and the odds drop as it empties.',
        'Brutus joins Farm Keys as a one-Key early safety valve.',
        'Your first three clue Keys have at least a 25%, 15% and 10% chance.',
        'Boss and minigame rolls respect where you can actually go.',
      ],
    },
  },
  {
    id: '2026-07-25-exact-skill-key-odds',
    title: 'Exact skill Key odds',
    date: '2026-07-25',
    sections: {
      added: [
        'Skill cards show your exact Key chance for the next level.',
      ],
      changed: [
        'Level-up Key odds are exactly level ÷ 5, so level 41 is 8.2%.',
        'Rolls, history and stats show chances to one decimal place.',
      ],
    },
  },
  {
    id: '2026-07-23-tracker-accuracy',
    title: 'Accuracy fixes and Combat Powers',
    date: '2026-07-23',
    sections: {
      added: ['What’s New: a quick summary of each update.'],
      changed: [
        'Arcana is now called Combat Powers: spellbooks, prayers and things like the Dwarf Cannon.',
        'All 492 Diary tasks and all 646 Combat Achievements are in, with CA points adding up across tiers.',
      ],
      fixed: [
        'Dragon Claws come from Chambers of Xeric, and A Porcine of Interest checks Draynor Village and South Falador Farm.',
        'Quest and diary suggestions respect your skill tier caps.',
        'Broken imports are rejected without touching your progress, and deleting a profile clears its backups too.',
      ],
    },
  },
] as const satisfies readonly ChangelogRelease[];

export const LATEST_CHANGELOG: ChangelogRelease = CHANGELOG_RELEASES[0];
