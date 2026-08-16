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
const LEGACY_CHUNK_SOURCE_COMMIT = 'ba2fcebf8b26c84c74f8d9ab328a0ede802be926';
const CURRENT_CHUNK_SOURCE_COMMIT = 'a9a5c74760eb76dbe39f90d2b04f023fc1de3746';
const APPROVED_CHUNK_SOURCE_COMMITS = new Set([
  LEGACY_CHUNK_SOURCE_COMMIT,
  CURRENT_CHUNK_SOURCE_COMMIT,
]);
const RUNTIME_QUEST_COUNT = 191;
const RUNTIME_MINIQUEST_COUNT = 19;
const OFFICIAL_PARSED_QUEST_COUNT = 192;
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
const GENERIC_DISCREPANCY = /\bpending\b|field-by-field|tasks?\s+\d|not yet (?:audited|reviewed)/i;

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

function matchingCommitSets(declaredChunkSourceCommits, referencedChunkSourceCommits) {
  const declared = new Set(declaredChunkSourceCommits);
  return declared.size === declaredChunkSourceCommits.length
    && declared.size === referencedChunkSourceCommits.size
    && [...declared].every(commit => referencedChunkSourceCommits.has(commit));
}

function assertExistingSnapshotsForRefresh(official, audit) {
  const errors = [];
  if (official?.schemaVersion !== 1) errors.push('quest-list schemaVersion must be 1');
  if (audit?.schemaVersion !== 1 && audit?.schemaVersion !== 2) {
    errors.push('quest-requirement-audit schemaVersion must be 1 or 2 before refresh');
  }
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
  if (miniquestCount !== RUNTIME_MINIQUEST_COUNT
    || ![RUNTIME_QUEST_COUNT - 1, RUNTIME_QUEST_COUNT].includes(questCount)
    || official.entries.length !== questCount + miniquestCount) {
    errors.push(`refresh baseline must contain either ${RUNTIME_QUEST_COUNT - 1} or ${RUNTIME_QUEST_COUNT} quests and ${RUNTIME_MINIQUEST_COUNT} miniquests; found ${questCount}/${miniquestCount}`);
  }

  const declaredChunkSourceCommits = audit.schemaVersion === 1
    ? [audit.chunkSourceCommit]
    : audit.chunkSourceCommits;
  if (!Array.isArray(declaredChunkSourceCommits)
    || !declaredChunkSourceCommits.every(commit => typeof commit === 'string' && commit)) {
    errors.push('refresh audit chunkSourceCommits must be a non-empty string array');
  } else if (declaredChunkSourceCommits.some(commit => !APPROVED_CHUNK_SOURCE_COMMITS.has(commit))) {
    errors.push('refresh audit chunkSourceCommits contains an unapproved Chunk Picker commit');
  }

  const officialById = new Map(official.entries.map(entry => [entry.id, entry]));
  const referencedChunkSourceCommits = new Set();
  for (const entry of official.entries) {
    const sourceError = stableSourceError(entry.source);
    if (sourceError) errors.push(`${entry.id} official source: ${sourceError}`);
  }
  for (const entry of audit.entries) {
    const sourceError = stableSourceError(entry.source);
    if (sourceError) errors.push(`${entry.id} audit source: ${sourceError}`);
    if (!APPROVED_CHUNK_SOURCE_COMMITS.has(entry.chunkSourceCommit)) {
      errors.push(`${entry.id}: unexpected Chunk Picker commit`);
    } else {
      referencedChunkSourceCommits.add(entry.chunkSourceCommit);
    }
    if (JSON.stringify(entry.source) !== JSON.stringify(officialById.get(entry.id)?.source)) {
      errors.push(`${entry.id}: source differs between official list and audit`);
    }
  }
  if (Array.isArray(declaredChunkSourceCommits)
    && declaredChunkSourceCommits.every(commit => typeof commit === 'string' && commit)
    && !matchingCommitSets(declaredChunkSourceCommits, referencedChunkSourceCommits)) {
    errors.push('refresh audit chunkSourceCommits must exactly match entry Chunk Picker commits');
  }
  if (errors.length) {
    throw new Error(`Existing quest source snapshot validation failed:\n${errors.map(error => `  - ${error}`).join('\n')}`);
  }
}

