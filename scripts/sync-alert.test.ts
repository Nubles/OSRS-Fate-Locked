import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it, vi } from 'vitest';
// scripts/ is excluded from tsc; vitest still runs this.
import { buildReport } from './check-content-sync.mjs';
import {
  ALERT_ISSUE_TITLE,
  ALERT_LABEL,
  READ_EVERYTHING,
  currentItems,
  issueBody,
  itemsFromBody,
  latestAlert,
  newsKey,
  parseReport,
  parseStatus,
  planAlert,
  run,
  tidy,
  utcDay,
} from './sync-alert.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const SCRIPT = resolve(HERE, 'sync-alert.mjs');
const NOW = Date.UTC(2026, 10, 26, 5, 20);
const DATE = '2026-11-26';

const QUEST = 'Quests: "The Graveyard" (quest) is on the Wiki\'s Quests/List but not in data/questData.ts — add it with its requirements.';
const CA = 'Combat Achievements · Easy: wiki 42, app 41 (app behind — new tasks to add).';
const questCount = (wiki: number, app: number) => `Quests: wiki ${wiki}, app ${app} official quests — reconcile newly released or missing quests.`;
// What the check writes about the Chunk Picker, and what the issue lists: the
// same words plus the pin the tracker last reviewed.
const CHUNK_ACTION = 'Chunk Picker: the export has changed since the reviewed pin — review it for map or chunk content changes and re-pin.';
const PIN = '629e9fee6183773e8df26d7e4bc5db792290ce0b';
const NEXT_PIN = 'e66ebe5ab98211d1bcce94e47213dff9e915fabd';
const UPSTREAM = '0f3c1d2e4b5a69788796a5b4c3d2e1f00f1e2d3c';
const chunksAt = (pin: string) => `${CHUNK_ACTION} Reviewed pin: ${pin.slice(0, 7)}.`;
const CHUNKS = chunksAt(PIN);
const QUESTS_DOWN = 'Quest Wiki counts unavailable; retry the content check';
const CHUNKS_DOWN = 'Chunk Picker drift check unavailable; retry the content check';
const CLOG_DONE = '[clog:sync] renames 0, items added 0, kept-without-wiki-match 0';

/** The line the check prints about the Chunk Picker. It compares the export only when the source has moved. */
const chunkLine = (pin: string, changed: 'true' | 'false' | '?', upstream = UPSTREAM) =>
  `[content:check] Chunk Picker pinned=${pin} upstream=${upstream} exportChanged=${changed}`;

/** docs/SYNC_STATUS.md with these lines under "Action needed", in the shape check-content-sync.mjs writes. */
const statusWith = (lines: string[]) => [
  '# Content sync status',
  '',
  '## Quests',
  '',
  '- App: **217** quest entries.',
  '',
  '## Action needed',
  '',
  lines.length ? lines.map((line) => `- ⚠️ ${line}`).join('\n') : '- ✅ Nothing — all tracked counts are consistent.',
  '',
].join('\n');

interface Report { collectionLog?: string[]; chunkPicker?: string | null; written?: boolean }

/** sync-report.md as the sync job writes it. */
const reportWith = ({ collectionLog = [CLOG_DONE], chunkPicker = chunkLine(PIN, '?', PIN), written = true }: Report = {}) => [
  'Weekly game data check from the OSRS Wiki',
  '',
  'Sync: success. Tests: success.',
  '',
  '## Changed files',
  '-  M docs/SYNC_STATUS.md',
  '',
  '## Collection log',
  ...collectionLog,
  '',
  '## Freshness check',
  '[content:check] Quests/List rows: 201 quests, 19 miniquests; new 2, missing 0',
  ...(chunkPicker ? [chunkPicker, '  chunk-picker commit: e66ebe5 2026-11-17 Updated chunkinfo'] : []),
  // The check prints its quest counts right after it has written the status file.
  written ? '[content:check] quests wiki=191 app=217' : '[content:check] failed: Unexpected token in data/questData.ts',
  '[content:check] ACTION NEEDED:',
  '  ADD    this line is the freshness check\'s, not the collection log\'s',
  '',
  '## Failing tests',
  ' FAIL  data/collectionLog.test.ts > audited counts',
  '',
].join('\n');

const folders: string[] = [];
afterAll(() => { for (const folder of folders) rmSync(folder, { recursive: true, force: true }); });

interface Week extends Report { pin?: string; outcome?: string; pushed?: boolean }

/** A folder like the one the alert job downloads: the status and the report of one week. */
function week(actions: string[], { collectionLog, chunkPicker, written, pin = PIN, outcome = 'success', pushed = true }: Week = {}) {
  const folder = mkdtempSync(join(tmpdir(), 'sync-alert-'));
  folders.push(folder);
  mkdirSync(join(folder, 'docs'));
  writeFileSync(join(folder, 'docs', 'SYNC_STATUS.md'), statusWith(actions));
  // Like the check: no line when it could not reach the Chunk Picker at all,
  // a compared export when the source has moved, and nothing to compare when
  // it has not.
  const printed = chunkPicker !== undefined ? chunkPicker
    : actions.includes(CHUNKS_DOWN) ? null
      : actions.includes(CHUNK_ACTION) ? chunkLine(pin, 'true') : chunkLine(pin, '?', pin);
  writeFileSync(join(folder, 'sync-report.md'), reportWith({ collectionLog, chunkPicker: printed, written }));
  return {
    GITHUB_TOKEN: 'issue-token',
    GITHUB_REPOSITORY: 'owner/tracker',
    GITHUB_REPOSITORY_OWNER: 'owner',
    GITHUB_SERVER_URL: 'https://github.com',
    GITHUB_RUN_ID: '4711',
    ALERT_REPORT_DIR: folder,
    ALERT_SYNC_OUTCOME: outcome,
    ALERT_BRANCH_PUSHED: String(pushed),
  };
}

interface Issue { number: number; state: string; title?: string; body: string | null; labels?: { name: string }[]; assignees?: { login: string }[]; pull_request?: unknown }
interface Call { method: string; path: string; body?: Record<string, unknown>; headers?: Record<string, string>; url: string }

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/**
 * A GitHub that keeps its issues between runs, so several weeks can be played
 * against it. `assignable` is its answer to "can the owner be assigned": 204
 * yes, 404 no, anything else a failure. It can be changed between runs.
 */
function fakeGitHub({ issues = [] as Issue[], assignable = 204, dropLabels = false, dropAssignees = false } = {}) {
  const labels = new Set<string>();
  const github = {
    calls: [] as Call[],
    comments: [] as { number: number; body: string }[],
    issues,
    assignable,
    writes: () => github.calls.filter((call) => call.method !== 'GET').map((call) => `${call.method} ${call.path}`),
    fetchFn: vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const path = url.replace('https://api.github.com/repos/owner/tracker', '');
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      github.calls.push({ method, path, body, headers: init?.headers as Record<string, string>, url });
      const one = path.match(/^\/issues\/(\d+)(\/comments)?$/);
      const issue = one ? issues.find((candidate) => candidate.number === Number(one[1])) : undefined;
      if (method === 'GET' && path === `/issues?labels=${ALERT_LABEL}&state=all&per_page=50`) {
        return reply(issues.filter((candidate) => candidate.labels?.some((label) => label.name === ALERT_LABEL)));
      }
      if (method === 'GET' && path === `/labels/${ALERT_LABEL}`) return labels.has(ALERT_LABEL) ? reply({ name: ALERT_LABEL }) : reply({}, 404);
      if (method === 'POST' && path === '/labels') { labels.add(body.name); return reply(body, 201); }
      if (method === 'GET' && path === '/assignees/owner') {
        return github.assignable === 204 || github.assignable === 404
          ? new Response(null, { status: github.assignable })
          : reply({ message: 'Server Error' }, github.assignable);
      }
      if (method === 'POST' && path === '/issues') {
        const created: Issue = {
          number: Math.max(0, ...issues.map((candidate) => candidate.number)) + 1,
          state: 'open',
          title: body.title,
          body: body.body,
          labels: dropLabels ? [] : body.labels.map((name: string) => ({ name })),
          assignees: dropAssignees ? [] : body.assignees.map((login: string) => ({ login })),
        };
        issues.push(created);
        return reply(created, 201);
      }
      if (method === 'POST' && issue && one?.[2]) { github.comments.push({ number: issue.number, body: body.body }); return reply({}, 201); }
      if (method === 'PATCH' && issue && !one?.[2]) { Object.assign(issue, body); return reply(issue); }
      return reply({ message: 'Not Found' }, 404);
    }),
  };
  return github;
}

