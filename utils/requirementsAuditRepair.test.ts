import { describe, expect, it } from 'vitest';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import { QUEST_DATA } from '../data/questData';
import { REGIONS_LIST, SKILLS_LIST, POH_LIST, ROLLABLE_POH_ITEMS } from '../data/items';
import { getActivityReq } from '../data/activityRequirements';
import { STRATEGY_DATABASE } from '../data/requirements';
import { TableType, type GameState, type UnlockState } from '../types';
import { evaluateDiaryTaskEligibility, evaluateDiaryTierEligibility, evaluateQuestEligibility } from './journalStatus';
import { evaluateActivityReadiness } from './activityReadiness';
import { calculateGoalProgress } from './goalLogic';
import { buildGoalRoute } from './goalRoute';
import { randomUnlockPool, checkUnlockAvailability } from './gameEngine';

const profile = (over: Partial<UnlockState> = {}): UnlockState => ({
  equipment: {}, skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 10])),
  levels: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 99])), regions: [...REGIONS_LIST],
  chunks: [], mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
  bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [], banks: [],
  quests: [], diaries: [], cas: [], completedTasks: [], collectionLog: {}, ...over,
});
const activity = (name: string, unlocks = profile()) => evaluateActivityReadiness(true, getActivityReq(name), unlocks, 'vanilla');
const questProfile = (id: string, excluded: string[] = []) => profile({ quests: Object.keys(QUEST_DATA).filter(q => q !== id && !excluded.includes(q)) });

describe('audited diary requirement semantics', () => {
  const partial = ALL_DIARY_TASKS.filter(task => task.questProgress?.length);
  it('preserves all 56 audited partial-progress tasks in generated source', () => {
    expect(partial).toHaveLength(56);
  });
  it.each(partial.map(task => [task.id, task] as const))('%s asks for progress, not complete quest', (_, task) => {
    const quests = task.questProgress!.map(requirement => requirement.quest);
    const unlocks = profile({ quests: Object.keys(QUEST_DATA).filter(id => !quests.includes(id)) });
    const result = evaluateDiaryTaskEligibility(task, unlocks, 'vanilla');
    expect(result.blockers.filter(b => b.kind === 'quest' && quests.includes(b.label))).toEqual([]);
    expect(result.manualChecks).toEqual(expect.arrayContaining(task.questProgress!.map(requirement => requirement.label)));
    expect(result.eligible).toBe(false);
    const completed = evaluateDiaryTaskEligibility(task, profile({ quests: Object.keys(QUEST_DATA) }), 'vanilla');
    for (const requirement of task.questProgress!) expect(completed.manualChecks).not.toContain(requirement.label);
  });
  it('never grants the UIM exemption without confirmation', () => {
    const task = ALL_DIARY_TASKS.find(task => task.id === 'ard_med_6')!;
    expect(evaluateDiaryTaskEligibility(task, profile(), 'vanilla')).toMatchObject({ eligible: false, confirmable: true, manualChecks: [expect.stringContaining('Ultimate Ironman')] });
    expect(evaluateDiaryTaskEligibility(task, profile({ quests: ['The Hand in the Sand'] }), 'vanilla').eligible).toBe(true);
  });
  it('keeps unconfirmed progress visible at diary-tier and goal-route level', () => {
    const unlocks = profile({
      quests: Object.keys(QUEST_DATA).filter(id=>id!=='Fairytale II - Cure a Queen'),
      completedTasks: ALL_DIARY_TASKS.filter(task=>task.tierId==='Ardougne Medium' && task.id!=='ard_med_1').map(task=>task.id),
      mobility: ['Fairy Rings'],
      equipment: { Weapon: 1 },
    });
    const tier = evaluateDiaryTierEligibility({id:'Ardougne Medium'},unlocks,'vanilla');
    expect(tier).toMatchObject({machineEligible:true,eligible:false,manualChecks:[
      expect.stringContaining('Dramen or lunar staff'),
      expect.stringContaining('Fairytale II'),
    ]});
    const route = buildGoalRoute('Ardougne Medium',{unlocks,gameModeId:'vanilla'} as GameState)!;
    expect(route.percentage).toBeLessThan(100);
    expect(route.manualChecks).toEqual([
      expect.objectContaining({name:expect.stringContaining('Dramen or lunar staff'),met:false}),
      expect.objectContaining({name:expect.stringContaining('Fairytale II'),met:false}),
    ]);
  });
});

