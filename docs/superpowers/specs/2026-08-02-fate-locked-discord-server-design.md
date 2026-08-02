# Fate Locked Ironman Discord Server Design

**Date:** 2 August 2026
**Status:** Approved design
**Server name:** Fate Locked Ironman
**Positioning:** Official community for the fan-made Fate Locked Ironman OSRS challenge mode

## 1. Purpose

Create a dedicated public Discord server for Fate Locked Ironman. The server
must support new players, active runners, spectators, custom variants,
technical support, theorycrafting, progress journals, and opt-in run
verification without feeling empty at launch.

The Discord is official to the Fate Locked project, not to Old School
RuneScape or Jagex. Public descriptions and the rules must say:

> Official community for the fan-made Fate Locked Ironman mode. Not affiliated
> with Jagex.

### Goals

- Give new players a clear path from joining to starting a run.
- Make the official rules, tracker, and RuneLite companion easy to find.
- Give each run a durable, searchable journal without creating personal
  channels.
- Support Vanilla, Chunked, and clearly labelled Custom runs.
- Recognise verified runs without making the server primarily competitive.
- Keep moderation and automation safe and manageable for a small launch team.
- Match the existing Fate Locked command-centre visual identity.
- Scale cleanly without launching dozens of inactive channels.

### Non-goals for launch

- Ranked leaderboards.
- Automated public verification.
- A public webhook URL shared with members.
- Per-player text channels.
- Creator-specific categories.
- Ticket, economy, levelling, or giveaway bots.
- Separate categories for every PvM or social activity.

## 2. Inspiration and design approach

Comparable OSRS challenge communities succeed by combining an agreed ruleset,
beginner help, theorycrafting, custom variants, and long-form player progress.
Established Ironman communities add events and veteran guidance once the core
community is active.

The chosen approach is a **structured launchpad**: seventeen
public channels across five categories, plus a small hidden staff area. It is
more complete than a minimal chat server but intentionally smaller than a
full-scale OSRS clan server.

Reference material:

