import React, { useMemo, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { rankSkillBottlenecksCached } from '../../utils/skillAdvisor';
import { SKILLS_LIST } from '../../constants';
import { TableType, type UnlockState } from '../../types';
import { NoteTrigger } from '../NoteTrigger';
import { SectionGuide } from '../SectionGuide';
import { SkillAdvisorPanel } from '../SkillAdvisorPanel';
import { formatKeyPercent } from '../../utils/keyRoll';
import { levelUpKeyChance } from '../../utils/keyChance';
import { isSkillChaosMilestone, LEVEL_CHAOS_CHANCE } from '../../config/economy';
import { levelPastTierCap, tierCap } from '../../utils/chunkedFate';
import { chunkedPastCapText, levelBoostNote } from '../SkillRollOdds';
import { SkillInfoButton } from '../SkillInfoButton';
import { useSkillOddsHover } from '../../utils/skillOddsPref';
import { skillIconSrc, itemSrc, gemColor, gemCropStyle, roman, TIER_GEMS } from './OsrsDashGems';
import { useTierMarks } from '../../utils/uiStyle';
import './osrs-char.css';
import './osrs-dashboard.css';

/**
 * The Character tab's Skills panel (Skills-Tiers board): the OSRS 3 x 8 skill
 * grid. Each cell: the 25px skill icon, the level in yellow and the tier gem
 * (Opal I .. Zenyte X); under it a 10-notch bar filled up to the tier in the
 * gem colours, then "Tier II · methods to 20" in the tier colour. Locked
 * skills say "Locked" in red and "Needs a Key to start". Cells shrink to the
 * compact Idea-FixedClient form (icon, level, gem, bar) when the panel is
 * short; osrs-char.css decides that from the room each cell has.
 *
 * Same controls as the classic cards: the cell levels the skill up (or
 * starts it with an Omni-Key when locked), the skill icon opens the skill
 * guide, the small Omni-Key button buys the next tier, and the note button
 * (shown on hover, or always once a note exists) opens the skill's note. The
 * next level's Key odds open from the small "i" in the cell's corner, in the
 * game's yellow hover box beside the cell, and are its Examine text; with
 * Settings > "Skill odds on hover" on, they are the cell's tooltip instead. The
 * Skill Advisor opens from the "Advisor" button in the panel's title row.
 * Dashboard owns every handler.
 */

interface Props {
  unlocks: UnlockState;
  specialKeys: number;
  totalSkillTiers: number;
  searchQuery: string;
  onClearSearch?: () => void;
  showOnlyActionable: boolean;
  levelingSkill: string | null;
  advisorsEnabled: boolean;
  suspendModals: boolean;
  onLevelUp: (skill: string) => void;
  onSpecialUnlock: (table: TableType, skill: string) => void;
  onOpenDetails: (skill: string, tier: number) => void;
}

export const OsrsSkills: React.FC<Props> = ({
  unlocks, specialKeys, totalSkillTiers, searchQuery, onClearSearch, showOnlyActionable, levelingSkill,
  advisorsEnabled, suspendModals, onLevelUp, onSpecialUnlock, onOpenDetails,
}) => {
  const totalLevel = SKILLS_LIST.reduce((sum, s) => sum + (unlocks.levels[s] || 1), 0);
  const [showAdvisor, setShowAdvisor] = useState(false);
  const game = useGame();
  const { gameModeId } = game;
  const skillOddsHover = useSkillOddsHover();
  const numerals = useTierMarks() === 'numerals';
  // With nothing to rank, the Advisor says so on its button instead of
  // opening a panel over the skills just to say "nothing". The ranking is
  // slow (every quest and diary per skill level), so it is only worked out
  // once the pointer or focus reaches the button, never on each unlock.
  const [checkedFor, setCheckedFor] = useState<unknown>(null);
  const checking = checkedFor === unlocks;
  const advisorEmpty = useMemo(
    () => advisorsEnabled && checking && rankSkillBottlenecksCached(unlocks, gameModeId).length === 0,
    [advisorsEnabled, checking, unlocks, gameModeId],
  );
  const checkAdvisor = () => { if (!checking) setCheckedFor(unlocks); };
  const query = searchQuery.trim().toLowerCase();
  const noMatches = query !== '' && !SKILLS_LIST.some((s) => s.toLowerCase().includes(query));

  return (
    <section className="osrs-inner osrs-dash-skills" aria-label="Skills">
      <div className="osrs-dash-panelhead">
        <h3 className="osrs-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          Skills <SectionGuide id="SKILLS" className="osrs-dash-qmark" suspendModals={suspendModals} />
        </h3>
        <span className="osrs-char-headtotal">Total level: {totalLevel}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {advisorsEnabled && (
            <button
              type="button"
              className={`osrs-dash-textbtn${showAdvisor && !advisorEmpty ? ' is-on' : ''}${advisorEmpty ? ' is-empty' : ''}`}
              aria-pressed={showAdvisor && !advisorEmpty}
              aria-expanded={showAdvisor && !advisorEmpty}
              aria-disabled={advisorEmpty || undefined}
              onPointerEnter={checkAdvisor}
              onFocus={checkAdvisor}
              onClick={() => {
                if (!checking) {
                  setCheckedFor(unlocks);
                  if (rankSkillBottlenecksCached(unlocks, gameModeId).length === 0) return;
                }
                if (!advisorEmpty) setShowAdvisor((v) => !v);
              }}
              title={advisorEmpty
                ? 'Skill Advisor: no skill is holding back a quest or diary right now.'
                : 'Skill Advisor: which skill to train next, ranked by the quests and diaries it opens'}
            >
              Advisor
            </button>
          )}
          <span className="osrs-dash-yellow-s">{totalSkillTiers}/{SKILLS_LIST.length * 10} tiers</span>
        </span>
      </div>

      <div className="osrs-dash-skillwrap">
        {advisorsEnabled && showAdvisor && !advisorEmpty && (
          <div className="osrs-win osrs-dash-advisor" role="region" aria-label="Skill Advisor">
            <button type="button" className="osrs-dash-close" onClick={() => setShowAdvisor(false)} aria-label="Close Skill Advisor">
              <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="2.5" /></svg>
            </button>
            <SkillAdvisorPanel />
          </div>
        )}

        {noMatches && (
          <div className="osrs-dash-nomatch" role="status">
            <span>No skills match &lsquo;{searchQuery.trim()}&rsquo;.</span>
            <button type="button" className="osrs-btn" onClick={() => onClearSearch?.()}>Clear</button>
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
            const pastCap = canLevel && levelPastTierCap(gameModeId, unlocks, skill, nextLevel);
            // The chance the level-up rolls against, boosts included (utils/keyChance.ts).
            const chance = canLevel ? levelUpKeyChance(game, skill) : null;
            const odds = pastCap
              ? `Next Lv ${nextLevel}: no Key roll. ${chunkedPastCapText(tierCap(tier))}`
              : chance !== null
              ? `Next Lv ${nextLevel}: ${formatKeyPercent(chance)} Key chance.${levelBoostNote(chance, nextLevel)} ${isSkillChaosMilestone(nextLevel)
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
                title={skillOddsHover ? `${skill}: ${examine}${action ? ` ${action}` : ''}` : undefined}
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
                role={isMainActionable ? 'button' : 'group'}
                tabIndex={isMainActionable ? 0 : undefined}
                aria-label={`${skill}, level ${level}${isUnlocked ? `, tier ${tier}, methods ${methodRange}` : ', locked'}${canUnlockStart ? ', unlock with an Omni-Key' : canLevel ? ', level up' : ''}`}
                aria-describedby={canLevel ? oddsDescriptionId : undefined}
              >
                <span className="osrs-char-skrow">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onOpenDetails(skill, tier); }}
                    className="osrs-dash-skill-icon"
                    title={`${skill} guide`}
                    aria-label={`${skill} guide`}
                  >
                    <img className="osrs-px" src={skillIconSrc(skill)} alt="" aria-hidden="true" width={25} height={25} />
                  </button>
                  <span className="osrs-dash-skill-lvl">{level}</span>
                  {isUnlocked && !numerals && <span className="osrs-char-sktier" style={{ color: gemColor(tier) }}>Tier {roman(tier)}</span>}
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
                  {!isUnlocked
                    ? <span className="osrs-char-sklock">Locked</span>
                    : numerals
                    ? <span className="osrs-char-tiernum" style={{ color: gemColor(tier) }} aria-hidden="true" title={`Tier ${roman(tier)}`}>{roman(tier)}</span>
                    : <span className="osrs-char-gem" style={gemCropStyle(tier)} aria-hidden="true" title={`Tier ${roman(tier)} · ${TIER_GEMS[tier - 1]?.name ?? ''}`} />}
                </span>
                <span className="osrs-char-notches" aria-hidden="true">
                  {TIER_GEMS.map((g, i) => (
                    <span key={g.name} className={i < tier ? 'is-on' : undefined} style={i < tier ? { background: g.color } : undefined} />
                  ))}
                </span>
                <span className="osrs-char-sksub" style={isUnlocked ? { color: gemColor(tier) } : undefined}>
                  {isUnlocked
                    ? <>Tier {roman(tier)} · <span className="osrs-char-sklong">methods </span>to {tier >= 10 ? 99 : tier * 10}</>
                    : 'Needs a Key to start'}
                </span>
                {canLevel && !skillOddsHover && (
                  <span className="osrs-skill-info-slot">
                    <SkillInfoButton skill={skill} level={level} tier={tier} chance={chance}
                      pastCap={pastCap ? tierCap(tier) : undefined} variant="osrs" />
                  </span>
                )}
                {canLevel && <span id={oddsDescriptionId} className="sr-only">{odds}</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="osrs-dash-skillfoot osrs-char-skfoot">
        <span style={{ fontFamily: 'RSBold, sans-serif', color: 'var(--osrs-yellow, #ff0)' }}>Total level: {totalLevel}</span>
        <span style={{ fontFamily: 'RSSmall, sans-serif', color: 'var(--osrs-tan, #c8b897)' }}>{numerals ? 'Numeral' : 'Gem'} = your tier. Bars fill as tiers unlock.</span>
      </div>
    </section>
  );
};

export default OsrsSkills;