describe('audited activity hard gates and confirmations', () => {
  it.each([
    ['General Graardor', 'Strength', 70], ['Commander Zilyana', 'Agility', 70], ["Kree'arra", 'Ranged', 70], ["K'ril Tsutsaroth", 'Hitpoints', 70],
    ['Nex', 'Strength', 70], ['Nex', 'Agility', 70], ['Nex', 'Ranged', 70], ['Nex', 'Hitpoints', 70],
    ['Hunter Guild', 'Hunter', 46], ['Stealing Artefacts', 'Thieving', 49], ['Crystal Tree', 'Farming', 74],
    ['Spirit Tree (POH)', 'Farming', 83], ['Bones to Peaches', 'Magic', 60], ['Moons of Peril', 'Hunter', 20], ['Moons of Peril', 'Fishing', 20],
  ] as const)('%s enforces %s %s', (name, skill, level) => {
    const unlocks = profile({ quests: Object.keys(QUEST_DATA) });
    unlocks.levels[skill] = level - 1;
    expect(activity(name, unlocks)).toMatchObject({ status: 'NOT_READY', blockers: expect.arrayContaining([{kind: 'skill', label: `${skill} ${level}`}]) });
  });
  it('uses hard Wilderness diary OR an explicit Vetion task check', () => {
    expect(activity("Calvar'ion")).toMatchObject({status: 'NEEDS_CONFIRMATION', checks: [expect.stringContaining("Vet'ion")]});
    expect(activity("Calvar'ion", profile({diaries: ['Wilderness Medium']})).status).toBe('NEEDS_CONFIRMATION');
    expect(activity("Calvar'ion", profile({diaries: ['Wilderness Hard']})).status).toBe('READY');
  });
  it.each([['Obor', 'giant key'], ['Bryophyta', 'mossy key']])('%s describes its permanent first-access key unlock', (name, key) => {
    expect(activity(name)).toMatchObject({status: 'NEEDS_CONFIRMATION', checks: [expect.stringContaining(key)]});
    expect(getActivityReq(name)?.manualRequirements?.[0]).toContain('first access only');
  });
  it('includes the Guardians active task and permanent roof unlock', () => {
    const result = activity('Grotesque Guardians', profile({quests: ['Priest in Peril']}));
    expect(result).toMatchObject({status: 'NEEDS_CONFIRMATION', checks: [expect.stringContaining('Permanently'), expect.stringContaining('active gargoyle')]});
  });
  it('requires the repeatable Moons quest unlock', () => {
    expect(activity('Moons of Peril', profile({quests: ["Twilight's Promise"]}))).toMatchObject({status: 'NOT_READY', blockers: expect.arrayContaining([{kind:'quest',label:'Perilous Moons'}])});
  });
  it.each([['Quetzal Network', "Twilight's Promise"], ['Pyramid Plunder', "Icthlarin's Little Helper"]])('%s accepts partial progress or completion of %s', (name, quest) => {
    expect(activity(name).status).toBe('NEEDS_CONFIRMATION');
    expect(activity(name, profile({quests: [quest]})).status).toBe('READY');
  });
  it('requires the Preserve scroll', () => expect(activity('Preserve')).toMatchObject({status: 'NEEDS_CONFIRMATION', checks: [expect.stringContaining('torn prayer scroll')]}));
  it('allows Anima at 76 Farming', () => {
    const unlocks = profile(); unlocks.levels.Farming = 76;
    expect(activity('Anima', unlocks).status).toBe('READY');
  });
  it('requires full Fairytale II for the POH building item', () => expect(activity('Fairy Ring (POH)')).toMatchObject({status: 'NOT_READY', blockers: [{kind:'quest',label:'Fairytale II - Cure a Queen'}]}));
  it('base digsite pendant uses The Dig Site and museum knowledge', () => {
    expect(activity('Digsite Pendant', profile({quests:['The Dig Site']}))).toMatchObject({status:'NEEDS_CONFIRMATION',checks:[expect.stringContaining('Varrock Museum')]});
    expect(getActivityReq('Digsite Pendant')?.note).toContain('cannot be recharged');
  });
  it('allows entry to Fishing Trawler at level 1', () => {
    const unlocks=profile(); unlocks.levels.Fishing=1;
    expect(activity('Fishing Trawler',unlocks).status).toBe('READY');
  });
  it('Mimic caskets are elite/master and opt-in is separate', () => {
    expect(getActivityReq('Mimic')?.manualRequirements).toEqual([expect.stringContaining('Opted in'), expect.stringContaining('elite or master')]);
  });
  it('retains old Aquarium ownership while excluding future rolls and exhaustion counts', () => {
    expect(POH_LIST).toContain('Aquarium');
    expect(ROLLABLE_POH_ITEMS).not.toContain('Aquarium');
    expect(randomUnlockPool(profile(), 'vanilla', 'key', TableType.POH).map(item => item.item)).not.toContain('Aquarium');
    expect(checkUnlockAvailability(profile({housing: [...ROLLABLE_POH_ITEMS]})).poh).toBe(false);
    expect(checkUnlockAvailability(profile({housing: ['Aquarium', ...ROLLABLE_POH_ITEMS.slice(1)]})).poh).toBe(true);
  });
});

