# Fate Locked Ironman Discord Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce the approved Fate Locked Discord brand assets, create and configure the live public Community server, connect a staff-owned unlock webhook, and prove the member and staff flows work without exposing secrets.

**Architecture:** Keep a reviewable local source of truth for generated brand assets, exact server copy, the permission matrix, and the launch report. Perform live configuration through the user's authenticated Discord desktop/browser session using native Community features; use no third-party bot for access control, rules, onboarding, forums, or moderation. Treat Discord as external mutable state and record every verified checkpoint without recording credentials, webhook URLs, session tokens, or private messages.

**Tech Stack:** Discord Community Server, Community Onboarding, Rules Screening, Server Guide, Forum and Announcement channels, AutoMod, Discord webhooks, the Fate Locked React tracker, Node.js 20+, Vitest, PowerShell, and headless Google Chrome for deterministic PNG rendering.

## Global Constraints

- Server name: `Fate Locked Ironman`.
- Public positioning: `Official community for the fan-made Fate Locked Ironman mode. Not affiliated with Jagex.`
- Use the exact `Crystal_key.png`, `Enhanced_crystal_key.png`, and `Sinister_key.png` assets already referenced by the tracker; do not redraw or rotate them.
- Use `#161616` base, `#2d2d2d` panel, `#3e3e3e` border, `#fbbf24` key gold, `#d1d5db` text, and `#8b5cf6` Fate violet.
- Do not purchase Server Boosts, Nitro, a vanity URL, a paid bot, or any other service.
- Discord's channel-list banner is a Boost Level 2 perk. Prepare the approved 960x540 future banner, but upload it only if the control is already available at no cost. Otherwise set the Server Profile colour from the icon and record `deferred-no-boost`.
- The full logo/resource-bar composition is a welcome/community header, not the channel-list banner; Discord recommends keeping server banners free of logos and text.
- Do not share, print, inspect, screenshot, commit, or paste a webhook URL into chat or tool output. Transfer it only with Discord's Copy Webhook URL action and a direct clipboard paste into the tracker's password field.
- Only a trusted staff-owned tracker profile may post to `#live-unlocks`. Community members use run journals.
- `Verified Runner` is recognition, not elevated access or a leaderboard.
- Fatekeepers review evidence but cannot kick, ban, timeout, manage roles, or apply `Verified Runner`; Moderators apply the role after review.
- Use Discord-native Rules Screening and onboarding. Do not create a redundant bot-assigned Member gate.
- Never delete or repurpose an existing Discord server. Create a new server using `Create My Own`.
- Do not create a permanent public invite until every mandatory launch check passes.
- If Discord requests login, CAPTCHA, email verification, password confirmation, or 2FA, stop browser automation and ask the user to complete it directly.
- If a non-staff test account is unavailable, use Onboarding Preview and View Server As Role, record the limitation, and do not claim the true join flow passed or create the public invite.
- Local external-state records must never contain account email, phone number, authentication state, private messages, invite-management tokens, or webhook secrets.
- Follow RED, GREEN, REFACTOR for repository scripts and content contracts. Live Discord tasks use explicit precondition, action, inspection, and evidence steps.

---

## File Structure

### Create

- `scripts/render-discord-assets.mjs`: renders the approved HTML compositions to fixed-size PNGs with installed Chrome.
- `scripts/discord-assets.test.ts`: verifies source asset references and PNG dimensions without image dependencies.
- `scripts/discord-content.test.ts`: pins channels, roles, tags, safety copy, links, and the absence of webhook secrets.
- `docs/discord/assets/source/crystal-key.png`: exact standard key source used by the tracker.
- `docs/discord/assets/source/enhanced-crystal-key.png`: exact Omni-key source used by the tracker.
- `docs/discord/assets/source/sinister-key.png`: exact Chaos Key source used by the tracker.
- `docs/discord/assets/source/server-icon.html`: 512x512 amber key-tile source.
- `docs/discord/assets/source/community-header.html`: 1920x1080 approved command-centre lockup with horizontal resource bar.
- `docs/discord/assets/source/future-server-banner.html`: 960x540 text-free command-centre background for Boost Level 2.
- `docs/discord/assets/fate-locked-server-icon.png`: upload-ready server icon.
- `docs/discord/assets/fate-locked-community-header.png`: upload-ready welcome image.
- `docs/discord/assets/fate-locked-future-server-banner.png`: future compliant server banner.
- `docs/discord/server-content.md`: exact channel topics, starter posts, rules, forum templates, tags, onboarding prompts, and role descriptions.
- `docs/discord/permission-matrix.md`: role order and server/category/channel permission overrides.
- `docs/discord/launch-checklist.md`: deterministic build and live verification checklist.
- `docs/discord/launch-report.md`: sanitized external-state record populated during live setup.

