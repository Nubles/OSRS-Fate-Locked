import { describe, it, expect } from 'vitest';
import { buildMessages, parseToolResponse, buildSchema } from './webgpuBackend';
import { ALL_TOOLS } from '../tools';

describe('buildMessages', () => {
  it('lists every tool with its argument in the system prompt', () => {
    const [system, user] = buildMessages('where is coal', ALL_TOOLS);
    expect(system.role).toBe('system');
    for (const t of ALL_TOOLS) expect(system.content).toContain(t.name);
    expect(system.content).toMatch(/JSON only|Output JSON/i);
    expect(user).toEqual({ role: 'user', content: 'where is coal' });
  });
});

describe('buildSchema', () => {
  it('constrains tool to the real tool names plus "none"', () => {
    const schema = JSON.parse(buildSchema(ALL_TOOLS));
    const enumVals: string[] = schema.properties.tool.enum;
    for (const t of ALL_TOOLS) expect(enumVals).toContain(t.name);
    expect(enumVals).toContain('none');
    expect(schema.required).toEqual(['tool', 'arg']);
  });
});

describe('parseToolResponse', () => {
  it('extracts a valid tool call and maps arg to the tool’s arg key', () => {
    expect(parseToolResponse('{"tool":"where_to_find","arg":"coal"}', ALL_TOOLS))
      .toEqual([{ tool: 'where_to_find', args: { entity: 'coal' } }]);
    expect(parseToolResponse('{"tool":"go_to_place","arg":"Varrock"}', ALL_TOOLS))
      .toEqual([{ tool: 'go_to_place', args: { place: 'Varrock' } }]);
  });

  it('tolerates surrounding prose around the JSON', () => {
    expect(parseToolResponse('Sure! {"tool":"open_tab","arg":"journal"} hope that helps', ALL_TOOLS))
      .toEqual([{ tool: 'open_tab', args: { tab: 'journal' } }]);
  });

  it('returns nothing for {"tool":"none"}, unknown tools, or empty args', () => {
    expect(parseToolResponse('{"tool":"none"}', ALL_TOOLS)).toEqual([]);
    expect(parseToolResponse('{"tool":"launch_nukes","arg":"x"}', ALL_TOOLS)).toEqual([]);
    expect(parseToolResponse('{"tool":"where_to_find","arg":""}', ALL_TOOLS)).toEqual([]);
  });

  it('returns nothing for non-JSON / malformed output', () => {
    expect(parseToolResponse('I think you want coal', ALL_TOOLS)).toEqual([]);
    expect(parseToolResponse('{tool: broken', ALL_TOOLS)).toEqual([]);
  });
});
