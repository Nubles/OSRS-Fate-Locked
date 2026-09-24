# OSRS Wiki artwork audit — 24 September 2026

Scope: visible emoji and generic artwork used to represent game content or app features. Visual-only changes; no account progress or eligibility rules changed.

## Changes

- Shared Wiki artwork replaces generic content icons across navigation, search, activities, planners, achievements, equipment/combat tools, reveals and reference panels.
- Skills and required slots use their specific skill/slot artwork where known; quest points and diaries retain their own interface symbols.
- Rival portraits now use OSRS helmets; old saved emoji fields remain compatible but are no longer displayed.
- Timelapse milestones, map stars, chunk-count labels, the live overlay and browser favicon use Wiki artwork.
- Removed all 10 third-party texture backgrounds. Plain-text share summaries use readable labels because images cannot be embedded in clipboard text.
- Shared image rendering retains accessible labels when a remote image fails and retries a different filename. Share-image export waits for artwork/fonts with a five-second cap.

## Deliberately retained

- Ordinary controls: close/search/arrows, loading indicators, checks/warnings/locks, favourite on/off stars, target/accuracy controls, graph and timeline tools. These communicate interaction or state rather than represent OSRS content.
- Real OSRS item sprites served by the Wiki operator at chisel.weirdgloop.org; accurate maps, map geometry, charts, QR codes, screenshots and 3D models.
- Legacy saved emoji fields and external Discord plain-text templates. No messages were sent.

## Verification

- Browser artwork gallery: all 45 candidate images loaded with nonzero natural dimensions. Invalid candidates for inventory, friends, trophy and stardust were corrected using actual Wiki source pages.
- Source pages: [interface filenames](https://oldschool.runescape.wiki/w/Friends_List), [trophy](https://oldschool.runescape.wiki/w/Trailblazer_dragon_trophy), [stardust](https://oldschool.runescape.wiki/w/Shooting_Stars).
- Shared artwork/error/accessibility + timelapse + section icon + changelog tests: 36 passed.
- Navigation, Vanilla DPS/quest readiness, activity cards and journal tests: 13 passed. Contextual review ran additional focused Vanilla checks; chunk geography cases excluded.
- Live Vanilla preview: dashboard (85 visible images, none broken), rival chooser, share card (54/54 loaded), and RuneProof checked. Restless Ghost still shows Neck T1 required and preserved 1/7 guide progress.
- TypeScript and local preview build passed. What's New verified. Existing build chunk-size/deprecation warnings remain.
- Literal/escaped emoji sweep found no remaining decorative pictographs in app components; retained checks/warnings are listed above.

## Verified shared and replacement artwork

All filenames below are hosted at `https://oldschool.runescape.wiki/images/` (no downloaded media added to the repository).

- `Achievement_Diaries_icon.png`
- `Agility_icon.png`
- `Attack_icon.png`
- `Bank_icon.png`
- `Body_slot.png`
- `Brass_key.png`
- `Bronze_full_helm.png`
- `Coins_10000.png`
- `Collection_log.png`
- `Combat_icon.png`
- `Compass.png`
- `Construction_icon.png`
- `Crystal_key.png`
- `Dragon_full_helm.png`
- `Eye_of_newt.png`
- `Farming_icon.png`
- `Fire_rune.png`
- `Friends_List.png`
- `General_store_icon_(historical).png`
- `Hammer.png`
- `Hands_slot.png`
- `Herblore_icon.png`
- `Hitpoints_icon.png`
- `Inventory.png`
- `Lit_candle.png`
- `Magic_icon.png`
- `Mind_rune.png`
- `Minigames.png`
- `Mining_icon.png`
- `Mystery_box.png`
- `Quest_point_icon.png`
- `Ranged_icon.png`
- `Rune_full_helm.png`
- `Shield_slot.png`
- `Sinister_key.png`
- `Slayer_icon.png`
- `Stardust_175.png`
- `Stats_icon.png`
- `Strength_icon.png`
- `Trailblazer_dragon_trophy.png`
- `Transportations_icon.png`
- `Uncut_diamond.png`
- `World_map_icon.png`
- `Worn_Equipment.png`
- `Yellow_partyhat.png`
