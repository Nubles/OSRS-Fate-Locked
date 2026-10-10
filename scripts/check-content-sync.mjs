// Content-freshness DETECTOR for the data types that (unlike the collection log)
// have no clean machine-readable wiki source and need human curation when they
// change: quests, combat achievements, achievement diaries.
//
// It records the wiki's own authoritative numbers next to the app's, in a
// committed report (docs/SYNC_STATUS.md). Because the report is deterministic,
// git only shows a diff when something actually changed upstream — so the weekly
// workflow turns "Jagex released a new quest/CA" into a reviewable PR. A human
// then curates the real entry (skill reqs, prereqs, tier, etc.).
//
// Robust signals (no fragile scraping):
//   • Quests — the wiki's {{Globals|quests}} count variables (rendered via API).
//   • Combat Achievements — per-tier `data-ca-task-id` rows on each tier page.
//   • Quest names — the live Quests/List rows against data/questData.ts, so the
//     report names a new quest or miniquest instead of only counting it.
//   • Chunk Picker — whether the upstream branch has moved past the reviewed pin
//     (map/chunk content changes arrive there).
//   • Diaries — no clean wiki marker, so the app side is self-audited (diary
//     content changes extremely rarely; new tasks are flagged on manual review).
//
// Run:  npm run content:check    (also part of `npm run content:sync`)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { questListDrift } from './sync-quest-sources.mjs';
import { checkChunkSourceDrift } from './chunk-source.mjs';

const API = 'https://oldschool.runescape.wiki/api.php';
const UA = { 'Api-User-Agent': 'FateLockedUIM/1.0 (content-sync detector)' };
const CA_TIERS = ['Easy', 'Medium', 'Hard', 'Elite', 'Master', 'Grandmaster'];

// ---------- wiki fetch helpers --------------------------------------------
async function api(params) {
  const url = `${API}?${new URLSearchParams({ ...params, format: 'json', origin: '*' })}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: UA });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(timer); }
}

async function wikiQuestCounts() {
  const j = await api({ action: 'parse', contentmodel: 'wikitext', prop: 'text',
    text: '{{Globals|quests}}|{{Globals|quests p2p}}|{{Globals|quests f2p}}|{{Globals|quest points}}' });
  const nums = j.parse.text['*'].replace(/<[^>]+>/g, '').trim().split('|').map(x => parseInt(x.replace(/[^\d]/g, ''), 10));
  if (nums.some(isNaN)) throw new Error('could not parse quest globals');
  return { total: nums[0], p2p: nums[1], f2p: nums[2], questPoints: nums[3] };
}

async function wikiCaCounts() {
  const out = {};
  for (const tier of CA_TIERS) {
    const j = await api({ action: 'parse', page: `Combat Achievements/${tier}`, prop: 'text' });
    out[tier] = (j.parse.text['*'].match(/data-ca-task-id="/g) || []).length;
  }
  return out;
}

// Every Combat Achievement row on the six tier pages, so a curator can add new
// tasks to data/sources/combat-achievement-tasks.json from exact Wiki text.
// Written only when the counts drift (docs/sync-evidence/, never shipped).
const cellText = (html) => html.replace(/<[^>]+>/g, '').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
async function wikiCaTasks() {
  const tasks = [];
  for (const tier of CA_TIERS) {
    const j = await api({ action: 'parse', page: `Combat Achievements/${tier}`, prop: 'text' });
    for (const row of j.parse.text['*'].matchAll(/<tr\b[^>]*data-ca-task-id="(\d+)"[^>]*>([\s\S]*?)<\/tr>/g)) {
      const cells = [...row[2].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(cell => cellText(cell[1]));
      tasks.push({ wikiTaskId: Number(row[1]), tier, cells });
    }
  }
  return tasks;
}

// Rows on the Wiki's all-achievements Diary table (the source of
// data/sources/achievement-diary-tasks.json), for a drift count.
async function wikiDiaryRowCount() {
  const j = await api({ action: 'parse', page: 'Achievement Diary/All achievements', prop: 'text' });
  let rows = 0;
  for (const table of j.parse.text['*'].matchAll(/<table\b[^>]*wikitable[^>]*>([\s\S]*?)<\/table>/g)) {
    rows += [...table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].filter(row => /<td\b/.test(row[1])).length;
  }
  if (!rows) throw new Error('no diary rows found');
  return rows;
}

// What moved upstream since the Chunk Picker pin: whether the pinned export
// file itself changed (the only file the tracker reads) and the commit titles.
async function chunkSourceChanges({ pinnedCommit, latestCommit }) {
  const manifest = JSON.parse(read('sources/chunk-content-source.json'));
  const gh = async (path) => {
    const res = await fetch(`https://api.github.com/repos/${manifest.repository}/${path}`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'OSRS-Fate-Locked content check' },
    });
    if (!res.ok) throw new Error(`GitHub ${path}: HTTP ${res.status}`);
    return res.json();
  };
  const file = await gh(`contents/${manifest.exportPath}?ref=${latestCommit}`);
  const compare = await gh(`compare/${pinnedCommit}...${latestCommit}`);
  return {
    exportChanged: file.sha !== manifest.blobSha,
    commitLines: (compare.commits ?? []).map(c => `${c.sha.slice(0, 7)} ${c.commit.committer?.date?.slice(0, 10) ?? ''} ${c.commit.message.split('\n')[0]}`).slice(-40),
  };
}

