import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { classifyQuestItems } from './quest-operational-source.mjs';

const normal = value => value.toLowerCase().replace(/\s+/g, ' ').trim();
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const strip = value => value.replace(/RPITEM\d+END/g, '');

/** Links identify source leads, not mandatory items. Only a complete, homogeneous
 * item expression becomes a route; mixed operators and prose remain unreviewed. */
export function compileItemClauses(source, knownItemNames = new Set(), reviews = [], helperIdentities = {}) {
  const entries = {};
  for (const [questId, row] of Object.entries(source.entries)) {
    const links = [];
    const raw = typeof row.raw === 'string' ? row.raw.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (whole, target, display) => {
      if (/^(?:File|Image):/i.test(target)) return whole;
      const name = target.split('#')[0].replace(/_/g, ' ').trim();
      const text = display ?? target;
      const index = links.push({ name, sourceText: text }) - 1;
      return `[[${target}|${text}RPITEM${index}END]]`;
    }) : null;
    const marked = raw === null ? [] : classifyQuestItems(`{{Quest details|items=${raw}}}`).checks;
    entries[questId] = row.checks.map((check, clauseIndex) => {
      const aligned = marked[clauseIndex];
      const matches = marked.filter(item => strip(item.label) === check.label);
      const match = aligned && strip(aligned.label) === check.label ? aligned : matches.length === 1 ? matches[0] : undefined;
      const references = [];
      let expression = match?.label ?? '';
      if (match) {
        for (const marker of match.label.matchAll(/RPITEM(\d+)END/g)) {
          const link = links[Number(marker[1])];
          if (!link || !link.name) continue;
          const before = match.label.slice(0, marker.index - link.sourceText.length);
          const amount = before.match(/(?:^|[;*]\s*|\b(?:and|or)\s+)([1-9]\d*(?:,\d{3})*)\s*(?:(?:unnoted|un-noted|noted)\s+)?$/i);
          const ambiguousQuantity = /\d[\d,]*\s*(?:or|[-–])\s*\d[\d,]*\s*$/i.test(before);
          const quantity = ambiguousQuantity ? null : amount ? Number(amount[1].replaceAll(',', '')) : /(?:^|[;*]\s*|\b(?:and|or)\s+)(?:a |an )$/i.test(before) ? 1 : null;
          const availability = /\bif\b|\bonly\b|\bunless\b/i.test(check.label) ? 'conditional' : check.supply === 'quest-available' ? 'quest-available' : 'required';
          const identityEvidence = helperIdentities[questId]?.[normal(link.name)];
          const kind = knownItemNames.has(normal(link.name)) || identityEvidence ? 'item' : 'reference';
          const index = references.push({ kind, name: link.name, quantity: kind === 'item' && Number.isSafeInteger(quantity) ? quantity : null, availability, sourceText: link.sourceText,
            ...(identityEvidence ? { identityEvidence } : {}) }) - 1;
          expression = expression.replace(new RegExp(`${escape(link.sourceText)}RPITEM${marker[1]}END`), `@${index}`);
        }
      }
      // This recognized qualifier does not change which item is named. The full
      // original clause remains visible and no acquisition permission is implied.
      expression = expression.replace(/\s*\((?:can be )?(?:obtained|obtainable) during (?:the )?quest\)\s*$/i, '').trim();
      expression = expression.replace(/(@\d+)(?:s|es)\b/g, '$1');
      // Number and item remain unchanged by these exact noted-form annotations;
      // the original complete clause still carries the use restriction.
      expression = expression.replace(/\s*\((?:unnoted|un-noted|can be noted)\)\s*$/i, '').replace(/\s+(?:unnoted|un-noted)\s*$/i, '').trim();
      const atom = '(?:(?:[1-9]\\d*(?:,\\d{3})*|a|an)\\s+)?(?:(?:unnoted|un-noted|noted)\\s+)?@(\\d+)';
      const onlyItems = new RegExp(`^${atom}(?:\\s+(?:and|or)\\s+${atom})*$`, 'i').test(expression);
      const hasAnd = /\band\b/i.test(expression), hasOr = /\bor\b/i.test(expression);
      let structure = 'unreviewed', routes = [];
      if (onlyItems && !(hasAnd && hasOr) && references.length && references.every(item => item.kind === 'item')) {
        const indexes = [...expression.matchAll(/@(\d+)/g)].map(match => Number(match[1]));
        if (indexes.every(index => references[index]?.name)) {
          structure = hasOr ? 'choice' : hasAnd ? 'bundle' : 'single';
          routes = structure === 'choice' ? indexes.map((index, routeIndex) => ({ id: `route-${routeIndex}`, label: references[index].sourceText, items: [references[index]] }))
            : [{ id: 'route-0', label: check.label, items: indexes.map(index => references[index]) }];
        }
      }
      const reasons = [];
      if (structure === 'unreviewed') {
        if (!match) reasons.push('The clause has no aligned Wiki-linked item extraction; its authored text needs review.');
        else if (!references.length) reasons.push('The source clause has no explicit Wiki-linked item identity.');
        if (references.some(item => item.kind === 'reference')) reasons.push('Some links describe an item class, action, location or an item whose identity is not established.');
        if (/random|chosen|assigned|combination|depends on/i.test(check.label)) reasons.push('The required supplies depend on a random assignment or player-specific quest state.');
        if (/\bif\b|unless|only|except/i.test(check.label)) reasons.push('Conditional use, excluded variants or route-specific qualifiers must be preserved.');
        if (/\d\s*[-–+]\s*\d*|\d\s+or\s+\d|at least|enough|some\b|about|~/.test(check.label)) reasons.push('The required quantity is variable, approximate or conditional.');
        if (/\bor\b|alternativ|either/i.test(check.label)) reasons.push('The alternatives need whole-route review; linked supplies must not be combined into one checklist.');
        if (/obtain|make|cast|mine|cook|buy|creat|smith|craft|spin|enchant/i.test(check.label)) reasons.push('Acquisition or transformation actions need their own complete ingredients, facilities and permission checks.');
        if (!reasons.length) reasons.push('The source wording extends beyond a complete simple item expression and requires interpretation.');
      }
      reasons.push('Item acquisition, use permissions and source qualifiers remain unverified.');
      return { questId, clauseIndex, label: check.label, structure, routes, references,
        unresolved: reasons,
        source: row.source };
    });
  }
  const reviewed = new Set();
  for (const review of reviews) {
    const entry = entries[review.questId]?.[review.clauseIndex];
    const key = `${review.questId}:${review.clauseIndex}`;
    if (!entry || entry.label !== review.label || entry.source.revisionId !== review.revisionId || reviewed.has(key)) throw new Error(`Stale or duplicate item clause review: ${key}`);
    if (!['single', 'choice', 'bundle'].includes(review.structure) || !review.reason || !review.routes?.length
      || review.routes.some(route => !route.id || !route.label || !route.items?.length || route.items.some(item => item.kind !== 'item' || !item.name
        || (item.quantity !== null && (!Number.isSafeInteger(item.quantity) || item.quantity <= 0))))) throw new Error(`Invalid item clause review: ${key}`);
    reviewed.add(key);
    entry.structure = review.structure;
    entry.routes = review.routes;
    // Reviewed exact identities supplement linked leads, but never change the
    // canonical manual requirement or mark any source acquisition legal.
    entry.references = [...new Map([...entry.references, ...review.routes.flatMap(route => route.items)].map(item => [normal(item.name), item])).values()];
    entry.unresolved = [`${review.reason} Acquisition and use permissions remain unverified.`];
  }
  return { schemaVersion: 1, entries };
}

