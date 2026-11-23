// Keeps one GitHub issue in step with the weekly content check
// (.github/workflows/sync-content.yml), so that what the check finds reaches
// the owner as a GitHub notification.
//
// The check writes what needs doing under "## Action needed" in
// docs/SYNC_STATUS.md, and the job's report (sync-report.md) lists what the
// collection log sync found. This script reads both, as the sync job handed
// them over, and then keeps one issue in step:
//   - it opens an issue, assigned to the repository owner, when something
//     shows up that the last alert issue did not list;
//   - it adds a comment to the open issue when something new joins its list;
//   - it closes the open issue when nothing is left.
// The list in the newest alert issue is the only memory, so an issue the owner
// closed by hand stays closed until something new shows up.
//
// It runs in a job that may write issues, so it uses Node's own modules only:
// no npm package ever runs with that token. Everything the check produced is
// handled as text and shown as code, where GitHub renders nothing: no mention,
// no link, no reference to another issue.
//
// Environment:
//   ALERT_REPORT_DIR     the folder with the sync job's docs/SYNC_STATUS.md
//                        and sync-report.md.
//   ALERT_SYNC_OUTCOME   'success' when every sync step ran to the end.
//   ALERT_BRANCH_PUSHED  'true' when this run pushed bot/wiki-content-sync.
//   GITHUB_TOKEN         a token that may write issues.
//   GITHUB_REPOSITORY, GITHUB_REPOSITORY_OWNER, GITHUB_SERVER_URL,
//   GITHUB_RUN_ID        set by Actions.
import { lstatSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Every alert issue carries this label; it is how the next run finds the issue again. */
export const ALERT_LABEL = 'content-sync';
export const ALERT_ISSUE_TITLE = 'Weekly game update check: action needed';
const LIST_START = '<!-- content-sync-alert:items -->';
const LIST_END = '<!-- /content-sync-alert:items -->';
const NOTHING_LEFT = '_Nothing is left on this list._';
const GITHUB_API = 'https://api.github.com';
const MAX_ITEM_LENGTH = 300;
// The bytes of list one issue shows. GitHub takes 65,536 characters for the
// whole text; real weeks stay far below this, so the cut only guards against
// junk.
const LIST_BUDGET = 40_000;
const MAX_FILE_BYTES = 2_000_000;
const REPOSITORY_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const LOGIN_RE = /^[A-Za-z0-9-]+$/;
const LINK_RE = /^https:\/\/[A-Za-z0-9_.:/-]+$/;

// The notes check-content-sync.mjs writes when it could not read a source.
// They mean "unknown this week", never "something to add".
const UNAVAILABLE = /unavailable(?:; retry the content check)?$/;
const CLOG_KINDS = { RENAME: 'rename', ADD: 'new item', MOVE: 'moved item', '?': 'possible rename', '+': 'new page' };

// The parts of the check, told apart by how check-content-sync.mjs and this
// script begin their lines. A part that could not be read one week keeps its
// own lines on the list and leaves the other parts alone.
const PARTS = [
  { part: 'quests', name: 'the quest list', pattern: /^(?:Quest|Comparable official quest)/ },
  { part: 'combat achievements', name: 'the Combat Achievements', pattern: /^Combat Achievement/ },
  { part: 'chunk picker', name: 'the Chunk Picker', pattern: /^Chunk Picker/ },
  { part: 'collection log', name: 'the collection log', pattern: /^Collection log/ },
];
const partOf = (text) => PARTS.find(({ pattern }) => pattern.test(text))?.part ?? null;

/** A week in which the check read everything. */
export const READ_EVERYTHING = Object.freeze({ all: false, parts: Object.freeze([]) });
const complete = (unread) => !unread.all && unread.parts.length === 0;
/** Whether this week's check looked at the part a line comes from. */
const lookedAt = (unread, item) => {
  if (unread.all) return false;
  const part = partOf(item);
  return part ? !unread.parts.includes(part) : unread.parts.length === 0;
};

/** The UTC day, as YYYY-MM-DD. */
export const utcDay = (now) => new Date(now).toISOString().slice(0, 10);

/**
 * One line of plain text that cannot end the code span or the list markers it
 * is shown between, whatever the Wiki contains. Tidying twice changes nothing.
 */
export const tidy = (text) => {
  const line = String(text)
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2069\ufeff]+/g, ' ')
    .replace(/`+/g, "'")
    .replace(/<!--/g, '<!- -')
    .replace(/-->/g, '- ->')
    .replace(/\s+/g, ' ')
    .trim();
  const characters = [...line];
  if (characters.length <= MAX_ITEM_LENGTH) return line;
  return `${characters.slice(0, MAX_ITEM_LENGTH - 1).join('').trimEnd()}\u2026`;
};

/**
 * What makes a line the same piece of news from week to week. The app's own
 * count moves as the work gets done ("wiki 191, app 189", then "app 190"), so
 * it is left out: only a change on the Wiki's side is news.
 */
export const newsKey = (item) => String(item).replace(/\bapp \d+\b/g, 'app N');

const unique = (items) => [...new Set(items.filter(Boolean))];

/**
 * As many items as one issue can show, in order, and how many were left out.
 * Counted in bytes, which is never less than the number of characters.
 */
const fit = (items) => {
  const shown = [];
  let used = 0;
  for (const item of items) {
    used += Buffer.byteLength(item) + 8;
    if (used > LIST_BUDGET) break;
    shown.push(item);
  }
  return { shown, more: items.length - shown.length };
};

/** The lines under a Markdown heading, up to the next heading; null when the heading is missing. */
const section = (text, heading) => {
  const lines = String(text ?? '').split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start < 0) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^#{1,6}\s/.test(line));
  return end < 0 ? rest : rest.slice(0, end);
};

/**
 * docs/SYNC_STATUS.md -> the actions it lists, and the parts of the check it
 * says it could not read. `unanswered` says the file does not hold an answer
 * at all, or holds a note this script cannot place.
 */
export function parseStatus(markdown) {
  const lines = section(markdown, '## Action needed');
  if (!lines) return { actions: [], unread: [], unanswered: true };
  const actions = [];
  const unread = [];
  let answered = false;
  let unplaced = false;
  for (const line of lines) {
    if (/^- \u2705 /u.test(line)) answered = true;
    // With the s flag a stray line break inside the text reaches tidy() too.
    const match = line.match(/^- \u26a0\ufe0f? (.+)$/su);
    if (!match) continue;
    answered = true;
    const text = tidy(match[1]);
    if (!UNAVAILABLE.test(text)) actions.push(text);
    else if (partOf(text)) unread.push(partOf(text));
    else unplaced = true;
  }
  return { actions: unique(actions), unread: unique(unread), unanswered: unplaced || !answered };
}

/**
 * The job's report (sync-report.md) -> what the collection log sync found,
 * whether that sync ran to the end, whether the check wrote the status file
 * in this run, and what it printed about the Chunk Picker: the reviewed pin,
 * and whether it could compare the export.
 */
export function parseReport(report) {
  const lines = section(report, '## Collection log') ?? [];
  // A sync that ran to the end always prints its totals.
  const finished = lines.some((line) => /\[clog:sync\] renames \d+/.test(line));
  const failed = lines.some((line) => /\[clog:sync\] failed/.test(line));
  const collectionLog = [];
  for (const line of lines) {
    const match = line.match(/^\s*(RENAME|ADD|MOVE|\?|\+)\s+(.+)$/s);
    if (!match) continue;
    // Slot ids and item counts shift from week to week; the name is what matters.
    const what = match[2].replace(/\s*\((?:#\d+|\d+ items?)\)\s*$/, '');
    collectionLog.push(tidy(`Collection log, ${CLOG_KINDS[match[1]]}: ${what}`));
  }
  const freshness = section(report, '## Freshness check') ?? [];
  // The check prints its quest counts right after it has written the status
  // file, so this line proves the file is this run's, not the committed one.
  const written = freshness.some((line) => /^\[content:check\] quests wiki=(?:\d+|\?) app=\d+\s*$/.test(line));
  let chunkPicker = null;
  for (const line of freshness) {
    const match = line.match(/^\[content:check\] Chunk Picker pinned=([0-9a-f]{7,40}) upstream=[0-9a-f]{7,40} exportChanged=(true|false|\?)\s*$/);
    if (match) chunkPicker = { pin: match[1].slice(0, 7), compared: match[2] !== '?' };
  }
  return { collectionLog: unique(collectionLog), unread: failed || !finished ? ['collection log'] : [], written, chunkPicker };
}

/**
 * Everything that needs doing this week, in a stable order: `items` are the
 * lines one issue can show, `more` counts what did not fit, and `unread`
 * names what the check could not read.
 *
 * Throws when the check did not write the status file in this run: the file
 * is then the committed one, and an old answer is not this week's.
 */
export function currentItems({ status, report, syncOutcome }) {
  const fromReport = parseReport(report);
  if (!fromReport.written) {
    throw new Error('The content check did not write docs/SYNC_STATUS.md in this run, so there is nothing from this week to read. The log of the sync job says why.');
  }
  const fromStatus = parseStatus(status);
  const unread = new Set([...fromStatus.unread, ...fromReport.unread]);
  const actions = fromStatus.actions.flatMap((action) => {
    if (partOf(action) !== 'chunk picker') return [action];
    // The check calls the export changed when it could not compare it. That
    // is a guess: it is not news, and it takes nothing off the list either.
    if (!fromReport.chunkPicker?.compared) {
      unread.add('chunk picker');
      return [];
    }
    // The line reads the same after every re-pin, so the pin tells one
    // change of the export from the next.
    return [tidy(`${action} Reviewed pin: ${fromReport.chunkPicker.pin}.`)];
  });
  const { shown, more } = fit(unique([...actions, ...fromReport.collectionLog]));
  return {
    items: shown,
    more,
    unread: { all: fromStatus.unanswered || syncOutcome !== 'success', parts: PARTS.map(({ part }) => part).filter((part) => unread.has(part)) },
  };
}

// One bullet a line, each item as code. An item holds no backtick (tidy), so
// nothing in it can end the code span.
const bullets = (items) => items.map((item) => `- \`${tidy(item)}\``).join('\n');
// The note about what did not fit is not a bullet, so it is never read back
// as an item.
const listBlock = (items, more = 0) => [
  items.length ? bullets(items) : NOTHING_LEFT,
  ...(more > 0 ? ['', `_${more} more did not fit here; the report on the run lists them._`] : []),
].join('\n');