const quiet = () => vi.fn();
const ourIssue = (number: number, state: string, items: string[]): Issue => ({
  number, state, title: ALERT_ISSUE_TITLE, body: issueBody({ items, date: '2026-11-19' }), labels: [{ name: ALERT_LABEL }],
});
const unread = (...parts: string[]) => ({ all: false, parts });
const NOTHING_READ = { all: true, parts: [] as string[] };

describe('reading the weekly check', () => {
  const base = {
    quests: { app: 217, official: 189, appQuestPoints: 349, wiki: { total: 191, p2p: 167, f2p: 24, questPoints: 354 } },
    cas: { app: { Easy: 41 }, wiki: { Easy: 42 } },
    diaries: { app: { 'Ardougne Easy': 10 } },
    questNames: { liveOnly: [{ pageTitle: 'A New Leaf', kind: 'quest' }], runtimeMissing: [] },
    chunkSource: { moved: true, exportChanged: true },
  };

  it('lists exactly the actions the check wrote', () => {
    const { markdown, actions } = buildReport(base);
    expect(actions).toHaveLength(5);
    expect(parseStatus(markdown)).toEqual({ actions: actions.map(tidy), unread: [], unanswered: false });
    expect(parseStatus(markdown).actions).toContain(CHUNK_ACTION);
  });

  it('lists nothing when the check found nothing', () => {
    const { markdown, status } = buildReport({
      quests: { app: 217, official: 191, appQuestPoints: 354, wiki: { total: 191, p2p: 167, f2p: 24, questPoints: 354 } },
      cas: { app: { Easy: 41 }, wiki: { Easy: 41 } },
      diaries: base.diaries,
      questNames: { liveOnly: [], runtimeMissing: [] },
      chunkSource: { moved: false },
    });
    expect(status).toBe('CURRENT');
    expect(parseStatus(markdown)).toEqual({ actions: [], unread: [], unanswered: false });
  });

  it('names the part of the check that could not be read, and never lists it as something to add', () => {
    const none = buildReport({ quests: { app: 217, official: 189, wiki: null }, cas: { app: {}, wiki: null }, diaries: base.diaries, questNames: null, chunkSource: null });
    expect(none.status).toBe('UNKNOWN');
    expect(parseStatus(none.markdown)).toEqual({ actions: [], unread: ['quests', 'combat achievements', 'chunk picker'], unanswered: false });

    const some = buildReport({ ...base, cas: { app: {}, wiki: null } });
    const read = parseStatus(some.markdown);
    expect(read.unread).toEqual(['combat achievements']);
    expect(read.actions).toEqual(some.actions.map(tidy));
    expect(read.actions.join('\n')).not.toMatch(/unavailable/);
  });

  it('can place every note the check writes about a source it could not read', () => {
    // A note this script cannot place would freeze the whole list, so a new
    // note in the check has to be taught here first.
    const check = readFileSync(resolve(HERE, 'check-content-sync.mjs'), 'utf8');
    const notes = [...check.matchAll(/unavailable\.push\('([^']+)'\)/g)].map((match) => match[1]);
    expect(Object.fromEntries(notes.map((note) => [note, parseStatus(statusWith([note]))]))).toEqual({
      'Comparable official quest baseline unavailable': { actions: [], unread: ['quests'], unanswered: false },
      'Quest Wiki counts unavailable; retry the content check': { actions: [], unread: ['quests'], unanswered: false },
      'Quest list by name unavailable; retry the content check': { actions: [], unread: ['quests'], unanswered: false },
      'Combat Achievement Wiki counts unavailable; retry the content check': { actions: [], unread: ['combat achievements'], unanswered: false },
      'Chunk Picker drift check unavailable; retry the content check': { actions: [], unread: ['chunk picker'], unanswered: false },
    });
    expect(parseStatus(statusWith(['Diary Wiki counts unavailable; retry the content check']))).toEqual({ actions: [], unread: [], unanswered: true });
  });

  it('calls a status file without an answer unanswered', () => {
    expect(parseStatus('')).toEqual({ actions: [], unread: [], unanswered: true });
    expect(parseStatus('# Content sync status\n\n## Quests\n')).toEqual({ actions: [], unread: [], unanswered: true });
    expect(parseStatus('## Action needed\n\n')).toEqual({ actions: [], unread: [], unanswered: true });
    expect(parseStatus('## Action needed\r\n\r\n- ✅ Nothing — all tracked counts are consistent.\r\n')).toEqual({ actions: [], unread: [], unanswered: false });
  });

  it('cleans a line with a stray line break instead of dropping it', () => {
    const lineSeparator = String.fromCodePoint(0x2028);
    const status = statusWith([`Quests: "Half${lineSeparator}Moon" (quest)`, 'Quests: "Full\rMoon" (quest)']);
    expect(parseStatus(status).actions).toEqual(['Quests: "Half Moon" (quest)', 'Quests: "Full Moon" (quest)']);
    const report = reportWith({ collectionLog: [CLOG_DONE, `  ADD    [Yama] Oath${lineSeparator}plate helm (#30750)`] });
    expect(parseReport(report).collectionLog).toEqual(['Collection log, new item: [Yama] Oath plate helm']);
  });

  it('reads what the collection log sync found, and nothing from the other sections', () => {
    expect(parseReport(reportWith())).toMatchObject({ collectionLog: [], unread: [] });
    const found = parseReport(reportWith({ collectionLog: [
      '  MOVE   Slayer -> Yama: Oathplate shards (#30765)',
      '[clog:sync] renames 1, items added 2, kept-without-wiki-match 1',
      '  RENAME [Yama] Soulflame horn -> Soulflame Horn',
      '  ADD    [Yama] Oathplate helm (#30750)',
      '  ADD    [Yama] Oathplate chest (#30753)',
      '[clog:sync] WARNING: possible rename(s) needing a manual merge (KEEP + ADD on the same page):',
      '  ? "Yama" — merge the kept item into the added one (keep the OLD id) and add a CLOG_ID_MIGRATIONS entry',
      '[clog:sync] 1 NEW wiki page(s) need a tab + empty stub, then re-run:',
      '  + "Doom of Mokhaiotl" (12 items)',
    ] }));
    expect(found).toMatchObject({
      unread: [],
      collectionLog: [
        'Collection log, moved item: Slayer -> Yama: Oathplate shards',
        'Collection log, rename: [Yama] Soulflame horn -> Soulflame Horn',
        'Collection log, new item: [Yama] Oathplate helm',
        'Collection log, new item: [Yama] Oathplate chest',
        'Collection log, possible rename: "Yama" — merge the kept item into the added one (keep the OLD id) and add a CLOG_ID_MIGRATIONS entry',
        'Collection log, new page: "Doom of Mokhaiotl"',
      ],
    });
  });

  it('calls a collection log sync that did not finish unread', () => {
    expect(parseReport(reportWith({ collectionLog: ['[clog:sync] failed: HTTP 503'] })).unread).toEqual(['collection log']);
    // A sync that printed its totals and then failed did not finish either.
    expect(parseReport(reportWith({ collectionLog: [CLOG_DONE, '[clog:sync] failed: EACCES'] })).unread).toEqual(['collection log']);
    expect(parseReport(reportWith({ collectionLog: ['(no changes)'] })).unread).toEqual(['collection log']);
    expect(parseReport('Weekly game data check from the OSRS Wiki\n').unread).toEqual(['collection log']);
    expect(parseReport('').unread).toEqual(['collection log']);
  });

  it('knows whether the check wrote the status file in this run', () => {
    expect(parseReport(reportWith()).written).toBe(true);
    // The Wiki being down does not stop the check from writing its answer.
    expect(parseReport(reportWith().replace('quests wiki=191 app=217', 'quests wiki=? app=217')).written).toBe(true);
    expect(parseReport(reportWith({ written: false })).written).toBe(false);
    expect(parseReport('').written).toBe(false);
    // Only the check's own line counts, and only in its own section.
    expect(parseReport(reportWith({ written: false, collectionLog: [CLOG_DONE, '  ADD    [content:check] quests wiki=191 app=217'] })).written).toBe(false);
    expect(parseReport(reportWith({ written: false, chunkPicker: '  chunk-picker commit: e66ebe5 2026-11-17 [content:check] quests wiki=191 app=217' })).written).toBe(false);
  });

  it('reads the reviewed pin, and whether the check could compare the export', () => {
    expect(parseReport(reportWith({ chunkPicker: chunkLine(PIN, 'true') })).chunkPicker).toEqual({ pin: '629e9fe', compared: true });
    expect(parseReport(reportWith({ chunkPicker: chunkLine(PIN, 'false') })).chunkPicker).toEqual({ pin: '629e9fe', compared: true });
    expect(parseReport(reportWith({ chunkPicker: chunkLine(PIN, '?') })).chunkPicker).toEqual({ pin: '629e9fe', compared: false });
    expect(parseReport(reportWith({ chunkPicker: null })).chunkPicker).toBeNull();
    expect(parseReport('').chunkPicker).toBeNull();
    // A commit title from the Chunk Picker repository cannot pass for the line.
    expect(parseReport(reportWith({ chunkPicker: `  chunk-picker commit: e66ebe5 2026-11-17 ${chunkLine(NEXT_PIN, 'true')}` })).chunkPicker).toBeNull();
    expect(parseReport(reportWith({ chunkPicker: `  chunk-picker commit: e66ebe5 2026-11-17 x\r${chunkLine(NEXT_PIN, 'true')}` })).chunkPicker).toBeNull();
  });

  it('still gets from the two sync scripts the lines it reads', () => {
    const check = readFileSync(resolve(HERE, 'check-content-sync.mjs'), 'utf8');
    const wroteStatus = check.indexOf("writeFileSync(new URL('../docs/SYNC_STATUS.md', import.meta.url), markdown);");
    const questCounts = check.indexOf("console.log(`[content:check] quests wiki=${quests.wiki?.total ?? '?'} app=${quests.app}`);");
    expect(wroteStatus).toBeGreaterThan(0);
    // Printed after the status file is written, and by nothing before it.
    expect(questCounts).toBeGreaterThan(wroteStatus);
    expect(check.match(/\[content:check\] quests wiki=/g)).toHaveLength(1);
    expect(check).toContain("console.log(`[content:check] Chunk Picker pinned=${chunkSource.pinnedCommit} upstream=${chunkSource.latestCommit} exportChanged=${chunkSource.exportChanged ?? '?'}`);");
    expect(check).toContain("lines.push([...actions, ...unavailable].length ? [...actions, ...unavailable].map(a => `- ⚠️ ${a}`).join('\\n') : '- ✅ Nothing — all tracked counts are consistent.');");

    const collectionLog = readFileSync(resolve(HERE, 'sync-collection-log.mjs'), 'utf8');
    expect(collectionLog).toContain('console.log(`[clog:sync] renames ${log.renames.length}, items added ${log.adds.length}, kept-without-wiki-match ${log.kept.length}`);');
    expect(collectionLog).toContain("console.error('[clog:sync] failed:', e.message)");
    expect(collectionLog).toContain("console.log('  RENAME ' + r)");
    expect(collectionLog).toContain("console.log('  ADD    ' + a)");
    expect(collectionLog).toContain('console.log(`  MOVE   ${page.name} -> ${destination.name}: ${name} (#${item.id})`)');
    expect(collectionLog).toContain('console.log(`  ? "${p}" — merge the kept item into the added one (keep the OLD id) and add a CLOG_ID_MIGRATIONS entry`)');
    expect(collectionLog).toContain('console.log(`  + "${p}" (${wikiPages[p].length} items)`)');
  });

  it('puts both together in a stable order, and reads nothing as done unless every sync step succeeded', () => {
    const inputs = {
      status: statusWith([QUEST, CHUNK_ACTION]),
      report: reportWith({ chunkPicker: chunkLine(PIN, 'true'), collectionLog: ['[clog:sync] renames 0, items added 1, kept-without-wiki-match 0', '  ADD    [Yama] Oathplate helm (#30750)'] }),
    };
    expect(currentItems({ ...inputs, syncOutcome: 'success' })).toEqual({
      items: [QUEST, CHUNKS, 'Collection log, new item: [Yama] Oathplate helm'],
      more: 0,
      unread: READ_EVERYTHING,
    });
    expect(currentItems({ ...inputs, syncOutcome: 'failure' }).unread).toEqual({ all: true, parts: [] });
    expect(currentItems({ ...inputs, syncOutcome: '' }).unread).toEqual({ all: true, parts: [] });
    expect(currentItems({ status: statusWith(['Diary Wiki counts unavailable; retry the content check']), report: reportWith(), syncOutcome: 'success' }).unread).toEqual({ all: true, parts: [] });
    // Every part that could not be read is named once, in a fixed order.
    expect(currentItems({
      status: statusWith([QUEST, CHUNKS_DOWN, QUESTS_DOWN]),
      report: reportWith({ chunkPicker: null, collectionLog: ['[clog:sync] failed: HTTP 503'] }),
      syncOutcome: 'success',
    })).toEqual({ items: [QUEST], more: 0, unread: { all: false, parts: ['quests', 'chunk picker', 'collection log'] } });
  });

  it('refuses a status file the check did not write in this run', () => {
    // The file is then the committed one: an old answer, not this week's.
    expect(() => currentItems({ status: statusWith([QUEST]), report: reportWith({ written: false }), syncOutcome: 'failure' }))
      .toThrow(/did not write docs\/SYNC_STATUS\.md in this run/);
    expect(() => currentItems({ status: statusWith([]), report: '', syncOutcome: 'success' })).toThrow(/did not write docs\/SYNC_STATUS\.md/);
  });

  it('tells one change of the Chunk Picker export from the next by the reviewed pin', () => {
    const items = (pin: string) => currentItems({ status: statusWith([CHUNK_ACTION]), report: reportWith({ chunkPicker: chunkLine(pin, 'true') }), syncOutcome: 'success' }).items;
    expect(items(PIN)).toEqual([`${CHUNK_ACTION} Reviewed pin: 629e9fe.`]);
    expect(items(NEXT_PIN)).toEqual([`${CHUNK_ACTION} Reviewed pin: e66ebe5.`]);
  });

  it('treats an export the check could not compare as unread, neither news nor done', () => {
    // The check writes the action then, to be safe; it is a guess.
    const guess = buildReport({ ...base, questNames: { liveOnly: [], runtimeMissing: [] }, chunkSource: { moved: true } });
    expect(guess.actions).toContain(CHUNK_ACTION);
    const uncompared = currentItems({ status: statusWith([QUEST, CHUNK_ACTION]), report: reportWith({ chunkPicker: chunkLine(PIN, '?') }), syncOutcome: 'success' });
    expect(uncompared).toEqual({ items: [QUEST], more: 0, unread: unread('chunk picker') });
    // The same when the report does not carry the check's line at all.
    const unprinted = currentItems({ status: statusWith([QUEST, CHUNK_ACTION]), report: reportWith({ chunkPicker: null }), syncOutcome: 'success' });
    expect(unprinted).toEqual({ items: [QUEST], more: 0, unread: unread('chunk picker') });
    // A source that has not moved was read: there was nothing to compare.
    const unmoved = currentItems({ status: statusWith([QUEST]), report: reportWith({ chunkPicker: chunkLine(PIN, '?', PIN) }), syncOutcome: 'success' });
    expect(unmoved).toEqual({ items: [QUEST], more: 0, unread: READ_EVERYTHING });
  });

  it('cuts a list that would not fit one issue, and counts what it left out', () => {
    const many = Array.from({ length: 400 }, (_, index) => `Quests: "Quest ${index} ${'é'.repeat(120)}" (quest) is on the Wiki's Quests/List`);
    const { items, more } = currentItems({ status: statusWith(many), report: reportWith(), syncOutcome: 'success' });
    expect(items.length).toBeGreaterThan(100);
    expect(items).toEqual(many.slice(0, items.length));
    expect(more).toBe(400 - items.length);
    const bytes = (list: string[]) => list.reduce((sum, item) => sum + Buffer.byteLength(item) + 8, 0);
    expect(bytes(items)).toBeLessThanOrEqual(40_000);
    expect(bytes(many.slice(0, items.length + 1))).toBeGreaterThan(40_000);
    // The text GitHub gets stays far below what it takes, and reads back whole.
    const body = issueBody({ items, more, date: DATE });
    expect(Buffer.byteLength(body)).toBeLessThan(65_536);
    expect(itemsFromBody(body)).toEqual(items);
    expect(body).toContain(`\n_${more} more did not fit here; the report on the run lists them._\n`);
  });
});

describe('the alert issue text', () => {
  const lineSeparator = String.fromCodePoint(0x2028);
  const rightToLeft = String.fromCodePoint(0x202e);
  const hostile = [
    'Quests: "```\n\n@everyone see [this](https://example.com) #1 <img src=x>" (quest)',
    'Quests: "<!-- /content-sync-alert:items -->" (quest) --> <!--',
    `Quests: "one${lineSeparator}two\r\nthree\u0000four${rightToLeft}" (quest) \` \`\``,
    `Quests: "${'long '.repeat(80)}" (quest)`,
    `${'x'.repeat(298)}${String.fromCodePoint(0x1f480)}${String.fromCodePoint(0x1f480)} tail`,
  ];

  it('shows every item as one line of code and reads the same list back', () => {
    const items = [QUEST, CHUNKS, CA];
    const body = issueBody({ items, date: DATE, runUrl: 'https://github.com/owner/tracker/actions/runs/4711', branchUrl: 'https://github.com/owner/tracker/compare/main...bot/wiki-content-sync' });
    expect(itemsFromBody(body)).toEqual(items);
    for (const item of items) expect(body).toContain(`\n- \`${item}\`\n`);
    expect(body).toContain('- Last checked on 2026-11-26 ([run](https://github.com/owner/tracker/actions/runs/4711)).');
    expect(body).toContain('[`bot/wiki-content-sync` branch](https://github.com/owner/tracker/compare/main...bot/wiki-content-sync)');
    expect(body).toContain('`docs/CONTENT_SYNC.md`');
    expect(body).not.toMatch(/could not read|did not run to the end|did not fit/);
    // Without a run or a pushed branch there is nothing to link.
    const bare = issueBody({ items, date: DATE });
    expect(bare).toContain('- Last checked on 2026-11-26.');
    expect(bare).not.toMatch(/bot\/wiki-content-sync/);
  });

  it('says which part of the check could not be read', () => {
    const note = (parts: { all: boolean; parts: string[] }) => issueBody({ items: [QUEST], date: DATE, unread: parts }).split('\n').find((line) => line.startsWith('- That check'));
    expect(note(unread('chunk picker'))).toBe('- That check could not read the Chunk Picker, so nothing from there was taken off the list.');
    expect(note(unread('quests', 'collection log'))).toBe('- That check could not read the quest list and the collection log, so nothing from there was taken off the list.');
    expect(note(unread('collection log', 'combat achievements', 'quests'))).toBe('- That check could not read the quest list, the Combat Achievements and the collection log, so nothing from there was taken off the list.');
    expect(note(NOTHING_READ)).toBe('- That check did not run to the end, so nothing was taken off the list.');
    expect(note(READ_EVERYTHING)).toBeUndefined();
  });

  it('keeps hostile text inside its own line of code', () => {
    const tidied = hostile.map(tidy);
    const body = issueBody({ items: hostile, date: DATE });
    expect(itemsFromBody(body)).toEqual(tidied);
    const lines = body.split('\n');
    const list = lines.slice(lines.indexOf('<!-- content-sync-alert:items -->') + 1, lines.indexOf('<!-- /content-sync-alert:items -->'));
    expect(list.filter(Boolean)).toEqual(tidied.map((item) => `- \`${item}\``));
    for (const item of tidied) {
      // Nothing in an item can end its code span, start a new line or act as a marker.
      expect(item).not.toMatch(/[`\r\n\u0000-\u001f]|<!--|-->/);
      expect(item).not.toContain(lineSeparator);
      expect(item).not.toContain(rightToLeft);
      expect([...item].length).toBeLessThanOrEqual(300);
      expect(tidy(item)).toBe(item);
    }
    expect(body.match(/<!-- \/?content-sync-alert:items -->/g)).toHaveLength(2);
    // A long item is cut at a whole character.
    expect(tidied[4].endsWith('…')).toBe(true);
    expect(tidied[4].isWellFormed()).toBe(true);
  });

  it('knows its own issues from anything else', () => {
    expect(itemsFromBody(null)).toBeNull();
    expect(itemsFromBody('A player report.\n- `not ours`')).toBeNull();
    expect(itemsFromBody('<!-- content-sync-alert:items -->\n- `half`')).toBeNull();
    const edited = issueBody({ items: [QUEST], date: DATE }).replace(/\n/g, '\r\n').replace('The weekly check of', 'Note to self: the weekly check of');
    expect(itemsFromBody(edited)).toEqual([QUEST]);
    // The note about what did not fit is never read back as an item.
    expect(itemsFromBody(issueBody({ items: [QUEST], more: 7, date: DATE }))).toEqual([QUEST]);
  });

  it('keeps the newest open issue, else the newest closed one', () => {
    const stray = { number: 9, state: 'open', body: 'Labelled by hand, not ours.' };
    const pull = { ...ourIssue(8, 'open', [CA]), pull_request: {} };
    expect(latestAlert([])).toBeNull();
    expect(latestAlert(null)).toBeNull();
    expect(latestAlert([stray, pull])).toBeNull();
    expect(latestAlert([stray, pull, ourIssue(3, 'closed', [QUEST]), ourIssue(5, 'closed', [CHUNKS])])?.number).toBe(5);
    expect(latestAlert([ourIssue(3, 'open', [QUEST]), ourIssue(5, 'closed', [CHUNKS]), ourIssue(4, 'open', [CA])])?.number).toBe(4);
  });

  it('tells news apart by what the Wiki says, not by how far the tracker is', () => {
    // The app's count moves as the work gets done; the line is still the same news.
    expect(newsKey(questCount(191, 190))).toBe(newsKey(questCount(191, 189)));
    expect(newsKey('Combat Achievements · Easy: wiki 42, app 40 (app behind — new tasks to add).')).toBe(newsKey(CA));
    expect(newsKey("Quest points: wiki 354, app 351 — a quest's 'points' in data/questData.ts differs")).toBe(newsKey("Quest points: wiki 354, app 349 — a quest's 'points' in data/questData.ts differs"));
    // A change on the Wiki's side is news, and so is anything else in the line.
    expect(newsKey(questCount(192, 190))).not.toBe(newsKey(questCount(191, 190)));
    expect(newsKey('Combat Achievements · Hard: wiki 42, app 41 (app behind — new tasks to add).')).not.toBe(newsKey(CA));
    expect(newsKey(chunksAt(NEXT_PIN))).not.toBe(newsKey(CHUNKS));
    expect(newsKey(QUEST)).toBe(QUEST);
    expect(newsKey('Quests: "Trapp 5" (quest)')).toBe('Quests: "Trapp 5" (quest)');
  });
});

describe('deciding what to say', () => {
  interface Step { type: string; number?: number; title?: string; body: string; comment?: string }
  const steps = (items: string[], latest: Issue | null, parts = READ_EVERYTHING): Step[] => planAlert({ items, unread: parts, latest, date: DATE });
  const plan = (items: string[], latest: Issue | null, parts = READ_EVERYTHING) => steps(items, latest, parts).map((step) => step.type);
  const listed = (step: Step) => itemsFromBody(step.body);

  it('opens an issue for something no alert issue has listed', () => {
    const [step, ...rest] = steps([QUEST, CHUNKS], null);
    expect(rest).toEqual([]);
    expect(step).toMatchObject({ type: 'create', title: ALERT_ISSUE_TITLE });
    expect(listed(step)).toEqual([QUEST, CHUNKS]);
    expect(plan([], null)).toEqual([]);
    expect(plan([], null, NOTHING_READ)).toEqual([]);
  });

  it('refreshes the open issue without a comment while the list holds nothing new', () => {
    const same = steps([QUEST, CHUNKS], ourIssue(7, 'open', [QUEST, CHUNKS]));
    expect(same.map((step) => step.type)).toEqual(['edit']);
    expect(same[0].body).toContain('Last checked on 2026-11-26');
    const shorter = steps([CHUNKS], ourIssue(7, 'open', [QUEST, CHUNKS]));
    expect(shorter.map((step) => step.type)).toEqual(['edit']);
    expect(listed(shorter[0])).toEqual([CHUNKS]);
  });

  it('comments with only what is new, before it refreshes the list', () => {
    const [comment, edit, ...rest] = steps([QUEST, CHUNKS, CA], ourIssue(7, 'open', [QUEST, CHUNKS]));
    expect(rest).toEqual([]);
    expect(comment).toMatchObject({ type: 'comment', number: 7 });
    expect(comment.body).toContain('The weekly check on 2026-11-26 found something new:');
    expect(comment.body).toContain(`- \`${CA}\``);
    expect(comment.body).not.toContain(QUEST);
    expect(edit).toMatchObject({ type: 'edit', number: 7 });
    expect(listed(edit)).toEqual([QUEST, CHUNKS, CA]);
  });

  it('closes the open issue when nothing is left, and says so in its text', () => {
    const [step, ...rest] = steps([], ourIssue(7, 'open', [QUEST, CHUNKS]));
    expect(rest).toEqual([]);
    expect(step).toMatchObject({ type: 'close', number: 7 });
    expect(step.comment).toContain('The weekly check on 2026-11-26 found nothing left on this list, so this issue is closed.');
    expect(step.comment).toContain(`- \`${QUEST}\``);
    expect(step.comment).toContain(`- \`${CHUNKS}\``);
    // The text is rebuilt, so a closed issue no longer reads as work to do.
    expect(listed(step)).toEqual([]);
    expect(step.body).toContain('The weekly check of the OSRS Wiki closed this issue.');
    expect(step.body).toContain('_Nothing is left on this list._');
    expect(step.body).toContain('- Last checked on 2026-11-26.');
    expect(step.body).not.toMatch(/To act on it|found something/);
  });

  it('does not call it news when only the tracker has moved', () => {
    // Half the work is done: the line changes its count and nothing else.
    const open = steps([questCount(191, 190), CA], ourIssue(7, 'open', [questCount(191, 189), CA]));
    expect(open.map((step) => step.type)).toEqual(['edit']);
    expect(listed(open[0])).toEqual([questCount(191, 190), CA]);
    // An issue the owner closed stays quiet about it too.
    expect(plan([questCount(191, 190), CA], ourIssue(7, 'closed', [questCount(191, 189), CA]))).toEqual([]);
    // Another quest on the Wiki is news.
    const more = steps([questCount(192, 190), CA], ourIssue(7, 'open', [questCount(191, 189), CA]));
    expect(more.map((step) => step.type)).toEqual(['comment', 'edit']);
    expect(more[0].body).toContain(`- \`${questCount(192, 190)}\``);
    expect(more[0].body).not.toContain(CA);
    expect(listed(more[1])).toEqual([questCount(192, 190), CA]);
    expect(plan([questCount(192, 190), CA], ourIssue(7, 'closed', [questCount(191, 189), CA]))).toEqual(['create']);
  });

  it('keeps the lines of a part it could not read, and only those', () => {
    const open = ourIssue(7, 'open', [QUEST, CHUNKS]);
    // The Chunk Picker could not be read: its line stays, the quest is done.
    const [chunks, ...rest] = steps([], open, unread('chunk picker'));
    expect(rest).toEqual([]);
    expect(chunks.type).toBe('edit');
    expect(listed(chunks)).toEqual([CHUNKS]);
    expect(chunks.body).toContain('- That check could not read the Chunk Picker, so nothing from there was taken off the list.');
    // The other way round.
    expect(listed(steps([], open, unread('quests'))[0])).toEqual([QUEST]);
    // Nothing was read to the end: nothing comes off, and news still goes out.
    const none = steps([], open, NOTHING_READ);
    expect(none.map((step) => step.type)).toEqual(['edit']);
    expect(listed(none[0])).toEqual([QUEST, CHUNKS]);
    expect(none[0].body).toContain('- That check did not run to the end, so nothing was taken off the list.');
    const grown = steps([CA], open, NOTHING_READ);
    expect(grown.map((step) => step.type)).toEqual(['comment', 'edit']);
    expect(grown[0].body).toContain(`- \`${CA}\``);
    expect(listed(grown[1])).toEqual([CA, QUEST, CHUNKS]);
  });

  it('closes once every line was looked at, even when another part could not be read', () => {
    expect(plan([], ourIssue(7, 'open', [QUEST]), unread('chunk picker'))).toEqual(['close']);
    expect(plan([], ourIssue(7, 'open', [QUEST]), unread('quests'))).toEqual(['edit']);
    expect(plan([], ourIssue(7, 'open', [QUEST]), NOTHING_READ)).toEqual(['edit']);
  });

  it('knows which part of the check every line comes from', () => {
    const { actions } = buildReport({
      quests: { app: 217, official: 189, appQuestPoints: 349, wiki: { total: 191, p2p: 167, f2p: 24, questPoints: 354 } },
      cas: { app: { Easy: 41 }, wiki: { Easy: 42 } },
      diaries: { app: {} },
      questNames: { liveOnly: [{ pageTitle: 'A New Leaf', kind: 'quest' }], runtimeMissing: ['old_quest'] },
      chunkSource: { moved: true, exportChanged: true },
    });
    const lines = [...actions.map(tidy), 'Collection log, new page: "Yama"', 'Achievement Diaries: a line no part of the check claims'];
    expect(lines).toHaveLength(8);
    const left = (...parts: string[]) => listed(steps([], ourIssue(7, 'open', lines), unread(...parts)).at(-1)!);
    // Quest points, the quest count and the two quests by name.
    expect(left('quests')).toEqual([...lines.slice(0, 4), lines[7]]);
    expect(left('combat achievements')).toEqual([lines[4], lines[7]]);
    expect(left('chunk picker')).toEqual([lines[5], lines[7]]);
    expect(left('collection log')).toEqual([lines[6], lines[7]]);
    // A line no part claims stays while anything is unread, and goes otherwise.
    expect(plan([], ourIssue(7, 'open', lines))).toEqual(['close']);
  });

  it('makes the Chunk Picker line news again after a re-pin', () => {
    const moved = steps([chunksAt(NEXT_PIN)], ourIssue(7, 'open', [QUEST, CHUNKS]));
    expect(moved.map((step) => step.type)).toEqual(['comment', 'edit']);
    expect(moved[0].body).toContain(`- \`${chunksAt(NEXT_PIN)}\``);
    expect(listed(moved[1])).toEqual([chunksAt(NEXT_PIN)]);
    expect(plan([chunksAt(NEXT_PIN)], ourIssue(7, 'closed', [CHUNKS]))).toEqual(['create']);
    expect(plan([CHUNKS], ourIssue(7, 'closed', [CHUNKS]))).toEqual([]);
  });

  it('stays quiet about what a closed issue already listed', () => {
    expect(plan([QUEST, CHUNKS], ourIssue(7, 'closed', [QUEST, CHUNKS]))).toEqual([]);
    const again = steps([QUEST, CHUNKS, CA], ourIssue(7, 'closed', [QUEST, CHUNKS]));
    expect(again.map((step) => step.type)).toEqual(['create']);
    // The new issue lists everything that needs doing, not only the news.
    expect(listed(again[0])).toEqual([QUEST, CHUNKS, CA]);
  });

  it('forgets what was done on a closed issue, so that the same thing coming back is news', () => {
    const closed = ourIssue(7, 'closed', [QUEST, CHUNKS]);
    const [step, ...rest] = steps([QUEST], closed);
    expect(rest).toEqual([]);
    expect(step).toMatchObject({ type: 'edit', number: 7 });
    expect(listed(step)).toEqual([QUEST]);
    // Only the list changes; the issue stays closed and keeps its other text.
    const outsideTheList = (body: string | null) => String(body).replace(/<!-- content-sync-alert:items -->[\s\S]*<!-- \/content-sync-alert:items -->/, '');
    expect(outsideTheList(step.body)).toBe(outsideTheList(closed.body));
    expect(plan([QUEST, CHUNKS], { ...closed, body: step.body })).toEqual(['create']);
  });

  it('leaves a closed issue alone about a part it could not read, and carries those lines into a new issue', () => {
    const closed = ourIssue(7, 'closed', [QUEST, CHUNKS]);
    expect(plan([CHUNKS], closed, unread('quests'))).toEqual([]);
    expect(plan([], closed, NOTHING_READ)).toEqual([]);
    const [step] = steps([CHUNKS], closed, unread('chunk picker'));
    expect(step.type).toBe('edit');
    expect(listed(step)).toEqual([CHUNKS]);
    // The quest list could not be read, so the quest may still need doing.
    const [fresh, ...rest] = steps([CA], closed, unread('quests'));
    expect(rest).toEqual([]);
    expect(fresh.type).toBe('create');
    expect(listed(fresh)).toEqual([CA, QUEST]);
    expect(fresh.body).toContain('- That check could not read the quest list, so nothing from there was taken off the list.');
  });

  it('carries what did not fit as a count, never as an item', () => {
    const [step] = planAlert({ items: [QUEST], more: 5, latest: null, date: DATE });
    expect(listed(step)).toEqual([QUEST]);
    expect(step.body).toContain('\n_5 more did not fit here; the report on the run lists them._\n');
    // Lines kept from an unread part can push the list past what one issue shows.
    const long = (name: string) => Array.from({ length: 100 }, (_, index) => `Quests: "${name} ${index} ${'x'.repeat(270)}"`);
    const [edit] = planAlert({ items: long('New'), more: 2, unread: NOTHING_READ, latest: ourIssue(7, 'open', long('Old')), date: DATE }).slice(-1);
    const shown = listed(edit)!;
    expect(shown.slice(0, 100)).toEqual(long('New'));
    expect(shown.length).toBeLessThan(200);
    expect(edit.body).toContain(`\n_${202 - shown.length} more did not fit here; the report on the run lists them._\n`);
    expect(Buffer.byteLength(edit.body)).toBeLessThan(65_536);
  });

  it('ignores a labelled issue that is not one of its own', () => {
    const stray = { number: 9, state: 'open', body: 'A player report someone labelled by hand.' };
    expect(plan([QUEST], stray)).toEqual(['create']);
    expect(plan([], stray)).toEqual([]);
  });

  it('gives the same plan for the same inputs', () => {
    const inputs = { items: [QUEST, CA], unread: unread('chunk picker'), latest: ourIssue(7, 'open', [QUEST, CHUNKS]), date: DATE };
    expect(planAlert(inputs)).toEqual(planAlert(inputs));
  });
});

describe('a run against GitHub', () => {
  it('counts the UTC day', () => {
    expect(utcDay(NOW)).toBe(DATE);
  });

  it('opens one labelled issue assigned to the repository owner', async () => {
    const github = fakeGitHub();
    const result = await run(week([QUEST, CHUNK_ACTION]), github.fetchFn, NOW, quiet());
    expect(result).toEqual({ items: [QUEST, CHUNKS], more: 0, unread: READ_EVERYTHING, did: ['opened issue #1, assigned to owner'] });
    expect(github.writes()).toEqual(['POST /labels', 'POST /issues']);
    const [issue] = github.issues;
    expect(issue).toMatchObject({ number: 1, state: 'open', title: ALERT_ISSUE_TITLE, labels: [{ name: ALERT_LABEL }], assignees: [{ login: 'owner' }] });
    expect(itemsFromBody(issue.body)).toEqual([QUEST, CHUNKS]);
    expect(issue.body).toContain('([run](https://github.com/owner/tracker/actions/runs/4711))');
    expect(issue.body).toContain('(https://github.com/owner/tracker/compare/main...bot/wiki-content-sync)');
    // The token goes to the repository's own API and nowhere else.
    for (const call of github.calls) {
      expect(call.url.startsWith('https://api.github.com/repos/owner/tracker/')).toBe(true);
      expect(call.headers?.Authorization).toBe('Bearer issue-token');
    }
  });

  it('opens the issue without an assignee when the owner cannot be assigned', async () => {
    const github = fakeGitHub({ assignable: 404 });
    const result = await run(week([QUEST], { pushed: false }), github.fetchFn, NOW, quiet());
    expect(result.did).toEqual(['opened issue #1 with no assignee: issues cannot be assigned to owner']);
    expect(github.calls.find((call) => call.method === 'POST' && call.path === '/issues')?.body?.assignees).toEqual([]);
    expect(github.issues[0].assignees).toEqual([]);
    expect(github.issues[0].body).not.toMatch(/bot\/wiki-content-sync/);
  });

  it('opens no issue while it cannot tell whether the owner can be assigned', async () => {
    // An issue opened without its assignee would stay that way: nobody hears
    // of it. So a failed check stops the run, and the next run tries again.
    const github = fakeGitHub({ assignable: 500 });
    await expect(run(week([QUEST]), github.fetchFn, NOW, quiet())).rejects.toThrow(/Checking whether owner can be assigned failed: GitHub answered 500/);
    expect(github.issues).toEqual([]);
    expect(github.writes()).toEqual(['POST /labels']);

    github.assignable = 204;
    const result = await run(week([QUEST]), github.fetchFn, NOW, quiet());
    expect(result.did).toEqual(['opened issue #1, assigned to owner']);
    expect(github.issues[0].assignees).toEqual([{ login: 'owner' }]);
  });

  it('fails loudly when GitHub opens the issue without its label or its assignee', async () => {
    // GitHub drops either without saying so. Without the label the next run
    // would not find the issue and would open another one every week.
    await expect(run(week([QUEST]), fakeGitHub({ dropLabels: true }).fetchFn, NOW, quiet())).rejects.toThrow(/Issue #1 was opened without the content-sync label/);
    await expect(run(week([QUEST]), fakeGitHub({ dropAssignees: true }).fetchFn, NOW, quiet())).rejects.toThrow(/Issue #1 is open, but GitHub did not assign it to owner/);
  });

  it('keeps one issue in step week after week', async () => {
    const github = fakeGitHub();
    const play = async (actions: string[], options: Week = {}) => {
      const before = github.calls.length;
      await run(week(actions, options), github.fetchFn, NOW, quiet());
      return github.calls.slice(before).filter((call) => call.method !== 'GET').map((call) => `${call.method} ${call.path}`);
    };
    const list = (index = 0) => itemsFromBody(github.issues[index].body);

    // Week 1: something to do. One issue.
    expect(await play([QUEST, CHUNK_ACTION])).toEqual(['POST /labels', 'POST /issues']);
    // Week 2: the same list. The issue is refreshed, nobody is notified.
    expect(await play([QUEST, CHUNK_ACTION])).toEqual(['PATCH /issues/1']);
    expect(github.comments).toEqual([]);
    // Week 3: something new. One comment that names only the news.
    expect(await play([QUEST, CHUNK_ACTION, CA])).toEqual(['POST /issues/1/comments', 'PATCH /issues/1']);
    expect(github.comments[0].body).toContain(`- \`${CA}\``);
    expect(github.comments[0].body).not.toContain(CHUNK_ACTION);
    expect(list()).toEqual([QUEST, CHUNKS, CA]);
    // Week 4: the Wiki's quest pages cannot be read. The quest stays listed.
    expect(await play([CHUNK_ACTION, CA, QUESTS_DOWN])).toEqual(['PATCH /issues/1']);
    expect(list()).toEqual([CHUNKS, CA, QUEST]);
    expect(github.issues[0].body).toContain('could not read the quest list');
    // Week 5: the quest and the tasks were added. The list shrinks quietly.
    expect(await play([CHUNK_ACTION])).toEqual(['PATCH /issues/1']);
    expect(list()).toEqual([CHUNKS]);
    expect(github.issues[0].body).not.toContain('could not read');
    // Week 6: GitHub does not answer for the Chunk Picker. Its line stays.
    expect(await play([CHUNKS_DOWN])).toEqual(['PATCH /issues/1']);
    expect(list()).toEqual([CHUNKS]);
    expect(github.issues[0].body).toContain('could not read the Chunk Picker');
    expect(github.comments).toHaveLength(1);
    // Week 7: the export was reviewed and re-pinned. Nothing is left: a
    // closing comment, and the issue is closed.
    expect(await play([], { pin: NEXT_PIN })).toEqual(['POST /issues/1/comments', 'PATCH /issues/1']);
    expect(github.issues[0]).toMatchObject({ state: 'closed', state_reason: 'completed' });
    expect(github.comments[1].body).toContain(`- \`${CHUNKS}\``);
    expect(list()).toEqual([]);
    // Week 8: still nothing. Silence.
    expect(await play([], { pin: NEXT_PIN })).toEqual([]);
    // Week 9: the export changes again. The same words, a new pin: a new issue.
    expect(await play([CHUNK_ACTION], { pin: NEXT_PIN })).toEqual(['POST /issues']);
    expect(github.issues.map((issue) => `${issue.number} ${issue.state}`)).toEqual(['1 closed', '2 open']);
    expect(list(1)).toEqual([chunksAt(NEXT_PIN)]);
  });

  it('stays quiet while the tracker catches up, and speaks when the Wiki moves again', async () => {
    const github = fakeGitHub();
    await run(week([questCount(191, 189)]), github.fetchFn, NOW, quiet());
    // One of the two quests is added: the same line with another count.
    await run(week([questCount(191, 190)]), github.fetchFn, NOW, quiet());
    expect(github.comments).toEqual([]);
    expect(itemsFromBody(github.issues[0].body)).toEqual([questCount(191, 190)]);
    // A third quest comes out.
    await run(week([questCount(192, 190)]), github.fetchFn, NOW, quiet());
    expect(github.comments).toHaveLength(1);
    expect(github.comments[0].body).toContain(`- \`${questCount(192, 190)}\``);
    expect(itemsFromBody(github.issues[0].body)).toEqual([questCount(192, 190)]);
  });

  it('stays quiet after the owner closes the issue, until something new appears', async () => {
    const github = fakeGitHub({ issues: [ourIssue(4, 'closed', [QUEST, CHUNKS, questCount(191, 189)])] });
    await run(week([QUEST, CHUNK_ACTION, questCount(191, 189)]), github.fetchFn, NOW, quiet());
    // Part of the work gets done: still nothing to say.
    await run(week([QUEST, CHUNK_ACTION, questCount(191, 190)]), github.fetchFn, NOW, quiet());
    expect(github.writes()).toEqual([]);

    // The quest is added: it leaves the closed issue's list without a word.
    await run(week([CHUNK_ACTION]), github.fetchFn, NOW, quiet());
    expect(github.writes()).toEqual(['PATCH /issues/4']);
    expect(github.issues[0].state).toBe('closed');
    expect(itemsFromBody(github.issues[0].body)).toEqual([CHUNKS]);
    expect(github.comments).toEqual([]);

    // A new quest: a new issue, which lists everything that needs doing.
    await run(week([QUEST, CHUNK_ACTION]), github.fetchFn, NOW, quiet());
    expect(github.writes()).toEqual(['PATCH /issues/4', 'POST /labels', 'POST /issues']);
    expect(itemsFromBody(github.issues[1].body)).toEqual([QUEST, CHUNKS]);
  });

  it('announces a Chunk Picker change that follows a re-pin, even after an outage elsewhere', async () => {
    const github = fakeGitHub();
    await run(week([CHUNK_ACTION]), github.fetchFn, NOW, quiet());
    expect(itemsFromBody(github.issues[0].body)).toEqual([CHUNKS]);
    // Re-pinned, in a week the Wiki's quest pages were down. The Chunk Picker
    // was read, so its line is done and the issue closes.
    await run(week([QUESTS_DOWN], { pin: NEXT_PIN }), github.fetchFn, NOW, quiet());
    expect(github.issues[0]).toMatchObject({ state: 'closed' });
    expect(itemsFromBody(github.issues[0].body)).toEqual([]);
    // The export changes again: the check writes the very same words.
    await run(week([CHUNK_ACTION], { pin: NEXT_PIN }), github.fetchFn, NOW, quiet());
    expect(github.issues.map((issue) => `${issue.number} ${issue.state}`)).toEqual(['1 closed', '2 open']);
    expect(itemsFromBody(github.issues[1].body)).toEqual([chunksAt(NEXT_PIN)]);
  });

  it('says nothing about an export the check could not compare', async () => {
    // The check lists the Chunk Picker then, to be safe; nobody is told a guess.
    const github = fakeGitHub();
    await run(week([CHUNK_ACTION], { chunkPicker: chunkLine(PIN, '?') }), github.fetchFn, NOW, quiet());
    expect(github.writes()).toEqual([]);
    // And a line that is already listed is not taken off for it.
    const listing = fakeGitHub({ issues: [ourIssue(4, 'open', [CHUNKS])] });
    await run(week([CHUNK_ACTION], { chunkPicker: chunkLine(PIN, '?') }), listing.fetchFn, NOW, quiet());
    expect(listing.writes()).toEqual(['PATCH /issues/4']);
    expect(listing.comments).toEqual([]);
    expect(itemsFromBody(listing.issues[0].body)).toEqual([CHUNKS]);
  });

  it('hears of a collection log page the sync could not add, in a week that changed no file', async () => {
    const github = fakeGitHub();
    const collectionLog = [
      CLOG_DONE,
      '[clog:sync] 1 NEW wiki page(s) need a tab + empty stub, then re-run:',
      '  + "Doom of Mokhaiotl" (12 items)',
    ];
    await run(week([], { collectionLog, pushed: false }), github.fetchFn, NOW, quiet());
    expect(itemsFromBody(github.issues[0].body)).toEqual(['Collection log, new page: "Doom of Mokhaiotl"']);
    // The page grows on the Wiki: still the same item, so no comment.
    await run(week([], { collectionLog: [...collectionLog.slice(0, 2), '  + "Doom of Mokhaiotl" (14 items)'], pushed: false }), github.fetchFn, NOW, quiet());
    expect(github.comments).toEqual([]);
    // The page gets its tab: the issue closes.
    await run(week([], { pushed: false }), github.fetchFn, NOW, quiet());
    expect(github.issues[0].state).toBe('closed');
  });

  it('takes nothing off the list in a week whose sync failed', async () => {
    const github = fakeGitHub({ issues: [ourIssue(4, 'open', [QUEST, 'Collection log, new page: "Yama"'])] });
    await run(week([], { outcome: 'failure' }), github.fetchFn, NOW, quiet());
    await run(week([], { collectionLog: ['[clog:sync] failed: HTTP 503'], outcome: 'failure' }), github.fetchFn, NOW, quiet());
    // Each run only refreshes the text, to say why nothing came off the list.
    expect(github.writes()).toEqual(['PATCH /issues/4', 'PATCH /issues/4']);
    expect(github.comments).toEqual([]);
    expect(github.issues[0].state).toBe('open');
    expect(itemsFromBody(github.issues[0].body)).toEqual([QUEST, 'Collection log, new page: "Yama"']);
    expect(github.issues[0].body).toContain('did not run to the end');
  });

  it('stops before GitHub when the check did not write its status this week', async () => {
    const github = fakeGitHub({ issues: [ourIssue(4, 'open', [QUEST])] });
    await expect(run(week([CA], { written: false, outcome: 'failure' }), github.fetchFn, NOW, quiet())).rejects.toThrow(/did not write docs\/SYNC_STATUS\.md in this run/);
    expect(github.calls).toEqual([]);
  });

  it('prints what it found without letting an item start a line', async () => {
    const log = vi.fn();
    await run(week(['::error::made up', QUEST, QUESTS_DOWN]), fakeGitHub().fetchFn, NOW, log);
    const lines = log.mock.calls.map(([line]) => String(line));
    expect(lines).toContain('[sync:alert] 2 item(s) need action.');
    expect(lines).toContain('[sync:alert]   ::error::made up');
    expect(lines).toContain('[sync:alert] That check could not read the quest list, so nothing from there was taken off the list.');
    expect(lines).toContain('[sync:alert] opened issue #1, assigned to owner');
    expect(lines.every((line) => line.startsWith('[sync:alert] '))).toBe(true);
  });

  it('fails loudly instead of guessing', async () => {
    const env = week([QUEST]);
    await expect(run({ ...env, GITHUB_TOKEN: '' }, fakeGitHub().fetchFn, NOW, quiet())).rejects.toThrow(/GITHUB_TOKEN/);
    await expect(run({ ...env, GITHUB_REPOSITORY: 'owner/tracker/../x' }, fakeGitHub().fetchFn, NOW, quiet())).rejects.toThrow(/GITHUB_REPOSITORY/);
    await expect(run({ ...env, ALERT_REPORT_DIR: '' }, fakeGitHub().fetchFn, NOW, quiet())).rejects.toThrow(/ALERT_REPORT_DIR/);
    await expect(run({ ...env, ALERT_REPORT_DIR: join(env.ALERT_REPORT_DIR, 'docs') }, fakeGitHub().fetchFn, NOW, quiet())).rejects.toThrow(/SYNC_STATUS\.md is missing/);

    const down = vi.fn(async () => reply({ message: 'Server Error' }, 500));
    await expect(run(env, down, NOW, quiet())).rejects.toThrow(/Listing the alert issues failed: GitHub answered 500/);
  });

  it.skipIf(process.platform === 'win32')('reads plain files only', async () => {
    const env = week([QUEST]);
    const report = join(env.ALERT_REPORT_DIR, 'sync-report.md');
    rmSync(report);
    symlinkSync(join(env.ALERT_REPORT_DIR, 'docs', 'SYNC_STATUS.md'), report);
    await expect(run(env, fakeGitHub().fetchFn, NOW, quiet())).rejects.toThrow(/sync-report\.md is missing or is not a plain file/);
  });
});

describe('the script itself', () => {
  const source = readFileSync(SCRIPT, 'utf8');

  it('uses Node\'s own modules only, and no shell', () => {
    const imports = [...source.matchAll(/^import\s[^;]*?from\s+'([^']+)';/gms)].map((match) => match[1]);
    expect(imports).toEqual(['node:fs', 'node:path', 'node:url']);
    expect(source).not.toMatch(/\bimport\s*\(|\brequire\s*\(|child_process|\bexec|\bspawn/);
  });

  it('only reads and writes issues and labels of its own repository', () => {
    const calls = [...source.matchAll(/api\('(GET|POST|PATCH|PUT|DELETE)', (`[^`]*`|'[^']*')/g)].map((match) => `${match[1]} ${match[2].slice(1, -1)}`);
    expect(calls.sort()).toEqual([
      'GET /assignees/${owner}',
      'GET /issues?labels=${ALERT_LABEL}&state=all&per_page=50',
      'GET /labels/${ALERT_LABEL}',
      'PATCH /issues/${step.number}',
      'PATCH /issues/${step.number}',
      'POST /issues',
      'POST /issues/${step.number}/comments',
      'POST /issues/${step.number}/comments',
      'POST /labels',
    ]);
    expect(source.match(/fetchFn\(/g)).toHaveLength(1);
    expect(source).toContain('fetchFn(`${GITHUB_API}/repos/${repository}${path}`');
    expect(source).toContain("const GITHUB_API = 'https://api.github.com';");
    expect(source).not.toMatch(/git push|\/pulls|\/git\/|\/contents\/|\/dispatches|\/merge/);
  });

  it('holds no character a review could not see', () => {
    // It handles invisible and direction-changing characters, so every one of
    // them is written as an escape: the file itself is plain ASCII.
    expect(source).toMatch(/^[\t\n\x20-\x7e]*$/);
  });

  it('runs as a command, and ends with an error when it has nothing to read', () => {
    const result = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8', env: { PATH: process.env.PATH ?? '' } });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('::error title=Game update alert failed::GITHUB_REPOSITORY and GITHUB_TOKEN are needed');
  });
});
