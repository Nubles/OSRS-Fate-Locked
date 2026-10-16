import { describe, expect, it } from 'vitest';
import { QUEST_DATA } from '../../data/questData';
import { ALL_DIARY_TASKS } from '../../data/diaryTasks';
import { ALL_CA_TASKS } from '../../data/caTasks';
import {
  caTaskSearchFields, compileJournalQuery, diaryAreaAndTier, diaryTaskSearchFields, foldText, hitRanges,
  journalMatches, matchJournalFields, questSearchFields, splitHighlight,
} from './OsrsJournalSearch';

const q = (term: string) => compileJournalQuery(term);
const hl = (text: string, term: string) =>
  splitHighlight(text, matchJournalFields(q(term), [text])?.[0]).filter(s => s.hit).map(s => s.text);

describe('Journal search: folding', () => {
  it('ignores case, apostrophes and full stops, and turns other punctuation into a space', () => {
    expect(foldText("Cook's Assistant").text).toBe('cooks assistant');
    expect(foldText('RFD: Start (The Cook)').text).toBe('rfd start the cook');
    expect(foldText('  Mr. Mordaut -- Zul-Andra ').text).toBe('mr mordaut zul andra');
  });
  it('treats an empty or punctuation-only term as no search', () => {
    expect(q('')).toBeNull();
    expect(q('   ')).toBeNull();
    expect(q("'.")).toBeNull();
    expect(matchJournalFields(null, ['anything'])).toEqual([[]]);
  });
});

describe('Journal search: matching', () => {
  const cooks = QUEST_DATA["Cook's Assistant"];

  it("finds Cook's Assistant by its name typed without the apostrophe, by a word start and by a substring", () => {
    for (const term of ['cooks assistant', "cook's", 'COOK', 'assist', 'ok\'s ass']) {
      expect(journalMatches(q(term), questSearchFields(cooks)), term).toBe(true);
    }
    expect(journalMatches(q('cooks dragon'), questSearchFields(cooks))).toBe(false);
  });

  it('finds a quest by its series, also as an acronym, and by its start point', () => {
    expect(cooks.series).toBe('Recipe for Disaster');
    expect(journalMatches(q('recipe'), questSearchFields(cooks))).toBe(true);
    expect(journalMatches(q('rfd'), questSearchFields(cooks))).toBe(true);
    expect(journalMatches(q('lumbridge'), questSearchFields(cooks, 'Lumbridge Castle, Misthalin'))).toBe(true);
    expect(journalMatches(q('lumbridge'), questSearchFields(cooks))).toBe(false);
  });

  it('needs every word, but the words may sit in different fields', () => {
    const fields = questSearchFields({ name: 'Shield of Arrav', series: undefined }, 'Varrock Palace');
    expect(journalMatches(q('arrav varrock'), fields)).toBe(true);
    expect(journalMatches(q('arrav falador'), fields)).toBe(false);
  });

  it('finds diary tasks by text, area and tier', () => {
    const task = ALL_DIARY_TASKS.find(t => t.tierId === 'Varrock Easy')!;
    expect(diaryAreaAndTier('Lumbridge & Draynor Elite')).toEqual(['Lumbridge & Draynor', 'Elite']);
    expect(journalMatches(q('varrock'), diaryTaskSearchFields(task))).toBe(true);
    expect(journalMatches(q('varrock easy'), diaryTaskSearchFields(task))).toBe(true);
    expect(journalMatches(q('varrock elite'), diaryTaskSearchFields(task))).toBe(false);
    const word = task.description.split(' ').find(w => w.length > 4)!;
    expect(journalMatches(q(word.toLowerCase()), diaryTaskSearchFields(task))).toBe(true);
  });

  it('finds Combat Achievement tasks by name, boss and tier', () => {
    const task = ALL_CA_TASKS.find(t => t.id === 'ca_0')!;
    expect(task.name).toBe('Noxious Foe');
    const fields = caTaskSearchFields(task);
    expect(journalMatches(q('noxious'), fields)).toBe(true);
    expect(journalMatches(q('aberrant'), fields)).toBe(true);
    expect(journalMatches(q('easy'), fields)).toBe(true);
    expect(journalMatches(q('grandmaster'), fields)).toBe(false);
    const named = ALL_CA_TASKS.filter(t => journalMatches(q('zulrah'), caTaskSearchFields(t)));
    expect(named.length).toBeGreaterThan(3);
    expect(named.every(t => /zulrah/i.test(caTaskSearchFields(t).join(' ')))).toBe(true);
  });
});

describe('Journal search: highlighting', () => {
  it('highlights the matched characters of the source text, apostrophes included', () => {
    expect(hl("Cook's Assistant", 'cooks')).toEqual(["Cook's"]);
    expect(hl("Cook's Assistant", 'assistant cook')).toEqual(["Cook", 'Assistant']);
    expect(hl('Recipe for Disaster', 'rfd')).toEqual(['R', 'f', 'D']);
  });
  it('cuts a line into plain and hit segments that join back to the line', () => {
    const text = 'Kill a Green Dragon';
    const segs = splitHighlight(text, matchJournalFields(q('dragon green'), [text])![0]);
    expect(segs.map(s => s.text).join('')).toBe(text);
    expect(segs.filter(s => s.hit).map(s => s.text)).toEqual(['Green', 'Dragon']);
    expect(splitHighlight('plain', undefined)).toEqual([{ text: 'plain', hit: false }]);
  });
  it('highlights any word on a heading, even when only some words are in it', () => {
    const r = hitRanges(q('varrock wall'), 'Varrock Hard');
    expect(splitHighlight('Varrock Hard', r).filter(s => s.hit).map(s => s.text)).toEqual(['Varrock']);
  });
});