const listOf = (names) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names.join(''));
const unreadNote = (unread) => {
  if (unread.all) return 'That check did not run to the end, so nothing was taken off the list.';
  const names = PARTS.filter(({ part }) => unread.parts.includes(part)).map(({ name }) => name);
  return names.length ? `That check could not read ${listOf(names)}, so nothing from there was taken off the list.` : '';
};

export function issueBody({ items, more = 0, date, runUrl = '', branchUrl = '', unread = READ_EVERYTHING }) {
  const checked = `- Last checked on ${date}${runUrl ? ` ([run](${runUrl}))` : ''}.`;
  if (!items.length) {
    return [
      'The weekly check of the OSRS Wiki closed this issue.',
      '',
      LIST_START,
      '',
      listBlock([]),
      '',
      LIST_END,
      '',
      checked,
      '',
      'A new issue opens when the check finds something again.',
      '',
    ].join('\n');
  }
  const note = unreadNote(unread);
  return [
    'The weekly check of the OSRS Wiki found something the tracker does not have yet, or that needs a review.',
    '',
    LIST_START,
    '',
    listBlock(items, more),
    '',
    LIST_END,
    '',
    checked,
    ...(note ? [`- ${note}`] : []),
    ...(branchUrl ? [`- What the check itself changed is on the [\`bot/wiki-content-sync\` branch](${branchUrl}).`] : []),
    '- To act on it, start a content update: `docs/CONTENT_SYNC.md` describes the steps.',
    '',
    'The weekly check keeps this issue. It adds a comment when it finds something new and closes the issue when nothing is left. If you close it yourself, it stays quiet until something new appears.',
    '',
  ].join('\n');
}

