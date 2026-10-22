import { describe, expect, it, vi } from 'vitest';
import {
  ALERT_ISSUE_TITLE,
  KV_USAGE_QUERY,
  operationsByType,
  quotaUse,
  run,
  utcDay,
} from './relay-kv-usage.mjs';

const NOW = Date.UTC(2026, 9, 19, 21, 30);
const DAY = '2026-10-19';

/** Cloudflare's GraphQL reply for today's KV operations, as kvOperationsAdaptiveGroups gives it. */
const analytics = (counts: Record<string, number>) => ({
  data: {
    viewer: {
      accounts: [{
        kvOperationsAdaptiveGroups: Object.entries(counts).map(([actionType, requests]) => ({
          sum: { requests }, dimensions: { actionType },
        })),
      }],
    },
  },
  errors: null,
});

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

interface Call { url: string; init?: RequestInit }

/** A fetch that answers Cloudflare and GitHub like the real APIs, recording each call. */
function fakeApis(counts: Record<string, number>, issues: unknown[] = [], comments: unknown[] = []) {
  const calls: Call[] = [];
  const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (url.endsWith('/accounts?per_page=5')) return reply({ result: [{ id: 'acc123' }] });
    if (url.endsWith('/graphql')) return reply(analytics(counts));
    if (url.includes('/issues?state=open')) return reply(issues);
    if (url.match(/\/issues\/\d+\/comments\?/)) return reply(comments);
    if (url.endsWith('/issues') || url.endsWith('/comments')) return reply({}, 201);
    if (url.startsWith('https://discord.com/')) return new Response(null, { status: 204 });
    return reply({}, 404);
  });
  return { calls, fetchFn };
}

const env = (extra: Record<string, string> = {}) => ({
  CLOUDFLARE_ANALYTICS_TOKEN: 'cf-token',
  GITHUB_TOKEN: 'gh-token',
  GITHUB_REPOSITORY: 'owner/repo',
  ...extra,
});

describe('reading KV use', () => {
  it('counts the UTC day, as the free plan does', () => {
    expect(utcDay(Date.UTC(2026, 9, 19, 23, 59))).toBe('2026-10-19');
    expect(utcDay(Date.UTC(2026, 9, 20, 0, 0))).toBe('2026-10-20');
  });

  it('asks for the whole account, by operation type, for one day', () => {
    expect(KV_USAGE_QUERY).toContain('kvOperationsAdaptiveGroups(filter: { date_geq: $date, date_leq: $date }');
    expect(KV_USAGE_QUERY).toContain('accounts(filter: { accountTag: $accountTag })');
    expect(KV_USAGE_QUERY).toContain('dimensions { actionType }');
  });

  it('adds up the groups of each type', () => {
    const body = analytics({ write: 300, read: 9000, delete: 2 });
    body.data.viewer.accounts[0].kvOperationsAdaptiveGroups.push({ sum: { requests: 20 }, dimensions: { actionType: 'write' } });
    expect(operationsByType(body)).toEqual({ write: 320, read: 9000, delete: 2 });
  });

  it('fails on an error reply or no account, instead of reporting zero', () => {
    expect(() => operationsByType({ data: null, errors: [{ message: 'not authorized' }] })).toThrow(/not authorized/);
    expect(() => operationsByType({ data: { viewer: { accounts: [] } }, errors: null })).toThrow(/no account/);
  });

  it('alerts from 80% of any limited operation', () => {
    expect(quotaUse({ write: 799 }).alert).toBe(false);
    expect(quotaUse({ write: 800 }).alert).toBe(true);
    expect(quotaUse({ delete: 850, write: 10 }).rows.find((row) => row.type === 'delete')).toMatchObject({ alert: true, percent: 85 });
    expect(quotaUse({ write: 500 }, 50).alert).toBe(true);
    // Reads have 100,000 a day; they never raise this alert.
    expect(quotaUse({ read: 99_000 }).alert).toBe(false);
  });
});

