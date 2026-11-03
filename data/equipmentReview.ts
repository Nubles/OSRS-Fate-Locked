/**
 * Reviewed Fate tiers for equipment the Codex material ladder can't name, so
 * the gear picker shows no stat-based estimates for the pinned catalogue.
 *
 * - WIELD_LEVELS are OSRS Wiki facts (each item's page, checked 15 October
 *   2026). requirementTier() in utils/equipmentReviewTiers.ts places an item with the
 *   Codex material that needs the same level: a level-50 Attack weapon sits
 *   with rune at T5.
 * - PLACED are Fate choices for items whose wield level doesn't decide their
 *   tier, grouped by the reason.
 *
 * Keys are lower-case item names; every variant with that name shares the
 * tier. Loaded lazily by services/GearService.ts, so it stays out of the
 * entry chunk. data/equipmentReview.test.ts fails when a catalogue update
 * brings gear that needs a placement here.
 */
import type { EquipmentReview, WieldLevels } from '../utils/gearTiers';

const at = (tier: number, names: string[]): Record<string, number> =>
  Object.fromEntries(names.map(name => [name.toLowerCase(), tier]));

const WIELD_LEVELS: Record<string, WieldLevels> = {
  'ancient mace': { attack: 15 },
  'ancient wyvern shield': { defence: 75, magic: 70 },
  'archer helm': { defence: 45 },
  'arclight': { attack: 75 },
  'arkan blade': { attack: 60 },
  'barrelchest anchor': { attack: 60, strength: 40 },
  'barrelchest anchor (bh)': { attack: 50, strength: 40 },
  'barronite mace': { attack: 40 },
  'belle\'s folly': { attack: 65 },
  'berserker helm': { defence: 45 },
  'blade of saeldor': { attack: 80 },
  'blade of saeldor (c)': { attack: 80 },
  'blade of saeldor (c) (amlodd)': { attack: 80 },
  'blade of saeldor (c) (cadarn)': { attack: 80 },
  'blade of saeldor (c) (crwys)': { attack: 80 },
  'blade of saeldor (c) (iorwerth)': { attack: 80 },
  'blade of saeldor (c) (ithell)': { attack: 80 },
  'blade of saeldor (c) (meilyr)': { attack: 80 },
  'blade of saeldor (c) (trahaearn)': { attack: 80 },
  'blisterwood flail': { attack: 50 },
  'blisterwood sickle': { attack: 50 },
  'blisterwood sickle (e)': { attack: 50 },
  'bloodbark body': { defence: 60, magic: 60 },
  'bloodbark boots': { defence: 60, magic: 60 },
  'bloodbark gauntlets': { defence: 60, magic: 60 },
  'bloodbark helm': { defence: 60, magic: 60 },
  'bloodbark legs': { defence: 60, magic: 60 },
  'blurite crossbow': { ranged: 16 },
  'bone mace': { attack: 50 },
  'bone shortbow': { ranged: 50 },
  'boots of brimstone': { defence: 70, ranged: 70, magic: 70 },
  'brine sabre': { attack: 40 },
  'broodoo shield (combat)': { defence: 25, magic: 25 },
  'broodoo shield (disease)': { defence: 25, magic: 25 },
  'broodoo shield (poison)': { defence: 25, magic: 25 },
  'bryophyta\'s staff': { attack: 30, magic: 30 },
  'cabbage round shield': { defence: 30 },
  'cleaver': { attack: 40 },
  'coif': { ranged: 20 },
  'colossal blade': { attack: 60 },
  'comp ogre bow': { ranged: 30 },
  'corrupted morrigan\'s coif (bh)': { defence: 20 },
  'corrupted statius\'s full helm (bh)': { defence: 20 },
  'corrupted statius\'s platebody (bh)': { defence: 20 },
  'corrupted statius\'s platelegs (bh)': { defence: 20 },
  'corrupted vesta\'s chainbody (bh)': { defence: 20 },
  'corrupted vesta\'s plateskirt (bh)': { defence: 20 },
  'corrupted zuriel\'s hood (bh)': { defence: 20 },
  'corrupted zuriel\'s robe bottom (bh)': { defence: 20 },
  'corrupted zuriel\'s robe top (bh)': { defence: 20 },
  'crimson kisten': { attack: 60, strength: 85 },
  'crystal axe': { attack: 70 },
  'crystal felling axe': { attack: 70 },
  'crystal harpoon': { attack: 70 },
  'crystal pickaxe': { attack: 70 },
  'dagon\'hai hat': { defence: 40, magic: 70 },
  'dagon\'hai robe bottom': { defence: 40, magic: 70 },
  'dagon\'hai robe top': { defence: 40, magic: 70 },
  'dark infinity bottoms': { defence: 25, magic: 50 },
  'dark infinity hat': { defence: 25, magic: 50 },
  'dark infinity top': { defence: 25, magic: 50 },
  'decorative armour (magic hat)': { magic: 20 },
  'decorative armour (magic legs)': { magic: 20 },
  'decorative armour (magic top)': { magic: 20 },
  'decorative armour (quiver)': { ranged: 30 },
  'decorative armour (ranged legs)': { ranged: 30 },
  'decorative armour (ranged top)': { ranged: 30 },
  'dinh\'s blazing bulwark': { attack: 75, defence: 75 },
  'dorgeshuun crossbow': { ranged: 28 },
  'dragonstone gauntlets': { defence: 40 },
  'dwarven helmet': { defence: 50 },
  'earthbound tecpatl': { attack: 55 },
  'elder chaos hood': { magic: 40 },
  'elder chaos hood (or)': { magic: 40 },
  'elder chaos robe': { magic: 40 },
  'elder chaos robe (or)': { magic: 40 },
  'elder chaos top': { magic: 40 },
  'elder chaos top (or)': { magic: 40 },
  'excalibur': { attack: 20 },
  'eye of ayak': { magic: 83 },
  'farseer helm': { defence: 45 },
  'fighter hat': { defence: 45 },
  'fremennik blade': { attack: 30 },
  'fremennik helm': { defence: 30 },
  'fremennik shield': { defence: 30 },
  'frying pan': { attack: 20 },
  'gilded coif': { ranged: 40 },
  'glacial temotli': { attack: 55 },
  'gold helmet': { defence: 30 },
  'granite body': { strength: 50, defence: 50 },
  'granite boots': { strength: 50, defence: 50 },
  'granite gloves': { strength: 50, defence: 50 },
  'granite hammer': { attack: 50, strength: 50 },
  'granite helm': { strength: 50, defence: 50 },
  'granite legs': { strength: 50, defence: 50 },
  'granite longsword': { attack: 50, strength: 50 },
  'granite ring': { strength: 50, defence: 50 },
  'granite ring (i)': { strength: 50, defence: 50 },
  'granite shield': { strength: 50, defence: 50 },
  'hallowed flail': { attack: 50 },
  'hallowfell': { attack: 75 },
  'hardleather body': { defence: 10 },
  'harry\'s cutlass': { attack: 20 },
  'healer hat': { defence: 45 },
  'hill giant club': { attack: 40 },
  'hunter\'s spear': { strength: 30, ranged: 55 },
  'hunters\' crossbow': { ranged: 50 },
  'hunters\' sunlight crossbow': { ranged: 66 },
  'infernal axe (or)': { attack: 60 },
  'infernal axe (or) (trailblazer reloaded)': { attack: 60 },
  'infernal harpoon (or)': { attack: 60 },
  'infernal harpoon (or) (trailblazer reloaded)': { attack: 60 },
  'infernal pickaxe': { attack: 60 },
  'infernal pickaxe (or)': { attack: 60 },
  'infernal pickaxe (or) (trailblazer reloaded)': { attack: 60 },
  'infinity boots': { defence: 25, magic: 50 },
  'infinity bottoms': { defence: 25, magic: 50 },
  'infinity gloves': { defence: 25, magic: 50 },
  'infinity hat': { defence: 25, magic: 50 },
  'infinity top': { defence: 25, magic: 50 },
  'ivandis flail': { attack: 40 },
  'katana': { attack: 40 },
  'keris': { attack: 50 },
  'kitchen knife': { attack: 40 },
  'leaf-bladed battleaxe': { attack: 65 },
  'leaf-bladed spear': { attack: 50 },
  'leaf-bladed sword': { attack: 50 },
  'light infinity bottoms': { defence: 25, magic: 50 },
  'light infinity hat': { defence: 25, magic: 50 },
  'light infinity top': { defence: 25, magic: 50 },
  'lucky cutlass': { attack: 30 },
  'lunar boots': { defence: 40, magic: 65 },
  'lunar cape': { defence: 40, magic: 65 },
  'lunar gloves': { defence: 40, magic: 65 },
  'lunar helm': { defence: 40, magic: 65 },
  'lunar legs': { defence: 40, magic: 65 },
  'lunar staff': { magic: 65 },
  'lunar torso': { defence: 40, magic: 65 },
  'mage\'s book': { magic: 60 },
  'magic shield': { defence: 40 },
  'malediction ward': { defence: 60 },
  'malediction ward (or)': { defence: 60 },
  'maple blackjack(d)': { defence: 30 },
  'maple blackjack(o)': { attack: 30 },
  'maple shield': { defence: 40 },
  'meat tenderiser': { attack: 40 },
  'mirror shield': { defence: 20 },
  'mixed hide boots': { defence: 50, ranged: 60 },
  'mixed hide cape': { defence: 50, ranged: 60 },
  'mixed hide legs': { ranged: 60 },
  'mixed hide top': { defence: 50, ranged: 60 },
  'morrigan\'s coif (bh)': { defence: 78 },
  'morrigan\'s coif (deadman mode)': { defence: 78 },
  'morrigan\'s javelin (bh)': { ranged: 75 },
  'morrigan\'s javelin (deadman mode)': { ranged: 78 },
  'morrigan\'s throwing axe (bh)': { ranged: 75 },
  'morrigan\'s throwing axe (deadman mode)': { ranged: 78 },
  'neitiznot shield': { defence: 25 },
  'noxious halberd': { attack: 80 },
  'oak shield': { defence: 10 },
  'odium ward': { defence: 60 },
  'odium ward (or)': { defence: 60 },
  'ogre bow': { ranged: 30 },
  'penance gloves': { defence: 40 },
  'penance skirt': { defence: 40, ranged: 60 },
  'pharaoh\'s sceptre': { attack: 30, magic: 30 },
  'ram skull helm': { defence: 30 },
  'ranger boots': { ranged: 40 },
  'ranger gloves': { ranged: 40 },
  'ranger hat': { defence: 45 },
  'rangers\' tights': { ranged: 40 },
  'rangers\' tunic': { ranged: 40 },
  'rapier': { attack: 40 },
  'redwood shield': { defence: 40 },
  'robin hood hat': { ranged: 40 },
  'rolling pin': { attack: 40 },
  'runner boots': { defence: 40 },
  'runner hat': { defence: 45 },
  'samurai boots': { defence: 35 },
  'samurai gloves': { defence: 35 },
  'samurai greaves': { defence: 35 },
  'samurai kasa': { defence: 35 },
  'samurai shirt': { defence: 35 },
  'sarachnis cudgel': { attack: 65 },
  'scorching bow': { ranged: 77 },
  'seercull': { ranged: 50 },
  'shayzien body (5)': { defence: 20 },
  'shayzien boots (1)': { defence: 20 },
  'shayzien boots (2)': { defence: 20 },
  'shayzien boots (3)': { defence: 20 },
  'shayzien boots (4)': { defence: 20 },
  'shayzien boots (5)': { defence: 20 },
  'shayzien gloves (1)': { defence: 20 },
  'shayzien gloves (2)': { defence: 20 },
  'shayzien gloves (3)': { defence: 20 },
  'shayzien gloves (4)': { defence: 20 },
  'shayzien gloves (5)': { defence: 20 },
  'shayzien greaves (1)': { defence: 20 },
  'shayzien greaves (2)': { defence: 20 },
  'shayzien greaves (3)': { defence: 20 },
  'shayzien greaves (4)': { defence: 20 },
  'shayzien greaves (5)': { defence: 20 },
  'shayzien helm (1)': { defence: 20 },
  'shayzien helm (2)': { defence: 20 },
  'shayzien helm (3)': { defence: 20 },
  'shayzien helm (4)': { defence: 20 },
  'shayzien helm (5)': { defence: 20 },
  'shayzien platebody (1)': { defence: 20 },
  'shayzien platebody (2)': { defence: 20 },
  'shayzien platebody (3)': { defence: 20 },
  'shayzien platebody (4)': { defence: 20 },
  'skeletal bottoms': { defence: 40, magic: 40 },
  'skeletal helm': { defence: 40, magic: 40 },
  'skeletal top': { defence: 40, magic: 40 },
  'skewer': { attack: 30 },
  'snakeskin bandana': { defence: 30, ranged: 30 },
  'snakeskin body': { defence: 30, ranged: 30 },
  'snakeskin boots': { defence: 30, ranged: 30 },
  'snakeskin chaps': { defence: 30, ranged: 30 },
  'snakeskin shield': { defence: 30, ranged: 30 },
  'snakeskin vambraces': { defence: 30, ranged: 30 },
  'soulflame horn': { magic: 80 },
  'spatula': { attack: 10 },
  'spiny helmet': { defence: 5 },
  'spirit shield': { defence: 45 },
  'splitbark body': { defence: 40, magic: 40 },
  'splitbark boots': { defence: 40, magic: 40 },
  'splitbark gauntlets': { defence: 40, magic: 40 },
  'splitbark helm': { defence: 40, magic: 40 },
  'splitbark legs': { defence: 40, magic: 40 },
  'spork': { attack: 10 },
  'statius\'s full helm (bh)': { defence: 78 },
  'statius\'s full helm (deadman mode)': { defence: 78 },
  'statius\'s platebody (bh)': { defence: 78 },
  'statius\'s platebody (deadman mode)': { defence: 78 },
  'statius\'s platelegs (bh)': { defence: 78 },
  'statius\'s platelegs (deadman mode)': { defence: 78 },
  'statius\'s warhammer (bh)': { strength: 75 },
  'statius\'s warhammer (deadman mode)': { attack: 78 },
  'sulphur blades': { attack: 55 },
  'swampbark body': { defence: 50, magic: 50 },
  'swampbark boots': { defence: 50, magic: 50 },
  'swampbark gauntlets': { defence: 50, magic: 50 },
  'swampbark helm': { defence: 50, magic: 50 },
  'swampbark legs': { defence: 50, magic: 50 },
  'twinflame staff': { magic: 60 },
  'tyras helm': { defence: 5 },
  'v\'s shield': { defence: 40 },
  'vesta\'s blighted longsword': { attack: 75 },
  'vesta\'s chainbody (bh)': { defence: 78 },
  'vesta\'s chainbody (deadman mode)': { defence: 78 },
  'vesta\'s longsword (bh)': { attack: 75 },
  'vesta\'s longsword (deadman mode)': { attack: 78 },
  'vesta\'s plateskirt (bh)': { defence: 78 },
  'vesta\'s plateskirt (deadman mode)': { defence: 78 },
  'vesta\'s spear (bh)': { attack: 75 },
  'vesta\'s spear (deadman mode)': { attack: 78 },
  'warrior helm': { defence: 45 },
  'willow blackjack(o)': { attack: 20 },
  'willow shield': { defence: 30 },
  'wizard boots': { magic: 20 },
  'yak-hide armour (legs)': { defence: 20 },
  'yak-hide armour (top)': { defence: 20 },
  'yew shield': { defence: 40 },
  'zombie axe': { attack: 65 },
  'zombie helmet': { strength: 50, defence: 50 },
  'zuriel\'s hood (bh)': { defence: 78 },
  'zuriel\'s hood (deadman mode)': { defence: 78 },
  'zuriel\'s robe bottom (bh)': { defence: 78 },
  'zuriel\'s robe bottom (deadman mode)': { defence: 78 },
  'zuriel\'s robe top (bh)': { defence: 78 },
  'zuriel\'s robe top (deadman mode)': { defence: 78 },
  'zuriel\'s staff (bh)': { attack: 30, magic: 75 },
  'zuriel\'s staff (deadman mode)': { magic: 78 },
};