/** The list an alert issue shows, or null when the body is not one of ours. */
export function itemsFromBody(body) {
  const text = String(body ?? '');
  const start = text.indexOf(LIST_START);
  if (start < 0) return null;
  const end = text.indexOf(LIST_END, start + LIST_START.length);
  if (end < 0) return null;
  const items = [];
  for (const line of text.slice(start + LIST_START.length, end).split(/\r?\n/)) {
    const match = line.trim().match(/^- `(.+)`$/s);
    if (match) items.push(tidy(match[1]));
  }
  return unique(items);
}

/** The same issue text with another list. Only for a body itemsFromBody() can read. */
const withList = (body, items) => {
  const text = String(body);
  const start = text.indexOf(LIST_START) + LIST_START.length;
  const end = text.indexOf(LIST_END, start);
  return `${text.slice(0, start)}\n\n${listBlock(items)}\n\n${text.slice(end)}`;
};

/** The alert issue to keep: the newest open one that carries our list, else the newest closed one. */
export function latestAlert(issues) {
  const ours = (Array.isArray(issues) ? issues : [])
    .filter((issue) => issue && !issue.pull_request && Number.isInteger(issue.number) && itemsFromBody(issue.body) !== null)
    .sort((left, right) => right.number - left.number);
  return ours.find((issue) => issue.state === 'open') ?? ours[0] ?? null;
}

const newItemsComment = (fresh, date) => [
  `The weekly check on ${date} found something new:`,
  '',
  bullets(fresh),
  '',
  'The full list is at the top of this issue.',
  '',
].join('\n');

