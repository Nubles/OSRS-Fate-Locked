/** Source spellings that differ from the Wiki title (the Wiki page is "Myths' Guild"). */
const INTERIOR_TITLE_FIXES: Record<string, string> = { "Myth's Guild": "Myths' Guild" };

/**
 * The name the chunk panel shows for an interior. The source keys sections as "Name#Section"
 * and names unnamed regions "Interior <region id>". Only the panel's list is formatted, so ids,
 * matching and the plugin bundle keep the raw names. Imported only by the lazily loaded chunk panel.
 */
export function interiorDisplayName(name: string): string {
  if (/^Interior \d+$/.test(name)) return 'Unnamed interior';
  const [base, section] = name.split('#', 2);
  const title = INTERIOR_TITLE_FIXES[base] ?? base;
  if (!section) return title;
  // A title that already ends in a Wiki disambiguator, e.g. "Gryphons (dungeon)", takes a comma.
  return title.endsWith(')') ? `${title}, ${section}` : `${title} (${section})`;
}