/** Same-quest, single concrete identities only; never infer a class from the
 * first item in an ItemCollection or merge differently named quest objects. */
export function extractHelperItemIdentities(raw) {
  const helpers = new Map(raw.helperGraphs.map(helper => [helper.helperEnum, helper]));
  return Object.fromEntries(raw.catalog.map(quest => {
    const candidates = new Map();
    for (const mapping of quest.helpers) {
      const helper = helpers.get(mapping.enum);
      for (const node of helper?.nodes ?? []) {
        const fields = node.fields ?? {}, name = fields['ItemRequirement.name'], itemId = fields['ItemRequirement.id'];
        if (!node.type.endsWith('.ItemRequirement') || typeof name !== 'string' || !Number.isSafeInteger(itemId) || itemId < 0
          || fields['ItemRequirement.alternateItems']?.length || fields['ItemRequirement.additionalOptions']) continue;
        const key = normal(name), entries = candidates.get(key) ?? [];
        entries.push({ itemId, revision: raw.helperRevision, sourcePath: mapping.sourcePath, nodeId: node.id });
        candidates.set(key, entries);
      }
    }
    return [quest.id, Object.fromEntries([...candidates].filter(([, entries]) => new Set(entries.map(entry => entry.itemId)).size === 1).map(([name, entries]) => [name, entries[0]]))];
  }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await import('./compile-quest-chunk-instructions.mjs');
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const chunks = JSON.parse(fs.readFileSync(path.join(root, 'public/chunk-content.json'), 'utf8'));
  const knownItemNames = new Set([...Object.values(chunks.shopItems ?? {}).flat(), ...Object.values(chunks.drops ?? {}).flat(),
    ...Object.values(chunks.chunks ?? {}).flatMap(chunk => chunk.i ?? [])].filter(name => typeof name === 'string').map(normal));
  const reviews = JSON.parse(fs.readFileSync(path.join(root, 'data/sources/runeproof-item-clause-reviews.json'), 'utf8')).reviews;
  const helper = JSON.parse(gunzipSync(fs.readFileSync(path.join(root, 'data/sources/runeproof-helper-graph.json.gz'))));
  const result = compileItemClauses(JSON.parse(fs.readFileSync(path.join(root, 'data/sources/quest-operational-items.json'), 'utf8')), knownItemNames, reviews, extractHelperItemIdentities(helper));
  const acquisitions = Object.fromEntries(Object.entries(result.entries).map(([id, rows]) => [id, rows.map(row =>
    row.structure !== 'unreviewed' && row.unresolved.every(note => note === 'Item acquisition, use permissions and source qualifiers remain unverified.')
      && row.routes.length && row.routes.every(route => route.items.length && route.items.every(item => item.kind === 'item' && item.availability !== 'conditional'))
      ? { label: row.label, routes: row.routes.map(route => route.items.map(item => item.name)) } : null)]));
  const acquisitionTarget = path.join(root, 'data/questItemAcquisition.json');
  const acquisitionOutput = JSON.stringify(acquisitions) + '\n';
  if (process.argv.includes('--check')) {
    if (fs.readFileSync(acquisitionTarget, 'utf8') !== acquisitionOutput) throw new Error('Quest item acquisition routes need regeneration');
  } else fs.writeFileSync(acquisitionTarget, acquisitionOutput);
  const target = path.join(root, 'data/runeproofItemClauses.json');
  const output = JSON.stringify(result) + '\n';
  if (process.argv.includes('--check')) {
    if (fs.readFileSync(target, 'utf8') !== output) throw new Error('RuneProof item source interpretations need regeneration.');
  } else fs.writeFileSync(target, output);
  const rows = Object.values(result.entries).flat();
  console.log(JSON.stringify({ quests: Object.keys(result.entries).length, clauses: rows.length, withReferences: rows.filter(row => row.references.length).length,
    structures: Object.fromEntries(['single', 'choice', 'bundle', 'unreviewed'].map(kind => [kind, rows.filter(row => row.structure === kind).length])) }));
}
