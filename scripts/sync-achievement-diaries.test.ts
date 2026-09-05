import {
  mkdtempSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  checkGeneratedDiary,
  checkGeneratedDiaryFiles,
  parseAchievementDiaryHtml,
  renderDiaryTasks,
  renderTaskIdMigrations,
  runDiaryMain,
  validateAudit,
  validateSnapshot,
} from './sync-achievement-diaries.mjs';

it.each([
  null,
  { kind: 'new-unsupported-gate' },
  { kind: 'method', skill: 'Fishing', tier: 0 },
  { kind: 'skill', skill: 'Fishing', level: 1.5 },
  { kind: 'item', id: 'cape', label: 'Cape', usage: 'other' },
  { kind: 'any', of: [{ kind: 'questPoints', count: -1 }] },
  { kind: 'all', of: [] },
])('rejects malformed typed diary predicate %j before generating content', predicate => {
  const snapshot = structuredClone(SIX_TASK_SNAPSHOT);
  Object.assign(snapshot.tasks[0], { predicates: [predicate] });
  expect(() => validateSnapshot(snapshot)).toThrow('Invalid Diary predicate');
});

const SIX_ROW_HTML = [
  '<table class="wikitable"><tbody>',
  '<tr><th>Level</th><th>Other skills</th><th>Quests needed</th>',
  '<th>Diary</th><th>Difficulty</th><th>Task</th></tr>',
  '<tr><td><span data-skill="Agility" data-level="5">5</span></td><td></td>',
  '<td>None</td><td>Falador</td><td>Easy</td>',
  '<td>Climb over the western Falador wall</td></tr>',
  '<tr><td><span data-skill="Mining" data-level="10">10</span></td><td></td>',
  '<td><a href="/w/Doric%27s_Quest">Doric\'s Quest</a></td><td>Falador</td><td>Easy</td>',
  '<td>Mine &amp; inspect some ore</td></tr>',
  '<tr><td><span data-skill="Smithing" data-level="13">13</span></td><td></td>',
  '<td><a href="/w/The_Knight%27s_Sword">The Knight\'s Sword</a></td><td>Falador</td><td>Easy</td>',
  '<td>Smith some blurite limbs on Doric&#39;s anvil</td></tr>',
  '<tr><td><span data-skill="Agility" data-level="42">42</span></td><td></td>',
  '<td></td><td>Falador</td><td>Medium</td>',
  '<td>Squeeze through the crevice in the Dwarven Mines</td></tr>',
  '<tr><td><span data-skill="Crafting" data-level="40">40</span></td>',
  '<td><span data-skill="Mining" data-level="40">40</span></td>',
  '<td></td><td>Falador</td><td>Medium</td>',
  '<td>Craft a fruit basket near the Falador allotment</td></tr>',
  '<tr><td><span data-skill="Magic" data-level="37">37</span></td><td></td>',
  '<td><a href="/w/Ratcatchers">Ratcatchers</a></td><td>Falador</td><td>Medium</td>',
  '<td>Teleport to Falador</td></tr>',
  '</tbody></table>',
].join('');

