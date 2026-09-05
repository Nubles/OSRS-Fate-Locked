import { activityId, indexActivityRecords } from './activityCatalog';
// Access requirements (skill levels + quests) for Activities & Utility content.
//
// Surfaced on activity cards next to the region tag so a player can see, at a
// glance, what gates an activity: the quest(s) and skill level(s) actually
// required to access/fight it. Recommended (not required) levels are NOT listed
// here — only hard gates. Newer (2024-2026) bosses were verified against the
// OSRS Wiki; classic content from well-established requirements.
//
// Typed predicates carry hard gates, including external facts needing confirmation.
// Informational notes explain mechanics and never silently satisfy requirements.

import type { RequirementPredicate } from '../utils/requirementPredicates';
import { ACTIVITY_ACCESS_AREAS } from './activityAccess';

export interface ActivityReq {
  predicates?: RequirementPredicate[];
  noteIsInformational?: true;
  /** Hard skill-level gates, e.g. { Slayer: 91 }. */
  skills?: Record<string, number>;
  /** Required quests (canonical OSRS names; match QUEST_DATA where possible). */
  quests?: string[];
  /** Named areas that must be reachable in the selected game mode. */
  requiredAreas?: string[];
  /** Minimum real OSRS combat level. */
  combatLevel?: number;
  /** Minimum real OSRS total level. */
  totalLevel?: number;
  /** External progress a player must explicitly confirm after machine gates pass. */
  manualRequirements?: string[];
  /** Any gate that isn't a skill/quest. */
  note?: string;
}

// God Wars entry has quest-progress, travel, permanent-rope and key alternatives.
// These external facts remain confirmation checks until the account tracks them.
const godWarsGeneralRequirements = (skill: string, faction: string, equipment: string): ActivityReq => ({
  predicates: [
    skill === 'Hitpoints'
      ? { kind: 'any', of: [{ kind: 'skill', skill, level: 70 }, { kind: 'manual', key: 'gwd-boosted-hitpoints', label: 'At least 70 current Hitpoints, including a permitted boost, to cross the Zamorak river' }] }
      : { kind: 'skill', skill, level: 70 },
    { kind: 'any', of: [
      { kind: 'skill', skill: 'Strength', level: 60 },
      { kind: 'skill', skill: 'Agility', level: 60 },
      { kind: 'manual', key: 'gwd-entrance-boost', label: 'A permitted Strength boost reaches 60 for the entrance boulder' },
    ] },
    { kind: 'any', of: [
      { kind: 'manual', key: 'gwd-troll-route', label: 'Troll Stronghold progressed past Dad and a legal route to the dungeon (climbing boots or Trollheim teleport) is available' },
      { kind: 'item', id: 'ghommals-hilt', label: 'Ghommal\'s hilt with its God Wars Dungeon teleport available and legal', usage: 'hold' },
    ] },
    { kind: 'manual', key: 'gwd-entrance-rope', label: 'Entrance rope already installed, or a legal rope available for first entry; dungeon reachable under this run\'s map rules' },
    { kind: 'manual', key: `gwd-${faction}-equipment`, label: equipment },
    { kind: 'any', of: [
      { kind: 'manual', key: `gwd-${faction}-essence`, label: `Enough current ${faction} essence: 40 normally, or the reduced amount earned through Combat Achievements` },
      { kind: 'item', id: 'ecumenical-key', label: 'An ecumenical key to bypass the chamber kill count', usage: 'consume' },
    ] },
  ],
});

const houseFeature = (name: string): ActivityReq => ({
  predicates: [{ kind: 'manual', key: `house-feature:${name}`, label: `${name} is built and usable in a legally reachable house permitted by your account mode; the selected upgrade and any destination are unlocked` }],
  noteIsInformational: true, note: 'Construction levels apply when building; access permission alone does not prove the feature has been built.',
});
const stashFeature = (tier: string, buildLevel: number): ActivityReq => ({
  predicates: [{ kind: 'manual', key: `stash:${tier}`, label: `The selected ${tier} STASH unit is built and legally reachable, with the required matching item set and inventory space available` }],
  noteIsInformational: true, note: `Building requires ${buildLevel} Construction (boostable), the appropriate materials, hammer, saw and method permission. Using an existing unit does not rebuild it.`,
});

