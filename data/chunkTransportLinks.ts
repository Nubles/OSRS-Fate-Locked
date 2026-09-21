/**
 * Offshore frontiers beyond the Sailing map's sea tiles. These edges grant
 * eligibility to roll land, not permission to enter it: quest/boat requirements
 * are checked separately by content access. Keeping those separate avoids
 * circular locks on quests whose final step visits their destination island.
 * Landing coordinates use the reviewed Chunk Picker records.
 */
export const CHUNK_BOAT_LANDINGS = [
  { from: '52,53', to: '58,59', label: 'Digsite barge — Museum Camp', source: 'https://oldschool.runescape.wiki/w/Fossil_Island?oldid=15341450' },
  { from: '57,54', to: '57,46', label: "Bill Teach — Mos Le'Harmless", source: 'https://oldschool.runescape.wiki/w/Bill_Teach?oldid=15297848' },
  { from: '57,46', to: '59,44', label: 'Brother Tranquility — Harmony Island', source: 'https://oldschool.runescape.wiki/w/Brother_Tranquility?oldid=15196274' },
  { from: '57,54', to: '59,55', label: 'Ghost captain — Dragontooth Island', source: 'https://oldschool.runescape.wiki/w/Ghost_captain?oldid=15315341' },
] as const;
