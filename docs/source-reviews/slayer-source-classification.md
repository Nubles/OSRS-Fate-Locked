# Slayer assignment source classification

The committed chunk content contains 187 requirement occurrences and 35 distinct strings across ten master tables. The coverage test walks the actual generated `public/chunk-content.json` assignment data; it does not test a copied list. New unclassified wording fails this test and remains UNKNOWN at runtime.

Twenty-four completed-quest clauses resolve only when their names match canonical quests. Eleven exact progress/access clauses have explicit manual predicates: Ancient Cavern training access; Contact!, Desert Treasure I, Dragon Slayer I, Lunar Diplomacy, Mourning's End Part II, Olaf's Quest and Rum Deal progress; Grimstone docking; Magic axe hut door access; and the wilderness pirate route. Numeric source suffixes are progression identifiers, not quest-completion facts. They are never stripped to create a satisfied quest gate.

The pirate token was inspected in the pinned raw chunk snapshot: `codeItems.tasksPlus.WildernessPirateAccess[+]` expands to “Access wilderness pirates” and “Access wilderness zombie pirates.” The manual check retains these alternative accessible routes. It is not an unknown-token allowlist.

Manual classifications never yield READY from account levels or an open chunk. The evaluator checks known level/quest/location blockers, then reports NEEDS_CONFIRMATION. It currently has no saved confirmation state for these external Slayer facts, so uncertainty remains visible. Badge details expose the classified condition. Arbitrary future source strings and unknown quest names stay UNKNOWN.

This validates classification of the committed source strings, not the live currency of all ten assignment tables. The existing chunk-source pin/update process remains responsible for assignment-table source refreshes.
