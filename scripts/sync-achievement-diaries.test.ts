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
} from './sync-achievement-diaries.mjs';

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
    const first = renderDiaryTasks(SIX_TASK_SNAPSHOT);
    const second = renderDiaryTasks(structuredClone(SIX_TASK_SNAPSHOT));

    expect(second).toBe(first);
    expect(first).toContain('// Generated from data/sources/achievement-diary-tasks.json.');
    expect(first.indexOf("id: 'fal_easy_1'")).toBeLessThan(first.indexOf("id: 'fal_med_1'"));
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