function assertSnapshots(official, audit) {
  const errors = [];
  if (official?.schemaVersion !== 1) errors.push('quest-list schemaVersion must be 1');
  if (audit?.schemaVersion !== 2) errors.push('quest-requirement-audit schemaVersion must be 2');
  if (!Array.isArray(official?.entries)) errors.push('quest-list entries must be an array');
  if (!Array.isArray(audit?.entries)) errors.push('quest-requirement-audit entries must be an array');
  if (!Array.isArray(audit?.chunkSourceCommits)
    || !audit.chunkSourceCommits.every(commit => typeof commit === 'string' && commit)) {
    errors.push('quest-requirement-audit chunkSourceCommits must be a non-empty string array');
  }
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
  if (questCount !== RUNTIME_QUEST_COUNT
    || miniquestCount !== RUNTIME_MINIQUEST_COUNT
    || official.entries.length !== RUNTIME_QUEST_COUNT + RUNTIME_MINIQUEST_COUNT) {
    errors.push(`reviewed baseline must be ${RUNTIME_QUEST_COUNT} quests and ${RUNTIME_MINIQUEST_COUNT} miniquests; found ${questCount}/${miniquestCount}`);
  }
  if (official.parsedCounts?.quests !== OFFICIAL_PARSED_QUEST_COUNT
    || official.parsedCounts?.miniquests !== RUNTIME_MINIQUEST_COUNT) {
    errors.push(`official parsed baseline must be ${OFFICIAL_PARSED_QUEST_COUNT} quests and ${RUNTIME_MINIQUEST_COUNT} miniquests; found ${official.parsedCounts?.quests}/${official.parsedCounts?.miniquests}`);
  }

  const officialById = new Map(official.entries.map(entry => [entry.id, entry]));
  const referencedChunkSourceCommits = new Set();
  for (const entry of official.entries) {
    const sourceError = stableSourceError(entry.source);
    if (sourceError) errors.push(`${entry.id} official source: ${sourceError}`);
  }
  for (const entry of audit.entries) {
    const sourceError = stableSourceError(entry.source);
    if (sourceError) errors.push(`${entry.id} audit source: ${sourceError}`);
    if (!APPROVED_CHUNK_SOURCE_COMMITS.has(entry.chunkSourceCommit)) {
      errors.push(`${entry.id}: unexpected Chunk Picker commit`);
    } else {
      referencedChunkSourceCommits.add(entry.chunkSourceCommit);
    }
    if (entry.status === 'unresolved') {
      if (!entry.discrepancy?.trim() || !entry.conservativeReason?.trim()) {
        errors.push(`${entry.id}: unresolved entries require discrepancy and conservativeReason`);
      } else {
        if (GENERIC_DISCREPANCY.test(entry.discrepancy)) {
          errors.push(`${entry.id}: unresolved discrepancy is a generic procedural placeholder`);
        }
        if (!/premature completion\/key-roll eligibility/i.test(entry.conservativeReason)) {
          errors.push(`${entry.id}: conservativeReason lacks the completion/key-roll integrity consequence`);
        }
      }
    }
    if (JSON.stringify(entry.source) !== JSON.stringify(officialById.get(entry.id)?.source)) {
      errors.push(`${entry.id}: source differs between official list and audit`);
    }
  }
  if (!matchingCommitSets(audit.chunkSourceCommits, referencedChunkSourceCommits)) {
    errors.push('audit chunkSourceCommits must exactly match entry Chunk Picker commits');
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

function bracketed(values) {
  return `[${values.length ? values.join(', ') : 'none'}]`;
}

function runtimeLocationSummary(quest) {
  return bracketed((quest.locations ?? []).map(location => {
    const chunks = location.chunkOptions.map(chunk => `${chunk.cx},${chunk.cy}`);
    return `${location.label} (standard areas ${bracketed(location.standardAreas)}; chunks ${bracketed(chunks)})`;
  }));
}

function chunkEvidenceSummary(chunkEvidence) {
  const summarize = role => bracketed(
    chunkEvidence
      .filter(row => row.role === role)
      .map(row => `${row.place} (chunk ${row.chunkId})`),
  );
  return `first places ${summarize('first')} and step places ${summarize('step')}`;
}

function retainedRequirementSummary(quest) {
  const requirements = [
    `regions ${bracketed(quest.regions)}`,
    `exact locations ${runtimeLocationSummary(quest)}`,
    `skills ${bracketed(Object.entries(quest.skills).map(([skill, level]) => `${skill} ${level}`))}`,
    `prerequisites ${bracketed(quest.prereqs)}`,
  ];
  if (quest.combatLevel !== undefined) requirements.push(`combat level ${quest.combatLevel}`);
  if (quest.manualRequirements?.length) {
    requirements.push(`manual requirements ${bracketed(quest.manualRequirements)}`);
  }
  return requirements.join('; ');
}

function unresolvedReviewText(quest, chunkEvidence) {
  const policy = `${quest.accessPolicy} policy`;
  const regions = `runtime regions ${bracketed(quest.regions)}`;
  const evidence = chunkEvidenceSummary(chunkEvidence);
  let discrepancy;

  if (quest.locations?.length) {
    discrepancy = `${quest.id} uses the ${policy} with exact runtime locations ${runtimeLocationSummary(quest)} and ${regions}. The pinned Chunk Picker records ${evidence}, but those activity markers do not establish whether the stable Wiki route's unavoidable travel and instance steps are all covered by the exact runtime location mapping.`;
  } else if (!chunkEvidence.length) {
    discrepancy = `${quest.id} uses the ${policy} with ${regions}, but there is no pinned Chunk Picker first/step activity chunk for this ID. The stable Wiki route therefore has no chunk evidence to corroborate whether the retained runtime geography covers every unavoidable quest step.`;
  } else if (quest.manualRequirements?.length) {
    discrepancy = `${quest.id} uses the ${policy} with ${regions} and manual requirement ${bracketed(quest.manualRequirements)}. The pinned Chunk Picker records ${evidence}, but activity chunks cannot represent that manual task-state requirement or show how it interacts with the stable Wiki route.`;
  } else if (quest.prereqs.length) {
    discrepancy = `${quest.id} uses the ${policy} with ${regions} and prerequisite ${bracketed(quest.prereqs)}. The pinned Chunk Picker records ${evidence}, but activity markers cannot establish prerequisite completion or whether prerequisite geography omitted from those markers is unavoidable in the stable Wiki route.`;
  } else {
    discrepancy = `${quest.id} uses the ${policy} with ${regions}, while the pinned Chunk Picker records ${evidence}. Those named activity markers do not prove that every coarse runtime region is unavoidable and may omit travel, instance, or item-source steps from the stable Wiki route.`;
  }

  const conservativeReason = `Keeping ${quest.id}'s current ${policy} requirements (${retainedRequirementSummary(quest)}) prevents this unresolved source gap from allowing premature completion/key-roll eligibility. Weakening those retained requirements before the permanent Wiki route and Chunk Picker evidence agree could permanently record completion and key access without satisfying conditions the runtime currently enforces.`;
  return { discrepancy, conservativeReason };
}

async function refresh() {
  const existingOfficial = readJson(OFFICIAL_PATH, 'existing quest-list snapshot');
  const existingAudit = readJson(AUDIT_PATH, 'existing quest-requirement-audit snapshot');
  assertExistingSnapshotsForRefresh(existingOfficial, existingAudit);

  const runtime = readRuntimeQuestData();
  const quests = Object.values(runtime);
  const existingOfficialById = new Map(existingOfficial.entries.map(entry => [entry.id, entry]));
  const existingAuditById = new Map(existingAudit.entries.map(entry => [entry.id, entry]));
  const preservedById = new Map();
  for (const quest of quests) {
    const previousAudit = existingAuditById.get(quest.id);
    if (!previousAudit || previousAudit.requirementFingerprint !== questRequirementFingerprint(quest)) continue;
    const previousOfficial = existingOfficialById.get(quest.id);
    if (!previousOfficial
      || JSON.stringify(previousOfficial.source) !== JSON.stringify(previousAudit.source)) {
      throw new Error(`cannot preserve ${quest.id}: its prior official and audit sources disagree`);
    }
    preservedById.set(quest.id, { official: previousOfficial, audit: previousAudit });
  }
  const newOrChangedQuests = quests.filter(quest => !preservedById.has(quest.id));

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
  const requestedPageTitles = newOrChangedQuests.map(quest => WIKI_PAGE_TITLES[quest.id] ?? quest.id);
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
      const preserved = preservedById.get(quest.id);
      if (preserved) return preserved.official;
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
        ? `The live official rows differ from the approved normalized ${RUNTIME_QUEST_COUNT}/${RUNTIME_MINIQUEST_COUNT} runtime baseline; membership remains pinned pending a reviewed reconciliation.`
        : `The live official rows reconcile with the approved normalized ${RUNTIME_QUEST_COUNT}/${RUNTIME_MINIQUEST_COUNT} baseline (Recipe for Disaster remains expanded into its existing parent-step IDs).`,
    },
    entries,
  };
  const auditEntries = quests
    .map(quest => {
      const preserved = preservedById.get(quest.id);
      if (preserved) return preserved.audit;
      const sourceEntry = entries.find(entry => entry.id === quest.id);
      const questEvidence = evidence.get(quest.id);
      const review = unresolvedReviewText(quest, questEvidence);
      return {
        id: quest.id,
        kind: quest.kind,
        status: 'unresolved',
        reviewedAt: REVIEWED_AT,
        source: sourceEntry.source,
        chunkSourceCommit: CURRENT_CHUNK_SOURCE_COMMIT,
        accessPolicy: quest.accessPolicy,
        requirementFingerprint: questRequirementFingerprint(quest),
        chunkEvidence: questEvidence,
        notes: {
          items: [],
          travel: [],
          instances: [],
          partialCompletion: [],
        },
        discrepancy: review.discrepancy,
        conservativeReason: review.conservativeReason,
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
  const referencedChunkSourceCommits = new Set(
    auditEntries.map(entry => entry.chunkSourceCommit),
  );
  const audit = {
    schemaVersion: 2,
    reviewedAt: REVIEWED_AT,
    chunkSourceCommits: [...APPROVED_CHUNK_SOURCE_COMMITS]
      .filter(commit => referencedChunkSourceCommits.has(commit)),
    entries: auditEntries,
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