### Read without modifying

- `docs/superpowers/specs/2026-08-02-fate-locked-discord-server-design.md`: approved design and success criteria.
- `tailwind.config.js`: canonical brand tokens.
- `components/WikiIcon.tsx`: canonical wiki-image resolution.
- `components/DiscordSettingsModal.tsx`: safe UI flow for webhook URL, enablement, and `Send test`.
- `utils/discordWebhook.ts`: webhook validation, batching, retry, cursor, and embed behaviour.
- `README.md`: live tracker, repository, and RuneLite guide URLs.

---

### Task 1: Build reproducible Discord brand assets

**Files:**

- Create: `scripts/discord-assets.test.ts`
- Create: `scripts/render-discord-assets.mjs`
- Create: `docs/discord/assets/source/crystal-key.png`
- Create: `docs/discord/assets/source/enhanced-crystal-key.png`
- Create: `docs/discord/assets/source/sinister-key.png`
- Create: `docs/discord/assets/source/server-icon.html`
- Create: `docs/discord/assets/source/community-header.html`
- Create: `docs/discord/assets/source/future-server-banner.html`
- Create: `docs/discord/assets/fate-locked-server-icon.png`
- Create: `docs/discord/assets/fate-locked-community-header.png`
- Create: `docs/discord/assets/fate-locked-future-server-banner.png`

**Interfaces:**

- Consumes: exact OSRS Wiki files named by `components/WikiIcon.tsx` and colour tokens from `tailwind.config.js`.
- Produces: three fixed-size PNG files consumed by Tasks 3 and 5; the renderer CLI exits non-zero if Chrome cannot create any output.

- [ ] **Step 1: Write the failing asset contract test**

Create `scripts/discord-assets.test.ts` with a dependency-free PNG header reader:

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readText = (path: string) => readFileSync(resolve(root, path), 'utf8');
const pngSize = (path: string) => {
  const png = readFileSync(resolve(root, path));
  expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
};

describe('Discord brand assets', () => {
  it('uses the canonical local key files and tracker colours', () => {
    const icon = readText('docs/discord/assets/source/server-icon.html');
    const header = readText('docs/discord/assets/source/community-header.html');
    expect(icon).toContain('./crystal-key.png');
    expect(header).toContain('./crystal-key.png');
    expect(header).toContain('./enhanced-crystal-key.png');
    expect(header).toContain('./sinister-key.png');
    for (const token of ['#161616', '#2d2d2d', '#3e3e3e', '#fbbf24', '#d1d5db', '#8b5cf6']) {
      expect(`${icon}\n${header}`).toContain(token);
    }
  });

  it('renders upload-ready assets at their exact sizes', () => {
    expect(pngSize('docs/discord/assets/fate-locked-server-icon.png')).toEqual({ width: 512, height: 512 });
    expect(pngSize('docs/discord/assets/fate-locked-community-header.png')).toEqual({ width: 1920, height: 1080 });
    expect(pngSize('docs/discord/assets/fate-locked-future-server-banner.png')).toEqual({ width: 960, height: 540 });
  });
});
```

- [ ] **Step 2: Run the test and observe the intended failure**

Run:

```powershell
npx vitest run scripts/discord-assets.test.ts
```

Expected: FAIL because the source and rendered assets do not exist.

- [ ] **Step 3: Download the three exact key files**

Create `docs/discord/assets/source/`, then download:

```powershell
Invoke-WebRequest -UseBasicParsing 'https://oldschool.runescape.wiki/images/Crystal_key.png' -OutFile 'docs/discord/assets/source/crystal-key.png'
Invoke-WebRequest -UseBasicParsing 'https://oldschool.runescape.wiki/images/Enhanced_crystal_key.png' -OutFile 'docs/discord/assets/source/enhanced-crystal-key.png'
Invoke-WebRequest -UseBasicParsing 'https://oldschool.runescape.wiki/images/Sinister_key.png' -OutFile 'docs/discord/assets/source/sinister-key.png'
```

Open all three with the local image viewer and compare them with the tracker header/resource bar. Expected: the standard, Omni, and Chaos key geometry matches exactly.

- [ ] **Step 4: Create the three HTML compositions**

Use full HTML documents with `html, body { margin: 0; overflow: hidden; }` and fixed pixel canvases.

`server-icon.html` contract:

- 512x512 canvas.
- `#161616` outside background.
- A centred 420x420 rounded tile using `linear-gradient(145deg, #d97706, #78350f)`.
- `crystal-key.png` centred at 275x275 with `object-fit: contain` and only a dark drop shadow.
- No text.

