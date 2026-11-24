import { describe, expect, it } from 'vitest';
import { TRAINING_TIPS, getWikiTrainingUrl, xpAtLevel } from './trainingTips';

// Minimum OSRS thresholds independently checked against the Wiki revisions in
// audit/resources/source-index.json on 22 September 2026. Recommendations may
// begin later, but must never offer these actions before their actual minimum.
const thresholds: [string, RegExp, number][] = [
  ['Agility', /Rellekka/, 80], ['Agility', /Ardougne/, 90],
  ['Construction', /Oak dungeon doors/, 74], ['Construction', /Mahogany tables/, 52], ['Construction', /Gnome benches/, 77],
  ['Cooking', /Salmon/, 25], ['Cooking', /Anglerfish/, 84],
  ['Crafting', /Green d'hide bodies/, 63], ['Crafting', /Blue d'hide bodies/, 71], ['Crafting', /Red d'hide bodies/, 77], ['Crafting', /Black d'hide bodies/, 84],
  ['Farming', /Fruit tree/, 27], ['Farming', /Calquat/, 72], ['Farming', /Spirit tree/, 83],
  ['Firemaking', /Wintertodt/, 50],
  ['Fletching', /Maple shortbows/, 50], ['Fletching', /Maple longbows/, 55], ['Fletching', /Yew longbows/, 70], ['Fletching', /Magic longbows/, 85], ['Fletching', /Amethyst arrows/, 82], ['Fletching', /Dragon arrows/, 90],
  ['Herblore', /Attack potions/, 3], ['Hunter', /Dark kebbit/, 57], ['Hunter', /Black chinchompa/, 73],
  ['Magic', /Superheat/, 43], ['Magic', /High Level Alchemy/, 55],
  ['Mining', /Amethyst/, 92], ['Runecraft', /[Dd]ouble.*nature/, 91], ['Runecrafting', /[Dd]ouble nature/, 91],
  ['Smithing', /iron platebodies/, 33], ['Smithing', /Steel platebodies/, 48], ['Smithing', /Mithril platebodies/, 68],
  // Sailing training (rev 15379238): the trials open at 30, 55 and 72; the quests need 12 and 22.
  ['Sailing', /Tempor Tantrum/, 30], ['Sailing', /Jubbly Jive/, 55], ['Sailing', /Gwenith Glide/, 72],
  ['Thieving', /knights of Ardougne/, 55], ['Thieving', /Silk stalls/, 20], ['Woodcutting', /^Teak trees$/, 35],
];

describe('fact-checked training suggestions', () => {
  it.each(thresholds)('%s %s never precedes OSRS level %i', (skill, method, minimum) => {
    const tips = TRAINING_TIPS[skill].filter(tip => method.test(tip.method));
    expect(tips.length).toBeGreaterThan(0);
    for (const tip of tips) expect(tip.from).toBeGreaterThanOrEqual(minimum);
  });

  it('removes false requirements, non-training activities and unverified superlatives', () => {
    const content = JSON.stringify(TRAINING_TIPS);
    for (const invalid of ['needs 50 HP', '15% favour', 'Gnome Restaurant', 'NPC Contact', 'Doric', 'Best melee xp/hr', 'Best xp in game', 'Cows / Chickens', 'fastest early points', 'Goldsmith Gauntlets required']) expect(content).not.toContain(invalid);
    expect(TRAINING_TIPS.Farming.find(tip => /Fruit tree/.test(tip.method))?.note).toContain('16 hours');
    expect(TRAINING_TIPS.Slayer[0].note).toMatch(/no points.*higher master/);
    expect(TRAINING_TIPS.Woodcutting.find(tip => /Redwood/.test(tip.method))?.note).toBe('Woodcutting Guild, or a grown redwood in the Farming Guild');
    expect(TRAINING_TIPS.Magic.some(tip => /Astral Contact/.test(tip.method))).toBe(true);
  });

  it('links all mapped skills to pages returned by the current Wiki audit', () => {
    const verified = new Set([
      'Agility_training', 'Pay-to-play_Melee_training', 'Construction_training',
      'Pay-to-play_Cooking_training', 'Pay-to-play_Crafting_training', 'Farming_training',
      'Pay-to-play_Firemaking_training', 'Pay-to-play_Fishing_training', 'Fletching_training',
      'Herblore_training', 'Hitpoints', 'Hunter_training', 'Pay-to-play_Magic_training',
      'Pay-to-play_Mining_training', 'Pay-to-play_Prayer_training', 'Pay-to-play_Ranged_training',
      'Pay-to-play_Runecraft_training', 'Slayer_training', 'Pay-to-play_Smithing_training',
      'Thieving_training', 'Pay-to-play_Woodcutting_training', 'Sailing_training',
    ]);
    for (const skill of Object.keys(TRAINING_TIPS)) {
      const url = new URL(getWikiTrainingUrl(skill));
      expect(url.hostname).toBe('oldschool.runescape.wiki');
      expect(verified.has(url.pathname.slice(3)), skill).toBe(true);
    }
    expect(getWikiTrainingUrl('Runecraft')).toBe(getWikiTrainingUrl('Runecrafting'));
    expect(getWikiTrainingUrl('Sailing')).toBe('https://oldschool.runescape.wiki/w/Sailing_training');
    expect(TRAINING_TIPS.Sailing.find(tip => /Courier/.test(tip.method))?.note).toBe('Prying Times at 12 and Current Affairs at 22 Sailing');
  });
});

describe('Wintertodt rewards', () => {
  // Wiki "Wintertodt" rev 15413436 (23 November 2026): supply crates were replaced
  // by the reward cart on 9 October 2024; "Reward Cart" rev 15388221.
  it('names the reward cart, not the removed supply crates', () => {
    const note = TRAINING_TIPS.Firemaking.find(tip => tip.method === 'Wintertodt')?.note;
    expect(note).toBe('Requires 50 Firemaking; rewards come from the reward cart');
    expect(JSON.stringify(TRAINING_TIPS)).not.toMatch(/supply crate/i);
  });
});

describe('XP to go in the training popover', () => {
  // Cumulative XP from the Wiki "Experience" table, rev 15385377 (29 October 2026).
  it.each([[1, 0], [2, 83], [13, 1_833], [62, 333_804], [92, 6_517_253], [99, 13_034_431]])(
    'level %i starts at %i XP', (level, xp) => {
      expect(xpAtLevel(level)).toBe(xp);
    });

  it('gives exact gaps for short climbs, not a straight line between anchors', () => {
    expect(xpAtLevel(92) - xpAtLevel(90)).toBe(1_170_921);
    expect(xpAtLevel(62) - xpAtLevel(60)).toBe(60_062);
    expect(xpAtLevel(96) - xpAtLevel(95)).toBe(913_019);
  });

  it('rises with every level and stops at 99', () => {
    for (let level = 2; level <= 99; level++) expect(xpAtLevel(level)).toBeGreaterThan(xpAtLevel(level - 1));
    expect(xpAtLevel(120)).toBe(13_034_431);
    expect(xpAtLevel(0)).toBe(0);
  });
});
