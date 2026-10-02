import { describe, expect, it } from 'vitest';
import {
  RUNELITE_GUIDE_CHAPTERS,
  RUNELITE_GUIDE_CHAPTER_IDS,
  RUNELITE_GUIDE_FIGURES,
  RUNELITE_GUIDE_GLOSSARY,
  RUNELITE_GUIDE_ICON,
  RUNELITE_GUIDE_NAV_GROUPS,
  RUNELITE_GUIDE_SETTINGS,
  RUNELITE_GUIDE_TROUBLESHOOTING,
  type GuideBlock,
} from './runeliteGuide';
import { WIKI_UI_ICONS } from './wikiUiIcons';

const blocks = (): GuideBlock[] => RUNELITE_GUIDE_CHAPTERS.flatMap(chapter => [...chapter.blocks]);

const figuresUsed = (): string[] => blocks().flatMap(block => {
  if (block.kind === 'figure') return [block.figureId];
  if (block.kind === 'gallery') return block.items.map(item => item.figureId);
  return [];
});

describe('RuneLite guide chapters', () => {
  it('keeps its chapters in reading order, numbered as they come', () => {
    expect(RUNELITE_GUIDE_CHAPTERS.map(chapter => chapter.id)).toEqual([...RUNELITE_GUIDE_CHAPTER_IDS]);
    RUNELITE_GUIDE_CHAPTERS.forEach((chapter, index) => expect(chapter.number, chapter.id).toBe(index + 1));
    for (const chapter of RUNELITE_GUIDE_CHAPTERS) {
      expect(chapter.title.trim().length, chapter.id).toBeGreaterThan(2);
      expect(chapter.lede.trim().length, chapter.id).toBeGreaterThan(20);
      expect(chapter.blocks.length, chapter.id).toBeGreaterThan(0);
    }
  });

  it('lists every chapter once in its contents, in reading order', () => {
    expect(RUNELITE_GUIDE_NAV_GROUPS.flatMap(group => group.chapterIds)).toEqual([...RUNELITE_GUIDE_CHAPTER_IDS]);
  });

  it('marks each chapter with OSRS art the site already uses', () => {
    const osrsArt = new Set<string>(Object.values(WIKI_UI_ICONS));
    for (const chapter of RUNELITE_GUIDE_CHAPTERS) {
      expect(osrsArt.has(chapter.icon) || chapter.icon === RUNELITE_GUIDE_ICON, chapter.icon).toBe(true);
    }
    expect(osrsArt.has(RUNELITE_GUIDE_ICON)).toBe(true);
  });

  it('shows the settings, setups, troubleshooting, links and glossary once each', () => {
    for (const kind of ['settings', 'presets', 'troubleshooting', 'resources', 'glossary'] as const) {
      expect(blocks().filter(block => block.kind === kind), kind).toHaveLength(1);
    }
  });

  it('says what players need to know about privacy, Strict Mode and their run', () => {
    const text = JSON.stringify(RUNELITE_GUIDE_CHAPTERS);
    for (const phrase of [
      'does not upload gameplay data',
      'IP address',
      'off by default',
      'fails open',
      '60 seconds',
      'Keys',
      'Omni-Keys',
      'Chaos Keys',
      'Fate Points',
      'Shortest Path',
      'on your computer',
    ]) {
      expect(text, phrase).toContain(phrase);
    }
  });
});