`community-header.html` contract:

- 1920x1080 canvas matching the approved v4 mockup.
- Left: exact amber key tile, `FATE LOCKED IRONMAN`, and `RNG EDITION COMMAND CENTER`.
- Right: one horizontal panel with `FATE POINTS`, `13/50`, a 26% amber bar, divider, then exact Standard `14`, Omni `1`, and Chaos `2` counters.
- The resource panel must not stack vertically.
- Footer: `OFFICIAL COMMUNITY FOR THE FAN-MADE MODE · NOT AFFILIATED WITH JAGEX`.

`future-server-banner.html` contract:

- 960x540 canvas.
- No logo, key icon, text, or resource counters.
- Near-black panel texture with restrained amber and violet radial glows.
- Top 48 pixels remain visually quiet for Discord's server title overlay.

- [ ] **Step 5: Implement the Chrome renderer**

Create `scripts/render-discord-assets.mjs` using only Node built-ins:

```js
import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const chrome = process.env.DISCORD_ASSET_CHROME
  || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const jobs = [
  ['server-icon.html', 'fate-locked-server-icon.png', 512, 512],
  ['community-header.html', 'fate-locked-community-header.png', 1920, 1080],
  ['future-server-banner.html', 'fate-locked-future-server-banner.png', 960, 540],
];

const source = resolve(root, 'docs/discord/assets/source');
const output = resolve(root, 'docs/discord/assets');
mkdirSync(output, { recursive: true });

for (const [input, name, width, height] of jobs) {
  const result = spawnSync(chrome, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--force-device-scale-factor=1', `--window-size=${width},${height}`,
    `--screenshot=${resolve(output, name)}`,
    pathToFileURL(resolve(source, input)).href,
  ], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
```

- [ ] **Step 6: Render, test, and visually verify**

Run:

```powershell
node scripts/render-discord-assets.mjs
npx vitest run scripts/discord-assets.test.ts
```

Expected: PASS. Inspect all three PNGs at original resolution. Confirm the exact key images, horizontal resource panel, legible icon crop, quiet banner top, and absence of clipping.

- [ ] **Step 7: Commit the assets and renderer**

```powershell
git add scripts/render-discord-assets.mjs scripts/discord-assets.test.ts docs/discord/assets
git diff --cached --check
git commit -m "feat: add Fate Locked Discord brand assets"
```

---

### Task 2: Create the exact server content and permission source of truth

**Files:**

- Create: `scripts/discord-content.test.ts`
- Create: `docs/discord/server-content.md`
- Create: `docs/discord/permission-matrix.md`
- Create: `docs/discord/launch-checklist.md`
- Create: `docs/discord/launch-report.md`

**Interfaces:**

- Consumes: approved channel/role/tag design from the spec.
- Produces: exact copy and configuration values pasted into Discord in Tasks 3-7; `launch-report.md` is appended with sanitized results.

- [ ] **Step 1: Write a failing content contract test**

Create `scripts/discord-content.test.ts`. Read the three Markdown sources and assert:

```ts
const publicChannels = [
  'welcome', 'rules-and-safety', 'roles-and-pings', 'announcements',
  'general', 'introductions', 'help-and-strategy', 'theorycrafting',
  'media-and-clips', 'run-journals', 'verified-showcase', 'live-unlocks',
  'support-desk', 'ideas-and-feedback', 'events-and-lfg',
  'The Campfire', 'Quiet Grind',
];
const staffChannels = [
  'staff-chat', 'mod-alerts', 'reports-and-appeals',
  'verification-queue', 'audit-log',
];
const roles = [
  'Administrator', 'Moderator', 'Fatekeeper', 'Verified Runner',
  'Vanilla', 'Chunked', 'Custom', 'Spectator',
  'Updates', 'Events', 'Weekly Seed',
];
```

Assert every value appears, the disclaimer appears, all four exact links below appear, and no file matches `/https:\/\/[^\s]*discord(?:app)?\.com\/api\/webhooks\//i`:

- `https://nubles.github.io/OSRS-Fate-Locked/`
- `https://nubles.github.io/OSRS-Fate-Locked/?open=runelite-guide`
- `https://github.com/Nubles/OSRS-Fate-Locked`
- `https://github.com/Nubles/OSRS-Fate-Locked-Runelite`
Use this complete test body around those arrays:

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const paths = [
  'docs/discord/server-content.md',
  'docs/discord/permission-matrix.md',
  'docs/discord/launch-checklist.md',
];

