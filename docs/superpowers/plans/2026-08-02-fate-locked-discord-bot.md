# Fate Locked Discord Automation Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and safely deploy a server-scoped Fate Locked Discord application on Vercel that provides official commands, run-journal creation, human-gated verification, weekly seeds, and GitHub release announcements without adding Cloudflare usage or weakening native Discord protections.

**Architecture:** A self-contained `discord-bot/` TypeScript workspace exposes two Vercel HTTP functions: one for signed Discord interactions and one for HMAC-signed GitHub automation. It uses direct Discord REST calls, stateless signed component IDs, Discord messages as workflow state, the tracker's canonical `weeklySeed()` helper, and GitHub Actions for scheduled/release triggers. Privileged role/tag mutations remain feature-gated until a genuine non-staff account can complete the live workflow test.

**Tech Stack:** Node.js 20+, TypeScript 5+, Vercel Functions, `@vercel/functions`, `tweetnacl`, native `fetch`, Discord API v10, Vitest 4, GitHub Actions, npm.

## Global Constraints

- Server ID: `1533446664709341357`; every command and automation action must reject a different guild.
- Host only on Vercel Hobby plus GitHub Actions; introduce no Cloudflare Worker, database, queue, or always-on Gateway/WebSocket process.
- Keep the bot in `discord-bot/` with its own package manifest and lockfile; do not add bot dependencies to the tracker root package.
- Import the canonical `weeklySeed()` from `utils/seededRng.ts`; never duplicate or redefine the weekly seed algorithm.
- Configure Vercel root directory as `discord-bot/` and enable **Include source files outside of the Root Directory in the Build Step**.
- Keep the current Vite/GitHub Pages deployment and root build commands unchanged.
- Commands remain guild-scoped in version one.
- Fatekeepers may request information or recommend outcomes but cannot assign roles/tags or issue final decisions.
- Only a live Moderator/Administrator role check may authorize `Verified Runner` and `Verified` tag mutations.
- Bot role stays below Moderator and above `Verified Runner`; never grant Administrator, Manage Webhooks, Manage Server, Manage Channels, Kick, Ban, Timeout, or mass mentions.
- Default `DISCORD_MUTATIONS_ENABLED=false`; do not enable it without a genuine non-staff end-to-end test.
- Use `allowed_mentions` allow-lists for the `Updates` and `Weekly Seed` roles only.
- Never print, read back, screenshot, commit, or include real Discord tokens, Vercel secrets, GitHub secrets, interaction tokens, or HMAC keys in tool output.
- A disabled bot or unavailable Vercel endpoint must not break Rules Screening, Onboarding, forums, or normal posting.
- Follow RED, GREEN, REFACTOR for every code task and run secret scans before every deployment checkpoint.

---

## File Structure

### Create in the tracker repository

- `discord-bot/package.json`: isolated dependencies and scripts.
- `discord-bot/package-lock.json`: pinned bot dependency tree.
- `discord-bot/tsconfig.json`: Node/Vercel TypeScript compilation.
- `discord-bot/vercel.json`: function runtime and route configuration.
- `discord-bot/.env.example`: variable names with safe non-secret descriptions only.
- `discord-bot/api/interactions.ts`: thin Vercel interaction entry point.
- `discord-bot/api/automation.ts`: thin Vercel GitHub-automation entry point.
- `discord-bot/src/config.ts`: validated environment-to-configuration mapping.
- `discord-bot/src/types.ts`: minimal Discord interaction/config domain types.
- `discord-bot/src/security/discord-signature.ts`: raw-body Ed25519 verification.
- `discord-bot/src/security/signed-id.ts`: compact signed component custom IDs.
- `discord-bot/src/security/automation-signature.ts`: timestamped GitHub HMAC verification.
- `discord-bot/src/discord/rest.ts`: Discord API v10 client with bounded retries.
- `discord-bot/src/discord/responses.ts`: response/component/embed helpers with safe mentions.
- `discord-bot/src/commands/definitions.ts`: guild command registration JSON.
- `discord-bot/src/commands/router.ts`: command/component/modal dispatch.
- `discord-bot/src/commands/links.ts`: read-only link and weekly-seed commands.
- `discord-bot/src/journals.ts`: journal modal and forum-post creation.
- `discord-bot/src/verification.ts`: queue cards, staff actions, role/tag mutation workflow.
- `discord-bot/src/automation.ts`: release and weekly event handling/idempotency.
- `discord-bot/src/markers.ts`: stable bot-authored message markers.
- `discord-bot/src/handlers/interactions.ts`: testable interaction HTTP handler.
- `discord-bot/src/handlers/automation.ts`: testable automation HTTP handler.
- `discord-bot/tests/*.test.ts`: focused unit/integration tests for every module.
- `.github/workflows/discord-register-commands.yml`: manual signed guild-command registration.
- `.github/workflows/discord-release.yml`: tracker release notification trigger.
- `.github/workflows/discord-weekly-seed.yml`: weekly deterministic seed trigger.
- `docs/discord/bot-operations.md`: deployment, permissions, rollback, secret, and incident runbook.
- `docs/discord/bot-launch-report.md`: sanitized rollout evidence and remaining live-test gate.

### Create in the RuneLite repository during Task 8

- `.github/workflows/discord-release.yml`: RuneLite release trigger using the same signed automation contract.

### Read without modifying

- `utils/seededRng.ts`: canonical `weeklySeed(date?: Date): string` implementation.
- `docs/discord/server-content.md`: canonical links, journal templates, and role language.
- `docs/discord/permission-matrix.md`: required Fatekeeper/Moderator boundaries.
- `docs/superpowers/specs/2026-08-02-fate-locked-discord-bot-design.md`: approved bot design.

---

### Task 1: Scaffold the isolated bot and validate configuration

**Files:**

