// The names the game prints in each boss's kill-count line, by the app's boss
// key, so RuneLite can say which boss a kill was.
//
// The game's line reads "Your Vorkath kill count is: 12.", "Your completed
// Chambers of Xeric count is: 51." or "Your subdued Wintertodt count is: 4.";
// the name is what sits between "Your" (and "completed", "subdued" or
// "completion count for") and the word "count". RuneLite compares names
// without regard to case or colour tags.
//
// SEEN names appear in real messages in RuneLite's own tests
// (ChatCommandsPluginTest) and in contracts/detected-events. The others are the
// boss's own name, and for a "The ..." boss its name without "The": a name the
// game doesn't print only means those kills aren't noticed, and the player logs
// them by hand as always. A name must never belong to two bosses.

import { BOSS_TIERS } from './bossKeyTiers';
import { BRUTUS_BOSS_NAME } from '../config/vanillaKeyEconomy';

export const BOSS_KILL_COUNTS: Readonly<Record<string, readonly string[]>> = {
  // ── Raids ──
  'Chambers of Xeric': ['Chambers of Xeric', 'Chambers of Xeric Challenge Mode'], // SEEN both
  'Theatre of Blood': ['Theatre of Blood', 'Theatre of Blood: Entry Mode', 'Theatre of Blood: Hard Mode'], // SEEN the first two
  'Tombs of Amascut': ['Tombs of Amascut', 'Tombs of Amascut: Entry Mode', 'Tombs of Amascut: Expert Mode'], // SEEN all three

  // ── High ──
  'The Gauntlet': ['Gauntlet', 'Corrupted Gauntlet'], // SEEN both
  'The Nightmare': ['Nightmare', 'The Nightmare'], // SEEN "Nightmare"
  "Phosani's Nightmare": ["Phosani's Nightmare"],
  'Nex': ['Nex'],
  'Corporeal Beast': ['Corporeal Beast'], // SEEN
  'Araxxor': ['Araxxor'],
  'Maggot King': ['Maggot King'],
  'Fortis Colosseum': ['Sol Heredit', 'Fortis Colosseum'],
  'Duke Sucellus': ['Duke Sucellus', 'Duke Sucellus (Awakened)'],
  'The Leviathan': ['Leviathan', 'The Leviathan', 'Leviathan (Awakened)'],
  'The Whisperer': ['Whisperer', 'The Whisperer', 'Whisperer (Awakened)'],
  'Vardorvis': ['Vardorvis', 'Vardorvis (Awakened)'],
  'Inferno': ['TzKal-Zuk'], // SEEN
  'Yama': ['Yama'],
  'Doom of Mokhaiotl': ['Doom of Mokhaiotl'],

  // ── Mid ──
  'The Mad Angel': ['Mad Angel', 'The Mad Angel'],
  'General Graardor': ['General Graardor'],
  'Commander Zilyana': ['Commander Zilyana'],
  "Kree'arra": ["Kree'arra"], // SEEN
  "K'ril Tsutsaroth": ["K'ril Tsutsaroth"],
  'Abyssal Sire': ['Abyssal Sire'],
  'Alchemical Hydra': ['Alchemical Hydra'],
  'Cerberus': ['Cerberus'],
  'Grotesque Guardians': ['Grotesque Guardians'], // SEEN
  'Kraken': ['Kraken'],
  'Skotizo': ['Skotizo'],
  'Thermonuclear Smoke Devil': ['Thermonuclear Smoke Devil'],
  'Artio': ['Artio'],
  'Callisto': ['Callisto'],
  "Calvar'ion": ["Calvar'ion"],
  'Chaos Elemental': ['Chaos Elemental'],
  'Spindel': ['Spindel'],
  'Venenatis': ['Venenatis'],
  "Vet'ion": ["Vet'ion"],
  'Vorkath': ['Vorkath'],
  'Galvek': ['Galvek'],
  'The Hueycoatl': ['Hueycoatl', 'The Hueycoatl'],
  'Kalphite Queen': ['Kalphite Queen'],
  'Phantom Muspah': ['Phantom Muspah'],
  'Zulrah': ['Zulrah'], // SEEN
  'TzHaar Fight Cave': ['TzTok-Jad'], // SEEN
  "TzHaar-Ket-Rak's Challenges": [
    "TzHaar-Ket-Rak's First Challenge",
    "TzHaar-Ket-Rak's Second Challenge",
    "TzHaar-Ket-Rak's Third Challenge",
    "TzHaar-Ket-Rak's Fourth Challenge",
    "TzHaar-Ket-Rak's Fifth Challenge",
    "TzHaar-Ket-Rak's Sixth Challenge",
  ],
  'Tormented Demons': ['Tormented Demon', 'Tormented Demons'],

  // ── Low ──
  'Chaos Fanatic': ['Chaos Fanatic'],
  'Crazy Archaeologist': ['Crazy Archaeologist'],
  'Scorpia': ['Scorpia'],
  'Moons of Peril': ['Lunar Chest', 'Lunar Chests'],
  'Barrows Brothers': ['Barrows chest', 'Barrows Chests'], // SEEN "Barrows chest"
  'Bryophyta': ['Bryophyta'],
  'Dagannoth Kings': ['Dagannoth Rex', 'Dagannoth Prime', 'Dagannoth Supreme'],
  'Deranged Archaeologist': ['Deranged Archaeologist'],
  'Giant Mole': ['Giant Mole'],
  'Hespori': ['Hespori'],
  'King Black Dragon': ['King Black Dragon'],
  'Mimic': ['Mimic', 'The Mimic'],
  'Obor': ['Obor'],
  'Sarachnis': ['Sarachnis'],
  'Scurrius': ['Scurrius'],
  'Wintertodt': ['Wintertodt'], // SEEN
  'Tempoross': ['Tempoross'], // SEEN
  'Zalcano': ['Zalcano'],
  'Amoxliatl': ['Amoxliatl'],
  'The Royal Titans': ['Royal Titans', 'The Royal Titans'],
  'Gemstone Crab': ['Gemstone Crab'],
  'Shellbane Gryphon': ['Shellbane Gryphon'],
  [BRUTUS_BOSS_NAME]: [BRUTUS_BOSS_NAME],
};

/** Whether a boss key is a raid, which the Roll Inbox rolls as a raid completion. */
export const isRaidKey = (key: string): boolean => BOSS_TIERS[key] === 'raid';
