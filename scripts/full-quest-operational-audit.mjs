import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'audit-output');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const generatedAt = new Date().toISOString();
const repositorySha = process.env.GITHUB_SHA || 'local';
const CHUNK_PICKER_URL = 'https://raw.githubusercontent.com/source-chunk/chunk-picker-v2/refs/heads/gh-pages/tasksMap.json';
const QUEST_HELPER_URL = 'https://github.com/Zoinkwiz/quest-helper.git';
const SKILLS = new Set([
  'Attack', 'Strength', 'Defence', 'Ranged', 'Prayer', 'Magic', 'Runecraft',
  'Hitpoints', 'Crafting', 'Mining', 'Smithing', 'Fishing', 'Cooking',
  'Firemaking', 'Woodcutting', 'Agility', 'Herblore', 'Thieving', 'Fletching',
  'Slayer', 'Farming', 'Construction', 'Hunter', 'Sailing',
]);
const ALWAYS_AVAILABLE_SKILLS = new Set(['Hitpoints']);
const GENERIC_XP = new Set(['Any', 'Any skill', 'Random', 'Choice', 'Combat', 'Lowest']);

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const text = Array.isArray(value)
    ? value.join('; ')
    : typeof value === 'object'
      ? JSON.stringify(value)
      : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
function writeCsv(name, rows, columns) {
  const output = [columns.join(',')];
  for (const row of rows) output.push(columns.map((column) => csvEscape(row[column])).join(','));
  fs.writeFileSync(path.join(OUT, name), `${output.join('\n')}\n`);
}
function unique(values) { return [...new Set(values.filter(Boolean))]; }
function mergeMaximum(target, source) {
  for (const [key, raw] of Object.entries(source || {})) {
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    target[key] = Math.max(target[key] || 0, value);
  }
  return target;
}
function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/recipe for disaster/g, 'rfd')
    .replace(/another cook'?s quest/g, 'the cook')
    .replace(/freeing the mountain dwarf/g, 'dwarf')
    .replace(/freeing the goblin generals/g, 'goblins')
    .replace(/freeing pirate pete/g, 'pirate pete')
    .replace(/freeing the lumbridge guide/g, 'lumbridge guide')
    .replace(/freeing evil dave/g, 'evil dave')
    .replace(/freeing skrach uglogwee/g, 'skrach uglogwee')
    .replace(/freeing sir amik varze/g, 'sir amik varze')
    .replace(/freeing king awowogei/g, 'king awowogei')
    .replace(/defeating the culinaromancer/g, 'finale')
    .replace(/fairy ?tale/g, 'fairytale')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(the|a|an|quest|miniquest|freeing)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function similarity(left, right) {
  const a = new Set(normalizeName(left).split(' ').filter(Boolean));
  const b = new Set(normalizeName(right).split(' ').filter(Boolean));
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection++;
  return intersection / new Set([...a, ...b]).size;
}
function firstStringLiteral(text) {
  const match = String(text).match(/"((?:\\.|[^"\\])*)"/s) || String(text).match(/'((?:\\.|[^'\\])*)'/s);
  return match ? match[1].replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\n/g, ' ') : '';
}
function lineAt(text, index) { return text.slice(0, index).split('\n').length; }

