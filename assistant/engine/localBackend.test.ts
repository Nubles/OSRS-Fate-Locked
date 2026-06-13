import { describe, it, expect } from 'vitest';
import { parseIntent } from './localBackend';

describe('parseIntent', () => {
  const one = (msg: string) => parseIntent(msg)[0];

  it('routes "where can I find X" to where_to_find', () => {
    expect(one('where can I find coal?')).toEqual({ tool: 'where_to_find', args: { entity: 'coal' } });
    expect(one('where can I mine runite ore')).toEqual({ tool: 'where_to_find', args: { entity: 'runite ore' } });
    expect(one('find a Yew tree')).toEqual({ tool: 'where_to_find', args: { entity: 'Yew tree' } });
  });

  it('routes "why is X locked" to why_quest_locked', () => {
    expect(one('why is Dragon Slayer II locked?')).toEqual({ tool: 'why_quest_locked', args: { quest: 'Dragon Slayer II' } });
    expect(one('what do I need for Monkey Madness')).toEqual({ tool: 'why_quest_locked', args: { quest: 'Monkey Madness' } });
  });

  it('routes "what can I do in X" to what_can_i_do_here', () => {
    expect(one('what can I do in Falador?')).toEqual({ tool: 'what_can_i_do_here', args: { place: 'Falador' } });
    expect(one("what's in Varrock")).toEqual({ tool: 'what_can_i_do_here', args: { place: 'Varrock' } });
  });

  it('routes navigation phrases', () => {
    expect(one('go to Varrock')).toEqual({ tool: 'go_to_place', args: { place: 'Varrock' } });
    expect(one('take me to Lumbridge')).toEqual({ tool: 'go_to_place', args: { place: 'Lumbridge' } });
    expect(one('open the Journal tab')).toEqual({ tool: 'open_tab', args: { tab: 'Journal' } });
  });

  it('returns no intent for unmatched chatter', () => {
    expect(parseIntent('hello there friend')).toEqual([]);
  });

  it('tolerates filler, politeness and varied phrasing', () => {
    expect(one('hey, can you tell me where I can find coal please?'))
      .toEqual({ tool: 'where_to_find', args: { entity: 'coal' } });
    expect(one("i want to find a yew tree"))
      .toEqual({ tool: 'where_to_find', args: { entity: 'yew tree' } });
    expect(one('how do I unlock Dragon Slayer II'))
      .toEqual({ tool: 'why_quest_locked', args: { quest: 'Dragon Slayer II' } });
    expect(one('please take me to Varrock'))
      .toEqual({ tool: 'go_to_place', args: { place: 'Varrock' } });
    expect(one('show me my quests tab'))
      .toEqual({ tool: 'open_tab', args: { tab: 'quests' } });
    expect(one('tell me about Falador'))
      .toEqual({ tool: 'what_can_i_do_here', args: { place: 'Falador' } });
    expect(one('nearest fishing spot'))
      .toEqual({ tool: 'where_to_find', args: { entity: 'fishing spot' } });
  });

  it('falls back to a known quest name mentioned anywhere', () => {
    // no command verb, just the quest name in a sentence
    expect(one('Dragon Slayer II'))
      .toEqual({ tool: 'why_quest_locked', args: { quest: 'Dragon Slayer II' } });
  });

  it('falls back to a known place name for casual phrasing', () => {
    expect(one("what about Lumbridge"))
      .toMatchObject({ tool: 'what_can_i_do_here' });
  });
});
