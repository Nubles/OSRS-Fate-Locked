import React from 'react';
import { WikiIcon } from '../WikiIcon';
import './osrs-journal.css';

/**
 * Shared pieces of the OSRS Journal: icons, the list legend and the OSRS
 * Wiki style details table. Presentation only; every number comes from the
 * caller, which reads it from the same data the classic Journal uses.
 */

export const osrsAsset = (path: string): string => `${import.meta.env.BASE_URL}osrs-ui/${path}`;

const SKILL_FILES = new Set([
  'agility', 'attack', 'construction', 'cooking', 'crafting', 'defence', 'farming', 'firemaking', 'fishing',
  'fletching', 'herblore', 'hitpoints', 'hunter', 'magic', 'mining', 'prayer', 'ranged', 'runecraft',
  'sailing', 'slayer', 'smithing', 'strength', 'thieving', 'woodcutting',
]);

/** The 16px in-game skill icon, from the local sprites. Nothing for non-skills. */
export const SkillIcon: React.FC<{ skill: string }> = ({ skill }) => {
  const file = skill.toLowerCase();
  if (!SKILL_FILES.has(file)) return null;
  return <img src={osrsAsset(`skills/small/${file}.png`)} alt="" aria-hidden="true" className="osrs-px" />;
};

export type JournalKind = 'quest' | 'diary' | 'ca';

const KIND_FILE: Record<JournalKind, string> = {
  quest: 'Quest_point_icon.png',
  diary: 'Achievement_Diaries_icon.png',
  ca: 'Combat_Achievements_icon.png',
};

/** The quest point, diary and combat achievement icons from the game. */
export const JournalIcon: React.FC<{ kind: JournalKind; size?: number }> = ({ kind, size = 18 }) => (
  <WikiIcon file={KIND_FILE[kind]} alt="" size={size} className="osrs-px" />
);

export const Legend: React.FC<{ items: Array<{ label: string; cls: string }> }> = ({ items }) => (
  <div className="ojr-legend">
    {items.map(item => <span key={item.label} className={item.cls}>{item.label}</span>)}
  </div>
);

export interface WikiRow { label: string; value: React.ReactNode }

export const WikiTable: React.FC<{ title?: string; href?: string; rows: WikiRow[] }> = ({ title = 'Details', href, rows }) => (
  <table className="ojr-wiki">
    <caption>
      {title}
      {href && <a href={href} target="_blank" rel="noopener noreferrer">OSRS Wiki guide</a>}
    </caption>
    <tbody>
      {rows.map(row => (
        <tr key={row.label}><th scope="row">{row.label}</th><td>{row.value}</td></tr>
      ))}
    </tbody>
  </table>
);

export const plural = (n: number, word: string, many = `${word}s`): string => `${n} ${n === 1 ? word : many}`;