function loadQuestData() {
  const file = path.join(ROOT, 'data', 'questData.ts');
  const source = fs.readFileSync(file, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: file,
  }).outputText;
  const module = { exports: {} };
  const dropSource = new Proxy({}, { get: (_target, property) => String(property) });
  const context = {
    module,
    exports: module.exports,
    require: (specifier) => {
      if (specifier === '../types') return { DropSource: dropSource };
      throw new Error(`Unexpected questData import: ${specifier}`);
    },
    console,
  };
  vm.runInNewContext(compiled, context, { filename: file });
  return module.exports.QUEST_DATA;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'OSRS-Fate-Locked-full-quest-audit/1.0',
      Accept: 'application/json,text/plain,*/*',
    },
  });
  if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`);
  return response.text();
}

const RFD_ALIASES = {
  'RFD: The Cook': "Recipe for Disaster/Another Cook's Quest",
  'RFD: Dwarf': 'Recipe for Disaster/Freeing the Mountain Dwarf',
  'RFD: Goblins': 'Recipe for Disaster/Freeing the Goblin generals',
  'RFD: Pirate Pete': 'Recipe for Disaster/Freeing Pirate Pete',
  'RFD: Lumbridge Guide': 'Recipe for Disaster/Freeing the Lumbridge Guide',
  'RFD: Evil Dave': 'Recipe for Disaster/Freeing Evil Dave',
  'RFD: Skrach Uglogwee': 'Recipe for Disaster/Freeing Skrach Uglogwee',
  'RFD: Sir Amik Varze': 'Recipe for Disaster/Freeing Sir Amik Varze',
  'RFD: King Awowogei': 'Recipe for Disaster/Freeing King Awowogei',
  'RFD: Finale': 'Recipe for Disaster/Defeating the Culinaromancer',
};
function resolveSourceQuest(appId, sourceIds) {
  if (sourceIds.has(appId)) return { sourceId: appId, method: 'exact', score: 1 };
  if (RFD_ALIASES[appId] && sourceIds.has(RFD_ALIASES[appId])) {
    return { sourceId: RFD_ALIASES[appId], method: 'explicit-alias', score: 1 };
  }
  const normalized = [...sourceIds].filter((value) => normalizeName(value) === normalizeName(appId));
  if (normalized.length === 1) return { sourceId: normalized[0], method: 'normalized', score: 1 };
  const ranked = [...sourceIds]
    .map((sourceId) => ({ sourceId, score: similarity(appId, sourceId) }))
    .filter((entry) => entry.score >= 0.72)
    .sort((a, b) => b.score - a.score || a.sourceId.localeCompare(b.sourceId));
  if (ranked.length && (ranked.length === 1 || ranked[0].score > ranked[1].score + 0.08)) {
    return { ...ranked[0], method: 'fuzzy' };
  }
  return { sourceId: '', method: 'unmatched', score: ranked[0]?.score || 0 };
}

function dependencyKeys(task) {
  return Object.keys(task?.Tasks || {});
}
function mandatoryQuestTasks(entries, allTasks) {
  const ownKeys = new Set(entries.map(([key]) => key));
  const completionKeys = entries
    .filter(([key, task]) =>
      /complete (?:the )?(?:quest|miniquest)|defeat(?:ing)? the culinaromancer/i.test(key)
      || task?.QuestPoints !== undefined)
    .map(([key]) => key);
  const roots = completionKeys.length ? completionKeys : entries.slice(-1).map(([key]) => key);
  const visited = new Set();
  const stack = [...roots];
  while (stack.length) {
    const key = stack.pop();
    if (!ownKeys.has(key) || visited.has(key)) continue;
    visited.add(key);
    for (const dependency of dependencyKeys(allTasks[key])) {
      if (ownKeys.has(dependency)) stack.push(dependency);
    }
  }
  if (visited.size < Math.max(1, Math.floor(entries.length / 3))) {
    for (const [key] of entries) visited.add(key);
  }
  return { taskKeys: visited, completionKeys };
}

function balancedCall(text, tokenIndex) {
  const open = text.indexOf('(', tokenIndex);
  if (open < 0) return null;
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = open; index < text.length; index++) {
    const character = text[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") { quote = character; continue; }
    if (character === '(') depth++;
    else if (character === ')' && --depth === 0) {
      return { argsText: text.slice(open + 1, index), end: index + 1 };
    }
  }
  return null;
}
function splitArguments(text) {
  const values = [];
  let start = 0;
  let paren = 0;
  let bracket = 0;
  let brace = 0;
  let quote = '';
  let escaped = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") { quote = character; continue; }
    if (character === '(') paren++;
    else if (character === ')') paren--;
    else if (character === '[') bracket++;
    else if (character === ']') bracket--;
    else if (character === '{') brace++;
    else if (character === '}') brace--;
    else if (character === ',' && paren === 0 && bracket === 0 && brace === 0) {
      values.push(text.slice(start, index).trim());
      start = index + 1;
    }
  }
  values.push(text.slice(start).trim());
  return values;
}

function inferSlots(label, constants = [], nearby = '') {
  const text = `${label} ${constants.join(' ')} ${nearby}`.toLowerCase().replaceAll('_', ' ');
  const slots = new Set();
  const has = (expression) => expression.test(text);
  if (has(/\b(helm|helmet|hat|hood|mask|headpiece|tiara|crown|wig|goggles|coif|faceguard|mitre)\b/)) slots.add('Head');
  if (has(/\b(cape|cloak)\b/)) slots.add('Cape');
  if (has(/\b(amulet|necklace|pendant|holy symbol|unholy symbol|stole)\b/)) slots.add('Neck');
  if (has(/\b(arrow|arrows|bolt|bolts|blessing)\b/) && has(/equip|wear|wield|ammo|arrow|bolt|blessing/)) slots.add('Ammo');
  if (has(/\b(sword|silverlight|darklight|arclight|excalibur|scimitar|dagger|knife|mace|warhammer|battleaxe|axe|spear|halberd|staff|wand|bow|crossbow|whip|flail|sickle|machete|keris|partisan|rapier|bludgeon|maul|club|hasta|sabre|saber|pickaxe|harpoon|ivandis|blisterwood|anchor)\b/)) slots.add('Weapon');
  if (has(/\b(platebody|chainbody|robe top|shirt|jacket|apron|torso|chestplate|armour top|armor top|mourner top|hauberk)\b/)) slots.add('Body');
  if (has(/\b(shield|defender|ward|buckler|book of balance|book of law|book of darkness|holy book|unholy book|anti dragon)\b/)) slots.add('Shield');
  if (has(/\b(platelegs|plateskirt|trousers|robe bottom|skirt|shorts|chaps|mourner trousers)\b/)) slots.add('Legs');
  if (has(/\b(glove|gloves|gauntlet|gauntlets|bracelet|bracers)\b/)) slots.add('Gloves');
  if (has(/\b(boot|boots|shoe|shoes|sandal|sandals)\b/)) slots.add('Boots');
  if (has(/\b(ring)\b/)) slots.add('Ring');
  return [...slots];
}

const PATH_ALIASES = {
  anothercooksquest: 'RFD: The Cook',
  mountaindwarf: 'RFD: Dwarf',
  goblingenerals: 'RFD: Goblins',
  piratepete: 'RFD: Pirate Pete',
  lumbridgeguide: 'RFD: Lumbridge Guide',
  evildave: 'RFD: Evil Dave',
  skrachuglogwee: 'RFD: Skrach Uglogwee',
  siramikvarze: 'RFD: Sir Amik Varze',
  kingawowogei: 'RFD: King Awowogei',
  culinaromancer: 'RFD: Finale',
};
function resolveHelperPath(file, questIds) {
  const parts = file.split(path.sep);
  const marker = Math.max(parts.lastIndexOf('quests'), parts.lastIndexOf('miniquests'));
  const slug = marker >= 0 ? parts[marker + 1] : path.basename(file, '.java');
  const compact = slug.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (PATH_ALIASES[compact]) return { quest: PATH_ALIASES[compact], method: 'path-alias', score: 1 };
  const exact = questIds.filter((id) => normalizeName(id).replaceAll(' ', '') === normalizeName(slug).replaceAll(' ', ''));
  if (exact.length === 1) return { quest: exact[0], method: 'path-normalized', score: 1 };
  const ranked = questIds.map((quest) => ({ quest, score: similarity(slug, quest) })).sort((a, b) => b.score - a.score);
  if (ranked[0]?.score >= 0.68 && (ranked.length === 1 || ranked[0].score > ranked[1].score + 0.08)) {
    return { ...ranked[0], method: 'path-fuzzy' };
  }
  return { quest: '', method: 'unmatched', score: ranked[0]?.score || 0 };
}

function scanQuestHelper(root, questIds) {
  const helperRoot = path.join(root, 'src', 'main', 'java', 'com', 'questhelper', 'helpers');
  const files = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.java') && /[\\/](quests|miniquests)[\\/]/.test(full)) files.push(full);
    }
  };
  walk(helperRoot);
  const candidates = [];
  const unmatchedFiles = [];
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    if (!source.includes('ItemRequirement')) continue;
    const mapped = resolveHelperPath(file, questIds);
    const relativeFile = path.relative(root, file).replaceAll(path.sep, '/');
    if (!mapped.quest) unmatchedFiles.push({ file: relativeFile, score: mapped.score });
    const definitions = new Map();
    const assignment = /(?:^|\n)\s*(?:[A-Za-z0-9_<>?, ]+\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*new\s+ItemRequirement\s*\(/g;
    for (const match of source.matchAll(assignment)) {
      const start = match.index + match[0].lastIndexOf('new ItemRequirement');
      const call = balancedCall(source, start);
      if (!call) continue;
      const args = splitArguments(call.argsText);
      const labelArg = args[0] === 'true' || args[0] === 'false' ? args[1] : args[0];
      const label = firstStringLiteral(labelArg);
      const constants = [...call.argsText.matchAll(/(?:ItemID|ItemCollections)\.([A-Z0-9_]+)/g)].map((item) => item[1]);
      definitions.set(match[1], { label, constants });
      if (args.length >= 4 && args.at(-1) === 'true') {
        const nearby = source.slice(Math.max(0, start - 300), Math.min(source.length, call.end + 450));
        candidates.push({
          quest: mapped.quest,
          mappingMethod: mapped.method,
          helperFile: relativeFile,
          line: lineAt(source, start),
          variable: match[1],
          label,
          constants,
          slots: inferSlots(label, constants, nearby),
          evidenceType: 'constructor mustBeEquipped=true',
          snippet: nearby.replace(/\s+/g, ' ').slice(0, 850),
        });
      }
    }
    for (const match of source.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\.setMustBeEquipped\(true\)/g)) {
      const definition = definitions.get(match[1]) || { label: '', constants: [] };
      const nearby = source.slice(Math.max(0, match.index - 350), Math.min(source.length, match.index + 450));
      candidates.push({
        quest: mapped.quest,
        mappingMethod: mapped.method,
        helperFile: relativeFile,
        line: lineAt(source, match.index),
        variable: match[1],
        label: definition.label,
        constants: definition.constants,
        slots: inferSlots(definition.label, definition.constants, nearby),
        evidenceType: 'setMustBeEquipped(true)',
        snippet: nearby.replace(/\s+/g, ' ').slice(0, 850),
      });
    }
  }
  return { candidates, unmatchedFiles, scannedJavaFiles: files.length };
}

function chunkEquipmentCandidates(entries, mandatoryKeys) {
  const pattern = /\b(wear(?:ing)?|equip(?:ped|ping)?|wield(?:ing)?|dress(?:ed)?|disguise(?:d)?|put on)\b/i;
  const results = [];
  for (const [taskKey, task] of entries) {
    if (!mandatoryKeys.has(taskKey)) continue;
    const description = String(task.Description || '');
    if (!pattern.test(description)) continue;
    const items = (task.Items || []).map(String);
    results.push({
      taskKey,
      description,
      items,
      slots: unique(items.flatMap((item) => inferSlots(item, [], description))),
    });
  }
  return results;
}

const QUEST_DATA = loadQuestData();
const quests = Object.values(QUEST_DATA).sort((a, b) => a.id.localeCompare(b.id));
const questIds = quests.map((quest) => quest.id);
const officialList = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'sources', 'quest-list.json'), 'utf8'));

const tasksMap = JSON.parse((await fetchText(CHUNK_PICKER_URL)).replace(/^\uFEFF/, ''));
const allQuestTasks = tasksMap?.challenges?.Quest;
if (!allQuestTasks || typeof allQuestTasks !== 'object') throw new Error('Chunk Picker challenges.Quest is unavailable');
const sourceGroups = new Map();
for (const [key, task] of Object.entries(allQuestTasks)) {
  if (!task?.BaseQuest) continue;
  if (!sourceGroups.has(task.BaseQuest)) sourceGroups.set(task.BaseQuest, []);
  sourceGroups.get(task.BaseQuest).push([key, task]);
}
const sourceIds = new Set(sourceGroups.keys());

const questHelperRoot = '/tmp/quest-helper';
fs.rmSync(questHelperRoot, { recursive: true, force: true });
execFileSync('git', ['clone', '--depth', '1', QUEST_HELPER_URL, questHelperRoot], { stdio: 'inherit' });
const questHelperSha = execFileSync('git', ['-C', questHelperRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const helperAudit = scanQuestHelper(questHelperRoot, questIds);
const helperByQuest = new Map();
for (const candidate of helperAudit.candidates) {
  if (!candidate.quest) continue;
  if (!helperByQuest.has(candidate.quest)) helperByQuest.set(candidate.quest, []);
  helperByQuest.get(candidate.quest).push(candidate);
}

const MANUAL_CONFIRMATIONS = {
  'Demon Slayer': {
    slots: ['Weapon'],
    note: 'Silverlight must be wielded for the Delrith sequence.',
  },
};

const rows = [];
const confirmed = [];
const candidates = [];
const sourceMatches = [];

for (const quest of quests) {
  const sourceMatch = resolveSourceQuest(quest.id, sourceIds);
  const sourceEntries = sourceMatch.sourceId ? sourceGroups.get(sourceMatch.sourceId) || [] : [];
  const mandatory = mandatoryQuestTasks(sourceEntries, allQuestTasks);
  const officialSkills = { ...(quest.skills || {}) };
  delete officialSkills['Quest Points'];
  const allXpEvents = [];
  const mandatoryStepSkills = {};
  for (const [taskKey, task] of sourceEntries) {
    if (!mandatory.taskKeys.has(taskKey)) continue;
    mergeMaximum(mandatoryStepSkills, task.Skills || {});
    for (const [skill, rawAmount] of Object.entries(task.XpReward || {})) {
      allXpEvents.push({
        taskKey,
        skill,
        amount: Number(rawAmount) || 0,
        completionTask: mandatory.completionKeys.includes(taskKey),
      });
    }
  }

  const operationalSkills = new Set();
  const coveredXp = [];
  const conditionalXp = [];
  for (const event of allXpEvents) {
    if (GENERIC_XP.has(event.skill) || !SKILLS.has(event.skill)) {
      conditionalXp.push(event);
      candidates.push({
        quest: quest.id,
        kind: quest.kind,
        candidateType: 'conditional-or-selectable-xp',
        value: `${event.skill} ${event.amount}`,
        classification: 'NOT_A_GLOBAL_BLOCKER',
        reason: 'The reward is generic, random, selectable, or not a named skill reward.',
        sourceQuest: sourceMatch.sourceId,
        sourceTask: event.taskKey,
        sourceUrl: CHUNK_PICKER_URL,
      });
    } else if (ALWAYS_AVAILABLE_SKILLS.has(event.skill)) {
      coveredXp.push({ ...event, coverage: 'always-available-skill' });
    } else if (Object.hasOwn(officialSkills, event.skill)) {
      coveredXp.push({ ...event, coverage: 'official-level-requirement' });
    } else {
      operationalSkills.add(event.skill);
    }
  }

  const stepSkillReview = [];
  for (const [skill, level] of Object.entries(mandatoryStepSkills)) {
    if (!SKILLS.has(skill)) continue;
    const officialLevel = Number(officialSkills[skill] || 0);
    if (Number(level) > officialLevel) {
      const entry = { skill, level: Number(level), officialLevel };
      stepSkillReview.push(entry);
      candidates.push({
        quest: quest.id,
        kind: quest.kind,
        candidateType: 'mandatory-step-skill',
        value: `${skill} ${level}`,
        classification: officialLevel ? 'POSSIBLE_LEVEL_DRIFT' : 'POSSIBLE_OPERATIONAL_SKILL',
        reason: officialLevel
          ? `The mandatory task path records ${skill} ${level}, above the app's official level ${officialLevel}.`
          : `The mandatory task path records ${skill} ${level}, while the app has no official ${skill} requirement.`,
        sourceQuest: sourceMatch.sourceId,
        sourceTask: '',
        sourceUrl: CHUNK_PICKER_URL,
      });
    }
  }

  const helperEquipment = helperByQuest.get(quest.id) || [];
  const chunkEquipment = chunkEquipmentCandidates(sourceEntries, mandatory.taskKeys);
  const operationalSlots = new Set();
  const equipmentReview = [];
  for (const helper of helperEquipment) {
    if (helper.slots.length === 1) {
      operationalSlots.add(helper.slots[0]);
      confirmed.push({
        quest: quest.id,
        kind: quest.kind,
        requirementType: 'equipment-slot',
        requirement: helper.slots[0],
        reason: `${helper.label || helper.variable} is explicitly modelled by Quest Helper as needing to be equipped.`,
        sourceQuest: sourceMatch.sourceId,
        sourceTask: chunkEquipment.filter((item) => item.slots.includes(helper.slots[0])).map((item) => item.taskKey).join('; '),
        evidence: `${helper.helperFile}:${helper.line}; ${helper.evidenceType}`,
        sourceUrl: `https://github.com/Zoinkwiz/quest-helper/blob/${questHelperSha}/${helper.helperFile}`,
      });
    } else {
      equipmentReview.push({ source: 'quest-helper', ...helper });
    }
  }
  for (const item of chunkEquipment) {
    if (!item.slots.some((slot) => operationalSlots.has(slot))) equipmentReview.push({ source: 'chunk-picker', ...item });
  }
  const manual = MANUAL_CONFIRMATIONS[quest.id];
  for (const slot of manual?.slots || []) operationalSlots.add(slot);

  for (const skill of [...operationalSkills].sort()) {
    const events = allXpEvents.filter((event) => event.skill === skill);
    confirmed.push({
      quest: quest.id,
      kind: quest.kind,
      requirementType: 'skill-unlock-automatic-xp',
      requirement: skill,
      reason: `Mandatory quest progression awards ${skill} XP but the app has no official ${skill} requirement.`,
      sourceQuest: sourceMatch.sourceId,
      sourceTask: events.map((event) => event.taskKey).join('; '),
      evidence: events.map((event) => `${event.amount} ${skill} XP`).join('; '),
      sourceUrl: CHUNK_PICKER_URL,
    });
  }
  for (const review of equipmentReview) {
    candidates.push({
      quest: quest.id,
      kind: quest.kind,
      candidateType: 'equipment-slot',
      value: review.slots?.join('; ') || review.label || review.items?.join('; ') || 'Unknown slot',
      classification: 'MANUAL_REVIEW_REQUIRED',
      reason: review.description || review.snippet || 'Equipment evidence exists, but the slot or universal route requirement is ambiguous.',
      sourceQuest: sourceMatch.sourceId,
      sourceTask: review.taskKey || '',
      sourceUrl: review.helperFile
        ? `https://github.com/Zoinkwiz/quest-helper/blob/${questHelperSha}/${review.helperFile}`
        : CHUNK_PICKER_URL,
    });
  }

  const row = {
    quest: quest.id,
    kind: quest.kind,
    points: quest.points,
    officialSkills,
    prereqs: quest.prereqs || [],
    regions: quest.regions || [],
    manualRequirements: quest.manualRequirements || [],
    sourceQuest: sourceMatch.sourceId,
    sourceMatchMethod: sourceMatch.method,
    sourceMatchScore: sourceMatch.score,
    sourceTaskCount: sourceEntries.length,
    mandatoryTaskCount: mandatory.taskKeys.size,
    xpEvents: allXpEvents,
    operationalSkills: [...operationalSkills].sort(),
    coveredXp,
    conditionalXp,
    stepSkillReview,
    operationalSlots: [...operationalSlots].sort(),
    equipmentReview,
    manualConfirmation: manual?.note || '',
  };
  row.classification = !row.sourceQuest
    ? 'SOURCE_GAP'
    : row.operationalSkills.length || row.operationalSlots.length
      ? 'EXTRA_REQUIREMENTS_CONFIRMED'
      : row.stepSkillReview.length || row.equipmentReview.length
        ? 'MANUAL_REVIEW_REQUIRED'
        : row.conditionalXp.length
          ? 'CONDITIONAL_OR_OPTIONAL_REWARD'
          : 'NO_EXTRA_REQUIREMENT_FOUND';
  rows.push(row);
  sourceMatches.push({
    quest: quest.id,
    kind: quest.kind,
    sourceQuest: sourceMatch.sourceId,
    method: sourceMatch.method,
    score: sourceMatch.score,
    sourceTaskCount: sourceEntries.length,
    mandatoryTaskCount: mandatory.taskKeys.size,
  });
}

