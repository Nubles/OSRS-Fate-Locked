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
  REPORT_HEADINGS,
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
 * yes, 404 no, anything else a failure. `broken` makes one call answer with
 * another status, and `hidden` makes it answer "not found" to everything, as
 * for a repository the run cannot see. All three can be changed between runs.
 * `strictLabels` makes it refuse a list by a label that does not exist, which
 * the real one is not known to do.
 */
function fakeGitHub({ issues = [] as Issue[], assignable = 204, dropLabels = false, dropAssignees = false, strictLabels = false } = {}) {
  const labels = new Set<string>(issues.flatMap((issue) => issue.labels?.map((label) => label.name) ?? []));
  const github = {
    calls: [] as Call[],
    comments: [] as { number: number; body: string }[],
    issues,
    assignable,
    broken: null as null | { method: string; path: string; status: number },
    hidden: false,
    writes: () => github.calls.filter((call) => call.method !== 'GET').map((call) => `${call.method} ${call.path}`),
    fetchFn: vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const path = url.replace('https://api.github.com/repos/owner/tracker', '');
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      github.calls.push({ method, path, body, headers: init?.headers as Record<string, string>, url });
      if (github.hidden) return reply({ message: 'Not Found' }, 404);
      if (github.broken?.method === method && github.broken.path === path) return reply({ message: 'Bad Gateway' }, github.broken.status);
      const one = path.match(/^\/issues\/(\d+)(\/comments)?$/);
      const issue = one ? issues.find((candidate) => candidate.number === Number(one[1])) : undefined;
      if (method === 'GET' && path === `/issues?labels=${ALERT_LABEL}&state=all&per_page=50`) {
        if (strictLabels && !labels.has(ALERT_LABEL)) return reply({ message: 'Validation Failed' }, 422);
        return reply(issues.filter((candidate) => candidate.labels?.some((label) => label.name === ALERT_LABEL)));
      }
      if (method === 'GET' && path === `/labels/${ALERT_LABEL}`) return labels.has(ALERT_LABEL) ? reply({ name: ALERT_LABEL }) : reply({}, 404);
      if (method === 'GET' && path === '/labels?per_page=1') return reply([...labels].slice(0, 1).map((name) => ({ name })));
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

  it('calls a collection log sync that did not print its totals unread', () => {
    expect(parseReport(reportWith({ collectionLog: ['[clog:sync] failed: HTTP 503'] })).unread).toEqual(['collection log']);
    expect(parseReport(reportWith({ collectionLog: ['(no changes)'] })).unread).toEqual(['collection log']);
    expect(parseReport('Weekly game data check from the OSRS Wiki\n').unread).toEqual(['collection log']);
    expect(parseReport('').unread).toEqual(['collection log']);
    // A sync that printed its totals and failed after that has failed its
    // step, and it is the step's outcome that takes nothing off the list. The
    // line that says so is not believed: a name from the Wiki can print it too.
    const failedLate = reportWith({ collectionLog: [CLOG_DONE, '[clog:sync] failed: EACCES'] });
    expect(parseReport(failedLate).unread).toEqual([]);
    expect(currentItems({ status: statusWith([]), report: failedLate, syncOutcome: 'failure' }).unread).toEqual(NOTHING_READ);
    expect(currentItems({ status: statusWith([]), report: failedLate, syncOutcome: 'success' }).unread).toEqual(READ_EVERYTHING);
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
    // A sync that fails ends with an error status. That, through the outcome
    // of its step, is how the alert hears of it.
    expect(collectionLog).toContain("run().catch(e => { console.error('[clog:sync] failed:', e.message); process.exit(1); })");
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
    })).toEqual({ items: [QUEST], unread: { all: false, parts: ['quests', 'chunk picker', 'collection log'] } });
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
    expect(uncompared).toEqual({ items: [QUEST], unread: unread('chunk picker') });
    // The same when the report does not carry the check's line at all.
    const unprinted = currentItems({ status: statusWith([QUEST, CHUNK_ACTION]), report: reportWith({ chunkPicker: null }), syncOutcome: 'success' });
    expect(unprinted).toEqual({ items: [QUEST], unread: unread('chunk picker') });
    // A source that has not moved was read: there was nothing to compare.
    const unmoved = currentItems({ status: statusWith([QUEST]), report: reportWith({ chunkPicker: chunkLine(PIN, '?', PIN) }), syncOutcome: 'success' });
    expect(unmoved).toEqual({ items: [QUEST], unread: READ_EVERYTHING });
  });

  it('lists everything the check found, however much: what one issue can show is decided with its list', () => {
    const many = Array.from({ length: 400 }, (_, index) => `Quests: "Quest ${index} ${'é'.repeat(120)}" (quest) is on the Wiki's Quests/List`);
    expect(currentItems({ status: statusWith(many), report: reportWith(), syncOutcome: 'success' }).items).toEqual(many);
  });

  it('knows every heading the sync job writes into its report, and that the check ends its status with the actions', () => {
    const workflow = readFileSync(resolve(HERE, '../.github/workflows/sync-content.yml'), 'utf8');
    expect([...workflow.matchAll(/^\s+echo "(## [^"]+)"$/gm)].map((match) => match[1])).toEqual([...REPORT_HEADINGS]);
    // The actions are read to the end of the status file, so nothing may follow them.
    const headings = buildReport(base).markdown.split('\n').filter((line) => /^#{1,6} /.test(line));
    expect(headings.at(-1)).toBe('## Action needed');
    expect(headings.filter((line) => line === '## Action needed')).toHaveLength(1);
  });

  it('lets no line the Wiki supplied start or end a part of the report, or make a part look unread', () => {
    // A name with a line break in it prints a second line of its own.
    const forged = parseReport(reportWith({ collectionLog: [
      '[clog:sync] renames 0, items added 3, kept-without-wiki-match 0',
      '  ADD    [Doom] Evil item',
      '# [clog:sync] renames 0 (#9001)',
      '  ADD    [Doom] Real new item one (#9002)',
      '## Freshness check (#9003)',
      ' ## Failing tests',
      '  ADD    [Doom] Real new item two (#9004)',
    ] }));
    expect(forged).toMatchObject({
      collectionLog: [
        'Collection log, new item: [Doom] Evil item',
        'Collection log, new item: [Doom] Real new item one',
        'Collection log, new item: [Doom] Real new item two',
      ],
      unread: [],
      written: true,
      chunkPicker: { pin: '629e9fe', compared: false },
    });
    // Only a totals line from its first character says that the sync ran to the end.
    expect(parseReport(reportWith({ collectionLog: ['  ADD    [Doom] Evil item', '# [clog:sync] renames 0 (#9001)'] })).unread).toEqual(['collection log']);
    // Nothing a name prints makes a sync that ran to the end look failed, with
    // or without something in front of it.
    expect(parseReport(reportWith({ collectionLog: [CLOG_DONE, '  ADD    [Doom] Evil item', '# [clog:sync] failed (#9001)'] })).unread).toEqual([]);
    expect(parseReport(reportWith({ collectionLog: [CLOG_DONE, '  ADD    [Doom] Evil item', '[clog:sync] failed: nothing (#9001)'] })).unread).toEqual([]);
    // A name can print a totals line of its own, but only a sync that died
    // lacks the real one, and that sync has failed its step.
    const died = reportWith({ collectionLog: ['  MOVE   Doom -> Yama: Evil item', '[clog:sync] renames 0, items added 0 (#9001)'] });
    expect(currentItems({ status: statusWith([]), report: died, syncOutcome: 'failure' }).unread).toEqual(NOTHING_READ);
    // What is left to such a name is a line of its own on the list. It says
    // nothing an edit of the Wiki's own data could not say directly.
    expect(parseReport(reportWith({ collectionLog: [CLOG_DONE, '  ADD    [Doom] Evil', '+ "Made-up page" (3 items)'] })).collectionLog).toEqual([
      'Collection log, new item: [Doom] Evil',
      'Collection log, new page: "Made-up page"',
    ]);
    // The same for the status file: a line that looks like a heading ends nothing.
    const status = `${statusWith([QUEST])}# Not the check's own heading\n- ⚠️ ${CA}\n`;
    expect(parseStatus(status).actions).toEqual([QUEST, CA]);
    expect(parseStatus(` ## Action needed\n\n- ⚠️ ${QUEST}\n`)).toEqual({ actions: [], unread: [], unanswered: true });
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
    // Each note is true of a list that is new this week as well as of an older one.
    expect(note(unread('chunk picker'))).toBe("- That check could not read the Chunk Picker's changes, so the list may be missing something from there and nothing from there was taken off it.");
    expect(note(unread('quests', 'collection log'))).toBe('- That check could not read the quest list and the collection log, so the list may be missing something from there and nothing from there was taken off it.');
    expect(note(unread('collection log', 'combat achievements', 'quests'))).toBe('- That check could not read the quest list, the Combat Achievements and the collection log, so the list may be missing something from there and nothing from there was taken off it.');
    expect(note(NOTHING_READ)).toBe('- That check did not run to the end, so the list may be missing something and nothing was taken off it.');
    expect(note(READ_EVERYTHING)).toBeUndefined();
    // A list that was cut may have lost a kept line to the cut, so its note
    // does not say that nothing was taken off.
    const cut = (parts: { all: boolean; parts: string[] }) => issueBody({ items: [QUEST], more: 3, date: DATE, unread: parts }).split('\n').find((line) => line.startsWith('- That check'));
    expect(cut(unread('quests'))).toBe('- That check could not read the quest list, so the list may be missing something from there.');
    expect(cut(NOTHING_READ)).toBe('- That check did not run to the end, so the list may be missing something.');
    expect(cut(READ_EVERYTHING)).toBeUndefined();
  });

  it('writes a text that is true of an open issue, of one closed by hand and of one with nothing left', () => {
    const runUrl = 'https://github.com/owner/tracker/actions/runs/4711';
    const open = issueBody({ items: [QUEST], date: DATE });
    expect(open).toContain('It finds it by its `content-sync` label and writes this text anew every week while the issue is open, so put your own notes in a comment.');
    expect(open).toContain('If you close it yourself, it stays quiet until something new appears.');
    const closed = issueBody({ items: [QUEST], date: DATE, runUrl, closed: true });
    expect(itemsFromBody(closed)).toEqual([QUEST]);
    expect(closed).toContain(`- The check last changed this list on 2026-11-26 ([run](${runUrl})).`);
    expect(closed).toContain('This issue is closed, so the weekly check stays quiet about what it lists. It takes off the list what gets done, and it opens a new issue when it finds something new.');
    expect(closed).not.toMatch(/Last checked on|adds a comment|If you close it yourself/);
    // Nothing left: the same text whoever closed the issue, with a date that cannot go stale.
    const empty = issueBody({ items: [], date: DATE, runUrl });
    expect(empty.split('\n')[0]).toBe(`The weekly check of the OSRS Wiki on 2026-11-26 found nothing left on this list ([run](${runUrl})).`);
    expect(itemsFromBody(empty)).toEqual([]);
    expect(empty).toContain('_Nothing is left on this list._');
    expect(empty).toContain('A new issue opens when the check finds something again.');
    expect(issueBody({ items: [], date: DATE, runUrl, closed: true, branchUrl: `${runUrl}/branch` })).toBe(empty);
    expect(empty).not.toMatch(/Last checked|To act on it|found something|could not read|did not run to the end|keeps this issue/);
    // Nothing left in a week another part could not be read: the text says
    // so, and says nothing about what was taken off.
    const emptyUnread = issueBody({ items: [], date: DATE, runUrl, unread: unread('quests') });
    expect(emptyUnread.split('\n').slice(0, 4)).toEqual([
      `The weekly check of the OSRS Wiki on 2026-11-26 found nothing left on this list ([run](${runUrl})).`,
      '',
      'That check could not read the quest list, so the list may be missing something from there.',
      '',
    ]);
    expect(itemsFromBody(emptyUnread)).toEqual([]);
    expect(emptyUnread.replace('That check could not read the quest list, so the list may be missing something from there.\n\n', '')).toBe(empty);
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
    // One of ours that lost its list to an edit is still ours, by its title.
    const damaged = { ...ourIssue(6, 'open', [QUEST]), body: 'Edited by hand, and the list is gone.' };
    expect(latestAlert([stray, damaged, ourIssue(5, 'closed', [CHUNKS])])?.number).toBe(6);
    expect(latestAlert([{ ...stray, title: 'Another title' }, { ...damaged, pull_request: {} }])).toBeNull();
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
    // Whether the app is behind or ahead moves with the app's count too. The
    // lines are the check's own, so a change of its words shows up here.
    const tasks = (app: number, wiki = 42) => buildReport({
      quests: { app: 217, official: 191, appQuestPoints: 354, wiki: { total: 191, p2p: 167, f2p: 24, questPoints: 354 } },
      cas: { app: { Easy: app }, wiki: { Easy: wiki } },
      diaries: { app: {} },
    }).actions.map(tidy);
    expect(tasks(41)).toEqual([CA]);
    expect(tasks(43)).toEqual(['Combat Achievements · Easy: wiki 42, app 43 (app ahead).']);
    expect(newsKey(tasks(43)[0])).toBe(newsKey(CA));
    expect(newsKey(tasks(43, 44)[0])).not.toBe(newsKey(CA));
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
    expect(step.body.split('\n')[0]).toBe('The weekly check of the OSRS Wiki on 2026-11-26 found nothing left on this list.');
    expect(step.body).toContain('_Nothing is left on this list._');
    expect(step.body).not.toMatch(/To act on it|found something|Last checked/);
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
    // The tracker overshoots: "behind" becomes "ahead", and the Wiki has not moved.
    const ahead = 'Combat Achievements · Easy: wiki 42, app 43 (app ahead).';
    const overshot = steps([ahead], ourIssue(7, 'open', [CA]));
    expect(overshot.map((step) => step.type)).toEqual(['edit']);
    expect(listed(overshot[0])).toEqual([ahead]);
    expect(plan([CA], ourIssue(7, 'open', [ahead]))).toEqual(['edit']);
    expect(plan([ahead], ourIssue(7, 'closed', [CA]))).toEqual([]);
  });

  it('keeps the lines of a part it could not read, and only those', () => {
    const open = ourIssue(7, 'open', [QUEST, CHUNKS]);
    // The Chunk Picker could not be read: its line stays, the quest is done.
    const [chunks, ...rest] = steps([], open, unread('chunk picker'));
    expect(rest).toEqual([]);
    expect(chunks.type).toBe('edit');
    expect(listed(chunks)).toEqual([CHUNKS]);
    expect(chunks.body).toContain("- That check could not read the Chunk Picker's changes, so the list may be missing something from there and nothing from there was taken off it.");
    // The other way round.
    expect(listed(steps([], open, unread('quests'))[0])).toEqual([QUEST]);
    // Nothing was read to the end: nothing comes off, and news still goes out.
    const none = steps([], open, NOTHING_READ);
    expect(none.map((step) => step.type)).toEqual(['edit']);
    expect(listed(none[0])).toEqual([QUEST, CHUNKS]);
    expect(none[0].body).toContain('- That check did not run to the end, so the list may be missing something and nothing was taken off it.');
    const grown = steps([CA], open, NOTHING_READ);
    expect(grown.map((step) => step.type)).toEqual(['comment', 'edit']);
    expect(grown[0].body).toContain(`- \`${CA}\``);
    expect(listed(grown[1])).toEqual([CA, QUEST, CHUNKS]);
  });

  it('closes once every line was looked at, even when another part could not be read, and says so', () => {
    expect(plan([], ourIssue(7, 'open', [QUEST]), unread('chunk picker'))).toEqual(['close']);
    const [close] = steps([], ourIssue(7, 'open', [QUEST]), unread('chunk picker'));
    const unreadPart = "That check could not read the Chunk Picker's changes, so the list may be missing something from there.";
    expect(close.comment!.split('\n').slice(0, 5)).toEqual([
      'The weekly check on 2026-11-26 found nothing left on this list, so this issue is closed. A new one opens when the check finds something again.',
      '',
      unreadPart,
      '',
      'This came off the list:',
    ]);
    expect(close.body.split('\n')[2]).toBe(unreadPart);
    // In a week that read everything neither text has such a line.
    const [plain] = steps([], ourIssue(7, 'open', [QUEST]));
    expect(`${plain.comment}${plain.body}`).not.toMatch(/could not read|did not run to the end/);
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
    // The whole text is written anew, for a closed issue, so that it never
    // describes another week than its list.
    expect(step.body).toContain('- The check last changed this list on 2026-11-26.');
    expect(step.body).toContain('This issue is closed, so the weekly check stays quiet about what it lists.');
    expect(step.body).not.toMatch(/Last checked on|2026-11-19|keeps this issue/);
    expect(plan([QUEST, CHUNKS], { ...closed, body: step.body })).toEqual(['create']);
    // Everything is done: the closed issue says so and no longer reads as work to do.
    const [emptied, ...none] = steps([], closed);
    expect(none).toEqual([]);
    expect(emptied).toMatchObject({ type: 'edit', number: 7 });
    expect(listed(emptied)).toEqual([]);
    expect(emptied.body.split('\n')[0]).toBe('The weekly check of the OSRS Wiki on 2026-11-26 found nothing left on this list.');
    expect(emptied.body).not.toMatch(/found something|To act on it|Last checked/);
    expect(plan([], { ...closed, body: emptied.body })).toEqual([]);
    // While only the tracker's count moves, the closed issue is left as it is.
    expect(plan([questCount(191, 190)], ourIssue(7, 'closed', [questCount(191, 189)]))).toEqual([]);
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
    expect(fresh.body).toContain('- That check could not read the quest list, so the list may be missing something from there and nothing from there was taken off it.');
    // A new issue in a week that did not run to the end: its note is true of a new list too.
    const [first] = steps([CA], null, NOTHING_READ);
    expect(first.type).toBe('create');
    expect(first.body).toContain('- That check did not run to the end, so the list may be missing something and nothing was taken off it.');
  });

  describe('with more than one issue can show', () => {
    const bytes = (list: string[]) => list.reduce((sum, item) => sum + Buffer.byteLength(item) + 8, 0);
    const long = (name: string, count: number) => Array.from({ length: count }, (_, index) => `Collection log, new item: [${name}] ${index} ${'é'.repeat(120)}`);
    const moreNote = (count: number) => `\n_${count} more did not fit here. The run's summary has everything the check found this week._\n`;
    const many = long('Yama', 400);
    const [created] = steps(many, null);
    const shown = listed(created)!;
    const open = { number: 7, state: 'open', title: ALERT_ISSUE_TITLE, body: created.body };

    it('cuts the list at a whole line and carries the rest as a count, never as an item', () => {
      expect(created.type).toBe('create');
      expect(shown.length).toBeGreaterThan(100);
      expect(shown).toEqual(many.slice(0, shown.length));
      expect(bytes(shown)).toBeLessThanOrEqual(40_000);
      expect(bytes(many.slice(0, shown.length + 1))).toBeGreaterThan(40_000);
      expect(created.body).toContain(moreNote(400 - shown.length));
      // The text GitHub gets stays below what it takes, and reads back whole.
      expect(Buffer.byteLength(created.body)).toBeLessThan(65_536);
      expect(itemsFromBody(issueBody({ items: [QUEST], more: 7, date: DATE }))).toEqual([QUEST]);
    });

    it('says nothing while the same long list stands, although part of it was never named', () => {
      const again = steps(many, open);
      expect(again.map((step) => step.type)).toEqual(['edit']);
      expect(listed(again[0])).toEqual(shown);
      expect(plan(many, { ...open, state: 'closed' })).toEqual([]);
    });

    it('names what is new at the top of a full list, and never more than the list shows', () => {
      // The check's own order puts its actions first, so they are always named.
      // Together these three take more room than one of the long lines.
      const news = [QUEST, CA, questCount(192, 190)];
      expect(bytes(news)).toBeGreaterThan(bytes([many[0]]));
      const [comment, edit, ...rest] = steps([...news, ...many], open);
      expect(rest).toEqual([]);
      expect(itemsFromBody(`<!-- content-sync-alert:items -->\n${comment.body}\n<!-- /content-sync-alert:items -->`)).toEqual(news);
      const next = listed(edit)!;
      expect(next.slice(0, 3)).toEqual(news);
      expect(next.slice(3)).toEqual(many.slice(0, next.length - 3));
      expect(edit.body).toContain(moreNote(403 - next.length));
      expect(Buffer.byteLength(edit.body)).toBeLessThan(65_536);
      // What the cut pushed off the list is forgotten, so it is told again once
      // it fits: telling twice beats not telling.
      const pushedOff = shown.filter((item) => !next.includes(item));
      expect(pushedOff.length).toBeGreaterThan(0);
      const later = steps(many, { ...open, body: edit.body });
      expect(later.map((step) => step.type)).toEqual(['comment', 'edit']);
      expect(itemsFromBody(`<!-- content-sync-alert:items -->\n${later[0].body}\n<!-- /content-sync-alert:items -->`)).toEqual(pushedOff);
    });

    it('lets the lines of an unread part give way to this week\'s, and counts them', () => {
      const old = long('Old', 100);
      const fresh = long('New', 100);
      const [edit] = planAlert({ items: fresh, unread: NOTHING_READ, latest: ourIssue(7, 'open', old), date: DATE }).slice(-1);
      const kept = listed(edit)!;
      expect(kept.slice(0, 100)).toEqual(fresh);
      expect(kept.slice(100)).toEqual(old.slice(0, kept.length - 100));
      expect(kept.length).toBeLessThan(200);
      expect(edit.body).toContain(moreNote(200 - kept.length));
      expect(Buffer.byteLength(edit.body)).toBeLessThan(65_536);
      // Kept lines are among what did not fit, so the text does not say that
      // nothing was taken off, nor that this week's report has them.
      expect(edit.body).toContain('\n- That check did not run to the end, so the list may be missing something.\n');
      expect(edit.body).not.toMatch(/nothing was taken off|nothing from there was taken off|full report/);
    });
  });

  it('ignores a labelled issue that is not one of its own', () => {
    const stray = { number: 9, state: 'open', body: 'A player report someone labelled by hand.' };
    expect(plan([QUEST], stray)).toEqual(['create']);
    expect(plan([], stray)).toEqual([]);
  });

  it('gives an issue of its own that lost its list the list back, instead of opening a second one', () => {
    // The owner edited the text and the markers went with it. The title still says whose it is.
    const damaged = { ...ourIssue(7, 'open', [QUEST]), body: 'My own notes instead of the list.' };
    const [comment, edit, ...rest] = steps([QUEST, CA], damaged);
    expect(rest).toEqual([]);
    expect(comment).toMatchObject({ type: 'comment', number: 7 });
    expect(comment.body).toContain(`- \`${QUEST}\``);
    expect(comment.body).toContain(`- \`${CA}\``);
    expect(edit).toMatchObject({ type: 'edit', number: 7 });
    expect(listed(edit)).toEqual([QUEST, CA]);
    // With nothing to list after a check that read everything it is closed,
    // and nothing is said to have come off.
    const [close] = steps([], damaged);
    expect(close).toMatchObject({ type: 'close', number: 7 });
    expect(close.comment).not.toContain('This came off the list');
    expect(listed(close)).toEqual([]);
    // A week that did not read everything cannot tell whether what it listed
    // is done, so that week leaves it alone instead of calling it done.
    expect(plan([], damaged, unread('quests'))).toEqual([]);
    expect(plan([], damaged, unread('chunk picker'))).toEqual([]);
    expect(plan([], damaged, NOTHING_READ)).toEqual([]);
    // What such a week did find is listed, and told.
    expect(plan([CA], damaged, unread('quests'))).toEqual(['comment', 'edit']);
    // An issue whose list is there, though empty, is closed as before.
    expect(plan([], { ...damaged, body: issueBody({ items: [], date: DATE }) }, unread('quests'))).toEqual(['close']);
    // A closed one has told nothing, so anything current is news for a new issue.
    expect(plan([QUEST], { ...damaged, state: 'closed' })).toEqual(['create']);
    expect(plan([], { ...damaged, state: 'closed' })).toEqual([]);
  });

  it('takes an older issue the owner opened again as the one in use, and tells it the current list', () => {
    // #2 listed the quest and was closed by hand; then #1, long done, is opened again.
    const reopened = { ...ourIssue(1, 'open', []), body: issueBody({ items: [], date: '2026-11-12' }) };
    const latest = latestAlert([reopened, ourIssue(2, 'closed', [QUEST])]);
    expect(latest?.number).toBe(1);
    const [comment, edit] = steps([QUEST], latest);
    expect(comment).toMatchObject({ type: 'comment', number: 1 });
    expect(comment.body).toContain(`- \`${QUEST}\``);
    expect(listed(edit)).toEqual([QUEST]);
    // From then on that issue carries the list, and says it once.
    expect(plan([QUEST], { ...reopened, body: edit.body })).toEqual(['edit']);
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
    expect(result).toEqual({ items: [QUEST, CHUNKS], unread: READ_EVERYTHING, did: ['opened issue #1, assigned to owner'] });
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
    // Week 7: the export was reviewed and re-pinned. Nothing is left: the
    // issue is closed, with a comment that says what came off.
    expect(await play([], { pin: NEXT_PIN })).toEqual(['PATCH /issues/1', 'POST /issues/1/comments']);
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
    expect(github.issues[0].body).toContain('This issue is closed, so the weekly check stays quiet about what it lists.');
    expect(github.comments).toEqual([]);

    // A new quest: a new issue, which lists everything that needs doing.
    await run(week([QUEST, CHUNK_ACTION]), github.fetchFn, NOW, quiet());
    expect(github.writes()).toEqual(['PATCH /issues/4', 'POST /issues']);
    expect(itemsFromBody(github.issues[1].body)).toEqual([QUEST, CHUNKS]);
  });

  it('gives its issue the list back after an edit that lost it, instead of opening a second one', async () => {
    const github = fakeGitHub();
    await run(week([QUEST]), github.fetchFn, NOW, quiet());
    github.issues[0].body = 'My own notes. The list went with the edit.';
    await run(week([QUEST, CA]), github.fetchFn, NOW, quiet());
    expect(github.issues).toHaveLength(1);
    expect(itemsFromBody(github.issues[0].body)).toEqual([QUEST, CA]);
    // It has to say the whole list again, once: it no longer knows what it told.
    expect(github.comments).toHaveLength(1);
    expect(github.comments[0].body).toContain(`- \`${QUEST}\``);
    await run(week([QUEST, CA]), github.fetchFn, NOW, quiet());
    expect(github.comments).toHaveLength(1);
    expect(github.writes()).toEqual(['POST /labels', 'POST /issues', 'POST /issues/1/comments', 'PATCH /issues/1', 'PATCH /issues/1']);
  });

  it('does not close an issue that lost its list in a week it could not read everything', async () => {
    const github = fakeGitHub();
    await run(week([QUEST]), github.fetchFn, NOW, quiet());
    github.issues[0].body = 'My own notes. The list went with the edit.';
    const written = github.writes().length;
    // The quest list is down, then a sync step fails: neither week can say
    // that the quest is done, so neither closes the issue or says a word.
    await run(week([QUESTS_DOWN]), github.fetchFn, NOW, quiet());
    await run(week([], { outcome: 'failure' }), github.fetchFn, NOW, quiet());
    expect(github.writes().slice(written)).toEqual([]);
    expect(github.issues[0]).toMatchObject({ state: 'open', body: 'My own notes. The list went with the edit.' });
    // The next week reads everything: the same issue gets its list back.
    await run(week([QUEST]), github.fetchFn, NOW, quiet());
    expect(github.issues).toHaveLength(1);
    expect(github.issues[0].state).toBe('open');
    expect(itemsFromBody(github.issues[0].body)).toEqual([QUEST]);
    expect(github.writes().slice(written)).toEqual(['POST /issues/1/comments', 'PATCH /issues/1']);
  });

  it('never calls an open issue closed, and never says twice that it closed one', async () => {
    // The issue is closed first and the comment follows.
    const github = fakeGitHub({ issues: [ourIssue(4, 'open', [QUEST])] });
    github.broken = { method: 'PATCH', path: '/issues/4', status: 502 };
    await expect(run(week([]), github.fetchFn, NOW, quiet())).rejects.toThrow(/Closing the alert issue failed: GitHub answered 502/);
    expect(github.issues[0].state).toBe('open');
    expect(github.comments).toEqual([]);
    // The next run closes it, and says so once.
    github.broken = null;
    await run(week([]), github.fetchFn, NOW, quiet());
    expect(github.issues[0].state).toBe('closed');
    expect(github.comments).toHaveLength(1);
    expect(github.comments[0].body).toContain('so this issue is closed');

    // The comment fails once the issue is closed: it stays closed, and the next run adds nothing.
    const other = fakeGitHub({ issues: [ourIssue(4, 'open', [QUEST])] });
    other.broken = { method: 'POST', path: '/issues/4/comments', status: 502 };
    await expect(run(week([]), other.fetchFn, NOW, quiet())).rejects.toThrow(/Commenting on the closed alert issue failed: GitHub answered 502/);
    expect(other.issues[0].state).toBe('closed');
    other.broken = null;
    await run(week([]), other.fetchFn, NOW, quiet());
    expect(other.writes()).toEqual(['PATCH /issues/4', 'POST /issues/4/comments']);
    expect(other.comments).toEqual([]);
  });

  it('does not fail for good should GitHub refuse a list by a label that does not exist yet', async () => {
    const github = fakeGitHub({ strictLabels: true });
    // Nothing to say and no label: nothing is written, and the run does not fail.
    expect((await run(week([]), github.fetchFn, NOW, quiet())).did).toEqual([]);
    expect(github.writes()).toEqual([]);
    const result = await run(week([QUEST]), github.fetchFn, NOW, quiet());
    expect(result.did).toEqual(['opened issue #1, assigned to owner']);
    // Once the label is there the list is read again, and a refusal is a failure.
    await run(week([QUEST]), github.fetchFn, NOW, quiet());
    expect(github.writes()).toEqual(['POST /labels', 'POST /issues', 'PATCH /issues/1']);
    github.broken = { method: 'GET', path: `/issues?labels=${ALERT_LABEL}&state=all&per_page=50`, status: 422 };
    await expect(run(week([QUEST]), github.fetchFn, NOW, quiet())).rejects.toThrow(/Listing the alert issues failed: GitHub answered 422/);
    expect(github.writes()).toEqual(['POST /labels', 'POST /issues', 'PATCH /issues/1']);
  });

  it('never takes an answer it cannot read for "no alert issue yet"', async () => {
    const listing = `/issues?labels=${ALERT_LABEL}&state=all&per_page=50`;
    // A repository the run cannot see answers "not found" to everything, also
    // to the question about the label. That is a failure in a week with
    // something to say and in a week with nothing.
    const unseen = fakeGitHub({ issues: [ourIssue(1, 'open', [QUEST])], strictLabels: true });
    unseen.hidden = true;
    await expect(run(week([QUEST, CA]), unseen.fetchFn, NOW, quiet())).rejects.toThrow(/Listing the labels failed: GitHub answered 404/);
    await expect(run(week([]), unseen.fetchFn, NOW, quiet())).rejects.toThrow(/Listing the labels failed: GitHub answered 404/);
    expect(unseen.calls.map((call) => `${call.method} ${call.path}`).slice(0, 3)).toEqual([`GET ${listing}`, `GET /labels/${ALERT_LABEL}`, 'GET /labels?per_page=1']);
    expect(unseen.writes()).toEqual([]);
    unseen.hidden = false;
    await run(week([QUEST, CA]), unseen.fetchFn, NOW, quiet());
    expect(unseen.writes()).toEqual(['POST /issues/1/comments', 'PATCH /issues/1']);
    // An answer that is no list is not an empty list: no second issue opens.
    const odd = fakeGitHub({ issues: [ourIssue(1, 'open', [QUEST])] });
    odd.broken = { method: 'GET', path: listing, status: 200 };
    await expect(run(week([QUEST, CA]), odd.fetchFn, NOW, quiet())).rejects.toThrow(/Listing the alert issues failed: GitHub did not answer with a list/);
    expect(odd.writes()).toEqual([]);
    expect(odd.issues).toHaveLength(1);
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
    expect(lines).toContain('[sync:alert] the check lists 2 item(s) this week.');
    expect(lines).toContain('[sync:alert]   ::error::made up');
    expect(lines).toContain('[sync:alert] That check could not read the quest list, so the list may be missing something from there.');
    expect(lines).toContain('[sync:alert] opened issue #1, assigned to owner');
    expect(lines.every((line) => line.startsWith('[sync:alert] '))).toBe(true);
  });

  it('prints no more of a long list than one issue shows', async () => {
    const many = Array.from({ length: 400 }, (_, index) => `Quests: "Quest ${index} ${'é'.repeat(120)}" (quest)`);
    const log = vi.fn();
    const github = fakeGitHub();
    const result = await run(week(many), github.fetchFn, NOW, log);
    const lines = log.mock.calls.map(([line]) => String(line));
    expect(result.items).toEqual(many);
    expect(lines).toContain('[sync:alert] the check lists 400 item(s) this week.');
    const printed = lines.filter((line) => line.startsWith('[sync:alert]   Quests: '));
    expect(printed.length).toBeGreaterThan(100);
    expect(lines).toContain(`[sync:alert]   and ${400 - printed.length} more.`);
    // The issue shows the same lines, and GitHub is sent a text it takes.
    expect(itemsFromBody(github.issues[0].body)).toEqual(many.slice(0, printed.length));
    expect(String(github.issues[0].body).length).toBeLessThan(65_536);
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
      'GET /labels/${ALERT_LABEL}',
      'GET /labels?per_page=1',
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