- Create: `discord-bot/package.json`
- Create: `discord-bot/package-lock.json`
- Create: `discord-bot/tsconfig.json`
- Create: `discord-bot/vercel.json`
- Create: `discord-bot/.env.example`
- Create: `discord-bot/src/config.ts`
- Create: `discord-bot/src/types.ts`
- Create: `discord-bot/tests/config.test.ts`
- Create: `discord-bot/tests/weekly-seed-import.test.ts`

**Interfaces:**

- Consumes: `weeklySeed(date?: Date): string` from `../utils/seededRng.ts`.
- Produces: `loadConfig(env: NodeJS.ProcessEnv): BotConfig` and a buildable/testable bot workspace used by every later task.

- [ ] **Step 1: Write the failing configuration contract**

Create `discord-bot/tests/config.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

const valid = {
  DISCORD_APPLICATION_ID: '100000000000000001',
  DISCORD_PUBLIC_KEY: '11'.repeat(32),
  DISCORD_BOT_TOKEN: 'test-token-not-a-real-secret',
  DISCORD_GUILD_ID: '1533446664709341357',
  DISCORD_ANNOUNCEMENTS_CHANNEL_ID: '100000000000000002',
  DISCORD_RUN_JOURNALS_CHANNEL_ID: '100000000000000003',
  DISCORD_VERIFICATION_QUEUE_CHANNEL_ID: '100000000000000004',
  DISCORD_AUDIT_LOG_CHANNEL_ID: '100000000000000005',
  DISCORD_RULES_CHANNEL_ID: '100000000000000006',
  DISCORD_MODERATOR_ROLE_ID: '100000000000000007',
  DISCORD_ADMINISTRATOR_ROLE_ID: '100000000000000008',
  DISCORD_FATEKEEPER_ROLE_ID: '100000000000000009',
  DISCORD_VERIFIED_RUNNER_ROLE_ID: '100000000000000010',
  DISCORD_UPDATES_ROLE_ID: '100000000000000011',
  DISCORD_WEEKLY_SEED_ROLE_ID: '100000000000000012',
  DISCORD_TAG_VANILLA_ID: '100000000000000013',
  DISCORD_TAG_CHUNKED_ID: '100000000000000014',
  DISCORD_TAG_CUSTOM_ID: '100000000000000015',
  DISCORD_TAG_ACTIVE_ID: '100000000000000016',
  DISCORD_TAG_VERIFIED_ID: '100000000000000017',
  DISCORD_COMPONENT_HMAC_KEY: 'component-key-at-least-32-bytes-long',
  AUTOMATION_HMAC_KEY: 'automation-key-at-least-32-bytes-long',
  AUTOMATION_ALLOWED_REPOSITORIES: 'Nubles/OSRS-Fate-Locked,Nubles/OSRS-Fate-Locked-Runelite',
  DISCORD_MUTATIONS_ENABLED: 'false',
};

describe('loadConfig', () => {
  it('parses the complete safe configuration and defaults mutations off', () => {
    const config = loadConfig(valid);
    expect(config.guildId).toBe('1533446664709341357');
    expect(config.mutationsEnabled).toBe(false);
    expect(config.allowedRepositories).toEqual([
      'Nubles/OSRS-Fate-Locked',
      'Nubles/OSRS-Fate-Locked-Runelite',
    ]);
  });

  it.each(['DISCORD_BOT_TOKEN', 'DISCORD_PUBLIC_KEY', 'DISCORD_COMPONENT_HMAC_KEY'])(
    'rejects missing %s',
    (key) => expect(() => loadConfig({ ...valid, [key]: '' })).toThrow(key),
  );

  it('rejects a different guild', () => {
    expect(() => loadConfig({ ...valid, DISCORD_GUILD_ID: '1' })).toThrow('DISCORD_GUILD_ID');
  });
});
```

- [ ] **Step 2: Write the failing canonical seed import test**

Create `discord-bot/tests/weekly-seed-import.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { weeklySeed } from '../../utils/seededRng.js';

describe('canonical weekly seed import', () => {
  it('uses the tracker helper across an ISO-year boundary', () => {
    expect(weeklySeed(new Date('2027-01-01T12:00:00Z'))).toBe('FATE-2026-W53');
  });
});
```

- [ ] **Step 3: Create the isolated package and observe RED**

Create `discord-bot/package.json` with:

```json
{
  "name": "fate-locked-discord-bot",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "verify": "npm run test && npm run typecheck"
  },
  "dependencies": {
    "@vercel/functions": "^3.7.6",
    "tweetnacl": "^1.0.3"
  },
  "devDependencies": {
    "@types/node": "^20.19.43",
    "typescript": "^5.9.3",
    "vitest": "^4.1.10"
  }
}
```

Run inside `discord-bot/`:

```powershell
npm install --package-lock-only
npm install
npm test
```

Expected: FAIL because `src/config.ts` does not exist.

- [ ] **Step 4: Implement focused configuration types**

Create `discord-bot/src/types.ts` with `Snowflake`, `BotConfig`, `RoleIds`, `ChannelIds`, and `TagIds`. Create `discord-bot/src/config.ts` using explicit `required`, `snowflake`, `hexKey`, and `boolean` parsers. It must hard-check `DISCORD_GUILD_ID === '1533446664709341357'` and must never include token/HMAC values in thrown messages.

Use this public interface:

```ts
export interface BotConfig {
  applicationId: string;
  publicKey: string;
  botToken: string;
  guildId: '1533446664709341357';
  channels: {
    announcements: string;
    runJournals: string;
    verificationQueue: string;
    auditLog: string;
    rules: string;
  };
  roles: {
    moderator: string;
    administrator: string;
    fatekeeper: string;
    verifiedRunner: string;
    updates: string;
    weeklySeed: string;
  };
  tags: {
    vanilla: string;
    chunked: string;
    custom: string;
    active: string;
    verified: string;
  };
  componentHmacKey: string;
  automationHmacKey: string;
  allowedRepositories: string[];
  mutationsEnabled: boolean;
}

export const loadConfig = (env: NodeJS.ProcessEnv): BotConfig => { /* explicit parsers */ };
```

