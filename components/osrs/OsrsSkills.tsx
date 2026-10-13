import React, { useState } from 'react';
import { SKILLS_LIST } from '../../constants';
import { TableType, type UnlockState } from '../../types';
import { NoteTrigger } from '../NoteTrigger';
import { SectionGuide } from '../SectionGuide';
import { SkillAdvisorPanel } from '../SkillAdvisorPanel';
import { formatKeyPercent, skillLevelKeyChance } from '../../utils/keyRoll';
import { isSkillChaosMilestone, LEVEL_CHAOS_CHANCE } from '../../config/economy';
import { skillIconSrc, itemSrc } from './OsrsDashGems';
import './osrs-dashboard.css';

/**
 * The Character tab's Skills panel (Main board): a 3 x 8 grid of large
 * cells, each with the skill icon on the left and, on the right, the level in
 * yellow over "T2 · 1-20" (your tier and the levels you can train with), or
 * "Locked" in red. Total level in the footer.
 *
 * Same controls as the classic cards: the cell levels the skill up (or
 * starts it with an Omni-Key when locked), the skill icon opens the skill
 * guide, the small Omni-Key button buys the next tier, and the note button
 * (shown on hover, or always once a note exists) opens the skill's note. The
 * next level's Key odds are the cell's tooltip and its Examine text. The
 * Skill Advisor opens from the "Advisor" button in the panel's title row.
 * Dashboard owns every handler.
 */