const SIX_TASK_SNAPSHOT = {
  source: {
    url: 'https://oldschool.runescape.wiki/w/Achievement_Diary/All_achievements',
    revision: 1,
    revisionTimestamp: '2026-07-23T00:00:00Z',
    officialRows: 6,
  },
  verifiedAt: '2026-07-23',
  tasks: [
    {
      id: 'fal_med_3',
      area: 'Falador',
      tier: 'Medium',
      tierId: 'Falador Medium',
      ordinal: 3,
      description: 'Teleport to Falador',
      skills: { Magic: 37 },
      quests: ['Ratcatchers'],
      regions: ['Asgarnia'],
      aliases: [],
    },
    {
      id: 'fal_easy_1',
      area: 'Falador',
      tier: 'Easy',
      tierId: 'Falador Easy',
      ordinal: 1,
      description: 'Climb over the western Falador wall',
      skills: { Agility: 5 },
      quests: [],
      regions: ['Asgarnia'],
      aliases: [],
    },
    {
      id: 'fal_easy_2',
      area: 'Falador',
      tier: 'Easy',
      tierId: 'Falador Easy',
      ordinal: 2,
      description: 'Mine & inspect some ore',
      skills: { Mining: 10 },
      quests: ["Doric's Quest"],
      regions: ['Asgarnia'],
      aliases: [],
    },
    {
      id: 'fal_easy_3',
      area: 'Falador',
      tier: 'Easy',
      tierId: 'Falador Easy',
      ordinal: 3,
      description: "Smith some blurite limbs on Doric's anvil",
      skills: { Smithing: 13 },
      quests: ["The Knight's Sword"],
      regions: ['Asgarnia'],
      aliases: [],
    },
    {
      id: 'fal_med_1',
      area: 'Falador',
      tier: 'Medium',
      tierId: 'Falador Medium',
      ordinal: 1,
      description: 'Squeeze through the crevice in the Dwarven Mines',
      skills: { Agility: 42 },
      quests: [],
      regions: ['Asgarnia'],
      aliases: [],
    },
    {
      id: 'fal_med_2',
      area: 'Falador',
      tier: 'Medium',
      tierId: 'Falador Medium',
      ordinal: 2,
      description: 'Craft a fruit basket near the Falador allotment',
      skills: { Crafting: 40, Mining: 40 },
      quests: [],
      regions: ['Asgarnia'],
      aliases: [],
    },
  ],
  retired: [],
};

describe('Achievement Diary source parser', () => {
  it('decodes six source rows across tiers and keeps their requirements', () => {
    const tasks = parseAchievementDiaryHtml(SIX_ROW_HTML);

    expect(tasks).toHaveLength(6);
    expect(tasks[1]).toMatchObject({
      area: 'Falador',
      tier: 'Easy',
      tierId: 'Falador Easy',
      description: 'Mine & inspect some ore',
      skills: { Mining: 10 },
      quests: ["Doric's Quest"],
    });
    expect(tasks[2].description).toBe("Smith some blurite limbs on Doric's anvil");
    expect(tasks[4].skills).toEqual({ Crafting: 40, Mining: 40 });
    expect(tasks.filter(task => task.tier === 'Medium')).toHaveLength(3);
  });

  it('renders frozen ids deterministically in Diary tier and ordinal order', () => {
    const snapshot: any = structuredClone(SIX_TASK_SNAPSHOT);
    snapshot.tasks[0].oneOf = [
      { label: 'Dusty key', items: ['Dusty key'] },
      { skills: { Agility: 70 }, combatLevel: 100, allQuests: true, anySkillLevel: 99 },
      { quests: ['Ratcatchers'], cas: ['Easy'], regions: ['Asgarnia'] },
    ];
    snapshot.tasks[0].combatLevel = 70;
    snapshot.tasks[0].allQuests = true;
    snapshot.tasks[0].anyOfRegions = ['Falador', 'Port Sarim'];
    snapshot.tasks[0].questPoints = 32;
    snapshot.tasks[0].manualRequirements = ['Confirm external progress'];
    const first = renderDiaryTasks(snapshot);
    const second = renderDiaryTasks(structuredClone(snapshot));

    expect(second).toBe(first);
    expect(first).toContain('// Generated from data/sources/achievement-diary-tasks.json.');
    expect(first.indexOf("id: 'fal_easy_1'")).toBeLessThan(first.indexOf("id: 'fal_med_1'"));
    expect(first).toContain('export interface DiaryTaskRequirementOption {');
    expect(first).toContain('oneOf?: DiaryTaskRequirementOption[];');
    expect(first).toContain('anyOfRegions?: string[];');
    expect(first).toContain('questPoints?: number;');
    expect(first).toContain('manualRequirements?: string[];');
    expect(first).toContain(
      "oneOf: [{ label: 'Dusty key', items: ['Dusty key'] }, { skills: { 'Agility': 70 }, combatLevel: 100, allQuests: true, anySkillLevel: 99 }, "
      + "{ quests: ['Ratcatchers'], cas: ['Easy'], regions: ['Asgarnia'] }], combatLevel: 70, allQuests: true",
    );
    expect(first).toContain(
      "questPoints: 32, manualRequirements: ['Confirm external progress']",
    );
    expect(first).toContain("anyOfRegions: ['Falador', 'Port Sarim']");
    expect(first.indexOf("id: 'fal_med_1'")).toBeLessThan(first.indexOf("id: 'fal_med_3'"));
    expect(first).toContain("description: 'Smith some blurite limbs on Doric\\'s anvil'");
  });

  it('refuses empty source input and duplicate frozen ids', () => {
    expect(() => parseAchievementDiaryHtml('')).toThrow(/empty/i);
    expect(() => renderDiaryTasks({
      ...SIX_TASK_SNAPSHOT,
      source: { ...SIX_TASK_SNAPSHOT.source, officialRows: 7 },
      tasks: [...SIX_TASK_SNAPSHOT.tasks, { ...SIX_TASK_SNAPSHOT.tasks[0] }],
    })).toThrow(/duplicate.*fal_med_3/i);
  });

  it('refuses unknown Diary tiers', () => {
    expect(() => renderDiaryTasks({
      ...SIX_TASK_SNAPSHOT,
      source: { ...SIX_TASK_SNAPSHOT.source, officialRows: 1 },
      tasks: [{
        ...SIX_TASK_SNAPSHOT.tasks[0],
        id: 'unknown_1',
        tierId: 'Sailing Easy',
      }],
    })).toThrow(/unknown.*Sailing Easy/i);
  });
});