- [ ] **Step 5: Add Vercel and TypeScript configuration**

Create `discord-bot/tsconfig.json` with `target: ES2022`, `module: NodeNext`, `moduleResolution: NodeNext`, `strict: true`, `noUncheckedIndexedAccess: true`, `types: ["node"]`, and includes for `api`, `src`, `tests`, and `../utils/seededRng.ts`.

Create `discord-bot/vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "functions": {
    "api/interactions.ts": { "maxDuration": 10 },
    "api/automation.ts": { "maxDuration": 20 }
  }
}
```

Create `.env.example` containing every variable name from the test with comments such as `# Vercel secret; never commit the real value`. Use empty values; never include a Discord-looking token or real channel/role/tag IDs other than the public server ID.

- [ ] **Step 6: Run GREEN and verify root isolation**

Run:

```powershell
Push-Location discord-bot
npm run verify
Pop-Location
npm test -- --run scripts/discord-content.test.ts
git diff --check
```

Expected: bot tests/typecheck PASS and the tracker content test remains PASS. Confirm the root `package.json` and root lockfile are unchanged.

- [ ] **Step 7: Commit the scaffold**

```powershell
git add discord-bot/package.json discord-bot/package-lock.json discord-bot/tsconfig.json discord-bot/vercel.json discord-bot/.env.example discord-bot/src/config.ts discord-bot/src/types.ts discord-bot/tests/config.test.ts discord-bot/tests/weekly-seed-import.test.ts
git diff --cached --check
git commit -m "feat: scaffold Fate Locked Discord bot"
```

---

### Task 2: Secure the HTTP endpoints and signed component IDs

**Files:**

- Create: `discord-bot/src/security/discord-signature.ts`
- Create: `discord-bot/src/security/signed-id.ts`
- Create: `discord-bot/src/security/automation-signature.ts`
- Create: `discord-bot/src/handlers/interactions.ts`
- Create: `discord-bot/src/handlers/automation.ts`
- Create: `discord-bot/api/interactions.ts`
- Create: `discord-bot/api/automation.ts`
- Create: `discord-bot/tests/security.test.ts`
- Create: `discord-bot/tests/handlers.test.ts`

**Interfaces:**

- Consumes: `BotConfig` and raw Fetch API `Request` bodies.
- Produces: `verifyDiscordRequest`, `signComponentId`, `verifyComponentId`, `verifyAutomationRequest`, `handleInteractionRequest`, and `handleAutomationRequest` used by all commands/workflows.

- [ ] **Step 1: Write signature and component-ID RED tests**

Create `tests/security.test.ts` using a deterministic TweetNaCl signing key pair. Assert:

```ts
expect(verifyDiscordRequest(body, timestamp, validSignature, publicKey)).toBe(true);
expect(verifyDiscordRequest(`${body}x`, timestamp, validSignature, publicKey)).toBe(false);

const id = signComponentId(
  { action: 'approve', applicantId: '100000000000000001', threadId: '100000000000000002', expiresAt: 1_900_000_000 },
  componentKey,
);
expect(id.length).toBeLessThanOrEqual(100);
expect(verifyComponentId(id, componentKey, 1_800_000_000)?.action).toBe('approve');
expect(verifyComponentId(`${id.slice(0, -1)}x`, componentKey, 1_800_000_000)).toBeNull();
expect(verifyComponentId(id, componentKey, 1_900_000_001)).toBeNull();
```

For automation HMAC, assert valid timestamp/body, bad signature, expired timestamp over five minutes, and repository not in the allow-list.

- [ ] **Step 2: Run RED**

```powershell
Push-Location discord-bot
npx vitest run tests/security.test.ts
Pop-Location
```

Expected: FAIL because the security modules do not exist.

- [ ] **Step 3: Implement exact security primitives**

`verifyDiscordRequest(body, timestamp, signatureHex, publicKeyHex)` must use `tweetnacl.sign.detached.verify` exactly as Discord documents, reject missing/non-hex headers, and never parse JSON before verification.

Define compact IDs as:

```ts
type ComponentAction = 'needs_info' | 'recommend' | 'recommend_reject' | 'approve' | 'reject' | 'retry_tag';

interface ComponentPayload {
  action: ComponentAction;
  applicantId: string;
  threadId: string;
  expiresAt: number;
}
```

Encode `v1.<action>.<applicant>.<thread>.<expiry36>.<sig>` where `sig` is the first 12 HMAC-SHA256 bytes in base64url. Use `timingSafeEqual`, exact segment counts, Snowflake checks, and expiry checks.

Automation signatures use `v1=<hex hmac(timestamp + "." + rawBody)>`, a five-minute replay window, and `timingSafeEqual`.

- [ ] **Step 4: Write handler RED tests**

Create `tests/handlers.test.ts` asserting:

- Missing/bad Discord signature returns `401` without invoking the router.
- Valid PING returns status `200` and `{ type: 1 }`.
- Non-PING from another guild returns ephemeral type `4` with `This app is only available in Fate Locked Ironman.`
- Automation bad HMAC returns `401`.
- Valid automation request reaches an injected event handler exactly once.

- [ ] **Step 5: Implement thin handlers and Vercel entry points**

Use dependency injection:

```ts
export interface InteractionDeps {
  config: BotConfig;
  route: (interaction: DiscordInteraction) => Promise<Response>;
}

export const handleInteractionRequest = async (
  request: Request,
  deps: InteractionDeps,
): Promise<Response> => { /* raw body -> signature -> ping/guild -> route */ };
```

