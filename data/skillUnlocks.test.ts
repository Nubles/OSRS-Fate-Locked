import { describe, expect, it } from 'vitest';
import { MINIGAMES_LIST } from './items';
import { SKILL_UNLOCK_DATA } from './skillUnlocks';

describe('Wyrmscraig skill unlocks', () => {
  it('surfaces the three Tier 6 skilling methods with their exact gates', () => {
    expect(SKILL_UNLOCK_DATA.Hunter[6]).toContain(
      'Lvl 60: Goat Hunting (Wyrmscraig; Sheep Herder)',
    );
    expect(SKILL_UNLOCK_DATA.Mining[6]).toContain(
      'Lvl 53: Sunstone Mining (Wyrmscraig; Fallen From Grace)',
    );
    expect(SKILL_UNLOCK_DATA.Crafting[6]).toContain(
      'Lvl 60: Sunstone Golem Crafting (Wyrmscraig; Fallen From Grace)',
    );
  });

  it('keeps the three skilling methods out of random minigame rolls', () => {
    for (const method of ['Goat Hunting', 'Sunstone Mining', 'Sunstone Golem Crafting']) {
      expect(MINIGAMES_LIST).not.toContain(method);
    }
  });
});
