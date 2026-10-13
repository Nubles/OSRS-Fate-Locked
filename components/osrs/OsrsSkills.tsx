import React from 'react';
import { SKILLS_LIST } from '../../constants';
import { TableType, type UnlockState } from '../../types';
import { NoteTrigger } from '../NoteTrigger';
import { SectionGuide } from '../SectionGuide';
import { SkillAdvisorPanel } from '../SkillAdvisorPanel';
import { formatKeyPercent, skillLevelKeyChance } from '../../utils/keyRoll';
import { isSkillChaosMilestone, LEVEL_CHAOS_CHANCE } from '../../config/economy';
import { TIER_GEMS, gemSrc, gemColor, roman, skillIconSrc, itemSrc } from './OsrsDashGems';
import './osrs-dashboard.css';

/**
 * The Character tab's Skills, as the OSRS skills tab: icon, level and the
 * gem of the unlocked tier (Tier I Opal .. Tier X Zenyte), a ten-notch tier
 * bar, and the next level's Key odds. Locked skills are dimmed.
 *
 * Same controls as the classic cards: the cell levels the skill up (or
 * starts it with an Omni-Key when locked), the skill icon opens the skill
 * guide, the small Omni-Key button buys the next tier, and the note button
 * opens the skill's note. Dashboard owns every handler.
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

  return (
    <div className="osrs-win osrs-dash-skills">
      <div className="osrs-dash-panelhead">
        <h3 className="osrs-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          Skills <SectionGuide id="SKILLS" suspendModals={suspendModals} />
        </h3>
        <span className="osrs-dash-yellow-s">{totalSkillTiers}/{SKILLS_LIST.length * 10} tiers</span>
      </div>

      {advisorsEnabled && <SkillAdvisorPanel />}

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

          const gem = isUnlocked ? TIER_GEMS[tier - 1] : null;
          const nextLevel = level + 1;
          const examine = isUnlocked
            ? `Level ${level}. Tier ${roman(tier)} (${gem!.name}) unlocked: methods ${methodRange}.`
            : `Level ${level}. Locked: no tier unlocked yet.`;

          return (
            <div
              key={skill}
              data-skill-card={skill}
              data-examine-name={skill}
              data-examine={examine}
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
              aria-label={skill}
              aria-describedby={canLevel ? oddsDescriptionId : undefined}
            >
              <div className="osrs-dash-skill-top">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onOpenDetails(skill, tier); }}
                  className="osrs-dash-skill-icon"
                  title="View Skill Details"
                  aria-label={`${skill} guide`}
                >
                  <img className="osrs-px" src={skillIconSrc(skill)} alt="" aria-hidden="true" width={25} height={25} />
                </button>
                <span className="osrs-dash-skill-lvl">{level}</span>
                <span className="osrs-dash-skill-right">
                  {gem
                    ? <img className="osrs-px" src={gemSrc(tier)} alt={`Tier ${roman(tier)}`} title={`Tier ${roman(tier)} · ${gem.name}`} width={27} height={24} />
                    : <span className="osrs-dash-locked">Locked</span>}
                </span>
              </div>

              <div className="osrs-dash-notches" aria-hidden="true">
                {TIER_GEMS.map((g, i) => (
                  <span key={g.name} style={i < tier ? { background: g.color, boxShadow: 'inset 0 -2px 0 rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.35)' } : undefined} />
                ))}
              </div>

              {canLevel && (
                <div className="osrs-dash-skill-odds">
                  Next Lv {nextLevel} · {formatKeyPercent(skillLevelKeyChance(nextLevel))} Key
                  <span id={oddsDescriptionId} role="tooltip" className="osrs-tooltip osrs-dash-tip">
                    {isSkillChaosMilestone(nextLevel)
                      ? `Level ${nextLevel} also gives a guaranteed Chaos Key, and a separate ${LEVEL_CHAOS_CHANCE}% chance of another.`
                      : `Each level-up also has a separate ${LEVEL_CHAOS_CHANCE}% chance of a Chaos Key.`}
                  </span>
                </div>
              )}

              <div className="osrs-dash-skill-foot">
                <span className="osrs-dash-skill-sub" style={{ color: isUnlocked ? gemColor(tier) : 'var(--osrs-muted, #8a7c66)' }}>
                  {isUnlocked ? `Tier ${roman(tier)} · ${methodRange}` : 'Needs a Key to start'}
                </span>
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
                  <NoteTrigger id={skill} title={skill} suspendModals={suspendModals} />
                </span>
              </div>

              {isMainActionable && (
                <span className="osrs-dash-skill-action" aria-hidden="true">
                  {canUnlockStart ? 'Unlock' : 'Level up'}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="osrs-dash-skillfoot">
        <span style={{ fontFamily: 'RSBold, sans-serif', color: 'var(--osrs-yellow, #ff0)' }}>Total level: {totalLevel}</span>
        <span style={{ fontFamily: 'RSSmall, sans-serif', color: 'var(--osrs-tan, #c8b897)' }}>Gem = your tier. Click a skill to level it.</span>
      </div>
    </div>
  );
};

export default OsrsSkills;