`api/interactions.ts` loads config once and calls the testable handler. `api/automation.ts` does the same for automation. Use JSON responses with explicit `content-type: application/json`.

- [ ] **Step 6: Run GREEN and typecheck**

```powershell
Push-Location discord-bot
npx vitest run tests/security.test.ts tests/handlers.test.ts
npm run typecheck
Pop-Location
```

Expected: PASS.

- [ ] **Step 7: Commit endpoint security**

```powershell
git add discord-bot/api discord-bot/src/security discord-bot/src/handlers discord-bot/tests/security.test.ts discord-bot/tests/handlers.test.ts
git diff --cached --check
git commit -m "feat: secure Discord bot endpoints"
```

---

### Task 3: Add the Discord REST client and read-only commands

**Files:**

- Create: `discord-bot/src/discord/rest.ts`
- Create: `discord-bot/src/discord/responses.ts`
- Create: `discord-bot/src/commands/definitions.ts`
- Create: `discord-bot/src/commands/router.ts`
- Create: `discord-bot/src/commands/links.ts`
- Create: `discord-bot/tests/rest.test.ts`
- Create: `discord-bot/tests/commands.test.ts`

**Interfaces:**

- Consumes: verified `DiscordInteraction`, `BotConfig`, `weeklySeed`, and injected `fetch`.
- Produces: `DiscordRestClient`, exact `guildCommands`, and `routeInteraction` used by journals and verification.

- [ ] **Step 1: Write REST retry RED tests**

Test an injected fetch sequence for:

- `200` returns decoded JSON.
- `204` returns `undefined`.
- `429` waits the bounded `retry_after` then succeeds once.
- Two `500` responses retry and then succeed.
- `403` fails immediately with a sanitized `DiscordApiError` containing method, route template, and status but no authorization header/body token.
- Exhausted retry count throws once and does not loop.

- [ ] **Step 2: Implement the minimal REST client**

Expose:

```ts
export class DiscordRestClient {
  constructor(options: {
    token: string;
    fetchImpl?: typeof fetch;
    sleep?: (ms: number) => Promise<void>;
    maxRetries?: number;
  });

  request<T>(method: string, route: string, body?: unknown): Promise<T>;
  getChannelMessages(channelId: string, limit?: number): Promise<DiscordMessage[]>;
  createMessage(channelId: string, body: unknown): Promise<DiscordMessage>;
  editMessage(channelId: string, messageId: string, body: unknown): Promise<DiscordMessage>;
  createForumPost(channelId: string, body: unknown): Promise<DiscordChannel>;
  editThread(threadId: string, body: unknown): Promise<DiscordChannel>;
  getGuildMember(guildId: string, userId: string): Promise<DiscordGuildMember>;
  addGuildMemberRole(guildId: string, userId: string, roleId: string): Promise<void>;
  registerGuildCommands(applicationId: string, guildId: string, commands: unknown[]): Promise<unknown[]>;
}
```

Every request sets `Authorization: Bot <token>`, `content-type: application/json`, and `user-agent: FateLockedDiscordBot/1.0`. Error serialization must redact headers and response bodies.

- [ ] **Step 3: Write exact command RED tests**

Assert `guildCommands` contains only:

- `tracker`
- `runelite`
- `rules`
- `weekly-seed`
- `journal` with `create` subcommand
- `verify`

Assert link responses are ephemeral (`flags: 64`), use link buttons for:

- `https://nubles.github.io/OSRS-Fate-Locked/`
- `https://nubles.github.io/OSRS-Fate-Locked/?open=runelite-guide`
- `https://github.com/Nubles/OSRS-Fate-Locked-Runelite`

Assert `/rules` mentions only `<#configured-rules-id>`. Assert `/weekly-seed` for `2026-08-02T12:00:00Z` equals the tracker helper and includes `allowed_mentions: { parse: [] }`.

- [ ] **Step 4: Implement response helpers and read-only routing**

Create helpers:

```ts
export const ephemeral = (content: string, components: unknown[] = []) => ({
  type: 4,
  data: { content, components, flags: 64, allowed_mentions: { parse: [] } },
});

export const linkButton = (label: string, url: string) => ({
  type: 2,
  style: 5,
  label,
  url,
});
```

`routeInteraction` must reject unknown command/component/modal IDs ephemerally and dispatch through exact constants rather than substring matching.

- [ ] **Step 5: Add manual signed command registration to automation handler**

Extend the HMAC-signed automation endpoint with event type `register_commands`. It calls `registerGuildCommands` with the exact configured guild. It must remain protected by the repository allow-list and HMAC and return counts only, never command tokens/config.

- [ ] **Step 6: Run focused and aggregate GREEN**

```powershell
Push-Location discord-bot
npx vitest run tests/rest.test.ts tests/commands.test.ts tests/handlers.test.ts
npm run typecheck
Pop-Location
```

Expected: PASS.

- [ ] **Step 7: Commit read-only commands**

```powershell
git add discord-bot/src/discord discord-bot/src/commands discord-bot/src/handlers discord-bot/tests/rest.test.ts discord-bot/tests/commands.test.ts discord-bot/tests/handlers.test.ts
git diff --cached --check
git commit -m "feat: add Fate Locked Discord commands"
```

---

### Task 4: Create tagged run journals through a modal

**Files:**

- Create: `discord-bot/src/journals.ts`
- Create: `discord-bot/tests/journals.test.ts`
- Modify: `discord-bot/src/commands/router.ts`
- Modify: `discord-bot/src/commands/definitions.ts`
- Modify: `discord-bot/src/discord/rest.ts`

**Interfaces:**

- Consumes: `/journal create`, configured forum/tag IDs, exact journal format from `server-content.md`, and Discord forum thread creation.
- Produces: `journalModal()` and `handleJournalSubmit(interaction, deps)`.