describe('offline generated Diary verification', () => {
  it('rejects malformed item evidence and duplicate combined-skill members', () => {
    const malformedItems: any = structuredClone(SIX_TASK_SNAPSHOT);
    malformedItems.tasks[0].items = [42];
    expect(() => renderDiaryTasks(malformedItems)).toThrow(/items.*non-empty string/i);

    const duplicateCombined: any = structuredClone(SIX_TASK_SNAPSHOT);
    duplicateCombined.tasks[0].oneOf = [
      { combinedSkillLevel: { skills: ['Attack', 'Attack'], level: 130 } },
      { label: 'Other route' },
    ];
    expect(() => renderDiaryTasks(duplicateCombined)).toThrow(/combinedSkillLevel.*duplicate/i);
  });

  it('rejects malformed Quest Point and manual requirements', () => {
    const badQuestPoints: any = structuredClone(SIX_TASK_SNAPSHOT);
    badQuestPoints.tasks[0].questPoints = 0;
    expect(() => renderDiaryTasks(badQuestPoints)).toThrow(/questPoints/i);

    const badManual: any = structuredClone(SIX_TASK_SNAPSHOT);
    badManual.tasks[0].manualRequirements = [''];
    expect(() => renderDiaryTasks(badManual)).toThrow(/manualRequirements.*non-empty string/i);

    const nestedAnyRegions: any = structuredClone(SIX_TASK_SNAPSHOT);
    nestedAnyRegions.tasks[0].oneOf = [
      { anyOfRegions: ['Falador', 'Port Sarim'] },
      { label: 'Other route' },
    ];
    expect(() => renderDiaryTasks(nestedAnyRegions)).toThrow(/any-of regions.*only supported on tasks/i);
  });

  it('reports generated output drift without rewriting the supplied output', () => {
    const output = 'sentinel old output';

    expect(checkGeneratedDiary(SIX_TASK_SNAPSHOT, output)).toEqual({
      ok: false,
      errors: ['data/diaryTasks.ts is out of date'],
    });
    expect(output).toBe('sentinel old output');
  });

  it('accepts byte-identical generated output', () => {
    const expected = renderDiaryTasks(SIX_TASK_SNAPSHOT);

    expect(checkGeneratedDiary(SIX_TASK_SNAPSHOT, expected)).toEqual({
      ok: true,
      errors: [],
    });
  });

  it('accepts equivalent CRLF output for both generated files', () => {
    const diaryOutput = renderDiaryTasks(SIX_TASK_SNAPSHOT).replace(/\r?\n/g, '\r\n');
    const migrationOutput = renderTaskIdMigrations(SIX_TASK_SNAPSHOT).replace(/\r?\n/g, '\r\n');

    expect(checkGeneratedDiary(
      SIX_TASK_SNAPSHOT,
      diaryOutput,
      migrationOutput,
    )).toEqual({ ok: true, errors: [] });
  });

  it('reports every generated-file mismatch in one result', () => {
    expect(checkGeneratedDiary(
      SIX_TASK_SNAPSHOT,
      'stale Diary output',
      'stale migration output',
    )).toEqual({
      ok: false,
      errors: [
        'data/diaryTasks.ts is out of date',
        'utils/taskIdMigrations.ts is out of date',
      ],
    });
  });

  it('checks explicit files without network access or tracked-file writes', () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), 'fate-diary-check-'));
    const snapshotPath = join(fixtureRoot, 'snapshot.json');
    const diaryPath = join(fixtureRoot, 'diaryTasks.ts');
    const migrationPath = join(fixtureRoot, 'taskIdMigrations.ts');
    const snapshotText = JSON.stringify(SIX_TASK_SNAPSHOT);
    const diaryText = renderDiaryTasks(SIX_TASK_SNAPSHOT);
    const migrationText = renderTaskIdMigrations(SIX_TASK_SNAPSHOT);
    const originalFetch = globalThis.fetch;

    try {
      writeFileSync(snapshotPath, snapshotText, 'utf8');
      writeFileSync(diaryPath, diaryText, 'utf8');
      writeFileSync(migrationPath, migrationText, 'utf8');
      globalThis.fetch = (() => {
        throw new Error('offline verification attempted a network request');
      }) as typeof fetch;

      expect(checkGeneratedDiaryFiles({
        snapshotPath,
        diaryPath,
        migrationPath,
      })).toEqual({ ok: true, errors: [] });
      expect(readFileSync(snapshotPath, 'utf8')).toBe(snapshotText);
      expect(readFileSync(diaryPath, 'utf8')).toBe(diaryText);
      expect(readFileSync(migrationPath, 'utf8')).toBe(migrationText);

      const staleDiaryText = diaryText + 'stale byte';
      writeFileSync(diaryPath, staleDiaryText, 'utf8');
      expect(checkGeneratedDiaryFiles({
        snapshotPath,
        diaryPath,
        migrationPath,
      })).toEqual({
        ok: false,
        errors: ['data/diaryTasks.ts is out of date'],
      });
      expect(readFileSync(diaryPath, 'utf8')).toBe(staleDiaryText);
    } finally {
      globalThis.fetch = originalFetch;
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });
});