describe('RuneLite guide pictures', () => {
  it('shows every picture it has, and has every picture it shows', () => {
    const used = new Set(figuresUsed());
    const known = new Set(RUNELITE_GUIDE_FIGURES.map(figure => figure.id));
    expect([...used].filter(id => !known.has(id))).toEqual([]);
    expect([...known].filter(id => !used.has(id))).toEqual([]);
    expect(known.size).toBe(RUNELITE_GUIDE_FIGURES.length);
  });

  it('numbers each picture’s notes from 1, each outlining something inside the picture', () => {
    for (const figure of RUNELITE_GUIDE_FIGURES) {
      expect(figure.callouts.map(callout => callout.marker), figure.id)
        .toEqual(figure.callouts.map((_, index) => index + 1));
      expect(new Set(figure.callouts.map(callout => callout.id)).size, figure.id).toBe(figure.callouts.length);
      for (const { id, box, label, body } of figure.callouts) {
        const [x, y, width, height] = box;
        const where = `${figure.id}/${id}`;
        expect(x, where).toBeGreaterThanOrEqual(0);
        expect(y, where).toBeGreaterThanOrEqual(0);
        expect(width, where).toBeGreaterThan(0);
        expect(height, where).toBeGreaterThan(0);
        expect(x + width, where).toBeLessThanOrEqual(1.001);
        expect(y + height, where).toBeLessThanOrEqual(1.001);
        expect(label.trim().length, where).toBeGreaterThan(2);
        expect(body.trim().length, where).toBeGreaterThan(10);
      }
    }
  });

  it('outlines whole rows of the plugin’s cards, so no note’s line crosses the card', () => {
    for (const figure of RUNELITE_GUIDE_FIGURES.filter(item => item.source === 'rendered')) {
      for (const { id, box } of figure.callouts) {
        expect(box[0] + box[2], `${figure.id}/${id} reaches the card’s right side`).toBeGreaterThan(0.92);
      }
    }
  });

  it('draws the plugin’s pictures at twice the detail, and says what each shows', () => {
    for (const figure of RUNELITE_GUIDE_FIGURES) {
      expect(figure.scale, figure.id).toBe(2);
      expect(figure.src, figure.id).toBe(`/guides/runelite/${figure.id}.png`);
      expect(figure.alt.trim().length, figure.id).toBeGreaterThan(20);
      expect(figure.title.trim().length, figure.id).toBeGreaterThan(2);
    }
  });
});

/**
 * The accuracy review checked what the guide says against what the plugin does. These pin the
 * corrections, each in the plugin's own words where the plugin says the same thing.
 */
