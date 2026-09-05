import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

export function activityInventory(text) {
  const source = ts.createSourceFile('activityRequirements.ts', text, ts.ScriptTarget.Latest, true);
  let inventory;
  source.forEachChild(node => {
    if (ts.isVariableStatement(node)) for (const declaration of node.declarationList.declarations) {
      if (declaration.name.getText(source) === 'ACTIVITY_REQUIREMENTS') inventory = declaration.initializer;
    }
  });
  if (!inventory || !ts.isObjectLiteralExpression(inventory)) throw new Error('Activity inventory not found');
  return inventory.properties.map(property => ({ id: property.name.text, text: property.initializer.getText(source) }));
}

export function auditFreshness(manifest, inventory, { now = new Date(), upstream } = {}) {
  const errors = [], flags = [];
  if (manifest.schemaVersion !== 1 || !Number.isInteger(manifest.maxReviewAgeDays) || manifest.maxReviewAgeDays < 1) errors.push('Invalid provenance schema or review interval');
  const entries = manifest.entries ?? {};
  for (const rule of inventory) {
    if (!Object.hasOwn(entries, rule.id)) { errors.push(`Missing provenance: ${rule.id}`); continue; }
    const record = entries[rule.id];
    const flag = reason => flags.push({ activity: rule.id, reason });
    if (!record || !Array.isArray(record.sources) || !Array.isArray(record.reviewRecords)) { errors.push(`Invalid provenance: ${rule.id}`); continue; }
    if (!record.reviewedAt) flag('REVIEW_MISSING');
    else {
      const time = Date.parse(record.reviewedAt);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(record.reviewedAt) || !Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== record.reviewedAt || time > now.getTime()) errors.push(`Invalid review date: ${rule.id}`);
      else if (now.getTime() - time > manifest.maxReviewAgeDays * 86400000) flag('REVIEW_STALE');
    }
    if (!record.sources.length) {
      if (record.unresolved === true && /kind:\s*['"]unknown['"]/.test(rule.text)) flag('ACKNOWLEDGED_UNKNOWN');
      else errors.push(`Missing source mapping: ${rule.id}`);
    }
    for (const source of record.sources) {
      try { const url = new URL(source.url); if (url.protocol !== 'https:' || url.hostname !== 'oldschool.runescape.wiki' || !url.pathname.startsWith('/w/') || /[\s\[\]]/.test(source.url)) throw new Error(); }
      catch { errors.push(`Invalid source URL: ${rule.id}`); continue; }
      if (source.revisionId == null) flag('REVISION_BASELINE_MISSING');
      else if (!/^\d+$/.test(String(source.revisionId))) errors.push(`Invalid revision: ${rule.id}`);
      if (upstream) {
        const current = upstream[source.url];
        if (!current?.revisionId) flag('SOURCE_UNAVAILABLE');
        else if (source.revisionId != null && String(current.revisionId) !== String(source.revisionId)) flag('SOURCE_CHANGED');
        if (current?.timestamp && record.reviewedAt && Date.parse(current.timestamp) > Date.parse(record.reviewedAt + 'T23:59:59Z')) flag('SOURCE_UPDATED_SINCE_REVIEW');
      }
    }
    // This is a guard for wholly unmodeled notes, not a claim that prose can be semantically verified.
    if (/\bnote\s*:/.test(rule.text) && /require|must|need|only|kudos|cape|task|fee/i.test(rule.text)
      && !/\b(predicates|skills|quests|manualRequirements|combatLevel|totalLevel)\s*:/.test(rule.text)
      && !/noteIsInformational\s*:\s*true/.test(rule.text)) errors.push(`Unclassified gate note: ${rule.id}`);
  }
  for (const id of Object.keys(entries)) if (!inventory.some(rule => rule.id === id)) errors.push(`Orphan provenance: ${id}`);
  const actionableFlags = flags.filter(flag => flag.reason !== 'ACKNOWLEDGED_UNKNOWN');
  return { checkedAt: now.toISOString(), errors, flags, actionableFlags, status: errors.length ? 'INVALID' : actionableFlags.length ? 'NEEDS_REVIEW' : 'CURRENT' };
}

export async function fetchRevisions(urls, fetcher = fetch) {
  const result = {};
  // Requests are bounded and sequential; retrieval never updates curated baselines.
  for (let start = 0; start < urls.length; start += 40) {
    const batch = urls.slice(start, start + 40);
    const titles = batch.map(url => decodeURIComponent(new URL(url).pathname.slice(3)).replaceAll('_', ' '));
    const query = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', prop: 'revisions', rvprop: 'ids|timestamp', titles: titles.join('|') });
    try {
      let data;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await fetcher(`https://oldschool.runescape.wiki/api.php?${query}`, { signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'FateLocked-RequirementReview/1.0 (read-only source freshness)' } });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          data = await response.json();
          if (!Array.isArray(data.query?.pages)) throw new Error('Missing page metadata');
          break;
        } catch (error) { if (attempt === 2) throw error; }
      }
      for (let index = 0; index < batch.length; index++) {
        const title = data.query?.normalized?.find(item => item.from === titles[index])?.to ?? titles[index];
        const page = data.query?.pages?.find(item => item.title === title);
        const revision = page?.revisions?.[0];
        result[batch[index]] = revision ? { revisionId: revision.revid, timestamp: revision.timestamp } : { error: 'Missing page or revision' };
      }
    } catch (error) { for (const url of batch) result[url] = { error: String(error) }; }
  }
  return result;
}

async function main() {
  const manifest = JSON.parse(await readFile(new URL('../data/sources/activity-requirement-provenance.json', import.meta.url), 'utf8'));
  const inventory = activityInventory(await readFile(new URL('../data/activityRequirements.ts', import.meta.url), 'utf8'));
  const questItems = JSON.parse(await readFile(new URL('../data/sources/quest-operational-items.json', import.meta.url), 'utf8'));
  for (const [id, record] of Object.entries(questItems.entries)) {
    const key = `Quest: ${id}`;
    inventory.push({ id: key, text: record.status === 'unknown' ? "{ kind: 'unknown' }" : '{}' });
    manifest.entries[key] = {
      reviewedAt: record.status === 'unknown' ? null : questItems.capturedAt,
      sources: record.source ? [{ url: `https://oldschool.runescape.wiki/w/${encodeURIComponent(record.source.page.replaceAll(' ', '_'))}`, revisionId: record.source.revisionId }] : [],
      reviewRecords: ['docs/source-reviews/quest-operational-sources.md'],
    };
  }
  const online = process.argv.includes('--upstream');
  const upstream = online ? await fetchRevisions([...new Set(Object.values(manifest.entries).flatMap(record => record.sources.map(source => source.url)))]) : undefined;
  const report = { ...auditFreshness(manifest, inventory, { upstream }), upstream };
  const output = process.argv.find(arg => arg.startsWith('--output='))?.slice(9);
  if (output) await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(`Requirement provenance: ${inventory.length} activity/quest records; ${report.errors.length} structural errors; ${report.flags.length} review flags (${online ? 'upstream checked' : 'offline; semantic currency not verified'}).`);
  for (const error of report.errors) console.error(error);
  if (report.errors.length || (online && report.actionableFlags.length)) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