- [Tileman community note](https://www.reddit.com/r/2007scape/comments/tt8vwe)
- [Iron Empire community overview](https://discord.com/servers/iron-empire-759262138408632320)
- [Discord Community Onboarding](https://support.discord.com/hc/en-us/articles/11074987197975-Community-Onboarding-FAQ)
- [Discord Rules Screening](https://support.discord.com/hc/en-us/articles/1500000466882-Rules-Screening-FAQ)
- [Discord Forum Channels](https://support.discord.com/hc/en-us/articles/6208479917079-Forum-Channels-FAQ)
- [Discord AutoMod](https://support.discord.com/hc/en-us/articles/4421269296535-AutoMod-FAQ)

## 3. Brand system

The Discord extends the existing tracker UI rather than introducing a new
fantasy or parchment theme.

### Canonical identity

- **Name:** Fate Locked Ironman
- **Header line:** RNG Edition Command Center
- **Community line:** Official Community Command Center
- **Short hook:** Let Fate decide what you unlock.
- **Disclaimer:** Not affiliated with Jagex.

### Canonical mark

Use the exact `Crystal_key.png` mark already used by `WikiIcon` in the tracker
header. Centre it without redrawing, rotating, outlining, or simplifying it in
the same rounded amber gradient tile used by the application.

Related resource-bar graphics use the exact existing assets:

- Standard Key: `Crystal_key.png`
- Omni-key: `Enhanced_crystal_key.png`
- Chaos Key: `Sinister_key.png`

The application currently resolves these assets from the Old School RuneScape
Wiki. Their use must remain within the fan-project presentation and must never
imply Jagex endorsement.

### Palette and visual language

Use the source tokens already defined in `tailwind.config.js`:

| Purpose | Colour |
|---|---|
| Base background | `#161616` |
| Panel | `#2d2d2d` |
| Border | `#3e3e3e` |
| Key gold | `#fbbf24` |
| Main text | `#d1d5db` |
| Fate violet | `#8b5cf6` |
| Success | `#22c55e` |
| Failure | `#ef4444` |
| Pity/amber state | `#f59e0b` |

The server icon uses the crystal key in the amber-to-brown rounded tile. The
banner uses near-black command-centre panels, compact uppercase labels, one-pixel
borders, key gold for primary emphasis, and Fate violet as the secondary
accent. Green, red, and blue remain reserved for meaningful gameplay states.

The banner's resource component mirrors the tracker: an amber Fate Points
progress bar on the left, a subtle divider, then compact Standard, Omni, and
Chaos Key counters using the exact three key assets.

## 4. Server architecture

### The Notice Board

| Channel | Type | Purpose | Posting |
|---|---|---|---|
| `#welcome` | Text/resource | Quick start, project description, primary links | Staff only |
| `#rules-and-safety` | Text/resource | Community rules, verification policy, disclaimer | Staff only |
| `#roles-and-pings` | Text/resource | Explains self-selected identity and notification roles | Staff only |
| `#announcements` | Announcement | Project, rules, release, and weekly-seed notices | Staff only |

### Adventurers' Guild

| Channel | Type | Purpose | Posting |
|---|---|---|---|
| `#general` | Text | Main Fate Locked conversation | Members |
| `#introductions` | Text | Player, run, and OSRS introductions | Members |
| `#help-and-strategy` | Text | Quick gameplay and routing questions | Members |
| `#theorycrafting` | Text | Deeper rules, balance, routing, and mode discussion | Members |
| `#media-and-clips` | Text | Screenshots, videos, streams, and milestones | Members |

### Fate's Ledger

| Channel | Type | Purpose | Posting |
|---|---|---|---|
| `run-journals` | Forum, list view | One persistent post per run | Members |
| `#verified-showcase` | Text/showcase | Approved summaries of opt-in verified runs | Staff only |
| `#live-unlocks` | Text/webhook | Trusted staff-owned profile unlock embeds | Webhook and staff only |

### The Workshop

| Channel | Type | Purpose | Posting |
|---|---|---|---|
| `support-desk` | Forum, list view | Tracker, RuneLite, rules, bug, and verification help | Members |
| `ideas-and-feedback` | Forum, list view | Suggestions and balance/content discussion | Members |

### The Gathering

| Channel | Type | Purpose | Posting |
|---|---|---|---|
| `#events-and-lfg` | Text | Weekly seeds, community events, and group activity | Members |
| `The Campfire` | Voice | Normal social voice | Members |
| `Quiet Grind` | Voice | Low-interruption co-working/grinding | Members |

### Hidden staff area

| Channel | Purpose |
|---|---|
| `#staff-chat` | Staff coordination |
| `#mod-alerts` | AutoMod and raid alerts |
| `#reports-and-appeals` | Internal case handling and second reviews |
| `#verification-queue` | Fatekeeper findings and Moderator approval actions |
| `#audit-log` | Bot, webhook, moderation, and configuration events |

The hidden category is visible only to staff roles. Per-channel overrides limit
Fatekeepers to `#verification-queue`; they use the public support post as their
evidence source and do not receive unrelated moderation access.

## 5. Roles and permissions

### Staff and automation hierarchy

1. **Owner** — server ownership and emergency control.
2. **Administrator** — server, role, channel, onboarding, integration, and
   safety configuration.
3. **Automation** — managed bot roles only when required, with least privilege
   and positioned only above roles they must manage.
4. **Moderator** — message management, timeouts, kicks, bans, verification
   badge assignment, and case handling; no blanket Administrator permission.
5. **Fatekeeper** — reviews `.fate` bundles and records a decision in the
   verification queue; no ban, kick, timeout, or role-management permission.

### Community roles

- **Verified Runner** — staff-awarded recognition only; no elevated posting
  permissions.
- **Vanilla**, **Chunked**, **Custom**, **Spectator** — self-selected identity
  roles.
- **Updates**, **Events**, **Weekly Seed** — self-selected notification roles.
- **@everyone** — read onboarding and public information, subject to Rules
  Screening before normal community participation. There is no redundant
  bot-assigned membership gate.

Only Moderators and higher assign `Verified Runner`. Fatekeepers provide the
evidence decision so they do not need `Manage Roles`.

### Permission principles

- Deny public posting in official, showcase, and webhook channels.
- Deny `@everyone`, `@here`, and role mentions to normal members.
- Keep webhooks scoped to one target channel.
- Give bots only the channel and role permissions required for their function.
- Never use a member-visible role as a security boundary for webhook secrets.
- Keep staff roles above every role they manage and below the Owner.

## 6. Onboarding and member flow

The member path is:

`Join -> accept rules -> answer onboarding -> read quick start -> chat or create a run journal`

Enable Community mode, Rules Screening, Community Onboarding, Server Guide,
AutoMod, and raid alerts.

### Default onboarding channels

Discord currently requires at least seven default channels, including at least
five in which `@everyone` can send messages. Use these seven member-facing
defaults:

1. `#general`
2. `#introductions`
3. `#help-and-strategy`
4. `#theorycrafting`
5. `#media-and-clips`
6. `run-journals`
7. `#events-and-lfg`

The four Notice Board channels remain visible as public resources but are not
counted on to satisfy the writable-default requirement.

### Onboarding questions

1. **What path are you following?** Required, one or more answers: Vanilla,
   Chunked, Custom, Spectator. Assign the matching identity roles.
2. **What do you want notifications for?** Optional, multiple answers: Tracker
   and mode updates, Community events, Weekly seed. Assign the matching ping
   roles.
3. **What would you like to explore?** Optional, multiple answers: Run
   journals, Technical support, Ideas and feedback. Add the relevant forum
   channels to the member's channel list.

The Server Guide contains four actions:

- Read the official Codex.
- Open the Fate Locked tracker.
- Install/connect the RuneLite companion.
- Create a run journal.

## 7. Forum design and content templates

### Run journals

Use list view because updates are primarily chronological text with supporting
screenshots. Require at least one run-type tag and one state tag.

Member-selectable tags:

- `Vanilla`
- `Chunked`
- `Custom`
- `Active`
- `Completed`
- `Archived`

Staff-only tag:

- `Verified`

Post title format:

`RSN or run name - mode - start date`

Starter template:

- RuneScape name or preferred display name.
- Ruleset and seed, if any.
- Start date.
- Current goal.
- Tracker/run-card link or image.
- Custom-rule summary when applicable.
- Whether the player may be considered for verification.

### Support desk

Tags:

- `Tracker`
- `RuneLite`
- `Rules`
- `Bug`
- `Verification`
- Staff-only `Needs Info`
- Staff-only `Resolved`

Require reproduction details for bugs and the run-journal link for verification
requests. A verification request is public and opt-in; members must not be told
to upload anything they do not want associated with their public run.

### Ideas and feedback

Tags:

- `Suggestion`
- `Balance`
- `Content`
- Staff-only `Under Review`
- Staff-only `Accepted`
- Staff-only `Declined`

Declined ideas receive a short reason so repeated proposals can be linked to an
existing decision.

## 8. Run verification

Verification is recognition, not a leaderboard.

1. The player creates or updates a run journal.
2. The player opens a `Verification` support post with the journal link and
   `.fate` bundle.
3. A Fatekeeper checks bundle integrity, run identity, ruleset, and obvious
   inconsistencies using the project's verification tools.
4. The Fatekeeper records `Approved`, `Needs Review`, or `Rejected` with a
   reason in `#verification-queue`.
5. A Moderator applies `Verified Runner` and the staff-only `Verified` forum
   tag for an approved run.
6. Staff publish a concise summary in `#verified-showcase`.

Custom runs can be verified for internal integrity, but the showcase must label
them `Custom`; they are never presented as official-rules completions.

If a bundle is incomplete, damaged, or ambiguous, use `Needs Review`. Never
infer missing evidence or award a speculative badge.

## 9. Webhook and integration design

The tracker already supports per-profile Discord webhook announcements. The
webhook URL lives outside GameState and must not travel in exports or relay
codes.

For the public server:

- Create one webhook scoped to `#live-unlocks`.
- Store its URL only in a trusted staff-owned tracker profile or approved
  secret store.
- Do not post the URL in staff messages, documentation, screenshots, or member
  instructions.
- Do not let members paste the official webhook into their own tracker.
- Use member run journals for all untrusted/public submissions.
- If an automated community-wide feed is built later, require a proper bot or
  signed server-side relay; do not distribute a Discord webhook secret.

Webhook failure is non-blocking. The community continues through journals and
manual staff announcements. Existing tracker behaviour may drop a failed
announcement rather than duplicate it; the Discord must not treat the feed as
the authoritative run record.

## 10. Rules and moderation

Rules Screening should contain concise versions of these rules:

1. Treat members with respect; no harassment, hate speech, or targeted abuse.
2. No NSFW content, graphic content, or sexualised discussion.
3. No scams, phishing, malware, doxxing, impersonation, or credential requests.
4. Do not facilitate real-world trading, botting, account services, or other
   violations of Jagex or Discord rules.
5. Keep content in the appropriate channel and avoid spam or disruptive pings.
6. Self-promotion belongs in `#media-and-clips` and must relate to Fate Locked
   or relevant OSRS challenge content.
7. Label custom rules clearly and never misrepresent a run's rules or evidence.
8. Respect moderator decisions and use the appeal process for good-faith
   disagreements. Appeal by direct message to a Moderator or Administrator;
   the contacted staff member records the case in `#reports-and-appeals`.
9. Protect webhook URLs, private reports, and other sensitive information.
10. The server is a fan community and is not affiliated with Jagex.

Safety configuration:

- Enable Discord's spam and mention-spam AutoMod rules.
- Send AutoMod and raid alerts to `#mod-alerts`.
- Use a conservative mention limit and exempt only staff-controlled channels.
- Require 2FA for moderation actions.
- Keep Discord audit logging enabled and mirror integration events to
  `#audit-log` where supported.
- Apply slow mode only where actual message volume or spam requires it.

Moderation cases record the rule, evidence link, action, acting staff member,
and appeal result. Appeals receive review by a staff member who did not take the
original action whenever staffing permits.

## 11. Failure handling

| Failure | Behaviour |
|---|---|
| Optional bot unavailable | Core onboarding, discussion, forums, and rules continue through native Discord features. |
| Webhook post fails | Do not retry manually unless staff confirm the post is absent; journals remain authoritative. |
| Verification evidence is ambiguous | Mark `Needs Review`; do not grant or remove recognition without a documented decision. |
| Broken tracker or RuneLite link | Correct the Server Guide and welcome resource; post an announcement only if members are affected. |
| Raid or spam surge | Allow native raid protection and AutoMod to contain it; restrict invites or slow channels temporarily if needed. |
| Staff disagreement | Pause the irreversible action, request a second review, and record the final rationale. |
| Leaked webhook URL | Delete the webhook immediately, create a replacement, update the trusted profile, and document the incident without reposting the secret. |

## 12. Launch verification

Before opening a public invite, test with a non-staff Discord account on desktop
and mobile.

### Access and onboarding

- Rules Screening blocks posting and direct member contact until accepted.
- All seven onboarding defaults appear.
- Each onboarding answer assigns only the intended roles and channels.
- Public information is readable without staff permissions.
- Staff and audit categories are invisible to members.

### Permissions

- Members cannot post in `#welcome`, `#rules-and-safety`,
  `#roles-and-pings`, `#announcements`, `#verified-showcase`, or
  `#live-unlocks`.
- Members cannot mention `@everyone`, `@here`, or protected roles.
- Fatekeepers can access verification material but cannot moderate members or
  assign roles.
- Moderators can perform intended actions without Administrator permission.
- The webhook can post only to `#live-unlocks`.

### Forums and content

- A run journal requires a run-type and state tag.
- Support and feedback templates are present and understandable.
- Staff-only tags cannot be self-applied.
- Verification follows the documented two-role Fatekeeper/Moderator flow.

### Safety and resilience

- A harmless mention-spam test triggers AutoMod and creates a staff alert.
- Raid alerts and staff 2FA requirements are enabled.
- Removing or disabling optional bot access does not break core server use.
- A test webhook embed renders correctly and does not expose its URL.

### Links and presentation

- Tracker, Codex, RuneLite guide, repository, and support links resolve.
- Server icon remains legible at small size.
- Banner crops acceptably on desktop and mobile.
- The fan-project/Jagex disclaimer appears in the public description and rules.

## 13. Rollout

1. Build the server privately.
2. Apply roles, permissions, Community settings, forums, tags, and starter
   content.
3. Add the canonical icon and banner assets.
4. Test every item in the launch verification section with a non-staff account.
5. Invite the initial Moderator/Fatekeeper team and correct any permission
   issues.
6. Soft-launch to a small group of known Fate Locked players.
7. Open the public invite after the soft-launch checks pass.

## 14. Success criteria

The launch is successful when:

- A new member can understand the mode and find the tracker within two minutes.
- A player can create a correctly tagged journal without staff help.
- Vanilla, Chunked, Custom, and Spectator members are clearly distinguishable.
- Verification produces a documented, reviewable decision without granting
  Fatekeepers moderation authority.
- No public or member-facing surface exposes a webhook secret.
- All public channels have a clear active purpose.
- The Discord is visually recognisable as part of the existing Fate Locked
  tracker.
- The server remains useful when optional automation is unavailable.
