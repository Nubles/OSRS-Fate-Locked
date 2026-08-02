# Fate Locked Ironman Launch Checklist

## Access and onboarding

- [ ] Community mode, Rules Screening, Community Onboarding, Server Guide, AutoMod, and raid alerts are enabled. Blocked: Server Guide remains disabled because Discord requires three channel-only To-Do tasks and cannot represent the approved external-link actions.
- [ ] Rules Screening blocks posting and direct member contact until accepted. Blocked: a genuine non-staff account is required for the runtime gate test.
- [ ] All seven onboarding defaults appear: `#general`, `#introductions`, `#help-and-strategy`, `#theorycrafting`, `#media-and-clips`, `#run-journals`, and `#events-and-lfg`. Published Preview showed all seven; the genuine non-staff join check remains blocked.
- [ ] Each onboarding answer assigns only the intended roles and channels. Published Preview exercised all answers; the genuine non-staff join check remains blocked.
- [x] Public information is readable without staff permissions.
- [x] Staff and audit categories are invisible to members.

## Permissions

- [ ] Members cannot post in `#welcome`, `#rules-and-safety`, `#roles-and-pings`, `#announcements`, `#verified-showcase`, or `#live-unlocks`. Role inspection matched the matrix; genuine non-staff posting rejection remains blocked.
- [ ] Members cannot mention `@everyone`, `@here`, or protected roles. The `@everyone` permission is disabled; a genuine non-staff runtime attempt remains blocked.
- [x] Fatekeeper can access `#verification-queue` but cannot moderate members or assign roles.
- [x] Moderator can perform intended actions without `Administrator` permission.
- [ ] The one webhook can post only to `#live-unlocks`. Skipped by owner: no webhook or integration role exists.

## Forums and content

- [ ] A `#run-journals` post requires a run-type and state tag. Blocked: the composer and tags are present, but a genuine non-staff account is required to submit the runtime test post.
- [x] Support and feedback templates are present and understandable.
- [ ] Staff-only tags cannot be self-applied. Blocked: a genuine non-staff account is required.
- [ ] Verification follows the documented Fatekeeper/Moderator two-role flow. Blocked: the synthetic `STAFF TEST` rehearsal requires a genuine non-staff account.

## Safety, integration, and resilience

- [ ] A harmless mention-spam test triggers AutoMod and creates a `#mod-alerts` staff alert. Blocked: a genuine non-staff account is required for the six-mention runtime test.
- [x] Raid alerts and staff 2FA requirements are enabled.
- [ ] Removing or disabling optional bot access does not break core server use. Not applicable to the current configuration: there are zero apps, zero webhooks, and no Automation role, so no optional integration exists to disable and re-enable.
- [ ] A test webhook embed renders correctly and does not expose its URL. Skipped by owner; no webhook was created and no test embed was sent.
- [ ] The trusted tracker webhook URL is stored only in its trusted staff-owned profile or approved secret store. Skipped by owner; no webhook URL or secret exists.
- [ ] Webhook failure leaves run journals and manual staff announcements usable as the authoritative community record. Skipped by owner; no webhook failure test was run.

## Links, desktop, and mobile presentation

- [ ] Tracker, Codex, RuneLite guide, repository, and support links resolve. The tracker, RuneLite guide, web repository, and plugin repository resolve; no standalone Codex or support link exists, and no substitute was invented.
- [x] Server icon remains legible at small size.
- [ ] Banner crops acceptably on desktop. Deferred-no-boost: the server uses the icon-colour presentation because banner upload is unavailable without a paid feature.
- [ ] Banner crops acceptably on mobile. Deferred-no-boost and not tested in a real mobile client.
- [ ] Rules Screening, onboarding, forum templates, and public channels are usable on mobile with a non-staff account. Blocked: no genuine non-staff account or real Discord mobile client is available; the 390 x 844 responsive web view was clipped and is not a mobile substitute.
- [x] The fan-project/Jagex disclaimer appears in the public description and rules.

## Launch gate

- [ ] Join and leave both voice rooms on desktop and mobile. Blocked: a genuine non-staff account and real Discord mobile client are required.
- [ ] Delete the one-use test invite and all test artefacts. Blocked before creation: no temporary invite or test artefact was created.
- [ ] Create the permanent unlimited-use, no-expiry invite targeting `#welcome`. Withheld until every mandatory runtime and mobile check passes.