describe('audited quest prerequisites and unified goals', () => {
  it.each([['Secrets of the North','Devious Minds'], ['Desert Treasure II','His Faithful Servants'], ['RFD: Finale','Desert Treasure I'], ['RFD: Finale','Horror from the Deep'], ...['Dwarf','Goblins','Pirate Pete','Lumbridge Guide','Evil Dave','Skrach Uglogwee','Sir Amik Varze','King Awowogei'].map(name => [`RFD: ${name}`,'RFD: The Cook'])])('%s requires %s', (id, prerequisite) => {
    expect(evaluateQuestEligibility(QUEST_DATA[id], questProfile(id,[prerequisite]),'vanilla').blockers).toContainEqual({kind:'quest',label:prerequisite});
  });
  it.each([["Mourning's End Part II",'Agility',56],['RFD: Evil Dave','Cooking',10]] as const)('%s does not enforce recommendations', (id, skill, level) => {
    const unlocks=questProfile(id); unlocks.levels[skill]=level;
    expect(evaluateQuestEligibility(QUEST_DATA[id],unlocks,'vanilla').eligible).toBe(true);
  });
  it('Sir Amik requires Jungle progress and the real completed prerequisites', () => {
    const id='RFD: Sir Amik Varze';
    expect(evaluateQuestEligibility(QUEST_DATA[id],questProfile(id,["Legends' Quest"]),'vanilla')).toMatchObject({eligible:false,machineEligible:true,manualChecks:[expect.stringContaining('Kharazi Jungle')]});
    expect(evaluateQuestEligibility(QUEST_DATA[id],questProfile(id,["Legends' Quest",'Family Crest']),'vanilla').blockers).toContainEqual({kind:'quest',label:'Family Crest'});
  });
  it('Desert Treasure I accepts either Slayer 10 or the confirmed gas-mask route', () => {
    const quest=QUEST_DATA['Desert Treasure I']; const unlocks=questProfile(quest.id,['Plague City']);
    unlocks.levels.Slayer=1;
    expect(evaluateQuestEligibility(quest,unlocks,'vanilla').machineEligible).toBe(false);
    unlocks.quests.push('Plague City');
    expect(evaluateQuestEligibility(quest,unlocks,'vanilla')).toMatchObject({machineEligible:true,eligible:false,manualChecks:[expect.stringContaining('gas mask')]});
    unlocks.levels.Slayer=10; unlocks.quests=unlocks.quests.filter(id=>id!=='Plague City');
    expect(evaluateQuestEligibility(quest,unlocks,'vanilla').eligible).toBe(true);
  });
  it.each(Object.keys(STRATEGY_DATABASE).filter(id=>QUEST_DATA[id]))('%s goal progress agrees with canonical quest readiness', id => {
    const unlocks=profile();
    const result=evaluateQuestEligibility(QUEST_DATA[id],unlocks,'vanilla');
    const goal=calculateGoalProgress(STRATEGY_DATABASE[id],unlocks,'vanilla');
    expect(goal.percentage===100).toBe(result.eligible);
    expect(goal.missing).toEqual([...result.blockers.map(blocker=>blocker.label),...result.manualChecks.map(check=>'Confirm: '+check)]);
  });
  it('Black Knights Fortress uses earned QP rather than a skill slot', () => {
    const id="Black Knights' Fortress";
    const unlocks=profile({equipment:{Head:1,Body:1},quests:["Cook's Assistant",'Demon Slayer','Romeo & Juliet','Sheep Shearer','Goblin Diplomacy']});
    expect(evaluateQuestEligibility(QUEST_DATA[id],unlocks,'vanilla').eligible).toBe(true);
    expect(calculateGoalProgress({id,category:TableType.QUESTS,regions:[],skills:QUEST_DATA[id].skills},unlocks,'vanilla').percentage).toBe(100);
  });
  it('quest route drops stale strategy Prayer 60 and uses canonical prerequisites', () => {
    const unlocks=profile(); unlocks.levels.Prayer=43;
    const route=buildGoalRoute('Desert Treasure II',{unlocks,gameModeId:'vanilla'} as GameState)!;
    expect(route.kind).toBe('quest');
    expect(route.skills.find(skill=>skill.skill==='Prayer')?.needLevel??0).toBeLessThan(60);
    expect(route.quests.map(quest=>quest.name)).toContain('His Faithful Servants');
  });
});
