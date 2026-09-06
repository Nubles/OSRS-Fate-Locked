import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

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

const normalizeGeneratedText = (value) => String(value)
  .replace(/\r\n/g, '\n')
  .replace(/\r/g, '\n')

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

const renderRequirementProperties = (requirement) => {
  const properties = [];
  if (requirement.predicates?.length) properties.push('predicates: ' + JSON.stringify(requirement.predicates));
  if (requirement.label) properties.push('label: ' + quote(requirement.label));
  if (requirement.skills && Object.keys(requirement.skills).length > 0) {
    properties.push('skills: ' + renderSkills(requirement.skills));
  }
  if (requirement.items?.length > 0) properties.push('items: ' + renderStringArray(requirement.items));
  if (requirement.quests?.length > 0) {
    properties.push('quests: ' + renderStringArray(requirement.quests));
  }
  if (requirement.cas?.length > 0) properties.push('cas: ' + renderStringArray(requirement.cas));
  if (requirement.regions?.length > 0) {
    properties.push('regions: ' + renderStringArray(requirement.regions));
  }
  if (requirement.anyOfRegions?.length > 0) {
    properties.push('anyOfRegions: ' + renderStringArray(requirement.anyOfRegions));
  }
  if (requirement.questPoints) properties.push('questPoints: ' + requirement.questPoints);
  if (requirement.manualRequirements?.length > 0) {
    properties.push(
      'manualRequirements: ' + renderStringArray(requirement.manualRequirements),
    );
  }
  if (requirement.combatLevel) properties.push('combatLevel: ' + requirement.combatLevel);
  if (requirement.allQuests) properties.push('allQuests: true');
  if (requirement.anySkillLevel) properties.push('anySkillLevel: ' + requirement.anySkillLevel);
  if (requirement.combinedSkillLevel) {
    properties.push('combinedSkillLevel: { skills: '
      + renderStringArray(requirement.combinedSkillLevel.skills)
      + ', level: ' + requirement.combinedSkillLevel.level + ' }');
  }
  if (requirement.anyOfSkillsLevel) {
    properties.push('anyOfSkillsLevel: { skills: '
      + renderStringArray(requirement.anyOfSkillsLevel.skills)
      + ', level: ' + requirement.anyOfSkillsLevel.level + ' }');
  }
  return properties;
};

const renderRequirementOption = option => (
  '{ ' + renderRequirementProperties(option).join(', ') + ' }'
);

const renderTask = (task) => {
  const requirementProperties = renderRequirementProperties(task)
    .filter(property => !property.startsWith('label: '));
  const manualProperties = requirementProperties.filter(property => (
    property.startsWith('combatLevel: ')
    || property === 'allQuests: true'
    || property.startsWith('anySkillLevel: ')
  ));
  const properties = [
    'id: ' + quote(task.id),
    'tierId: ' + quote(task.tierId),
    'description: ' + quote(task.description),
    ...requirementProperties.filter(property => !manualProperties.includes(property)),
  ];
  if (task.oneOf?.length > 0) {
    properties.push('oneOf: [' + task.oneOf.map(renderRequirementOption).join(', ') + ']');
  }
  properties.push(...manualProperties);
  return '  { ' + properties.join(', ') + ' },';
};

