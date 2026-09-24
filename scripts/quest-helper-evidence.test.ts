import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { extractQuestHelperFile } from './quest-helper-evidence.mjs';
import { readQuestHelperSource } from './quest-helper-source.mjs';

const parse = (content: string) => extractQuestHelperFile({ path: 'quests/example/Example.java', content });

describe('QuestHelper static source evidence', () => {
  it('retains explicit equipment, non-consumption, alternate IDs, and copyright evidence', () => {
    const content = `/* Copyright (c) Example. All rights reserved. */
      class Example {
        ItemRequirement amulet, passage;
        void setup() {
          amulet = new ItemRequirement("Ghostspeak amulet", ItemID.AMULET_OF_GHOSTSPEAK, 1, true).isNotConsumed();
          amulet.setTooltip("Wear it.");
          passage = new ItemRequirement("Necklace of passage", ItemID.PASSAGE_5);
          passage.addAlternates(ItemID.PASSAGE_1, ItemID.PASSAGE_2);
        }
      }`;
    const evidence = parse(content);
    expect(evidence).toMatchObject({ className: 'Example', coverage: 'STATIC_PARTIAL', sourceSha256: createHash('sha256').update(content).digest('hex') });
    expect(evidence.notices).toEqual(['/* Copyright (c) Example. All rights reserved. */']);
    expect(evidence.itemRequirements[0]).toMatchObject({ variable: 'amulet', name: 'Ghostspeak amulet', quantity: 1, mustBeEquipped: true, idExpression: 'ItemID.AMULET_OF_GHOSTSPEAK' });
    expect(evidence.itemRequirements[0].modifiers.map((call) => call.method)).toEqual(['isNotConsumed', 'setTooltip']);
    expect(evidence.itemRequirements[1]).toMatchObject({ quantity: null, mustBeEquipped: null, alternates: ['ItemID.PASSAGE_1', 'ItemID.PASSAGE_2'] });
  });

  it('preserves a declared default and nested condition expressions in branch priority order', () => {
    const evidence = parse(`class Example {
      void load() {
        var returnSkull = new ConditionalStep(this, enterBasement);
        returnSkull.addStep(and(inBasement, hasSkull), exitBasement);
        returnSkull.addStep(and(hasSkull, or(coffinOpened, new ObjectCondition(12))), putSkullInCoffin);
        returnSkull.addStep(hasSkull, openCoffin);
        steps.put(QUEST_STATE + 1, returnSkull);
      }
    }`);
    expect(evidence.conditionalSteps[0]).toMatchObject({ variable: 'returnSkull', defaultStepExpression: 'enterBasement' });
    expect(evidence.conditionalSteps[0].branches.map(({ order, conditionExpression, stepExpression }) => ({ order, conditionExpression, stepExpression }))).toEqual([
      { order: 0, conditionExpression: 'and(inBasement, hasSkull)', stepExpression: 'exitBasement' },
      { order: 1, conditionExpression: 'and(hasSkull, or(coffinOpened, new ObjectCondition(12)))', stepExpression: 'putSkullInCoffin' },
      { order: 2, conditionExpression: 'hasSkull', stepExpression: 'openCoffin' },
    ]);
    expect(evidence.progressSteps[0]).toMatchObject({ stateExpression: 'QUEST_STATE + 1', stepExpression: 'returnSkull' });
    expect(evidence.conditions[0]).toMatchObject({ kind: 'ObjectCondition', variable: null, arguments: ['12'] });
  });

  it('balances strings, escaped quotes, comments, nested arguments and array literals', () => {
    const evidence = parse(String.raw`class Example {
      void setup() {
        // fake = new NpcStep(this, 0, "not evidence");
        talk = new NpcStep(this, new int[] { 1, 2 }, new WorldPoint(3243, /* comma, ) ; */ 3206, 0), "Say \"yes\"; (a,b) // text", amulet);
        talk.addDialogStep("Yes, (really); /* literal */");
        talk.customBehavior(fn("a,b", 2));
        panels.add(new PanelDetails("Start, here", List.of(talk, getStep(1, 2))));
      }
    }`);
    expect(evidence.steps).toHaveLength(1);
    expect(evidence.steps[0]).toMatchObject({ variable: 'talk', text: 'Say "yes"; (a,b) // text', worldPoint: { x: 3243, y: 3206, plane: 0 }, requirementExpressions: ['amulet'] });
    expect(evidence.steps[0].arguments[1]).toBe('new int[] { 1, 2 }');
    expect(evidence.steps[0].dialogue[0].text).toEqual(['Yes, (really); /* literal */']);
    expect(evidence.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'UNMODELED_CALL', expression: 'talk.customBehavior(fn("a,b", 2))' })]));
    expect(evidence.panels[0]).toMatchObject({ title: 'Start, here', stepExpressions: ['talk', 'getStep(1, 2)'] });
  });

  it('keeps dynamic and malformed coordinates visible without guessing a destination', () => {
    const evidence = parse(`class Example {
      void setup() {
        dynamic = new ObjectStep(this, 1, new WorldPoint(BASE_X + 1, 3200, plane), "Go there.");
        transformed = new DetailedQuestStep(this, new WorldPoint(100, 200, 0).dx(3), "Move.");
        broken = new WorldPoint(100, 200;
      }
    }`);
    expect(evidence.worldPoints).toEqual([expect.objectContaining({ x: 100, y: 200, plane: 0, expression: 'new WorldPoint(100, 200, 0)' })]);
    expect(evidence.steps.every((step) => step.worldPoint === null)).toBe(true);
    expect(evidence.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(['UNRESOLVED_WORLD_POINT', 'UNBALANCED_DELIMITER', 'UNPARSED_CONSTRUCTOR']));
    expect(evidence.issues.find((issue) => issue.code === 'UNRESOLVED_WORLD_POINT')?.expression).toContain('BASE_X + 1');
  });

  it('does not turn multiple points inside a zone into one exact step location', () => {
    const evidence = parse(`class Example {
      void setup() {
        var step = new DetailedQuestStep(this, new Zone(new WorldPoint(3094, 9553, 0), new WorldPoint(3125, 9582, 0)), "Inside the basement.");
        var zone = new Zone(new WorldPoint(10, 20, 0), new WorldPoint(30, 40, 0));
      }
    }`);
    expect(evidence.worldPoints).toHaveLength(4);
    expect(evidence.steps[0].worldPoint).toBeNull();
    expect(evidence.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'NESTED_STEP_LOCATIONS' })]));
    expect(evidence.conditions.filter((condition) => condition.kind === 'Zone')).toHaveLength(2);
  });

  it('retains logic factories and copied requirements as unresolved source expressions', () => {
    const evidence = parse(`class Example {
      Requirement ready, other;
      ItemRequirement tool;
      void setup() {
        ready = and(inBasement, or(hasSkull, other));
        tool = base.copy().quantity(getQuantity());
        ready.unrecognizedModifier("keep this");
      }
    }`);
    expect(evidence.conditions[0]).toMatchObject({ variable: 'ready', expression: 'and(inBasement, or(hasSkull, other))' });
    expect(evidence.itemRequirements[0]).toMatchObject({ variable: 'tool', expression: 'base.copy().quantity(getQuantity())', quantity: null });
    expect(evidence.issues.filter((issue) => issue.code === 'UNRESOLVED_ASSIGNMENT')).toHaveLength(2);
    expect(evidence.conditions[0].followupCalls[0].method).toBe('unrecognizedModifier');
  });

  it('keeps chained modifiers and constructor overload text distinct from NPC names', () => {
    const evidence = parse(`class Example {
      QuestStep custom;
      void setup() {
        talk = new NpcStep(this, 1, "Bob", new WorldPoint(X, Y, 0), "Talk to Bob.", amulet);
        talk.setText("Changed.").customBehavior(4);
        custom = new UnnamedPuzzle(this, "Solve it.");
        var text = Integer.toString(1);
      }
    }`);
    expect(evidence.steps[0]).toMatchObject({ text: 'Talk to Bob.', requirementExpressions: ['amulet'], worldPoint: null });
    expect(evidence.steps[0].followupCalls.map((call) => call.method)).toEqual(['setText', 'customBehavior']);
    expect(evidence.steps[1]).toMatchObject({ kind: 'UnnamedPuzzle', variable: 'custom', text: 'Solve it.' });
    expect(evidence.issues.some((issue) => issue.code === 'UNBALANCED_DELIMITER')).toBe(false);
  });

  it('extracts the pinned Restless Ghost evidence without depending on a working source checkout', async () => {
    const { data } = await readQuestHelperSource();
    const source = data.files.find((file) => file.path.endsWith('/therestlessghost/TheRestlessGhost.java'));
    expect(source).toBeDefined();
    const evidence = extractQuestHelperFile(source!);
    expect(evidence.sourceSha256).toBe(source!.sha256);
    expect(evidence.steps).toHaveLength(10);
    expect(evidence.worldPoints).toHaveLength(12);
    expect(evidence.itemRequirements).toHaveLength(4);
    expect(evidence.itemRequirements.find((item) => item.variable === 'ghostspeakAmulet')).toMatchObject({ quantity: 1, mustBeEquipped: true });
    expect(evidence.conditionalSteps.find((step) => step.variable === 'returnSkullToGhost')?.branches.map((branch) => branch.conditionExpression)).toEqual([
      'and(inBasement, hasSkull)', 'and(hasSkull, coffinOpened)', 'hasSkull', 'inBasement',
    ]);
    expect(evidence.progressSteps.map((step) => step.stateExpression)).toEqual(['0', '1', '2', '3', '4']);
    expect(evidence.panels).toHaveLength(4);
    expect(evidence.notices.join('\n')).toContain('Copyright (c) 2020, Zoinkwiz');
    expect(evidence.coverage).toBe('STATIC_PARTIAL');
    expect(evidence.issues).toEqual([]);
  });

  it('does not substitute an NPC name for a dynamic instruction or promote recommended lists', () => {
    const evidence = parse(`class Example {
      void setup() {
        talk = new NpcStep(this, 1, "Bob", new WorldPoint(1, 2, 0), dynamicText, amulet);
        enter = new ObjectStep(this, 2, new WorldPoint(3, 4, 0), "Enter.", Arrays.asList(key, book), Collections.singletonList(optionalBook));
      }
    }`);
    expect(evidence.steps[0]).toMatchObject({ text: null, textExpression: 'dynamicText', requirementExpressions: ['amulet'] });
    expect(evidence.steps[1]).toMatchObject({ requirementExpressions: ['Arrays.asList(key, book)'], recommendedRequirementExpressions: ['Collections.singletonList(optionalBook)'] });
    expect(evidence.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'UNRESOLVED_STEP_TEXT' })]));
  });

  it('withholds constructor destinations when location setters change them, regardless of method order', () => {
    const evidence = parse(`class Example {
      NpcStep first, second;
      void updateBeforeSetup() { first.setWorldPoint(30, 40, 0); }
      void setup() {
        first = new NpcStep(this, 1, new WorldPoint(10, 20, 0), "Talk.");
        second = new NpcStep(this, 2, new WorldPoint(50, 60, 0), "Talk again.");
        second.setWorldPointVarp(VarPlayer.DYNAMIC_LOCATION);
      }
    }`);
    expect(evidence.steps.map((step) => step.worldPoint)).toEqual([null, null]);
    expect(evidence.steps[0].constructorWorldPoint).toMatchObject({ x: 10, y: 20, plane: 0 });
    expect(evidence.steps[0].locationMutationCalls[0]).toMatchObject({ method: 'setWorldPoint', arguments: ['30', '40', '0'] });
    expect(evidence.issues.filter((issue) => issue.code === 'LOCATION_MUTATED')).toHaveLength(2);
  });

  it('withholds the real Curse of the Empty Lord placeholder locations', async () => {
    const { data } = await readQuestHelperSource();
    const source = data.files.find((file) => file.path.endsWith('/curseoftheemptylord/CurseOfTheEmptyLord.java'));
    const evidence = extractQuestHelperFile(source!);
    const lennissa = evidence.steps.find((step) => step.variable === 'talkToLennissa');
    expect(lennissa).toMatchObject({ worldPoint: null, constructorWorldPoint: { x: 2556, y: 3445, plane: 0 } });
    expect(lennissa!.locationMutationCalls).toHaveLength(3);
  });
});
