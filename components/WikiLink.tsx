import React from 'react';
import { ExternalLink } from 'lucide-react';
import { wikiUrlFor } from '../data/assets';

/**
 * The one way to link content out to the OSRS wiki. Wraps wikiUrlFor (which
 * handles page-name overrides and falls back to wiki search for app-only
 * concepts), stops click propagation so links inside clickable rows don't
 * trigger the row, and opens in a new tab.
 *
 *   <WikiLink name="Abyssal whip" />                      → linked name text
 *   <WikiLink name="Zulrah" icon />                       → name + ↗ icon
 *   <WikiLink name="Zulrah" iconOnly />                   → just the ↗ icon
 *   <WikiLink name="Ardougne Diary" page="Ardougne_Diary#Hard">…</WikiLink>
 */
interface Props {
  /** Content name — used for the URL and (by default) the link text. */
  name: string;
  /** Optional explicit wiki page/anchor when it differs from the name. */
  page?: string;
  /** Append a small external-link icon after the text. */
  icon?: boolean;
  /** Render only the icon (for rows whose text shouldn't be a link). */
  iconOnly?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const WikiLink: React.FC<Props> = ({ name, page, icon, iconOnly, className, children }) => {
  const href = page
    ? `https://oldschool.runescape.wiki/w/${page}`
    : wikiUrlFor(name);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      title={`${name} — OSRS Wiki`}
      className={className ?? 'hover:underline decoration-dotted underline-offset-2 hover:text-amber-200 transition-colors'}
    >
      {iconOnly
        ? <ExternalLink size={11} className="inline opacity-60 hover:opacity-100" />
        : <>{children ?? name}{icon && <ExternalLink size={9} className="inline ml-0.5 -mt-px opacity-50" />}</>}
    </a>
  );
};