export const ACTIVITY_REQUIREMENTS: Record<string, ActivityReq> = {
  // ===== Bosses & Raids =====================================================
  'Tombs of Amascut': { quests: ['Beneath Cursed Sands'] },
  'The Gauntlet': { quests: ['Song of the Elves'] },
  'Nex': {
    predicates: [
      { kind: 'manual', key: 'nex-frozen-door', label: 'The Frozen Door has been permanently opened with the assembled frozen key' },
      { kind: 'manual', key: 'nex-prison-route', label: 'A legal route into God Wars Dungeon and the Ancient Prison is available' },
      { kind: 'any', of: [
        { kind: 'manual', key: 'nex-essence', label: 'Enough current Zaros essence for Nex: 40 normally, or the reduction earned through Combat Achievements' },
        { kind: 'item', id: 'ecumenical-key', label: 'An ecumenical key to bypass the chamber kill count', usage: 'consume' },
      ] },
    ],
    noteIsInformational: true, note: 'The four general access levels are frozen-key acquisition requirements, not repeated prison entry gates once the door is open.',
  },
  'General Graardor': godWarsGeneralRequirements('Strength', 'Bandos', 'A legal hammer, warhammer, elder maul, or Imcando hammer to open the Bandos door'),
  'Commander Zilyana': godWarsGeneralRequirements('Agility', 'Saradomin', 'Both Saradomin ropes permanently installed, or two legal ropes available for first entry'),
  "Kree'arra": godWarsGeneralRequirements('Ranged', 'Armadyl', 'A legal crossbow and mithril grapple to cross into Armadyl\'s Eyrie'),
  "K'ril Tsutsaroth": godWarsGeneralRequirements('Hitpoints', 'Zamorak', 'Enough current Hitpoints to survive the crossing into Zamorak\'s Fortress'),
  'Abyssal Sire': { skills: { Slayer: 85 }, predicates: [{ kind: 'manual', key: 'sire-abyss-access', label: 'The Abyss has been visited through the Mage of Zamorak or fairy rings' }, { kind: 'slayerTask', id: 'sire-valid-task', label: 'Abyssal demon task valid here (not a Wilderness assignment), or an Abyssal Sire boss task' }] },
  'Alchemical Hydra': { skills: { Slayer: 95 }, predicates: [{ kind: 'slayerTask', id: 'hydra-valid-task', label: 'Hydra task valid for this location from Konar or Mortimer, or a Konar Alchemical Hydra boss task' }, { kind: 'manual', key: 'hydra-heat-protection', label: 'Legal boots of stone, brimstone or granite are worn, or elite Kourend & Kebos Diary heat protection is unlocked' }] },
  'Cerberus': { skills: { Slayer: 91 }, predicates: [{ kind: 'slayerTask', id: 'cerberus-valid-task', label: 'Hellhound Slayer task valid here, or a Cerberus boss task' }] },
  'Grotesque Guardians': { skills: { Slayer: 75 }, quests: ['Priest in Peril'], predicates: [
    { kind: 'manual', key: 'guardians-rooftop-unlocked', label: 'Slayer Tower rooftop permanently unlocked with a brittle key' },
    { kind: 'any', of: [
      { kind: 'slayerTask', id: 'gargoyles', label: 'Gargoyle Slayer task valid for the Slayer Tower' },
      { kind: 'slayerTask', id: 'grotesque-guardians', label: 'Grotesque Guardians boss task' },
    ] },
    { kind: 'manual', key: 'guardians-finisher', label: 'A legal rock hammer, rock thrownhammer, or granite hammer to finish the Guardians' },
  ] },
  'Kraken': { skills: { Slayer: 87 }, predicates: [{ kind: 'slayerTask', id: 'kraken-valid-task', label: 'Cave kraken Slayer task valid here, or a Kraken boss task' }] },
  'Thermonuclear Smoke Devil': { skills: { Slayer: 93 }, predicates: [{ kind: 'any', of: [
    { kind: 'slayerTask', id: 'smoke-devils-or-thermy', label: 'Smoke devil or Thermonuclear Smoke Devil boss task valid here' },
    { kind: 'manual', key: 'thermy-first-diary-kill', label: 'Western Provinces Diary started and its first off-task Thermonuclear Smoke Devil kill still available' },
  ] }] },
  'Araxxor': { skills: { Slayer: 92 }, quests: ['Priest in Peril'], predicates: [{ kind: 'any', of: [
    { kind: 'slayerTask', id: 'araxytes', label: 'Araxyte Slayer task valid for Araxxor' },
    { kind: 'slayerTask', id: 'spiders', label: 'Spider Slayer task valid for Araxxor' },
    { kind: 'slayerTask', id: 'araxxor', label: 'Araxxor boss task' },
  ] }] },
  'Skotizo': { predicates: [{ kind: 'item', id: 'dark-totem', label: 'A dark totem for this entry', usage: 'consume' }] },
  'Vorkath': { quests: ['Dragon Slayer II'] },
  'Galvek': { predicates: [{ kind: 'any', of: [
    { kind: 'all', of: [{ kind: 'quest', id: 'Dragon Slayer II' }, { kind: 'manual', key: 'galvek-replay-access', label: 'A legal reachable route to the Pool of Dreams in the Myths\' Guild is available for replay' }] },
    { kind: 'manual', key: 'galvek-quest-stage', label: 'Dragon Slayer II progressed to the Galvek battle and its quest instance is legally reachable' },
  ] }], noteIsInformational: true, note: 'Quest battle, or replay at the Pool of Dreams after Dragon Slayer II.' },
  'Moons of Peril': { quests: ['Perilous Moons'], noteIsInformational: true, note: 'Repeat boss encounters after the introductory quest.' },
  'Duke Sucellus': { quests: ['Desert Treasure II'] },
  'The Leviathan': { quests: ['Desert Treasure II'] },
  'The Whisperer': { quests: ['Desert Treasure II'] },
  'Vardorvis': { quests: ['Desert Treasure II'] },
  'Barrows Brothers': { quests: ['Priest in Peril'] },
  'Deranged Archaeologist': { quests: ['Bone Voyage'] },
  'Hespori': { skills: { Farming: 65 }, predicates: [{ kind: 'manual', key: 'hespori-grown', label: 'Hespori seed planted and fully grown' }] },
  'Coral Nursery': { skills: { Farming: 28 }, quests: ['Troubled Tortugans'], predicates: [{ kind: 'manual', key: 'coral-route', label: 'A legal route to the Great Conch nursery and suitable diving equipment or Medallion of the deep are available' }, { kind: 'manual', key: 'coral-planting', label: 'Selected coral level, fragment, nursery space, tools and Farming method are available (Elkhorn 28, Pillar 52, Umbral 77)' }] },
  'Phantom Muspah': { quests: ['Secrets of the North'] },
  'Zulrah': { predicates: [
    { kind: 'any', of: [{ kind: 'quest', id: 'Regicide' }, { kind: 'manual', key: 'regicide-port-tyras', label: 'Regicide progressed to reaching Port Tyras' }] },
    { kind: 'manual', key: 'zulrah-sacrifice-permission', label: 'High Priestess Zul-Harcinqa has accepted you as the sacrifice' },
  ] },
  'Wintertodt': { skills: { Firemaking: 50 } },
  'Tempoross': { skills: { Fishing: 35 } },
  'Zalcano': { quests: ['Song of the Elves'] },
  'Tormented Demons': { quests: ['While Guthix Sleeps'] },
  'Amoxliatl': { quests: ['The Heart of Darkness'] },
  'Yama': { quests: ['A Kingdom Divided'], predicates: [{ kind: 'manual', key: 'yama-contract', label: 'Spoken to the Voice of Yama and accepted the contract allowing the Yama challenge' }] },
  'Doom of Mokhaiotl': { quests: ['The Final Dawn'] },
  'Gemstone Crab': { quests: ['Children of the Sun'] },
  'Shellbane Gryphon': { skills: { Slayer: 51 }, quests: ['Troubled Tortugans'], predicates: [{ kind: 'slayerTask', id: 'shellbane-valid-task', label: 'Gryphon Slayer task valid here, or a Shellbane Gryphon boss task' }] },
  'The Mad Angel': { quests: ['Fallen From Grace'] },
  'Mimic': { predicates: [{ kind: 'item', id: 'mimic-casket', label: 'An active Mimic casket with a fight attempt remaining', usage: 'hold' }], noteIsInformational: true, note: 'Enable Mimics at the strange casket in Watson\'s house; elite or master reward caskets can become Mimics.' },
  'Obor': { predicates: [{ kind: 'any', of: [
    { kind: 'manual', key: 'obor-gate-unlocked', label: 'Obor\'s gate permanently unlocked' },
    { kind: 'item', id: 'giant-key', label: 'A giant key for the first gate unlock (not consumed)', usage: 'hold' },
  ] }] },
  'Bryophyta': { predicates: [
    { kind: 'any', of: [
      { kind: 'manual', key: 'bryophyta-gate-unlocked', label: 'Bryophyta\'s gate permanently unlocked' },
      { kind: 'item', id: 'mossy-key', label: 'A mossy key for the first gate unlock (not consumed)', usage: 'hold' },
    ] },
    { kind: 'manual', key: 'bryophyta-growthlings', label: 'A legal axe or secateurs to finish Bryophyta\'s growthlings' },
  ] },


  'Chambers of Xeric': { noteIsInformational: true, note: 'Entry has no hard skill gate; selected raid rooms require suitable team skills, tools and combat styles.' },
  'Theatre of Blood': { quests: ['Priest in Peril'] },
  'The Nightmare': { quests: ['Priest in Peril'] },
  'Corporeal Beast': { noteIsInformational: true, note: 'No universal combat-level entry requirement; Ironman instance allocation is separate.' },
  "Calvar'ion": { predicates: [{ kind: 'any', of: [{ kind: 'diary', id: 'Wilderness Hard' }, { kind: 'slayerTask', id: 'vetion-boss', label: 'A Vetion boss task, not an ordinary skeleton task' }] }, { kind: 'manual', key: 'wilderness-boss-fee', label: 'Wilderness boss access fee currently paid or waived' }] },
  'Crazy Archaeologist': { noteIsInformational: true, note: 'No additional quest or level access gate.' },
  'Scorpia': { noteIsInformational: true, note: 'No additional quest or level access gate.' },
  'Dagannoth Kings': { predicates: [{ kind: 'manual', key: 'waterbirth-route', label: 'A legal Waterbirth dungeon route is available: door support (pet rock or partner) and rune thrownaxe where needed, or the available Agility shortcuts' }] },
  'Giant Mole': { predicates: [{ kind: 'item', id: 'spade', label: 'A spade to enter the mole tunnels', usage: 'hold' }], noteIsInformational: true, note: 'Darkness damages players without a light source or the permanent Fire of Eternal Light.' },
  'Kalphite Queen': { predicates: [{ kind: 'manual', key: 'kalphite-ropes', label: 'Legal descent route with ropes available as needed, or ropes permanently installed after the Hard Desert Diary' }] },
  'King Black Dragon': { noteIsInformational: true, note: 'No quest or level gate; dragonfire protection is strongly recommended.' },
  'Sarachnis': { predicates: [{ kind: 'manual', key: 'sarachnis-web', label: 'A legal way through the thick web: slash weapon, knife, or Aranea boots' }] },
  'Scurrius': { noteIsInformational: true, note: 'No hard Slayer or quest gate to the rat fight.' },
  "TzHaar-Ket-Rak's Challenges": { predicates: [{ kind: 'manual', key: 'ket-rak-challenge', label: 'Inner Mor Ul Rek access available; chosen challenge unlocked (third and later also require an Inferno completion)' }] },
  'Clan Wars': { noteIsInformational: true, note: 'Choose an available portal or an agreed clan challenge; combat levels are not an entry gate.' },
  "Emir's Arena": { predicates: [{ kind: 'manual', key: 'emir-match', label: 'A selected arena match is available on the appropriate alternate-save world and its supplied loadout is permitted by the run rules' }] },
  'Intelligence Gathering': { predicates: [{ kind: 'manual', key: 'gang-meeting', label: 'A current Captain Ginea gang meeting is scheduled at a legally reachable location' }] },
  'Last Man Standing': { predicates: [{ kind: 'manual', key: 'lms-mode-access', label: 'Eligible for the selected LMS mode: casual or its competitive account-age, quest-point and total-level requirements; supplied loadout permitted by run rules' }] },
  'Archery Competition': { skills: { Ranged: 40 }, predicates: [{ kind: 'manual', key: 'ranging-competition', label: 'Ranging Guild access, competition fee, legal bow and arrows available' }] },

  // ===== Guilds =============================================================
  "Champions' Guild": { predicates: [{ kind: 'questPoints', count: 32 }] },
  "Cooks' Guild": { skills: { Cooking: 32 }, predicates: [{ kind: 'manual', key: 'cooks-guild-attire', label: 'Wearing an accepted Cooks\' Guild entry item, such as a chef\'s hat or Cooking cape, legally under your equipment unlocks' }] },
  'Crafting Guild': { skills: { Crafting: 40 }, predicates: [{ kind: 'manual', key: 'crafting-guild-attire', label: 'Wearing a brown apron, golden apron, Crafting cape or max cape, legally under your equipment unlocks' }] },
  'Mining Guild': { skills: { Mining: 60 } },
  'Prayer Guild': { skills: { Prayer: 31 }, noteIsInformational: true, note: 'Access to the upper floor of Edgeville Monastery.' },
  'Farming Guild': { skills: { Farming: 45 }, noteIsInformational: true, note: 'Entry at 45 Farming; intermediate and advanced sections need 65 and 85.' },
  'Fishing Guild': { skills: { Fishing: 68 } },
  "Heroes' Guild": { quests: ["Heroes' Quest"] },
  'Hunter Guild': { skills: { Hunter: 46 }, quests: ['Children of the Sun'], noteIsInformational: true, note: '46 Hunter is required to use the guild amenities.' },
  "Legends' Guild": { quests: ["Legends' Quest"] },
  "Myths' Guild": { quests: ['Dragon Slayer II'] },
  'Ranging Guild': { skills: { Ranged: 40 } },
  "Rogues' Den": { noteIsInformational: true, note: 'Area entry only; the optional maze requires 50 Thieving and 50 Agility.' },
  "Servants' Guild": { predicates: [{ kind: 'manual', key: 'servant-hiring', label: 'For hiring: meet the chosen servant\'s Construction level, have two bedrooms with beds, no current servant, and the hiring fee' }] },
  "Warriors' Guild": {
    predicates: [{ kind: 'any', of: [{ kind: 'skill', skill: 'Attack', level: 99 }, { kind: 'skill', skill: 'Strength', level: 99 }, { kind: 'combinedSkills', skills: ['Attack', 'Strength'], level: 130 }] }],
  },
  "Wizards' Guild": { skills: { Magic: 66 } },
  'Woodcutting Guild': { skills: { Woodcutting: 60 } },

  // ===== Arcana (spellbooks & prayers) ======================================
  'Ancient Magicks': { quests: ['Desert Treasure I'] },
  'Lunar Spellbook': { quests: ['Lunar Diplomacy'] },
  'Arceuus Spellbook': { predicates: [{ kind: 'manual', key: 'arceuus-switch-access', label: 'Arceuus spellbook already active, or a legal reachable spellbook-switching route is available' }], noteIsInformational: true, note: 'Speak to Tyss near the Dark Altar to switch spellbooks; individual spells have their own requirements.' },
  'Piety': { skills: { Prayer: 70, Defence: 70 }, quests: ["King's Ransom"], predicates: [{ kind: 'manual', key: 'knight-waves-completed', label: 'Completed the Knight Waves training grounds' }] },
  'Rigour': { skills: { Prayer: 74, Defence: 70 }, predicates: [{ kind: 'manual', key: 'rigour-learned', label: 'Rigour learned by reading a dexterous prayer scroll' }] },
  'Augury': { skills: { Prayer: 77, Defence: 70 }, predicates: [{ kind: 'manual', key: 'augury-learned', label: 'Augury learned by reading an arcane prayer scroll' }] },
  'Preserve': { skills: { Prayer: 55 }, predicates: [{ kind: 'manual', key: 'preserve-learned', label: 'Preserve learned by reading a torn prayer scroll' }] },
  'Bones to Peaches': { skills: { Magic: 60 }, predicates: [{ kind: 'manual', key: 'bones-to-peaches-learned', label: 'Purchased the Bones to Peaches spell unlock from the Mage Training Arena reward shop' }] },
  'Dwarf Cannon': { quests: ['Dwarf Cannon'] },
  'Chivalry': { skills: { Prayer: 60, Defence: 65 }, quests: ["King's Ransom"], predicates: [{ kind: 'manual', key: 'knight-waves-completed', label: 'Completed the Knight Waves training grounds' }] },
  'God Spells': { skills: { Magic: 60 }, quests: ['Mage Arena I'], predicates: [{ kind: 'manual', key: 'god-spell-learned', label: 'Cast the chosen god spell 100 times inside the arena to unlock outside use; have its required staff legally available' }] },
  'Mage Arena II': { skills: { Magic: 75 }, quests: ['Mage Arena II'], noteIsInformational: true, note: 'Imbued god cape access after miniquest completion; equipping the cape still needs its equipment permission.' },

  // ===== Minigames (hard gates only; many minigames have no requirement) =====
  'Pest Control': {
    combatLevel: 40,
    noteIsInformational: true, note: 'Novice boat.',
  },
  'Barbarian Assault': { predicates: [{ kind: 'manual', key: 'barbarian-assault-tutorial', label: 'Barbarian Assault tutorial completed and a team formed for the selected role and wave' }] },
  'Bounty Hunter': {
    combatLevel: 32,
    manualRequirements: ['At least 12 hours of account play time'],
  },
  'Castle Wars': { },
  'Soul Wars': {
    combatLevel: 40,
    totalLevel: 500,
    manualRequirements: ['Completed the Soul Wars tutorial once'],
  },
  'Mage Arena': { skills: { Magic: 60 } },
  'Guardians of the Rift': { skills: { Runecraft: 27 }, quests: ['Temple of the Eye'] },
  'Tithe Farm': { skills: { Farming: 34 }, predicates: [{ kind: 'manual', key: 'tithe-tools', label: 'Selected Tithe seeds, permitted Farming method, filled watering cans and seed dibber (or bare-handed planting) available' }] },
  'Hallowed Sepulchre': { skills: { Agility: 52 }, quests: ['Sins of the Father'] },
  "Giants' Foundry": { skills: { Smithing: 15 }, quests: ['Sleeping Giants'] },
  'Mastering Mixology': { skills: { Herblore: 60 }, quests: ['Children of the Sun'], predicates: [{ kind: 'manual', key: 'mixology-materials', label: 'Required clean herbs, unfinished potions or paste and inventory space available; selected Herblore method permitted' }] },
  'Volcanic Mine': { skills: { Mining: 50 }, quests: ['Bone Voyage'], predicates: [{ kind: 'manual', key: 'volcanic-mine-access', label: '30 numulite entry fee paid (or 3,000 numulite permanent access purchased) and a legal pickaxe available' }] },
  'Pyramid Plunder': { skills: { Thieving: 21 }, predicates: [{ kind: 'any', of: [{ kind: 'quest', id: "Icthlarin's Little Helper" }, { kind: 'manual', key: 'sophanem-access', label: 'Icthlarin Little Helper progressed far enough to enter Sophanem, or a legal available alternate route reaches the Guardian mummy' }] }], noteIsInformational: true, note: 'Room levels are unboostable: 21, 31, 41, 51, 61, 71, 81 and 91.' },
  'Trouble Brewing': { skills: { Cooking: 40 }, quests: ['Cabin Fever'] },
  'Tai Bwo Wannai Cleanup': { quests: ['Jungle Potion'] },
  "Shades of Mort'ton": { quests: ["Shades of Mort'ton"] },
  'Temple Trekking': { quests: ['In Aid of the Myreque'] },
  'Impetuous Impulses': { skills: { Hunter: 17 }, predicates: [{ kind: 'manual', key: 'puro-route', label: 'A legal crop-circle route to Puro-Puro is available, via Zanaris or an overworld field; impling jars and selected catching method available' }] },
  'Rat Pits': { predicates: [{ kind: 'manual', key: 'rat-pits-access', label: 'Selected pit unlocked through Ratcatchers progress, permitted non-Ironman account, suitable cat, opponent and matching wager available' }] },
  'Vale Totems': { skills: { Fletching: 20 }, quests: ['Children of the Sun'], predicates: [{ kind: 'manual', key: 'vale-totems-tutorial', label: 'Completed the Vale Totems miniquest' }, { kind: 'manual', key: 'vale-totems-materials', label: 'Legal knife or fletching knife and suitable logs (or axe to obtain them) available; selected totem method permitted' }] },
  'Barracuda Trials': { skills: { Sailing: 30 }, predicates: [{ kind: 'manual', key: 'barracuda-boat', label: 'A permitted seaworthy boat with the selected trial equipment and level: Tempor Tantrum needs iron helm, oak mast and linen sails or better; higher trials have separate requirements' }] },
  'Blast Furnace': { predicates: [{ kind: 'manual', key: 'keldagrim-started', label: 'The Giant Dwarf started to enter Keldagrim' }, { kind: 'any', of: [{ kind: 'skill', skill: 'Smithing', level: 60 }, { kind: 'manual', key: 'blast-furnace-fee', label: 'Current foreman fee paid (2500 coins, or 1250 through ring of charos dialogue)' }] }, { kind: 'manual', key: 'blast-furnace-operation', label: 'Dwarf-worker coffer funded on a Blast Furnace world, or manual operation arranged; legal ores and selected smelting method available' }] },
  'Nightmare Zone': { predicates: [{ kind: 'manual', key: 'nmz-dream-access', label: 'At least five eligible Nightmare Zone boss quests completed; selected dream paid for and permitted by account mode' }] },
  "Sorceress's Garden": { quests: ['Prince Ali Rescue'], predicates: [{ kind: 'manual', key: 'sorceress-introduction', label: 'Spoken to Osman and the apprentice to unlock garden transport; selected garden level and Thieving method are available' }], noteIsInformational: true, note: 'Winter entry is level 1; other gardens require higher Thieving.' },
  'Stealing Artefacts': { skills: { Thieving: 49 }, predicates: [{ kind: 'manual', key: 'artefact-job', label: 'Captain Khaled has assigned the current artefact job and this Thieving method is permitted' }] },
  'Mess': { skills: { Cooking: 20 }, predicates: [{ kind: 'area', id: 'Hosidius' }, { kind: 'manual', key: 'mess-recipe', label: 'Selected servery recipe and Cooking method are permitted; kitchen utensils and ingredients available (pies 20, stew 25, pineapple pizza 65)' }], noteIsInformational: true, note: 'Hosidius favour is no longer an entry gate; supplies are provided by the kitchen.' },

  // ===== Player-Owned House (use of existing facilities) ====================
  'Kitchen': houseFeature('Kitchen'),
  'Menagerie': houseFeature('Menagerie'),
  'Costume Room': houseFeature('Costume Room'),
  'Chapel Altar': houseFeature('Chapel Altar'),
  'Portal Chamber': houseFeature('Portal Chamber'),
  'Throne Room': houseFeature('Throne Room'),
  'Dungeon': houseFeature('Dungeon'),
  'Portal Nexus': houseFeature('Portal Nexus'),
  'Mounted Coins': houseFeature('Mounted Coins'),
  'Mounted Glory': houseFeature('Mounted Glory'),
  'Spirit Tree (POH)': houseFeature('Spirit Tree (POH)'),
  'Wilderness Obelisk': houseFeature('Wilderness Obelisk'),
  'Fairy Ring (POH)': houseFeature('Fairy Ring (POH)'),

  // ===== Mobility (quest-gated transport networks) ==========================
  'Spirit Trees': { quests: ['Tree Gnome Village'] },
  'Fairy Rings': { predicates: [{ kind: 'manual', key: 'fairy-ring-progress', label: 'Fairytale II progressed far enough to use fairy rings' }] },
  'Gnome Gliders': { quests: ['The Grand Tree'] },
  'Balloon Transport': { predicates: [{ kind: 'manual', key: 'balloon-route', label: 'Enlightened Journey progressed to the selected route, destination unlocked, required fuel logs available and Entrana equipment restrictions met where applicable' }] },
  'Mine Carts': { predicates: [{ kind: 'manual', key: 'minecart-route', label: 'The Giant Dwarf started for Keldagrim access; selected route unlocks and fare available (Grand Exchange route free)' }] },
  'Magic Carpets': { predicates: [{ kind: 'manual', key: 'carpet-route', label: 'Selected legal carpet route available and fare paid, discounted, or exempt through Hard Desert Diary' }] },
  'Quetzal Network': { quests: ['Children of the Sun'], predicates: [{ kind: 'manual', key: 'quetzal-route', label: 'Renu unlocked through Twilight Promise progress or a usable quetzal whistle available; selected landing site built and legal' }] },
  'Mycelium Transport': { quests: ['Bone Voyage'], predicates: [{ kind: 'manual', key: 'mycelium-route', label: 'Selected Magic Mushtree destinations discovered and unlocked, with a legal route to the network' }] },
  'Eagle Transport': { quests: ["Eagles' Peak"], predicates: [{ kind: 'manual', key: 'eagle-route', label: 'A legal rope is available and selected eagle eyries are unlocked and reachable' }] },
  'Ectophial': { quests: ['Ghosts Ahoy'], predicates: [{ kind: 'item', id: 'ectophial', label: 'A filled ectophial', usage: 'hold' }] },
  'Enchanted Lyre': { quests: ['The Fremennik Trials'], predicates: [{ kind: 'item', id: 'enchanted-lyre', label: 'A charged or imbued enchanted lyre with chosen destination unlocked', usage: 'hold' }] },
  'Digsite Pendant': { quests: ['The Dig Site'], predicates: [{ kind: 'item', id: 'digsite-pendant', label: 'A charged digsite pendant', usage: 'hold' }, { kind: 'manual', key: 'digsite-enchantment-known', label: 'Digsite pendant enchantment learned from the museum archaeologist; chosen destination unlocked and legal' }], noteIsInformational: true, note: 'Bone Voyage unlocks the optional Fossil Island destination, not the basic Digsite teleport.' },
  'Camulet': { quests: ["Enakhra's Lament"], predicates: [{ kind: 'item', id: 'camulet', label: 'A charged or unlimited camulet', usage: 'hold' }] },
  "Kharedst's Memoirs": { quests: ['Client of Kourend'], predicates: [{ kind: 'item', id: 'kharedst-book', label: 'Charged memoirs or Book of the dead with the chosen destination page unlocked', usage: 'hold' }] },
  'Ring of the Elements': { predicates: [{ kind: 'item', id: 'ring-of-elements', label: 'A charged ring of the elements', usage: 'hold' }] },
  'Colossal Pouch': { skills: { Runecraft: 25 }, predicates: [{ kind: 'item', id: 'colossal-pouch', label: 'A usable colossal pouch', usage: 'hold' }], noteIsInformational: true, note: 'Capacity scales at 25, 50, 75 and 85 Runecraft.' },
  "Gricoller's Can": { predicates: [{ kind: 'item', id: 'gricollers-can', label: 'A Gricoller watering can with water remaining', usage: 'hold' }] },
  "Dizana's Quiver": { skills: { Ranged: 75 }, predicates: [{ kind: 'item', id: 'dizanas-quiver', label: 'A Dizana quiver', usage: 'equip' }], noteIsInformational: true, note: 'Ammunition must match a usable weapon; blessing and sunfire charges affect bonuses rather than basic storage.' },
  'Forestry Kit': { predicates: [{ kind: 'item', id: 'forestry-kit', label: 'A Forestry kit or Forestry basket for supported Forestry equipment', usage: 'hold' }] },
  "Drakan's Medallion": { quests: ['A Taste of Hope'], predicates: [{ kind: 'item', id: 'drakans-medallion', label: 'Drakan medallion with charges where required and the selected destination unlocked', usage: 'hold' }] },
  'Royal Seed Pod': { quests: ['Monkey Madness II'], predicates: [{ kind: 'item', id: 'royal-seed-pod', label: 'A royal seed pod', usage: 'hold' }] },
  "Pharaoh's Sceptre": { predicates: [{ kind: 'item', id: 'pharaoh-sceptre', label: 'A charged Pharaoh sceptre with chosen destination legally reachable', usage: 'hold' }] },
  'Crystal Teleport Seed': { predicates: [{ kind: 'item', id: 'teleport-crystal', label: 'A charged teleport crystal or eternal teleport crystal with chosen destination unlocked', usage: 'hold' }], noteIsInformational: true, note: 'An uncharged crystal teleport seed must be charged before teleporting.' },

  // ---- Bosses with an access gate (most others have no hard requirement) -----
  'Inferno': { predicates: [{ kind: 'manual', key: 'inferno-access', label: 'Fire cape sacrificed to unlock Inferno access' }] },
  "Phosani's Nightmare": { predicates: [{ kind: 'bossKill', id: 'nightmare', count: 1, label: 'At least one ordinary Nightmare kill' }] },
  'Fortis Colosseum': { quests: ['Children of the Sun'], noteIsInformational: true, note: 'Combat recommendations are not entry requirements.' },
  'The Hueycoatl': { quests: ['Children of the Sun'] },
  'The Royal Titans': { noteIsInformational: true, note: 'No additional entry requirements; combat levels are recommendations.' },
  'TzHaar Fight Cave': { noteIsInformational: true, note: 'No strict combat level requirement to enter.' },

  // ---- Minigames with a gate -------------------------------------------------
  'Fishing Trawler': {
    skills: { Fishing: 15 },
    },
  'Gnome Ball': { },
  'Gnome Restaurant': { },
  'TzHaar Fight Pit': {
    },
  'Burthorpe Games Room': { },
  'Mage Training Arena': { },
  'Mahogany Homes': { predicates: [{ kind: 'manual', key: 'mahogany-contract', label: 'Own a house and have an assigned, legally reachable contract; selected tier level and method, hammer, saw, planks and any steel bars are available' }] },
  'Forestry': { predicates: [{ kind: 'manual', key: 'forestry-method', label: 'A legally reachable eligible tree, legal axe, and its Woodcutting level and method permission are available; selected Forestry event requirements met' }] },
  'Tears of Guthix': { quests: ['Tears of Guthix'], predicates: [{ kind: 'manual', key: 'tears-current-eligibility', label: 'First visit, or seven days elapsed and 100,000 total XP or one quest point gained since last visit; both hands free for the bowl' }] },
  'Brimhaven Agility Arena': { predicates: [{ kind: 'manual', key: 'brimhaven-entry', label: '200-coin entry fee paid or an earned fee exemption applies; selected Agility obstacles permitted by method unlocks' }] },

  // ---- Farming patches (access/level-gated; basic patches need nothing) ------
  'Hardwood Tree': { skills: { Farming: 35 }, predicates: [{ kind: 'manual', key: 'hardwood-planting', label: 'A legally reachable hardwood patch, suitable sapling and spade are available; selected species level and Farming method permitted' }], noteIsInformational: true, note: 'Teak begins at35 Farming; Fossil Island is one patch location, not a universal Bone Voyage gate.' },
  'Seaweed': { skills: { Farming: 23 }, quests: ['Bone Voyage'], predicates: [{ kind: 'manual', key: 'seaweed-planting', label: 'Legally reach the shallow underwater patches with oxygen available; spores, seed dibber, free patch and Farming method permission available' }] },
  'Spirit Tree': { skills: { Farming: 83 }, predicates: [{ kind: 'manual', key: 'spirit-tree-planting', label: 'A legal available spirit-tree patch and planting allowance, sapling, spade and Farming method permission are available' }] },
  'Celastrus': { skills: { Farming: 85 }, predicates: [{ kind: 'area', id: 'Farming Guild' }, { kind: 'manual', key: 'celastrus-planting', label: 'Celastrus patch available; sapling, spade and Farming method permission available' }] },
  'Redwood': { skills: { Farming: 90 }, predicates: [{ kind: 'area', id: 'Farming Guild' }, { kind: 'manual', key: 'redwood-planting', label: 'Redwood patch available; sapling, spade and Farming method permission available' }] },
  'Crystal Tree': { skills: { Farming: 74 }, quests: ['Song of the Elves'], predicates: [{ kind: 'area', id: 'Prifddinas' }, { kind: 'manual', key: 'crystal-tree-planting', label: 'Crystal sapling and spade available; crystal tree patch and this Farming method are available' }] },
  'Hespori Patch': { skills: { Farming: 65 }, predicates: [{ kind: 'area', id: 'Farming Guild' }, { kind: 'manual', key: 'hespori-planting', label: 'Hespori patch available; seed, seed dibber and Farming method permission available' }] },
  'Anima': { skills: { Farming: 76 }, predicates: [{ kind: 'area', id: 'Farming Guild' }, { kind: 'item', id: 'anima-seed', label: 'An anima seed to plant', usage: 'consume' }, { kind: 'manual', key: 'anima-planting', label: 'Anima patch available, seed dibber available, and planting permitted by Farming method unlocks' }] },
  'Vinery': { skills: { Farming: 36 }, predicates: [{ kind: 'area', id: 'Hosidius' }, { kind: 'manual', key: 'vinery-planting', label: 'Grape seed, saltpetre, gardening trowel and seed dibber available; a vine patch and this Farming method are available' }] },

  // ---- Mobility (gated teleport items) ---------------------------------------
  'Canoes': { skills: { Woodcutting: 12 }, predicates: [{ kind: 'manual', key: 'canoe-route', label: 'Legal canoe station, axe, selected canoe level and Woodcutting method permission available' }], noteIsInformational: true, note: 'Canoe tiers require12,27,42 or57 Woodcutting.' },
  'Slayer Ring': { predicates: [{ kind: 'item', id: 'slayer-ring', label: 'A charged Slayer ring', usage: 'hold' }], noteIsInformational: true, note: 'Rings may be bought with Slayer points; crafting requires 75 Crafting and the Ring Bling unlock.' },
  "Xeric's Talisman": { predicates: [{ kind: 'item', id: 'xerics-talisman', label: 'A charged Xeric talisman with the chosen destination unlocked', usage: 'hold' }], noteIsInformational: true, note: 'Only Xeric Honour requires an ancient tablet; Architectural Alliance is no longer required for Xeric Heart.' },

  // ---- Player-owned house facilities (Construction) --------------------------
  'Restoration Pools': houseFeature('Restoration Pools'),
  'Jewellery Box': houseFeature('Jewellery Box'),
  'Lectern': houseFeature('Lectern'),
  'Workshop Tools': houseFeature('Workshop Tools'),
  'Combat Dummy': houseFeature('Combat Dummy'),
  'Mounted Mythical Cape': houseFeature('Mounted Mythical Cape'),
  "Mounted Xeric's Talisman": houseFeature("Mounted Xeric's Talisman"),
  'Mounted Digsite Pendant': houseFeature('Mounted Digsite Pendant'),
  'Spellbook Altars': houseFeature('Spellbook Altars'),
  'Armour Case': houseFeature('Armour Case'),
  'Magic Wardrobe': houseFeature('Magic Wardrobe'),
  'Cape Rack': houseFeature('Cape Rack'),
  'Treasure Chest (Clues)': houseFeature('Treasure Chest (Clues)'),
  'Toy Box': houseFeature('Toy Box'),
  'Armour Repair Stand': houseFeature('Armour Repair Stand'),
  'Telescope': houseFeature('Telescope'),
  'Aquarium': { predicates: [{ kind: 'unknown', key: 'aquarium-mapping', label: 'The Aquarium catalog entry has no verified OSRS facility mapping; do not assume a 63 Construction unlock' }] },
  'Bedroom (Servant)': houseFeature('Bedroom (Servant)'),
  "Servant's Moneybag": houseFeature("Servant's Moneybag"),
  'Achievement Cape Hanger': houseFeature('Achievement Cape Hanger'),
  'Dining Table': houseFeature('Dining Table'),
  'Boss Lair': houseFeature('Boss Lair'),
  'Garden Theme': houseFeature('Garden Theme'),

  // ---- Storage (quest/level gated, or notable source) ------------------------
  'Flamtaer Bag': { predicates: [{ kind: 'item', id: 'flamtaer-bag', label: 'A Flamtaer bag with space for timber beams, limestone bricks or swamp paste', usage: 'hold' }] },
  'Seed Vault': { skills: { Farming: 45 }, predicates: [{ kind: 'area', id: 'Farming Guild' }, { kind: 'manual', key: 'seed-vault-account', label: 'Account mode permits seed vault storage (unavailable to Ultimate Ironmen)' }] },
  'Fossil Storage': { quests: ['Bone Voyage'], predicates: [{ kind: 'manual', key: 'fossil-storage-access', label: 'A legally reachable Fossil Island fossil storage crate is available for the selected fossils' }] },
  'Plank Sack': { predicates: [{ kind: 'item', id: 'plank-sack', label: 'A plank sack with space for planks', usage: 'hold' }] },
  "Huntsman's Kit": { predicates: [{ kind: 'item', id: 'huntsmans-kit', label: 'A Huntsman kit for supported Hunter equipment', usage: 'hold' }] },
  'Meat Pouch': { predicates: [{ kind: 'item', id: 'meat-pouch', label: 'A small or large meat pouch with space for eligible raw meat', usage: 'hold' }], noteIsInformational: true, note: 'Hunter-crafted storage, not a Forestry shop reward.' },
  'Essence Pouches': { predicates: [{ kind: 'manual', key: 'essence-pouch-use', label: 'A usable essence pouch is available and its Runecraft level is met: small 1, medium 25, large 50, giant 75; colossal starts at 25 with scaling capacity' }] },
  'Seed Box': { predicates: [{ kind: 'item', id: 'seed-box', label: 'A seed box with an available seed slot', usage: 'hold' }] },
  'Herb Sack': { skills: { Herblore: 58 }, predicates: [{ kind: 'item', id: 'herb-sack', label: 'A herb sack with room for the selected grimy herbs', usage: 'hold' }] },
  'Gem Bag': { predicates: [{ kind: 'item', id: 'gem-bag', label: 'A gem bag with space for supported uncut gems', usage: 'hold' }] },
  'Coal Bag': { predicates: [{ kind: 'item', id: 'coal-bag', label: 'A coal bag with space for coal', usage: 'hold' }] },
  'Fish Barrel': { predicates: [{ kind: 'item', id: 'fish-barrel', label: 'A fish barrel or fish sack barrel with space for eligible raw fish', usage: 'hold' }], noteIsInformational: true, note: 'Withdraw at an appropriate bank facility; eligible fish and bank access restrictions still apply.' },
  'Tackle Box': { predicates: [{ kind: 'item', id: 'tackle-box', label: 'A tackle box for supported fishing equipment', usage: 'hold' }], noteIsInformational: true, note: 'Tempoross reward, not Fishing Trawler.' },
  'Log Basket': { predicates: [{ kind: 'item', id: 'log-basket', label: 'A log basket or Forestry basket with space for supported logs', usage: 'hold' }], noteIsInformational: true, note: 'Forestry reward; acquiring it and using it are separate.' },
  'Beginner STASH': stashFeature('Beginner', 12),
  'Easy STASH': stashFeature('Easy', 27),
  'Medium STASH': stashFeature('Medium', 42),
  'Hard STASH': stashFeature('Hard', 55),
  'Elite STASH': stashFeature('Elite', 77),
  'Master STASH': stashFeature('Master', 88),
};

/**
 * Resolve readiness from the curated non-geographic gates plus the canonical
 * boss/minigame access map. Keeping the area source in one place prevents an
 * Omni-unlocked activity from appearing ready while its location is blocked.
 */
const REQUIREMENTS_BY_ID = indexActivityRecords(ACTIVITY_REQUIREMENTS);
const ACCESS_BY_ID = indexActivityRecords(ACTIVITY_ACCESS_AREAS);

export const getActivityReq = (item: string): ActivityReq | undefined => {
  const id = activityId(item);
  const requirement = id ? REQUIREMENTS_BY_ID.get(id) : undefined;
  const requiredAreas = id ? ACCESS_BY_ID.get(id) : undefined;
  if (!requirement && !requiredAreas) return undefined;
  return {
    ...(requirement ?? { predicates: [{ kind: 'unknown' as const, key: 'unreviewed-access', label: 'Non-geographic access requirements have not been reviewed' }] }),
    ...(requiredAreas ? { requiredAreas: [...requiredAreas] } : {}),
  };
};
