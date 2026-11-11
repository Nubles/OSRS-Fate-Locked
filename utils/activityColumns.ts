/**
 * The narrowest a column of the OSRS layout's Activities name list may be.
 * A name is one line and ends in "…" when it does not fit. At 130px a
 * column shows about nine names in ten in full (all but 7 of the 68 boss
 * names), which is what the three columns of a 1024px window already gave.
 */
export const ACTIVITY_NAME_MIN_PX = 130;

/**
 * How many columns the Activities name list shows: the number it is drawn
 * for (three, or four for a table of more than 80 names), unless the list is
 * too narrow for that many at ACTIVITY_NAME_MIN_PX each. One at least.
 *
 * The list is what is left between two fixed side panels, so on a narrow
 * window it shrinks fast: at 768px wide it is 158px, and three columns were
 * 45px each. That cut 63 of the 68 boss names to about three letters, and
 * all 125 bank names in four columns of 32px.
 *
 * Zero is the list before it has been measured: the drawn-for number, so
 * nothing reflows on the screens where that is the answer anyway.
 */
export const activityNameColumns = (listWidth: number, preferred: number): number =>
  (listWidth > 0 ? Math.max(1, Math.min(preferred, Math.floor(listWidth / ACTIVITY_NAME_MIN_PX))) : preferred);