- [ ] **Step 1: Write modal and validation RED tests**

Assert `/journal create` returns modal type `9` with custom ID `journal:create:v1` and fields:

- `rsn` required, 1–12 characters.
- `path` required, placeholder `Vanilla, Chunked, or Custom`.
- `intro` optional, maximum 500 characters.

Test `parseJournalSubmission` canonicalizes path case-insensitively and rejects unsupported values, blank/oversized RSNs, control characters, and oversized introductions.

- [ ] **Step 2: Write forum creation RED tests**

With configured `vanilla` and `active` tag IDs, assert a valid submission calls:

```ts
rest.createForumPost(config.channels.runJournals, {
  name: '[Vanilla] Zezima — Active',
  auto_archive_duration: 10080,
  applied_tags: [config.tags.vanilla, config.tags.active],
  message: {
    content: expectedJournalBody,
    allowed_mentions: { parse: [] },
  },
});
```

Assert the response is ephemeral and links to `https://discord.com/channels/<guild>/<thread>`. Assert an API failure returns an ephemeral retry message and does not attempt a second create.

- [ ] **Step 3: Implement journal helpers and routing**

Use the source template headings: Account, Path, Status, Current goals, Latest fate, Evidence/links. Escape Markdown metacharacters in user fields, keep `allowed_mentions.parse` empty, and never accept caller-supplied tag IDs.

Defer the modal submit before the REST call using response type `5` with `flags: 64`, then use the interaction webhook edit route to complete the ephemeral response. Add that edit route to `DiscordRestClient` without logging the interaction token.

- [ ] **Step 4: Run GREEN**

```powershell
Push-Location discord-bot
npx vitest run tests/journals.test.ts tests/commands.test.ts tests/rest.test.ts
npm run typecheck
Pop-Location
```

Expected: PASS.

- [ ] **Step 5: Commit journal creation**

```powershell
git add discord-bot/src/journals.ts discord-bot/src/commands discord-bot/src/discord/rest.ts discord-bot/tests/journals.test.ts discord-bot/tests/commands.test.ts discord-bot/tests/rest.test.ts
git diff --cached --check
git commit -m "feat: automate Fate Locked run journals"
```

---

### Task 5: Implement human-gated verification and audit logs

**Files:**

- Create: `discord-bot/src/verification.ts`
- Create: `discord-bot/src/markers.ts`
- Create: `discord-bot/tests/verification.test.ts`
- Create: `discord-bot/tests/markers.test.ts`
- Modify: `discord-bot/src/commands/router.ts`
- Modify: `discord-bot/src/discord/rest.ts`
- Modify: `discord-bot/src/discord/responses.ts`

**Interfaces:**

- Consumes: `/verify` modal submissions, signed component IDs, live member roles, queue message/thread state, and configured role/tag IDs.
- Produces: queue cards; Fatekeeper recommendation actions; Moderator-only final mutation; sanitized audit entries.

- [ ] **Step 1: Write verification modal and journal-link RED tests**

Assert `/verify` returns modal `verify:submit:v1` with required `journal_url` and `evidence_summary`, optional `evidence_url`, and exact length limits (journal URL 200, summary 1000, evidence URL 500).

Test `parseJournalUrl` accepts only:

```text
https://discord.com/channels/1533446664709341357/<run-journals-thread-id>
https://discordapp.com/channels/1533446664709341357/<run-journals-thread-id>
```

It must reject a different guild, non-HTTPS URL, missing thread ID, and non-Discord host. The handler must fetch the thread and confirm both `parent_id === config.channels.runJournals` and `owner_id === interaction.member.user.id`, so one member cannot submit another member's journal. Defer ephemerally before the REST checks, then edit the original interaction response without logging its token.

- [ ] **Step 2: Write stateless open-request and marker RED tests**

Define markers:

```ts
export const verificationMarker = (applicantId: string, threadId: string, state: string) =>
  `FLV1 applicant=${applicantId} thread=${threadId} state=${state}`;

export const releaseMarker = (repository: string, releaseId: number) =>
  `FLR1 repository=${repository} release=${releaseId}`;

export const seedMarker = (seed: string) => `FLS1 seed=${seed}`;
```

Assert only exact bot-authored embed footers match. Scan at most the newest 100 messages. A Discord history failure must return `unknown`, which blocks new privileged work rather than assuming no duplicate.

- [ ] **Step 3: Write role-boundary RED tests**

Build test interactions whose live members contain role IDs:

- Fatekeeper can `needs_info`, `recommend`, `recommend_reject`.
- Fatekeeper cannot `approve`, `reject`, `retry_tag`.
- Moderator and Administrator can finalise.
- Member and Verified Runner can do none.
- An actor ID from the original interaction payload is re-fetched through `getGuildMember`; stale payload role data is ignored.
- `needs_info`, `recommend`, `recommend_reject`, and `reject` first return a reason modal with a signed, expiring custom ID and a required 1-500 character reason. Modal submission re-verifies the signature, queue state, and actor's live role before any write.
- Every denied action returns ephemeral denial and makes zero REST mutations.

- [ ] **Step 4: Write approval transaction RED tests**

Assert successful approval calls in this order:

1. Fetch actor member.
2. Fetch applicant member.
3. Fetch journal thread.
4. Fetch current guild roles and confirm bot/target hierarchy.
5. Add `Verified Runner`.
6. Edit thread with existing tags plus `Verified` (deduplicated, maximum five tags).
7. Edit queue message to state approved with disabled controls.
8. Post sanitized audit entry.

Test these failures separately:

- `DISCORD_MUTATIONS_ENABLED=false`: no role/tag change, private disabled message.
- Bot role below/equal to Verified Runner: fail closed.
- Journal missing/wrong parent: fail closed.
- Role add fails: do not edit tag or queue state; audit failure.
- Role add succeeds, tag edit fails: keep role, expose signed `retry_tag`, audit partial failure.
- Retry tag re-fetches live state, edits only the tag step, closes the queue card, audits recovery.
- Replayed approve after queue state is already closed: no-op with private stale-control message.
- Moderator rejection posts no role/tag mutation, records the bounded reason on the private card, sets `state=rejected`, disables all controls, and audits the final decision.

- [ ] **Step 5: Implement the verification workflow**

Queue cards use embeds with applicant mention, journal link, bounded summary, optional evidence link, creation time, and open marker footer. Use `allowed_mentions: { parse: [] }`; mentions render as text without pinging.

Component and modal custom IDs expire after seven days. On every click or modal submission, verify signature/expiry, re-fetch the queue message, and parse its exact marker/state. Treat `open`, `needs_info`, `recommended_approve`, and `recommended_reject` as unresolved states that preserve the Moderator decision path; accept `partial_tag` only for `retry_tag`; reject every closed or incompatible state.

On **Needs Info**, post the bounded request in the applicant's validated journal thread with `allowed_mentions: { parse: [] }`, update the private queue card to `state=needs_info`, retain final Moderator controls, and audit the action. On either recommendation, record the bounded reason on the private queue card, set the corresponding recommendation state, retain final Moderator controls, and audit without changing any role or tag. If a journal/card update fails, leave the prior marker state intact and audit the failure rather than presenting a false success.

Audit entries include actor ID, applicant ID, thread ID, action, outcome, and ISO timestamp. Never include the full evidence summary or private evidence URL in `#audit-log`.

- [ ] **Step 6: Run focused and aggregate GREEN**

```powershell
Push-Location discord-bot
npx vitest run tests/verification.test.ts tests/markers.test.ts tests/security.test.ts tests/rest.test.ts
npm run typecheck
Pop-Location
```

Expected: PASS.

- [ ] **Step 7: Commit verification automation**

```powershell
git add discord-bot/src/verification.ts discord-bot/src/markers.ts discord-bot/src/commands/router.ts discord-bot/src/discord discord-bot/tests/verification.test.ts discord-bot/tests/markers.test.ts
git diff --cached --check
git commit -m "feat: add human-gated Discord verification"
```

---

### Task 6: Add signed release and weekly-seed automation

**Files:**

- Create: `discord-bot/src/automation.ts`
- Create: `discord-bot/tests/automation.test.ts`
- Create: `discord-bot/scripts/send-automation-event.mjs`
- Create: `.github/workflows/discord-register-commands.yml`
- Create: `.github/workflows/discord-release.yml`
- Create: `.github/workflows/discord-weekly-seed.yml`
- Modify: `discord-bot/src/handlers/automation.ts`
- Modify: `discord-bot/src/markers.ts`

**Interfaces:**

- Consumes: verified `register_commands`, `release`, and `weekly_seed` event envelopes.
- Produces: idempotent announcement posts and GitHub workflows that never receive the Discord bot token.

- [ ] **Step 1: Write event-envelope and idempotency RED tests**

Define envelopes:

```ts
type AutomationEvent =
  | { type: 'register_commands'; repository: 'Nubles/OSRS-Fate-Locked'; sentAt: string }
  | { type: 'weekly_seed'; repository: 'Nubles/OSRS-Fate-Locked'; sentAt: string }
  | {
      type: 'release';
      repository: 'Nubles/OSRS-Fate-Locked' | 'Nubles/OSRS-Fate-Locked-Runelite';
      sentAt: string;
      release: { id: number; tagName: string; name: string; url: string; body: string; publishedAt: string };
    };
```

Assert repository/event combinations outside this union are rejected after HMAC verification. Assert published URL hostname is `github.com` and repository path matches the envelope repository.

For seed/release markers, assert an existing bot-authored marker returns `{ duplicate: true }` and makes no post.

- [ ] **Step 2: Write exact announcement RED tests**

Weekly post requirements:

- Seed computed from `new Date(sentAt)` through imported `weeklySeed`.
- Gold embed and marker footer.
- Tracker link.
- Content is exactly `<@&weeklySeedRoleId>`.
- `allowed_mentions: { roles: [weeklySeedRoleId], parse: [] }`.

Release post requirements:

- Repository, bounded release name/tag, canonical release URL, first 1000 normalized body characters, published timestamp, stable marker.
- Content exactly `<@&updatesRoleId>` with only that role allowed.
- No `@everyone`, `@here`, user mentions, or release-body mentions are parsed.

- [ ] **Step 3: Implement automation with bounded history checks**

Fetch the newest 100 announcement messages, accept markers only from `message.author.id === config.applicationId && message.author.bot === true`, then post once. If history fails, return `503` so GitHub retries; do not post without an idempotency check.

Return JSON containing only `{ ok, duplicate, type }`. Never return channel IDs, tokens, or request signatures.

- [ ] **Step 4: Implement the safe sender script**

`discord-bot/scripts/send-automation-event.mjs` reads:

- `DISCORD_AUTOMATION_ENDPOINT`
- `DISCORD_AUTOMATION_HMAC`
- `AUTOMATION_EVENT_JSON`

It parses the event, sets `sentAt` to the current ISO time when absent, serializes once, computes `v1=<hmac(timestamp + "." + body)>`, and sends headers `x-fate-timestamp` and `x-fate-signature`. Logs only event type, HTTP status, and the safe response fields. It exits non-zero on non-2xx.

- [ ] **Step 5: Create exact GitHub workflows**

`discord-register-commands.yml`:

```yaml
name: Register Discord commands
on:
  workflow_dispatch:
permissions:
  contents: read
jobs:
  register:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - name: Register guild commands
        env:
          DISCORD_AUTOMATION_ENDPOINT: ${{ secrets.DISCORD_AUTOMATION_ENDPOINT }}
          DISCORD_AUTOMATION_HMAC: ${{ secrets.DISCORD_AUTOMATION_HMAC }}
          AUTOMATION_EVENT_JSON: '{"type":"register_commands","repository":"Nubles/OSRS-Fate-Locked"}'
        run: node discord-bot/scripts/send-automation-event.mjs
```

`discord-release.yml` triggers `release: [published]`, builds the exact release envelope using a checked-in Node helper invocation, and never interpolates untrusted release body text into shell commands.

`discord-weekly-seed.yml` uses `schedule: [{ cron: '15 9 * * 1' }]` plus `workflow_dispatch` and sends `weekly_seed`. Add `concurrency` groups with `cancel-in-progress: false`.

- [ ] **Step 6: Test workflows without secrets**

Add tests that parse each workflow file as text and assert trigger, permissions, secret variable names, exact repository, and absence of Discord bot-token variables or webhook URLs.

Run:

```powershell
Push-Location discord-bot
npx vitest run tests/automation.test.ts tests/markers.test.ts
npm run typecheck
Pop-Location
rg -n "discord(?:app)?\.com/api/webhooks|DISCORD_BOT_TOKEN" .github/workflows discord-bot/scripts
```

Expected: tests PASS; grep finds neither a webhook URL nor bot-token use in workflows/scripts.

- [ ] **Step 7: Commit automation code and tracker workflows**

```powershell
git add discord-bot/src/automation.ts discord-bot/src/handlers/automation.ts discord-bot/src/markers.ts discord-bot/scripts/send-automation-event.mjs discord-bot/tests/automation.test.ts .github/workflows/discord-register-commands.yml .github/workflows/discord-release.yml .github/workflows/discord-weekly-seed.yml
git diff --cached --check
git commit -m "feat: add Discord release and weekly automation"
```

---

### Task 7: Document operations and deploy the read-only bot safely

**Files:**

- Create: `docs/discord/bot-operations.md`
- Create: `docs/discord/bot-launch-report.md`
- Modify: `discord-bot/.env.example`

**Interfaces:**

- Consumes: tested bot code, user's Discord Developer Portal session, user's Vercel session, and live server structure.
- Produces: installed least-privilege bot, live Vercel interaction endpoint, registered guild commands, and a sanitized operations record.

- [ ] **Step 1: Write the operations runbook before external changes**

Document exact environment variables, Vercel root/outside-source settings, Developer Portal steps, bot role permissions/order, command-registration workflow, mutation feature flag, rollback, token rotation, incident response, and logs that are safe to inspect. State that secrets are set through provider UIs and never copied into repository files or chat.

Start `bot-launch-report.md` with:

```markdown
# Fate Locked Discord Bot Launch Report

- Application scope: Fate Locked Ironman guild only
- Vercel deployment: not started
- Discord installation: not started
- Mutations enabled: no
- Secrets recorded in repository: no
- Non-staff end-to-end test: blocked — no second account available

## Checkpoints

| Checkpoint | Status | Sanitized evidence |
|---|---|---|
```

- [ ] **Step 2: Run the complete pre-deployment gate**

```powershell
Push-Location discord-bot
npm ci
npm run verify
Pop-Location
npm test
git diff --check
rg -n "discord(?:app)?\.com/api/webhooks/\d+|Bot [A-Za-z0-9._-]{20,}|DISCORD_BOT_TOKEN=." discord-bot .github docs
```

Expected: bot/root tests and typecheck PASS, no real secret pattern, clean diff.

- [ ] **Step 3: Create the Discord application without broad permissions**

Using the user's authenticated Developer Portal:

- Create `Fate Locked` application and bot.
- Disable Public Bot.
- Keep privileged Gateway intents off because the app uses HTTP interactions and REST.
- Configure guild install scopes `applications.commands` and `bot`.
- Request only View Channels, Send Messages, Embed Links, Attach Files, Read Message History, Create Public Threads, Send Messages in Threads, Manage Threads/Posts, and Manage Roles.
- Install only to server `1533446664709341357`.
- In server Roles, place the managed bot role below Moderator and above Verified Runner.
- Re-open role permissions and verify every forbidden Global Constraint permission is off.

If Discord requests login, CAPTCHA, password, email verification, passkey, or 2FA, stop and ask the user to complete it.

- [ ] **Step 4: Create the Vercel project and secrets**

Using the user's authenticated Vercel session:

- Import the tracker repository as a new project named `fate-locked-discord-bot`.
- Root Directory: `discord-bot`.
- Enable source files outside Root Directory.
- Framework preset: Other.
- Node.js: 20 or newer.
- Add every environment variable from `.env.example`; keep `DISCORD_MUTATIONS_ENABLED=false`.
- Deploy and record only the public endpoint origin, deployment status, and commit SHA in the report. Do not record secrets.

Confirm the deployment log resolves `../utils/seededRng.ts`; failure is a blocker, not permission to duplicate it.

- [ ] **Step 5: Configure the interaction endpoint and install**

Set the Developer Portal Interaction Endpoint URL to `<vercel-origin>/api/interactions`. Discord must validate PING/signature behavior. Install the app to the server, then use View Server As Role and direct role inspection to confirm the managed role has only the planned channels and permissions.

- [ ] **Step 6: Configure GitHub repository secrets and register commands**

Add only:

- `DISCORD_AUTOMATION_ENDPOINT=<vercel-origin>/api/automation`
- `DISCORD_AUTOMATION_HMAC=<same Vercel automation secret>`

Run `Register Discord commands` manually. Confirm exactly six guild commands appear and none appear in DMs or other servers.

- [ ] **Step 7: Exercise read-only commands**