describe('the hourly check', () => {
  it('does nothing, and succeeds, without the token', async () => {
    const { fetchFn } = fakeApis({});
    const log = vi.fn();
    expect(await run({}, fetchFn, NOW, log)).toEqual({ checked: false });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(log.mock.calls[0][0]).toMatch(/^::notice .*CLOUDFLARE_ANALYTICS_TOKEN/);
  });

  it('reports use under the alert level without opening anything', async () => {
    const { calls, fetchFn } = fakeApis({ write: 120, read: 4000 });
    const result = await run(env(), fetchFn, NOW, vi.fn());
    expect(result).toMatchObject({ checked: true, alert: false });
    expect(calls.map((call) => call.url)).toEqual([
      'https://api.cloudflare.com/client/v4/accounts?per_page=5',
      'https://api.cloudflare.com/client/v4/graphql',
    ]);
    const query = JSON.parse(String(calls[1].init?.body));
    expect(query.variables).toEqual({ accountTag: 'acc123', date: DAY });
    expect((calls[1].init?.headers as Record<string, string>).Authorization).toBe('Bearer cf-token');
  });

  it('uses the account id secret when it is set', async () => {
    const { calls, fetchFn } = fakeApis({ write: 1 });
    await run(env({ CLOUDFLARE_ACCOUNT_ID: 'given' }), fetchFn, NOW, vi.fn());
    expect(calls.map((call) => call.url)).toEqual(['https://api.cloudflare.com/client/v4/graphql']);
    expect(JSON.parse(String(calls[0].init?.body)).variables.accountTag).toBe('given');
  });

  it('opens one issue past 80%, and posts to Discord when a webhook is set', async () => {
    const webhook = 'https://discord.com/api/webhooks/123/abc_DEF';
    const { calls, fetchFn } = fakeApis({ write: 850 });
    const result = await run(env({ RELAY_ALERT_DISCORD_WEBHOOK: webhook }), fetchFn, NOW, vi.fn());
    expect(result).toMatchObject({ alert: true, issue: 'opened', discord: true });
    const opened = calls.find((call) => call.url === 'https://api.github.com/repos/owner/repo/issues');
    const body = JSON.parse(String(opened?.init?.body));
    expect(body.title).toBe(ALERT_ISSUE_TITLE);
    expect(body.body).toContain(`<!-- relay-kv-usage ${DAY} -->`);
    expect(body.body).toContain('| writes | 850 | 1000 | 85% ⚠️ |');
    const posted = calls.find((call) => call.url === webhook);
    expect(JSON.parse(String(posted?.init?.body)).allowed_mentions).toEqual({ parse: [] });
  });

  it('comments on the open issue once a day, and stays quiet after that', async () => {
    const issue = { number: 7, title: ALERT_ISSUE_TITLE, body: '<!-- relay-kv-usage -->\n<!-- relay-kv-usage 2026-10-18 -->' };
    const newDay = fakeApis({ write: 900 }, [issue], []);
    expect(await run(env(), newDay.fetchFn, NOW, vi.fn())).toMatchObject({ issue: 'commented' });
    expect(newDay.calls.some((call) => call.url === 'https://api.github.com/repos/owner/repo/issues/7/comments')).toBe(true);

    const sameDay = fakeApis({ write: 950 }, [issue], [{ body: `<!-- relay-kv-usage ${DAY} -->\n...` }]);
    const webhook = 'https://discord.com/api/webhooks/123/abc';
    expect(await run(env({ RELAY_ALERT_DISCORD_WEBHOOK: webhook }), sameDay.fetchFn, NOW, vi.fn()))
      .toMatchObject({ issue: 'already', discord: false });
    expect(sameDay.calls.filter((call) => call.init?.method === 'POST' && !call.url.endsWith('/graphql'))).toEqual([]);
  });

  it('fails loudly when Cloudflare refuses the token', async () => {
    const fetchFn = vi.fn(async (url: string) => (url.endsWith('/graphql')
      ? reply({ data: null, errors: [{ message: 'Authentication error' }] }, 200)
      : reply({ result: [{ id: 'acc' }] })));
    await expect(run(env(), fetchFn, NOW, vi.fn())).rejects.toThrow(/Authentication error/);
  });

  it('asks for the account id when the token reads more than one account', async () => {
    const fetchFn = vi.fn(async () => reply({ result: [{ id: 'a' }, { id: 'b' }] }));
    await expect(run(env(), fetchFn, NOW, vi.fn())).rejects.toThrow(/CLOUDFLARE_ACCOUNT_ID/);
  });
});
