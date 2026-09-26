# Diary minigame audit, 26 September 2026

**Decision (owner, 26 September 2026):** Pest Control's diary games need the
Pest Control unlock, and so does every other diary task that means playing a
minigame. Tasks that only visit a place are left alone.

The 24 September equipment and mobility audit
([2026-09-24-diary-equipment-mobility-audit.md](2026-09-24-diary-equipment-mobility-audit.md))
recorded that it was "not a general minigame/item-ownership audit" (its
`permissionAudit.scope` in `data/sources/achievement-diary-tasks.json`). This
closes the minigame half of that gap, and the review is recorded beside it as
`minigameAudit`. The tracker
already locks a minigame's own content until it is unlocked: its chunk rows
for RuneLite, its activities and its collection log. Diary tasks were the
exception.

## Rule

A task is tagged when it is done inside the minigame, or needs something only
the minigame gives: its points, tickets, favour, rewards or loot.

A task is not tagged when:
- it only visits or uses the place;
- it has a route outside the minigame;
- it depends on a quest with a similar name;
- it needs an unlock the tracker already models another way, such as an
  Arcana spell or a miniquest.

Names are the tracker's Minigames unlocks (`MINIGAMES_LIST` in
`data/items.ts`). `npm run diary:sync` rejects any other name, and
`utils/diaryMinigames.test.ts` pins the list below.

## Tagged (26)

| Task | Tier | Minigame | Why |
|---|---|---|---|
| `ard_easy_5` | Ardougne Easy | Fishing Trawler | Fishing on the Trawler |
| `ard_elite_1` | Ardougne Elite | Fishing Trawler | Manta rays come from the Trawler |
| `ard_elite_5` | Ardougne Elite | Nightmare Zone | The amulet is imbued with Nightmare Zone points |
| `ard_elite_8` | Ardougne Elite | Castle Wars | Cast during a Castle Wars game |
| `des_easy_8` | Desert Easy | Pyramid Plunder | The artefacts Simon Templeton buys are Pyramid Plunder loot |
| `des_easy_9` | Desert Easy | Pyramid Plunder | The first room's sarcophagus |
| `des_elite_5` | Desert Elite | Pyramid Plunder | The final room's chest |
| `frem_hard_9` | Fremennik Hard | Blast Furnace | The foreman's permission to use it |
| `kan_med_11` | Kandarin Medium | Barbarian Assault | A wave |
| `kan_hard_9` | Kandarin Hard | Barbarian Assault | The granite body is from its reward shop |
| `kan_elite_1` | Kandarin Elite | Barbarian Assault | Level 5 in every role |
| `kar_med_1` | Karamja Medium | Brimhaven Agility Arena | An arena ticket |
| `kar_med_5` | Karamja Medium | Tai Bwo Wannai Cleanup | The village's favour comes from the Cleanup |
| `kar_hard_1` | Karamja Hard | TzHaar Fight Pit | Champion of the Fight Pits |
| `kou_hard_5` | Kourend Hard | Tithe Farm | Seeds planted in the Tithe Farm |
| `kou_hard_8` | Kourend Hard | Stealing Artefacts | An artefact delivered to Captain Khaled |
| `lum_med_11` | Lumbridge Medium | Impetuous Impulses | Implings in Puro-Puro |
| `lum_hard_5` | Lumbridge Hard | Tears of Guthix | 100 tears in one visit |
| `mor_med_6` | Morytania Medium | Trouble Brewing | A game |
| `mor_hard_5` | Morytania Hard | Temple Trekking | A trek |
| `west_easy_2` | Western Easy | Pest Control | A novice game |
| `western_med_6` | Western Medium | Pest Control | An intermediate game |
| `west_hard_3` | Western Hard | Pest Control | A veteran game |
| `west_elite_5` | Western Elite | Pest Control | The Void set is a Pest Control reward |
| `western_easy_5` | Western Easy | Gnome Ball | A goal in a match |
| `west_med_7` | Western Medium | Gnome Restaurant | A delivery |

## Left alone (17)

Also recorded, with the same reasons, as `minigameAudit.notTagged` in
`data/sources/achievement-diary-tasks.json`.

| Task | Why |
|---|---|
| `ard_med_5` | Travels to Castle Wars by balloon; no game is played. |
| `fal_med_6` | Only visits the Port Sarim Rat Pits. |
| `fal_hard_8` | The wall safes are in the Rogues' Den itself, not in its maze minigame. |
| `fal_hard_10` | Enters the Warriors' Guild, a guild entry. |
| `kar_easy_9` | The Fight Cave, a boss, also completes it; diary requirements have no boss field. |
| `kar_med_8`, `kar_med_9` | Teak and mahogany trees grow outside the Tai Bwo Wannai Hardwood Grove as well. |
| `kar_med_10`, `kar_hard_5` | Need Tai Bwo Wannai Trio, a quest, not the Cleanup. |
| `kar_med_19` | Shilo Village also opens the gem rocks. |
| `lum_hard_1` | Bones to Peaches is already an Arcana unlock. |
| `lum_hard_10` | Uses the altar at Emir's Arena; no duel is fought. |
| `lum_elite_3` | The magic trees stand outside the Mage Training Arena's games. |
| `mor_elite_2` | Firemaking with shade remains, not the Shades of Mort'ton temple game. |
| `western_med_7` | A Gnome Glider trip. |
| `west_easy_9` | The Minigame Teleport itself, already a Mobility unlock; no game is played. |
| `wild_hard_1` | The god spells come from Mage Arena I, already a quest requirement. |

## What it changes

- **Requirement:** a tagged task needs its minigame, shown in the Diary Journal
  like a shop or Arcana requirement.
- **Tier status:** a tier held up only by that reads `LOCKED_MINIGAME`.
- **Goal plans:** plans list it under "Minigames to unlock", pointing at the
  Minigames table.
- **Unchanged:** completed tasks stay completed, and the RuneLite rules bundle
  does not read diary requirements.
