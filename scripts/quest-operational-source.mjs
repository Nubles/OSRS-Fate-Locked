import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

/** Read only top-level parameters: nested templates and links may contain pipes. */
export function questDetailFields(source) {
  const match = /\{\{\s*(?:quest|miniquest) details\b/i.exec(source);
  if (!match) return null;
  let depth = 1, links = 0, start = match.index + match[0].length;
  const parts = [];
  for (let index = start; index < source.length - 1; index++) {
    const pair = source.slice(index, index + 2);
    if (pair === '{{') { depth++; index++; }
    else if (pair === '}}') {
      depth--;
      if (!depth) { parts.push(source.slice(start, index)); return Object.fromEntries(parts.map(part => {
        const equal = part.indexOf('=');
        return equal < 0 ? ['', ''] : [part.slice(0, equal).trim().toLowerCase(), part.slice(equal + 1).trim()];
      }).filter(([key]) => key)); }
      index++;
    } else if (pair === '[[') { links++; index++; }
    else if (pair === ']]') { links--; index++; }
    else if (source[index] === '|' && depth === 1 && links === 0) { parts.push(source.slice(start, index)); start = index + 1; }
  }
  return null;
}

export function plainRequirementText(raw) {
  let text = raw.replace(/<!--[\s\S]*?-->/g, '').replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, '').replace(/<ref\b[^>]*\/>/gi, '');
  text = text.split(/(?:^|\n)\s*'{0,3}Recommended\s*:'{0,3}/i)[0];
  text = text.replace(/\{\{Cite\w+\|[^]*?\}\}/g, '');
  text = text.replace(/\{\{Coins\|\{\{GEP\|([^}]+)\}\}\}\}/gi, 'current market price of $1');
  text = text.replace(/\[\[(?:File|Image):[^\]]+\]\]/gi, '')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\{\{(?:NoCoins|Coins)\|([\d,]+)(?:\|[^}]*)?\}\}/gi, '$1 coins')
    .replace(/\{\{(?:plink|plinkt|plinkp)\|([^|}]+)(?:\|[^}]*)?\}\}/gi, '$1')
    .replace(/\{\{SCP\|([^|}]+)\|([^|}]+)(?:\|[^}]*)?\}\}/gi, '$2 $1')
    .replace(/\{\{SCP\|([^|}]+)\}\}/gi, '$1')
    .replace(/\{\{Boostable\|yes\}\}/gi, '(boostable)').replace(/\{\{Boostable\|no\}\}/gi, '(not boostable)')
    .replace(/\{\{Fairycode\|([^}]+)\}\}/gi, 'fairy ring $1')
    .replace(/\{\{(?:sic|fact|clear|br)\}\}/gi, '').replace(/<br\s*\/?>/gi, '; ')
    .replace(/<\/?(?:small|big|sup|sub|span|div|poem|nowiki|includeonly|noinclude)\b[^>]*>/gi, '')
    .replace(/'{2,5}/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  // Unsupported markup stays unparsed instead of generating an attestable empty condition.
  if (/\{\{|\}\}|<[^>]+>|\[https?:|\{\||\|\}/.test(text)) return null;
  return text.trim();
}

export function classifyQuestItems(wikitext) {
  const fields = questDetailFields(wikitext);
  if (!fields || !Object.hasOwn(fields, 'items')) return { status: 'unknown', reason: 'Source has no explicit required-item field', checks: [] };
  const raw = fields.items;
  const plain = plainRequirementText(raw);
  if (plain === null) return { status: 'unknown', reason: 'Required-item field contains unsupported source markup', raw, checks: [] };
  if (!plain || /^none[.!]?$/i.test(plain)) return { status: 'none', raw, checks: [] };
  const groups = [];
  let sectionAvailable = false;
  let sectionOptional = false;
  let hasAvailabilityHeading = false;
  for (const line of plain.split('\n').map(line => line.trim()).filter(Boolean)) {
    if (/^(?:required|items required|mandatory)(?: items)?\s*:?$/i.test(line)) { sectionAvailable = false; sectionOptional = false; continue; }
    if (/^optional(?: items)?\s*:?$/i.test(line)) { sectionOptional = true; continue; }
    if (/^(?:all (?:required )?items (?:are )?)?(?:obtained|obtainable|provided) (?:during|in) (?:the )?quest\s*:?$/i.test(line)) {
      sectionAvailable = true;
      sectionOptional = false;
      hasAvailabilityHeading = true;
      continue;
    }
    // Nested bullets remain with their parent so alternatives and acquisition conditions are not ANDed.
    if (/^\*\s*[^*]/.test(line) || !groups.length) {
      const label = line.replace(/^\*+\s*/, '');
      groups.push({ label, sectionAvailable, ownAvailable: /provided|obtained during|obtainable during|obtained in|obtained on/i.test(label), optional: sectionOptional || /^optional\b/i.test(label) || /\(optional\)[.!]?\s*$/i.test(label) });
    }
    else groups[groups.length - 1].label += '; ' + line.replace(/^\*+\s*/, '');
  }
  const allAvailable = /all (?:required )?items (?:are )?(?:obtained|obtainable|provided) (?:during|in)|(?:none|no items)[^\n]*(?:obtained|obtainable|provided)/i.test(plain);
  const mandatory = groups.filter(({ optional }) => !optional);
  const checks = mandatory.map(({ label, sectionAvailable, ownAvailable }) => ({
    // Runtime labels must retain the scope of an acquisition heading because
    // the compact catalogue intentionally omits source-only supply metadata.
    label: sectionAvailable && !ownAvailable ? `${label} (obtainable during the quest)` : label,
    supply: (!hasAvailabilityHeading && allAvailable) || sectionAvailable || ownAvailable ? 'quest-available' : 'required',
  }));
  return { status: !checks.length ? 'none' : allAvailable && checks.every(check => check.supply === 'quest-available') ? 'quest-provided' : 'required', raw, checks };
}

async function main() {
  const input = process.argv.find(arg => arg.startsWith('--input='))?.slice(8);
  const output = process.argv.find(arg => arg.startsWith('--output='))?.slice(9);
  if (!input || !output) throw new Error('Explicit --input=page-capture.json and --output=review-draft.json required; this creates a review draft, not a source refresh');
  const pages = JSON.parse(await readFile(input, 'utf8'));
  const entries = Object.fromEntries(pages.map(({ id, page }) => {
    const revision = page?.revisions?.[0];
    return [id, { source: revision ? { page: page.title, revisionId: revision.revid, revisionTimestamp: revision.timestamp } : null,
      ...classifyQuestItems(revision?.slots?.main?.content ?? '') }];
  }));
  await writeFile(output, JSON.stringify({ schemaVersion: 1, entries }, null, 2) + '\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