const validatePredicateShape = (predicate, context) => {
  const fail = () => { throw new Error('Invalid Diary predicate: ' + context); };
  const text = value => typeof value === 'string' && value.trim().length > 0;
  const positiveInt = (value, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && value > 0 && value <= max;
  if (!predicate || typeof predicate !== 'object' || Array.isArray(predicate)) return fail();
  switch (predicate.kind) {
    case 'unlock': if (['arcana', 'mobility', 'housing', 'guilds', 'farming', 'storage', 'bosses', 'minigames'].includes(predicate.field) && text(predicate.id)) return; break;
    case 'all':
    case 'any':
      if (!Array.isArray(predicate.of) || predicate.of.length === 0) return fail();
      predicate.of.forEach((child, index) => validatePredicateShape(child, context + ' child ' + index));
      return;
    case 'skill': if (text(predicate.skill) && positiveInt(predicate.level, 99)) return; break;
    case 'combinedSkills': if (Array.isArray(predicate.skills) && predicate.skills.length > 0 && predicate.skills.every(text)
      && new Set(predicate.skills).size === predicate.skills.length && positiveInt(predicate.level, predicate.skills.length * 99)) return; break;
    case 'method': if (text(predicate.skill) && positiveInt(predicate.tier, 10)) return; break;
    case 'equipment': if (text(predicate.slot) && positiveInt(predicate.tier, 10)) return; break;
    case 'quest':
    case 'diary':
    case 'area': if (text(predicate.id)) return; break;
    case 'location': if (text(predicate.label)
      && Array.isArray(predicate.areas) && predicate.areas.length && predicate.areas.every(text)
      && Array.isArray(predicate.chunks) && predicate.chunks.length
      && predicate.chunks.every(key => typeof key === 'string' && /^\d+,\d+$/.test(key))) return; break;
    case 'questPoints': if (positiveInt(predicate.count)) return; break;
    case 'item': if (text(predicate.id) && text(predicate.label) && ['hold', 'consume', 'equip'].includes(predicate.usage)) return; break;
    case 'bossKill': if (text(predicate.id) && text(predicate.label) && positiveInt(predicate.count)) return; break;
    case 'slayerTask':
    case 'accountMode': if (text(predicate.id) && text(predicate.label)) return; break;
    case 'manual':
    case 'unknown': if (text(predicate.key) && text(predicate.label)) return; break;
  }
  return fail();
};

const validateRequirementShape = (requirement, context, allowEmpty = true) => {
  if (!requirement || typeof requirement !== 'object' || Array.isArray(requirement)) {
    throw new Error('Invalid Diary requirement route: ' + context);
  }
  if (requirement.predicates !== undefined) {
    if (!Array.isArray(requirement.predicates)) throw new Error('Invalid Diary predicates: ' + context);
    requirement.predicates.forEach((predicate, index) => validatePredicateShape(predicate, context + ' predicate ' + index));
  }
  for (const field of ['items', 'quests', 'cas', 'regions', 'anyOfRegions', 'manualRequirements']) {
    if (requirement[field] !== undefined && !Array.isArray(requirement[field])) {
      throw new Error('Invalid Diary requirement ' + field + ': ' + context);
    }
    if (requirement[field]?.some(value => (
      typeof value !== 'string' || value.trim() === ''
    ))) {
      throw new Error(
        'Invalid Diary requirement ' + field + ' entry (expected a non-empty string): ' + context,
      );
    }
  }
  for (const field of ['combatLevel', 'anySkillLevel', 'questPoints']) {
    if (requirement[field] !== undefined
      && (!Number.isInteger(requirement[field]) || requirement[field] < 1)) {
      throw new Error('Invalid Diary requirement ' + field + ': ' + context);
    }
  }
  if (requirement.allQuests !== undefined && requirement.allQuests !== true) {
    throw new Error('Invalid Diary requirement allQuests: ' + context);
  }
  for (const field of ['combinedSkillLevel', 'anyOfSkillsLevel']) {
    const predicate = requirement[field];
    if (predicate !== undefined && (
      !predicate || typeof predicate !== 'object' || Array.isArray(predicate)
      || !Array.isArray(predicate.skills) || predicate.skills.length < 1
      || predicate.skills.some(skill => typeof skill !== 'string' || !skill)
      || !Number.isInteger(predicate.level) || predicate.level < 1
    )) {
      throw new Error('Invalid Diary requirement ' + field + ': ' + context);
    }
    if (predicate && new Set(predicate.skills).size !== predicate.skills.length) {
      throw new Error('Invalid Diary requirement ' + field + ' duplicate skills: ' + context);
    }
  }
  const hasRequirement = Boolean(
    requirement.predicates?.length
    || requirement.items?.length
    || Object.keys(requirement.skills ?? {}).length
    || requirement.quests?.length
    || requirement.cas?.length
    || requirement.regions?.length
    || requirement.anyOfRegions?.length
    || requirement.questPoints
    || requirement.manualRequirements?.length
    || requirement.combatLevel
    || requirement.allQuests
    || requirement.anySkillLevel
    || requirement.combinedSkillLevel
    || requirement.anyOfSkillsLevel,
  );
  if (!allowEmpty && !hasRequirement) {
    throw new Error('Empty Diary requirement route: ' + context);
  }
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
    validateRequirementShape(task, task.id);
    if (task.regions?.length > 1 && task.description.toLowerCase().includes(task.regions.join(' or ').toLowerCase())) {
      throw new Error('Explicit OR geography must use anyOfRegions: ' + task.id);
    }
    if (task.anyOfRegions !== undefined) {
      if (task.anyOfRegions.length < 2) {
        throw new Error('Diary any-of region list must contain at least two areas: ' + task.id);
      }
      if (new Set(task.anyOfRegions).size !== task.anyOfRegions.length) {
        throw new Error('Diary any-of region list contains duplicates: ' + task.id);
      }
    }
    if (task.oneOf !== undefined) {
      if (!Array.isArray(task.oneOf) || task.oneOf.length < 2) {
        throw new Error('Diary alternative route list must contain at least two options: ' + task.id);
      }
      task.oneOf.forEach((option, index) => {
        if (option.anyOfRegions !== undefined) {
          throw new Error('Diary any-of regions are only supported on tasks: ' + task.id);
        }
        validateRequirementShape(option, task.id + ' option ' + (index + 1), false);
      });
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
    "import type { RequirementPredicate } from '../utils/requirementPredicates';",
    '',
    'export interface DiaryTaskRequirementOption {',
    '  predicates?: RequirementPredicate[];',
    '  label?: string;',
    '  skills?: Record<string, number>;',
    '  items?: string[];',
    '  quests?: string[];',
    '  cas?: string[];',
    '  regions?: string[];',
    '  questPoints?: number;',
    '  manualRequirements?: string[];',
    '  combatLevel?: number;',
    '  allQuests?: true;',
    '  anySkillLevel?: number;',
    '  combinedSkillLevel?: { skills: string[]; level: number };',
    '  anyOfSkillsLevel?: { skills: string[]; level: number };',
    '}',
    '',
    'export interface DiaryTask {',
    '  predicates?: RequirementPredicate[];',
    '  id: string;',
    '  tierId: string;',
    '  description: string;',
    '  skills?: Record<string, number>;',
    '  items?: string[];',
    '  quests?: string[];',
    '  cas?: string[];',
    '  regions?: string[];',
    '  anyOfRegions?: string[];',
    '  questPoints?: number;',
    '  manualRequirements?: string[];',
    '  combatLevel?: number;',
    '  allQuests?: true;',
    '  anySkillLevel?: number;',
    '  combinedSkillLevel?: { skills: string[]; level: number };',
    '  anyOfSkillsLevel?: { skills: string[]; level: number };',
    '  oneOf?: DiaryTaskRequirementOption[];',
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
    "    const canonical = Object.prototype.hasOwnProperty.call(migrations, id)",
    "      ? migrations[id]",
    "      : id;",
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

export function checkGeneratedDiary(
  snapshot,
  diaryOutput,
  migrationOutput = renderTaskIdMigrations(snapshot),
) {
  const errors = [];
  if (normalizeGeneratedText(diaryOutput) !== renderDiaryTasks(snapshot)) {
    errors.push('data/diaryTasks.ts is out of date');
  }
  if (normalizeGeneratedText(migrationOutput) !== renderTaskIdMigrations(snapshot)) {
    errors.push('utils/taskIdMigrations.ts is out of date');
  }
  return { ok: errors.length === 0, errors };
}

export function checkGeneratedDiaryFiles({ snapshotPath, diaryPath, migrationPath }) {
  const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8').replace(/^\uFEFF/, ''));
  const diaryOutput = readFileSync(diaryPath, 'utf8');
  const migrationOutput = readFileSync(migrationPath, 'utf8');
  return checkGeneratedDiary(snapshot, diaryOutput, migrationOutput);
}

const unwrapTsExpression = (expression) => {
  let node = expression;
  while (
    ts.isAsExpression(node)
    || ts.isTypeAssertionExpression(node)
    || ts.isSatisfiesExpression(node)
    || ts.isParenthesizedExpression(node)
  ) {
    node = node.expression;
  }
  return node;
};

const initializerOf = (sourceFile, declarationName) => {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name)
        && declaration.name.text === declarationName
        && declaration.initializer
      ) {
        return unwrapTsExpression(declaration.initializer);
      }
    }
  }
  throw new Error('Could not read project reference declaration: ' + declarationName);
};

