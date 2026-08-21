import { describe, expect, it } from 'vitest';
import {
  compileWalkthroughCatalogue,
  convertChunkPickerChunkId,
  extractQuestTasks,
  extractQuickGuideLines,
  sourceLineDigest,
  stableJson,
  validateTaskGraph,
} from './quest-walkthrough-source.mjs';
import { questStrategyFromWalkthrough } from '../utils/questStrategies/model';

const questKey = (quest: string, suffix: string) => `~|${quest}|~ ${suffix}`;

const chunkPickerFixture = () => ({
  challenges: {
    Quest: {
      [questKey("Cook's Assistant", '1')]: {
        BaseQuest: "Cook's Assistant",
        Description: 'Talk to Cook',
        NPCs: ['Cook (Lumbridge)'],
        Objects: ['Range'],
        Items: ['Pot'],
        Skills: { Cooking: 1 },
        Chunks: ['12850-1', 'Lumbridge Castle'],
        Reward: ['Cooking experience'],
      },
      [questKey("Cook's Assistant", 'Complete the quest')]: {
        BaseQuest: "Cook's Assistant",
        Tasks: { [questKey("Cook's Assistant", '1')]: 'Quest' },
        QuestPoints: 1,
        XpReward: { Cooking: 300 },
        Chunks: ['12850-1'],
      },
      [questKey('Sheep Shearer', '1')]: {
        BaseQuest: 'Sheep Shearer',
        Description: 'Talk to Fred the Farmer',
      },
      [questKey('Sheep Shearer', 'Complete the quest')]: {
        BaseQuest: 'Sheep Shearer',
        Tasks: { [questKey('Sheep Shearer', '1')]: 'Quest' },
      },
      [questKey("Daddy's Home", '1')]: {
        BaseQuest: "Daddy's Home",
        Description: 'Talk to Marlo',
      },
      [questKey("Doric's Quest", '1')]: {
        BaseQuest: "Doric's Quest",
        Description: 'Talk to Doric',
      },
      [questKey('Elemental Workshop I', '1')]: {
        BaseQuest: 'Elemental Workshop I',
        Description: 'Search the bookcase',
      },
      [questKey('A Fifth Quest', '1')]: {
        BaseQuest: 'A Fifth Quest',
        Description: 'Must not leak',
      },
    },
  },
});

const wikiFixture = () => ({
  questId: "Cook's Assistant",
  wikitext: [
    '== Walkthrough ==',
    '# Talk to [[Cook (Lumbridge)|the Cook]]. <!-- hidden -->',
    '## Bring a {{plink|bucket of milk}}.',
    "#* '''Note:''' Use the [[wheat]] on the hopper.",
    '# [[File:Bucket of milk.png|20px]]',
    '# <span class="mw-editsection">edit</span>',
    '#',
    '# Return to {{npc|Cook}}.',
  ].join('\n'),
});

const missingTaskFixture = () => ({
  "Doric's Quest": [{ id: 'doric-2', dependsOn: ['doric-missing'] }],
});

const cyclicTaskFixture = () => ({
  "Doric's Quest": [
    { id: 'doric-1', dependsOn: ['doric-2'] },
    { id: 'doric-2', dependsOn: ['doric-1'] },
  ],
});

const reviewedStrategySourceFixture = () => ({
  schemaVersion: 1,
  phase: 'REVIEWED',
  chunkPicker: {
    repository: 'source-chunk/chunk-picker-v2',
    commit: 'ba2fcebf8b26c84c74f8d9ab328a0ede802be926',
    licenceStatus: 'UNVERIFIED',
  },
  wiki: {
    licence: 'CC BY-NC-SA 3.0',
    licenceUrl: 'https://creativecommons.org/licenses/by-nc-sa/3.0/',
  },
  quests: [{
    questId: "Cook's Assistant",
    wikiTitle: "Cook's Assistant/Quick guide",
    wikiRevision: 15238952,
    wikiRevisionTimestamp: '2026-06-24T23:03:17Z',
    wikiUrl: 'https://oldschool.runescape.wiki/w/Cook%27s_Assistant/Quick_guide?oldid=15238952',
    importedLines: [{
      id: 'cooks-assistant-walkthrough-1',
      section: 'Walkthrough',
      sourceOrder: 1,
      rawText: 'Talk to the Cook.',
    }],
    tasks: [],
  }],
});

const reviewedStrategyActionFixture = () => ({
  id: 'cooks-assistant:start-quest',
  section: 'QUEST',
  sourceOrder: 1,
  kind: 'TALK_TO',
  confidence: 'REVIEWED',
  displayText: 'Talk to the Cook.',
  rawWikiLineIds: ['cooks-assistant-walkthrough-1'],
  dependsOn: [],
  entities: [],
  items: [],
  gates: [],
  location: {
    kind: 'REVIEWED_ALIAS',
    alias: 'Lumbridge Castle',
    chunks: ['50,50'],
    reviewer: 'Reviewer',
    reviewedAt: '2026-08-20',
    evidence: 'Reviewed guide evidence.',
    rationale: 'Reviewed location.',
  },
  coach: {
    fulfils: [],
    completion: { kind: 'MANUAL' },
    fallbackPolicy: 'NONE',
  },
});

const reviewedStrategyReviewFixture = () => ({
  schemaVersion: 1,
  quests: {
    "Cook's Assistant": [reviewedStrategyActionFixture()],
  },
});