const closingComment = (gone, date) => [
  `The weekly check on ${date} found nothing left on this list, so this issue is closed. A new one opens when the check finds something again.`,
  ...(gone.length ? ['', 'This came off the list:', '', bullets(fit(gone).shown)] : []),
  '',
].join('\n');

/**
 * What to do this week, as a list of steps for GitHub. Pure: the same inputs
 * always give the same plan.
 *
 * `latest` is the issue latestAlert() picked, or null. Its list is what the
 * owner has been told and still stands, so only something that is not on it,
 * by its newsKey(), is news.
 */
export function planAlert({ items, more = 0, unread = READ_EVERYTHING, latest, date, runUrl = '', branchUrl = '' }) {
  const ours = latest && itemsFromBody(latest.body) !== null ? latest : null;
  const previous = ours ? itemsFromBody(ours.body) : [];
  const current = new Set(items.map(newsKey));
  const told = new Set(previous.map(newsKey));
  const fresh = items.filter((item) => !told.has(newsKey(item)));
  // A part the check could not read this week keeps its lines on the list.
  const stands = (item) => current.has(newsKey(item)) || !lookedAt(unread, item);
  const kept = previous.filter((item) => !current.has(newsKey(item)) && stands(item));
  const { shown: listed, more: cut } = fit([...items, ...kept]);

  if (ours?.state === 'open') {
    // An empty list means the check looked at the part every line came from
    // and found none of them: a part it could not read keeps its lines.
    if (!listed.length) {
      return [{ type: 'close', number: ours.number, comment: closingComment(previous, date), body: issueBody({ items: [], date, runUrl }) }];
    }
    return [
      // The comment goes first: if the run stops between the two, the next
      // run says it again instead of never.
      ...(fresh.length ? [{ type: 'comment', number: ours.number, body: newItemsComment(fresh, date) }] : []),
      { type: 'edit', number: ours.number, body: issueBody({ items: listed, more: more + cut, date, runUrl, branchUrl, unread }) },
    ];
  }

  // No alert issue yet, or the last one is closed: speak only for something
  // it did not list.
  if (fresh.length) {
    return [{ type: 'create', title: ALERT_ISSUE_TITLE, body: issueBody({ items: listed, more: more + cut, date, runUrl, branchUrl, unread }) }];
  }
  // What is done comes off the closed issue's list without a word, so that the
  // same thing coming back later counts as new.
  const standing = previous.filter(stands);
  if (ours && standing.length < previous.length) {
    return [{ type: 'edit', number: ours.number, body: withList(ours.body, standing) }];
  }
  return [];
}

/** A plain file's text. A missing file, a link or something huge is an error, not an empty answer. */
function readText(path) {
  const stat = lstatSync(path, { throwIfNoEntry: false });
  if (!stat?.isFile() || stat.size > MAX_FILE_BYTES) {
    throw new Error(`The sync job's ${basename(path)} is missing or is not a plain file.`);
  }
  return readFileSync(path, 'utf8');
}

