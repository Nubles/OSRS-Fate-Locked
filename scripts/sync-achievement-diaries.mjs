import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DIARY_TIER_ORDER = [
  'Ardougne Easy', 'Ardougne Medium', 'Ardougne Hard', 'Ardougne Elite',
  'Desert Easy', 'Desert Medium', 'Desert Hard', 'Desert Elite',
  'Falador Easy', 'Falador Medium', 'Falador Hard', 'Falador Elite',
  'Fremennik Easy', 'Fremennik Medium', 'Fremennik Hard', 'Fremennik Elite',
  'Kandarin Easy', 'Kandarin Medium', 'Kandarin Hard', 'Kandarin Elite',
  'Karamja Easy', 'Karamja Medium', 'Karamja Hard', 'Karamja Elite',
  'Kourend Easy', 'Kourend Medium', 'Kourend Hard', 'Kourend Elite',
  'Lumbridge Easy', 'Lumbridge Medium', 'Lumbridge Hard', 'Lumbridge Elite',
  'Morytania Easy', 'Morytania Medium', 'Morytania Hard', 'Morytania Elite',
  'Varrock Easy', 'Varrock Medium', 'Varrock Hard', 'Varrock Elite',
  'Western Easy', 'Western Medium', 'Western Hard', 'Western Elite',
  'Wilderness Easy', 'Wilderness Medium', 'Wilderness Hard', 'Wilderness Elite',
];

const VALID_TIER = new Set(DIARY_TIER_ORDER);
const AREA_NAMES = {
  Ardougne: 'Ardougne',
  Desert: 'Desert',
  Falador: 'Falador',
  Fremennik: 'Fremennik',
  Kandarin: 'Kandarin',
  Karamja: 'Karamja',
  'Kourend & Kebos': 'Kourend',
  Kourend: 'Kourend',
  'Lumbridge & Draynor': 'Lumbridge',
  Lumbridge: 'Lumbridge',
  Morytania: 'Morytania',
  Varrock: 'Varrock',
  'Western Provinces': 'Western',
  Western: 'Western',
  Wilderness: 'Wilderness',
};

const decodeHtml = (value) => value
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)))
  .replace(/&(amp|lt|gt|quot|apos|nbsp|ndash|mdash);/gi, (_, name) => ({
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    ndash: '–',
    mdash: '—',
  }[name.toLowerCase()]));

const textContent = (html) => decodeHtml(
  html
    .replace(/<(script|style|sup)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
).replace(/\s+/g, ' ').trim();

const elementsOf = (html, tag) => {
  const elements = [];
  const tags = new RegExp('<\\/?' + tag + '\\b[^>]*>', 'gi');
  let depth = 0;
  let start = -1;
  for (const match of html.matchAll(tags)) {
    if (match[0].startsWith('</')) {
      if (depth === 0) continue;
      depth -= 1;
      if (depth === 0) elements.push(html.slice(start, match.index + match[0].length));
    } else {
      if (depth === 0) start = match.index;
      depth += 1;
    }
  }
  return elements;
};

const cellsOf = (row, tag) => elementsOf(row, tag).map(cell => cell
  .replace(new RegExp('^<' + tag + '\\b[^>]*>', 'i'), '')
  .replace(new RegExp('</' + tag + '>$', 'i'), ''));
const normalizeArea = (area) => AREA_NAMES[area] ?? null;
const normalizeTaskKey = (value) => value
  .normalize('NFKD')
  .toLowerCase()
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const skillsOf = (row) => {
  const skills = {};
  for (const span of row.matchAll(/<span\b([^>]*\bdata-skill="[^"]+"[^>]*)>/gi)) {
    const skill = span[1].match(/\bdata-skill="([^"]+)"/i)?.[1];
    const rawLevel = span[1].match(/\bdata-level="([^"]+)"/i)?.[1];
    const level = Number.parseInt(rawLevel?.match(/\d+/)?.[0] ?? '', 10);
    if (skill && Number.isFinite(level)) {
      skills[decodeHtml(skill)] = Math.max(skills[decodeHtml(skill)] ?? 0, level);
    }
  }
  return skills;
};

const questsOf = (cell) => {
  if (!cell || /^(?:\s|<[^>]+>)*(?:none|various)?(?:\s|<[^>]+>)*$/i.test(cell)) return [];
  const links = [...cell.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)]
    .map(match => textContent(match[1]))
    .filter(Boolean);
  return [...new Set(links)];
};

const headerIndex = (headers, expected) => headers.findIndex(header => expected.includes(header));

