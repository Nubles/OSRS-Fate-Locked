# Fate Locked Ironman Discord Server Content

This file is the paste-ready source of truth for channel topics, starter posts, and role descriptions. **Not affiliated with Jagex.**

## Channel topics

| Category | Channel | Type | Topic |
|---|---|---|---|
| Notice Board | `#welcome` | Text/resource | Start here: learn Fate Locked Ironman, find the tracker and companion, then choose your path. |
| Notice Board | `#rules-and-safety` | Text/resource | Community rules, safety guidance, verification policy, and fan-project disclaimer. |
| Notice Board | `#roles-and-pings` | Text/resource | Choose identity roles and opt into only the notifications you want. |
| Notice Board | `#announcements` | Announcement | Official project, rules, release, and weekly-seed notices. |
| Adventurers' Guild | `#general` | Text | Main Fate Locked conversation. |
| Adventurers' Guild | `#introductions` | Text | Introduce yourself, your run, and your OSRS experience. |
| Adventurers' Guild | `#help-and-strategy` | Text | Ask quick gameplay, tracker, routing, and progression questions. |
| Adventurers' Guild | `#theorycrafting` | Text | Discuss deeper rules, balance, routes, and mode ideas. |
| Adventurers' Guild | `#media-and-clips` | Text | Share Fate Locked screenshots, videos, streams, and milestones. |
| Fate's Ledger | `#run-journals` | Forum, list view | One persistent, chronological post per Fate Locked run. |
| Fate's Ledger | `#verified-showcase` | Text/showcase | Staff-posted, opt-in summaries of approved verified runs. |
| Fate's Ledger | `#live-unlocks` | Text/webhook | Trusted staff-owned tracker unlock embeds and staff updates. |
| The Workshop | `#support-desk` | Forum, list view | Get help with the tracker, RuneLite, rules, bugs, or verification. |
| The Workshop | `#ideas-and-feedback` | Forum, list view | Share suggestions and discuss balance or content ideas. |
| The Gathering | `#events-and-lfg` | Text | Weekly seeds, community events, and group activity. |
| The Gathering | `The Campfire` | Voice | Normal social voice. |
| The Gathering | `Quiet Grind` | Voice | Low-interruption co-working and grinding. |
| Staff | `#staff-chat` | Text | Staff coordination. |
| Staff | `#mod-alerts` | Text | AutoMod and raid alerts. |
| Staff | `#reports-and-appeals` | Text | Internal case handling and second reviews. |
| Staff | `#verification-queue` | Text | Fatekeeper findings and Moderator approval actions. |
| Staff | `#audit-log` | Text | Bot, webhook, moderation, and configuration events. |

## Notice Board posts

### `#welcome` — opening post

```text
WELCOME TO FATE LOCKED IRONMAN

Start with everything locked. Earn Keys through OSRS progression. Spend them and let Fate decide which skill, region, activity, boss, bank, or equipment path opens next.

Official community for the fan-made Fate Locked Ironman mode. Not affiliated with Jagex.

START HERE
• Tracker: https://nubles.github.io/OSRS-Fate-Locked/
• RuneLite guide: https://nubles.github.io/OSRS-Fate-Locked/?open=runelite-guide
• Web source: https://github.com/Nubles/OSRS-Fate-Locked
• RuneLite source: https://github.com/Nubles/OSRS-Fate-Locked-Runelite

Choose your path and notifications in Channels & Roles, then create one post for your account in Run Journals.
```

### `#rules-and-safety` — Rules Screening entries

Enter each line as one Discord rule entry:

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

### `#roles-and-pings` — role descriptions

```text
Identity roles
• Vanilla — following the standard Fate Locked ruleset.
• Chunked — playing with a chunk-based ruleset.
• Custom — using a clearly stated custom ruleset.
• Spectator — here to follow runs, discuss, and cheer players on.

Recognition
• Verified Runner — staff-awarded recognition for an approved run; it grants no extra permissions.

Notifications
• Updates — project and mode updates.
• Events — community events and looking-for-group activity.
• Weekly Seed — weekly seed notices.

Choose only the roles that describe your run and the pings you want. Custom runs must be labelled clearly in journals and showcase posts.
```

## Community Onboarding configuration

