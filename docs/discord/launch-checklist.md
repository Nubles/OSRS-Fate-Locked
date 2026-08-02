# Fate Locked Ironman Launch Checklist

## Access and onboarding

- [ ] Community mode, Rules Screening, Community Onboarding, Server Guide, AutoMod, and raid alerts are enabled.
- [ ] Rules Screening blocks posting and direct member contact until accepted.
- [ ] All seven onboarding defaults appear: `#general`, `#introductions`, `#help-and-strategy`, `#theorycrafting`, `#media-and-clips`, `#run-journals`, and `#events-and-lfg`.
- [ ] Each onboarding answer assigns only the intended roles and channels.
- [ ] Public information is readable without staff permissions.
- [ ] Staff and audit categories are invisible to members.

## Permissions

- [ ] Members cannot post in `#welcome`, `#rules-and-safety`, `#roles-and-pings`, `#announcements`, `#verified-showcase`, or `#live-unlocks`.
- [ ] Members cannot mention `@everyone`, `@here`, or protected roles.
- [ ] Fatekeeper can access `#verification-queue` but cannot moderate members or assign roles.
- [ ] Moderator can perform intended actions without `Administrator` permission.
- [ ] The one webhook can post only to `#live-unlocks`.

## Forums and content

- [ ] A `#run-journals` post requires a run-type and state tag.
- [ ] Support and feedback templates are present and understandable.
- [ ] Staff-only tags cannot be self-applied.
- [ ] Verification follows the documented Fatekeeper/Moderator two-role flow.

## Safety, integration, and resilience

- [ ] A harmless mention-spam test triggers AutoMod and creates a `#mod-alerts` staff alert.
- [ ] Raid alerts and staff 2FA requirements are enabled.
- [ ] Removing or disabling optional bot access does not break core server use.
- [ ] A test webhook embed renders correctly and does not expose its URL.
- [ ] The trusted tracker webhook URL is stored only in its trusted staff-owned profile or approved secret store.
- [ ] Webhook failure leaves run journals and manual staff announcements usable as the authoritative community record.

## Links, desktop, and mobile presentation

- [ ] Tracker, Codex, RuneLite guide, repository, and support links resolve.
- [ ] Server icon remains legible at small size.
- [ ] Banner crops acceptably on desktop.
- [ ] Banner crops acceptably on mobile.
- [ ] Rules Screening, onboarding, forum templates, and public channels are usable on mobile with a non-staff account.
- [ ] The fan-project/Jagex disclaimer appears in the public description and rules.