describe('Discord launch content', () => {
  it('covers every channel and role', () => {
    const corpus = paths.map((path) => readFileSync(resolve(root, path), 'utf8')).join('\n');
    for (const name of [...publicChannels, ...staffChannels, ...roles]) {
      expect(corpus, `missing ${name}`).toContain(name);
    }
  });

  it('contains canonical links and disclaimer', () => {
    const content = readFileSync(resolve(root, 'docs/discord/server-content.md'), 'utf8');
    for (const link of canonicalLinks) expect(content).toContain(link);
    expect(content).toContain('Not affiliated with Jagex.');
  });

  it('contains no real webhook URL', () => {
    const corpus = paths.map((path) => readFileSync(resolve(root, path), 'utf8')).join('\n');
    expect(corpus).not.toMatch(/https:\/\/[^\s]*discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+/i);
  });
});
```

Define the links immediately after the role array:

```ts
const canonicalLinks = [
  'https://nubles.github.io/OSRS-Fate-Locked/',
  'https://nubles.github.io/OSRS-Fate-Locked/?open=runelite-guide',
  'https://github.com/Nubles/OSRS-Fate-Locked',
  'https://github.com/Nubles/OSRS-Fate-Locked-Runelite',
];
```

Run `npx vitest run scripts/discord-content.test.ts`. Expected: FAIL because the content files do not exist.

- [ ] **Step 2: Write exact channel topics and starter posts**

In `server-content.md`, include every channel topic and these paste-ready core messages.

Welcome opening:

```text
WELCOME TO FATE LOCKED IRONMAN

Start with everything locked. Earn Keys through OSRS progression. Spend them and let Fate decide which skill, region, activity, boss, bank, or equipment path opens next.

This is the official community for the fan-made Fate Locked Ironman mode. It is not affiliated with Jagex.

START HERE
• Tracker: https://nubles.github.io/OSRS-Fate-Locked/
• RuneLite guide: https://nubles.github.io/OSRS-Fate-Locked/?open=runelite-guide
• Web source: https://github.com/Nubles/OSRS-Fate-Locked
• RuneLite source: https://github.com/Nubles/OSRS-Fate-Locked-Runelite

Choose your path and notifications in Channels & Roles, then create one post for your account in Run Journals.
```

Rules Screening copy, one rule per Discord rule entry:

```text
Treat members with respect. No harassment, hate speech, or targeted abuse.
No NSFW, graphic, or sexualised content.
No scams, phishing, malware, doxxing, impersonation, or credential requests.
Do not facilitate real-world trading, botting, account services, or violations of Jagex or Discord rules.
Keep content in the correct channel and avoid spam or disruptive pings.
Keep relevant self-promotion in #media-and-clips.
Label Custom rules clearly. Never misrepresent a run, ruleset, or verification evidence.
Use the appeal process for good-faith disagreements with moderation decisions.
Never share webhook URLs, private reports, or other sensitive information.
This is a fan community and is not affiliated with Jagex.
```

Add the approved run-journal starter template, support template, suggestion template, verification instructions, webhook explanation, role descriptions, and staff-only response templates (`Needs Info`, `Resolved`, `Approved`, `Needs Review`, `Rejected`).

- [ ] **Step 3: Write the permission matrix**

In `permission-matrix.md`, define this exact role order:

```text
Owner
Administrator
Automation (only when a managed bot role exists)
Moderator
Fatekeeper
Verified Runner
Vanilla / Chunked / Custom / Spectator
Updates / Events / Weekly Seed
@everyone
```

Define category defaults and exceptions:

- `@everyone`: View public channels; Send Messages/Create Posts in member channels after Rules Screening; Connect/Speak in both voice rooms; no `Mention @everyone`, `Manage Messages`, `Manage Threads`, `Manage Webhooks`, `Manage Channels`, `Manage Roles`, moderation, or administrator permissions.
- Notice Board: staff can post; `@everyone` read-only.
- `#live-unlocks`: Administrator/Moderator and its one channel webhook can post; members read-only.
- `#verified-showcase`: Administrator/Moderator can post; Fatekeeper and members read-only.
- Staff category: deny `View Channel` to `@everyone`; allow Owner/Administrator/Moderator. Override `#verification-queue` to allow Fatekeeper; do not expose other staff channels to Fatekeeper.
- Fatekeeper: normal member permissions plus access to `#verification-queue`; no moderation or role-management permissions.
- Moderator: View Audit Log, Manage Messages/Threads/Nicknames/Events, Moderate Members, Kick Members, Ban Members, and Manage Roles only below Moderator; no Manage Webhooks and no Administrator.
- Administrator: Administrator permission.
- `Verified Runner` and all identity/ping roles: no permission grants.