Run `/tracker`, `/runelite`, `/rules`, and `/weekly-seed` in the server. Confirm ephemeral responses, exact links/channel mention, canonical seed, no public noise, no audit/role/tag mutation, and no Vercel log secret exposure.

Record sanitized PASS/FAIL rows without interaction tokens, application token, endpoint secret, or full Vercel log contents.

- [ ] **Step 8: Commit the read-only deployment checkpoint**

```powershell
git add docs/discord/bot-operations.md docs/discord/bot-launch-report.md discord-bot/.env.example
git diff --cached --check
git commit -m "docs: record Discord bot deployment"
```

---

### Task 8: Roll out journals, verification, releases, and weekly automation

**Files:**

- Modify: `docs/discord/bot-launch-report.md`
- Modify: `docs/discord/bot-operations.md`
- Create in `Nubles/OSRS-Fate-Locked-Runelite`: `.github/workflows/discord-release.yml`

**Interfaces:**

- Consumes: installed read-only bot, signed automation endpoint, journal/verification code, tracker workflows, RuneLite repository access.
- Produces: safely staged live workflows, with privileged mutations explicitly left disabled until a genuine non-staff test becomes available.

- [ ] **Step 1: Test journal creation with one labelled artifact**

Run `/journal create` with RSN `STAFF TEST`, path `Vanilla`, and introduction `Task 8 journal workflow test — delete after verification`. Confirm exact title/template, Vanilla + Active tags, link response, and no extra post. Delete only that labelled test post and verify it is gone.

- [ ] **Step 2: Test verification submission without mutations**

Create a second labelled journal only for this test, submit `/verify`, and confirm one private queue card, correct open marker, buttons, and no role/tag mutation while `DISCORD_MUTATIONS_ENABLED=false`.

Use an owner account with temporary Fatekeeper and Moderator test-role assignments one at a time only if the user explicitly approves those temporary role changes. Otherwise validate button denial/authorization with automated tests and record live role-boundary testing blocked.

Do not enable mutations without a genuine non-staff member. Delete the queue card and journal after the non-mutating test.

- [ ] **Step 3: Test the tracker release endpoint with a labelled payload**

Use `workflow_dispatch` with a hard-coded safe test release envelope labelled `STAFF TEST — not a real release`. Confirm one Updates-role mention, exact safe embed, marker, and duplicate no-op after rerun. Delete only the labelled test announcement.

- [ ] **Step 4: Add the RuneLite workflow safely**

In `Nubles/OSRS-Fate-Locked-Runelite`, add the same release workflow contract with repository fixed to `Nubles/OSRS-Fate-Locked-Runelite`. Configure the two Actions secrets through GitHub settings without printing or storing their values. Run a signed labelled test payload and delete only its Discord test announcement.

Commit in the RuneLite repository:

```powershell
git add .github/workflows/discord-release.yml
git diff --cached --check
git commit -m "ci: announce RuneLite releases in Discord"
```

- [ ] **Step 5: Test and enable weekly seed workflow**

Run `discord-weekly-seed.yml` manually twice. First run posts exactly one current canonical seed announcement mentioning only Weekly Seed. Second run returns duplicate/no-op and creates no message. Keep the real current-week seed announcement unless the user asks to remove it.

- [ ] **Step 6: Verify optional-feature resilience**

Temporarily disable the bot role's View Channel permission without deleting the role. Confirm Rules Screening, Onboarding, forums, normal posting, and native AutoMod remain available. Restore the planned permission. Do not alter the bot token or app installation for this check.

- [ ] **Step 7: Record the mutation gate honestly**

Because no genuine non-staff account exists, keep:

```text
DISCORD_MUTATIONS_ENABLED=false
```

Record:

- Read-only commands: pass.
- Journal creation: pass after labelled cleanup.
- Verification submission: pass without mutations.
- Fatekeeper/Moderator live role-boundary test: blocked unless a real non-staff account becomes available.
- Automatic Verified Runner/tag mutation: disabled and unlaunched.
- Tracker release automation: pass after labelled cleanup.
- RuneLite release automation: pass after labelled cleanup.
- Weekly seed: pass and duplicate-safe.
- Secret recorded in repository: no.

Do not call the bot fully launched and do not create a public Discord invite.

- [ ] **Step 8: Run final verification**

In the tracker repository:

```powershell
Push-Location discord-bot
npm ci
npm run verify
Pop-Location
npm test
git diff --check
rg -n "discord(?:app)?\.com/api/webhooks/\d+|Bot [A-Za-z0-9._-]{20,}|DISCORD_BOT_TOKEN=.|AUTOMATION_HMAC_KEY=." discord-bot .github docs
git status --short
```

Expected: tests/typecheck PASS, only operations/report changes remain, no real secret pattern.

- [ ] **Step 9: Commit the staged rollout record**

```powershell
git add docs/discord/bot-operations.md docs/discord/bot-launch-report.md
git diff --cached --check
git commit -m "docs: record Discord bot rollout"
```

---

## Plan Self-Review Checklist

- Every approved command and workflow has an owning task and exact test boundary.
- `weeklySeed()` is imported from the tracker and protected by an equality/build test.
- The bot has no database, Gateway, Cloudflare, Administrator, Manage Webhooks, or moderation powers.
- Every privileged component checks live roles and signed/expiring state.
- Fatekeeper recommendations and Moderator final decisions remain distinct.
- Role/tag mutation order and partial-failure recovery are explicit and tested.
- GitHub Actions receive only the automation endpoint/HMAC, never the Discord bot token.
- Release and seed announcements are duplicate-safe and use only opt-in mentions.
- Vercel raw-body signature verification precedes JSON parsing.
- Main tracker build/deploy scripts remain unchanged.
- Deployment tasks never print or store provider secrets.
- The no-second-account limitation keeps mutations disabled and prevents a false full-launch claim.
