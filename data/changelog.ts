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
 * not like release documentation. data/changelog.test.ts checks the limits on
 * every entry dated on or after 2026-10-10; older entries keep their wording.
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
    id: '2026-10-10-chunk-picker-october',
    title: 'Map Content Brought Up to Date With October',
    date: '2026-10-10',
    sections: {
      changed: [
        'The chunk content behind the map and the RuneLite plugin now matches the Chunk Picker data from 7 October. The areas you own, what they cost and how you reach them are unchanged.',
        'Emissary Ascended at the Twilight Temple now shows as a monster you can fight, with its own drops, instead of a plain NPC.',
        'Pete Kayer now shows in the Ferox Enclave’s chunk information.',
        'The four Hunter shops (Aleck’s Hunter Emporium, Elder Strom’s Hunting Stall, Imia’s Supplies and the Nardah Hunter Shop) now list the new net trap among their stock.',
        'Goblins list Energy potion(3) among their drops.',
      ],
    },
  },
  {
    id: '2026-10-09-pandemonium-route',
    title: 'Pandemonium and the Shipyard Open the Way You Reach Them',
    date: '2026-10-09',
    sections: {
      fixed: [
        'While you are doing Pandemonium, the RuneLite plugin now lets you into the places the quest takes you: the sea between Port Sarim and The Pandemonium, The Pandemonium itself, and the Shipyard. Before, it called them Locked because the sea only opens once Pandemonium is done. You still need Port Sarim to start the quest, and once it is finished these places follow their usual rules again.',
        'Once you have finished Pandemonium and have Sailing and Port Sarim, the RuneLite plugin opens the whole open sea. Before, most of it showed Not ready, because no walking route from Lumbridge reaches the sea.',
        'The Shipyard where you customise your boat no longer counts as part of the Isle of Souls. You reach it from a shipwright at a port, not from the Isle of Souls, so it now opens with the sea once you have Sailing and Pandemonium. The Isle of Souls has one chunk fewer, and the land total on the run card drops from 624 to 623.',
      ],
    },
  },
  {
    id: '2026-10-09-forgotten-cemetery-routes',
    title: 'More Ways Into the Forgotten Cemetery',
    date: '2026-10-09',
    sections: {
      fixed: [
        'Owning the Forgotten Cemetery and the Dark Warriors’ Fortress now counts as a way there, so the Ankou Diary task shows as doable. Since the last map update the open Wilderness just south of the cemetery belongs to the Dark Warriors’ Fortress, and the cemetery hadn’t caught up.',
        'Dareeyak Teleport also counts as a way into the Forgotten Cemetery: it lands at the ruins just south of it.',
      ],
    },
  },
  {
    id: '2026-10-08-cut-off-chunks',
    title: 'Two Chunks Join the Area You Walk In From',
    date: '2026-10-08',
    sections: {
      changed: [
        'The Auburn Valley Path chunk now belongs to Darkfrost instead of Auburnvale, and the Crash Site Cavern chunk to the Barbarian Outpost instead of the Tree Gnome Stronghold. Each one can only be walked into from its new area, so owning the old area alone gave you a chunk you could never reach.',
      ],
    },
  },
  {
    id: '2026-10-08-discord-feed-roles-area',
    title: 'Live Unlocks, Roles and Area Answers in the Discord',
    date: '2026-10-08',
    sections: {
      added: [
        'If you’ve linked your run in the Fate Locked Discord, your new unlocks now post in #live-unlocks, and the bot gives you your mode’s role and a milestone role as your run grows. /unlink stops both.',
        'Ask the Discord bot about any area with /area: what it opens, which quests need it, its banks and the ways in.',
        'Found a bug? /report in the Discord files it straight to us.',
      ],
    },
  },
  {
    id: '2026-10-08-walking-routes',
    title: 'Routes Follow the Ground You Can Walk',
    date: '2026-10-08',
    sections: {
      fixed: [
        'Owned land beside other owned land no longer counts as a walk when a river, a cliff or a wall stands between them. A Seers’ Village you can only reach by the strip beside the Warriors’ Guild is now out of reach, so the Diary Journal stops offering its tasks, and the Ruins of Uzer no longer joins on to Morytania.',
        'The eagles from Eagles’ Peak no longer count as a way to the desert, the jungle or the north before you have Eagle Transport, and the Keldagrim mine carts no longer join the Grand Exchange, Ice Mountain and White Wolf Mountain before you have Mine Carts.',
        'RuneLite now says Not ready wherever the tracker says you have no way there yet, such as Kourend, Varlamore or the elf camps without the boat or teleport that reaches them. It used to say Unlocked. This comes with your rules, so there is no plugin update to wait for.',
      ],
    },
  },
  {
    id: '2026-10-08-runelite-tiers-unlocks-outlines',
    title: 'Coming to RuneLite: Skill Tiers, New Unlocks and Outlines',
    date: '2026-10-08',
    sections: {
      added: [
        'With the next RuneLite plugin update, right-clicking a tree, rock or fishing spot your skill tier doesn’t open yet will say (Locked), and clicking it will name the tier it needs in chat.',
        'With the same update, RuneLite will name what a roll opened in chat, show it in a banner for a few seconds, and make the new land glow gold on the world map until you stand in it. Announce new unlocks turns it off.',
        'It will also outline the banks, shops, skilling spots and monsters near you in colour: red for locked, orange for a skill your tier doesn’t reach yet, and green for open. Outline locked things turns them all off, with a setting for each kind under it. The RuneLite guide already lists the new settings.',
      ],
    },
  },
  {
    id: '2026-10-08-map-in-between-chunks',
    title: 'More of the Map Opens with Its Areas',
    date: '2026-10-08',
    sections: {
      changed: [
        '77 stretches of land that belonged to no area, and so stayed locked until you owned a whole region, now open with the area beside them. Only Lucien’s Camp and Rock Island Prison are left, as no area beside them leads in.',
        'Vorkath’s island, Ungael, now opens with Rellekka, where Torfinn’s boat leaves from, and rolling Vorkath now needs Rellekka. The Island of Stone and the Cold War icebergs open with Rellekka too.',
        'Ralos’ Rise now takes in the Teomat, Mons Gratia, the Proudspire, the Quetzacalli Gorge and its bank, Salvager Overlook, and the Tower of Ascension beside the Twilight Temple, which leads to Amoxliatl.',
        'All three Gemstone Crab spawns and the Crypt of Tonali now open with the Tlati Rainforest.',
        'The Custodia Pass, between Auburnvale and the Kebos Lowlands, is part of Varlamore and opens with Auburnvale. The Fremennik Province south of Rellekka, with Fossegrimen’s lake and the unicorns, is part of Fremennik and opens with Rellekka.',
        'Jorral’s Outpost opens with East Ardougne, so the Gnomish scout in The General’s Shadow now asks for East Ardougne instead of the Tree Gnome Stronghold.',
        'The rest of the open Wilderness now opens with the area beside it. The Bone Yard and the Escape Caves entrances open with Chaos Temple, and rolling Callisto, Venenatis or Vet’ion now needs Chaos Temple. The three Wilderness cape shops open with Lava Maze, Scorpia’s Cave and Mage Arena.',
        'The open desert does the same: the Jaldraocht Pyramid opens with the Bandit Camp, the Ruins of Ullek with Sophanem, Citharede Abbey with the Ruins of Uzer, the Desert Mining Camp with Shantay Pass, and the genie’s cave and the Water Ravine with Nardah.',
        'The Chasm of Fire now opens with Shayzien, the area the Wiki puts it in, and rolling Yama now needs Shayzien instead of Mount Karuulm.',
        'The Desert Quarry now opens with the Bandit Camp, just north of it, instead of the Agility Pyramid. The granite Diary task and Enakhra’s Lament follow it.',
        'Nothing you already own is taken away, except the two chunks above, and that owning every Kandarin or every Kourend area no longer opens the Fremennik Province or the Custodia Pass.',
      ],
    },
  },
  {
    id: '2026-10-07-wilderness-boss-chunks',
    title: 'Wilderness Bosses Open with Their Areas',
    date: '2026-10-07',
    sections: {
      changed: [
        'The Crazy Archaeologist’s ruins now open with Forgotten Cemetery, which you already need to roll him. Before, his spot stayed locked on the map and in RuneLite until you owned the whole Wilderness.',
        'The Chaos Fanatic’s spot by the Western Obelisk now opens with Lava Maze, and rolling him now needs Lava Maze.',
        'Artio’s and Spindel’s cave entrances now open with Graveyard of Shadows, beside Calvar’ion’s, and rolling either of them now needs Graveyard of Shadows.',
        'The Dareeyak Ruins come with Forgotten Cemetery too, so the Trollheim shortcut and the Crazy Archaeologist Diary tasks now ask for Forgotten Cemetery instead of the whole Wilderness.',
        'Nothing you already own is taken away.',
      ],
    },
  },
  {
    id: '2026-10-07-roll-data-audit',
    title: 'Requirements Checked Against the Wiki',
    date: '2026-10-07',
    sections: {
      fixed: [
        'Callisto, Venenatis and Vet’ion now ask for the Medium Wilderness Diary or that boss’s Slayer task before they count as ready, as their lairs do in game.',
        'The Theatre of Blood, The Nightmare, Phosani’s Nightmare and the Grotesque Guardians now ask for Priest in Peril, which opens Morytania. The Fortis Colosseum and the Hueycoatl now ask for Children of the Sun, which opens Varlamore.',
        'Phosani’s Nightmare no longer asks you to kill The Nightmare first; the game dropped that rule in 2022.',
        'Zalcano now asks for 70 Mining and 70 Smithing, Nex for Desert Treasure I (needed for The Frozen Door), and the Barrows for His Faithful Servants started, which lets you dig into the crypts.',
        'The Inferno now says you hand over a fire cape to enter.',
        'Minigames: the Sorceress’s Garden asks for Prince Ali Rescue and lists its real Thieving levels (1, 25, 45 and 65), Puro-Puro opens with 17 Hunter or Lost City rather than both, the Volcanic Mine no longer asks for Kudos, the Archery Competition asks for 40 Ranged, the Gnome Restaurant for 29 Cooking and its tutorial, and the Mage Arena for the Mage Arena I miniquest.',
        'The Servants’ Guild is tagged Kandarin (it is in East Ardougne), the Colossal pouch needs 25 Runecraft rather than 85, and the mounted Xeric’s talisman and digsite pendant ask for 72 and 82 Construction in the portal nexus room.',
        'Strategy Guide fixes: the Wilderness God Wars Dungeon takes 60 Strength or 60 Agility, not both; the Taverley blue dragons can be reached with a dusty key; Red Dragon Isle needs 56 Agility and no diary; the Shilo gem rocks need the Medium Karamja diary; the Limestone mine is in Silvarea with no quest; and several shortcut, crafting and spell levels are corrected.',
        'The Spice Pouch leaves the Storage table: it isn’t an item in OSRS. Runs that rolled it keep it, but it no longer counts toward completion.',
        'At First Light now rolls Keys as an Intermediate quest, as the OSRS Wiki rates it, and the Moons of Peril no longer list Perilous Moons’ quest levels as boss requirements.',
        'Skill unlocks: the basic jewellery box is at 81 Construction, iron limbs at 23 Smithing and the Falador grapple at 37 Strength, and Hunter no longer claims a second trap at 20.',
      ],
    },
  },
  {
    id: '2026-10-07-steady-unlock-reveal',
    title: 'Unlock Rolls Stay Put',
    date: '2026-10-07',
    sections: {
      fixed: [
        'Rolling an unlock no longer blanks the whole page while it saves, shows the reveal twice, or sends you back to the top of the page. The run stays where it was behind the reveal.',
      ],
    },
  },
  {
    id: '2026-10-07-discord-progress',
    title: 'Show Your Run in the Fate Locked Discord',
    date: '2026-10-07',
    sections: {
      added: [
        'Discord notifications has a new Fate Locked Discord section. Share and get a link code shares a summary of your run, then type /link with the code in the Fate Locked Discord, within ten minutes. After that, anyone there can see your run with /progress.',
        'The summary is your mode (with a rules tag for Custom runs, so runs with the same rules match), areas or chunks, quests, diary tasks, Combat Achievements and your last five unlocks. It updates about a minute after your progress changes. Your save never leaves this device.',
        'Stop sharing removes the summary; /unlink in the Discord removes the link.',
      ],
    },
  },
  {
    id: '2026-10-07-journal-quest-count',
    title: 'Quests Ready, Counted Once',
    date: '2026-10-07',
    sections: {
      fixed: [
        'The Journal summary on the Dashboard counts the quests the Quest Log calls ready: a quest in an area you own but have no way to reach no longer counts as ready there.',
        'The summary names miniquests apart, such as “6 quests and 3 miniquests ready to complete”, as the Quest Log lists them under two headings.',
      ],
    },
  },
  {
    id: '2026-10-07-corsair-cove-foundry-bank',
    title: 'Corsair Cove by Boat',
    date: '2026-10-07',
    sections: {
      fixed: [
        'Captain Tock’s ship from Rimmington now counts as a way to Corsair Cove, so a Corsair Cove you own is no longer called out of reach when you own Rimmington too.',
        'The bank chest in the Giants’ Foundry is now called the Giants’ Foundry bank chest. It was called Desert Battlefield, after the land above it. It’s the same unlock, so a run that already has it keeps it.',
      ],
    },
  },
  {
    id: '2026-10-03-pet-omni-keys',
    title: 'Pets Give an Omni-Key and Follow You',
    date: '2026-10-04',
    sections: {
      balance: [
        'As the community poll chose, each new pet now gives an Omni-Key instead of a Key.',
        'Each pet counts once: you pick which pet you got, and a pet you’ve claimed can’t be picked again.',
        'Claiming a pet isn’t a roll, so it doesn’t reset your Fate, and an active Clarity or Greed waits for your next roll.',
      ],
      added: [
        'Farm Keys → Activities has a New Pet card: find the pet you got by typing its name or where it comes from (“vorkath”, “cox”, “mining”), check it’s the right one, and claim its Omni-Key. The Roll Inbox and the question about earlier pets use the same search, and a pet RuneLite noticed asks you to check it too.',
        'If your run logged pets before this change, What’s New asks you to name each one, so it counts once, or to mark it as not a new pet: a duplicate, a mistake, or one you can’t remember keeps its Key. Each new pet that paid a Key and no Omni-Key earns an Omni-Key now, and you choose what’s fair: give up your next Key, give up your next Key for Fate towards a Void Gambit, or just take the Omni-Key.',
        'Keys you choose to give up show on the Spend panel until the Keys you earn have paid them.',
        'Your newest pet follows you, in 3D, in the bottom-left corner, doing its idle animation from the game. Click its name for Your Pets: every pet you’ve claimed, up close, and which one follows.',
        'The × beside the follower hides it, and Show a follower in Your Pets brings it back. With Animations off in the settings menu, pets stand still.',
        'Since the RuneLite plugin’s 5 October update, a new pet goes into its Roll inbox with a chat reminder. Paste it into the tracker and pick which pet it was. The RuneLite guide says so.',
      ],
    },
  },
  {
    id: '2026-10-04-slayer-cave-ankou',
    title: 'Diary Places Checked Against the Wiki',
    date: '2026-10-04',
    sections: {
      fixed: [
        'The Wilderness Medium task to kill an Ankou counts the Wilderness Slayer Cave too, as the game does: owning Chaos Temple, or in Chunked either of the cave’s entrance chunks, is enough, as well as a Forgotten Cemetery you can get to.',
        'Every Diary task’s places were checked against the OSRS Wiki, and more now count where the game counts them: rune altars through the Abyss; lizardmen beyond Shayzien, rock crabs on Waterbirth Island, gnomes in Tree Gnome Village, elves and adamantite in Prifddinas, the Chaos Elemental’s spawn, more lava dragons, vultures and granite by Sophanem; Puro-Puro by a crop circle, Dorgesh-Kaan from the Kalphite Lair, the Edgeville Dungeon from the Varrock Sewers and Brimhaven Dungeon’s dragons by Banisoch.',
        'Some Diary tasks named the wrong place and now name the right one: the Trollheim shortcut lands west of the Ruins, desert lizards live along the River Elid, the Camulet lands at the Desert Quarry, West Ardougne’s anvil is in East Ardougne’s chunk, crystal-bow elves are in Lletya and Iorwerth Camp, and the Fremennik oaks and super defence are round Rellekka, not on the islands.',
        'In Chunked, tasks done anywhere in the desert, the Wilderness or on Karamja, and desert spots on open sand such as the golden warbler and the Genie, count on chunks that belong to no named area.',
        'Where only the material ties a task to a place, every place an ironman can get it counts: a spider on a stick takes a carcass from any jungle spider (Tai Bwo Wannai, Shilo Village, the Karamja River, Brimhaven, east of Yanille) or Sarachnis, and red spiders’ eggs from the Varrock Sewers, Arandar or the Forthos Dungeon count once dropped and picked up in the Wilderness.',
        'In RuneLite, a Vanilla boss or raid that has given every Standard Key it holds, such as Brutus after his one, no longer says “added to your Roll inbox” after each kill, and its kills leave the Roll inbox card: the tracker can’t roll them. This comes with the next RuneLite plugin update.',
      ],
      changed: [
        'In the Journal, a diary task with a choice of ways, shown as One of, lists each way and what it still needs when you point at it, and each way’s places have their map buttons. A task that counts anywhere in a province has one map button for it.',
        'Three trips need both ends, as other trips do: the Waka canoe needs Edgeville, a temple trek Paterdomus, and the eagle to the Snowy Hunter Area Eagles’ Peak. Tasks you’ve already ticked stay ticked.',
        'A team cape counts in Edgeville’s and Varrock’s Wilderness past the ditch, so in Vanilla it needs only the cape.',
      ],
    },
  },
  {
    id: '2026-10-02-paste-from-runelite',
    title: 'Paste from RuneLite',
    date: '2026-10-02',
    sections: {
      added: [
        'The Roll Inbox has a Paste from RuneLite button. In RuneLite, choose Copy for tracker in the Roll inbox card, then paste here: the inbox says what it added, and nothing rolls until you choose Roll.',
        'A run not linked to a character takes a paste from whoever copied it, and each row says whose it is.',
        'In RuneLite, the new World map borders setting picks the world map’s lines: the outline of your unlocked land, the chunk grid, both, or none, keeping the shading.',
      ],
      changed: [
        'Logging by hand, rolling and spending Keys are unchanged. Skip any row you’ve already logged by hand.',
        'The RuneLite guide calls the website the tracker throughout, as RuneLite’s own buttons do.',
        'In RuneLite, Chunk borders in the game view can show the chunk grid without the dashed locked edges, and the minimap follows it.',
      ],
      fixed: [
        'Strict Mode’s setting, its card in RuneLite and the RuneLite guide now say all it stops: a teleport to a place your rules lock, and a teleport of a kind your run hasn’t unlocked, such as Jewelry Teleports, even to an unlocked place. A worn item’s teleport, such as a glory’s Edgeville, counts. What it stops is unchanged.',
        'With Also send RuneLite notifications on, walking into a locked area sends a notification with its chat line, not only when the alert plays a sound.',
        'RuneLite and its guide say what it notices: a finished diary tier, not each task, and a collection log item only with the game’s collection log notification on. When it can’t notice anything, such as on a character your run isn’t linked to, its Roll inbox card says why.',
        'RuneLite’s progress percentage counts what the number beside it counts: 15 of 187 areas is 8%, where it showed 7%, a share of the map’s chunks.',
        'The RuneLite guide says what a backup does: any backup RuneLite can read replaces your rules, even an older one or another run’s, so pick the right file.',
        'After you connect RuneLite, the tracker says what to look for: the status card saying Rules up to date. RuneLite never showed Connected.',
      ],
    },
  },
  {
    id: '2026-10-02-online-backup',
    title: 'Online Backup Keeps Your Run Safe',
    date: '2026-10-02',
    sections: {
      added: [
        'Online backup, under Sync Code → Online, keeps an encrypted copy of your run on the Fate Locked relay, so clearing your browser’s data no longer loses it. It backs up as you play, and when you leave the page.',
        'A backup code you keep is the only way to open the copy. Copy it or save it as a file when you turn backup on: nobody, the relay included, can read the copy or reset the code.',
        'To get a run back, in this browser or any other, enter its backup code under Sync Code → Online → Restore a run.',
        'If two browsers back up the same run, the copy one replaces is kept, and a restore offers both.',
        'Once a run has some progress, the tracker asks once whether to turn online backup on. Not now means it won’t ask again.',
      ],
      changed: [
        'The reminder to export a .fate file waits while online backup has a copy from the last week.',
      ],
    },
  },
  {
    id: '2026-10-02-plain-rules',
    title: 'Rules and Help Say What the Game Does',
    date: '2026-10-02',
    sections: {
      fixed: [
        'The Rules page, onboarding and the tour now say a new run starts with 3 Keys and all of Misthalin (one chunk of Lumbridge in Chunked), not with nothing.',
        'The Rules page no longer calls bosses repeatable: in Vanilla each boss pays 1 to 3 Keys at falling odds, then stops.',
        'Chaos Keys are explained properly: every skill gives one at levels 30, 40, 50, 60, 70, 80, 90 and 99, as well as a 2% chance on any level-up. A Chaos Key draws from all the tables at once, so big tables such as Banks come up most.',
        'An Omni-Key was called an “upgrade” of a successful roll. It comes on top of the Key, and the Rules page now says so, and that Omni-Keys can’t pick land in Chunked.',
        'The Rules page lists every way to get a Key: any successful roll wherever you log it, Pity Keys, a won Void Gambit, the 3 Keys you start with, and Chunked’s start-chunk Keys (one every 25 total levels while you hold only your start chunk).',
        'Smart Play no longer tells you to save up Fate. Any successful roll resets it to 0, so spend it first.',
        'Importing a sync code and resetting your progress now say a backup of your save is kept under Sync Code → Backups, instead of “This cannot be undone”.',
        'The share card and History are no longer called verifiable. Their check only lets the tracker spot a hand-edited save in your browser.',
        'The Fate Forecast shows the real chance behind its numbers, instead of “most likely” and a flat 80%.',
        'A won Void Gambit pays 1 Key for every whole 15 Fate staked; the Rules page now says the rest is lost.',
        'Banks are unlocked by place: one unlock opens every bank and deposit box there.',
        'The Inferno is no longer listed as a minigame, and unlocking a skill says which training methods its new tier opens.',
      ],
      changed: [
        'The Rival is out of the game for now. A rival you already set up stays in your save.',
        'The Rules page’s Game Modes tab says what differs between Vanilla and Chunked, and the Region Bonuses tab, for a retired mode, is gone.',
        'Plainer words across the tracker: the Rules page is called Rules everywhere, Spend Keys cards say Unlock, the share card has no ranks, and onboarding, the tour, the help buttons and History say what things do.',
      ],
    },
  },
  {
    id: '2026-10-02-diary-unlock-gates',
    title: 'Diary Tasks Ask for Guilds, Patches and House Rooms',
    date: '2026-10-02',
    sections: {
      fixed: [
        'Diary tasks done inside a guild now need that guild unlocked before the Journal calls them doable: entering the Magic Guild needs the Wizards’ Guild, a Rogues’ Den wall safe the Rogues’ Den, and the redwoods the Woodcutting Guild, or the Farming Guild if you grow your own redwood there, among 14 tasks. Like the patches, rooms and Slayer reward below, this only changes the Journal: you can still log the task by hand.',
        'Diary tasks that use a farming patch need that patch unlocked, as RuneLite already locks it: the Catherby limpwurt needs the Flower patch, the palm trees the Fruit Tree patch, and the scarecrows a Flower patch, plus an Allotment patch if you grow the watermelon, among 21 tasks.',
        'Tasks in your house need the room or mount they use: the Menagerie for the pet rock, a Portal Chamber or Portal Nexus for the Kharyrll portal, and the mounted Xeric’s talisman or Digsite pendant if you use your own. Entering your house from Yanille or Hosidius needs Real Estate Agents to move it there.',
        'Killing a dust devil in a Slayer helmet needs the Malevolent Masquerade Slayer reward, which the helmet takes to make.',
      ],
    },
  },
  {
    id: '2026-10-02-diary-accuracy',
    title: 'Diary Tasks Checked Against the Game',
    date: '2026-10-02',
    sections: {
      fixed: [
        'Morytania Diary tasks now need Priest in Peril wherever the map keeps their area locked until it, so “Kill a Ghoul” and the Salve bridge shortcut no longer show as doable at the start of a run.',
        'Some Diary tasks named the wrong area. The Ancient Magicks altar is beside the Bandit Camp and Pollnivneach, the Shadow Dungeon is entered at Baxtorian Falls, the Thermonuclear Smoke Devil and its roll are in the Feldip Hills, crafting nature runes needs Shilo Village or Tai Bwo Wannai, oomlie wraps need the Kharazi Jungle, and the Isafdar painting needs Falador.',
        'Where a task’s spot is in a chunk the map gives to the next area, the task now asks for that area: the Catherby farming patches (Camelot), the granite quarry (Agility Pyramid), the boat from Musa Point (Port Sarim), the anvil by West Ardougne (East Ardougne) and the altar at Emir’s Arena (Mage Training Arena).',
        'Trips now need both ends: the magic carpets to Uzer and Pollnivneach, the boats to Entrana, Ardougne and Land’s End, the Dorgesh-Kaan train, the Ardougne and Edgeville levers (they land in the Mage Arena’s chunk) and the Trollheim shortcut (Trollheim is in Burthorpe’s chunk). Visiting the Lighthouse from Waterbirth Island needs Waterbirth Island, and the Water Obelisk tasks need Taverley, whose dungeon is the only way there.',
        'Making a combat potion, casting Humidify and casting Ice Barrage “in the desert” no longer count Al Kharid, the Duel Arena or the Mage Training Arena, which are outside it.',
        'Barbarian skill tasks, such as the leaping sturgeon, the pyre ship and the bare-handed sharks, ask you to confirm the part of Barbarian Training they use, and the confirmation clears once the miniquest is done. Only the spear and hasta tasks need Tai Bwo Wannai Trio.',
        'Tasks that use a shop or service need its merchant unlock, as RuneLite already did: Sbott’s tanning (Tanners), the Sawmill (Sawmill Operators), the estate agents (Real Estate Agents), Gertrude’s kitten (Pet Shops), Aleck’s Hunter Emporium (Hunter Shops), the Nardah Herbalist (Decanters), the Canifis taxidermist (Taxidermists) and the Ardougne silk trader (Silk Shops).',
        'Tasks that use a minigame’s or a boss’s loot need it unlocked: intelligence for Captain Ginea (Intelligence Gathering), the fire cape (TzHaar Fight Cave), the KQ head (Kalphite Queen), and the trading sticks and gem rocks of Tai Bwo Wannai Cleanup, on the routes that use them.',
        'Zanaris tasks need a dramen or lunar staff in your Weapon slot. The jutting wall and the 56 cosmic runes can use the Abyss instead.',
        'Tasks that need only part of a quest no longer ask for all of it: the Troll Stronghold, God Wars Dungeon and Trollheim shortcut tasks need Death Plateau and Troll Stronghold under way, smelting in the Forsaken Tower needs that quest under way, and the Swampy boat needs Nature Spirit started.',
        'Killing a wyrm in the Karuulm Slayer Dungeon needs boots of stone, brimstone or granite until you have the Kourend Elite reward. The redirected house tablet task follows the ironman rule: it needs Real Estate Agents to move your house to Pollnivneach, not Teleport Tablets, as ironmen go in through the Pollnivneach portal.',
        'The spottier cape needs 69 Hunter, since an ironman catches the dashing kebbits. The scarecrow tasks’ gryphon route for a watermelon now checks 51 Slayer, 45 Sailing, Troubled Tortugans and the Great Conch, instead of a tick-box.',
      ],
    },
  },
  {
    id: '2026-10-02-quest-areas',
    title: 'Quests Ask for Every Place They Need',
    date: '2026-10-02',
    sections: {
      fixed: [
        'Quests now ask for every area their required steps happen in, so the Quest Log no longer calls a quest ready before you can reach all of it. Temple of Ikov needs East Ardougne, where Lucien starts it. Fishing Contest needs Taverley and Seers’ Village, Watchtower the Feldip Hills, Tree Gnome Village the Khazard Battlefield and West Ardougne, Dragon Slayer I the Dwarven Mine for the magic door, and A Kingdom Divided the Kourend areas it visits, such as Kourend Castle and the Wintertodt Camp. You can still complete any quest by hand.',
        'Enakhra’s Lament no longer asks for the whole Kharidian Desert, only the Agility Pyramid, whose chunk holds the quarry. The Grand Tree, The Eyes of Glouphrie and The Path of Glouphrie ask for Yanille, where Hazelmere’s island is, instead of the Feldip Hills. Elemental Workshop II asks for the Digsite instead of Varrock, and Land of the Goblins for Draynor Village, where Aggie makes its dyes, instead of Goblin Village.',
        'In Chunked runs, quests ask for the chunks their steps are in: Plague City for Edmond’s house rather than the chunk beside it, Scrambled! for Tal Teklan and the dragon nest, A Porcine of Interest for the Sourhog Cave and Spria, and The Restless Ghost for the Wizards’ Tower.',
        'Steps in a chunk no area covers, such as Cold War’s icebergs, the Jaldraocht Pyramid in Desert Treasure I and Jorral’s Outpost in Making History, now ask for that chunk in Chunked runs. In Vanilla runs they ask for the area you reach them from: Rellekka, the Bandit Camp and East Ardougne.',
        'Quests whose items only a shop sells need that shop unlock. Prince Ali Rescue needs Clothes Shops for the pink skirt and Bars & Inns for Joe’s beers, Rag and Bone Man I and II need Wine Traders for the vinegar, and Garden of Tranquillity needs Farming Shops. For Pirate’s Treasure’s Karamjan rum, either Wine Traders or Bars & Inns with Brimhaven will do. Alfred Grimhand’s Barcrawl needs Bars & Inns. The Feud, Shades of Mort’ton, Icthlarin’s Little Helper, Daddy’s Home, Making Friends with My Arm, RFD: King Awowogei, Tai Bwo Wannai Trio and The Tourist Trap need their shops too.',
        'Hopespear’s Will and Fairytale II - Cure a Queen need Fairy Rings, as only a fairy ring reaches the places they go.',
        'Some quests now accept one of several routes. What Lies Below needs one way to the Chaos Altar: Mining 42 for the Tunnel of Chaos east of Varrock, the Chaos Temple ruins in the Wilderness with Dark Warriors’ Fortress, or the Abyss once you’ve done Enter the Abyss. Lunar Diplomacy needs the Air, Fire, Water and Earth altars or the Abyss, and One Small Favour the Fishing Guild or Hemenster for the Goblin Cave.',
        'The Fremennik Exiles lists Mining 60, for the lunar ores. Biohazard says the priest gown is worn to see Guidor in Varrock, and The Great Brain Robbery no longer suggests the Grand Exchange, which an ironman can’t use.',
      ],
    },
  },
  {
    id: '2026-10-02-shops-and-guilds',
    title: 'Shops, Guilds and Banks Ask What the Game Asks',
    date: '2026-10-02',
    sections: {
      fixed: [
        'Members shops and places no longer wait on the map data’s “free-to-play only” tag, so a run that has them can use them.',
        'Farming Guild patches open at their own tier: 65 Farming for the herb, tree and anima patches, and 85 for the fruit tree, spirit tree, celastrus and redwood patches. The Troll Stronghold and Weiss herb patches need My Arm’s Big Adventure and Making Friends with My Arm.',
        'A bank inside a guild needs that guild. The banks in Shilo Village, Sophanem, Lletya, Corsair Cove, Etceteria, Neitiznot, Jatizso, Burgh de Rott and Darkmeyer need the quest that opens them.',
        'The planner smelts steel, mithril, adamantite and rune bars at any furnace, not only the Blast Furnace.',
        'Trees, rocks, fishing spots, stalls and implings open at the levels the game asks, such as 92 Woodcutting for rosewood and 82 Thieving for the ore stall.',
        'Shops sit under what they sell. The Runic Emporium and Regath’s Wares are Magic Shops, the TzHaar equipment stores and the vampyre weapon sellers are Weapon Shops, Sian’s is an Archery Shop, the Ore seller is an Ore Merchant, and the Lost Pickaxe and King’s Axe Inn are pubs. Intelligence Gathering is in Shayzien.',
        'A reward shop needs Reward Shops and the activity whose points it takes: Temple Supplies needs Guardians of the Rift, for example. Grace’s graceful clothing, bought with marks of grace, now needs Reward Shops instead of Clothes Shops.',
        'Armour shops with mixed stock are filed by most of what they sell, and the shop directory marks an item only one shop sells, such as Scavvo’s rune sword.',
        'Mine Carts no longer needs The Giant Dwarf, since the Lovakengj carts need no quest. Keldagrim still asks for it.',
        'Hardwood patches ask for what each place needs: Bone Voyage on Fossil Island, The Ribbiting Tale at the Locus Oasis and 51 Sailing on Anglers’ Retreat.',
        'In RuneLite, the teleport crystal asks for Mourning’s End Part I at Lletya and Song of the Elves at Prifddinas, and the south Pollnivneach magic carpet counts as a stop.',
      ],
      added: [
        'Ten shops the map was missing, among them Kjut’s Kebabs, Dusuri’s Star Shop, the Barbarian Assault reward shop, Flakes ’n’ Flotsam and The Burrow.',
        'Karim’s kebabs, Aggie’s dyes, the silk trader, Tenzing’s climbing boots and Nulodion’s cannon now count as merchants, under their shop categories.',
      ],
    },
  },
  {
    id: '2026-10-02-slayer-rewards',
    title: 'Slayer Rewards Add Their Tasks',
    date: '2026-10-02',
    sections: {
      fixed: [
        'Slayer rewards that add a task now add it to the Slayer panel and RuneLite. Seeing Red, Watch the Birdie, Hot Stuff, Reptile Got Ripped, Actual Vampyre Slayer, Warped Reality, Basilocked, Lured In and Wings Spread give the masters who use them 30 more tasks, each waiting until you buy its reward.',
        'Slayer tasks no longer say “access needs review” for a gate that being on the task already meets, such as “Gargoyle task”, or for a level the map writes as “93 Slayer”. The Mining Guild’s entrance now asks for its 60 Mining.',
      ],
      added: [
        'Boss tasks: once you buy Like a Boss, Konar, Nieve, Duradel and Krystilia list a boss task. It’s ready when you’ve unlocked a boss you have the Slayer level for. Krystilia gives only Wilderness bosses, and only Konar gives the Alchemical Hydra.',
      ],
    },
  },
  {
    id: '2026-10-02-ritual-of-greed',
    title: 'Greed Pays on an Omni-Key Too',
    date: '2026-10-02',
    sections: {
      balance: [
        'The Ritual of Greed now gives 2 Keys on an Omni-Key roll too, as on any other success. Before, an Omni-Key roll used Greed up for nothing.',
      ],
      fixed: [
        'Greed’s description now says that a fail which brings a Pity Key refunds no Fate, and that a Vanilla boss with 1 Key left gives 1.',
      ],
    },
  },
  {
    id: '2026-10-02-slayer-tasks',
    title: 'Slayer Tasks Ask What the Masters Ask',
    date: '2026-10-02',
    sections: {
      fixed: [
        'Slayer tasks ask for the other levels the masters do: Defence 20 for basilisks and cockatrice, Magic 50 for cave krakens, Firemaking 33 for harpie bug swarms, 45 Sailing for gryphons, 87 Sailing for frost dragons, and Thieving 23 and 39 for the magic axe hut and the Pirates’ Hideout.',
        'Krystilia’s abyssal demon, dust devil, jelly and nechryael tasks need the I Wildy More Slayer reward, as in the game.',
        'Corrected levels: basilisks need 40 Slayer from Vannaka and Mortimer, Nieve gives suqah and metal dragons from combat 85 and greater demons from 75, and Vannaka gives ice warriors from 45. Fossil Island wyverns no longer ask for Elemental Workshop I, and waterfiends outside the Ancient Cavern no longer ask for the cavern.',
      ],
    },
  },
  {
    id: '2026-10-02-boss-fights',
    title: 'Boss Fights Need Their Boss',
    date: '2026-10-02',
    sections: {
      fixed: [
        'The monsters a boss fight is made of now count as that boss: the Dagannoth Kings, Jad, Zuk, the Royal Titans, the Barrows brothers, the Moons, Sol Heredit, the Great Olm, the Tombs of Amascut’s Wardens and the Hueycoatl. Before, the map and RuneLite let you fight them without the boss unlock. Tormented demons need the Tormented Demons unlock too, and Jad’s cave needs Mor Ul Rek, as the Inferno does.',
        'Artio and Spindel ask for the hard Wilderness Diary or their boss’s Slayer task, as Calvar’ion does. The Maggot King asks for The Blood Moon Rises, TzHaar-Ket-Rak’s Challenges a fire cape, and the Abyssal Sire a visit to the Abyss or fairy ring DIP.',
        'Galvek has left the Bosses table: he is fought only once, during Dragon Slayer II. If you had unlocked him, you get the Key back.',
        'The God Wars Dungeon bosses and the Whisperer are tagged Asgarnia, and the Leviathan Misthalin, where the map puts their entrances.',
        'Combat Achievements show where to fight for 179 more tasks, such as the Leviathan’s, the Royal Titans’ and every raid mode’s, and say “Boss not unlocked” when you haven’t unlocked the boss. You can still tick any task by hand.',
        'The Brutus card notes that repeat kills need The Ides of Milk. Logging a kill is unchanged.',
        'The collection log counts the Nightmare page for Phosani’s Nightmare too, and the Tormented Demons page needs the Tormented Demons unlock.',
        'The goal planner counts a boss’s drops only once you have unlocked the boss, and the Wilderness Slayer Cave no longer asks you to confirm you have entered the Wilderness.',
      ],
    },
  },
  {
    id: '2026-10-02-map-areas',
    title: 'Places Join the Area They’re In',
    date: '2026-10-02',
    sections: {
      fixed: [
        'Places the map left outside every area now belong to the area they’re in: the Giants’ Foundry to Giants’ Plateau, Kraken Cove to Piscatoris Fishing Colony, Tal Teklan and Kastori to the Tlati Rainforest, Ortus Farm and Kualti Headquarters to Civitas illa Fortis, Nemus Retreat to Auburnvale, the Morytania Spider Cave to Darkmeyer, the Seers’ Village hops patch, Mosol Rei and others. Before, most opened only once you owned every area of their region.',
        'The Fremennik Slayer Dungeon belongs to Mountain Camp, beside its entrance. It used to open only with every Kandarin area.',
        'Boss and minigame rolls ask for the area the map puts their entrance in: the Corporeal Beast needs Chaos Temple, the Thermonuclear Smoke Devil Feldip Hills, Yama Mount Karuulm, and the Giants’ Foundry Giants’ Plateau. Bosses any Vanilla run could roll now need their area too: the God Wars Dungeon bosses Burthorpe, the Tombs of Amascut Sophanem, Duke Sucellus and the Phantom Muspah Weiss, the Leviathan the Wizards’ Tower, the Whisperer Goblin Village, Amoxliatl Ralos’ Rise, the Maggot King and Araxxor Darkmeyer, and the Chaos Elemental Scorpia’s Cave.',
        'Emir’s Arena also counts with the Mage Training Arena, whose chunk holds the arena’s bank, altar and entrance.',
        'Two bank unlocks that opened no bank have left the Banks table. Rellekka Peninsula now counts as Keldagrim’s bank, and Asgarnian Road as East Falador’s, with the Motherlode Mine chest. If you had already unlocked the bank it leads to, you get the Key back.',
      ],
    },
  },
  {
    id: '2026-09-29-stranded-areas',
    title: 'Places You Can’t Reach Yet',
    date: '2026-09-29',
    sections: {
      fixed: [
        'The Diary Journal no longer calls a task doable in an owned area you can’t get to. Fairy rings, house portals, eagles, balloons and the Keldagrim mine carts count as a way there once you’ve unlocked them and done the quests they need (for the fairy rings, Fairytale I and a staff, and the quest a ring such as Ape Atoll’s needs); dying, crop circles and the essence mine never do. The boats to Great Kourend, Entrana, Brimhaven and the Void Knights’ Outpost count. So do the charter ships once you’ve unlocked them, and the boats from Rellekka and Port Phasmatys, on to Lunar Isle and Harmony Island, and to Fossil Island once you’ve done the quests they need. The map’s Reachability lens agrees.',
        'The Quest Log says “No route to” an owned place a quest needs that nothing reaches, as the Diary Journal does, instead of “Ready to complete”. You can still complete it by hand.',
        '12 Diary tasks now name the area the game has them in: mining clay and the Desert Phoenix are at the Ruins of Uzer, vultures near Menaphos and the Agility Pyramid, cacti across the desert, swamp lizards in Mort Myre Swamp, and hollow trees in the Haunted Woods, Darkmeyer and Slepe, among others.',
        'A map chunk no area covers, such as the mountains between Weiss and the Wilderness, now says there is nothing there to unlock, instead of asking you to unlock it.',
        'Pirate Pete’s trip to Braindeath Island asks you to confirm you’ve started Rum Deal, as he takes nobody there before it.',
      ],
      changed: [
        'The Rules page describes the challenge in plainer words.',
      ],
    },
  },
  {
    id: '2026-09-29-roll-inbox-groundwork',
    title: 'Groundwork for RuneLite’s Roll Inbox',
    date: '2026-09-29',
    sections: {
      added: [
        'The RuneLite sync now also sends what the next plugin update needs to name what it notices: each boss by the names the game prints in its kill count, every quest, and every achievement diary tier. The current plugin ignores them.',
      ],
      changed: [
        'The Roll Inbox is ready for the next RuneLite update, which will fill it: every event from one batch can be rolled, not only the first; a run not yet linked to a character takes events too; and clues, Slayer tasks and collection log items the game names alike, such as the 18 chompy bird hats, lead to a roll or a choice instead of a dead end. Logging by hand, rolling and spending Keys are unchanged.',
      ],
    },
  },
  {
    id: '2026-09-29-group-ironman-titles',
    title: 'Group Ironman Titles',
    date: '2026-09-29',
    sections: {
      fixed: [
        'Sync & Roll no longer calls a group ironman a regular account. Wise Old Man can’t tell group irons apart, so when it says Regular, a group iron can pick their title: Group, Hardcore Group or Unranked Group Ironman. The title is remembered for that character.',
      ],
      changed: [
        'Every ironman title on Sync & Roll shows its in-game chat badge.',
      ],
    },
  },
  {
    id: '2026-09-28-runelite-guide-redesign',
    title: 'RuneLite Guide Redesigned',
    date: '2026-09-28',
    sections: {
      changed: [
        'The RuneLite Plugin Guide is rebuilt in twelve short chapters: getting started, each card of the sidebar, what you see in game, every setting, fixes for common problems, and a glossary. The contents follow you as you read, and on a phone a Jump to menu takes their place.',
        'Its pictures are drawn by the plugin’s own code at twice the detail, one card at a time. Each part is outlined and numbered beside the picture, so no marker covers what it names, and pointing at a note lights its part up.',
      ],
    },
  },
  {
    id: '2026-09-28-runelite-sidebar-and-display',
    title: 'RuneLite Plugin: New Sidebar and Display',
    date: '2026-09-28',
    sections: {
      added: [
        'The RuneLite plugin has a new sidebar. A status card says whether your rules are current and for this character, with the one thing to do about it, above cards for Here, Strict Mode, Run, Roll inbox, and Connection & backup.',
        'In game, chunk borders are drawn where locked land starts, the world map and minimap show locked land as fog with a line all the way round your unlocked land, a locked area alerts once rather than every chunk, and the HUD is Compact or Detailed.',
        'Here, the card for the place you’re standing in, opens and closes category by category, and Skilling skill by skill with the game’s own skill icons. Click a skilling spot, monster, bank or shop and the game’s arrow points at the nearest one or, with none near, shows the way to the nearest you’ve seen, drawn by the Shortest Path plugin if you run it. Where the tracker can’t see a requirement, such as a quest started or a light source you carry, RuneLite checks it in game, so every row says Can do, Not ready or Locked.',
      ],
      changed: [
        'Every RuneLite setting now lives in RuneLite’s configuration, under Fate Locked Ironman, with a colour-blind safe set of colours. Your old choices carry over.',
        'The RuneLite guide is rewritten to match, in the plugin’s own words, and its sidebar pictures are drawn from the plugin’s own code.',
      ],
    },
  },
  {
    id: '2026-09-28-void-gambit-payout',
    title: 'Void Gambit Pays per Minimum Stake',
    date: '2026-09-28',
    sections: {
      fixed: [
        'A won Void Gambit now pays 1 Key per minimum stake as your mode prices it, whatever you stake: 1 per 9 Fate in Casual and 1 per 23 in Hardcore. It paid 1 per 15 in every mode, so in a cheap mode staking the minimum paid far more per Fate than waiting, and in an expensive mode less. The Void Altar and the Codex now name the price. Vanilla and Chunked runs are unchanged.',
      ],
    },
  },
  {
    id: '2026-09-27-runelite-update',
    title: 'RuneLite Plugin Update',
    date: '2026-09-27',
    sections: {
      added: [
        'The RuneLite plugin now takes its answers from the app: the sea and dungeons have lock states, an instance reads as the chunk it copies, and the HUD and chunk chat say why a chunk is locked.',
        'Strict Mode now knows each teleport by its id. It stops a spell, tablet, scroll or teleport item option that goes to one place the app locks, never one that picks its place after the click, such as a Rub. Fairy rings, spirit trees, charters and boats are tagged but never stopped.',
      ],
      changed: [
        'The RuneLite guide matches the current plugin: Load newest backup file replaces the old auto-reload, and Strict Mode has an optional pause hotkey.',
      ],
    },
  },
  {
    id: '2026-09-27-fate-analytics',
    title: 'Fate Analytics Redesigned',
    date: '2026-09-27',
    sections: {
      changed: [
        'Fate Analytics now opens with your luck in plain words: a verdict, how many wins you are ahead of or behind the odds, a luck meter, and how your luck compares with other runs on the same odds.',
        'Every chart has a plain title and a one-line takeaway, the dice fairness charts sit in their own section, and the activity calendar is a week-by-week heatmap.',
        'The Activity Breakdown fits on screen, with a win-rate bar against the expected rate and its technical columns one toggle away. The Fate Report has a Copy summary button for sharing.',
        'Its cards, verdicts and highlights use OSRS artwork: a Casket for wins, the same keys as the header, a Fire rune when you are running hot, a Law rune when Fate is fair, and an empty waterskin for a drought.',
      ],
      fixed: [
        'Patterned bars and donut slices in Fate Analytics now show. The Keys earned chart and the outcome donut used to draw nothing for them.',
        'The Luck over time chart no longer draws a thick gold band when no roll ended in pity.',
      ],
    },
  },
  {
    id: '2026-09-27-diary-bosses-and-routes',
    title: 'Diary Tasks Check Bosses and Routes',
    date: '2026-09-27',
    sections: {
      fixed: [
        'Diary tasks in an area you own but can\'t get to are no longer Can do. Owning the Ruins of Uzer without the desert around it, or Port Khazard on its own, now shows "No route to" the area, as the map\'s Reachability lens already did, until an owned area or transport joins it to the rest of your run.',
        'Diary tasks that mean fighting a boss need that boss unlocked, 15 in all: the Giant Mole, the Kalphite Queen, Zulrah, the Barrows, the God Wars generals, a Chambers of Xeric raid, the Wintertodt and the rest. The TzHaar attempt accepts the Fight Pits or the Fight Cave, and the Wilderness elite task either version of each boss. Tasks that only enter a lair don\'t, and tasks you have completed stay completed.',
      ],
    },
  },
  {
    id: '2026-09-27-runelite-groundwork',
    title: 'Groundwork for the Next RuneLite Update',
    date: '2026-09-27',
    sections: {
      fixed: [
        'Monsters, NPCs and objects inside eight more areas\' buildings and dungeons now need that area, not just the chunk you enter from: Mor Ul Rek (TzHaar City), the Legends\' Guild, the Lighthouse, the Mage Arena, the Slayer Tower, the Heroes\' Guild basement in Taverley, the Warriors\' Guild and the Woodcutting Guild.',
        'A RuneLite sync that overlaps a profile switch is dropped and sent again once the switch settles, so it can no longer mix the two runs\' free areas.',
      ],
      added: [
        'The RuneLite sync now also sends the app\'s own answers for the next plugin update: whether you may enter each chunk (land, sea and interiors), each bank, each Slayer task per master, your progress, and a travel table of teleports, teleport jewellery, networks and boats with a decision for each option. The current plugin ignores them.',
      ],
    },
  },
  {
    id: '2026-09-26-diary-travel',
    title: 'Diary Tasks Need a Way There',
    date: '2026-09-26',
    sections: {
      fixed: [
        'Diary tasks on an island or enclave you own count as doable only once you can get there. Owning just the Ship Yard no longer makes the Karamja seaweed task doable, and an Ankou in the Forgotten Cemetery needs Cemetery Teleport or a neighbouring Wilderness area.',
        'Pest Control diary tasks need Port Sarim\'s boat, the Minigame Teleport or 50 Sailing, or a one-tap confirmation that you have a Pest control teleport scroll.',
        'Diary tasks you do inside a minigame need that minigame unlocked, 26 in all: Pest Control\'s games and the Void set, Barbarian Assault, Pyramid Plunder, the Fishing Trawler, Tithe Farm and the rest. Tasks that only visit the place, such as entering the Warriors\' Guild, don\'t, and tasks you have completed stay completed.',
        'The Diary Journal, Next Best and goal plans name the trip, such as Travel to Forgotten Cemetery, and suggest the transport or area that gets you there. Fourteen islands and enclaves are covered so far, including Waterbirth Island, Lunar Isle, Mos Le\'Harmless and Ape Atoll. Owned areas still show on the map and count toward completion as before.',
      ],
    },
  },
  {
    id: '2026-09-26-runelite-pairing-privacy',
    title: 'RuneLite Pairing Privacy',
    date: '2026-09-26',
    sections: {
      fixed: [
        'Disconnect in the Connect RuneLite card now removes your published profile from the relay. Anyone with the pairing code could previously still read it, including your linked account name, for up to a day.',
      ],
      changed: [
        'The RuneLite pairing dialog shows only the last four characters of the pairing request, so a stream or screenshot no longer shows the whole code.',
      ],
    },
  },
  {
    id: '2026-09-25-clearer-names',
    title: 'Clearer Shop and Bank Names',
    date: '2026-09-25',
    sections: {
      fixed: [
        'Amulet Shops and Jewellery Shops now say which shops they unlock: Conara\'s Jewels in Cam Torum and Grum\'s Gold Exchange in Port Sarim for jewellery, Davon\'s Amulet Store in Brimhaven for amulets. Grum\'s and Davon\'s have no stock of their own, so ironmen can only sell there. Both wiki links now open the right page.',
        'The Ardougne banks are now called Ardougne north bank and Ardougne south bank. The north bank was listed as Chaos Druid Tower, which has no bank, and the south bank as Ardougne Market. Banks you already own stay unlocked, and older history entries keep their original wording.',
      ],
    },
  },
  {
    id: '2026-09-25-herblore-sailing-quests',
    title: 'Herblore and Sailing Need Their Quests',
    date: '2026-09-25',
    sections: {
      fixed: [
        'Herblore needs Druidic Ritual and Sailing needs Pandemonium, as in the game. Quests, diary tasks, activities, chunk details and Resource Engine recipes that need a Herblore or Sailing level now need the quest too, so The Dig Site, Mastering Mixology and the Desert Medium combat potion no longer read as doable without Druidic Ritual.',
        'The Skill Advisor no longer suggests training Herblore before Druidic Ritual, or Sailing before Pandemonium. Goal plans add the missing quest and the area it needs, such as Taverley for Druidic Ritual.',
        'If your save has Herblore levels but no Druidic Ritual, those quests and tasks stay blocked until you mark Druidic Ritual complete. Anything you have already completed stays completed.',
      ],
    },
  },
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