const confirmedByKey = new Map();
for (const row of confirmed) confirmedByKey.set(`${row.quest}\0${row.requirementType}\0${row.requirement}`, row);
const confirmedRows = [...confirmedByKey.values()].sort((a, b) =>
  a.quest.localeCompare(b.quest) || a.requirementType.localeCompare(b.requirementType) || a.requirement.localeCompare(b.requirement));

const expectedCount = Number(officialList?.parsedCounts?.quests || 0) - 1 + Number(officialList?.parsedCounts?.miniquests || 0);
const summary = {
  schemaVersion: 1,
  generatedAt,
  repositorySha,
  questHelperSha,
  chunkPickerUrl: CHUNK_PICKER_URL,
  counts: {
    catalogue: rows.length,
    quests: rows.filter((row) => row.kind === 'quest').length,
    miniquests: rows.filter((row) => row.kind === 'miniquest').length,
    expectedNormalizedCatalogue: expectedCount,
    matchedToChunkPicker: rows.filter((row) => row.sourceQuest).length,
    sourceGaps: rows.filter((row) => !row.sourceQuest).length,
    confirmedRequirementRows: confirmedRows.length,
    entriesWithConfirmedExtras: rows.filter((row) => row.operationalSkills.length || row.operationalSlots.length).length,
    entriesNeedingManualReview: rows.filter((row) => row.stepSkillReview.length || row.equipmentReview.length).length,
    conditionalRewardEntries: rows.filter((row) => row.conditionalXp.length).length,
    questHelperJavaFilesScanned: helperAudit.scannedJavaFiles,
    questHelperEquipmentCandidates: helperAudit.candidates.length,
    questHelperUnmatchedFiles: helperAudit.unmatchedFiles.length,
  },
  classifications: Object.fromEntries(
    [...new Set(rows.map((row) => row.classification))].sort().map((classification) => [
      classification,
      rows.filter((row) => row.classification === classification).length,
    ]),
  ),
};