- [ ] **Step 4: Write the launch checklist and report skeleton**

`launch-checklist.md` contains every access, onboarding, forum, safety, integration, mobile, and link check from the spec as unchecked boxes.

`launch-report.md` starts with:

```markdown
# Fate Locked Discord Launch Report

- Server: Fate Locked Ironman
- Configuration status: not started
- Public invite: withheld until launch checks pass
- Webhook secret recorded: no
- Paid features purchased: no

## Checkpoints

| Task | Status | Evidence |
|---|---|---|
```

- [ ] **Step 5: Run tests and commit**

Run:

```powershell
npx vitest run scripts/discord-content.test.ts scripts/discord-assets.test.ts
git diff --check
```

Expected: PASS with zero secret-pattern matches.

Commit:

```powershell
git add scripts/discord-content.test.ts docs/discord
git commit -m "docs: add Discord server launch pack"
```

---

### Task 3: Create the live server and establish Community mode

**Files:**

- Modify: `docs/discord/launch-report.md`

**Interfaces:**

- Consumes: server icon and exact metadata from Tasks 1-2; user's authenticated Discord session.
- Produces: a new Discord server with Community mode enabled and the correct rules/safety channels.

- [ ] **Step 1: Load the browser-control skill and preflight authentication**

Read `chrome:control-chrome` completely before interacting with Discord. Open `https://discord.com/channels/@me` in the user's existing Chrome session.

Expected: the user's Discord account is authenticated. If Discord shows login, email verification, CAPTCHA, password confirmation, or 2FA, stop and ask the user to complete it. Do not handle or record credentials.

- [ ] **Step 2: Create a blank community server**

Use `Add a Server -> Create My Own -> For a club or community`.

- Name: `Fate Locked Ironman`
- Icon: `docs/discord/assets/fate-locked-server-icon.png`

Create the server. Confirm its URL has a new server ID and that no pre-existing server was changed.

- [ ] **Step 3: Prepare the Community prerequisite channels**

Rename the starter `#general` to `#welcome`. Create `#rules-and-safety` and hidden `#mod-alerts` as text channels. Temporarily restrict `#mod-alerts` to the Owner.

Go to `Server Settings -> Enable Community -> Get Started`:

- Require verified email.
- Select `#rules-and-safety` as Rules or Guidelines.
- Select `#mod-alerts` for Community updates and safety notifications.
- Set primary language to English.
- Accept the Community guidelines and finish setup.

Expected: Community settings, Forum channels, Announcement channels, Rules Screening, Server Guide, and Onboarding controls are available.

- [ ] **Step 4: Apply launch branding without buying perks**

Set the public description exactly to:

```text
Official community for the fan-made Fate Locked Ironman OSRS challenge mode. Let Fate decide what you unlock. Not affiliated with Jagex.
```

In Server Profile, select the icon-derived dark/amber banner colour closest to `#161616`. If an image Server Banner upload is already available, upload `fate-locked-future-server-banner.png`; otherwise do nothing and record `deferred-no-boost`. Never open a purchase or Boost checkout.

- [ ] **Step 5: Inspect and record**

Confirm server name, exact crystal-key icon, description, Community state, rules channel, and moderator-updates channel. Append one row to `launch-report.md` with status `pass`; include only the server ID and `banner: uploaded` or `banner: deferred-no-boost`.

- [ ] **Step 6: Commit the sanitized checkpoint**

```powershell
git add docs/discord/launch-report.md
git diff --cached --check
git commit -m "docs: record Discord community creation"
```

---

### Task 4: Create roles, categories, channels, and permission overrides

**Files:**

- Modify: `docs/discord/launch-report.md`

**Interfaces:**

- Consumes: `permission-matrix.md` and the live Community server from Task 3.
- Produces: complete channel hierarchy and least-privilege role model consumed by content, onboarding, and webhook tasks.

- [ ] **Step 1: Create and order roles**

Create, colour, and order:

- `Administrator` — key gold, hoisted, Administrator permission.
- `Moderator` — red, hoisted, permissions from the matrix, never Administrator.
- `Fatekeeper` — Fate violet, hoisted, no moderation permissions.
- `Verified Runner` — success green, hoisted, no permission grants.
- `Vanilla` — amber; `Chunked` — blue; `Custom` — violet; `Spectator` — grey.
- `Updates`, `Events`, `Weekly Seed` — no colour and no permission grants.

