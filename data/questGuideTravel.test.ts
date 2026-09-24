// @ts-expect-error Node types are intentionally excluded from the browser app.
import { readFileSync } from 'node:fs';
// @ts-expect-error Node types are intentionally excluded from the browser app.
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { questGuideTravelFor } from './questGuideTravel';
import { questWalkthroughCatalogue } from './questWalkthroughs.public';

const source = JSON.parse(gunzipSync(
  readFileSync('data/sources/chunkpicker-chunkinfo-export.json.gz'),
).toString('utf8'));

const graphNodeExists = (id: string) => {
  const [chunk, section = '0'] = id.split('-');
  return Array.isArray(source.sections[chunk]?.[section]);
};

const uniqueEntitySection = (chunk: string, field: string, entity: string): string[] => {
  const content = source.chunks[chunk];
  if (!content.Sections) return content[field]?.[entity] ? [chunk] : [];
  return Object.entries(content.Sections)
    .filter(([, section]: [string, any]) => section[field]?.[entity])
    .map(([section]) => `${chunk}-${section}`);
};

const endpoint = (questId: string, actionId: string) => {
  const guide = questWalkthroughCatalogue.find(entry => entry.questId === questId)!;
  return questGuideTravelFor(questId, guide.revision)!.steps[actionId];
};

describe('reviewed public guide walking endpoints', () => {
  it('covers every public action using an existing graph section in its reviewed destination chunk', () => {
    let actionCount = 0;
    for (const guide of questWalkthroughCatalogue) {
      const travel = questGuideTravelFor(guide.questId, guide.revision)!;
      expect(travel, guide.questId).toBeDefined();
      expect(Object.keys(travel.steps).sort()).toEqual(guide.actions.map(action => action.id).sort());
      for (const action of guide.actions) {
        const step = travel.steps[action.id];
        expect(graphNodeExists(step.section), `${action.id}: ${step.section}`).toBe(true);
        const regionId = Number(step.section.split('-')[0]);
        const chunk = `${regionId >> 8},${regionId & 255}`;
        expect(action.location.kind).toBe('EXPLICIT_CHUNKS');
        if (action.location.kind === 'EXPLICIT_CHUNKS') expect(action.location.chunks).toContain(chunk);
        actionCount += 1;
      }
    }
    expect(actionCount).toBe(32);
  });

  it('does not reuse endpoint reviews for unknown quests or changed guide revisions', () => {
    expect(questGuideTravelFor('Unknown quest', 'v1')).toBeUndefined();
    for (const guide of questWalkthroughCatalogue) {
      expect(questGuideTravelFor(guide.questId, `${guide.revision}-changed`)).toBeUndefined();
    }
  });

  it.each([
    ["Cook's Assistant", 'cooks-assistant:start-quest', '12850', 'NPC', 'Cook (Lumbridge)'],
    ["Cook's Assistant", 'cooks-assistant:take-pot', '12850', 'Spawn', 'Pot'],
    ["Cook's Assistant", 'cooks-assistant:milk-cow', '12851', 'Object', 'Dairy cow'],
    ["Cook's Assistant", 'cooks-assistant:take-egg', '12851', 'Spawn', 'Egg'],
    ["Cook's Assistant", 'cooks-assistant:pick-grain', '12595', 'Object', 'Wheat'],
    ["Cook's Assistant", 'cooks-assistant:make-flour', '12595', 'Object', 'Hopper'],
    ['Sheep Shearer', 'sheep-shearer:start-with-fred', '12595', 'NPC', 'Fred the Farmer'],
    ['Sheep Shearer', 'sheep-shearer:shear-wool', '12595', 'NPC', 'Sheep'],
    ['Sheep Shearer', 'sheep-shearer:spin-wool', '12850', 'Object', 'Spinning wheel'],
    ['The Restless Ghost', 'the-restless-ghost:start-with-aereck', '12850', 'NPC', 'Father Aereck'],
    ['The Restless Ghost', 'the-restless-ghost:get-amulet', '12593', 'NPC', 'Father Urhney'],
    ['The Restless Ghost', 'the-restless-ghost:talk-to-ghost', '12849', 'NPC', 'Restless ghost'],
    ['The Restless Ghost', 'the-restless-ghost:use-skull', '12849', 'Object', 'Coffin'],
    ['Rune Mysteries', 'rune-mysteries:start-with-duke', '12850', 'NPC', 'Duke Horacio'],
    ['Rune Mysteries', 'rune-mysteries:take-package-to-aubury', '12853', 'NPC', 'Aubury'],
    ['Imp Catcher', 'imp-catcher:get-black-bead', '12338', 'Monster', 'Imp'],
    ['Imp Catcher', 'imp-catcher:give-beads-to-mizgog', '12337', 'NPC', 'Wizard Mizgog'],
  ])('anchors %s / %s to its unique source entity section', (quest, action, chunk, field, entity) => {
    expect(uniqueEntitySection(chunk, field, entity)).toEqual([endpoint(quest, action).section]);
  });

  it('uses explicit entrance evidence for underground locations instead of an underground walking node', () => {
    expect(source.chunks['12950'].Spawn.Bucket).toBe(1);
    expect(source.chunks['12850'].Sections['1'].Connect['12950']).toBe(true);
    expect(endpoint("Cook's Assistant", 'cooks-assistant:take-bucket')).toMatchObject({
      section: '12850-1', note: expect.stringContaining('cellar'),
    });

    expect(source.chunks['12437'].NPC['Archmage Sedridor']).toBe(1);
    expect(source.chunks['12437'].Object.Altar).toBe(1);
    expect(source.chunks['12437'].Connect).toEqual({ '12337': true });
    expect(source.chunks['12337'].Sections['1'].Connect['12437']).toBe(true);
    for (const [quest, action] of [
      ['The Restless Ghost', 'the-restless-ghost:take-skull'],
      ['Rune Mysteries', 'rune-mysteries:take-talisman-to-sedridor'],
      ['Rune Mysteries', 'rune-mysteries:return-notes-to-sedridor'],
      ['Rune Mysteries', 'rune-mysteries:complete'],
    ]) {
      expect(endpoint(quest, action)).toMatchObject({
        section: '12337-1', note: expect.stringContaining('entrance'),
      });
    }
  });
});