const PLACED: Record<string, number> = {
  // Handed out inside an activity and lost on leaving it, so it never restricts: Castle Wars, the Warriors' Guild catapult, Theatre of Blood, Emir's Arena and quest-only weapons.
  ...at(1, [
    'Castle wars arrow', 'Castle wars bolts', 'Defensive shield', 'Dawnbringer', 'Corrupted sceptre',
    'Crystal sceptre', 'Silvthrill ballista', 'Silvthrill javelin', 'Spine', 'Saika\'s hood',
    'Saika\'s shroud', 'Saika\'s veil', 'Koriff\'s coif', 'Lunar staff - pt1', 'Lunar staff - pt2',
    'Lunar staff - pt3',
  ]),
  // Not obtainable on normal worlds (Deadman starter packs, past events) and only iron-level stats or less.
  ...at(1, [
    'Starter sword', 'Starter bow', 'Starter staff', 'Wilderness cape (Wilderness Wars)',
    'Wilderness cape (Wilderness Wars, Champion)', 'Clue hunter garb', 'Ornate top', 'Ornate legs',
    'Crystal blessing', 'Corrupted helm', 'Corrupted platebody', 'Corrupted platelegs',
    'Corrupted plateskirt', 'Corrupted kiteshield',
  ]),
  // Prayer clothing and holy items with no wield requirement.
  ...at(1, [
    'Monk\'s robe', 'Monk\'s robe (g)', 'Monk\'s robe (t)', 'Monk\'s robe top', 'Monk\'s robe top (g)',
    'Monk\'s robe top (t)', 'Druid\'s robe', 'Druid\'s robe top', 'Priest gown (top)', 'Priest gown (bottom)',
    'Shade robe', 'Shade robe top', 'Zealot\'s robe top', 'Zealot\'s robe bottom', 'Zamorak monk top',
    'Zamorak monk bottom', 'Ancient ceremonial top', 'Ancient ceremonial legs', 'Ancient ceremonial gloves',
    'Holy symbol', 'Unholy symbol', 'Ring of the gods', 'Ring of the gods (i)', 'Holy book', 'Holy book (or)',
    'Unholy book', 'Unholy book (or)', 'Book of Balance', 'Book of Balance (or)', 'Book of Darkness',
    'Book of Darkness (or)', 'Book of Law', 'Book of Law (or)', 'Book of War', 'Book of War (or)',
    'Book of the Dead', 'Salve amulet', 'Salve amulet (e)', 'Salve amulet(i)', 'Salve amulet(ei)',
  ]),
  // Prayer gear with a Prayer requirement sits with the clue vestments (T3), whatever its Prayer level.
  ...at(3, [
    'Holy sandals', 'Holy moleys', 'Holy wraps', 'Devout boots', 'Soul cape', 'Bonecrusher necklace',
    'Dragonbone necklace', 'Antler guard',
  ]),
  // Skilling and utility outfits with no combat wield level: Hunter furs, Rogue equipment, snelms, quest and diary trinkets.
  ...at(1, [
    'Larupia top', 'Larupia legs', 'Graahk top', 'Graahk legs', 'Kyatt top', 'Kyatt legs', 'Rogue mask',
    'Rogue top', 'Rogue trousers', 'Blood\'n\'tar snelm', 'Broken bark snelm', 'Bruise blue snelm',
    'Myre snelm', 'Ochre snelm', 'Vampyre snelm', 'Pointed blood\'n\'tar snelm', 'Pointed bruise blue snelm',
    'Pointed myre snelm', 'Pointed ochre snelm', 'Bearhead', 'Cape of legends', 'Tortugan shield',
    'Gnome amulet', 'Helmet of the moon', 'Khazard armour', 'Fremennik kilt', 'Karamja gloves 1',
    'Karamja gloves 2', 'Karamja gloves 3', 'Karamja gloves 4', 'Explorer\'s ring 1', 'Explorer\'s ring 2',
    'Explorer\'s ring 3', 'Explorer\'s ring 4', 'Rada\'s blessing 2', 'Rada\'s blessing 3',
    'Rada\'s blessing 4', 'Maple blackjack', 'Dramen staff', 'Jade machete', 'Red topaz machete',
    'Holy water', 'Wolfbane', 'Blisterwood stake', 'Diamond sickle (b)', 'Enchanted diamond sickle (b)',
    'Emerald sickle (b)', 'Enchanted emerald sickle (b)', 'Ruby sickle (b)', 'Enchanted ruby sickle (b)',
    'Silver sickle (b)', 'Dual sai', 'Nunchaku', 'Heavy casket', 'Zombie head (Treasure Trails)',
    'Guthix mjolnir', 'Saradomin mjolnir', 'Zamorak mjolnir', 'Scythe (Halloween event)', 'Regen bracelet',
  ]),
  // Salamander tar is fuel, not ammunition with a metal: the salamander's own tier applies.
  ...at(1, [
    'Guam tar', 'Marrentill tar', 'Tarromin tar', 'Harralander tar', 'Irit tar',
  ]),
  // Bolt racks are Barrows ammunition for Karil's crossbow.
  ...at(7, [
    'Bolt rack',
  ]),
  // Same bonuses as Barrows gloves (league and unreleased versions).
  ...at(7, [
    'Gloves of the Damned', 'Wristbands of the Arena', 'Wristbands of the Arena (i)',
  ]),
  // Same bonuses as an amulet of glory.
  ...at(4, [
    'Amulet of avarice', 'Amulet of the Damned',
  ]),
  // Upgrades of T8 Zenyte jewellery.
  ...at(9, [
    'Confliction gauntlets', 'Necklace of rupture',
  ]),
  // V's helm works like an imbued Slayer helmet (T7).
  ...at(7, [
    'V\'s helm',
  ]),
  // Gauntlet tools and armour are made inside the Gauntlet and lost on leaving it.
  ...at(1, [
    'Corrupted axe', 'Corrupted harpoon', 'Corrupted pickaxe', 'Crystal axe (The Gauntlet)',
    'Crystal dagger (perfected)', 'Crystal harpoon (The Gauntlet)', 'Crystal pickaxe (The Gauntlet)',
  ]),
  // Ammunition sits with the metal ammunition of the same ranged strength, not its launcher's wield level (barbed, blurite, bone, silver and kebbit bolts are at or below iron bolts).
  ...at(1, [
    'Barbed bolts', 'Blurite bolts', 'Bone bolts', 'Silver bolts', 'Kebbit bolts', 'Long kebbit bolts',
    'Ancient blessing', 'Holy blessing', 'Honourable blessing', 'Peaceful blessing', 'Unholy blessing',
    'War blessing',
  ]),
  // Ice arrows match steel arrows; antler bolts sit between iron and steel bolts.
  ...at(2, [
    'Ice arrows', 'Moonlight antler bolts', 'Sunlight antler bolts',
  ]),
  // Ogre arrows have mithril arrows' ranged strength.
  ...at(3, [
    'Ogre arrow',
  ]),
  // Same bonuses as iron armour: account-type and event armour, and Song of the Elves' Ardougne knight pieces.
  ...at(1, [
    'Ironman platebody', 'Ironman platelegs', 'Hardcore ironman platebody', 'Hardcore ironman platelegs',
    'Ultimate ironman platebody', 'Ultimate ironman platelegs', 'Group ironman platebody',
    'Group ironman platelegs', 'Group ironman platebody (unranked)', 'Group ironman platelegs (unranked)',
    'Hardcore group ironman platebody', 'Hardcore group ironman platelegs', 'Ardougne knight platebody',
    'Ardougne knight platelegs', 'Deadman\'s chest', 'Deadman\'s legs', 'Carnillean armour', 'Blurite sword',
    'Shadow sword',
  ]),
  // Diary rewards match iron gear at the easy tier.
  ...at(1, [
    'Falador shield 1', 'Morytania legs 1', 'Kandarin headgear 1', 'Fremennik sea boots 1',
    'Wilderness sword 1',
  ]),
  // Diary rewards that match steel or black gear.
  ...at(2, [
    'Varrock armour 1', 'Varrock armour 2', 'Kandarin headgear 3',
  ]),
  // Diary rewards that match mithril gear.
  ...at(3, [
    'Varrock armour 3',
  ]),
  // Elite diary rewards that match adamant gear.
  ...at(4, [
    'Varrock armour 4', 'Falador shield 4',
  ]),
  // Not obtainable on normal worlds (Leagues echo items) or no wield level listed;
  // kept at their stat placement so the gear planner still ranks them sensibly.
  ...at(8, ['Devil\'s element']),
  ...at(4, ['Fang of the hound']),
  ...at(6, ['Infernal tecpatl']),
  ...at(9, ['King\'s barrage']),
  ...at(7, ['Lithic sceptre']),
  ...at(4, ['Nature\'s recurve']),
  ...at(9, ['Shadowflame quadrant']),
  ...at(8, ['Sunspear']),
  ...at(9, ['Wilderness champion amulet']),
  // No wield level, but the same bonuses as a metal item: they share its tier.
  ...at(2, [
    'Arceuus banner', // Steel spear
    'Barb-tail harpoon', // Steel dagger
    'Bone club', // Steel warhammer
    'Bone spear', // Steel spear
    'Chaos gauntlets', // Steel gauntlets
    'Cooking gauntlets', // Steel gauntlets
    'Darklight', // Steel longsword
    'Falador shield 2', // Steel kiteshield (g)
    'Fremennik sea boots 2', // Steel boots
    'Fremennik sea boots 3', // Black boots
    'Goldsmith gauntlets', // Steel gauntlets
    'Hosidius banner', // Steel spear
    'Kandarin headgear 2', // Steel med helm
    'Klank\'s gauntlets', // Steel gauntlets
    'Lovakengj banner', // Steel spear
    'Morytania legs 2', // Steel platelegs
    'Piscarilius banner', // Steel spear
    'Shayzien banner', // Steel spear
    'Silverlight', // Steel longsword
    'Western banner 1', // Steel spear
    'Western banner 2', // Black spear
    'Wilderness sword 2', // Steel sword
  ]),
  ...at(3, [
    'Blessed axe', // Mithril axe
    'Combat bracelet', // Mithril gloves
    'Falador shield 3', // Mithril kiteshield (g)
    'Kandarin headgear 4', // Mithril med helm
    'Morytania legs 3', // Mithril platelegs
    'Western banner 3', // Mithril spear
    'Wilderness sword 3', // Mithril sword
  ]),
  ...at(4, [
    'Fremennik sea boots 4', // Adamant boots
    'Gadderhammer', // Adamant warhammer
    'Morytania legs 4', // Adamant platelegs
    'Western banner 4', // Adamant spear
    'Wilderness sword 4', // Adamant sword
  ]),
  ...at(6, [
    'Infernal axe', // Dragon axe
    'Infernal harpoon', // Dragon harpoon
  ]),
  // Cosmetics, quest props and tools with no wield level and near-zero bonuses.
  ...at(1, [
    '\'24-carat\' sword', '10th birthday balloons', 'Amulet of accuracy', 'Amulet of air', 'Amulet of earth',
    'Amulet of fire', 'Amulet of magic', 'Amulet of magic (t)', 'Amulet of water', 'Amy\'s saw',
    'Ancient ceremonial boots', 'Ancient ceremonial mask', 'Anger battleaxe', 'Anger mace', 'Anger spear',
    'Anger sword', 'Aquanite hopper', 'Aranea boots', 'Archibald', 'Ardougne knight helm', 'Assorted flowers',
    'Banana cape', 'Beach boxing gloves', 'Beacon ring', 'Beads of the Dead', 'Birthday balloons',
    'Birthday cake', 'Blacksmith\'s helm', 'Blue boots', 'Blue cape', 'Blue flowers', 'Blue hat',
    'Blue hat (Legends\' Quest)', 'Blue robe bottoms', 'Blue robe top', 'Bone dagger', 'Bone staff',
    'Bonesack', 'Boots of lightness', 'Boots of stone', 'Boxing gloves', 'Cabbage cape', 'Candy cane',
    'Carrot sword', 'Castlewars cloak (Saradomin)', 'Castlewars cloak (Zamorak)',
    'Castlewars hood (Saradomin)', 'Castlewars hood (Zamorak)', 'Cattleprod', 'Citizen shoes', 'Citizen top',
    'Citizen trousers', 'Climbing boots', 'Climbing boots (g)', 'Clue hunter boots', 'Clue hunter cloak',
    'Clue hunter gloves', 'Clue hunter trousers', 'Clueless scroll', 'Cormorant\'s glove', 'Crab claw',
    'Crab helmet', 'Crabclaw hook', 'Cream boots', 'Cream hat', 'Cream robe bottoms', 'Cream robe top',
    'Crier bell', 'Crossbow', 'Cursed amulet of magic', 'Cursed banana', 'Cursed goblin hammer',
    'Dark dagger', 'Dark flippers', 'Dark squall hood', 'Dark squall robe bottom', 'Dark squall robe top',
    'Deadman\'s cape', 'Diamond speedrun trophy', 'Easter basket', 'Eek', 'Egg whisk', 'Elemental amulet',
    'Elemental helmet', 'Elemental shield', 'Falconer\'s glove', 'Fancier boots', 'Fancy boots',
    'Fighting boots', 'Fine mesh net', 'Fish sack', 'Fish sack barrel', 'Flippers', 'Fremennik beige shirt',
    'Fremennik blue cloak', 'Fremennik blue shirt', 'Fremennik boots', 'Fremennik brown cloak',
    'Fremennik brown shirt', 'Fremennik cyan cloak', 'Fremennik gloves', 'Fremennik green cloak',
    'Fremennik grey cloak', 'Fremennik grey shirt', 'Fremennik hat', 'Fremennik pink cloak',
    'Fremennik purple cloak', 'Fremennik red cloak', 'Fremennik red shirt', 'Fremennik robe',
    'Fremennik skirt', 'Fremennik teal cloak', 'Fremennik yellow cloak', 'Ghostly boots', 'Ghostly cloak',
    'Ghostly gloves', 'Ghostly hood', 'Ghostly robe (bottom)', 'Ghostly robe (top)', 'Giant boulder',
    'Giant easter egg', 'Giant present', 'Giant stopwatch', 'Gloves of silence', 'Glowing dagger',
    'Gold speedrun trophy', 'Golden tench', 'Graahk headdress', 'Green boots', 'Green cape', 'Green hat',
    'Green robe bottoms', 'Green robe top', 'Gregg\'s eastdoor', 'Grey boots', 'Grey gloves', 'Grey hat',
    'Grey robe bottoms', 'Grey robe top', 'Group ironman bracers', 'Group ironman bracers (unranked)',
    'Group ironman helm', 'Group ironman helm (unranked)', 'Ham boots', 'Ham cloak', 'Ham gloves', 'Ham hood',
    'Ham robe', 'Ham shirt', 'Hand fan', 'Hardcore group ironman bracers', 'Hardcore group ironman helm',
    'Hardcore ironman helm', 'Hardleather gloves', 'Haunted wine bottle', 'Helm of Raedwald', 'Hunting knife',
    'Ice gloves', 'Insulated boots', 'Ironman helm', 'Kharedst\'s memoirs', 'Khazard helmet',
    'Koriff\'s cowl', 'Koriff\'s headband', 'Kyatt hat', 'Large spade', 'Larupia hat', 'Longbow',
    'Love crossbow', 'Lunar amulet', 'Lunar ring', 'Machete', 'Magic secateurs', 'Magic secateurs (nz)',
    'Maoma\'s full helm', 'Maoma\'s great helm', 'Maoma\'s med helm', 'Mask of Ranul', 'Merfolk trident',
    'Mind helmet', 'Mind shield', 'Mining helmet', 'Mixed flowers',
    'Mooleta', 'Moonclan armour', 'Moonclan boots', 'Moonclan cape', 'Moonclan gloves', 'Moonclan hat',
    'Moonclan helm', 'Moonclan skirt', 'Mourner boots', 'Mourner gloves', 'Mouse toy', 'Mud pie',
    'Necklace of fangs', 'Nutcracker staff', 'Oak blackjack', 'Oak blackjack(d)', 'Oak blackjack(o)',
    'Opal machete', 'Orange cape', 'Orange flowers', 'Ornate boots', 'Ornate cape', 'Ornate gloves',
    'Ornate helm', 'Pendant of Ates', 'Phoenix crossbow', 'Pink boots', 'Pink cape', 'Pink hat',
    'Pink robe bottoms', 'Pink robe top', 'Pirate\'s hook', 'Platinum speedrun trophy', 'Potato sack',
    'Prop sword', 'Purple boots', 'Purple cape', 'Purple flowers', 'Purple gloves', 'Purple hat',
    'Purple robe bottoms', 'Purple robe top', 'Rain bow', 'Rat pole', 'Red boots', 'Red cape', 'Red flowers',
    'Red gloves', 'Red hat', 'Red robe bottoms', 'Red robe top', 'Redwood hiking staff', 'Ring of shadows',
    'Rock-shell boots', 'Rock-shell gloves', 'Rod of Ivandis', 'Rogue boots', 'Rogue gloves',
    'Rubber chicken', 'Severed leg', 'Shaman mask', 'Shortbow', 'Silly jester boots', 'Silly jester hat',
    'Silly jester tights', 'Silly jester top', 'Silver sickle', 'Silver speedrun trophy', 'Skeletal boots',
    'Skeletal gloves', 'Skeleton lantern', 'Skis', 'Slayer gloves', 'Spiked boots', 'Spiked manacles',
    'Spiky vambraces', 'Spined boots', 'Spined gloves', 'Spotted cape', 'Spottier cape', 'Stale baguette',
    'Starter cape', 'Teal boots', 'Teal gloves', 'Teal hat', 'Teal robe bottoms', 'Teal robe top',
    'Team cape i', 'Team cape x', 'Team cape zero', 'Team-1 cape', 'Team-10 cape', 'Team-11 cape',
    'Team-12 cape', 'Team-13 cape', 'Team-14 cape', 'Team-15 cape', 'Team-16 cape', 'Team-17 cape',
    'Team-18 cape', 'Team-19 cape', 'Team-2 cape', 'Team-20 cape', 'Team-21 cape', 'Team-22 cape',
    'Team-23 cape', 'Team-24 cape', 'Team-25 cape', 'Team-26 cape', 'Team-27 cape', 'Team-28 cape',
    'Team-29 cape', 'Team-3 cape', 'Team-30 cape', 'Team-31 cape', 'Team-32 cape', 'Team-33 cape',
    'Team-34 cape', 'Team-35 cape', 'Team-36 cape', 'Team-37 cape', 'Team-38 cape', 'Team-39 cape',
    'Team-4 cape', 'Team-40 cape', 'Team-41 cape', 'Team-42 cape', 'Team-43 cape', 'Team-44 cape',
    'Team-45 cape', 'Team-46 cape', 'Team-47 cape', 'Team-48 cape', 'Team-49 cape', 'Team-5 cape',
    'Team-50 cape', 'Team-6 cape', 'Team-7 cape', 'Team-8 cape', 'Team-9 cape', 'Trollweiss',
    'Turquoise boots', 'Turquoise hat', 'Turquoise robe bottoms', 'Turquoise robe top', 'Twitcher\'s gloves',
    'Ultimate ironman helm', 'Undead chicken (item)', 'Vyrewatch legs', 'Vyrewatch shoes', 'Vyrewatch top',
    'White flowers', 'Willow blackjack', 'Willow blackjack(d)', 'Witchwood icon', 'Xeric\'s talisman',
    'Yellow boots', 'Yellow cape', 'Yellow flowers', 'Yellow gloves', 'Yellow hat', 'Yellow robe bottoms',
    'Yellow robe top', 'Zealot\'s boots', 'Zealot\'s helm',
  ]),
};

export const EQUIPMENT_REVIEW: EquipmentReview = { wieldLevels: WIELD_LEVELS, placed: PLACED };
