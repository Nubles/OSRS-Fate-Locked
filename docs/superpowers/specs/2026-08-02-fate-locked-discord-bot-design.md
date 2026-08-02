# Fate Locked Discord Automation Bot Design

**Date:** 2026-08-02
**Status:** Approved in conversation; awaiting written-spec review
**Server:** Fate Locked Ironman (`1533446664709341357`)

## Summary

Build a small, server-scoped Discord application for the Fate Locked Ironman community. The application runs as HTTP interactions on Vercel Hobby and uses GitHub Actions for release-triggered and weekly automation. It automates repetitive community workflows while retaining human control over verification and avoiding additional Cloudflare usage.

The bot lives in an isolated `discord-bot/` workspace inside the existing Fate Locked repository. It must not change the current Vite/GitHub Pages deployment or require a continuously connected Gateway/WebSocket process.

## Goals

- Provide fast official links and the existing deterministic weekly seed through slash commands.
- Create consistently tagged run-journal forum posts through a modal.
- Route verification evidence into the private staff queue.
- Preserve the Fatekeeper/Moderator separation of duties.
- Apply `Verified Runner` and the journal `Verified` tag only after an authorized Moderator approves.
- Publish tracker and RuneLite release announcements without polling.
- Produce a complete private audit trail for staff actions.
- Operate within expected Vercel Hobby and public-repository GitHub Actions allowances.

## Non-goals

- No tracker-profile linking, progress synchronization, leaderboards, or automatic gameplay-event feed in version one.
- No database, always-on Gateway connection, third-party moderation bot, or Cloudflare Worker.
- No automatic verification based solely on submitted evidence.
- No Administrator, Manage Webhooks, kick, ban, timeout, or server-management permissions.
- No public/global command rollout until the server-scoped deployment is proven.

## Architecture

### Repository layout

Create a self-contained `discord-bot/` workspace with its own `package.json`, TypeScript configuration, Vercel configuration, source, and tests. The main tracker keeps its current dependencies and build commands unchanged.

The bot imports the existing pure `weeklySeed()` helper from `utils/seededRng.ts`; it does not duplicate or redefine the seed algorithm. The Vercel project uses `discord-bot/` as its root directory and enables Vercel's **Include source files outside of the Root Directory in the Build Step** monorepo setting so this shared import is bundled. The deployment test must fail if that shared import cannot be resolved; duplicating the algorithm is not an acceptable fallback.

### Runtime components

1. **Vercel interaction function**
   - Receives Discord interaction requests over HTTPS.
   - Verifies Discord's Ed25519 request signature before parsing commands.
   - Handles commands, modals, buttons, and Discord REST calls.
   - Returns Discord's required acknowledgement within the interaction deadline and defers longer work.

2. **Signed internal automation endpoint**
   - Receives tracker or RuneLite release events from GitHub Actions.
   - Requires an HMAC signature, timestamp, repository allow-list, and replay window.
   - Posts release embeds to `#announcements` and mentions the opt-in `Updates` role.

3. **GitHub Actions workflows**
   - Release workflows run on published release events in the tracker and RuneLite repositories.
   - A weekly scheduled workflow requests the current deterministic seed announcement.
   - Secrets are stored only in repository Actions secrets.

4. **Discord REST client**
   - Uses one narrowly permissioned bot token stored in Vercel environment variables.
   - Implements bounded retry behavior for rate limits and transient server errors.
   - Never logs tokens, signatures, authorization headers, or full private evidence.

## Commands and member workflows

### Read-only commands

- `/tracker` returns an ephemeral response with a button to the official tracker.
- `/runelite` returns an ephemeral response with the official RuneLite guide and source link.
- `/rules` returns an ephemeral response pointing to `#rules-and-safety` and summarizing that server rules must be accepted.
- `/weekly-seed` returns the exact value from the existing `weeklySeed()` helper and a tracker link.

### Run journal creation

`/journal create` opens a modal containing:

- OSRS account name.
- Path: Vanilla, Chunked, or Custom.
- Initial status: Active.
- Optional short introduction.

The bot creates one post in `run-journals` using the approved title/template and applies the matching path tag plus `Active`. It returns an ephemeral link to the created post. Validation rejects empty names, unsupported tags, oversized text, and requests outside the configured server.

### Verification submission

`/verify` opens a modal requiring:

- A `run-journals` post link from the configured server.
- A concise evidence summary.
- An optional public evidence URL.

The bot validates the journal thread, applicant, and URL before posting a private verification card in `#verification-queue`. If the same applicant and journal already have an open request, the bot links to the existing request instead of duplicating it.

## Staff workflow

### Fatekeeper actions

Fatekeepers may use:

- **Needs Info** — posts a staff-authored request for additional evidence and marks the queue card accordingly.
- **Recommend Approval** — records a recommendation but makes no role or tag changes.
- **Recommend Rejection** — records the recommendation and reason but does not close the Moderator decision path.

Every action verifies the actor's current live role and is recorded in `#audit-log`.

### Moderator actions

Only Moderators and Administrators may use final **Approve** or **Reject** controls.

Approval performs these validated operations in order:

1. Re-fetch the applicant, journal thread, role hierarchy, and available forum tags.
2. Confirm the target journal belongs to the configured server and is still accessible.
3. Confirm the bot role can manage `Verified Runner` but cannot manage Moderator or higher roles.
4. Apply `Verified Runner` to the applicant.
5. Add the staff-only `Verified` tag to the journal while retaining its existing path/status tags.
6. Mark the queue card approved and disable final action buttons.
7. Write a sanitized audit entry containing actor, applicant, journal, outcome, and timestamp.

If role application succeeds but tag application fails, the bot reports the partial failure privately, records it in `#audit-log`, and exposes a Moderator-only retry for only the failed tag step. Reject records the reason and closes the request without changing roles or tags.

## Scheduled and release automation

### Weekly seed

The weekly workflow runs once each week and asks the bot to compute the current `FATE-YYYY-WNN` seed using the tracker's existing implementation. Before posting, the bot checks recent `#announcements` messages for its stable seed marker. An existing marker makes the request a no-op, preventing duplicates after workflow retries.

The announcement mentions only the opt-in `Weekly Seed` role and includes the tracker link and a short explanation that identical seeds plus identical choices reproduce identical fate.

### Release announcements

Tracker and RuneLite repositories send signed release payloads when a release is published. The bot accepts only configured repositories and published-release actions. A stable marker built from repository plus release ID prevents duplicates. The embed includes repository, version, title, canonical release URL, and a bounded description. It mentions only the opt-in `Updates` role.

## Stateless state model

Version one has no database.

- Verification state is represented by the private queue message and its components.
- Compact button payloads contain only opaque identifiers and state version, protected by an HMAC.
- Duplicate verification requests are detected from recent bot-authored queue cards for the applicant and journal.
- Release and seed idempotency use stable markers in recent bot-authored announcement messages.

If Discord history cannot be read, the bot fails closed for role-changing actions and asks staff to retry. It does not guess or create duplicate privileged work.

## Permissions and security

The managed bot role is created below Moderator and above roles it may assign. Grant only:

- View Channels required for commands and staff workflow.
- Send Messages, Embed Links, Attach Files, Read Message History.
- Create Public Threads and Send Messages in Threads where journal workflows need them.
- Manage Threads/Posts for journal tags and queue state.
- Manage Roles only for roles below the bot, principally `Verified Runner`.

Explicitly do not grant Administrator, Manage Webhooks, Manage Server, Manage Channels, Kick Members, Ban Members, Moderate Members, or mass mentions.

Additional controls:

- Verify Discord signatures before reading interaction bodies.
- Check actor role IDs server-side for every privileged component interaction.
- Sign component payloads and reject expired, malformed, replayed, or mismatched payloads.
- Restrict all commands and IDs to the configured guild.
- Validate channel, role, and tag IDs against environment configuration.
- Authenticate GitHub events with timestamped HMAC signatures and repository allow-lists.
- Redact secrets and private evidence from logs and public errors.
- Keep all Vercel and GitHub secrets out of source, build output, fixtures, and reports.