const metadata = {};
for (const row of rows) {
  const value = {};
  if (row.operationalSkills.length) value.requiredSkillUnlocks = row.operationalSkills;
  if (row.operationalSlots.length) value.requiredEquipmentSlots = row.operationalSlots;
  if (Object.keys(value).length) metadata[row.quest] = value;
}

fs.writeFileSync(path.join(OUT, 'raw-audit.json'), JSON.stringify({ summary, quests: rows, confirmedRequirements: confirmedRows, candidates, helperAudit }, null, 2));
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
fs.writeFileSync(path.join(OUT, 'proposed-operational-metadata.json'), JSON.stringify({ schemaVersion: 1, generatedAt, repositorySha, quests: metadata }, null, 2));

writeCsv('all-quests-matrix.csv', rows.map((row) => ({
  quest: row.quest,
  kind: row.kind,
  classification: row.classification,
  officialSkills: Object.entries(row.officialSkills).map(([skill, level]) => `${skill} ${level}`),
  operationalSkills: row.operationalSkills,
  equipmentSlots: row.operationalSlots,
  conditionalXp: row.conditionalXp.map((event) => `${event.skill} ${event.amount}`),
  stepSkillReview: row.stepSkillReview.map((entry) => `${entry.skill} ${entry.level} (app ${entry.officialLevel || 'none'})`),
  equipmentReview: row.equipmentReview.map((entry) => `${entry.slots?.join('+') || entry.label || entry.items?.join('+') || 'unknown'}: ${entry.description || entry.evidenceType || ''}`),
  sourceQuest: row.sourceQuest,
  sourceMatch: row.sourceMatchMethod,
  sourceTaskCount: row.sourceTaskCount,
  manualRequirements: row.manualRequirements,
  prereqs: row.prereqs,
  regions: row.regions,
})), ['quest','kind','classification','officialSkills','operationalSkills','equipmentSlots','conditionalXp','stepSkillReview','equipmentReview','sourceQuest','sourceMatch','sourceTaskCount','manualRequirements','prereqs','regions']);
writeCsv('confirmed-operational-requirements.csv', confirmedRows, ['quest','kind','requirementType','requirement','reason','sourceQuest','sourceTask','evidence','sourceUrl']);
writeCsv('manual-review-candidates.csv', candidates, ['quest','kind','candidateType','value','classification','reason','sourceQuest','sourceTask','sourceUrl']);
writeCsv('source-match.csv', sourceMatches, ['quest','kind','sourceQuest','method','score','sourceTaskCount','mandatoryTaskCount']);
writeCsv('quest-helper-equipment-candidates.csv', helperAudit.candidates.map((row) => ({ ...row, constants: row.constants, slots: row.slots })), ['quest','mappingMethod','helperFile','line','variable','label','constants','slots','evidenceType','snippet']);
writeCsv('quest-helper-unmatched-files.csv', helperAudit.unmatchedFiles, ['file','score']);