/** Calls the repository's REST API and gives back the status and the parsed reply. */
const githubApi = ({ repository, token }, fetchFn) => async (method, path, body) => {
  const response = await fetchFn(`${GITHUB_API}/repos/${repository}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      // GitHub's API refuses a request that does not say who is asking.
      'User-Agent': 'content-sync-alert',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  let json = null;
  try { json = await response.json(); } catch { /* no body, as on a 204 */ }
  return { ok: response.ok, status: response.status, json };
};

const must = (reply, what) => {
  if (!reply.ok) throw new Error(`${what} failed: GitHub answered ${reply.status}.`);
  return reply;
};

/** Carries out one step of the plan and says what it did. */
async function carryOut(step, api, owner) {
  if (step.type === 'comment') {
    must(await api('POST', `/issues/${step.number}/comments`, { body: step.body }), 'Commenting on the alert issue');
    return `commented on issue #${step.number}`;
  }
  if (step.type === 'edit') {
    must(await api('PATCH', `/issues/${step.number}`, { body: step.body }), 'Refreshing the alert issue');
    return `refreshed the list in issue #${step.number}`;
  }
  if (step.type === 'close') {
    must(await api('POST', `/issues/${step.number}/comments`, { body: step.comment }), 'Commenting on the alert issue');
    must(
      await api('PATCH', `/issues/${step.number}`, { body: step.body, state: 'closed', state_reason: 'completed' }),
      'Closing the alert issue',
    );
    return `closed issue #${step.number}`;
  }

  // A new issue. The next run finds it by its label, so the label has to exist.
  if (!(await api('GET', `/labels/${ALERT_LABEL}`)).ok) {
    const made = await api('POST', '/labels', {
      name: ALERT_LABEL,
      color: '1D76DB',
      description: 'Kept by the weekly game update check',
    });
    // 422: the label is there after all.
    if (!made.ok && made.status !== 422) must(made, 'Creating the alert label');
  }
  // The assignee is how the issue reaches the owner. GitHub answers 204 when
  // the owner can be assigned and 404 when not (an organisation cannot be).
  // Anything else is a failed check: stop, so the next run tries again,
  // instead of opening an issue nobody hears of.
  let assignees = [];
  if (LOGIN_RE.test(owner)) {
    const check = await api('GET', `/assignees/${owner}`);
    if (check.status !== 204 && check.status !== 404) {
      throw new Error(`Checking whether ${owner} can be assigned failed: GitHub answered ${check.status}.`);
    }
    if (check.status === 204) assignees = [owner];
  }
  const created = must(
    await api('POST', '/issues', { title: step.title, body: step.body, labels: [ALERT_LABEL], assignees }),
    'Opening the alert issue',
  );
  // GitHub drops a label or an assignee it will not set without saying so.
  const number = created.json?.number;
  const labels = Array.isArray(created.json?.labels) ? created.json.labels : [];
  if (!labels.some((label) => (label?.name ?? label) === ALERT_LABEL)) {
    throw new Error(`Issue #${number} was opened without the ${ALERT_LABEL} label, so the next run will not find it. Add the label by hand.`);
  }
  if (!assignees.length) return `opened issue #${number} with no assignee: issues cannot be assigned to ${owner || 'the owner'}`;
  const assigned = Array.isArray(created.json?.assignees) ? created.json.assignees : [];
  if (!assigned.some((user) => String(user?.login).toLowerCase() === owner.toLowerCase())) {
    throw new Error(`Issue #${number} is open, but GitHub did not assign it to ${owner}. Assign it by hand to be told about its comments.`);
  }
  return `opened issue #${number}, assigned to ${owner}`;
}

/** One run: read what the sync job found, then bring the alert issue in step. Returns what it did. */
export async function run(env = process.env, fetchFn = fetch, now = Date.now(), log = console.log) {
  const repository = env.GITHUB_REPOSITORY ?? '';
  const token = env.GITHUB_TOKEN ?? '';
  if (!REPOSITORY_RE.test(repository) || !token) {
    throw new Error('GITHUB_REPOSITORY and GITHUB_TOKEN are needed to keep the alert issue.');
  }
  const folder = env.ALERT_REPORT_DIR ?? '';
  if (!folder) throw new Error('ALERT_REPORT_DIR is not set, so there is nothing from the sync job to read.');

  const { items, more, unread } = currentItems({
    status: readText(join(folder, 'docs', 'SYNC_STATUS.md')),
    report: readText(join(folder, 'sync-report.md')),
    syncOutcome: env.ALERT_SYNC_OUTCOME ?? '',
  });
  log(`[sync:alert] ${items.length + more} item(s) need action.`);
  for (const item of items) log(`[sync:alert]   ${item}`);
  if (!complete(unread)) log(`[sync:alert] ${unreadNote(unread)}`);

  const api = githubApi({ repository, token }, fetchFn);
  const issues = must(await api('GET', `/issues?labels=${ALERT_LABEL}&state=all&per_page=50`), 'Listing the alert issues').json;
  const server = env.GITHUB_SERVER_URL || 'https://github.com';
  const link = (url) => (LINK_RE.test(url) ? url : '');
  const plan = planAlert({
    items,
    more,
    unread,
    latest: latestAlert(issues),
    date: utcDay(now),
    runUrl: link(/^\d+$/.test(env.GITHUB_RUN_ID ?? '') ? `${server}/${repository}/actions/runs/${env.GITHUB_RUN_ID}` : ''),
    branchUrl: link(env.ALERT_BRANCH_PUSHED === 'true' ? `${server}/${repository}/compare/main...bot/wiki-content-sync` : ''),
  });

  const did = [];
  for (const step of plan) {
    did.push(await carryOut(step, api, env.GITHUB_REPOSITORY_OWNER ?? ''));
    log(`[sync:alert] ${did.at(-1)}`);
  }
  if (!plan.length) log('[sync:alert] nothing new to say.');
  return { items, more, unread, did };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await run();
  } catch (error) {
    console.log(`::error title=Game update alert failed::${tidy(error?.message ?? error).replace(/%/g, '%25')}`);
    process.exitCode = 1;
  }
}
