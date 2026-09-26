# Diary boss audit, 26 September 2026

**Why:** a player reported on 26 September 2026 that "Kill the Giant Mole
beneath Falador Park" read as doable without the Giant Mole unlocked. The
owner's minigame rule of the same day (see the
[minigame audit](2026-09-26-diary-minigame-audit.md)) applies to bosses in
the same way: a diary task that means fighting a boss needs that boss
unlocked.

The tracker already locks a boss until it is unlocked: its chunk rows for
RuneLite, its kills rolling for keys, and its collection log. Diary tasks were
the exception. The review is recorded beside the data as `bossAudit` in
`data/sources/achievement-diary-tasks.json`.

## Rule

A task is tagged when it is a kill, a raid or a fight against something the
tracker unlocks under Bosses (`BOSSES_LIST` in `data/items.ts`), including a
wave inside the Fight Caves. Where a boss has a lesser version that also
counts, either one will do (`anyOfBosses`). Where either of two activities
completes a task, each becomes a route.

A task is not tagged when it only enters a lair or visits the area, or when
a monster or reward merely shares a boss's name.

`npm run diary:sync` rejects any name that is not a Bosses unlock, and
`utils/diaryBosses.test.ts` pins the list.

## Tagged (15)

| Task | Tier | Boss | Why |
|---|---|---|---|
| `des_hard_4` | Desert Hard | Kalphite Queen | A kill |
| `fal_hard_3` | Falador Hard | Giant Mole | A kill (the reported task) |
| `frem_elite_1` | Fremennik Elite | Dagannoth Kings | Kill each king |
| `frem_elite_5` | Fremennik Elite | Kree'arra, General Graardor, Commander Zilyana, K'ril Tsutsaroth | Kill each god general |
| `kar_easy_9` | Karamja Easy | TzHaar Fight Cave | One of two routes: the Fight Cave, or the Fight Pits (a minigame) |
| `kar_hard_2` | Karamja Hard | TzHaar Fight Cave | Ket-Zek appear only in the Fight Cave's waves |
| `kou_med_11` | Kourend Medium | Wintertodt | Subduing the Wintertodt is the boss fight |
| `kou_elite_3` | Kourend Elite | Skotizo | A kill |
| `kou_elite_7` | Kourend Elite | Chambers of Xeric | A raid |
| `mor_elite_6` | Morytania Elite | Barrows Brothers | The chest is looted after the brothers |
| `west_hard_11` | Western Hard | Zulrah | A kill |
| `west_elite_2` | Western Elite | Thermonuclear Smoke Devil | A kill |
| `wild_hard_6` | Wilderness Hard | Chaos Elemental | A kill |
| `wild_hard_7` | Wilderness Hard | Crazy Archaeologist, Chaos Fanatic, Scorpia | Kill each |
| `wild_elite_1` | Wilderness Elite | Callisto or Artio, Venenatis or Spindel, Vet'ion or Calvar'ion | Either version of each boss, in any mix, as its map locations already allow |

## Left alone (5)

Also recorded, with the same reasons, as `bossAudit.notTagged`.

| Task | Why |
|---|---|
| `ard_elite_5` | Nightmare Zone is a minigame, already tagged; The Nightmare is not fought. |
| `kan_elite_3` | Cooking gauntlets, not The Gauntlet. |
| `kou_elite_5` | A Hydra in the Karuulm Slayer Dungeon is a Slayer monster, not the Alchemical Hydra. |
| `lum_hard_7` | Barrows gloves come from Recipe for Disaster, not from the Barrows. |
| `wilderness_easy_8` | Only enters the King Black Dragon's lair; the boss is not fought. |

## What it changes

- **Requirement:** a tagged task needs its boss, shown in the Diary Journal
  beside its other unlocks.
- **Tier status:** a tier held up only by that reads `LOCKED_BOSS`.
- **Goal plans:** plans list it under "Bosses to unlock", pointing at the
  Bosses table.
- **Unchanged:** completed tasks stay completed, and the RuneLite rules bundle
  does not read diary requirements.
