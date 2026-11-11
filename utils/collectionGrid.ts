/**
 * The narrowest a cell of the classic collection log's item grid may be.
 * A cell holds a 40px item picture with the item's name under it in two
 * lines of small print. Measured over all 1,706 item names: at 64px three
 * names in four fit without a word being split or a third line being
 * dropped; at 50px one in three does, and at 42px one in eight.
 */
export const COLLECTION_CELL_MIN_PX = 64;

/**
 * How many items the classic grid shows in a row: as many as fit at
 * COLLECTION_CELL_MIN_PX each, four at most (every screen wider than a
 * phone) and two at least. The grid is about 200px wide on a 390px phone
 * and 170px on a 360px one, so four in a row there made each cell narrower
 * than its own item picture and cut the end off most names.
 *
 * Zero is the grid before it has been measured: four, so nothing reflows
 * on the screens where four is the answer anyway.
 */
export const collectionGridColumns = (gridWidth: number): number =>
  (gridWidth > 0 ? Math.max(2, Math.min(4, Math.floor(gridWidth / COLLECTION_CELL_MIN_PX))) : 4);