export function parseAchievementDiaryHtml(html) {
  if (typeof html !== 'string' || html.trim() === '') {
    throw new Error('Achievement Diary source HTML is empty');
  }

  const aggregated = new Map();
  let firstSeen = 0;
  const tables = elementsOf(html, 'table');

  for (const table of tables) {
    const rows = elementsOf(table, 'tr');
    const headerRowIndex = rows.findIndex(row => /<th\b/i.test(row));
    if (headerRowIndex < 0) continue;

    const headers = cellsOf(rows[headerRowIndex], 'th').map(cell => textContent(cell).toLowerCase());
    const diaryIndex = headerIndex(headers, ['diary']);
    const tierIndex = headerIndex(headers, ['difficulty']);
    const taskIndex = headerIndex(headers, ['task']);
    const questIndex = headerIndex(headers, ['quests needed', 'quest requirement']);
    if (diaryIndex < 0 || tierIndex < 0 || taskIndex < 0) continue;

    for (const row of rows.slice(headerRowIndex + 1)) {
      const cells = cellsOf(row, 'td');
      if (cells.length <= Math.max(diaryIndex, tierIndex, taskIndex)) continue;

      const sourceArea = textContent(cells[diaryIndex]);
      const area = normalizeArea(sourceArea);
      const tier = textContent(cells[tierIndex]);
      const description = textContent(cells[taskIndex]);
      if (!area || !['Easy', 'Medium', 'Hard', 'Elite'].includes(tier)) continue;
      if (!description || /^multiple\b/i.test(description)) continue;

      const tierId = area + ' ' + tier;
      const key = tierId + '|' + normalizeTaskKey(description);
      const skills = skillsOf(row);
      const quests = questIndex >= 0 ? questsOf(cells[questIndex]) : [];
      const existing = aggregated.get(key);
      if (existing) {
        for (const [skill, level] of Object.entries(skills)) {
          existing.skills[skill] = Math.max(existing.skills[skill] ?? 0, level);
        }
        existing.quests = [...new Set([...existing.quests, ...quests])];
      } else {
        aggregated.set(key, {
          area,
          tier,
          tierId,
          description,
          skills,
          quests,
          sourceOrder: firstSeen++,
        });
      }
    }
  }

  const tasks = [...aggregated.values()].sort((a, b) => a.sourceOrder - b.sourceOrder);
  if (tasks.length === 0) {
    throw new Error('Achievement Diary source HTML contains no task rows');
  }
  return tasks;
}

const quote = (value) => "'" + String(value)
  .replace(/\\/g, '\\\\')
  .replace(/'/g, "\\'") + "'";

const renderStringArray = (values) => '[' + values.map(quote).join(', ') + ']';

const renderSkills = (skills) => '{ ' + Object.entries(skills)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([skill, level]) => quote(skill) + ': ' + level)
  .join(', ') + ' }';

const renderTask = (task) => {
  const properties = [
    'id: ' + quote(task.id),
    'tierId: ' + quote(task.tierId),
    'description: ' + quote(task.description),
  ];
  if (task.skills && Object.keys(task.skills).length > 0) {
    properties.push('skills: ' + renderSkills(task.skills));
  }
  if (task.quests?.length > 0) properties.push('quests: ' + renderStringArray(task.quests));
  if (task.regions?.length > 0) properties.push('regions: ' + renderStringArray(task.regions));
  return '  { ' + properties.join(', ') + ' },';
};

export function validateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') throw new Error('Diary snapshot is missing');
  if (!snapshot.source || !snapshot.verifiedAt) throw new Error('Diary snapshot source metadata is missing');
  if (!Array.isArray(snapshot.tasks) || snapshot.tasks.length === 0) {
    throw new Error('Diary snapshot tasks are empty');
  }
  if (!Array.isArray(snapshot.retired)) throw new Error('Diary snapshot retired list is missing');
  if (Number.isInteger(snapshot.source.officialRows)
    && snapshot.source.officialRows !== snapshot.tasks.length) {
    throw new Error(
      'Diary snapshot row count mismatch: metadata='
      + snapshot.source.officialRows + ', tasks=' + snapshot.tasks.length,
    );
  }

  const ids = new Set();
  const ordinals = new Set();
  const aliases = new Map();
  for (const task of snapshot.tasks) {
    if (!task.id || !task.description || !task.tierId) {
      throw new Error('Diary snapshot contains an incomplete task');
    }
    if (ids.has(task.id)) throw new Error('Duplicate Diary task id: ' + task.id);
    ids.add(task.id);
    if (!VALID_TIER.has(task.tierId)) throw new Error('Unknown Diary tier: ' + task.tierId);
    if (!Number.isInteger(task.ordinal) || task.ordinal < 1) {
      throw new Error('Invalid Diary task ordinal: ' + task.id);
    }
    const ordinalKey = task.tierId + '|' + task.ordinal;
    if (ordinals.has(ordinalKey)) throw new Error('Duplicate Diary task ordinal: ' + ordinalKey);
    ordinals.add(ordinalKey);
    for (const alias of task.aliases ?? []) {
      if (aliases.has(alias)) throw new Error('Duplicate Diary task alias: ' + alias);
      aliases.set(alias, task.id);
    }
  }
  for (const [alias, target] of aliases) {
    if (!ids.has(target)) throw new Error('Diary alias target is not current: ' + alias + ' -> ' + target);
  }
  return snapshot;
}

