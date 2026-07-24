import React, { useEffect, useRef } from 'react';
import { useProfiles } from '../context/ProfileContext';
import { useFeatureGates } from '../hooks/useFeatureGates';
import { gateMeta, type FeatureId } from '../utils/featureGates';
import { showToast } from '../utils/toast';
import { flashSelector } from '../utils/flash';

/**
 * Watches the progressive-disclosure gates and celebrates each new reveal
 * with a toast + a pulse on the surface that just appeared. Renders nothing.
 *
 * The per-profile seen-set persists in localStorage so a reload never
 * re-toasts, and its *first* write silently seeds everything already visible
 * — that's how mature runs and imported saves auto-graduate without a
 * firework show. Must stay ALWAYS-MOUNTED (same rule as RollInboxDriver):
 * a lazily-mounted watcher would miss reveals earned on other tabs.
 */
export const FeatureRevealDriver: React.FC = () => {
  const visible = useFeatureGates();
  const { activeProfileId } = useProfiles();
  const storageKey = `fate_features_seen_v1_${activeProfileId}`;
  // Tracks which profile the seen-set was seeded for, so profile switches
  // re-seed silently instead of toasting the delta between two runs.
  const seededFor = useRef<string | null>(null);

  useEffect(() => {
    let seen: Set<string>;
    try {
      seen = new Set(JSON.parse(localStorage.getItem(storageKey) ?? '[]') as string[]);
    } catch {
      seen = new Set();
    }
    const hadRecord = localStorage.getItem(storageKey) !== null;
    const isFreshMount = seededFor.current !== activeProfileId;

    const unseen = [...visible].filter((id) => !seen.has(id));
    if (unseen.length === 0) {
      seededFor.current = activeProfileId;
      return;
    }

    // First sight of this profile with no persisted record → seed silently
    // (auto-graduation for existing runs; a fresh run seeds an empty set).
    const celebrate = hadRecord || !isFreshMount;
    if (celebrate) {
      // Stagger multi-reveals so the toasts don't collapse into one flash.
      unseen.forEach((id, i) => {
        const meta = gateMeta(id as FeatureId);
        if (!meta) return;
        window.setTimeout(() => {
          showToast(meta.revealMessage);
          if (meta.flashSelector) flashSelector(meta.flashSelector, 'cyan', false);
        }, i * 1200);
      });
    }

    for (const id of unseen) seen.add(id);
    localStorage.setItem(storageKey, JSON.stringify([...seen]));
    seededFor.current = activeProfileId;
  }, [visible, storageKey, activeProfileId]);

  return null;
};
