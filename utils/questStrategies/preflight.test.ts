import { describe, expect, it } from 'vitest';
import {
  QUEST_DATA,
  type QuestData,
  type QuestLocationRequirement,
} from '../../data/questData';
import {
  runeProofCatalogueFor,
  type RuneProofCatalogueEntry,
} from '../../data/runeProofQuestCatalogue';
import { requirementExpressionForQuestData } from './preflight';

const catalogueFor = (questId: string): RuneProofCatalogueEntry => (
  runeProofCatalogueFor(questId)!
);

const location = (
  id: string,
  chunks: Array<{ cx: number; cy: number }>,
): QuestLocationRequirement => ({
  id,
  label: id,
  standardAreas: ['Misthalin'],
  chunkOptions: chunks,
});

const syntheticQuest = (over: Partial<QuestData>): QuestData => ({
  id: "Cook's Assistant",
  name: "Cook's Assistant",
  kind: 'quest',
  accessPolicy: 'regions',
  regions: [],
  skills: {},
  prereqs: [],
  points: 1,
  difficulty: QUEST_DATA["Cook's Assistant"].difficulty,
  ...over,
});

describe('QuestData preflight compiler', () => {
  it('compiles Quest Points separately from skill levels', () => {
    const expression = requirementExpressionForQuestData(
      QUEST_DATA["Black Knights' Fortress"],
      catalogueFor("Black Knights' Fortress"),
    );
    expect(JSON.stringify(expression)).toContain('"kind":"QUEST_POINTS"');
    expect(JSON.stringify(expression)).not.toContain('"skill":"Quest Points"');
  });

  it('preserves one-of access routes as ANY', () => {
    const quest = Object.values(QUEST_DATA).find(value => (value.oneOf?.length ?? 0) > 1)!;
    expect(JSON.stringify(requirementExpressionForQuestData(quest, catalogueFor(quest.id))))
      .toContain('"kind":"ANY"');
  });

  it('fails closed for unresolved requirement audits', () => {
    const expression = requirementExpressionForQuestData(
      QUEST_DATA['Bear Your Soul'],
      catalogueFor('Bear Your Soul'),
    );
    expect(JSON.stringify(expression)).toContain('"kind":"UNRESOLVED_EVIDENCE"');
  });

  it('compiles a finite combat-level gate', () => {
    const quest = Object.values(QUEST_DATA)
      .find(value => value.combatLevel !== undefined)!;
    expect(requirementExpressionForQuestData(quest, catalogueFor(quest.id)))
      .toEqual(expect.objectContaining({
        kind: 'ALL',
        requirements: expect.arrayContaining([
          expect.objectContaining({
            kind: 'COMBAT_LEVEL',
            level: quest.combatLevel,
          }),
        ]),
      }));
  });

  it('requires every region for regions policy', () => {
    const expression = requirementExpressionForQuestData(syntheticQuest({
      accessPolicy: 'regions',
      regions: ['Misthalin', 'Kandarin'],
      locations: [location('ignored-location', [{ cx: 99, cy: 99 }])],
    }), catalogueFor("Cook's Assistant"));

    expect(expression).toEqual(expect.objectContaining({
      kind: 'ALL',
      requirements: expect.arrayContaining([
        expect.objectContaining({ kind: 'REGION_ACCESS', regionId: 'Misthalin' }),
        expect.objectContaining({ kind: 'REGION_ACCESS', regionId: 'Kandarin' }),
      ]),
    }));
    expect(JSON.stringify(expression)).not.toContain('99,99');
  });

  it('requires every location while preserving each chunk list as ANY', () => {
    const expression = requirementExpressionForQuestData(syntheticQuest({
      accessPolicy: 'locations',
      regions: ['ignored-region'],
      locations: [
        location('first', [{ cx: 50, cy: 50 }, { cx: 51, cy: 50 }]),
        location('second', [{ cx: 52, cy: 50 }]),
      ],
    }), catalogueFor("Cook's Assistant"));

    const locationNodes = expression.kind === 'ALL'
      ? expression.requirements.filter(requirement => requirement.kind === 'ANY')
      : [];
    expect(locationNodes).toEqual([
      {
        kind: 'ANY',
        requirements: [
          expect.objectContaining({ kind: 'CHUNK_ACCESS', chunk: '50,50' }),
          expect.objectContaining({ kind: 'CHUNK_ACCESS', chunk: '51,50' }),
        ],
      },
      {
        kind: 'ANY',
        requirements: [
          expect.objectContaining({ kind: 'CHUNK_ACCESS', chunk: '52,50' }),
        ],
      },
    ]);
    expect(JSON.stringify(expression)).not.toContain('ignored-region');
  });

  it('requires both geography groups for regions-and-locations policy', () => {
    const expression = requirementExpressionForQuestData(syntheticQuest({
      accessPolicy: 'regions-and-locations',
      regions: ['Kandarin'],
      locations: [location('entrance', [{ cx: 42, cy: 54 }])],
    }), catalogueFor("Cook's Assistant"));

    expect(expression.kind).toBe('ALL');
    expect(JSON.stringify(expression)).toContain('"regionId":"Kandarin"');
    expect(JSON.stringify(expression)).toContain('"chunk":"42,54"');
  });

  it('compiles each oneOf route as an ALL inside one surrounding ANY', () => {
    const expression = requirementExpressionForQuestData(syntheticQuest({
      oneOf: [
        { regions: ['Kandarin'], guilds: ["Wizards' Guild"] },
        { locations: [location('alternate', [{ cx: 50, cy: 50 }, { cx: 51, cy: 50 }])] },
      ],
    }), catalogueFor("Cook's Assistant"));
    const routeChoice = expression.kind === 'ALL'
      ? expression.requirements.find(requirement => requirement.kind === 'ANY')
      : undefined;

    expect(routeChoice).toEqual({
      kind: 'ANY',
      requirements: [
        {
          kind: 'ALL',
          requirements: [
            expect.objectContaining({ kind: 'REGION_ACCESS', regionId: 'Kandarin' }),
            expect.objectContaining({ kind: 'CANONICAL_UNLOCK', unlockType: 'GUILD', unlockId: "Wizards' Guild" }),
          ],
        },
        {
          kind: 'ALL',
          requirements: [{
            kind: 'ANY',
            requirements: [
              expect.objectContaining({ kind: 'CHUNK_ACCESS', chunk: '50,50' }),
              expect.objectContaining({ kind: 'CHUNK_ACCESS', chunk: '51,50' }),
            ],
          }],
        },
      ],
    });
  });

  it('normalizes manual prompts into stable content-derived confirmation IDs', () => {
    const expression = requirementExpressionForQuestData(syntheticQuest({
      id: 'Manual / Quest',
      manualRequirements: ['  Partner\tready\n now  '],
    }), catalogueFor("Cook's Assistant"));

    expect(expression).toEqual(expect.objectContaining({
      kind: 'ALL',
      requirements: expect.arrayContaining([
        expect.objectContaining({
          kind: 'MANUAL_CONFIRMATION',
          id: 'manual:Manual%20%2F%20Quest:Partner%20ready%20now',
          confirmationId: 'manual:Manual%20%2F%20Quest:Partner%20ready%20now',
          prompt: 'Partner ready now',
        }),
      ]),
    }));
  });

  it('rejects blank or normalization-equivalent duplicate manual prompts', () => {
    expect(() => requirementExpressionForQuestData(syntheticQuest({
      manualRequirements: [' \t\n '],
    }), catalogueFor("Cook's Assistant"))).toThrow('manual requirement must not be blank');

    expect(() => requirementExpressionForQuestData(syntheticQuest({
      manualRequirements: ['Partner   ready', 'Partner ready'],
    }), catalogueFor("Cook's Assistant"))).toThrow('duplicate manual requirement: Partner ready');
  });

  it('rejects a reviewed location with no finite chunk option', () => {
    expect(() => requirementExpressionForQuestData(syntheticQuest({
      accessPolicy: 'locations',
      locations: [location('missing', [])],
    }), catalogueFor("Cook's Assistant"))).toThrow('location missing must have at least one chunk option');
  });

  it('rejects access policies whose required geography group is absent', () => {
    expect(() => requirementExpressionForQuestData(syntheticQuest({
      accessPolicy: 'locations',
      locations: undefined,
    }), catalogueFor("Cook's Assistant"))).toThrow(
      'locations policy requires at least one base location',
    );

    expect(() => requirementExpressionForQuestData(syntheticQuest({
      accessPolicy: 'regions-and-locations',
      regions: [],
      locations: [location('entrance', [{ cx: 50, cy: 50 }])],
    }), catalogueFor("Cook's Assistant"))).toThrow(
      'regions-and-locations policy requires at least one region',
    );
  });
});
