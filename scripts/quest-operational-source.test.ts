import { describe, expect, it } from 'vitest';
import { classifyQuestItems, questDetailFields } from './quest-operational-source.mjs';
describe('quest required-item source extraction', () => {
  it('keeps nested templates and OR alternatives together and excludes recommended fields', () => {
    const source = '{{Quest details|items=* [[Water rune]] or {{plink|Water staff}}\n** Only if using the water route\n* 25 [[bones]] (unnoted, multiple trips allowed)|recommended=* [[Shark]]}}';
    const result = classifyQuestItems(source);
    expect(result.status).toBe('required');
    expect(result.checks).toHaveLength(2);
    expect(result.checks[0].label).toContain('Water rune or Water staff; Only if using the water route');
    expect(JSON.stringify(result.checks)).not.toContain('Shark');
    expect(result.checks[1].label).toContain('multiple trips allowed');
  });
  it('excludes an embedded recommended section without removing mandatory supplies', () => {
    expect(classifyQuestItems("{{Quest details|items=* [[Egg]]\n'''Recommended:'''\n* [[Chronicle]]}}").checks).toEqual([{ label: 'Egg', supply: 'required' }]);
  });
  it('keeps acquisition conditions instead of requiring their skill when the item is owned', () => {
    const result = classifyQuestItems('{{Quest details|items=* [[Limestone]] or a [[pickaxe]] and {{SCP|Mining|10}}}}');
    expect(result.checks).toEqual([{ label: 'Limestone or a pickaxe and 10 Mining', supply: 'required' }]);
  });
  it('distinguishes explicitly empty supplies, missing evidence and quest-obtainable supplies', () => {
    expect(classifyQuestItems('{{Quest details|items=None}}').status).toBe('none');
    expect(classifyQuestItems('{{Quest details|recommended=Food}}').status).toBe('unknown');
    expect(classifyQuestItems('{{Quest details|items=All items obtainable during quest:\n* [[Hammer]]}}').status).toBe('quest-provided');
    expect(classifyQuestItems('{{Quest details|items={{unrecognized|value}}}}').status).toBe('unknown');
  });
  it('never interprets a truncated nested field as complete evidence', () => {
    expect(questDetailFields('{{Quest details|items={{plink|Hammer}}')).toBeNull();
  });
});