Do not create `Automation` until Discord creates a managed bot role for an installed integration.

- [ ] **Step 2: Create the five public categories and channels**

Create in this exact order:

```text
THE NOTICE BOARD
  #welcome
  #rules-and-safety
  #roles-and-pings
  #announcements (Announcement)

ADVENTURERS' GUILD
  #general
  #introductions
  #help-and-strategy
  #theorycrafting
  #media-and-clips

FATE'S LEDGER
  run-journals (Forum)
  #verified-showcase
  #live-unlocks

THE WORKSHOP
  support-desk (Forum)
  ideas-and-feedback (Forum)

THE GATHERING
  #events-and-lfg
  The Campfire (Voice)
  Quiet Grind (Voice)
```

Move the existing prerequisite channels instead of duplicating them.

- [ ] **Step 3: Complete the hidden staff category**

Create `STAFF COMMAND` with:

```text
#staff-chat
#mod-alerts
#reports-and-appeals
#verification-queue
#audit-log
```

Deny category View Channel to `@everyone`, allow Owner/Administrator/Moderator, then override only `#verification-queue` for Fatekeeper. Use Server Settings `View Server As Role` for Fatekeeper and confirm the other four staff channels are invisible.

- [ ] **Step 4: Apply public permission overrides**

Apply the matrix exactly. Confirm:

- Notice Board, `#verified-showcase`, and `#live-unlocks` are read-only to members.
- Member text channels allow Send Messages and threads.
- Forums allow Create Posts and Send Messages in Posts.
- Voice rooms allow View, Connect, Speak, Video, and Activities.
- No member identity, notification, or Verified role changes access.
- `@everyone` and protected role mentions are disabled for normal members.

- [ ] **Step 5: Inspect every role view and record**

Use `View Server As Role` for `@everyone`, Fatekeeper, Verified Runner, and Moderator. Compare visible/writeable channels to `permission-matrix.md`. Append sanitized pass/fail rows to the launch report.

- [ ] **Step 6: Commit the checkpoint**

```powershell
git add docs/discord/launch-report.md
git commit -m "docs: record Discord structure and permissions"
```

---

### Task 5: Publish channel copy, forum tags, and the approved community header

**Files:**

- Modify: `docs/discord/launch-report.md`

**Interfaces:**

- Consumes: `server-content.md` and `fate-locked-community-header.png`.
- Produces: member-facing guidance, searchable forums, and staff response templates.

- [ ] **Step 1: Set every channel topic**

Copy each topic from `server-content.md`. Re-open the channel settings after saving and compare the visible topic character-for-character for all text and forum channels.

- [ ] **Step 2: Publish the Notice Board posts**

Upload `fate-locked-community-header.png` to `#welcome`, followed by the exact welcome opening. Publish the full rules explanation in `#rules-and-safety`, role descriptions in `#roles-and-pings`, and a pre-launch announcement that says the public invite is not open yet.

Pin the primary message in each of the first three channels. Do not pin the pre-launch announcement.

- [ ] **Step 3: Configure run-journals**

Set list view and require tags. Create member tags:

```text
Vanilla, Chunked, Custom, Active, Completed, Archived
```

Create staff-restricted `Verified`. Set the post guideline and starter template from `server-content.md`. Create one clearly labelled `STAFF TEST - delete before launch` post, verify required tags, then delete only that test post.

- [ ] **Step 4: Configure support-desk and ideas-and-feedback**

Support tags:

```text
Tracker, RuneLite, Rules, Bug, Verification
```

Staff tags:

```text
Needs Info, Resolved
```

Feedback tags:

```text
Suggestion, Balance, Content
```

Staff tags:

```text
Under Review, Accepted, Declined
```

Require at least one tag, set list view, and paste the exact post guidelines/templates.

- [ ] **Step 5: Record and commit**

Inspect pinned content, links, attachments, tags, required-tag behaviour, and the disclaimer. Append a pass row with no message IDs or private URLs.

```powershell
git add docs/discord/launch-report.md
git commit -m "docs: record Discord content publication"
```

---

### Task 6: Configure Rules Screening, Onboarding, Server Guide, and AutoMod

**Files:**

- Modify: `docs/discord/launch-report.md`

**Interfaces:**

- Consumes: exact rules, onboarding questions, roles, and channels from Tasks 2, 4, and 5.
- Produces: native join flow and moderation protection that requires no third-party bot.