describe('pinned walkthrough source helpers', () => {
  it('converts a Chunk Picker region and plane ID to a canonical chunk', () => {
    expect(convertChunkPickerChunkId('12850-1')).toBe('50,50');
    expect(convertChunkPickerChunkId('11829-1')).toBe('46,53');
  });

  it('rejects an unknown Chunk Picker chunk ID shape instead of guessing', () => {
    expect(() => convertChunkPickerChunkId('Elemental Workshop')).toThrow(/chunk.*shape/i);
    expect(() => convertChunkPickerChunkId('12850-underground')).toThrow(/chunk.*shape/i);
  });

  it('extracts only explicitly selected quest challenge graphs', () => {
    const result = extractQuestTasks(chunkPickerFixture(), ["Cook's Assistant", 'Sheep Shearer']);
    expect(result).toEqual(expect.objectContaining({
      "Cook's Assistant": expect.any(Array),
      'Sheep Shearer': expect.any(Array),
    }));
    expect(Object.keys(result)).toEqual(["Cook's Assistant", 'Sheep Shearer']);
    expect(result["Cook's Assistant"]).toEqual([
      expect.objectContaining({
        id: questKey("Cook's Assistant", '1'),
        description: 'Talk to Cook',
        npcs: ['Cook (Lumbridge)'],
        objects: ['Range'],
        items: ['Pot'],
        skills: { Cooking: 1 },
        chunks: [{ chunkId: '50,50', plane: 1, sourceId: '12850-1' }],
        namedAreas: ['Lumbridge Castle'],
        rewards: ['Cooking experience'],
      }),
      expect.objectContaining({
        completion: true,
        dependsOn: [questKey("Cook's Assistant", '1')],
        questPoints: 1,
        xpRewards: { Cooking: 300 },
      }),
    ]);
    expect(result['Sheep Shearer']).toEqual([
      expect.objectContaining({
        id: questKey('Sheep Shearer', '1'),
        description: 'Talk to Fred the Farmer',
      }),
      expect.objectContaining({
        completion: true,
        dependsOn: [questKey('Sheep Shearer', '1')],
      }),
    ]);
  });

  it('uses same-pin task mappings without allowing an unselected quest to leak', () => {
    const source = chunkPickerFixture();
    const mapping = {
      [questKey("Cook's Assistant", '1')]: 'task-cook-1',
      [questKey('A Fifth Quest', '1')]: 'task-fifth-1',
    };
    const first = extractQuestTasks(source, ["Cook's Assistant", 'Sheep Shearer'], mapping);
    const second = extractQuestTasks(source, ["Cook's Assistant", 'Sheep Shearer'], mapping);
    expect(first["Cook's Assistant"][0].id).toBe('task-cook-1');
    expect(first).toEqual(second);
    expect(JSON.stringify(first)).not.toContain('A Fifth Quest');
  });

  it('rejects blank or duplicate selected quest IDs', () => {
    expect(() => extractQuestTasks(chunkPickerFixture(), ["Cook's Assistant", "Cook's Assistant"]))
      .toThrow(/duplicate/i);
    expect(() => extractQuestTasks(chunkPickerFixture(), [' '])).toThrow(/blank/i);
  });

  it('preserves ordered quick-guide list lines and material nested notes', () => {
    expect(extractQuickGuideLines(wikiFixture())).toEqual([
      {
        id: 'cooks-assistant-walkthrough-1',
        section: 'Walkthrough',
        sourceOrder: 1,
        rawText: 'Talk to [[Cook (Lumbridge)|the Cook]].',
        text: 'Talk to the Cook.',
      },
      {
        id: 'cooks-assistant-walkthrough-2',
        section: 'Walkthrough',
        sourceOrder: 2,
        rawText: 'Bring a {{plink|bucket of milk}}.',
        text: 'Bring a bucket of milk.',
        parentLineId: 'cooks-assistant-walkthrough-1',
      },
      {
        id: 'cooks-assistant-walkthrough-3',
        section: 'Walkthrough',
        sourceOrder: 3,
        rawText: "'''Note:''' Use the [[wheat]] on the hopper.",
        text: 'Note: Use the wheat on the hopper.',
        parentLineId: 'cooks-assistant-walkthrough-1',
      },
      {
        id: 'cooks-assistant-walkthrough-4',
        section: 'Walkthrough',
        sourceOrder: 4,
        rawText: 'Return to {{npc|Cook}}.',
        text: 'Return to Cook.',
      },
    ]);
  });

  it('produces stable IDs and canonical JSON while preserving array order', () => {
    expect(extractQuickGuideLines(wikiFixture())).toEqual(extractQuickGuideLines(wikiFixture()));
    expect(stableJson({ z: 1, a: { y: 2, b: 3 }, rows: ['second', 'first'] })).toBe(
      '{\n  "a": {\n    "b": 3,\n    "y": 2\n  },\n  "rows": [\n    "second",\n    "first"\n  ],\n  "z": 1\n}\n',
    );
  });

  it('rejects missing task dependencies and dependency cycles', () => {
    expect(() => validateTaskGraph(missingTaskFixture())).toThrow(/missing dependency/i);
    expect(() => validateTaskGraph(cyclicTaskFixture())).toThrow(/cycle/i);
  });

  it('compiles bootstrap sources to preview-only empty runtime definitions', () => {
    const catalogue = compileWalkthroughCatalogue({
      schemaVersion: 1,
      phase: 'SOURCE_BOOTSTRAP',
      chunkPicker: {
        repository: 'source-chunk/chunk-picker-v2',
        commit: 'ba2fcebf8b26c84c74f8d9ab328a0ede802be926',
        licenceStatus: 'UNVERIFIED',
      },
      wiki: {
        licence: 'CC BY-NC-SA 3.0',
        licenceUrl: 'https://creativecommons.org/licenses/by-nc-sa/3.0/',
      },
      quests: [{
        questId: "Cook's Assistant",
        wikiTitle: "Cook's Assistant/Quick guide",
        wikiRevision: 15238952,
        wikiRevisionTimestamp: '2026-06-24T23:03:17Z',
        wikiUrl: 'https://oldschool.runescape.wiki/w/Cook%27s_Assistant/Quick_guide?oldid=15238952',
        importedLines: extractQuickGuideLines(wikiFixture()),
        tasks: [],
      }],
    }, { schemaVersion: 1, quests: { "Cook's Assistant": [] } });

    expect(catalogue).toEqual({
      phase: 'SOURCE_BOOTSTRAP',
      walkthroughs: [{
        questId: "Cook's Assistant",
        revision: '87c5622ad151afff28fed162fd85155bf8a44b7f8ac3952c3b3cc414db27d0ad',
        releaseStatus: 'PREVIEW_ONLY',
        source: {
          wikiTitle: "Cook's Assistant/Quick guide",
          wikiRevision: '15238952',
          wikiRevisionTimestamp: '2026-06-24T23:03:17Z',
          wikiUrl: 'https://oldschool.runescape.wiki/w/Cook%27s_Assistant/Quick_guide?oldid=15238952',
          wikiLicence: 'CC BY-NC-SA 3.0',
          wikiLicenceUrl: 'https://creativecommons.org/licenses/by-nc-sa/3.0/',
          chunkPickerRepository: 'source-chunk/chunk-picker-v2',
          chunkPickerCommit: 'ba2fcebf8b26c84c74f8d9ab328a0ede802be926',
          chunkPickerLicenceStatus: 'UNVERIFIED',
        },
        sourceLines: [],
        actions: [],
      }],
    });
  });

  it.each([
    ['missing dependency', (action: any) => { action.dependsOn = ['missing-action']; }],
    ['blank transformation ID', (action: any) => {
      action.coach.preferredMethod = { kind: 'TRANSFORMATION', recipeId: '   ' };
    }],
    ['non-canonical completion item key', (action: any) => {
      action.coach.fulfils = [{ item: { key: 'pot', name: 'Pot' }, quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' }];
      action.coach.completion = { kind: 'ITEM_CONFIRMED', itemKey: 'Pot' };
    }],
  ])('rejects reviewed coach metadata with %s', (_label, mutate) => {
    const source = reviewedStrategySourceFixture();
    const review = reviewedStrategyReviewFixture();
    mutate(review.quests["Cook's Assistant"][0]);

    expect(() => compileWalkthroughCatalogue(source, review)).toThrow();
  });

  it('keeps legacy reviewed walkthrough actions transport-valid but strategy-ineligible', () => {
    const source = reviewedStrategySourceFixture();
    const review = reviewedStrategyReviewFixture();
    delete (review.quests["Cook's Assistant"][0] as { coach?: unknown }).coach;

    const catalogue = compileWalkthroughCatalogue(source, review);
    expect(catalogue.walkthroughs[0].actions[0]).not.toHaveProperty('coach');
    expect(questStrategyFromWalkthrough(catalogue.walkthroughs[0])).toBeNull();
  });

  it('accepts exact location evidence in a reviewed strategy pack', () => {
    const source = reviewedStrategySourceFixture();
    const review = reviewedStrategyReviewFixture();
    review.quests["Cook's Assistant"][0].confidence = 'EXACT';
    review.quests["Cook's Assistant"][0].location = {
      kind: 'EXACT_ENTITY',
      entity: { kind: 'npc', name: 'Cook' },
    };

    expect(compileWalkthroughCatalogue(source, review).walkthroughs).toHaveLength(1);
  });
});

import { mkdtemp, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pinnedWalkthroughSource from '../data/sources/quest-walkthrough-sources.json';
import reviewedMembership from '../data/sources/f2p-quest-membership.json';

const CLI_EXISTING_QUESTS = ["Cook's Assistant", "Daddy's Home", "Doric's Quest", 'Elemental Workshop I'];
const CLI_TASK_MAPPINGS = {
  "~|Cook's Assistant|~ 1": 't_7591',
  "~|Cook's Assistant|~ 2a": 't_7592',
  "~|Cook's Assistant|~ 2b": 't_7593',
  "~|Cook's Assistant|~ 2c": 't_7594',
  "~|Cook's Assistant|~ 3": 't_7595',
  "~|Cook's Assistant|~ Complete the quest": 't_7596',
  "~|Daddy's Home|~ 1": 't_9590',
  "~|Daddy's Home|~ 2": 't_9591',
  "~|Daddy's Home|~ 3a": 't_9592',
  "~|Daddy's Home|~ 3b": 't_9593',
  "~|Daddy's Home|~ 3c1": 't_9594',
  "~|Daddy's Home|~ 3c2": 't_9595',
  "~|Daddy's Home|~ 3c3": 't_9596',
  "~|Daddy's Home|~ 4": 't_9597',
  "~|Daddy's Home|~ 5": 't_9598',
  "~|Daddy's Home|~ Complete the quest": 't_9599',
  "~|Doric's Quest|~ 1": 't_7620',
  "~|Doric's Quest|~ 2": 't_7621',
  "~|Doric's Quest|~ Complete the quest": 't_7622',
  "~|Elemental Workshop I|~ 1": 't_8157',
  "~|Elemental Workshop I|~ 2": 't_8158',
  "~|Elemental Workshop I|~ 3": 't_8159',
  "~|Elemental Workshop I|~ 4": 't_8160',
  "~|Elemental Workshop I|~ 5": 't_8161',
  "~|Elemental Workshop I|~ Complete the quest": 't_8162',
  "~|Elemental Workshop I|~ Crafting skill requirement": 't_1425',
  "~|Elemental Workshop I|~ Mining skill requirement": 't_2768',
  "~|Elemental Workshop I|~ Smithing skill requirement": 't_3465',
};

const EXPECTED_REVIEW_TASK_IDS = {
  "Cook's Assistant": ['t_7591', 't_7592', 't_7593', 't_7594', 't_7595', 't_7596'],
  "Daddy's Home": ['t_9590', 't_9591', 't_9592', 't_9593', 't_9594', 't_9595', 't_9596', 't_9597', 't_9598', 't_9599'],
  "Doric's Quest": ['t_7620', 't_7621', 't_7622'],
  'Elemental Workshop I': ['t_8157', 't_8158', 't_8159', 't_8160', 't_8161', 't_8162'],
} as const;

describe('same-commit review task provenance', () => {
  it('pins the exact 25 quest task IDs to the committed task map', () => {
    expect(pinnedWalkthroughSource.chunkPicker.commit).toBe('ba2fcebf8b26c84c74f8d9ab328a0ede802be926');
    expect(pinnedWalkthroughSource.chunkPicker.tasksMapSha256).toBe(
      'f740b7194189f1a3ef81515ca4d4872caf91a6516a93bdf64c5d43c93d33bd8a',
    );

    for (const quest of pinnedWalkthroughSource.quests) {
      expect(quest.tasks.map(task => task.id)).toEqual(
        EXPECTED_REVIEW_TASK_IDS[quest.questId as keyof typeof EXPECTED_REVIEW_TASK_IDS],
      );
      for (const task of quest.tasks) {
        expect((pinnedWalkthroughSource.chunkPicker.taskMappings as Record<string, string>)[task.sourceId]).toBe(task.id);
      }
    }
  });
});

const cliSourceFixture = (phase: 'SOURCE_BOOTSTRAP' | 'REVIEWED' = 'SOURCE_BOOTSTRAP') => ({
  schemaVersion: 1,
  phase,
  chunkPicker: {
    repository: 'source-chunk/chunk-picker-v2',
    branch: 'gh-pages',
    commit: 'ba2fcebf8b26c84c74f8d9ab328a0ede802be926',
    exportPath: 'chunkpicker-chunkinfo-export.json',
    tasksMapUrl: 'https://raw.githubusercontent.com/source-chunk/chunk-picker-v2/ba2fcebf8b26c84c74f8d9ab328a0ede802be926/tasksMap.json',
    tasksMapSha256: 'f740b7194189f1a3ef81515ca4d4872caf91a6516a93bdf64c5d43c93d33bd8a',
    taskMappings: structuredClone(CLI_TASK_MAPPINGS),
    attribution: 'Chunk Picker by the source-chunk contributors.',
    licenceStatus: 'UNVERIFIED',
  },
  wiki: {
    apiEndpoint: 'https://oldschool.runescape.wiki/api.php',
    attribution: 'Old School RuneScape Wiki contributors.',
    licence: 'CC BY-NC-SA 3.0',
    licenceUrl: 'https://creativecommons.org/licenses/by-nc-sa/3.0/',
  },
  quests: CLI_EXISTING_QUESTS.map((questId, index) => {
    const wikiTitle = questId + '/Quick guide';
    const wikiRevision = 15000000 + index;
    return {
      questId,
      wikiTitle,
      wikiRevision,
      wikiRevisionTimestamp: '2026-07-31T10:00:00Z',
      wikiUrl: 'https://oldschool.runescape.wiki/w/' + encodeURIComponent(wikiTitle.replaceAll(' ', '_')).replaceAll('%2F', '/') + '?oldid=' + wikiRevision,
      importedLines: phase === 'REVIEWED' ? [{
        id: questId.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-walkthrough-1',
        section: 'Walkthrough',
        sourceOrder: 1,
        rawText: 'Talk to ' + questId + '.',
        text: 'Talk to ' + questId + '.',
      }] : [],
      tasks: [],
    };
  }),
});

const cliReviewFixture = (source: ReturnType<typeof cliSourceFixture>) => ({
  schemaVersion: 1,
  quests: Object.fromEntries(source.quests.map(quest => [quest.questId, quest.importedLines.map(line => ({
    id: line.id + '-action',
    section: 'QUEST',
    sourceOrder: line.sourceOrder,
    kind: 'INFORMATION',
    confidence: 'UNMAPPED',
    displayText: line.text,
    rawWikiLineIds: [line.id],
    dependsOn: [],
    entities: [],
    items: [],
    gates: [],
    location: { kind: 'NONE' },
  }))])),
  sourceLineDigests: Object.fromEntries(source.quests.map(quest => [quest.questId, Object.fromEntries(
    quest.importedLines.map(line => [line.id, sourceLineDigest(line)]),
  )])),
});

const cliTemporaryPaths = async (source = cliSourceFixture(), review: any = {
  schemaVersion: 1,
  quests: Object.fromEntries(CLI_EXISTING_QUESTS.map(quest => [quest, []])),
  sourceLineDigests: Object.fromEntries(CLI_EXISTING_QUESTS.map(quest => [quest, {}])),
}) => {
  const root = await mkdtemp(join(tmpdir(), 'walkthrough-source-'));
  const paths = {
    source: join(root, 'source.json'),
    review: join(root, 'review.json'),
    generated: join(root, 'generated.json'),
    candidate: join(root, 'candidate.json'),
    membership: join(root, 'membership.json'),
  };
  await writeFile(paths.source, stableJson(source));
  await writeFile(paths.review, stableJson(review));
  await writeFile(paths.generated, stableJson(compileWalkthroughCatalogue(source, review)));
  await writeFile(paths.membership, stableJson(reviewedMembership));
  return { root, paths };
};

describe('walkthrough maintenance CLI', () => {
  it('checks committed files offline without writing them', async () => {
    const { paths } = await cliTemporaryPaths();
    const tracked = [paths.source, paths.review, paths.generated];
    const before = await Promise.all(tracked.map(path => readFile(path, 'utf8')));
    const output: string[] = [];
    const { runWalkthroughSync } = await import('./sync-quest-walkthroughs.mjs');
    await runWalkthroughSync({
      mode: 'check',
      paths,
      fetchImpl: async () => { throw new Error('network must stay offline'); },
      write: line => output.push(line),
    });
    expect(await Promise.all(tracked.map(path => readFile(path, 'utf8')))).toEqual(before);
    expect(output.join('\n')).toMatch(/4 source quest records.*SOURCE_BOOTSTRAP/i);
  });

  it('accepts Windows line endings without weakening stable generated content checks', async () => {
    const { paths } = await cliTemporaryPaths();
    const generated = await readFile(paths.generated, 'utf8');
    await writeFile(paths.generated, generated.replaceAll('\n', '\r\n'));
    const { runWalkthroughSync } = await import('./sync-quest-walkthroughs.mjs');

    await expect(runWalkthroughSync({
      mode: 'check',
      paths,
      fetchImpl: async () => { throw new Error('check must stay offline'); },
      write: () => undefined,
    })).resolves.toBeUndefined();
  });

  it('accepts reordered source-line digest quest entries during offline check', async () => {
    const source = cliSourceFixture('REVIEWED');
    const review = cliReviewFixture(source);
    review.sourceLineDigests = Object.fromEntries(
      Object.entries(review.sourceLineDigests).reverse(),
    );
    const { paths } = await cliTemporaryPaths(source, review);
    await writeFile(paths.review, `${JSON.stringify(review, null, 2)}\n`);
    const { runWalkthroughSync } = await import('./sync-quest-walkthroughs.mjs');

    await expect(runWalkthroughSync({
      mode: 'check',
      paths,
      fetchImpl: async () => { throw new Error('check must stay offline'); },
      write: () => undefined,
    })).resolves.toBeUndefined();
  });

  it('refreshes a selected membership quest only into a candidate while committed artefacts remain byte-identical', async () => {
    const committedPaths = [
      new URL('../data/sources/quest-walkthrough-sources.json', import.meta.url),
      new URL('../data/sources/quest-walkthrough-review.json', import.meta.url),
      new URL('../data/questWalkthroughs.generated.json', import.meta.url),
    ];
    const committedBefore = await Promise.all(committedPaths.map(path => readFile(path, 'utf8')));
    const source = JSON.parse(committedBefore[0]);
    const review = JSON.parse(committedBefore[1]);
    const { paths } = await cliTemporaryPaths(source, review);
    await writeFile(paths.generated, committedBefore[2]);
    const { runWalkthroughSync } = await import('./sync-quest-walkthroughs.mjs');
    const taskMap = {
      ...CLI_TASK_MAPPINGS,
      [questKey('Sheep Shearer', '1')]: 't_7702',
      [questKey('Sheep Shearer', '2')]: 't_7703',
      [questKey('Sheep Shearer', 'Complete the quest')]: 't_7704',
    };
    const requestedUrls: URL[] = [];
    const fetchImpl = async (input: URL | string) => {
      const url = new URL(String(input));
      requestedUrls.push(url);
      if (url.hostname === 'raw.githubusercontent.com') return new Response(JSON.stringify(taskMap));
      const titles = (url.searchParams.get('titles') ?? '').split('|').filter(Boolean);
      if (url.searchParams.get('rvprop') === 'ids|timestamp') {
        return Response.json({ query: { pages: titles.map((title, index) => ({
          title,
          revisions: [{ revid: 16000000 + index, timestamp: '2026-07-31T10:00:00Z' }],
        })) } });
      }
      return Response.json({ query: { pages: [{
        title: titles[0],
        revisions: [{ slots: { main: { content: '== Walkthrough ==\n# Talk to [[' + titles[0] + ']].' } } }],
      }] } });
    };
    const output: string[] = [];
    await runWalkthroughSync({
      mode: 'refresh',
      questIds: ['sheep-shearer'],
      paths,
      fetchImpl,
      readChunkSource: async () => ({ data: chunkPickerFixture() }),
      tasksMapDigest: () => 'f740b7194189f1a3ef81515ca4d4872caf91a6516a93bdf64c5d43c93d33bd8a',
      write: line => output.push(line),
    });
    expect(await Promise.all(committedPaths.map(path => readFile(path, 'utf8')))).toEqual(committedBefore);
    const candidate = JSON.parse(await readFile(paths.candidate, 'utf8'));
    expect(candidate.chunkPicker.taskMappings).toHaveProperty(questKey("Cook's Assistant", '1'), 't_7591');
    expect(candidate.chunkPicker.taskMappings).toHaveProperty(questKey('Sheep Shearer', '1'), 't_7702');
    expect(candidate.chunkPicker.tasksMapSha256).toBe('f740b7194189f1a3ef81515ca4d4872caf91a6516a93bdf64c5d43c93d33bd8a');
    expect(candidate.quests.map((quest: any) => quest.questId)).toEqual([
      ...source.quests.map((quest: any) => quest.questId),
      'Sheep Shearer',
    ]);
    expect(candidate.quests.every((quest: any) => quest.importedLines.length === 1)).toBe(true);
    expect(requestedUrls.filter(url => url.hostname === 'raw.githubusercontent.com')).toEqual([
      expect.objectContaining({
        href: 'https://raw.githubusercontent.com/source-chunk/chunk-picker-v2/ba2fcebf8b26c84c74f8d9ab328a0ede802be926/tasksMap.json',
      }),
    ]);
    requestedUrls.filter(url => url.searchParams.get('rvprop') === 'content').forEach((url) => {
      expect(url.origin).toBe('https://oldschool.runescape.wiki');
      expect(url.searchParams.get('rvstartid')).toBe(url.searchParams.get('rvendid'));
    });
    expect(output.join('\n')).toMatch(/added.*removed.*reordered.*task-changed.*unresolved/i);
  });

  it('promotes only complete agreement atomically and retains the licence gate', async () => {
    const candidate = cliSourceFixture('REVIEWED');
    const review = cliReviewFixture(candidate);
    const { root, paths } = await cliTemporaryPaths(cliSourceFixture(), review);
    await writeFile(paths.candidate, stableJson(candidate));
    const { runWalkthroughSync } = await import('./sync-quest-walkthroughs.mjs');
    await runWalkthroughSync({
      mode: 'promote',
      paths,
      fetchImpl: async () => { throw new Error('promotion must stay offline'); },
      write: () => undefined,
    });
    expect(JSON.parse(await readFile(paths.source, 'utf8')).phase).toBe('REVIEWED');
    const generated = JSON.parse(await readFile(paths.generated, 'utf8'));
    expect(generated.walkthroughs).toHaveLength(candidate.quests.length);
    expect(generated.walkthroughs.every((walkthrough: any) => walkthrough.releaseStatus === 'PREVIEW_ONLY')).toBe(true);
    expect((await readdir(root)).some(name => name.includes('.tmp-'))).toBe(false);

    const invalid = cliSourceFixture('REVIEWED');
    invalid.wiki.licence = 'UNKNOWN' as any;
    const invalidPaths = await cliTemporaryPaths(cliSourceFixture(), cliReviewFixture(invalid));
    await writeFile(invalidPaths.paths.candidate, stableJson(invalid));
    await expect(runWalkthroughSync({
      mode: 'promote',
      paths: invalidPaths.paths,
      write: () => undefined,
    })).rejects.toThrow(/licence/i);
  });

  it('promotes a selected fifth quest only after source-line digests, reviewed tasks, and dependency edges agree', async () => {
    const candidate: any = cliSourceFixture('REVIEWED');
    const sheep = {
      questId: 'Sheep Shearer',
      wikiTitle: 'Sheep Shearer/Quick guide',
      wikiRevision: 15000004,
      wikiRevisionTimestamp: '2026-07-31T10:00:00Z',
      wikiUrl: 'https://oldschool.runescape.wiki/w/Sheep_Shearer/Quick_guide?oldid=15000004',
      importedLines: [
        { id: 'sheep-shearer-walkthrough-1', section: 'Walkthrough', sourceOrder: 1, rawText: 'Talk to Fred.', text: 'Talk to Fred.' },
        { id: 'sheep-shearer-walkthrough-2', section: 'Walkthrough', sourceOrder: 2, rawText: 'Shear sheep.', text: 'Shear sheep.' },
      ],
      tasks: [
        { id: 't_7702', sourceId: questKey('Sheep Shearer', '1'), dependsOn: [] },
        { id: 't_7704', sourceId: questKey('Sheep Shearer', 'Complete the quest'), dependsOn: ['t_7702'] },
      ],
    };
    candidate.quests.push(sheep);
    candidate.chunkPicker.taskMappings[questKey('Sheep Shearer', '1')] = 't_7702';
    candidate.chunkPicker.taskMappings[questKey('Sheep Shearer', 'Complete the quest')] = 't_7704';
    const review: any = cliReviewFixture(candidate);
    review.sourceLineDigests['Sheep Shearer'][sheep.importedLines[0].id] = 'stale-digest';
    const { paths } = await cliTemporaryPaths(cliSourceFixture(), review);
    await writeFile(paths.candidate, stableJson(candidate));
    const { runWalkthroughSync } = await import('./sync-quest-walkthroughs.mjs');

    await expect(runWalkthroughSync({ mode: 'promote', paths, write: () => undefined }))
      .rejects.toThrow(/source line.*digest/i);

    review.sourceLineDigests['Sheep Shearer'][sheep.importedLines[0].id] = sourceLineDigest(sheep.importedLines[0]);
    await writeFile(paths.review, stableJson(review));
    await expect(runWalkthroughSync({ mode: 'promote', paths, write: () => undefined }))
      .rejects.toThrow(/does not cover every pinned task/i);

    review.quests['Sheep Shearer'][0].chunkPickerTaskId = 't_7702';
    review.quests['Sheep Shearer'][1].chunkPickerTaskId = 't_7704';
    await writeFile(paths.review, stableJson(review));
    await expect(runWalkthroughSync({ mode: 'promote', paths, write: () => undefined }))
      .rejects.toThrow(/task dependency edge/i);

    review.quests['Sheep Shearer'][1].dependsOn = [review.quests['Sheep Shearer'][0].id];
    await writeFile(paths.review, stableJson(review));
    await expect(runWalkthroughSync({ mode: 'promote', paths, write: () => undefined })).resolves.toBeUndefined();
    expect(JSON.parse(await readFile(paths.source, 'utf8')).quests.map((quest: any) => quest.questId)).toContain('Sheep Shearer');
    expect(JSON.parse(await readFile(paths.generated, 'utf8')).walkthroughs).toHaveLength(5);
  });
});
describe('quick-guide parser regression coverage', () => {
  it('stops at non-walkthrough footer sections and fully normalizes nested templates', () => {
    expect(extractQuickGuideLines({
      questId: "Cook's Assistant",
      wikitext: [
        '== Walkthrough ==',
        '# Buy for {{Coins|{{GEP|Egg|1}} + {{GEP|Pot of flour|1}}}} coins.',
        '== Rewards ==',
        '* 300 Cooking experience',
        '== Required for completing ==',
        '* [[Recipe for Disaster]]',
      ].join('\n'),
    })).toEqual([expect.objectContaining({ text: 'Buy for 1 Egg + 1 Pot of flour coins.' })]);
  });
});
describe('walkthrough CLI argument parsing', () => {
  it('parses selected refresh membership slugs and rejects IDs outside refresh', async () => {
    const { parseWalkthroughSyncArgs } = await import('./sync-quest-walkthroughs.mjs');
    expect(parseWalkthroughSyncArgs(['--refresh', '--quest-id=sheep-shearer'])).toEqual({
      mode: 'refresh',
      questIds: ['sheep-shearer'],
    });
    expect(() => parseWalkthroughSyncArgs(['--check', '--quest-id=sheep-shearer']))
      .toThrow(/quest-id.*refresh/i);
    expect(() => parseWalkthroughSyncArgs(['--refresh', '--quest-id=elemental-workshop-i']))
      .toThrow(/F2P membership/i);
    expect(() => parseWalkthroughSyncArgs(['--other'])).toThrow(/unknown command/i);
  });
});
describe('promotion graph validation', () => {
  it('rejects a reviewed source line when the same ID has changed wording', async () => {
    const candidate = cliSourceFixture('REVIEWED');
    const review = cliReviewFixture(candidate);
    candidate.quests[0].importedLines[0].rawText = 'Changed wording under the same positional ID.';
    candidate.quests[0].importedLines[0].text = 'Changed wording under the same positional ID.';
    const { paths } = await cliTemporaryPaths(cliSourceFixture(), review);
    await writeFile(paths.candidate, stableJson(candidate));
    const { runWalkthroughSync } = await import('./sync-quest-walkthroughs.mjs');
    await expect(runWalkthroughSync({
      mode: 'promote',
      paths,
      fetchImpl: async () => { throw new Error('promotion must stay offline'); },
      write: () => undefined,
    })).rejects.toThrow(/source line.*digest/i);
  });

  it('requires every pinned task edge directly between its aligned actions', async () => {
    const candidate = cliSourceFixture('REVIEWED');
    candidate.quests[0].tasks = [
      { id: 't_7591', sourceId: questKey("Cook's Assistant", '1'), dependsOn: [] },
      { id: 't_7592', sourceId: questKey("Cook's Assistant", '2a'), dependsOn: ['t_7591'] },
    ] as any;
    const review = cliReviewFixture(candidate);
    review.quests["Cook's Assistant"].unshift({
      id: 'cook-start', section: 'QUEST', sourceOrder: 1, kind: 'TALK_TO', confidence: 'EXACT',
      displayText: 'Talk to Cook.', rawWikiLineIds: [], chunkPickerTaskId: 't_7591',
      dependsOn: [], entities: [], items: [], gates: [], location: { kind: 'NONE' },
    });
    review.quests["Cook's Assistant"][1].id = 'cook-next';
    review.quests["Cook's Assistant"][1].chunkPickerTaskId = 't_7592';
    const { validateReviewAgreement } = await import('./sync-quest-walkthroughs.mjs');

    expect(() => validateReviewAgreement(candidate, review)).toThrow(/task dependency edge/i);
    review.quests["Cook's Assistant"][1].dependsOn = ['cook-start'];
    expect(() => validateReviewAgreement(candidate, review)).not.toThrow();
  });

  it('rejects reviewed action dependencies that are missing', async () => {
    const candidate = cliSourceFixture('REVIEWED');
    const review = cliReviewFixture(candidate);
    review.quests["Cook's Assistant"][0].dependsOn = ['missing-action'];
    const { paths } = await cliTemporaryPaths(cliSourceFixture(), review);
    await writeFile(paths.candidate, stableJson(candidate));
    const { runWalkthroughSync } = await import('./sync-quest-walkthroughs.mjs');
    await expect(runWalkthroughSync({
      mode: 'promote',
      paths,
      write: () => undefined,
    })).rejects.toThrow(/missing dependency/i);
  });
});
describe('review-finding template normalization', () => {
  it('retains item and NPC names from supported simple templates', () => {
    expect(extractQuickGuideLines({
      questId: "Cook's Assistant",
      wikitext: [
        '== Walkthrough ==',
        '# Bring {{GEP|Pot of flour|1}}, {{plink|Bucket of milk|pic=yes}}, and talk to {{npc|Cook|img=yes}}.',
      ].join('\n'),
    })[0].text).toBe('Bring 1 Pot of flour, Bucket of milk, and talk to Cook.');
  });
});

describe('review-finding pinned task-map validation', () => {
  it('rejects a fabricated digest, a fifth-quest mapping, and an inconsistent task ID', async () => {
    const { validateWalkthroughSource } = await import('./sync-quest-walkthroughs.mjs');
    const fabricatedDigest = cliSourceFixture();
    fabricatedDigest.chunkPicker.tasksMapSha256 = 'b'.repeat(64);
    expect(() => validateWalkthroughSource(fabricatedDigest, reviewedMembership)).toThrow(/pinned.*sha-256/i);

    const fifthQuest = cliSourceFixture();
    fifthQuest.chunkPicker.taskMappings[questKey('A Fifth Quest', '1')] = 'task-fifth';
    expect(() => validateWalkthroughSource(fifthQuest, reviewedMembership)).toThrow(/task mapping/i);

    const inconsistentTask = cliSourceFixture();
    inconsistentTask.quests[0].tasks = [{
      id: 'not-t_7591', sourceId: questKey("Cook's Assistant", '1'), dependsOn: [],
    }] as any;
    expect(() => validateWalkthroughSource(inconsistentTask, reviewedMembership)).toThrow(/task id.*pinned mapping/i);
  });

  it('rejects an in-roster fabricated task mapping that is absent from the immutable pinned snapshot', async () => {
    const { validateWalkthroughSource } = await import('./sync-quest-walkthroughs.mjs');
    const fabricatedInRosterMapping = cliSourceFixture();
    fabricatedInRosterMapping.chunkPicker.taskMappings[questKey('Sheep Shearer', '1')] = 't-fabricated-sheep';

    expect(() => validateWalkthroughSource(fabricatedInRosterMapping, reviewedMembership))
      .toThrow(/pinned mapping/i);
  });

  it('rejects a quest task that borrows a valid mapping from another in-roster quest', async () => {
    const { validateWalkthroughSource } = await import('./sync-quest-walkthroughs.mjs');
    const crossQuestTask = cliSourceFixture();
    crossQuestTask.chunkPicker.taskMappings[questKey('Sheep Shearer', '1')] = 't_7702';
    crossQuestTask.quests[0].tasks = [{
      id: 't_7702', sourceId: questKey('Sheep Shearer', '1'), dependsOn: [],
    }] as any;

    expect(() => validateWalkthroughSource(crossQuestTask, reviewedMembership))
      .toThrow(/belongs to.*quest/i);
  });
});

describe('review-finding atomic source promotion', () => {
  it('restores both originals and cleans temporary files when the second rename fails', async () => {
    const { root, paths } = await cliTemporaryPaths();
    const originalSource = await readFile(paths.source, 'utf8');
    const originalGenerated = await readFile(paths.generated, 'utf8');
    const { atomicWritePair } = await import('./sync-quest-walkthroughs.mjs');
    let renameCount = 0;
    await expect(atomicWritePair(
      paths.source,
      'new source',
      paths.generated,
      'new generated',
      {
        readFile,
        writeFile,
        unlink,
        rename: async (from: string, to: string) => {
          renameCount += 1;
          if (renameCount === 2) throw new Error('injected second rename failure');
          await rename(from, to);
        },
      },
    )).rejects.toThrow(/second rename failure/i);
    expect(await readFile(paths.source, 'utf8')).toBe(originalSource);
    expect(await readFile(paths.generated, 'utf8')).toBe(originalGenerated);
    expect((await readdir(root)).some(name => name.includes('.tmp-'))).toBe(false);
  });
});

describe('review-finding stable JSON key ordering', () => {
  it('orders object keys by deterministic UTF-16 code units', () => {
    expect(Object.keys(JSON.parse(stableJson({ a: 1, Z: 2 })))).toEqual(['Z', 'a']);
  });
});
describe('fix-round-2 staging rollback', () => {
  it('waits for a late staging write before rollback cleanup', async () => {
    const { root, paths } = await cliTemporaryPaths();
    const originalSource = await readFile(paths.source, 'utf8');
    const originalGenerated = await readFile(paths.generated, 'utf8');
    const { atomicWritePair } = await import('./sync-quest-walkthroughs.mjs');
    let stagingWrites = 0;

    await expect(atomicWritePair(
      paths.source,
      'new source',
      paths.generated,
      'new generated',
      {
        readFile,
        rename,
        unlink,
        writeFile: async (path: string, data: any) => {
          if (path.includes('.tmp-')) {
            stagingWrites += 1;
            if (stagingWrites === 1) throw new Error('injected staging write failure');
            await new Promise(resolve => setTimeout(resolve, 30));
          }
          await writeFile(path, data);
        },
      },
    )).rejects.toThrow(/staging write failure/i);

    await new Promise(resolve => setTimeout(resolve, 60));
    expect(await readFile(paths.source, 'utf8')).toBe(originalSource);
    expect(await readFile(paths.generated, 'utf8')).toBe(originalGenerated);
    expect((await readdir(root)).some(name => name.includes('.tmp-'))).toBe(false);
  });
});
