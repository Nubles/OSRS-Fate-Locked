import React from 'react';
import type { TableType, UnlockState } from '../../types';
import { OsrsSkills } from './OsrsSkills';
import { OsrsLabCompact, type OsrsLabView } from './OsrsEquipment';
import './osrs-dashboard.css';

/**
 * The Progression window's Character tab in the OSRS layout.
 *
 * The Equipment Lab panel beside the Skills grid. Its Tiers, Gear, DPS and
 * Plan views open inside the panel's own area; Skills and the home screen's
 * left column stay in view. Dashboard owns `lab` (the open view) so it
 * resets when the tab changes.
 */

interface Props {
  lab: OsrsLabView | null;
  onLab: (view: OsrsLabView | null) => void;
  onUpgrade: (slot: string) => void;
  unlocks: UnlockState;
  specialKeys: number;
  totalSkillTiers: number;
  searchQuery: string;
  showOnlyActionable: boolean;
  levelingSkill: string | null;
  advisorsEnabled: boolean;
  suspendModals: boolean;
  onLevelUp: (skill: string) => void;
  onSpecialUnlock: (table: TableType, skill: string) => void;
  onOpenDetails: (skill: string, tier: number) => void;
}

export const OsrsCharTab: React.FC<Props> = ({ lab, onLab, onUpgrade, suspendModals, ...skills }) => {
  return (
    <div className="osrs-dash-chartab">
      <OsrsLabCompact view={lab} onView={onLab} onUpgrade={onUpgrade} suspendModals={suspendModals} />
      <OsrsSkills {...skills} suspendModals={suspendModals} />
    </div>
  );
};

export default OsrsCharTab;