- [ ] **Step 1: Configure Rules Screening**

Open `Server Settings -> Safety Setup`. Enable `Members must accept rules before they can talk or DM`. Add the ten exact rules from `server-content.md` in the documented order and save.

Expected in preview: ten concise rules, with no bot verification step.

- [ ] **Step 2: Configure Community Onboarding default channels**

Set these seven defaults:

```text
#general
#introductions
#help-and-strategy
#theorycrafting
#media-and-clips
run-journals
#events-and-lfg
```

Confirm at least five allow `@everyone` to send after screening.

- [ ] **Step 3: Add exact onboarding questions**

Required, multi-select:

```text
What path are you following?
Vanilla -> Vanilla role
Chunked -> Chunked role
Custom -> Custom role
Spectator -> Spectator role
```

Optional, multi-select:

```text
What do you want notifications for?
Tracker and mode updates -> Updates role
Community events -> Events role
Weekly seed -> Weekly Seed role
```

Optional, multi-select:

```text
What would you like to explore?
Run journals -> run-journals
Technical support -> support-desk
Ideas and feedback -> ideas-and-feedback
```

Publish Onboarding and use its preview to exercise every answer.

- [ ] **Step 4: Configure Server Guide**

Add the welcome message and four actions:

- `Read the official Codex` -> tracker home, with copy explaining Gear menu -> Rules/Codex.
- `Open the Fate Locked tracker` -> `https://nubles.github.io/OSRS-Fate-Locked/`.
- `Install/connect RuneLite` -> `https://nubles.github.io/OSRS-Fate-Locked/?open=runelite-guide`.
- `Create a run journal` -> `run-journals`.

Do not invent a Codex deep link; the app currently has none.

- [ ] **Step 5: Configure AutoMod and raid protection**

Enable:

- Block Spam Content: block and alert `#mod-alerts`.
- Block Mention Spam: threshold 5, block and alert `#mod-alerts`, no automatic timeout at launch.
- Raid Protection alerts to `#mod-alerts`.
- Require 2FA for moderation actions.

Do not exempt public channels. Exempt only `#mod-alerts` and `#audit-log` if Discord requires an alert destination exemption.

- [ ] **Step 6: Preview, record, and commit**

Use Rules Screening and Onboarding previews. Use a harmless five-mention test from a non-staff context only if an alt account is available; otherwise defer that single runtime test to Task 8.

Append results to the launch report.

```powershell
git add docs/discord/launch-report.md
git commit -m "docs: record Discord onboarding and safety setup"
```

---

### Task 7: Create and safely connect the trusted unlock webhook

**Files:**

- Modify: `docs/discord/launch-report.md`

**Interfaces:**

- Consumes: `#live-unlocks`, a user-confirmed trusted staff-owned tracker profile, and `DiscordSettingsModal`.
- Produces: one channel-scoped webhook configured locally for that profile, with a successful test embed.

- [ ] **Step 1: Confirm the trusted profile with the user**

Open the tracker profile switcher and show the profile names without exporting data. Ask the user which profile is the official staff-owned posting profile. Do not infer from a demo or guide profile. Continue only after the user names it.

- [ ] **Step 2: Create the channel-scoped webhook**

In Discord, open `#live-unlocks -> Edit Channel -> Integrations -> Webhooks -> New Webhook`.

- Name: `Fate Locked Unlocks`
- Channel: `#live-unlocks`
- Avatar: `fate-locked-server-icon.png`

Save. Do not expose or inspect the URL.

- [ ] **Step 3: Transfer the secret without revealing it**

Click Discord's `Copy Webhook URL`. Navigate directly to the tracker, select the confirmed profile, then open `Gear -> Discord notifications`. Focus the password input and paste using the system paste command. Never read the clipboard or show the field contents.

Expected: the field validates green and remains masked.

- [ ] **Step 4: Send the non-gameplay test embed**

Click `Send test`. Expected toast: `Test message sent — check your channel`. Confirm exactly one `Fate Locked Ironman connected` embed appears in `#live-unlocks` with a gold accent. This test must not spend a Key or alter run history.

Enable `Announcements: on`. Confirm the UI explains that enablement starts from now and will not flood back-catalogue events.

- [ ] **Step 5: Verify secret containment and record**

Run:

```powershell
rg -n "discord(?:app)?\.com/api/webhooks" docs scripts README.md
```

Expected: only validator/test patterns already present in source; no real numeric webhook path or token in new files.

Append only `webhook: configured; test embed: pass; secret recorded: no` to the launch report.