export function renderDiaryTasks(snapshot) {
  validateSnapshot(snapshot);
  const tierIndex = new Map(DIARY_TIER_ORDER.map((tierId, index) => [tierId, index]));
  const tasks = [...snapshot.tasks].sort((left, right) => (
    tierIndex.get(left.tierId) - tierIndex.get(right.tierId)
    || left.ordinal - right.ordinal
    || left.id.localeCompare(right.id)
  ));
  const lines = [
    'export interface DiaryTask {',
    '  id: string;',
    '  tierId: string;',
    '  description: string;',
    '  skills?: Record<string, number>;',
    '  quests?: string[];',
    '  regions?: string[];',
    '}',
    '',
    '// Generated from data/sources/achievement-diary-tasks.json.',
    '// Run npm run diary:sync; do not hand-edit this file.',
    'export const ALL_DIARY_TASKS: DiaryTask[] = [',
  ];
  for (const task of tasks) lines.push(renderTask(task));
  lines.push('];', '');
  return lines.join('\n');
}

export function renderTaskIdMigrations(snapshot) {
  validateSnapshot(snapshot);
  const pairs = snapshot.tasks.flatMap(task => (
    (task.aliases ?? []).map(alias => [alias, task.id])
  )).sort(([left], [right]) => left.localeCompare(right));
  const lines = [
    '// Generated from data/sources/achievement-diary-tasks.json.',
    '// Run npm run diary:sync; do not hand-edit this map.',
    'export const DIARY_TASK_ID_MIGRATIONS: Readonly<Record<string, string>> = {',
    ...pairs.map(([alias, id]) => '  ' + quote(alias) + ': ' + quote(id) + ','),
    '};',
    '',
    'export const migrateCompletedTaskIds = (',
    '  ids: readonly string[],',
    '  migrations: Readonly<Record<string, string>> = DIARY_TASK_ID_MIGRATIONS,',
    '): string[] => {',
    '  const out: string[] = [];',
    '  const seen = new Set<string>();',
    '  for (const id of ids) {',
    '    const canonical = migrations[id] ?? id;',
    '    if (!seen.has(canonical)) {',
    '      seen.add(canonical);',
    '      out.push(canonical);',
    '    }',
    '  }',
    '  return out;',
    '};',
    '',
  ];
  return lines.join('\n');
}

const validateAudit = (snapshot) => {
  const audit = snapshot.classification;
  if (!audit) throw new Error('Diary snapshot classification report is missing');
  const blockers = [
    ['official rows', snapshot.tasks.length === 492],
    ['existing rows classified', audit.existingRows === 485],
    ['unresolved existing rows', audit.unresolvedExistingRows === 0],
    ['unresolved duplicate ids', audit.unresolvedDuplicateIds === 0],
    ['unknown tiers/skills/quests/regions', audit.unknownReferences === 0],
  ].filter(([, ok]) => !ok).map(([label]) => label);
  if (blockers.length > 0) {
    throw new Error('Diary snapshot audit failed: ' + blockers.join(', '));
  }
  if (audit.existingRows !== (
    audit.preservedIds + audit.renamedOrReplacedAliases + audit.retiredExistingIds
  )) {
    throw new Error('Diary existing-row classification counts do not sum to 485');
  }
  if (snapshot.tasks.length !== (
    audit.preservedIds + audit.renamedOrReplacedAliases + audit.newCanonicalIds
  )) {
    throw new Error('Diary current-row classification counts do not sum to 492');
  }
  return audit;
};

const run = () => {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const root = resolve(scriptDir, '..');
  const snapshotPath = resolve(root, 'data/sources/achievement-diary-tasks.json');
  const outputPath = resolve(root, 'data/diaryTasks.ts');
  const migrationPath = resolve(root, 'utils/taskIdMigrations.ts');
  const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8').replace(/^\uFEFF/, ''));
  validateSnapshot(snapshot);
  const audit = validateAudit(snapshot);

  console.log('official rows: ' + snapshot.tasks.length);
  console.log('existing rows classified: ' + audit.existingRows);
  console.log('unresolved existing rows: ' + audit.unresolvedExistingRows);
  console.log('unresolved duplicate ids: ' + audit.unresolvedDuplicateIds);
  console.log('unknown tiers/skills/quests/regions: ' + audit.unknownReferences);
  console.log('preserved exact/semantic ids: ' + audit.preservedIds);
  console.log('renamed/replaced aliases: ' + audit.renamedOrReplacedAliases);
  console.log('retired existing ids: ' + audit.retiredExistingIds);
  console.log('new canonical ids: ' + audit.newCanonicalIds);

  writeFileSync(outputPath, renderDiaryTasks(snapshot), 'utf8');
  writeFileSync(migrationPath, renderTaskIdMigrations(snapshot), 'utf8');
};

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) run();