describe('Achievement Diary command entrypoint', () => {
  it('routes the package check command through the CLI runner', () => {
    const packageJson = JSON.parse(readFileSync(
      new URL('../package.json', import.meta.url),
      'utf8',
    ));

    expect(packageJson.scripts['diary:verify'])
      .toBe('node scripts/sync-achievement-diaries.mjs --check');
    expect(readFileSync(
      new URL('./sync-achievement-diaries.mjs', import.meta.url),
      'utf8',
    )).toContain('if (isMain) runDiaryMain();');
  });

  it('assigns exact check exit codes and never rewrites explicit output paths', () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), 'fate-diary-cli-'));
    const projectRoot = fileURLToPath(new URL('..', import.meta.url));
    const snapshotPath = join(fixtureRoot, 'snapshot.json');
    const diaryPath = join(fixtureRoot, 'diaryTasks.ts');
    const migrationPath = join(fixtureRoot, 'taskIdMigrations.ts');
    const snapshotText = readFileSync(
      join(projectRoot, 'data/sources/achievement-diary-tasks.json'),
      'utf8',
    );
    const snapshot = JSON.parse(snapshotText);
    const diaryText = renderDiaryTasks(snapshot);
    const migrationText = renderTaskIdMigrations(snapshot);
    const originalFetch = globalThis.fetch;
    const stdout: string[] = [];
    const stderr: string[] = [];
    const assignedExitCodes: number[] = [];
    const runCheck = () => runDiaryMain({
      args: ['--check'],
      paths: { snapshotPath, diaryPath, migrationPath, projectRoot },
      log: (message: string) => stdout.push(message),
      error: (message: string) => stderr.push(message),
      setExitCode: (code: number) => assignedExitCodes.push(code),
    });

    try {
      writeFileSync(snapshotPath, snapshotText, 'utf8');
      writeFileSync(diaryPath, diaryText, 'utf8');
      writeFileSync(migrationPath, migrationText, 'utf8');
      globalThis.fetch = (() => {
        throw new Error('CLI verification attempted a network request');
      }) as typeof fetch;

      expect(runCheck()).toBe(0);
      expect(assignedExitCodes).toEqual([0]);
      expect(stderr).toEqual([]);
      expect(stdout).toContain('[diary:verify] generated files are current.');
      expect(readFileSync(snapshotPath, 'utf8')).toBe(snapshotText);
      expect(readFileSync(diaryPath, 'utf8')).toBe(diaryText);
      expect(readFileSync(migrationPath, 'utf8')).toBe(migrationText);

      const staleDiaryText = diaryText + 'stale diary byte';
      const staleMigrationText = migrationText + 'stale migration byte';
      writeFileSync(diaryPath, staleDiaryText, 'utf8');
      writeFileSync(migrationPath, staleMigrationText, 'utf8');
      stdout.length = 0;
      stderr.length = 0;
      assignedExitCodes.length = 0;

      expect(runCheck()).toBe(1);
      expect(assignedExitCodes).toEqual([1]);
      expect(stderr).toEqual([
        '[diary:verify] data/diaryTasks.ts is out of date',
        '[diary:verify] utils/taskIdMigrations.ts is out of date',
      ]);
      expect(readFileSync(snapshotPath, 'utf8')).toBe(snapshotText);
      expect(readFileSync(diaryPath, 'utf8')).toBe(staleDiaryText);
      expect(readFileSync(migrationPath, 'utf8')).toBe(staleMigrationText);
    } finally {
      globalThis.fetch = originalFetch;
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });
});

