import { describe, expect, it } from 'vitest';
import { questGuideArticleFor } from './questGuideArticles';
import { questWalkthroughCatalogue } from './questWalkthroughs.public';

describe('reviewed Wiki-style quest articles', () => {
  it('covers exactly the steps of each of the five public guides', () => {
    expect(questWalkthroughCatalogue).toHaveLength(5);
    for (const guide of questWalkthroughCatalogue) {
      const article = questGuideArticleFor(guide.questId);
      expect(article, guide.questId).toBeDefined();
      expect(article!.questId).toBe(guide.questId);
      expect(article!.guideRevision).toBe(guide.revision);
      expect(Object.keys(article!.steps).sort()).toEqual(guide.actions.map(action => action.id).sort());
      expect(article!.sourceUrl).toMatch(/^https:\/\/oldschool\.runescape\.wiki\/w\/.+\?oldid=\d+$/);
      for (const step of Object.values(article!.steps)) {
        expect(step.section.trim()).not.toBe('');
        expect(step.location.trim()).not.toBe('');
      }
    }
    expect(questGuideArticleFor("Daddy's Home")).toBeUndefined();
    expect(questGuideArticleFor('Unknown quest')).toBeUndefined();
  });

  it('separates Restless Ghost acquisition, worn equipment, and optional combat', () => {
    const article = questGuideArticleFor('The Restless Ghost')!;
    expect(article.itemsRequired).toEqual(['None to bring.']);
    expect(article.itemsObtained.join(' ')).toContain('must be worn');
    expect(article.steps['the-restless-ghost:get-amulet'].details!.join(' ')).toContain('Receiving the amulet does not require');
    expect(article.steps['the-restless-ghost:talk-to-ghost'].details!.join(' ')).toContain('without wearing it is insufficient');
    expect(article.enemies.join(' ')).toContain('without fighting');
    expect(article.steps['the-restless-ghost:take-skull'].details!.join(' ')).toContain('surface entrance');
    expect(article.requirements.join(' ')).not.toMatch(/(?:combat|Prayer) (?:level )?10/i);
  });

  it('keeps process experience and separately claimed rewards distinct', () => {
    const sheep = questGuideArticleFor('Sheep Shearer')!;
    expect(sheep.rewards).toEqual(['1 quest point', '150 Crafting XP', '60 coins']);
    expect(sheep.steps['sheep-shearer:spin-wool'].details!.join(' ')).toContain('separate from the quest reward');
    const runes = questGuideArticleFor('Rune Mysteries')!;
    expect(runes.rewards).toContain('5 Kudos, claimed separately from Historian Minas in Varrock Museum.');
    expect(runes.rewards).not.toContain('Unlocks Runecraft.');
  });

  it('explains collecting Imp Catcher beads before the formal start', () => {
    const article = questGuideArticleFor('Imp Catcher')!;
    expect(article.startPoint).toContain('Wizard Mizgog');
    expect(article.steps['imp-catcher:get-black-bead'].details!.join(' ')).toContain('before starting the quest');
    expect(article.steps['imp-catcher:get-black-bead'].details!.join(' ')).toContain('any order');
    expect(article.steps['imp-catcher:give-beads-to-mizgog'].details!.join(' ')).toContain('together');
  });
});
