import { describe, expect, it } from 'vitest';
import {
  CHANGELOG_RELEASES,
  LATEST_CHANGELOG,
  type ChangelogSection,
} from './changelog';
import { LATEST_CHANGELOG_ID } from './changelogLatest';

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
    expect(LATEST_CHANGELOG.id).toBe('2026-10-07-steady-unlock-reveal');
  });

  it('announces the pet search and the check before a pet is claimed', () => {
    const release = CHANGELOG_RELEASES.find(item => item.id === '2026-10-03-pet-omni-keys');
    expect(release?.sections.added).toContainEqual(expect.stringMatching(/find the pet you got by typing its name or where it comes from.*check it’s the right one/));
  });

  it('announces the Diary places checked against the wiki and the spent bosses RuneLite stops offering', () => {
    const release = CHANGELOG_RELEASES.find(item => item.id === '2026-10-04-slayer-cave-ankou');
    expect(release?.sections.fixed).toEqual([
      expect.stringMatching(/Ankou counts the Wilderness Slayer Cave too.*Chaos Temple.*Chunked either of the cave’s entrance chunks.*Forgotten Cemetery you can get to/),
      expect.stringMatching(/checked against the OSRS Wiki.*rune altars through the Abyss.*Puro-Puro by a crop circle/),
      expect.stringMatching(/named the wrong place.*Trollheim shortcut.*not on the islands/),
      expect.stringMatching(/In Chunked.*chunks that belong to no named area/),
      expect.stringMatching(/every place an ironman can get it counts.*jungle spider.*Sarachnis.*dropped and picked up in the Wilderness/),
      expect.stringMatching(/Brutus after his one.*no longer says “added to your Roll inbox”.*next RuneLite plugin update/),
    ]);
    expect(release?.sections.changed).toEqual([
      expect.stringMatching(/One of, lists each way.*map buttons.*one map button/),
      expect.stringMatching(/both ends.*Waka canoe needs Edgeville.*already ticked stay ticked/),
      expect.stringMatching(/team cape counts in Edgeville’s and Varrock’s Wilderness/),
    ]);
  });

  it('announces Paste from RuneLite, and that manual play is unchanged', () => {
    const release = CHANGELOG_RELEASES.find(item => item.id === '2026-10-02-paste-from-runelite');
    expect(release?.title).toBe('Paste from RuneLite');
    expect(release?.sections.added).toEqual([
      expect.stringMatching(/Paste from RuneLite button.*Copy for tracker in the Roll inbox card.*nothing rolls until you choose Roll/),
      expect.stringMatching(/not linked to a character.*each row says whose it is/),
      expect.stringMatching(/World map borders setting picks the world map’s lines.*the chunk grid, both, or none, keeping the shading/),
    ]);
    expect(release?.sections.changed).toEqual([
      expect.stringMatching(/Logging by hand, rolling and spending Keys are unchanged/),
      expect.stringMatching(/RuneLite guide calls the website the tracker throughout/),
      expect.stringMatching(/Chunk borders in the game view can show the chunk grid without the dashed locked edges, and the minimap follows it/),
    ]);
    expect(release?.sections.fixed).toEqual([
      expect.stringMatching(/Strict Mode.*a teleport of a kind your run hasn’t unlocked.*even to an unlocked place.*worn item’s teleport.*glory’s Edgeville.*What it stops is unchanged/),
      expect.stringMatching(/notifications on.*locked area sends a notification with its chat line, not only when the alert plays a sound/),
      expect.stringMatching(/finished diary tier, not each task.*collection log item only with the game’s collection log notification on.*Roll inbox card says why/),
      expect.stringMatching(/progress percentage counts what the number beside it counts: 15 of 187 areas is 8%/),
      expect.stringMatching(/any backup RuneLite can read replaces your rules, even an older one or another run’s/),
      expect.stringMatching(/status card saying Rules up to date/),
    ]);
  });

  it('announces online backup in plain words', () => {
    const release = CHANGELOG_RELEASES.find(item => item.id === '2026-10-02-online-backup');
    expect(release?.title).toBe('Online Backup Keeps Your Run Safe');
    expect(release?.sections.added).toEqual([
      expect.stringMatching(/^Online backup, under Sync Code → Online, keeps an encrypted copy of your run/),
      expect.stringMatching(/backup code you keep is the only way to open the copy/),
      expect.stringMatching(/Restore a run/),
      expect.stringMatching(/two browsers back up the same run, the copy one replaces is kept/),
      expect.stringMatching(/asks once whether to turn online backup on/),
    ]);
    expect(release?.sections.changed).toEqual([expect.stringMatching(/export a \.fate file waits while online backup/)]);
    // Player words only: no file names or crypto jargon.
    expect(JSON.stringify(release)).not.toMatch(/\.ts\b|\.json\b|AES|HKDF|\bKV\b|worker/i);
  });

  it('announces the plain, corrected Rules and help text, and that the Rival is out for now', () => {
    const release = CHANGELOG_RELEASES.find(item => item.id === '2026-10-02-plain-rules');
    expect(release?.title).toBe('Rules and Help Say What the Game Does');
    expect(release?.date).toBe('2026-10-02');
    expect(release?.sections.fixed).toEqual([
      expect.stringMatching(/new run starts with 3 Keys and all of Misthalin \(one chunk of Lumbridge in Chunked\)/),
      expect.stringMatching(/no longer calls bosses repeatable.*each boss pays 1 to 3 Keys at falling odds, then stops/),
      expect.stringMatching(/Chaos Keys.*30, 40, 50, 60, 70, 80, 90 and 99.*2% chance on any level-up.*all the tables at once/),
      expect.stringMatching(/Omni-Key.*comes on top of the Key.*can’t pick land in Chunked/),
      expect.stringMatching(/every way to get a Key.*any successful roll.*Pity Keys.*Void Gambit.*3 Keys you start with.*every 25 total levels/),
      expect.stringMatching(/Smart Play no longer tells you to save up Fate.*resets it to 0/),
      expect.stringMatching(/backup of your save is kept under Sync Code → Backups/),
      expect.stringMatching(/no longer called verifiable/),
      expect.stringMatching(/Fate Forecast shows the real chance/),
      expect.stringMatching(/Void Gambit pays 1 Key for every whole 15 Fate staked.*rest is lost/),
      expect.stringMatching(/Banks are unlocked by place/),
      expect.stringMatching(/Inferno is no longer listed as a minigame.*training methods its new tier opens/),
    ]);
    expect(release?.sections.changed).toEqual([
      expect.stringMatching(/Rival is out of the game for now.*stays in your save/),
      expect.stringMatching(/what differs between Vanilla and Chunked.*Region Bonuses tab.*is gone/),
      expect.stringMatching(/Rules page is called Rules everywhere.*Spend Keys cards say Unlock.*no ranks/),
    ]);
  });

  it('announces the guild, farming patch, house and Slayer reward gates, and that logging stays free', () => {
    const release = CHANGELOG_RELEASES.find(item => item.id === '2026-10-02-diary-unlock-gates');
    expect(release?.title).toBe('Diary Tasks Ask for Guilds, Patches and House Rooms');
    expect(release?.date).toBe('2026-10-02');
    expect(Object.keys(release?.sections ?? {})).toEqual(['fixed']);
    expect(release?.sections.fixed).toEqual([
      expect.stringMatching(/done inside a guild now need that guild unlocked.*Magic Guild needs the Wizards’ Guild.*Rogues’ Den.*Woodcutting Guild, or the Farming Guild if you grow your own redwood.*14 tasks.*only changes the Journal: you can still log the task by hand/),
      expect.stringMatching(/farming patch need that patch unlocked.*Flower patch.*Fruit Tree patch.*Allotment patch if you grow the watermelon.*21 tasks/),
      expect.stringMatching(/house need the room or mount.*Menagerie.*Portal Chamber or Portal Nexus.*Xeric’s talisman or Digsite pendant.*Yanille or Hosidius needs Real Estate Agents/),
      expect.stringMatching(/Slayer helmet needs the Malevolent Masquerade Slayer reward/),
    ]);
  });

  it('announces the Diary tasks checked against the game, with examples of each fix', () => {
    const release = CHANGELOG_RELEASES.find(item => item.id === '2026-10-02-diary-accuracy');
    expect(release?.title).toBe('Diary Tasks Checked Against the Game');
    expect(release?.date).toBe('2026-10-02');
    expect(Object.keys(release?.sections ?? {})).toEqual(['fixed']);
    expect(release?.sections.fixed).toEqual([
      expect.stringMatching(/Morytania Diary tasks now need Priest in Peril.*“Kill a Ghoul” and the Salve bridge shortcut/),
      expect.stringMatching(/named the wrong area.*Ancient Magicks altar.*Baxtorian Falls.*Feldip Hills.*Shilo Village or Tai Bwo Wannai.*Kharazi Jungle.*Falador/),
      expect.stringMatching(/chunk the map gives to the next area.*Catherby farming patches \(Camelot\).*granite quarry \(Agility Pyramid\).*Musa Point \(Port Sarim\).*West Ardougne \(East Ardougne\).*Emir’s Arena \(Mage Training Arena\)/),
      expect.stringMatching(/Trips now need both ends.*Uzer and Pollnivneach.*Entrana, Ardougne and Land’s End.*Dorgesh-Kaan train.*Mage Arena’s chunk.*Burthorpe’s chunk.*Waterbirth Island.*Taverley/),
      expect.stringMatching(/“in the desert” no longer count Al Kharid, the Duel Arena or the Mage Training Arena/),
      expect.stringMatching(/part of Barbarian Training they use.*clears once the miniquest is done.*Only the spear and hasta tasks need Tai Bwo Wannai Trio/),
      expect.stringMatching(/shop or service need its merchant unlock.*Sbott’s tanning \(Tanners\).*Sawmill \(Sawmill Operators\).*estate agents \(Real Estate Agents\).*Pet Shops.*Hunter Shops.*Nardah Herbalist \(Decanters\).*Taxidermists.*silk trader \(Silk Shops\)/),
      expect.stringMatching(/minigame’s or a boss’s loot.*Intelligence Gathering.*fire cape \(TzHaar Fight Cave\).*KQ head \(Kalphite Queen\).*Tai Bwo Wannai Cleanup/),
      expect.stringMatching(/Zanaris tasks need a dramen or lunar staff.*Abyss instead/),
      expect.stringMatching(/only part of a quest no longer ask for all of it.*Death Plateau and Troll Stronghold under way.*Forsaken Tower.*Nature Spirit started/),
      expect.stringMatching(/wyrm.*boots of stone, brimstone or granite.*Kourend Elite reward.*Real Estate Agents.*not Teleport Tablets/),
      expect.stringMatching(/spottier cape needs 69 Hunter.*gryphon route.*51 Slayer, 45 Sailing, Troubled Tortugans and the Great Conch/),
    ]);
  });

  it('announces that quests ask for every place their steps happen in, and the shops and rings they need', () => {
    const release = CHANGELOG_RELEASES.find(item => item.id === '2026-10-02-quest-areas');
    expect(release?.title).toBe('Quests Ask for Every Place They Need');
    expect(release?.date).toBe('2026-10-02');
    expect(Object.keys(release?.sections ?? {})).toEqual(['fixed']);
    expect(release?.sections.fixed).toEqual([
      expect.stringMatching(/Temple of Ikov needs East Ardougne, where Lucien starts it.*Fishing Contest needs Taverley and Seers’ Village.*complete any quest by hand/),
      expect.stringMatching(/Enakhra’s Lament no longer asks for the whole Kharidian Desert, only the Agility Pyramid.*Yanille.*instead of the Feldip Hills.*Draynor Village/),
      expect.stringMatching(/In Chunked runs.*Plague City for Edmond’s house.*Scrambled! for Tal Teklan.*Wizards’ Tower/),
      expect.stringMatching(/chunk no area covers.*Cold War’s icebergs.*Jaldraocht Pyramid.*Jorral’s Outpost.*In Vanilla runs.*area you reach them from/),
      expect.stringMatching(/Prince Ali Rescue needs Clothes Shops for the pink skirt and Bars & Inns.*Wine Traders for the vinegar.*Pirate’s Treasure.*Alfred Grimhand’s Barcrawl needs Bars & Inns/),
      expect.stringMatching(/Hopespear’s Will and Fairytale II - Cure a Queen need Fairy Rings/),
      expect.stringMatching(/What Lies Below needs one way to the Chaos Altar: Mining 42.*Chaos Temple ruins.*Enter the Abyss.*Lunar Diplomacy.*One Small Favour/),
      expect.stringMatching(/Fremennik Exiles lists Mining 60.*priest gown.*Guidor in Varrock.*Grand Exchange/),
    ]);
  });

  it('announces the shop, guild and bank fixes in plain words', () => {
    const release = CHANGELOG_RELEASES.find(item => item.id === '2026-10-02-shops-and-guilds');
    expect(release?.title).toBe('Shops, Guilds and Banks Ask What the Game Asks');
    expect(release?.sections.fixed).toEqual(expect.arrayContaining([
      expect.stringMatching(/Farming Guild patches open at their own tier: 65 Farming.*85/),
      expect.stringMatching(/bank inside a guild needs that guild.*Burgh de Rott and Darkmeyer/),
      expect.stringMatching(/smelts steel, mithril, adamantite and rune bars at any furnace/),
      expect.stringMatching(/reward shop needs Reward Shops and the activity.*Grace’s graceful clothing.*Reward Shops instead of Clothes Shops/),
      expect.stringMatching(/Mine Carts no longer needs The Giant Dwarf/),
      expect.stringMatching(/Bone Voyage on Fossil Island.*51 Sailing on Anglers’ Retreat/),
    ]));
    expect(release?.sections.added).toEqual([
      expect.stringMatching(/^Ten shops the map was missing.*Kjut’s Kebabs/),
      expect.stringMatching(/Karim’s kebabs, Aggie’s dyes, the silk trader, Tenzing’s climbing boots and Nulodion’s cannon/),
    ]);
    // Player words only: no audit labels or file names.
    expect(JSON.stringify(release)).not.toMatch(/\b[SBGUMD]\d+\b|\.ts\b|\.json\b|Chunk Picker/);
  });

  it('announces the tasks Slayer rewards add, and boss tasks', () => {
    const release = CHANGELOG_RELEASES.find(item => item.id === '2026-10-02-slayer-rewards');
    expect(release?.title).toBe('Slayer Rewards Add Their Tasks');
    expect(release?.sections.fixed).toEqual([
      expect.stringMatching(/Seeing Red.*Wings Spread.*30 more tasks/),
      expect.stringMatching(/Gargoyle task.*93 Slayer.*60 Mining/),
    ]);
    expect(release?.sections.added).toEqual([expect.stringMatching(/Like a Boss.*Krystilia gives only Wilderness bosses.*Alchemical Hydra/)]);
  });

  it('announces that Greed pays on an Omni-Key roll', () => {
    const release = CHANGELOG_RELEASES.find(item => item.id === '2026-10-02-ritual-of-greed');
    expect(release?.title).toBe('Greed Pays on an Omni-Key Too');
    expect(release?.sections.balance).toEqual([expect.stringMatching(/2 Keys on an Omni-Key roll/)]);
    expect(release?.sections.fixed).toEqual([expect.stringMatching(/Pity Key refunds no Fate.*Vanilla boss/)]);
  });

  it('announces the Slayer task fixes', () => {
    const release = CHANGELOG_RELEASES.find(item => item.id === '2026-10-02-slayer-tasks');
    expect(release?.title).toBe('Slayer Tasks Ask What the Masters Ask');
    expect(release?.sections.fixed).toEqual([
      expect.stringMatching(/Defence 20 for basilisks.*Magic 50 for cave krakens.*Thieving 23 and 39/),
      expect.stringMatching(/Krystilia’s .* I Wildy More Slayer/),
      expect.stringMatching(/basilisks need 40 Slayer.*Elemental Workshop I.*waterfiends/),
    ]);
  });

  it('announces that boss fights need their boss, and Galvek’s refund', () => {
    const release = CHANGELOG_RELEASES.find(item => item.id === '2026-10-02-boss-fights');
    expect(release?.title).toBe('Boss Fights Need Their Boss');
    expect(release?.sections.fixed).toEqual([
      expect.stringMatching(/Dagannoth Kings, Jad, Zuk.*without the boss unlock.*Tormented Demons unlock/),
      expect.stringMatching(/Artio and Spindel.*Maggot King asks for The Blood Moon Rises.*Abyssal Sire/),
      expect.stringMatching(/Galvek has left the Bosses table.*Key back/),
      expect.stringMatching(/God Wars Dungeon bosses and the Whisperer are tagged Asgarnia/),
      expect.stringMatching(/Combat Achievements show where to fight.*Boss not unlocked.*by hand/),
      expect.stringMatching(/Brutus card notes that repeat kills need The Ides of Milk/),
      expect.stringMatching(/Nightmare page for Phosani’s Nightmare.*Tormented Demons page/),
      expect.stringMatching(/goal planner counts a boss’s drops only once.*Wilderness Slayer Cave/),
    ]);
  });

  it('announces the places that join their areas, and rolls that ask for the entrance’s area', () => {
    const release = CHANGELOG_RELEASES.find(item => item.id === '2026-10-02-map-areas');
    expect(release?.title).toBe('Places Join the Area They’re In');
    expect(release?.sections.fixed).toEqual([
      expect.stringMatching(/Giants’ Foundry to Giants’ Plateau, Kraken Cove to Piscatoris Fishing Colony.*every area of their region/),
      expect.stringMatching(/Fremennik Slayer Dungeon belongs to Mountain Camp.*every Kandarin area/),
      expect.stringMatching(/Corporeal Beast needs Chaos Temple.*God Wars Dungeon bosses Burthorpe.*Chaos Elemental Scorpia’s Cave/),
      expect.stringMatching(/Emir’s Arena also counts with the Mage Training Arena/),
      expect.stringMatching(/Rellekka Peninsula now counts as Keldagrim’s bank.*Asgarnian Road as East Falador’s.*Key back/),
    ]);
  });

  it('announces the fixes for places a run owns but can’t reach, and the retagged Diary tasks', () => {
    const release = CHANGELOG_RELEASES.find(item => item.id === '2026-09-29-stranded-areas');
    expect(release?.title).toBe('Places You Can’t Reach Yet');
    expect(release?.sections.fixed).toEqual([
      expect.stringMatching(/Diary Journal no longer calls a task doable.*Fairy rings.*once you’ve unlocked them and done the quests they need.*Fairytale I and a staff.*boats to Great Kourend, Entrana, Brimhaven and the Void Knights’ Outpost.*charter ships once you’ve unlocked them/),
      expect.stringMatching(/Quest Log says “No route to”.*complete it by hand/),
      expect.stringMatching(/^12 Diary tasks now name the area the game has them in/),
      expect.stringMatching(/chunk no area covers.*nothing there to unlock/),
      expect.stringMatching(/Braindeath Island.*started Rum Deal/),
    ]);
    expect(release?.sections.changed).toEqual([expect.stringMatching(/Rules page describes the challenge in plainer words/)]);
  });

  it('announces the groundwork for RuneLite’s Roll Inbox, and that manual play is unchanged', () => {
    const release = CHANGELOG_RELEASES.find(item => item.id === '2026-09-29-roll-inbox-groundwork');
    expect(release?.title).toBe('Groundwork for RuneLite’s Roll Inbox');
    expect(release?.sections.added).toEqual([
      expect.stringMatching(/each boss by the names the game prints in its kill count, every quest, and every achievement diary tier.*current plugin ignores them/),
    ]);
    expect(release?.sections.changed).toEqual([
      expect.stringMatching(/every event from one batch can be rolled.*not yet linked to a character.*chompy bird hats.*Logging by hand, rolling and spending Keys are unchanged/),
    ]);
  });

  it('announces group ironman titles', () => {
    const release = CHANGELOG_RELEASES.find(item => item.id === '2026-09-29-group-ironman-titles');
    expect(release?.title).toBe('Group Ironman Titles');
    expect(release?.sections.fixed).toEqual([
      expect.stringMatching(/group ironman a regular account.*Wise Old Man can’t tell group irons apart.*says Regular.*Group, Hardcore Group or Unranked Group Ironman.*remembered for that character/),
    ]);
    expect(release?.sections.changed).toEqual([expect.stringMatching(/in-game chat badge/)]);
  });

  it('announces the redesigned RuneLite guide', () => {
    const release = CHANGELOG_RELEASES.find(item => item.id === '2026-09-28-runelite-guide-redesign');
    expect(release?.title).toBe('RuneLite Guide Redesigned');
    expect(Object.keys(release?.sections ?? {})).toEqual(['changed']);
    expect(release?.sections.changed).toEqual([
      expect.stringMatching(/RuneLite Plugin Guide.*twelve short chapters.*each card of the sidebar.*every setting.*glossary.*contents follow you.*Jump to menu/),
      expect.stringMatching(/plugin’s own code at twice the detail.*outlined and numbered beside the picture.*no marker covers what it names/),
    ]);
  });

  it('announces the RuneLite plugin’s new sidebar and display, and the guide that matches them', () => {
    const release = CHANGELOG_RELEASES.find(item => item.id === '2026-09-28-runelite-sidebar-and-display');
    expect(release?.title).toBe('RuneLite Plugin: New Sidebar and Display');
    expect(release?.sections.added).toEqual([
      expect.stringMatching(/new sidebar.*status card.*Here, Strict Mode, Run, Roll inbox, and Connection & backup/),
      expect.stringMatching(/chunk borders.*fog.*all the way round.*alerts once.*Compact or Detailed/),
      expect.stringMatching(/Here.*opens and closes.*Skilling skill by skill.*arrow points at the nearest one.*shows the way to the nearest you’ve seen.*Shortest Path.*checks it in game.*Can do, Not ready or Locked/),
    ]);
    expect(release?.sections.changed).toEqual([
      expect.stringMatching(/RuneLite’s configuration.*colour-blind safe.*old choices carry over/),
      expect.stringMatching(/RuneLite guide.*plugin’s own words.*drawn from the plugin’s own code/),
    ]);
  });

  it('announces the Void Gambit payout fix', () => {
    const release = CHANGELOG_RELEASES.find(item => item.id === '2026-09-28-void-gambit-payout');
    expect(release?.title).toBe('Void Gambit Pays per Minimum Stake');
    expect(release?.sections.fixed).toEqual([
      expect.stringMatching(/1 Key per minimum stake.*1 per 9 Fate in Casual.*1 per 23 in Hardcore.*Vanilla and Chunked runs are unchanged/),
    ]);
  });

  it('announces the RuneLite plugin update and the guide that matches it', () => {
    const release = CHANGELOG_RELEASES.find(item => item.id === '2026-09-27-runelite-update');
    expect(release?.title).toBe('RuneLite Plugin Update');
    expect(release?.sections.added).toEqual([
      expect.stringMatching(/answers from the app.*sea and dungeons.*instance.*why a chunk is locked/),
      expect.stringMatching(/Strict Mode now knows each teleport by its id.*one place.*Rub.*never stopped/),
    ]);
    expect(release?.sections.changed).toEqual([
      expect.stringMatching(/RuneLite guide.*Load newest backup file.*pause hotkey/),
    ]);
  });

  it('announces the Fate Analytics redesign and its chart fixes', () => {
    const release = CHANGELOG_RELEASES.find(item => item.id === '2026-09-27-fate-analytics');
    expect(release?.title).toBe('Fate Analytics Redesigned');
    expect(release?.sections.changed).toEqual([
      expect.stringMatching(/luck in plain words.*luck meter/),
      expect.stringMatching(/plain title and a one-line takeaway/),
      expect.stringMatching(/Activity Breakdown fits on screen.*Copy summary/),
      expect.stringMatching(/OSRS artwork.*Casket.*Fire rune.*Law rune/),
    ]);
    expect(release?.sections.fixed).toEqual([
      expect.stringMatching(/Patterned bars and donut slices/),
      expect.stringMatching(/no longer draws a thick gold band/),
    ]);
  });

  it('announces that diary tasks need a route to their area, and a boss fight its boss', () => {
    const release = CHANGELOG_RELEASES.find(item => item.id === '2026-09-27-diary-bosses-and-routes');
    expect(release?.title).toBe('Diary Tasks Check Bosses and Routes');
    expect(release?.sections.fixed).toEqual([
      expect.stringMatching(/own but can.t get to are no longer Can do.*Ruins of Uzer.*Port Khazard.*No route to/),
      expect.stringMatching(/fighting a boss need that boss unlocked, 15 in all.*Giant Mole.*completed stay completed/),
    ]);
  });

  it('announces the interiors that now need their area, and the groundwork for the next RuneLite update', () => {
    const release = CHANGELOG_RELEASES.find(item => item.id === '2026-09-27-runelite-groundwork');
    expect(release?.sections.fixed).toEqual([
      expect.stringMatching(/eight more areas.*Mor Ul Rek.*Woodcutting Guild/),
      expect.stringMatching(/profile switch/),
    ]);
    expect(release?.sections.added).toEqual([expect.stringMatching(/next plugin update.*travel table.*ignores them/)]);
  });

  it('announces that diary tasks on an owned island need a way there, and minigame tasks their minigame', () => {
    const release = CHANGELOG_RELEASES.find(item => item.id === '2026-09-26-diary-travel');
    expect(release?.sections.fixed).toEqual([
      expect.stringMatching(/only once you can get there.*Ship Yard.*Forgotten Cemetery/),
      expect.stringMatching(/Pest control teleport scroll/),
      expect.stringMatching(/inside a minigame need that minigame unlocked, 26 in all.*completed stay completed/),
      expect.stringMatching(/Travel to Forgotten Cemetery.*still show on the map/),
    ]);
  });

  it('announces that Disconnect clears the relay and the pairing dialog hides the code', () => {
    const release = CHANGELOG_RELEASES.find(item => item.id === '2026-09-26-runelite-pairing-privacy');
    expect(release).toMatchObject({ title: 'RuneLite Pairing Privacy', date: '2026-09-26' });
    expect(release?.sections.fixed).toEqual([
      expect.stringMatching(/Disconnect.*removes your published profile from the relay/i),
    ]);
    expect(release?.sections.changed).toEqual([
      expect.stringMatching(/only the last four characters of the pairing request/i),
    ]);
  });

  it('says which shops Amulet Shops and Jewellery Shops unlock and renames the Ardougne banks', () => {
    const release = CHANGELOG_RELEASES.find(item => item.id === '2026-09-25-clearer-names');
    expect(release?.title).toBe('Clearer Shop and Bank Names');
    expect(release?.sections.fixed).toEqual([
      expect.stringMatching(/Conara's Jewels.*Grum's Gold Exchange.*Davon's Amulet Store.*ironmen can only sell there/),
      expect.stringMatching(/Ardougne north bank and Ardougne south bank.*Chaos Druid Tower.*Ardougne Market/),
    ]);
  });

  it('announces the Herblore and Sailing quest requirements and what happens to older saves', () => {
    const release = CHANGELOG_RELEASES.find(item => item.id === '2026-09-25-herblore-sailing-quests');
    expect(release?.sections.fixed).toEqual([
      expect.stringMatching(/Herblore needs Druidic Ritual and Sailing needs Pandemonium/),
      expect.stringMatching(/Skill Advisor no longer suggests training Herblore before Druidic Ritual/),
      expect.stringMatching(/Herblore levels but no Druidic Ritual.*already completed stays completed/),
    ]);
  });

  it('announces the RuneLite safety update without promising a Roll Inbox feed', () => {
    const release = CHANGELOG_RELEASES.find(item => item.id === '2026-09-25-runelite-safety-update');
    expect(release?.sections.changed).toEqual(expect.arrayContaining([
      expect.stringMatching(/stops only travel.*never walking/i),
      expect.stringMatching(/Active, Paused, Off or Inactive/),
    ]));
    expect(release?.sections.fixed).toEqual([
      expect.stringMatching(/no longer says it is listening for RuneLite/i),
    ]);
  });

  it('names the newest release in changelogLatest.ts, which the app reads up front', () => {
    // Add a release? Set LATEST_CHANGELOG_ID in data/changelogLatest.ts to its id.
    expect(LATEST_CHANGELOG_ID).toBe(CHANGELOG_RELEASES[0].id);
  });

  it('retains the RuneLite relay reliability fixes', () => {
    expect(CHANGELOG_RELEASES.find(release => release.id === '2026-09-04-runelite-relay-reliability')).toEqual({
      id: '2026-09-04-runelite-relay-reliability',
      title: 'RuneLite Relay Reliability',
      date: '2026-09-04',
      sections: {
        fixed: [
          'Connecting RuneLite no longer leaves the tracker polling retired event routes in the background.',
          'The stream overlay now checks for updates less aggressively, reducing relay outages during long sessions.',
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
