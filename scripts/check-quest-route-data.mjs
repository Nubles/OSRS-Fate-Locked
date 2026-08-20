import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const compareCodeUnits = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const canonicalItemKey = name => typeof name === 'string'
  ? name.trim().toLocaleLowerCase('en-GB').replace(/\s+/g, ' ')
  : '';
const label = value => typeof value === 'string' && value.length > 0 ? value : '<missing>';
const pinnedRevision = value => typeof value === 'string' && /^\d{8}$/.test(value);
const positiveFinite = value => Number.isFinite(value) && value > 0;

export const APPROVED_ITEM_FAMILIES = Object.freeze({
  clay: Object.freeze([]),
  nails: Object.freeze([
    'bronze nails', 'iron nails', 'steel nails', 'black nails',
    'mithril nails', 'adamantite nails', 'rune nails',
  ]),
  pickaxe: Object.freeze([
    'bronze pickaxe', 'iron pickaxe', 'steel pickaxe', 'black pickaxe',
    'mithril pickaxe', 'adamant pickaxe', 'rune pickaxe', 'dragon pickaxe',
    'gilded pickaxe', '3rd age pickaxe', 'infernal pickaxe', 'crystal pickaxe',
  ]),
});

const validateItem = (diagnostics, owner, item) => {
  if (!item || item.key !== canonicalItemKey(item.name) || item.key.length === 0) {
    diagnostics.push(`${owner}:${label(item?.key)}: item key is not the canonical identity for ${label(item?.name)}`);
  }
};

const validateQuantity = (diagnostics, owner, value) => {
  if (!positiveFinite(value)) diagnostics.push(`${owner}: quantity must be a positive finite number`);
};

const validateAlternatives = (diagnostics, owner, primary, alternatives = []) => {
  const approved = APPROVED_ITEM_FAMILIES[primary?.key];
  for (const alternative of alternatives) {
    validateItem(diagnostics, `${owner}/alternative`, alternative);
    if (!approved?.includes(alternative?.key)) {
      diagnostics.push(`${owner}/alternative:${label(alternative?.key)}: alternative is not approved for item family ${label(primary?.key)}`);
    }
  }
};

const duplicateDiagnostics = (diagnostics, values, idOf, prefix, message) => {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    const id = label(idOf(value));
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  for (const id of duplicates) diagnostics.push(`${prefix}:${id}: ${message}`);
};

export const checkQuestRouteData = ({
  quests = [], recipes = [], generatedStations = [], executableSources = [],
} = {}) => {
  const diagnostics = [];
  duplicateDiagnostics(diagnostics, quests.filter(Boolean), value => value.questId, 'quest', 'duplicate reviewed quest ID');
  duplicateDiagnostics(diagnostics, recipes.filter(Boolean), value => value.id, 'recipe', 'duplicate reviewed recipe ID');

  for (const quest of quests.filter(Boolean)) {
    const owner = `quest:${label(quest.questId)}`;
    if (!pinnedRevision(quest.wikiRevision)) diagnostics.push(`${owner}: wiki revision must be a pinned numeric revision`);
    if (!Array.isArray(quest.items) || quest.items.length === 0) {
      diagnostics.push(`${owner}: supported quest has no item requirements`);
      continue;
    }
    for (const requirement of quest.items) {
      const itemOwner = `${owner}/item:${label(requirement?.item?.key)}`;
      validateItem(diagnostics, `${owner}/item`, requirement?.item);
      validateQuantity(diagnostics, itemOwner, requirement?.quantity);
      validateAlternatives(diagnostics, itemOwner, requirement?.item, requirement?.alternatives);
    }
  }

  const exactStations = new Set(generatedStations.map(value => `${value?.kind}\0${value?.name}`));
  for (const recipe of recipes.filter(Boolean)) {
    const owner = `recipe:${label(recipe.id)}`;
    if (!pinnedRevision(recipe.sourceRevision)) diagnostics.push(`${owner}: source revision must be a pinned numeric revision`);
    validateItem(diagnostics, `${owner}/output`, recipe.output);
    validateQuantity(diagnostics, `${owner}/output:${label(recipe.output?.key)}`, recipe.outputQuantity);
    for (const [kind, entries] of [['ingredient', recipe.ingredients ?? []], ['tool', recipe.tools ?? []]]) {
      for (const entry of entries) {
        const itemOwner = `${owner}/${kind}:${label(entry?.item?.key)}`;
        validateItem(diagnostics, `${owner}/${kind}`, entry?.item);
        if (kind === 'ingredient') validateQuantity(diagnostics, itemOwner, entry?.quantity);
        validateAlternatives(diagnostics, itemOwner, entry?.item, entry?.alternatives);
      }
    }
    for (const station of recipe.stations ?? []) {
      for (const name of station.names ?? []) {
        if (!exactStations.has(`${station.entityKind}\0${name}`)) {
          diagnostics.push(`${owner}/station:${label(name)}: exact ${label(station.entityKind)} is absent from generated chunk content`);
        }
      }
    }
  }

  for (const source of executableSources) {
    const provenance = Array.isArray(source?.provenance) ? source.provenance : [];
    if (provenance.length > 0 && provenance.every(value => /(^|[/\\])resourceData\.ts$/.test(value))) {
      diagnostics.push(`source:${label(source?.id)}: executable evidence cannot derive only from data/resourceData.ts`);
    }
  }
  return [...new Set(diagnostics)].sort(compareCodeUnits);
};

export const runQuestRouteDataCheck = (input, write = line => console.error(line)) => {
  const diagnostics = checkQuestRouteData(input);
  diagnostics.forEach(write);
  return diagnostics.length === 0 ? 0 : 1;
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const inputPath = process.argv[2];
  if (inputPath) {
    try {
      process.exitCode = runQuestRouteDataCheck(JSON.parse(readFileSync(inputPath, 'utf8')));
    } catch (error) {
      console.error(`source:${inputPath}: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    }
  } else {
    const vitest = fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url));
    const result = spawnSync(process.execPath, [vitest, 'run', 'scripts/check-quest-route-data.test.ts'], {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      stdio: 'inherit',
    });
    process.exitCode = result.status ?? 1;
  }
}