- [ ] **Step 6: Commit the sanitized checkpoint**

```powershell
git add docs/discord/launch-report.md
git diff --cached --check
git commit -m "docs: record Discord webhook verification"
```

---

### Task 8: Perform the launch audit and create the public invite

**Files:**

- Modify: `docs/discord/launch-checklist.md`
- Modify: `docs/discord/launch-report.md`

**Interfaces:**

- Consumes: completed server, launch checklist, non-staff test account, desktop Chrome, and a mobile Discord client or responsive browser view.
- Produces: a fully checked launch record and, only after all mandatory checks pass, the public invite handed to the user.

- [ ] **Step 1: Run read-only role inspections first**

Use `View Server As Role` for `@everyone`, Fatekeeper, Verified Runner, and Moderator. Check every access item in `launch-checklist.md`. Correct any mismatch in Discord, repeat the inspection, and record the final state only.

- [ ] **Step 2: Test the true non-staff join flow**

Create a temporary invite with a short expiry and one use. The user opens it with a non-staff account.

Verify:

- Rules Screening blocks chat until accepted.
- Ten rules render correctly.
- All three onboarding questions work.
- Selected roles appear; unselected ping roles do not.
- Seven defaults appear.
- Staff channels remain invisible.
- Member channels allow posting after screening.
- Read-only and webhook channels reject member posting.
- A run journal requires run-type and state tags.
- A harmless message with six mentions exceeds the threshold of five, is blocked, and creates one alert.
Rehearse verification with synthetic evidence labelled `STAFF TEST`: the
Fatekeeper records `Approved` in `#verification-queue`, then a Moderator applies
`Verified Runner` and the staff-only `Verified` journal tag to the test account.
Confirm Fatekeeper cannot apply either change. Remove the test role, tag, queue
message, and journal post after the check.

If no non-staff account is available, stop here, record `blocked: non-staff account required`, and do not create the public invite.

- [ ] **Step 3: Test desktop and mobile presentation**

On desktop and mobile, confirm:

- The exact key remains identifiable in the circular server icon crop.
- Category/channel names do not truncate into ambiguity.
- The welcome header, pinned messages, and links render.
- Forum creation and tag selection are usable.
- Voice rooms can be joined and left.
- The disclaimer is visible in the server description and rules.

- [ ] **Step 4: Verify external links and optional-feature resilience**

Open the tracker, RuneLite guide, web repository, and plugin repository links from Discord. Temporarily disable any optional integration role visibility without deleting it and confirm rules, onboarding, forums, and normal posting remain usable. Re-enable the integration.

Confirm the future server banner is either uploaded through an already-available control or recorded `deferred-no-boost`; never purchase access.

- [ ] **Step 5: Close test artefacts**

Delete the one-use test invite after testing. Remove any remaining `STAFF TEST` posts or messages. Keep the webhook test embed because it proves the official feed connection, unless the user asks to remove it.

- [ ] **Step 6: Create the permanent public invite**

Only when every mandatory checklist item is checked:

- Create an unlimited-use, no-expiry invite targeting `#welcome`.
- Copy it once and return it directly to the user.
- Do not add it to the repository or tracker without a separate explicit request.

- [ ] **Step 7: Final local verification and launch report**

Update:

```markdown
- Configuration status: passed
- Public invite: created and delivered to owner; URL not stored in repository
- Webhook secret recorded: no
- Paid features purchased: no
```

Run:

```powershell
npx vitest run scripts/discord-assets.test.ts scripts/discord-content.test.ts
git diff --check
git status --short
```

Expected: tests PASS, no whitespace errors, and only the checklist/report changes for this task remain.

- [ ] **Step 8: Commit the launch record**

```powershell
git add docs/discord/launch-checklist.md docs/discord/launch-report.md
git commit -m "docs: record Fate Locked Discord launch"
```

---

## Plan Self-Review Checklist

- Every approved public and staff channel is created exactly once.
- Every approved role appears and no redundant Member role is introduced.
- Every forum has its required member and staff tags.
- Exact tracker key assets and colour tokens are pinned by tests.
- The approved horizontal resource bar is produced in the community header.
- Discord's no-text server-banner guidance is honoured separately.
- Community mode precedes creation of Forum and Announcement channels.
- Fatekeeper/Moderator verification separation is testable.
- Webhook setup never reads or records the secret.
- The plan contains an explicit user confirmation for the trusted posting profile.
- The permanent invite is gated on a real non-staff join test.
- No task spends money or assumes Boost perks.
- No third-party bot is necessary for core operation.