const propertyNameOf = (property) => {
  const name = property.name;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  throw new Error('Unsupported computed project reference key');
};

const stringLiteralOf = (expression) => {
  const node = unwrapTsExpression(expression);
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  throw new Error('Project reference contains a non-literal string');
};

const stringArrayOf = (expression) => {
  const node = unwrapTsExpression(expression);
  if (!ts.isArrayLiteralExpression(node)) {
    throw new Error('Project reference contains a non-literal string array');
  }
  return node.elements.map(stringLiteralOf);
};

const referenceCatalogCache = new Map();

const loadReferenceCatalog = (projectRoot) => {
  const cached = referenceCatalogCache.get(projectRoot);
  if (cached) return cached;

  const parseProjectFile = (relativePath) => {
    const absolutePath = resolve(projectRoot, relativePath);
    return ts.createSourceFile(
      absolutePath,
      readFileSync(absolutePath, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
  };
  const itemsSource = parseProjectFile('data/items.ts');
  const questSource = parseProjectFile('data/questData.ts');
  const diarySource = parseProjectFile('data/diaryData.ts');
  const areaMapPolicySource = parseProjectFile('data/areaMapPolicy.ts');

  const skills = new Set(stringArrayOf(initializerOf(itemsSource, 'SKILLS_LIST')));
  const areaCatalog = JSON.parse(readFileSync(resolve(projectRoot, 'data/areaCatalog.json'), 'utf8'));
  const regions = new Set(areaCatalog.map(area => area.name));
  const areaAliases = initializerOf(areaMapPolicySource, 'AREA_ALIAS_POLICIES');
  if (!ts.isObjectLiteralExpression(areaAliases)) {
    throw new Error('AREA_ALIAS_POLICIES must remain an object literal');
  }
  for (const property of areaAliases.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    regions.add(propertyNameOf(property));
  }


  const quests = new Set();
  const questData = initializerOf(questSource, 'QUEST_DATA');
  if (!ts.isObjectLiteralExpression(questData)) {
    throw new Error('QUEST_DATA must remain an object literal');
  }
  for (const property of questData.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    quests.add(propertyNameOf(property));
    const quest = unwrapTsExpression(property.initializer);
    if (!ts.isObjectLiteralExpression(quest)) continue;
    const nameProperty = quest.properties.find(candidate => (
      ts.isPropertyAssignment(candidate) && propertyNameOf(candidate) === 'name'
    ));
    if (nameProperty) quests.add(stringLiteralOf(nameProperty.initializer));
  }

  const serviceCatalog = JSON.parse(readFileSync(resolve(projectRoot, 'data/serviceCatalog.json'), 'utf8'));
  const catalog = {
    unlocks: Object.fromEntries(Object.entries({ arcana: 'ARCANA_LIST', mobility: 'MOBILITY_LIST', housing: 'POH_LIST', guilds: 'GUILDS_LIST', farming: 'FARMING_PATCH_LIST', storage: 'STORAGE_LIST', bosses: 'BOSSES_LIST', minigames: 'MINIGAMES_LIST' }).map(([field, name]) => [field, new Set(field === 'mobility' ? serviceCatalog.filter(row => row.category === 'mobility').map(row => row.name) : stringArrayOf(initializerOf(itemsSource, name)))])),
    diaries: new Set(initializerOf(diarySource, 'DIARY_DATA').properties.filter(ts.isPropertyAssignment).map(propertyNameOf)),
    skills,
    equipment: new Set(stringArrayOf(initializerOf(itemsSource, 'EQUIPMENT_SLOTS'))),
    quests,
    regions,
    cas: new Set(['Easy', 'Medium', 'Hard', 'Elite', 'Master', 'Grandmaster']),
  };
  referenceCatalogCache.set(projectRoot, catalog);
  return catalog;
};

const findUnknownReferences = (snapshot, projectRoot) => {
  const catalog = loadReferenceCatalog(projectRoot);
  const unknown = [];
  const checkPredicateReferences = (predicate, taskId) => {
    if (predicate.kind === 'unlock') {
      if (!catalog.unlocks[predicate.field]?.has(predicate.id)) unknown.push(taskId + ' predicate unlock ' + predicate.field + ' ' + predicate.id);
      return;
    }
    if (predicate.kind === 'combinedSkills') {
      predicate.skills.forEach(skill => { if (!catalog.skills.has(skill)) unknown.push(taskId + ' predicate skills ' + skill); });
      return;
    }
    if (predicate.kind === 'all' || predicate.kind === 'any') {
      predicate.of.forEach(child => checkPredicateReferences(child, taskId));
      return;
    }
    const reference = predicate.kind === 'skill' || predicate.kind === 'method' ? ['skills', predicate.skill]
      : predicate.kind === 'equipment' ? ['equipment', predicate.slot]
        : predicate.kind === 'quest' ? ['quests', predicate.id]
          : predicate.kind === 'diary' ? ['diaries', predicate.id]
          : predicate.kind === 'area' ? ['regions', predicate.id] : null;
    if (reference && !catalog[reference[0]].has(reference[1])) unknown.push(taskId + ' predicate ' + reference.join(' '));
  };
  for (const task of snapshot.tasks) {
    for (const requirement of [task, ...(task.oneOf ?? [])]) {
      (requirement.predicates ?? []).forEach(predicate => checkPredicateReferences(predicate, task.id));
      const referencedSkills = [
        ...Object.keys(requirement.skills ?? {}),
        ...(requirement.combinedSkillLevel?.skills ?? []),
        ...(requirement.anyOfSkillsLevel?.skills ?? []),
      ];
      for (const skill of referencedSkills) {
        if (!catalog.skills.has(skill)) unknown.push(task.id + ' skill ' + skill);
      }
      for (const quest of requirement.quests ?? []) {
        if (!catalog.quests.has(quest)) unknown.push(task.id + ' quest ' + quest);
      }
      for (const ca of requirement.cas ?? []) {
        if (!catalog.cas.has(ca)) unknown.push(task.id + ' CA ' + ca);
      }
      for (const region of requirement.regions ?? []) {
        if (!catalog.regions.has(region)) unknown.push(task.id + ' region ' + region);
      }
      for (const region of requirement.anyOfRegions ?? []) {
        if (!catalog.regions.has(region)) unknown.push(task.id + ' any-of region ' + region);
      }
    }
  }
  return unknown;
};

export const validateAudit = (
  snapshot,
  projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..'),
) => {
  const audit = snapshot.classification;
  if (!audit) throw new Error('Diary snapshot classification report is missing');
  if (snapshot.tasks.length !== 492) {
    throw new Error('Diary snapshot audit failed: official rows');
  }

  const currentIds = new Set(snapshot.tasks.map(task => task.id));
  const historicalIds = new Set();
  const derived = {
    preservedIds: 0,
    renamedOrReplacedAliases: 0,
    retiredExistingIds: 0,
    newCanonicalIds: 0,
    combatLevelRequirementsStructured: 0,
    allQuestsRequirementsStructured: 0,
  };
  const addHistoricalId = (id, source) => {
    if (historicalIds.has(id)) {
      throw new Error('Duplicate historical Diary id classification: ' + id + ' (' + source + ')');
    }
    historicalIds.add(id);
  };

  for (const task of snapshot.tasks) {
    const aliases = task.aliases ?? [];
    if (task.classification === 'preserved-exact'
      || task.classification === 'preserved-semantic') {
      if (aliases.length > 0) {
        throw new Error('Preserved Diary task must not declare aliases: ' + task.id);
      }
      derived.preservedIds += 1;
      addHistoricalId(task.id, 'preserved');
    } else if (task.classification === 'renamed-or-replaced') {
      if (aliases.length !== 1) {
        throw new Error('Renamed/replaced Diary task must declare exactly one historical alias: ' + task.id);
      }
      derived.renamedOrReplacedAliases += 1;
      if (currentIds.has(aliases[0])) {
        throw new Error('Diary alias/current id collision: ' + aliases[0]);
      }
      addHistoricalId(aliases[0], 'alias');
    } else if (task.classification === 'new-canonical') {
      if (aliases.length > 0) {
        throw new Error('New Diary task must not declare historical aliases: ' + task.id);
      }
      derived.newCanonicalIds += 1;
    } else {
      throw new Error(
        'Unknown Diary task classification: ' + task.id + ' -> ' + task.classification,
      );
    }
  }

  const structuredRequirements = snapshot.tasks.flatMap(task => [task, ...(task.oneOf ?? [])]);
  derived.combatLevelRequirementsStructured = structuredRequirements
    .filter(requirement => requirement.combatLevel !== undefined).length;
  derived.allQuestsRequirementsStructured = structuredRequirements
    .filter(requirement => requirement.allQuests).length;
  for (const retired of snapshot.retired) {
    if (!retired.id || retired.classification !== 'retired') {
      throw new Error('Diary retired classification is incomplete');
    }
    if (currentIds.has(retired.id)) {
      throw new Error('Diary retired/current id collision: ' + retired.id);
    }
    derived.retiredExistingIds += 1;
    addHistoricalId(retired.id, 'retired');
  }

  if (historicalIds.size !== 485) {
    throw new Error(
      'Diary historical classification mismatch: expected 485, derived ' + historicalIds.size,
    );
  }

  const legacyFixturePath = resolve(
    projectRoot,
    'data/sources/achievement-diary-legacy-ids.json',
  );
  const legacyFixture = JSON.parse(
    readFileSync(legacyFixturePath, 'utf8').replace(/^\uFEFF/, ''),
  );
  if (!Array.isArray(legacyFixture.ids)
    || legacyFixture.ids.length !== 485
    || new Set(legacyFixture.ids).size !== 485) {
    throw new Error('Frozen historical Diary ID fixture must contain 485 unique ids');
  }
  const frozenHistoricalIds = new Set(legacyFixture.ids);
  const unexpectedHistoricalIds = [...historicalIds]
    .filter(id => !frozenHistoricalIds.has(id))
    .sort();
  const missingHistoricalIds = legacyFixture.ids
    .filter(id => !historicalIds.has(id))
    .sort();
  if (unexpectedHistoricalIds.length > 0 || missingHistoricalIds.length > 0) {
    throw new Error(
      'Frozen historical Diary ID set mismatch: unexpected '
      + (unexpectedHistoricalIds.join(', ') || 'none')
      + '; missing ' + (missingHistoricalIds.join(', ') || 'none'),
    );
  }
  const derivedCurrentRows = (
    derived.preservedIds
    + derived.renamedOrReplacedAliases
    + derived.newCanonicalIds
  );
  if (derivedCurrentRows !== snapshot.tasks.length) {
    throw new Error(
      'Diary current classification mismatch: expected '
      + snapshot.tasks.length + ', derived ' + derivedCurrentRows,
    );
  }

  const unknownReferences = findUnknownReferences(snapshot, projectRoot);
  if (unknownReferences.length > 0) {
    throw new Error('Unknown Diary references: ' + unknownReferences.join(', '));
  }

  const reportedComparisons = [
    ['existingRows', audit.existingRows, historicalIds.size],
    ['preservedIds', audit.preservedIds, derived.preservedIds],
    [
      'renamedOrReplacedAliases',
      audit.renamedOrReplacedAliases,
      derived.renamedOrReplacedAliases,
    ],
    ['retiredExistingIds', audit.retiredExistingIds, derived.retiredExistingIds],
    ['newCanonicalIds', audit.newCanonicalIds, derived.newCanonicalIds],
    ['unknownReferences', audit.unknownReferences, unknownReferences.length],
    ['combatLevelRequirementsStructured', audit.combatLevelRequirementsStructured, derived.combatLevelRequirementsStructured],
    ['allQuestsRequirementsStructured', audit.allQuestsRequirementsStructured, derived.allQuestsRequirementsStructured],
  ];
  const mismatches = reportedComparisons
    .filter(([, reported, actual]) => reported !== actual)
    .map(([label, reported, actual]) => (
      label + ' reported=' + reported + ' derived=' + actual
    ));
  if (mismatches.length > 0) {
    throw new Error('Diary classification counter mismatch: ' + mismatches.join(', '));
  }
  if (audit.unresolvedExistingRows !== 0 || audit.unresolvedDuplicateIds !== 0) {
    throw new Error('Diary snapshot audit has unresolved rows or duplicate ids');
  }

  return { ...audit, ...derived, existingRows: historicalIds.size, unknownReferences: 0 };
};

export function runDiaryCommand({
  args = process.argv.slice(2),
  paths,
  log = message => console.log(message),
  error = message => console.error(message),
} = {}) {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const defaultRoot = resolve(scriptDir, '..');
  const projectRoot = paths?.projectRoot ?? defaultRoot;
  const snapshotPath = paths?.snapshotPath
    ?? resolve(projectRoot, 'data/sources/achievement-diary-tasks.json');
  const diaryPath = paths?.diaryPath ?? resolve(projectRoot, 'data/diaryTasks.ts');
  const migrationPath = paths?.migrationPath
    ?? resolve(projectRoot, 'utils/taskIdMigrations.ts');
  const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8').replace(/^\uFEFF/, ''));
  validateSnapshot(snapshot);
  const audit = validateAudit(snapshot, projectRoot);

  log('official rows: ' + snapshot.tasks.length);
  log('existing rows classified: ' + audit.existingRows);
  log('unresolved existing rows: ' + audit.unresolvedExistingRows);
  log('unresolved duplicate ids: ' + audit.unresolvedDuplicateIds);
  log('unknown tiers/skills/quests/regions: ' + audit.unknownReferences);
  log('preserved exact/semantic ids: ' + audit.preservedIds);
  log('renamed/replaced aliases: ' + audit.renamedOrReplacedAliases);
  log('retired existing ids: ' + audit.retiredExistingIds);
  log('new canonical ids: ' + audit.newCanonicalIds);

  if (args.includes('--check')) {
    const result = checkGeneratedDiaryFiles({ snapshotPath, diaryPath, migrationPath });
    if (result.ok) {
      log('[diary:verify] generated files are current.');
      return 0;
    }
    for (const mismatch of result.errors) {
      error('[diary:verify] ' + mismatch);
    }
    return 1;
  }

  writeFileSync(diaryPath, renderDiaryTasks(snapshot), 'utf8');
  writeFileSync(migrationPath, renderTaskIdMigrations(snapshot), 'utf8');
  return 0;
}

export function runDiaryMain({
  setExitCode = code => { process.exitCode = code; },
  ...commandOptions
} = {}) {
  const status = runDiaryCommand(commandOptions);
  setExitCode(status);
  return status;
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) runDiaryMain();