Configure these three prompts exactly.

### Required, multi-select

```text
What path are you following?
Vanilla -> Vanilla role
Chunked -> Chunked role
Custom -> Custom role
Spectator -> Spectator role
```

### Optional, multi-select

```text
What do you want notifications for?
Tracker and mode updates -> Updates role
Community events -> Events role
Weekly seed -> Weekly Seed role
```

### Optional, multi-select

```text
What would you like to explore?
Run journals -> run-journals
Technical support -> support-desk
Ideas and feedback -> ideas-and-feedback
```

## Forum starter posts and templates

### `#run-journals`

Require one run-type tag (`Vanilla`, `Chunked`, or `Custom`) and one state tag (`Active`, `Completed`, or `Archived`). `Verified` is staff-only. Use this post title format: `RSN or run name - mode - start date`.

```text
Run name / RSN:
Ruleset and seed (if any):
Start date:
Current goal:
Tracker or run-card link / image:
Custom-rule summary (if applicable):
May this run be considered for verification? Yes / No
```

### `#support-desk`

Tags: `Tracker`, `RuneLite`, `Rules`, `Bug`, `Verification`; `Needs Info` and `Resolved` are staff-only.

```text
What do you need help with?
Relevant tag:
What happened?
What did you expect to happen?
Steps to reproduce (required for bugs):
Tracker, RuneLite, browser, and OS details (if relevant):
Screenshot or error text (remove private information first):
Run-journal link (required for verification requests):
```

Verification requests are public and opt-in. Do not post anything you do not want associated with your public run.

### `#ideas-and-feedback`

Tags: `Suggestion`, `Balance`, `Content`; `Under Review`, `Accepted`, and `Declined` are staff-only.

```text
Idea title:
Category:
Problem or opportunity:
Proposed change:
Why it would help Fate Locked:
Trade-offs or edge cases:
```

Staff give declined ideas a short reason and link related prior decisions when useful.

## Verification instructions

```text
Verification is recognition, not a leaderboard.

1. Create or update your run journal.
2. Open a Verification support post with the journal link and .fate bundle.
3. A Fatekeeper checks bundle integrity, run identity, ruleset, and obvious inconsistencies using the project verification tools.
4. The Fatekeeper records Approved, Needs Review, or Rejected with a reason in #verification-queue.
5. A Moderator applies Verified Runner and the staff-only Verified forum tag for an approved run.
6. Staff publish a concise opt-in summary in #verified-showcase.

Custom runs may be verified for internal integrity, but the showcase labels them Custom and never presents them as official-rules completions. Incomplete, damaged, or ambiguous bundles receive Needs Review; staff never infer missing evidence or award a speculative badge.
```

## `#live-unlocks` webhook explanation

```text
This channel is for one trusted staff-owned tracker profile and staff posts only. Its webhook URL is a secret: store it only in that trusted profile or an approved secret store. Never post, screenshot, export, relay, or distribute it. Members should use run journals for public submissions.

Webhook delivery is non-blocking. If an automated post fails, journals and manual staff announcements remain the authoritative community record. A future community-wide feed requires a proper bot or signed server-side relay.
```

## Staff-only response templates

### `Needs Info`

```text
Needs Info
To continue, please add: [specific missing information]. For bugs, include reproduction steps. For verification, include the public run-journal link. Do not share private credentials, webhook URLs, or anything you do not want associated with your public run.
```

### `Resolved`

```text
Resolved
Outcome: [what was fixed, answered, or decided]
Reference: [relevant link or guidance]
```

### `Approved`

```text
Approved
Run journal: [link]
Ruleset: [Vanilla / Chunked / Custom]
Evidence reviewed: [summary]
Reason: [integrity and identity finding]
Moderator action required: apply Verified Runner and Verified tag.
```

### `Needs Review`

```text
Needs Review
Run journal: [link]
Reason: [incomplete, damaged, ambiguous, or conflicting evidence]
Next step: [specific evidence or second review needed]
No recognition is granted until a documented decision is complete.
```

### `Rejected`

```text
Rejected
Run journal: [link]
Reason: [clear, factual reason]
Evidence considered: [summary]
Appeal route: use the documented good-faith appeal process.
```