const skillCounts = {};
const slotCounts = {};
for (const requirement of confirmedRows) {
  const target = requirement.requirementType === 'equipment-slot' ? slotCounts : skillCounts;
  target[requirement.requirement] = (target[requirement.requirement] || 0) + 1;
}
const report = [
  '# Full OSRS quest operational-requirement audit',
  '',
  `Generated: ${generatedAt}`,
  `Repository commit: \`${repositorySha}\``,
  `Quest Helper commit: \`${questHelperSha}\``,
  '',
  '## Catalogue reconciliation',
  '',
  `- Audited **${summary.counts.catalogue}** entries: ${summary.counts.quests} quests and ${summary.counts.miniquests} miniquests.`,
  `- Expected normalized catalogue: **${summary.counts.expectedNormalizedCatalogue}**.`,
  `- Matched to Chunk Picker quest-task data: **${summary.counts.matchedToChunkPicker}/${summary.counts.catalogue}**.`,
  `- Source gaps: **${summary.counts.sourceGaps}**.`,
  '',
  '## Findings',
  '',
  `- Confirmed operational requirements: **${summary.counts.confirmedRequirementRows}** rows across **${summary.counts.entriesWithConfirmedExtras}** entries.`,
  `- Entries retaining manual-review candidates: **${summary.counts.entriesNeedingManualReview}**.`,
  `- Skill blockers by skill: ${Object.entries(skillCounts).sort((a,b) => b[1]-a[1]).map(([skill,count]) => `${skill} ${count}`).join(', ') || 'none'}.`,
  `- Equipment blockers by slot: ${Object.entries(slotCounts).sort((a,b) => b[1]-a[1]).map(([slot,count]) => `${slot} ${count}`).join(', ') || 'none'}.`,
  '',
  '## Method and limits',
  '',
  '- Every app quest and miniquest receives one matrix row.',
  '- Named-skill XP on the mandatory dependency path is treated as an operational skill blocker when no official requirement already guarantees that skill.',
  '- Hitpoints XP is excluded because Hitpoints is the mode’s always-available exception.',
  '- Generic, random, or selectable XP is retained as conditional rather than treated as a global blocker.',
  '- Equipment slots are confirmed from explicit Quest Helper `mustBeEquipped` requirements when the item maps unambiguously to one Fate-Locked slot.',
  '- Ambiguous equipment wording, alternative routes, and task skill discrepancies remain visibly queued for manual review rather than being guessed.',
  '',
  '## Classification counts',
  '',
  ...Object.entries(summary.classifications).map(([classification, count]) => `- ${classification}: ${count}`),
  '',
];
fs.writeFileSync(path.join(OUT, 'FULL_AUDIT.md'), `${report.join('\n')}\n`);

if (rows.length !== expectedCount) {
  throw new Error(`Catalogue mismatch: runtime ${rows.length}, expected normalized official count ${expectedCount}`);
}
if (summary.counts.matchedToChunkPicker < Math.floor(rows.length * 0.9)) {
  throw new Error(`Source coverage too low: ${summary.counts.matchedToChunkPicker}/${rows.length}`);
}
console.log(JSON.stringify(summary, null, 2));
