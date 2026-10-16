import React from 'react';
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
  quest: 'quest_point_icon.png',
  diary: 'achievement_diaries_icon.png',
  ca: 'combat_achievements_icon.png',
};

/** The quest point, diary and combat achievement icons from the game (local sprites). */
export const JournalIcon: React.FC<{ kind: JournalKind; size?: number }> = ({ kind, size = 18 }) => (
  <img src={osrsAsset(`items/${KIND_FILE[kind]}`)} alt="" aria-hidden="true" width={size} height={size}
    className="osrs-px" style={{ objectFit: 'contain', display: 'inline-block', flexShrink: 0 }} draggable={false} />
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
