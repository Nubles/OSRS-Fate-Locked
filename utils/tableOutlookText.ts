import type { TableType } from '../types';

/** Spend Keys' table outlook words, apart from the sums (utils/tableOutlook.ts) so the cards can show them without loading those. */
export type OutlookKind = 'ready' | 'owned-land' | 'opens';

export interface TableOutlook {
  table: TableType;
  kind: OutlookKind;
  /** Entries a Key on this table can draw now. */
  left: number;
  /** Of those, how many the player could use straight away. */
  useful: number;
  /** A few of the useful ones, best first. */
  examples: string[];
}

/** "1 in 11" for 6 of 66; "every draw" when all are useful. */
export const outlookOdds = (o: Pick<TableOutlook, 'left' | 'useful'>): string =>
  o.useful <= 0 || o.left <= 0 ? '' : o.useful >= o.left ? 'every draw' : `1 in ${Math.max(1, Math.round(o.left / o.useful))}`;

const WHAT: Record<OutlookKind, string> = {
  ready: 'ready if drawn',
  'owned-land': 'in land you own',
  opens: 'open a quest or diary task at once',
};

/** One plain line: "6 of 66 ready if drawn (1 in 11): Giant Mole, Sarachnis, Kalphite Queen." */
export const outlookLine = (o: TableOutlook): string => {
  if (o.left === 0) return '';
  if (o.useful === 0) {
    return o.kind === 'opens'
      ? 'No area left on this table would open a quest or diary task by itself yet.'
      : o.kind === 'owned-land'
        ? 'None of these banks is in land you own yet.'
        : 'Nothing on this table is ready if drawn yet: each still needs something else first.';
  }
  const what = o.kind === 'opens' && o.useful === 1 ? 'opens a quest or diary task at once' : WHAT[o.kind];
  const list = o.examples.length ? `: ${o.examples.join(', ')}${o.useful > o.examples.length ? ' and more' : ''}` : '';
  return `${o.useful} of ${o.left} ${what} (${outlookOdds(o)})${list}.`;
};

/** The short form for a small card: "6/66 ready". */
export const outlookShort = (o: TableOutlook): string =>
  o.kind === 'opens' ? `${o.useful}/${o.left} open something` : o.kind === 'owned-land' ? `${o.useful}/${o.left} in your land` : `${o.useful}/${o.left} ready`;
