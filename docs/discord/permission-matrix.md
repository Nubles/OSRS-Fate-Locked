# Fate Locked Ironman Permission Matrix

Apply roles in this exact order, from highest to lowest:

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

`Owner` remains the server owner and emergency-control role. `Automation` exists only for a managed bot role, with least privilege and positioned only above roles it must manage.

## Category defaults

| Audience | Default permissions |
|---|---|
| `@everyone` | View public channels; after Rules Screening, Send Messages/Create Posts in member channels; Connect/Speak in `The Campfire` and `Quiet Grind`. Do **not** grant `Mention @everyone`, `Manage Messages`, `Manage Threads`, `Manage Webhooks`, `Manage Channels`, `Manage Roles`, moderation permissions, or `Administrator`. |
| Owner | Server ownership and emergency control. |
| Administrator | Grant Discord's `Administrator` permission. |
| Moderator | Grant `View Audit Log`, `Manage Messages`, `Manage Threads`, `Manage Nicknames`, `Manage Events`, `Moderate Members`, `Kick Members`, `Ban Members`, and `Manage Roles` only below Moderator. Do **not** grant `Manage Webhooks` or `Administrator`. |
| Fatekeeper | Normal member permissions plus `#verification-queue`. Do **not** grant moderation or role-management permissions. |
| Verified Runner | Recognition only; no permission grants. |
| Vanilla / Chunked / Custom / Spectator | Identity only; no permission grants. |
| Updates / Events / Weekly Seed | Notification only; no permission grants. |

## Category and channel exceptions

| Area | Permission configuration |
|---|---|
| Notice Board (`#welcome`, `#rules-and-safety`, `#roles-and-pings`, `#announcements`) | Owner, Administrator, and Moderator can post. `@everyone` is read-only. |
| `#verified-showcase` | Administrator and Moderator can post. Fatekeeper and members are read-only. |
| `#live-unlocks` | Administrator, Moderator, and its one channel-scoped webhook can post. Members are read-only. Do not grant `Manage Webhooks` to Moderator. |
| Staff (`#staff-chat`, `#mod-alerts`, `#reports-and-appeals`, `#verification-queue`, `#audit-log`) | Deny `View Channel` to `@everyone`; allow Owner, Administrator, and Moderator. |
| `#verification-queue` | Override the Staff category to allow Fatekeeper. Do not expose any other Staff channel to Fatekeeper. |
| Forums | Members may create posts after Rules Screening. Staff-only tags cannot be self-applied. |

## Required checks

- Keep staff roles above every role they manage and below Owner.
- Use `View Server As Role` to confirm `@everyone`, Fatekeeper, Verified Runner, and Moderator match this matrix.
- Never use a member-visible role as a security boundary for webhook secrets.
