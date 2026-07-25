
import React, { useEffect, useState } from 'react';
import { useGame } from '../context/GameContext';
import { Key, Sparkles } from 'lucide-react';
import { LootBeam } from './LootBeam';
import { formatKeyPercent, formatKeyRollValue } from '../utils/keyRoll';
import { eventRarity, rarityColor, rarityRank } from '../utils/rarity';

interface Particle {
  id: string;
  x: number;
  y: number;
  type: 'key' | 'omni';
}

interface RollFeedback {
  id: string;
  x: number;
  y: number;
  roll: number;
  threshold: number;
  type: 'SUCCESS' | 'FAIL' | 'OMNI' | 'PITY';
}

interface Beam {
  id: string;
  x: number;
  y: number;
  color: string;
  intense: boolean;
}

export const EffectsLayer: React.FC = () => {
  const { lastEvent, animationsEnabled } = useGame();
  const [particles, setParticles] = useState<Particle[]>([]);
  const [rollFeedback, setRollFeedback] = useState<RollFeedback[]>([]);
  const [beams, setBeams] = useState<Beam[]>([]);

  useEffect(() => {
    if (!lastEvent || !animationsEnabled) return;
    const { type, x, y, meta } = lastEvent;

    // Loot beam — fired for significant events. UNLOCK is handled inside the
    // reveal itself (the beam rises behind the revealed item), so we skip it
    // here; otherwise the beam would fire from screen-centre only after the
    // reveal is dismissed via "Accept Destiny", which looked disconnected.
    const rarity = type === 'UNLOCK' ? null : eventRarity(type, meta as Record<string, any> | undefined);
    if (rarity) {
      // Events without a click point (unlocks, or rolls that pass 0,0) beam from
      // just below screen-centre like a loot pile.
      const hasCoords = !!x && !!y;
      const bx = hasCoords ? x! : window.innerWidth / 2;
      const by = hasCoords ? y! : Math.round(window.innerHeight * 0.6);
      spawnBeam(bx, by, rarityColor(rarity), rarityRank(rarity) >= rarityRank('epic'));
    }

    if (!x || !y) return; // the particle/feedback need a click point

    // All ROLL_* events carry RollEventMeta; narrow the union here.
    const roll = meta as { roll: number; threshold: number } | undefined;

    if (type === 'ROLL_SUCCESS') {
      spawnParticle(x, y, 'key');
      spawnFeedback(x, y, roll?.roll ?? 0, roll?.threshold ?? 0, 'SUCCESS');
    } else if (type === 'ROLL_OMNI') {
      spawnParticle(x, y, 'omni');
      spawnFeedback(x, y, roll?.roll ?? 0, roll?.threshold ?? 0, 'OMNI');
    } else if (type === 'ROLL_FAIL') {
      spawnFeedback(x, y, roll?.roll ?? 0, roll?.threshold ?? 0, 'FAIL');
    } else if (type === 'ROLL_PITY') {
      spawnParticle(x, y, 'key');
      spawnFeedback(x, y, roll?.roll ?? 0, roll?.threshold ?? 0, 'PITY');
    }
  }, [lastEvent, animationsEnabled]);

  const spawnBeam = (x: number, y: number, color: string, intense: boolean) => {
    const id = Math.random().toString();
    setBeams(prev => [...prev, { id, x, y, color, intense }]);
    setTimeout(() => {
      setBeams(prev => prev.filter(b => b.id !== id));
    }, 1700);
  };

  const spawnParticle = (x: number, y: number, type: 'key' | 'omni') => {
    const id = Math.random().toString();
    setParticles(prev => [...prev, { id, x, y, type }]);
    setTimeout(() => {
      setParticles(prev => prev.filter(p => p.id !== id));
    }, 1000);
  };

  const spawnFeedback = (x: number, y: number, roll: number, threshold: number, type: 'SUCCESS' | 'FAIL' | 'OMNI' | 'PITY') => {
    const id = Math.random().toString();
    setRollFeedback(prev => [...prev, { id, x, y, roll, threshold, type }]);
    setTimeout(() => {
      setRollFeedback(prev => prev.filter(f => f.id !== id));
    }, 2000);
  };

  return (
    <>
      {beams.map(b => (
        <LootBeam key={b.id} x={b.x} y={b.y} color={b.color} intense={b.intense} />
      ))}

      {particles.map(p => (
        <div
          key={p.id}
          className="fixed z-[200] pointer-events-none transition-all duration-1000 ease-in-out"
          style={{
            left: p.x,
            top: p.y,
            animation: 'key-fly 1s forwards cubic-bezier(0.175, 0.885, 0.32, 1.275)'
          }}
        >
          {p.type === 'key' ? (
             <Key className="text-osrs-gold w-8 h-8 drop-shadow-[0_0_10px_#fbbf24]" />
          ) : (
             <Sparkles className="text-purple-400 w-8 h-8 drop-shadow-[0_0_10px_#a855f7]" />
          )}
        </div>
      ))}

      {rollFeedback.map(f => (
        <div key={f.id}
             className="fixed z-[200] pointer-events-none font-bold text-sm flex flex-col items-center justify-center text-shadow-osrs whitespace-nowrap"
             style={{
                 left: f.x,
                 top: f.y,
                 animation: f.type === 'FAIL' ? 'float-fade-down 1.5s forwards' : 'float-fade-up 2s forwards'
             }}>
             <span className={`text-2xl font-black tracking-wide ${f.type === 'OMNI' ? 'text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.8)]' : f.type === 'SUCCESS' ? 'text-green-400 drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]' : f.type === 'PITY' ? 'text-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.8)]' : 'text-red-400 drop-shadow-[0_0_2px_rgba(239,68,68,0.5)]'}`}>
                 {f.type === 'OMNI' ? 'OMNI-KEY!' : f.type === 'PITY' ? 'PITY KEY!' : f.type === 'SUCCESS' ? 'SUCCESS!' : 'MISS'}
             </span>
             <span className="text-xs text-white opacity-90 font-mono bg-black/60 px-2 py-0.5 rounded-full mt-1 border border-white/10 shadow-xl backdrop-blur-sm">
                 {formatKeyRollValue(f.roll)} {f.type === 'FAIL' ? '>' : '≤'} {formatKeyPercent(f.threshold)}
             </span>
        </div>
      ))}
    </>
  );
};