it('keeps outer task rows when a requirement cell contains a nested table', () => {
  const html = [
    '<table class="wikitable"><tbody>',
    '<tr><th>Diary</th><th>Difficulty</th><th>Task</th><th>Requirements</th></tr>',
    '<tr><td>Fremennik</td><td>Hard</td><td>First task</td><td>',
    '<table><tbody><tr><td>Nested dialogue</td></tr></tbody></table>',
    '</td></tr>',
    '<tr><td>Fremennik</td><td>Hard</td><td>Second task</td><td>None</td></tr>',
    '</tbody></table>',
  ].join('');

  expect(parseAchievementDiaryHtml(html).map(task => task.description)).toEqual([
    'First task',
    'Second task',
  ]);
});

describe('Achievement Diary id-classification audit', () => {
  const loadSnapshot = () => JSON.parse(readFileSync(
    new URL('../data/sources/achievement-diary-tasks.json', import.meta.url),
    'utf8',
  ));

  it('derives the historical partition instead of trusting reported counters', () => {
    const snapshot = loadSnapshot();
    snapshot.tasks[0].classification = 'new-canonical';

    expect(() => validateAudit(snapshot)).toThrow(/classification.*mismatch/i);
  });

  it('rejects an id classified as both retired and current', () => {
    const snapshot = loadSnapshot();
    snapshot.retired[0].id = snapshot.tasks[0].id;

    expect(() => validateAudit(snapshot)).toThrow(/retired.*current|collision/i);
  });

  it('rejects unknown references even when the reported counter is zero', () => {
    const snapshot = loadSnapshot();
    snapshot.tasks[0].skills.NotASkill = 1;

    expect(() => validateAudit(snapshot)).toThrow(/unknown.*NotASkill/i);
  });

  it('rejects unknown canonical names in nested typed predicates', () => {
    const snapshot = loadSnapshot();
    snapshot.tasks[0].predicates = [{ kind: 'any', of: [{ kind: 'equipment', slot: 'NotASlot', tier: 1 }] }];
    expect(() => validateAudit(snapshot)).toThrow(/unknown.*NotASlot/i);
  });

  it('rejects unknown references nested inside an alternative route', () => {
    const snapshot = loadSnapshot();
    snapshot.tasks[0].oneOf = [
      { label: 'Untracked route' },
      { skills: { NotASkill: 1 } },
    ];

    expect(() => validateAudit(snapshot)).toThrow(/unknown.*NotASkill/i);
  });

  it('stores every audited alternative route without cumulative mandatory gates', () => {
    const snapshot = loadSnapshot();
    const byId = new Map(snapshot.tasks.map(task => [task.id, task]));
    const alternativeIds = snapshot.tasks
      .filter(task => task.oneOf?.length)
      .map(task => task.id)
      .sort();

    expect(alternativeIds).toEqual([
      'ard_med_6',
      'fal_elite_1',
      'fal_elite_4',
      'fal_hard_1',
      'fal_hard_10',
      'fal_med_4',
      'frem_easy_6',
      'frem_easy_9',
      'frem_elite_1',
      'frem_elite_5',
      'frem_elite_6',
      'frem_med_6',
      'frem_med_8',
      'kan_elite_3',
      'kan_hard_5',
      'kan_med_4',
      'kar_easy_7',
      'kar_hard_3',
      'kar_hard_8',
      'kar_hard_9',
      'kar_med_19',
      'kar_med_8',
      'kar_med_9',
      'kou_hard_7',
      'lum_elite_5',
      'lum_med_10',
      'mor_easy_2',
      'mor_easy_3',
      'mor_easy_8',
      'mor_elite_6',
      'var_elite_5',
      'var_hard_1',
      'var_hard_5',
      'var_med_7',
      'var_med_9',
      'wild_easy_2',
      'wild_elite_6',
      'wild_hard_8',
      'wild_hard_9',
      'wild_med_3',
      'wild_med_7',
    ]);
    expect(byId.get('wild_med_3')).toMatchObject({
      skills: { Slayer: 50 },
      oneOf: [
        { skills: { Agility: 60 } },
        { skills: { Strength: 60 } },
      ],
    });
    expect(byId.get('frem_easy_9')).toMatchObject({
      quests: [],
      oneOf: [
        { quests: ['Troll Stronghold'] },
        { cas: ['Easy'] },
      ],
    });
    expect(byId.get('fal_elite_4')).toMatchObject({
      oneOf: [
        { allQuests: true },
        { label: 'Skillcape', anySkillLevel: 99 },
      ],
    });
    expect(byId.get('kar_hard_9')).toMatchObject({
      skills: { Slayer: 50 },
      oneOf: [
        { combatLevel: 100 },
        { label: 'Slayer cape', skills: { Slayer: 99 } },
      ],
    });
    expect(byId.get('lum_elite_6')).toMatchObject({ allQuests: true });
    const combatGates = snapshot.tasks.flatMap(task => [
      ...(task.combatLevel ? [[task.id, task.combatLevel]] : []),
      ...(task.oneOf ?? []).flatMap(option =>
        option.combatLevel ? [[task.id, option.combatLevel]] : []),
    ]);
    expect(combatGates).toEqual([
      ['kar_hard_9', 100],
      ['lum_med_10', 70],
      ['mor_easy_3', 20],
      ['var_med_9', 40],
      ['west_easy_2', 40],
      ['west_easy_9', 40],
      ['western_med_6', 70],
      ['west_hard_3', 100],
      ['west_elite_5', 40],
    ]);
    expect(snapshot.classification).toMatchObject({
      combatLevelRequirementsStructured: 9,
      allQuestsRequirementsStructured: 2,
    });
    expect(byId.get('kar_med_1')?.skills).toEqual({});
    expect(byId.get('lum_easy_10')?.skills).toEqual({});
  });
  it('preserves the historical teak-log completion id for its semantic match', () => {
    const snapshot = loadSnapshot();
    const task = snapshot.tasks.find(
      candidate => candidate.tierId === 'Western Medium' && candidate.ordinal === 5,
    );

    expect(task).toMatchObject({
      id: 'west_med_5',
      classification: 'preserved-semantic',
    });
    expect(snapshot.retired.map(candidate => candidate.id)).not.toContain('west_med_5');
  });
  it('stores reviewed route-local, outfit, possession, and combined-skill alternatives', () => {
    const snapshot = loadSnapshot();
    const byId = new Map(snapshot.tasks.map(task => [task.id, task]));

    expect(byId.get('kar_med_8')).toMatchObject({
      regions: [],
      oneOf: [
        { label: 'Hardwood Grove', regions: ['Tai Bwo Wannai'] },
        {
          label: 'Kharazi Jungle (machete)', regions: ['Kharazi Jungle'],
          items: ['Machete', "Started Legends' Quest"],
        },
        {
          label: 'Kharazi Jungle (vine shortcut)', regions: ['Kharazi Jungle'],
          items: ["Started Legends' Quest"], skills: { Agility: 79 },
        },
      ],
    });
    expect(byId.get('kar_med_9')).toMatchObject({
      regions: [],
      oneOf: expect.arrayContaining([
        expect.objectContaining({ label: 'Hardwood Grove', regions: ['Tai Bwo Wannai'] }),
        expect.objectContaining({
          label: 'Kharazi Jungle (machete)',
          items: ['Machete', "Started Legends' Quest"],
        }),
        expect.objectContaining({
          label: 'Kharazi Jungle (vine shortcut)',
          items: ["Started Legends' Quest"], skills: { Agility: 79 },
        }),
      ]),
    });
    for (const id of ['kar_med_8', 'kar_med_9']) {
      const kharaziRoutes = byId.get(id).oneOf.filter(
        option => option.label.startsWith('Kharazi Jungle'),
      );
      expect(kharaziRoutes.every(option => option.quests === undefined)).toBe(true);
    }
    expect(byId.get('kar_med_19')).toMatchObject({
      regions: [],
      oneOf: [
        { label: 'Shilo Village', quests: ['Shilo Village'], regions: ['Shilo Village'] },
        expect.objectContaining({ label: 'Tai Bwo Wannai Cleanup', regions: ['Tai Bwo Wannai'] }),
      ],
    });
    expect(byId.get('kan_elite_3')).toMatchObject({
      skills: { Cooking: 80 },
      oneOf: [
        expect.objectContaining({ label: 'Harpoon', skills: { Fishing: 76 } }),
        expect.objectContaining({
          label: 'Bare-handed fishing',
          skills: { Fishing: 96, Strength: 76 },
          items: ['Access to Barbarian Fishing'],
        }),
      ],
    });
    expect(byId.get('wild_med_7')).toMatchObject({
      items: ['Muddy key'],
      oneOf: [
        expect.objectContaining({ label: 'Slashing route', items: ['Knife or slashing weapon'] }),
        { label: 'Stepping Stone shortcut', skills: { Agility: 82 } },
      ],
    });
    expect(byId.get('fal_hard_10')).toMatchObject({
      oneOf: [
        { combinedSkillLevel: { skills: ['Attack', 'Strength'], level: 130 } },
        { anyOfSkillsLevel: { skills: ['Attack', 'Strength'], level: 99 } },
      ],
    });
    expect(byId.get('kar_hard_3')).toMatchObject({
      skills: {}, regions: [],
      oneOf: [
        { label: 'Pre-cooked', items: ['Cooked oomlie wrap'] },
        expect.objectContaining({ label: 'Cook it yourself', skills: { Cooking: 50 } }),
      ],
    });
    expect(byId.get('kar_hard_3').oneOf.find(
      option => option.label === 'Cook it yourself',
    ).regions).toBeUndefined();
    const kandarinBareHanded = byId.get('kan_elite_3').oneOf.find(
      option => option.label === 'Bare-handed fishing',
    );
    expect(kandarinBareHanded.quests).toBeUndefined();
    expect(byId.get('mor_elite_1')).toMatchObject({
      skills: { Fishing: 96, Strength: 76 },
      quests: ['In Aid of the Myreque'],
      items: ['Access to Barbarian Fishing'],
    });
    expect(byId.get('mor_elite_1').quests).not.toContain('Barbarian Training');
    expect(byId.get('var_med_7')).toMatchObject({
      skills: {},
      oneOf: [
        expect.objectContaining({ label: 'Existing Digsite pendant' }),
        expect.objectContaining({ label: 'Mounted Digsite pendant' }),
        expect.objectContaining({ label: 'Craft a Digsite pendant', skills: { Magic: 49 } }),
      ],
    });
    expect(byId.get('frem_med_6')).toMatchObject({
      skills: {},
      oneOf: [
        { label: 'Bare-handed', skills: { Hunter: 45 } },
        expect.objectContaining({ label: 'Butterfly net', skills: { Hunter: 35 } }),
      ],
    });
    expect(byId.get('var_hard_1')).toMatchObject({ skills: { Hunter: 66 } });

    const raimentRoutes = {
      fal_hard_1: [56, 42],
      fal_elite_1: [88, 77, 66, 55],
      lum_elite_5: [76, 57, 38],
      var_elite_5: [78, 52],
    };
    for (const [id, levels] of Object.entries(raimentRoutes)) {
      const task = byId.get(id);
      expect(task?.skills).toEqual({});
      expect(task?.oneOf?.map(option => option.skills?.Runecraft)).toEqual(levels);
    }
    expect(byId.get('kou_hard_7')?.oneOf).toHaveLength(2);
    expect(byId.get('var_hard_5')?.oneOf).toHaveLength(2);
  });

  it('derives combat and all-quests audit counters instead of trusting metadata', () => {
    const combatSnapshot = loadSnapshot();
    combatSnapshot.classification.combatLevelRequirementsStructured -= 1;
    expect(() => validateAudit(combatSnapshot)).toThrow(/combatLevelRequirementsStructured.*derived/i);

    const questSnapshot = loadSnapshot();
    questSnapshot.classification.allQuestsRequirementsStructured -= 1;
    expect(() => validateAudit(questSnapshot)).toThrow(/allQuestsRequirementsStructured.*derived/i);
  });


  it('rejects a fabricated historical id even when classification counts still reconcile', () => {
    const snapshot = loadSnapshot();
    snapshot.tasks[0].id = 'not_a_real_historical_id';

    expect(() => validateAudit(snapshot)).toThrow(/frozen historical.*not_a_real_historical_id/i);
  });

  it('preserves the historical Jad completion id for the current cape task', () => {
    const snapshot = loadSnapshot();
    const task = snapshot.tasks.find(
      candidate => candidate.tierId === 'Karamja Elite' && candidate.ordinal === 2,
    );

    expect(task).toMatchObject({
      id: 'kar_elite_4',
      classification: 'preserved-semantic',
      previousDescription: 'Defeat TzTok-Jad in the Fight Caves.',
    });
    expect(snapshot.retired.map(candidate => candidate.id)).not.toContain('kar_elite_4');
  });
});
