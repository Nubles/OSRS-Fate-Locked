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
| `slayer-task-v1` | 1 | 0 | Awaiting playtest evidence |
| `diary-task-v1` | 1 | 0 | Awaiting playtest evidence |
| `pet-drop-v1` | 1 | 0 | Awaiting playtest evidence |
| `minigame-completion-v1` | 1 | 0 | Awaiting playtest evidence |
| `boss-kill-v2` | 2 | 0 | Awaiting playtest evidence |

The Roll Inbox can export a privacy-safe aggregate playtest report. Raw player
events, account names, evidence payloads, relay secrets, and exact timestamps
must never be committed here.
