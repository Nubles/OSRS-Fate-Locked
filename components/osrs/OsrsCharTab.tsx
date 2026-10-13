import React from 'react';
import type { TableType, UnlockState } from '../../types';
import { OsrsSkills } from './OsrsSkills';
import { OsrsLabCompact, OsrsLabFull, type OsrsLabView } from './OsrsEquipment';
import './osrs-dashboard.css';

/**
 * The Progression window's Character tab in the OSRS layout.
 *
 * Main board: the compact Equipment Lab (300px) beside the Skills grid.
 * Gear board: once a lab mode, a slot or the planner is opened, the Equipment
 * Lab takes the whole tab (Dashboard also widens the Progression window then);
 * its close button returns to Skills. Dashboard owns `lab` so it knows when
 * the tab is wide.
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
  if (lab) {
    return <OsrsLabFull view={lab} onView={onLab} onClose={() => onLab(null)} onUpgrade={onUpgrade} suspendModals={suspendModals} />;
  }
  return (
    <div className="osrs-dash-chartab">
      <OsrsLabCompact onOpen={onLab} suspendModals={suspendModals} />
      <OsrsSkills {...skills} suspendModals={suspendModals} />
    </div>
  );
};

export default OsrsCharTab;