// ---------- app-side counts (parse the data files) ------------------------
const read = (f) => readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8');

function appQuestCount() {
  const src = read('questData.ts');
  return { entries: (src.match(/^\s*id: '(?:[^'\\]|\\.)*', name:/gm) || []).length,
    official: (src.match(/kind: 'quest'/g) || []).length - 9 }; // ten RFD stages represent one official quest
}
function appCaCounts() {
  const src = read('caTasks.ts');
  const out = Object.fromEntries(CA_TIERS.map(t => [t, 0]));
  for (const m of src.matchAll(/tierId: '([^']+)'/g)) if (out[m[1]] !== undefined) out[m[1]]++;
  return out;
}
function appDiaryCounts() {
  const src = read('diaryTasks.ts');
  const byTier = {};
  for (const m of src.matchAll(/tierId: '([^']+)'/g)) byTier[m[1]] = (byTier[m[1]] || 0) + 1;
  return byTier;
}

// ---------- pure report builder (deterministic; unit-tested) --------------
export function buildReport({ quests, cas, diaries, questNames, chunkSource }) {
  const lines = [];
  const actions = [];
  const unavailable = [];
  lines.push('# Content sync status', '');
  lines.push('> Auto-generated by `npm run content:check`. Tracks the wiki\'s authoritative');
  lines.push('> numbers against the app. A change here in a PR means upstream content moved —');
  lines.push('> curate the matching data file (see docs/CONTENT_SYNC.md). **Do not hand-edit.**', '');

  // Quests
  lines.push('## Quests', '');
  if (quests.wiki) {
    lines.push(`- Wiki: **${quests.wiki.total}** quests (${quests.wiki.p2p} members + ${quests.wiki.f2p} F2P), ${quests.wiki.questPoints} quest points.`);
    lines.push(`- App: **${quests.app}** quest entries (includes miniquests / sub-quests, so a higher number is expected).`);
    if (!Number.isFinite(quests.official)) unavailable.push('Comparable official quest baseline unavailable');
    else if (quests.official !== quests.wiki.total) actions.push(`Quests: wiki ${quests.wiki.total}, app ${quests.official} official quests — reconcile newly released or missing quests.`);
    lines.push('- Watch the wiki total: an increase means a new quest was released — add it to `data/questData.ts`.');
  } else {
    lines.push(`- App: **${quests.app}** quest entries. (Wiki count unavailable this run.)`);
    unavailable.push('Quest Wiki counts unavailable; retry the content check');
  }
  lines.push('');

  if (questNames !== undefined) {
    lines.push('### Quest list by name', '');
    if (questNames) {
      if (!questNames.liveOnly.length && !questNames.runtimeMissing.length) {
        lines.push('- Every quest and miniquest on the Wiki\'s Quests/List is in the app, and the app has none the list lacks.');
      }
      for (const row of questNames.liveOnly) {
        lines.push(`- New on the Wiki: **${row.pageTitle}** (${row.kind}).`);
        actions.push(`Quests: "${row.pageTitle}" (${row.kind}) is on the Wiki's Quests/List but not in data/questData.ts — add it with its requirements.`);
      }
      for (const id of questNames.runtimeMissing) {
        lines.push(`- In the app but not on the Wiki list: **${id}**.`);
        actions.push(`Quests: "${id}" is in data/questData.ts but no longer on the Wiki's Quests/List — check for a rename or removal.`);
      }
    } else {
      lines.push('- (Quest list unavailable this run.)');
      unavailable.push('Quest list by name unavailable; retry the content check');
    }
    lines.push('');
  }

  // Combat Achievements
  lines.push('## Combat Achievements', '');
  if (cas.wiki) {
    lines.push('| Tier | Wiki | App | Δ |', '| --- | --- | --- | --- |');
    let wikiTotal = 0, appTotal = 0;
    for (const tier of CA_TIERS) {
      const w = cas.wiki[tier] ?? 0, a = cas.app[tier] ?? 0;
      wikiTotal += w; appTotal += a;
      const d = a - w;
      lines.push(`| ${tier} | ${w} | ${a} | ${d === 0 ? '—' : (d > 0 ? '+' : '') + d} |`);
      if (d !== 0) actions.push(`Combat Achievements · ${tier}: wiki ${w}, app ${a} (${d > 0 ? 'app ahead' : 'app behind — new tasks to add'}).`);
    }
    lines.push(`| **Total** | **${wikiTotal}** | **${appTotal}** | ${appTotal - wikiTotal === 0 ? '—' : appTotal - wikiTotal} |`);
  } else {
    lines.push('| Tier | App |', '| --- | --- |');
    for (const tier of CA_TIERS) lines.push(`| ${tier} | ${cas.app[tier] ?? 0} |`);
    lines.push('', '_(Wiki counts unavailable this run.)_');
    unavailable.push('Combat Achievement Wiki counts unavailable; retry the content check');
  }
  lines.push('');

  // Diaries (app self-audit)
  lines.push('## Achievement Diaries', '');
  lines.push('_Diary tasks have no clean machine-readable wiki marker, and change very rarely._');
  lines.push('_App-side counts are tracked here so accidental data loss shows up; genuinely new_');
  lines.push('_diary content is flagged on manual review._', '');
  const diaryTotal = Object.values(diaries.app).reduce((a, b) => a + b, 0);
  lines.push(`- App: **${diaryTotal}** diary tasks across **${Object.keys(diaries.app).length}** region/tier groups.`);
  if (diaries.wiki !== undefined) {
    if (Number.isFinite(diaries.wiki)) {
      lines.push(`- Wiki (Achievement Diary/All achievements): **${diaries.wiki}** task rows.`);
      if (diaries.wiki !== diaryTotal) actions.push(`Achievement Diaries: wiki ${diaries.wiki} task rows, app ${diaryTotal} — refresh data/sources/achievement-diary-tasks.json and run npm run diary:sync.`);
    } else {
      lines.push('- (Wiki diary rows unavailable this run.)');
      unavailable.push('Achievement Diary Wiki rows unavailable; retry the content check');
    }
  }
  lines.push('');

  if (chunkSource !== undefined) {
    lines.push('## Map and chunk content', '');
    if (chunkSource) {
      const exportChanged = chunkSource.moved && chunkSource.exportChanged !== false;
      lines.push(!chunkSource.moved
        ? '- The Chunk Picker source has not moved since the reviewed pin.'
        : exportChanged
          ? '- The Chunk Picker export the tracker reads has changed since the reviewed pin in `data/sources/chunk-content-source.json`. Review it for new areas, shops, monsters or quest locations, then re-pin (see docs/CONTENT_SYNC.md).'
          : '- The Chunk Picker source has new commits, but the export the tracker reads is unchanged.');
      if (exportChanged) actions.push('Chunk Picker: the export has changed since the reviewed pin — review it for map or chunk content changes and re-pin.');
    } else {
      lines.push('- (Chunk Picker check unavailable this run.)');
      unavailable.push('Chunk Picker drift check unavailable; retry the content check');
    }
    lines.push('');
  }

  // Action summary
  lines.push('## Action needed', '');
  lines.push([...actions, ...unavailable].length ? [...actions, ...unavailable].map(a => `- ⚠️ ${a}`).join('\n') : '- ✅ Nothing — all tracked counts are consistent.');
  lines.push('');

  return { markdown: lines.join('\n'), actions, status: unavailable.length ? 'UNKNOWN' : actions.length ? 'DRIFT' : 'CURRENT' };
}