## Failure handling

- Invalid member input receives an ephemeral correction message and makes no mutation.
- Discord rate limits use `Retry-After` with a bounded retry count.
- Transient 5xx failures receive bounded exponential backoff.
- Permanent permission/configuration failures stop immediately and create a sanitized staff audit entry.
- Interaction handlers acknowledge or defer before doing slow REST work.
- Scheduled and release jobs return success for confirmed duplicate markers.
- Vercel outages cause Discord's standard command failure and do not mutate roles or posts.
- GitHub workflow failures remain retryable without duplicate announcements.

## Deployment

### Development

- Create one Discord application owned by the server owner.
- Configure a Vercel preview/production project rooted at `discord-bot/`.
- Enable Vercel's monorepo option that includes source files outside the root directory, allowing the bot to import the canonical seed helper.
- Register guild-scoped commands only for Fate Locked Ironman so command changes are immediate.
- Store the Discord application ID, public key, bot token, guild/channel/role/tag IDs, and component HMAC key in Vercel encrypted environment variables.

### Production

- Keep commands guild-scoped during version one.
- Configure GitHub Actions secrets for the bot endpoint and event HMAC key.
- Add the tracker release workflow first, then the RuneLite workflow after its repository secret is configured.
- The bot remains optional: disabling its role or Vercel project must not break Rules Screening, Onboarding, forums, or normal posting.

## Testing

Unit and integration tests cover:

- Discord Ed25519 signature verification, timestamp handling, and malformed bodies.
- Command registration and exact links.
- Modal validation and configured-guild/channel constraints.
- Fatekeeper and Moderator permission separation.
- Component HMAC generation, expiry, tampering, and replay rejection.
- Approval ordering, partial-failure recovery, and audit records.
- Preservation of path/status tags when applying `Verified`.
- Duplicate verification, weekly-seed, and release-marker detection.
- Exact equality with the tracker's existing `weeklySeed()` output.
- GitHub HMAC, repository allow-list, and release payload validation.
- Discord 429/5xx retry boundaries and permanent failures.
- Secret scans covering bot source, workflows, tests, and documentation.

Live rollout uses labelled test artifacts and deletes them after verification. Because no second Discord account is currently available, member-role end-to-end testing remains a launch blocker; unit/integration coverage and owner-scoped dry runs must not be described as a genuine non-staff test.

## Rollout order

1. Deploy `/tracker`, `/runelite`, `/rules`, and `/weekly-seed` read-only commands.
2. Verify permissions and logs contain no secrets.
3. Enable `/journal create`, create one labelled staff test journal, verify tags, and delete it.
4. Enable `/verify` submission without any role/tag mutation.
5. Verify Fatekeeper recommendations and audit entries.
6. Enable Moderator approval and automatic role/tag changes last.
7. Add the tracker release workflow and verify one labelled test payload.
8. Add the RuneLite release workflow after its repository secret is configured.
9. Enable the weekly workflow after duplicate-marker verification.

## Acceptance criteria

- All commands are guild-scoped and reject other guilds.
- Read-only commands return the canonical links and existing deterministic weekly seed.
- Journal creation produces the approved forum format and required tags.
- Verification requests are private, deduplicated, and auditable.
- Fatekeepers cannot apply roles/tags or make final decisions.
- Only Moderator approval can cause `Verified Runner` and `Verified` tag changes.
- The bot cannot manage webhooks, channels, server settings, or Moderator-and-higher roles.
- Release and weekly posts are idempotent and use only opt-in mentions.
- No database or Cloudflare usage is introduced.
- Main tracker builds and GitHub Pages deployment remain unchanged.
- All automated tests and secret scans pass.
- The bot can be disabled without breaking the Discord server's native core workflows.