describe('RuneLite guide, as the plugin does it', () => {
  const chapter = (id: string): string => JSON.stringify(RUNELITE_GUIDE_CHAPTERS.find(item => item.id === id));
  const setting = (key: string) => {
    const found = RUNELITE_GUIDE_SETTINGS.find(item => item.key === key);
    if (!found) throw new Error(`no setting ${key}`);
    return found;
  };
  const callout = (figureId: string, id: string): string =>
    RUNELITE_GUIDE_FIGURES.find(figure => figure.id === figureId)?.callouts.find(item => item.id === id)?.body ?? '';
  const glossary = (term: string): string => RUNELITE_GUIDE_GLOSSARY.find(item => item.term === term)?.definition ?? '';

  it('says Strict Mode also stops a teleport of a kind not unlocked, and a worn item’s (owner’s call T6)', () => {
    const strict = chapter('strict-mode');
    expect(strict).toContain('when your run hasn’t unlocked that kind of teleport');
    expect(strict).toContain('an item you’re wearing, such as a glory’s Edgeville');
    expect(strict).not.toContain('equipment');
    expect(setting('strictMode').purpose).toContain('when your run hasn’t unlocked that kind of teleport');
    expect(glossary('Strict Mode')).toContain('hasn’t unlocked that kind of teleport');
    expect(RUNELITE_GUIDE_TROUBLESHOOTING.find(item => item.id === 'strict-mode-allows-action')?.likelyCause)
      .toContain('that place or that kind of teleport');
  });

  it('says what the alerts, reminders and notifications do (P-3, owner’s call T8, P-4, P-11, P-12)', () => {
    expect(setting('useNotifier').purpose).toContain('with each locked-area alert’s chat line');
    expect(setting('lockedAreaAlert').visibleResult).toContain('the same area stays quiet for a minute');
    expect(setting('announceAreaChanges').purpose).toContain('Locked areas follow the Locked-area alert instead');
    expect(setting('rollNudges').purpose).toContain('a combat task, a clue scroll, a boss or raid kill');
    expect(setting('rollNudges').purpose).toContain('Only on the character your run is linked to');
    expect(callout('roll-inbox', 'warnings')).toContain('a locked area, a locked Slayer task, gear above your tier');
  });

  it('says RuneLite notices whole diary tiers, and collection log items only with the game’s notification (T9, P-10)', () => {
    const inbox = chapter('roll-inbox');
    expect(inbox).toContain('finished achievement diary tiers (not single tasks)');
    expect(inbox).toContain('only with the game’s own collection log notification turned on');
    expect(inbox).toContain('the card says why');
    expect(setting('rollNudges').purpose).toContain('a finished diary tier (not each task)');
    expect(setting('rollNudges').purpose).toContain('Collection log items need the game’s own collection log notification');
  });

  it('says what the borders, shade and minimap draw (P-15, P-16, P-17)', () => {
    const inGame = chapter('in-game');
    expect(setting('chunkBorders').visibleResult).toContain('All edges adds a thin line along every other chunk edge');
    expect(inGame).toContain('All edges adds a thin line along every other chunk edge too');
    expect(inGame).not.toContain('between unlocked chunks');
    expect(setting('shadeNearbyLocked').purpose).toContain('on the minimap, all locked land nearby, while Minimap chunk borders is on');
    expect(inGame).toContain('On the minimap, all locked land nearby');
    expect(setting('drawMinimap').purpose).toContain('every chunk line when Chunk borders in the game view is All edges');
    expect(setting('drawMinimap').visibleResult).toContain('With Shade locked land nearby on');
    // P-32: another character's HUD and sidebar still say whose run it is.
    expect(inGame).toContain('the HUD and the sidebar say only that the run isn’t theirs');
  });

  it('says the Unlocked colour is for words only, the frontier is unlocked, and the percentage is of the count (P-5, P-49, T7)', () => {
    expect(setting('unlockedColor').visibleResult).toContain('unlocked land is never filled');
    expect(setting('unlockedColor').visibleResult).toContain('transparency isn’t used');
    expect(setting('frontierColor').visibleResult).toContain('that you can unlock next');
    expect(callout('run', 'progress')).toContain('The percentage counts the same.');
  });

  it('says what a backup, Disconnect and the status cards do (P-7, P-18, P-33)', () => {
    const backup = chapter('connection-and-backup');
    expect(backup).toContain('Any backup that can be read replaces them, even an older one or another run’s');
    expect(backup).not.toContain('is older than yours');
    expect(backup).not.toContain('as a backup');
    expect(callout('connection', 'pairing')).toContain('keeps the rules you have.');
    const status = chapter('status');
    for (const title of ['Checking with the tracker', 'Using saved rules', 'Disconnected in the tracker', 'Kept your pairing']) {
      expect(status, title).toContain(title);
    }
    expect(status).toContain('for Plugin update needed, restart RuneLite');
    expect(status).not.toContain('In every case');
  });

  it('defines a chunk and the frontier, and names the run’s character as linked (P-20, P-49, owner’s call T1)', () => {
    expect(glossary('Chunk')).toContain('in Chunked mode you unlock one chunk at a time');
    expect(glossary('Frontier')).toContain('which you can unlock next');
    expect(glossary('Different character')).toContain('The run is linked to another character');
    expect(RUNELITE_GUIDE_TROUBLESHOOTING.find(item => item.id === 'different-character')?.likelyCause)
      .toContain('The run is linked to another character');
  });

  it('says what the sidebar and the settings keep and change (P-29, P-30, P-31)', () => {
    expect(chapter('settings')).toContain('Its sections are Tracker, Strict Mode, Alerts, Display, Custom colours and Backup.');
    expect(chapter('settings')).toContain('Apart from Online sync and Strict Mode');
    expect(chapter('sidebar')).toContain('Here remembers which of its categories you left open.');
    expect(callout('here', 'skills')).toContain('the level the tracker has for you');
  });

  it('calls the website the tracker, as the plugin’s buttons do (owner’s call T1)', () => {
    // Ids and file names aren't shown, so the confirmation picture keeps its name.
    const shown = JSON.stringify(
      [RUNELITE_GUIDE_CHAPTERS, RUNELITE_GUIDE_SETTINGS, RUNELITE_GUIDE_TROUBLESHOOTING, RUNELITE_GUIDE_GLOSSARY,
        RUNELITE_GUIDE_FIGURES],
      (key, value: unknown) => (['id', 'src', 'figureId'].includes(key) ? undefined : value),
    );
    expect(shown).toContain('the tracker');
    expect(shown).not.toMatch(/companion/i);
  });

  it('names the banner’s button and says what Recently stopped lists (P-6, P-19)', () => {
    expect(chapter('strict-mode')).toContain('a Pause Strict Mode for 60s button');
    expect(setting('strictMode').visibleResult).toContain('Pause Strict Mode for 60s');
    expect(callout('strict-mode', 'stopped')).toBe('The teleports it stopped lately, and why.');
  });
});