// ---------- main ----------------------------------------------------------
async function main() {
  const counts = appQuestCount();
  const quests = { app: counts.entries, official: counts.official, wiki: null };
  const cas = { app: appCaCounts(), wiki: null };
  const diaries = { app: appDiaryCounts() };

  try { quests.wiki = await wikiQuestCounts(); } catch (e) { console.warn('[content:check] quest counts failed:', e.message); }
  try { cas.wiki = await wikiCaCounts(); } catch (e) { console.warn('[content:check] CA counts failed:', e.message); }
  try { diaries.wiki = await wikiDiaryRowCount(); } catch (e) { diaries.wiki = null; console.warn('[content:check] diary rows failed:', e.message); }
  if (cas.wiki && CA_TIERS.some(tier => cas.wiki[tier] !== cas.app[tier])) {
    try {
      const live = await wikiCaTasks();
      mkdirSync(new URL('../docs/sync-evidence/', import.meta.url), { recursive: true });
      writeFileSync(new URL('../docs/sync-evidence/combat-achievements-live.json', import.meta.url), `${JSON.stringify(live, null, 2)}\n`);
      console.log(`[content:check] wrote docs/sync-evidence/combat-achievements-live.json (${live.length} rows)`);
    } catch (e) { console.warn('[content:check] CA rows failed:', e.message); }
  }
  let questNames = null;
  try { questNames = await questListDrift(); } catch (e) { console.warn('[content:check] quest list failed:', e.message); }
  if (questNames) console.log(`[content:check] Quests/List rows: ${questNames.liveCounts.quests} quests, ${questNames.liveCounts.miniquests} miniquests; new ${questNames.liveOnly.length}, missing ${questNames.runtimeMissing.length}`);
  if (Number.isFinite(diaries.wiki)) console.log(`[content:check] diary rows wiki=${diaries.wiki}`);
  let chunkSource = null;
  try { chunkSource = await checkChunkSourceDrift(); } catch (e) { console.warn('[content:check] Chunk Picker check failed:', e.message); }
  if (chunkSource?.moved) {
    try { Object.assign(chunkSource, await chunkSourceChanges(chunkSource)); } catch (e) { console.warn('[content:check] Chunk Picker compare failed:', e.message); }
  }
  if (chunkSource) {
    console.log(`[content:check] Chunk Picker pinned=${chunkSource.pinnedCommit} upstream=${chunkSource.latestCommit} exportChanged=${chunkSource.exportChanged ?? '?'}`);
    for (const line of chunkSource.commitLines ?? []) console.log(`  chunk-picker commit: ${line}`);
  }

  const { markdown, actions, status } = buildReport({ quests, cas, diaries, questNames, chunkSource });
  writeFileSync(new URL('../docs/SYNC_STATUS.md', import.meta.url), markdown);

  console.log('[content:check] wrote docs/SYNC_STATUS.md');
  console.log(`[content:check] quests wiki=${quests.wiki?.total ?? '?'} app=${quests.app}`);
  if (cas.wiki) console.log('[content:check] CA per-tier:', CA_TIERS.map(t => `${t} ${cas.wiki[t]}/${cas.app[t] ?? 0}`).join('  '));
  console.log(actions.length ? `[content:check] ACTION NEEDED:\n  ${actions.join('\n  ')}` : `[content:check] ${status === 'UNKNOWN' ? 'Freshness unknown: one or more sources unavailable.' : 'all counts consistent.'}`);
}

// Run as a script, but stay importable for tests.
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('check-content-sync.mjs')) {
  main().catch(e => { console.error('[content:check] failed:', e.message); process.exit(1); });
}
