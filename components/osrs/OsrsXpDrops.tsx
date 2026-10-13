import React, { useEffect, useRef, useState } from 'react';
import { useGame } from '../../context/GameContext';
import './osrs-shell.css';

const sprite = (file: string) => `${import.meta.env.BASE_URL}osrs-ui/items/${file}`;

type DropKind = 'key' | 'omni' | 'chaos' | 'fate';

/** Text, sprite and colour per drop, as on the XP drops board. */
const DROP: Record<DropKind, { icon: string; color: string; one: string; many: string }> = {
  key: { icon: 'key.png', color: '#ffffff', one: 'Key', many: 'Keys' },
  omni: { icon: 'omni_key.png', color: '#c77dff', one: 'Omni-Key', many: 'Omni-Keys' },
  chaos: { icon: 'chaos_key.png', color: '#ff3030', one: 'Chaos Key', many: 'Chaos Keys' },
  fate: { icon: 'void_seal.png', color: '#ffff00', one: 'Fate', many: 'Fate' },
};

interface Drop { id: number; kind: DropKind; amount: number; delayMs: number }

const DROP_MS = 1200;
const STAGGER_MS = 450;

/**
 * OSRS XP drops for the run's counters: when Keys, Omni-Keys, Chaos Keys or
 * Fate Points go up after a game event, a "+1 Key" (with its sprite) rises
 * past the header counters. Purely visual: it only compares the previous
 * counts with the current ones. Loads and saves (no game event) never drop.
 */
export const OsrsXpDrops: React.FC = () => {
  const { keys, specialKeys, chaosKeys, fatePoints, lastEvent, animationsEnabled } = useGame();
  const prev = useRef({ keys, specialKeys, chaosKeys, fatePoints });
  const lastEventId = useRef(lastEvent?.id ?? null);
  const nextId = useRef(0);
  const [drops, setDrops] = useState<Drop[]>([]);
  const timers = useRef<number[]>([]);

  useEffect(() => () => { timers.current.forEach(t => window.clearTimeout(t)); }, []);

  useEffect(() => {
    const before = prev.current;
    prev.current = { keys, specialKeys, chaosKeys, fatePoints };
    const eventId = lastEvent?.id ?? null;
    const isNewEvent = eventId !== null && eventId !== lastEventId.current;
    lastEventId.current = eventId;
    if (!isNewEvent || !animationsEnabled) return;

    const gains: Array<[DropKind, number]> = [
      ['key', keys - before.keys],
      ['omni', specialKeys - before.specialKeys],
      ['chaos', chaosKeys - before.chaosKeys],
      ['fate', fatePoints - before.fatePoints],
    ];
    const fresh: Drop[] = gains
      .filter(([, amount]) => amount > 0)
      .map(([kind, amount], i) => ({ id: nextId.current++, kind, amount, delayMs: i * STAGGER_MS }));
    if (fresh.length === 0) return;

    setDrops(current => [...current, ...fresh].slice(-8));
    const ids = new Set(fresh.map(d => d.id));
    const longest = fresh[fresh.length - 1].delayMs + DROP_MS + 50;
    const timer = window.setTimeout(() => {
      setDrops(current => current.filter(d => !ids.has(d.id)));
      timers.current = timers.current.filter(t => t !== timer);
    }, longest);
    timers.current.push(timer);
  }, [keys, specialKeys, chaosKeys, fatePoints, lastEvent, animationsEnabled]);

  return (
    <div className="osrs-xp-layer" aria-hidden="true">
      {drops.map(d => {
        const spec = DROP[d.kind];
        return (
          <div key={d.id} className="osrs-xp-drop" style={{ color: spec.color, animationDelay: `${d.delayMs}ms` }}>
            <img className="osrs-px" src={sprite(spec.icon)} alt="" width={22} height={20} />
            +{d.amount} {d.amount === 1 ? spec.one : spec.many}
          </div>
        );
      })}
    </div>
  );
};

export default OsrsXpDrops;