interface Props {
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

export const OsrsSkills: React.FC<Props> = ({
  unlocks, specialKeys, totalSkillTiers, searchQuery, showOnlyActionable, levelingSkill,
  advisorsEnabled, suspendModals, onLevelUp, onSpecialUnlock, onOpenDetails,
}) => {
  const totalLevel = SKILLS_LIST.reduce((sum, s) => sum + (unlocks.levels[s] || 1), 0);
  const [showAdvisor, setShowAdvisor] = useState(false);

  return (
    <section className="osrs-inner osrs-dash-skills" aria-label="Skills">
      <div className="osrs-dash-panelhead">
        <h3 className="osrs-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          Skills <SectionGuide id="SKILLS" className="osrs-dash-qmark" suspendModals={suspendModals} />
        </h3>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {advisorsEnabled && (
            <button
              type="button"
              className={`osrs-dash-textbtn${showAdvisor ? ' is-on' : ''}`}
              aria-pressed={showAdvisor}
              aria-expanded={showAdvisor}
              onClick={() => setShowAdvisor((v) => !v)}
              title="Skill Advisor: which skill to train next, ranked by the quests and diaries it opens"
            >
              Advisor
            </button>
          )}
          <span className="osrs-dash-yellow-s">{totalSkillTiers}/{SKILLS_LIST.length * 10} tiers</span>
        </span>
      </div>

      <div className="osrs-dash-skillwrap">
        {advisorsEnabled && showAdvisor && (
          <div className="osrs-win osrs-dash-advisor" role="region" aria-label="Skill Advisor">
            <button type="button" className="osrs-dash-close" onClick={() => setShowAdvisor(false)} aria-label="Close Skill Advisor">
              <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="2.5" /></svg>
            </button>
            <SkillAdvisorPanel />
          </div>
        )}

        <div className="osrs-dash-skillgrid">
          {SKILLS_LIST.map((skill) => {
            const tier = unlocks.skills[skill] || 0;
            const level = unlocks.levels[skill] || 1;
            const isUnlocked = tier > 0;
            const methodRange = tier === 0 ? 'None' : (tier === 10 ? '1-99' : `1-${tier * 10}`);
            const canLevel = isUnlocked && level < 99;
            const canOmniUpgrade = specialKeys > 0 && tier < 10;
            const canUnlockStart = !isUnlocked && specialKeys > 0;

            if (showOnlyActionable && !isUnlocked && !canUnlockStart) return null;

            const handleMainClick = () => {
              if (canUnlockStart) onSpecialUnlock(TableType.SKILLS, skill);
              else if (canLevel) onLevelUp(skill);
            };
            const isMainActionable = canUnlockStart || canLevel;
            const oddsDescriptionId = `skill-roll-odds-${skill.toLowerCase().replace(/\s+/g, '-')}`;

            if (searchQuery && !skill.toLowerCase().includes(searchQuery.toLowerCase())) return null;

            const nextLevel = level + 1;
            const odds = canLevel
              ? `Next Lv ${nextLevel}: ${formatKeyPercent(skillLevelKeyChance(nextLevel))} Key chance. ${isSkillChaosMilestone(nextLevel)
                ? `Level ${nextLevel} also gives a guaranteed Chaos Key, and a separate ${LEVEL_CHAOS_CHANCE}% chance of another.`
                : `Each level-up also has a separate ${LEVEL_CHAOS_CHANCE}% chance of a Chaos Key.`}`
              : '';
            const examine = isUnlocked
              ? `Level ${level}. Tier ${tier}: you can train levels ${methodRange}.${odds ? ` ${odds}` : ''}`
              : `Level ${level}. Locked: no tier unlocked yet.`;
            const action = canUnlockStart ? 'Click to unlock with an Omni-Key.' : canLevel ? 'Click to level up.' : '';

            return (
              <div
                key={skill}
                data-skill-card={skill}
                data-examine-name={skill}
                data-examine={examine}
                title={`${skill}: ${examine}${action ? ` ${action}` : ''}`}
                onClick={isMainActionable ? handleMainClick : undefined}
                onKeyDown={isMainActionable ? (event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleMainClick();
                  }
                } : undefined}
                className={[
                  'osrs-dash-skill',
                  isUnlocked ? '' : 'is-locked',
                  canLevel ? 'can-level' : '',
                  canUnlockStart ? 'can-start' : '',
                  levelingSkill === skill ? 'is-leveling' : '',
                ].filter(Boolean).join(' ')}
                role="button"
                tabIndex={isMainActionable ? 0 : -1}
                aria-label={`${skill}, level ${level}${isUnlocked ? `, tier ${tier}, methods ${methodRange}` : ', locked'}`}
                aria-describedby={canLevel ? oddsDescriptionId : undefined}
              >
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onOpenDetails(skill, tier); }}
                  className="osrs-dash-skill-icon"
                  title={`${skill} guide`}
                  aria-label={`${skill} guide`}
                >
                  <img className="osrs-px" src={skillIconSrc(skill)} alt="" aria-hidden="true" width={25} height={25} />
                </button>
                <span className="osrs-dash-skill-val">
                  <span className="osrs-dash-skill-lvl">{level}</span>
                  <span className={isUnlocked ? 'osrs-dash-skill-sub' : 'osrs-dash-skill-sub is-locked'}>
                    {isUnlocked ? `T${tier} · ${methodRange}` : 'Locked'}
                  </span>
                </span>
                {canLevel && <span id={oddsDescriptionId} className="sr-only">{odds}</span>}

                <span className="osrs-dash-skill-tools">
                  {isUnlocked && canOmniUpgrade && (
                    <button
                      type="button"
                      className="osrs-dash-omni"
                      onClick={(e) => { e.stopPropagation(); onSpecialUnlock(TableType.SKILLS, skill); }}
                      title={`Unlock Tier ${tier + 1} (1 Omni-Key)`}
                      aria-label={`Unlock Tier ${tier + 1} of ${skill} (1 Omni-Key)`}
                    >
                      <img className="osrs-px" src={itemSrc('omni_key')} alt="" aria-hidden="true" width={18} height={16} />
                    </button>
                  )}
                  <span className="osrs-dash-note"><NoteTrigger id={skill} title={skill} suspendModals={suspendModals} /></span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="osrs-dash-skillfoot">
        <span style={{ fontFamily: 'RSBold, sans-serif', color: 'var(--osrs-yellow, #ff0)' }}>Total level: {totalLevel}</span>
        <span style={{ fontFamily: 'RSSmall, sans-serif', color: 'var(--osrs-tan, #c8b897)' }}>Under each level: your tier and the levels you can train with</span>
      </div>
    </section>
  );
};

export default OsrsSkills;
