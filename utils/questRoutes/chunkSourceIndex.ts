import type { ItemSourceRecord } from '../../services/ChunkContentService';
import { compileSourceRequirements } from './accountRequirements';
import {
  chunkKey,
  type ChunkKey,
  type Coverage,
  type ExactItemSource,
  type ItemRef,
  type ItemSourceFamilyCoverage,
} from './model';

export type DirectSourceSearchClass = 'current' | 'advisory';

export interface ChunkSourceSnapshot {
  unlockedChunks: ReadonlySet<ChunkKey>;
  /** O(1) lookup into records pre-indexed by item and search class. */
  recordsForClass(
    itemName: string,
    searchClass: DirectSourceSearchClass,
  ): readonly ItemSourceRecord[];
  /** O(1) metadata lookup; callers must not inspect the record collection here. */
  hasKnownOutsideSources(itemName: string): boolean;
  sourceCoverage?(itemKey: string): ItemSourceFamilyCoverage;
}

export interface IndexedItemSources {
  currentSources: ExactItemSource[];
  knownOutsideSources: ExactItemSource[];
  hasKnownOutsideSources: boolean;
  directCoverage: Coverage;
  familyCoverage: ItemSourceFamilyCoverage;
  currentSearchIncomplete: boolean;
  advisorySearchIncomplete: boolean;
}

export interface DirectSourceIndexOptions {
  hasWorkCapacity?(searchClass: DirectSourceSearchClass): boolean;
  consumeInspectionWork?(searchClass: DirectSourceSearchClass): boolean;
  consumeWork?(searchClass: DirectSourceSearchClass): boolean;
  searchClasses?: readonly DirectSourceSearchClass[];
}

export const indexDirectItemSources = (
  item: ItemRef,
  snapshot: ChunkSourceSnapshot,
  options: DirectSourceIndexOptions = {},
): IndexedItemSources => {
  const familyCoverage = snapshot.sourceCoverage?.(item.key) ?? {
    direct: 'PARTIAL',
    transformation: 'PARTIAL',
  };
  const currentSources: ExactItemSource[] = [];
  const knownOutsideSources: ExactItemSource[] = [];
  let hasKnownOutsideSources = snapshot.hasKnownOutsideSources(item.name);
  let currentSearchIncomplete = false;
  let advisorySearchIncomplete = false;
  const searchClasses = options.searchClasses ?? ['current', 'advisory'];
  const hasWorkCapacity = (searchClass: DirectSourceSearchClass): boolean => (
    options.hasWorkCapacity?.(searchClass) ?? true
  );
  const consumeInspectionWork = (searchClass: DirectSourceSearchClass): boolean => (
    options.consumeInspectionWork?.(searchClass) ?? hasWorkCapacity(searchClass)
  );
  const recordsForClass = (
    searchClass: DirectSourceSearchClass,
  ): readonly ItemSourceRecord[] => {
    if (!hasWorkCapacity(searchClass)) {
      if (searchClass === 'current') currentSearchIncomplete = true;
      else advisorySearchIncomplete = true;
      return [];
    }
    return snapshot.recordsForClass(item.name, searchClass);
  };
  const mapRecord = (record: ItemSourceRecord, chunk: ChunkKey): ExactItemSource => (
    compileSourceRequirements({
      id: `${record.kind}:${record.hostName}:${record.cx},${record.cy}:${item.key}`,
      output: item,
      outputQuantity: 1,
      kind: record.kind === 'spawn' ? 'SPAWN' : record.kind === 'shop' ? 'SHOP' : 'DROP',
      label: record.hostName,
      hostName: record.hostName,
      chunk,
      rawRequirements: [...record.rawRequirements],
      gates: [],
      deterministic: record.kind !== 'monster',
      coverage: 'COMPLETE',
    })
  );

  if (searchClasses.includes('current')) {
    const records = recordsForClass('current');
    for (const record of records) {
      if (!consumeInspectionWork('current')) {
        currentSearchIncomplete = true;
        break;
      }
      const chunk = chunkKey(record.cx, record.cy);
      if (!snapshot.unlockedChunks.has(chunk)) {
        hasKnownOutsideSources = true;
        continue;
      }
      if (options.consumeWork && !options.consumeWork('current')) {
        currentSearchIncomplete = true;
        break;
      }
      currentSources.push(mapRecord(record, chunk));
    }
  }
  if (!currentSearchIncomplete && searchClasses.includes('advisory')) {
    const records = recordsForClass('advisory');
    for (const record of records) {
      if (!consumeInspectionWork('advisory')) {
        advisorySearchIncomplete = true;
        break;
      }
      const chunk = chunkKey(record.cx, record.cy);
      if (snapshot.unlockedChunks.has(chunk)) continue;
      hasKnownOutsideSources = true;
      if (options.consumeWork && !options.consumeWork('advisory')) {
        advisorySearchIncomplete = true;
        break;
      }
      knownOutsideSources.push(mapRecord(record, chunk));
    }
  }

  return {
    currentSources,
    knownOutsideSources,
    hasKnownOutsideSources,
    directCoverage: familyCoverage.direct,
    familyCoverage,
    currentSearchIncomplete,
    advisorySearchIncomplete,
  };
};
