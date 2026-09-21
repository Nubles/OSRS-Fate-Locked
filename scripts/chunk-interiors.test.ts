import { describe, expect, it } from 'vitest';
import { buildInteriorContent, validateInteriorAccessPolicy } from './chunk-interiors.mjs';

const encode = (blob: { Object?: Record<string, number> }) =>
  blob.Object ? { o: Object.entries(blob.Object) } : {};

describe('reviewed interior entrances', () => {
  it('retains a direct entrance when an earlier indirect route points to the same chunk', () => {
    const data = {
      walkableChunks: ['1000'],
      chunks: {
        1000: {},
        500: { Name: 'Headquarters', Object: { Chest: 1 }, Connect: { 501: true, 1000: true } },
        501: { Name: 'Tunnel', Object: { Rock: 1 } },
      },
    };
    const result = buildInteriorContent(data, null, encode, {
      locations: { Tunnel: { anchors: ['1000'], requirements: ['Restricted tunnel'] } },
    });
    expect(result['500'].entrances).toEqual([{ chunkId: '1000', requirements: [], via: ['500'] }]);
  });

  it('applies common dungeon gates to sections while retaining record-specific restrictions', () => {
    const result = buildInteriorContent({
      walkableChunks: ['256', '512'],
      chunks: {
        256: {}, 512: {},
        900: { Name: 'Cave#Section 1', Monster: { Dragon: 2 }, Object: { Altar: 1 } },
      },
    }, null, encode, {
      locations: { Cave: { anchors: ['256'], requirements: ['Started Example Quest'] } },
      records: { 900: { anchors: ['512'], requirements: ['Upper chamber'], entityRequirements: {
        monster: { Dragon: ['Current Slayer assignment: Dragon'] },
      } } },
    });
    expect(result['900'].entrances).toEqual([{
      chunkId: '512', requirements: ['Started Example Quest', 'Upper chamber'], via: ['900'],
    }]);
    expect(result['900'].requirements).toEqual({ monster: { Dragon: ['Current Slayer assignment: Dragon'] } });
  });

  it('keeps the requirements of independent entrances separate', () => {
    const result = buildInteriorContent({
      walkableChunks: ['256', '512'],
      chunks: { 256: {}, 512: {}, 900: { Name: 'Cave', Object: { Altar: 1 } } },
    }, null, encode, { locations: { Cave: {
      requirements: ['Common quest'], entrances: [
        { chunkId: '256', requirements: ['Northern door'] },
        { chunkId: '512', requirements: ['Southern fee'] },
      ],
    } } });
    expect(result['900'].entrances.map(route => route.requirements))
      .toEqual([['Common quest', 'Northern door'], ['Common quest', 'Southern fee']]);
  });

  it('rejects unowned coordinates and mis-pinned evidence', () => {
    const data = { walkableChunks: ['256'], chunks: { 256: {}, Cave: {} } };
    expect(() => validateInteriorAccessPolicy(data, { locations: { Cave: { anchors: ['999'] } } }))
      .toThrow('Invalid interior entrance');
    expect(() => validateInteriorAccessPolicy(data, { locations: { Cave: {
      anchors: ['256'], coordinates: [{ x: 128, y: 0 }],
    } } })).toThrow('coordinate disagrees');
    expect(() => validateInteriorAccessPolicy(data, { locations: {}, records: { 900: {} } }))
      .toThrow('Unknown interior policy');
  });
});
