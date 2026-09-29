# Detector promotion log

New detectors begin in **Needs confirmation**. Promotion to Ready is a separate,
data-only change and requires at least 200 reviewed detections across five
accounts and three RuneLite restarts, with:

- fewer than 0.5% false positives;
- at least 95% unchanged confirmations;
- zero duplicate rolls; and
- zero rolls without a player click.

No expanded detector has been promoted yet. The required real-session evidence
does not exist, so the following remain confirmation-only:

| Detector | Version | Reviewed samples | Status |
|---|---:|---:|---|
| `slayer-task-varp-v1` | 1 | 0 | Awaiting playtest evidence |
| `diary-task-v1` | 2 | 0 | Awaiting playtest evidence |
| `pet-drop-v1` | 1 | 0 | Awaiting playtest evidence; RuneLite doesn't copy pets while the pet reward poll runs |

Stage 4 (September 2026) rebuilt RuneLite's detectors on the game's own signals
and retired three confirmation-only ones:

- `slayer-task-v1` read chat; `slayer-task-varp-v1` reads the game's Slayer
  variables instead, and still waits for the player's review.
- `minigame-completion-v1` could never fire.
- `boss-kill-v2` named nine bosses from loot. `boss-kill-count-v1` reads the
  game's own kill-count line, which names the boss, so it is exact like the
  loot and raid detectors it also replaces.

The Roll Inbox can export a privacy-safe aggregate playtest report. Raw player
events, account names, evidence payloads, relay secrets, and exact timestamps
must never be committed here.
