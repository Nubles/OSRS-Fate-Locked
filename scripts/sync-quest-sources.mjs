#!/usr/bin/env node
/**
 * Refresh quest provenance only when explicitly requested. The default/check
 * path performs deterministic validation of the committed snapshots offline.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import ts from 'typescript';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OFFICIAL_PATH = resolve(ROOT, 'data', 'sources', 'quest-list.json');
const AUDIT_PATH = resolve(ROOT, 'data', 'sources', 'quest-requirement-audit.json');
const QUEST_DATA_PATH = resolve(ROOT, 'data', 'questData.ts');
const CHUNK_SOURCE_PATH = resolve(ROOT, 'data', 'sources', 'chunkpicker-chunkinfo-export.json.gz');
const WIKI_API = 'https://oldschool.runescape.wiki/api.php';
const WIKI_LIST_TITLE = 'Quests/List';
const CHUNK_SOURCE_COMMIT = 'ba2fcebf8b26c84c74f8d9ab328a0ede802be926';
const REVIEWED_AT = new Date().toISOString().slice(0, 10);
const USER_AGENT = 'OSRS-Fate-Locked quest provenance refresh/1.0 (https://github.com/Nubles/OSRS-Fate-Locked)';
const WIKI_PAGE_TITLES = {
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
  'Vale Totems': 'Vale Totems (miniquest)',
};
const RFD_CHUNK_IDS = Object.fromEntries(
  Object.entries(WIKI_PAGE_TITLES).map(([id, pageTitle]) => [pageTitle, id]),
);
function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalValue(child)]),
    );
  }
  return value;
}

function questRequirementFingerprint(quest) {
  return JSON.stringify({
    kind: quest.kind,
    accessPolicy: quest.accessPolicy,
    regions: canonicalValue(quest.regions),
    locations: canonicalValue(quest.locations),
    skills: canonicalValue(quest.skills),
    combatLevel: quest.combatLevel,
    prereqs: canonicalValue(quest.prereqs),
    oneOf: canonicalValue(quest.oneOf),
    manualRequirements: canonicalValue(quest.manualRequirements),
    points: quest.points,
  });
}

function readRuntimeQuestData() {
  const source = readFileSync(QUEST_DATA_PATH, 'utf8').replace(
    /import\s+\{\s*DropSource\s*\}\s+from\s+['"]\.\.\/types['"];?/,
    'const DropSource = new Proxy({}, { get: (_target, property) => String(property) });',
  );
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: QUEST_DATA_PATH,
    reportDiagnostics: true,
  });
  const diagnostics = output.diagnostics ?? [];
  if (diagnostics.some(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error)) {
    throw new Error(`Unable to load questData.ts: ${diagnostics.map(diagnostic => diagnostic.messageText).join('; ')}`);
  }
  const module = { exports: {} };
  Function('exports', 'module', output.outputText)(module.exports, module);
  return module.exports.QUEST_DATA;
}

function readJson(path, label) {
  if (!existsSync(path)) throw new Error(`${label} is missing: ${path}`);
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

function stableSourceError(source) {
  if (!source || typeof source !== 'object') return 'source must be an object';
  if (!Number.isInteger(source.revision) || source.revision <= 0) return 'revision must be a positive integer';
  if (!source.revisionTimestamp || Number.isNaN(Date.parse(source.revisionTimestamp))) return 'revisionTimestamp must be a valid date';
  try {
    const url = new URL(source.url);
    if (url.hostname !== 'oldschool.runescape.wiki') return 'URL must use oldschool.runescape.wiki';
    if (url.searchParams.get('oldid') !== String(source.revision)) return 'URL oldid must match revision';
  } catch {
    return 'URL must be absolute';
  }
  return undefined;
}

function duplicateIds(entries) {
  const seen = new Set();
  const duplicates = new Set();
  for (const entry of entries) {
    if (seen.has(entry.id)) duplicates.add(entry.id);
    seen.add(entry.id);
  }
  return [...duplicates].sort();
}

function assertSnapshots(official, audit) {
  const errors = [];
  if (official?.schemaVersion !== 1) errors.push('quest-list schemaVersion must be 1');
  if (audit?.schemaVersion !== 1) errors.push('quest-requirement-audit schemaVersion must be 1');
  if (!Array.isArray(official?.entries)) errors.push('quest-list entries must be an array');
  if (!Array.isArray(audit?.entries)) errors.push('quest-requirement-audit entries must be an array');
  if (errors.length) throw new Error(errors.join('\n'));

  const listSourceError = stableSourceError(official.listSource);
  if (listSourceError) errors.push(`quest list source: ${listSourceError}`);
  const officialDuplicates = duplicateIds(official.entries);
  const auditDuplicates = duplicateIds(audit.entries);
  if (officialDuplicates.length) errors.push(`duplicate official IDs: ${officialDuplicates.join(', ')}`);
  if (auditDuplicates.length) errors.push(`duplicate audit IDs: ${auditDuplicates.join(', ')}`);

  const officialIds = official.entries.map(entry => entry.id).sort();
  const auditIds = audit.entries.map(entry => entry.id).sort();
  if (JSON.stringify(officialIds) !== JSON.stringify(auditIds)) {
    errors.push('official and audit ID sets differ');
  }
  const questCount = official.entries.filter(entry => entry.kind === 'quest').length;
  const miniquestCount = official.entries.filter(entry => entry.kind === 'miniquest').length;
  if (questCount !== 188 || miniquestCount !== 19 || official.entries.length !== 207) {
    errors.push(`reviewed baseline must be 188 quests and 19 miniquests; found ${questCount}/${miniquestCount}`);
  }

  const officialById = new Map(official.entries.map(entry => [entry.id, entry]));
  for (const entry of official.entries) {
    const sourceError = stableSourceError(entry.source);
    if (sourceError) errors.push(`${entry.id} official source: ${sourceError}`);
  }
  for (const entry of audit.entries) {
    const sourceError = stableSourceError(entry.source);
    if (sourceError) errors.push(`${entry.id} audit source: ${sourceError}`);
    if (entry.chunkSourceCommit !== CHUNK_SOURCE_COMMIT) errors.push(`${entry.id}: unexpected Chunk Picker commit`);
    if (entry.status === 'unresolved' && (!entry.discrepancy?.trim() || !entry.conservativeReason?.trim())) {
      errors.push(`${entry.id}: unresolved entries require discrepancy and conservativeReason`);
    }
    if (JSON.stringify(entry.source) !== JSON.stringify(officialById.get(entry.id)?.source)) {
      errors.push(`${entry.id}: source differs between official list and audit`);
    }
  }
  if (errors.length) throw new Error(`Quest source snapshot validation failed:\n${errors.map(error => `  - ${error}`).join('\n')}`);
  console.log(`Quest source snapshots valid offline: ${questCount} quests, ${miniquestCount} miniquests, ${officialIds.length} unique IDs, ${audit.entries.length} source revisions.`);
}

async function wikiRequest(params, stage) {
  const url = new URL(WIKI_API);
  url.search = new URLSearchParams({
    format: 'json',
    formatversion: '2',
    ...params,
  });
  let response;
  try {
    response = await fetch(url, {
      headers: {
        'Api-User-Agent': USER_AGENT,
        'User-Agent': USER_AGENT,
      },
    });
  } catch (error) {
    throw new Error(`${stage} failed fetching ${url}: ${error.message}`);
  }
  if (!response.ok) throw new Error(`${stage} failed fetching ${url}: HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(`${stage} failed at ${url}: ${body.error.code}: ${body.error.info}`);
  return body;
}

function permanentSource(page) {
  const title = encodeURIComponent(page.title.replaceAll(' ', '_'));
  return {
    url: `https://oldschool.runescape.wiki/w/index.php?title=${title}&oldid=${page.revision}`,
    revision: page.revision,
    revisionTimestamp: page.revisionTimestamp,
  };
}

async function pageRevisions(titles) {
  const results = new Map();
  for (let offset = 0; offset < titles.length; offset += 50) {
    const requested = titles.slice(offset, offset + 50);
    const body = await wikiRequest({
      action: 'query',
      prop: 'revisions',
      redirects: '1',
      rvprop: 'ids|timestamp',
      titles: requested.join('|'),
    }, `page revision batch ${Math.floor(offset / 50) + 1}`);
    const aliases = new Map(requested.map(title => [title, title]));
    for (const normalized of body.query?.normalized ?? []) aliases.set(normalized.from, normalized.to);
    for (const redirect of body.query?.redirects ?? []) aliases.set(redirect.from, redirect.to);
    const resolveAlias = (title) => {
      let current = title;
      const visited = new Set();
      while (aliases.has(current) && aliases.get(current) !== current && !visited.has(current)) {
        visited.add(current);
        current = aliases.get(current);
      }
      return current;
    };
    const pages = new Map((body.query?.pages ?? []).map(page => [page.title, page]));
    for (const requestedTitle of requested) {
      const canonicalTitle = resolveAlias(resolveAlias(requestedTitle.replaceAll('_', ' ')));
      const page = pages.get(canonicalTitle) ?? [...pages.values()].find(candidate => candidate.title === canonicalTitle);
      const revision = page?.revisions?.[0];
      if (!page || page.missing || !revision?.revid || !revision.timestamp) {
        throw new Error(`page revision lookup did not resolve "${requestedTitle}" (resolved title "${canonicalTitle}")`);
      }
      results.set(requestedTitle, {
        title: page.title,
        revision: revision.revid,
        revisionTimestamp: revision.timestamp,
      });
    }
  }
  return results;
}

function decodeHtml(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&#39;', "'")
    .replaceAll('&quot;', '"')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function parseOfficialRows(html, runtime) {
  const runtimeByName = new Map();
  for (const quest of Object.values(runtime)) {
    for (const name of [quest.id, quest.name, WIKI_PAGE_TITLES[quest.id]]) {
      if (name) runtimeByName.set(name.toLocaleLowerCase(), quest);
    }
  }
  const found = new Map();
  for (const tableMatch of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
    const rows = [];
    const knownPositions = [];
    const knownKinds = [];
    for (const rowMatch of tableMatch[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const row = rowMatch[1];
      if (!/<td\b/i.test(row)) continue;
      const candidates = [];
      for (const anchorMatch of row.matchAll(/<a\b([^>]*)>/gi)) {
        const attributes = anchorMatch[1];
        const title = attributes.match(/\btitle="([^"]+)"/i)?.[1];
        const href = attributes.match(/\bhref="\/w\/([^"#?]+)[^"]*"/i)?.[1];
        if (!title && !href) continue;
        const candidate = decodeURIComponent(decodeHtml(title ?? href).replaceAll('_', ' '));
        if (!candidate || /^(?:File|Category|Template|Help|Special):/i.test(candidate)) continue;
        candidates.push(candidate);
      }
      const knownIndex = candidates.findIndex(candidate => runtimeByName.has(candidate.toLocaleLowerCase()));
      const known = knownIndex >= 0 ? runtimeByName.get(candidates[knownIndex].toLocaleLowerCase()) : undefined;
      if (known) {
        knownPositions.push(knownIndex);
        knownKinds.push(known.kind);
      }
      rows.push({ candidates, known, knownIndex });
    }
    if (!knownKinds.length) continue;
    const mode = values => [...new Set(values)].sort((left, right) =>
      values.filter(value => value === right).length - values.filter(value => value === left).length,
    )[0];
    const kind = mode(knownKinds);
    const titlePosition = mode(knownPositions);
    for (const row of rows) {
      const pageTitle = row.known
        ? (WIKI_PAGE_TITLES[row.known.id] ?? row.known.id)
        : row.candidates[titlePosition];
      if (!pageTitle) continue;
      found.set(`${kind}:${pageTitle}`, { pageTitle, kind });
    }
  }
  return [...found.values()];
}
function chunkEvidence(runtimeIds) {
  const source = JSON.parse(gunzipSync(readFileSync(CHUNK_SOURCE_PATH)));
  const evidence = new Map([...runtimeIds].map(id => [id, []]));
  for (const [numericId, chunk] of Object.entries(source.chunks ?? {})) {
    const coordinate = `${Number(numericId) >> 8},${Number(numericId) & 255}`;
    const place = typeof chunk.Nickname === 'string' && chunk.Nickname.trim()
      ? chunk.Nickname.trim()
      : `Chunk ${coordinate}`;
    for (const section of Object.values(chunk.Sections ?? {})) {
      for (const [sourceQuest, sourceRole] of Object.entries(section.Quest ?? {})) {
        const rfdId = RFD_CHUNK_IDS[sourceQuest];
        const id = rfdId ?? sourceQuest;
        if (!evidence.has(id)) continue;
        const role = rfdId ? 'step' : sourceRole === 'first' ? 'first' : 'step';
        const rows = evidence.get(id);
        const existing = rows.find(row => row.chunkId === coordinate);
        if (!existing) {
          rows.push({ chunkId: coordinate, role, place });
        } else if (role === 'first') {
          existing.role = 'first';
          existing.place = place;
        }
      }
    }
  }
  for (const rows of evidence.values()) {
    rows.sort((left, right) =>
      left.chunkId.localeCompare(right.chunkId, undefined, { numeric: true })
      || left.role.localeCompare(right.role)
      || left.place.localeCompare(right.place));
  }
  return evidence;
}

async function refresh() {
  const runtime = readRuntimeQuestData();
  const quests = Object.values(runtime);
  const parse = await wikiRequest({
    action: 'parse',
    page: WIKI_LIST_TITLE,
    prop: 'text|revid',
  }, 'official quest list parse');
  const listRevisionId = parse.parse?.revid;
  const listHtml = parse.parse?.text;
  if (!Number.isInteger(listRevisionId) || typeof listHtml !== 'string') {
    throw new Error(`official quest list parse returned unexpected shape: ${JSON.stringify(Object.keys(parse.parse ?? {}))}`);
  }
  const parsedRows = parseOfficialRows(listHtml, runtime);
  const requestedPageTitles = quests.map(quest => WIKI_PAGE_TITLES[quest.id] ?? quest.id);
  const revisionTitles = [...new Set([
    WIKI_LIST_TITLE,
    ...requestedPageTitles,
    ...parsedRows.map(row => row.pageTitle),
  ])];
  const revisions = await pageRevisions(revisionTitles);
  const listRevision = revisions.get(WIKI_LIST_TITLE);
  if (listRevision.revision !== listRevisionId) {
    throw new Error(`official list moved during refresh: parsed ${listRevisionId}, revision query returned ${listRevision.revision}`);
  }
  const evidence = chunkEvidence(new Set(quests.map(quest => quest.id)));
  const entries = quests
    .map(quest => {
      const page = revisions.get(WIKI_PAGE_TITLES[quest.id] ?? quest.id);
      return {
        id: quest.id,
        kind: quest.kind,
        pageTitle: page.title,
        source: permanentSource(page),
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
  const parsedCanonicalRows = parsedRows.map(row => ({
    ...row,
    pageTitle: revisions.get(row.pageTitle).title,
    source: permanentSource(revisions.get(row.pageTitle)),
  }));
  const parsedTitles = new Set(parsedCanonicalRows.map(row => row.pageTitle.toLocaleLowerCase()));
  const representedTitles = new Set(
    entries.map(entry => entry.pageTitle.toLocaleLowerCase()),
  );
  representedTitles.add('recipe for disaster');
  const runtimeEntriesMissingFromLiveList = entries
    .filter(entry => !parsedTitles.has(entry.pageTitle.toLocaleLowerCase()))
    .map(entry => entry.id)
    .sort();
  const liveOnlyEntries = parsedCanonicalRows
    .filter(row => !representedTitles.has(row.pageTitle.toLocaleLowerCase()))
    .sort((left, right) => left.pageTitle.localeCompare(right.pageTitle));
  const parsedCounts = {
    quests: parsedCanonicalRows.filter(row => row.kind === 'quest').length,
    miniquests: parsedCanonicalRows.filter(row => row.kind === 'miniquest').length,
  };
  const hasDrift = runtimeEntriesMissingFromLiveList.length > 0 || liveOnlyEntries.length > 0;
  const official = {
    schemaVersion: 1,
    reviewedAt: REVIEWED_AT,
    listSource: permanentSource(listRevision),
    parsedCounts,
    drift: {
      runtimeEntriesMissingFromLiveList,
      liveOnlyEntries,
      note: hasDrift
        ? 'The live official rows differ from the approved normalized 188/19 runtime baseline; membership remains pinned for Task 5 and reconciliation is deferred to Task 11.'
        : 'The live official rows reconcile with the approved normalized baseline (Recipe for Disaster remains expanded into its existing parent-step IDs).',
    },
    entries,
  };
  const audit = {
    schemaVersion: 1,
    reviewedAt: REVIEWED_AT,
    chunkSourceCommit: CHUNK_SOURCE_COMMIT,
    entries: quests
      .map(quest => {
        const sourceEntry = entries.find(entry => entry.id === quest.id);
        const questEvidence = evidence.get(quest.id);
        return {
          id: quest.id,
          kind: quest.kind,
          status: 'unresolved',
          reviewedAt: REVIEWED_AT,
          source: sourceEntry.source,
          chunkSourceCommit: CHUNK_SOURCE_COMMIT,
          accessPolicy: quest.accessPolicy,
          requirementFingerprint: questRequirementFingerprint(quest),
          chunkEvidence: questEvidence,
          notes: {
            items: [],
            travel: [],
            instances: [],
            partialCompletion: [],
          },
          discrepancy: `Pending field-by-field reconciliation: retained runtime has ${quest.regions.length} region requirement(s), ${quest.locations?.length ?? 0} exact location requirement(s), ${Object.keys(quest.skills).length} skill requirement(s), and ${quest.prereqs.length} prerequisite(s); the pinned Chunk Picker supplies ${questEvidence.length} activity chunk(s).`,
          conservativeReason: `Retained the existing ${quest.accessPolicy} access policy and requirement fingerprint until Tasks 6-11 verify unavoidable steps, travel, instances, items, and partial-completion routes against this permanent Wiki revision.`,
        };
      })
      .sort((left, right) => left.id.localeCompare(right.id)),
  };
  assertSnapshots(official, audit);
  writeFileSync(OFFICIAL_PATH, `${JSON.stringify(official, null, 2)}\n`);
  writeFileSync(AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`);
  console.log(`Refreshed ${quests.length} stable Wiki page revisions from Quests/List revision ${listRevision.revision}.`);
  if (hasDrift) {
    console.warn(`Official-list drift recorded: ${runtimeEntriesMissingFromLiveList.length} runtime-only and ${liveOnlyEntries.length} live-only row(s); baseline membership was not changed.`);
  }
}

const args = process.argv.slice(2);
if (args.length > 1 || args.some(arg => arg !== '--check' && arg !== '--refresh')) {
  throw new Error('Usage: node scripts/sync-quest-sources.mjs [--check|--refresh]');
}
if (args.includes('--refresh')) {
  await refresh();
} else {
  assertSnapshots(
    readJson(OFFICIAL_PATH, 'quest-list snapshot'),
    readJson(AUDIT_PATH, 'quest-requirement-audit snapshot'),
  );
}
