import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  parseAchievementDiaryHtml,
  renderDiaryTasks,
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
});
