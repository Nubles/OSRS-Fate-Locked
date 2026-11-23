
import { DropSource } from '../types';

export interface DiaryTier {
  id: string; // e.g. "Ardougne Easy"
  region: string;
  tier: 'Easy' | 'Medium' | 'Hard' | 'Elite';
  difficulty: DropSource;
}

/** The four diary tiers, easiest first, as the game lists them. */
export const DIARY_TIER_ORDER: readonly DiaryTier['tier'][] = ['Easy', 'Medium', 'Hard', 'Elite'];

/** A tier's place in DIARY_TIER_ORDER (Easy 0 … Elite 3). */
export const diaryTierRank = (tier: DiaryTier['tier']): number => DIARY_TIER_ORDER.indexOf(tier);

/** The diary's own area, the id without its tier ("Ardougne" for "Ardougne Easy"). */
export const diaryAreaOf = (id: string): string => id.replace(/ (Easy|Medium|Hard|Elite)$/, '');

/** By diary area, then Easy, Medium, Hard, Elite (not alphabetical, which puts Elite second). */
export const compareDiaryTiers = (
  a: Pick<DiaryTier, 'id' | 'tier'>,
  b: Pick<DiaryTier, 'id' | 'tier'>,
): number => diaryAreaOf(a.id).localeCompare(diaryAreaOf(b.id)) || diaryTierRank(a.tier) - diaryTierRank(b.tier);

export const DIARY_DATA: Record<string, DiaryTier> = {
  // --- ARDOUGNE ---
  'Ardougne Easy': {
    id: 'Ardougne Easy', region: 'Kandarin', tier: 'Easy', difficulty: DropSource.DIARY_EASY
  },
  'Ardougne Medium': {
    id: 'Ardougne Medium', region: 'Kandarin', tier: 'Medium', difficulty: DropSource.DIARY_MEDIUM
  },
  'Ardougne Hard': {
    id: 'Ardougne Hard', region: 'Kandarin', tier: 'Hard', difficulty: DropSource.DIARY_HARD
  },
  'Ardougne Elite': {
    id: 'Ardougne Elite', region: 'Kandarin', tier: 'Elite', difficulty: DropSource.DIARY_ELITE
  },
  // --- DESERT ---
  'Desert Easy': {
    id: 'Desert Easy', region: 'Kharidian Desert', tier: 'Easy', difficulty: DropSource.DIARY_EASY
  },
  'Desert Medium': {
    id: 'Desert Medium', region: 'Kharidian Desert', tier: 'Medium', difficulty: DropSource.DIARY_MEDIUM
  },
  'Desert Hard': {
    id: 'Desert Hard', region: 'Kharidian Desert', tier: 'Hard', difficulty: DropSource.DIARY_HARD
  },
  'Desert Elite': {
    id: 'Desert Elite', region: 'Kharidian Desert', tier: 'Elite', difficulty: DropSource.DIARY_ELITE
  },
  // --- FALADOR ---
  'Falador Easy': {
    id: 'Falador Easy', region: 'Asgarnia', tier: 'Easy', difficulty: DropSource.DIARY_EASY
  },
  'Falador Medium': {
    id: 'Falador Medium', region: 'Asgarnia', tier: 'Medium', difficulty: DropSource.DIARY_MEDIUM
  },
  'Falador Hard': {
    id: 'Falador Hard', region: 'Asgarnia', tier: 'Hard', difficulty: DropSource.DIARY_HARD
  },
  'Falador Elite': {
    id: 'Falador Elite', region: 'Asgarnia', tier: 'Elite', difficulty: DropSource.DIARY_ELITE
  },
  // --- FREMENNIK ---
  'Fremennik Easy': {
    id: 'Fremennik Easy', region: 'Fremennik', tier: 'Easy', difficulty: DropSource.DIARY_EASY
  },
  'Fremennik Medium': {
    id: 'Fremennik Medium', region: 'Fremennik', tier: 'Medium', difficulty: DropSource.DIARY_MEDIUM
  },
  'Fremennik Hard': {
    id: 'Fremennik Hard', region: 'Fremennik', tier: 'Hard', difficulty: DropSource.DIARY_HARD
  },
  'Fremennik Elite': {
    id: 'Fremennik Elite', region: 'Fremennik', tier: 'Elite', difficulty: DropSource.DIARY_ELITE
  },
  // --- KANDARIN ---
  'Kandarin Easy': {
    id: 'Kandarin Easy', region: 'Kandarin', tier: 'Easy', difficulty: DropSource.DIARY_EASY
  },
  'Kandarin Medium': {
    id: 'Kandarin Medium', region: 'Kandarin', tier: 'Medium', difficulty: DropSource.DIARY_MEDIUM
  },
  'Kandarin Hard': {
    id: 'Kandarin Hard', region: 'Kandarin', tier: 'Hard', difficulty: DropSource.DIARY_HARD
  },
  'Kandarin Elite': {
    id: 'Kandarin Elite', region: 'Kandarin', tier: 'Elite', difficulty: DropSource.DIARY_ELITE
  },
  // --- KARAMJA ---
  'Karamja Easy': {
    id: 'Karamja Easy', region: 'Karamja', tier: 'Easy', difficulty: DropSource.DIARY_EASY
  },
  'Karamja Medium': {
    id: 'Karamja Medium', region: 'Karamja', tier: 'Medium', difficulty: DropSource.DIARY_MEDIUM
  },
  'Karamja Hard': {
    id: 'Karamja Hard', region: 'Karamja', tier: 'Hard', difficulty: DropSource.DIARY_HARD
  },
  'Karamja Elite': {
    id: 'Karamja Elite', region: 'Karamja', tier: 'Elite', difficulty: DropSource.DIARY_ELITE
  },
  // --- KOUREND ---
  'Kourend Easy': {
    id: 'Kourend Easy', region: 'Kourend & Kebos', tier: 'Easy', difficulty: DropSource.DIARY_EASY
  },
  'Kourend Medium': {
    id: 'Kourend Medium', region: 'Kourend & Kebos', tier: 'Medium', difficulty: DropSource.DIARY_MEDIUM
  },
  'Kourend Hard': {
    id: 'Kourend Hard', region: 'Kourend & Kebos', tier: 'Hard', difficulty: DropSource.DIARY_HARD
  },
  'Kourend Elite': {
    id: 'Kourend Elite', region: 'Kourend & Kebos', tier: 'Elite', difficulty: DropSource.DIARY_ELITE
  },
  // --- LUMBRIDGE ---
  'Lumbridge Easy': {
    id: 'Lumbridge Easy', region: 'Misthalin', tier: 'Easy', difficulty: DropSource.DIARY_EASY
  },
  'Lumbridge Medium': {
    id: 'Lumbridge Medium', region: 'Misthalin', tier: 'Medium', difficulty: DropSource.DIARY_MEDIUM
  },
  'Lumbridge Hard': {
    id: 'Lumbridge Hard', region: 'Misthalin', tier: 'Hard', difficulty: DropSource.DIARY_HARD
  },
  'Lumbridge Elite': {
    id: 'Lumbridge Elite', region: 'Misthalin', tier: 'Elite', difficulty: DropSource.DIARY_ELITE
  },
  // --- MORYTANIA ---
  'Morytania Easy': {
    id: 'Morytania Easy', region: 'Morytania', tier: 'Easy', difficulty: DropSource.DIARY_EASY
  },
  'Morytania Medium': {
    id: 'Morytania Medium', region: 'Morytania', tier: 'Medium', difficulty: DropSource.DIARY_MEDIUM
  },
  'Morytania Hard': {
    id: 'Morytania Hard', region: 'Morytania', tier: 'Hard', difficulty: DropSource.DIARY_HARD
  },
  'Morytania Elite': {
    id: 'Morytania Elite', region: 'Morytania', tier: 'Elite', difficulty: DropSource.DIARY_ELITE
  },
  // --- VARROCK ---
  'Varrock Easy': {
    id: 'Varrock Easy', region: 'Misthalin', tier: 'Easy', difficulty: DropSource.DIARY_EASY
  },
  'Varrock Medium': {
    id: 'Varrock Medium', region: 'Misthalin', tier: 'Medium', difficulty: DropSource.DIARY_MEDIUM
  },
  'Varrock Hard': {
    id: 'Varrock Hard', region: 'Misthalin', tier: 'Hard', difficulty: DropSource.DIARY_HARD
  },
  'Varrock Elite': {
    id: 'Varrock Elite', region: 'Misthalin', tier: 'Elite', difficulty: DropSource.DIARY_ELITE
  },
  // --- WESTERN PROVINCES ---
  'Western Easy': {
    id: 'Western Easy', region: 'Kandarin', tier: 'Easy', difficulty: DropSource.DIARY_EASY
  },
  'Western Medium': {
    id: 'Western Medium', region: 'Kandarin', tier: 'Medium', difficulty: DropSource.DIARY_MEDIUM
  },
  'Western Hard': {
    id: 'Western Hard', region: 'Kandarin', tier: 'Hard', difficulty: DropSource.DIARY_HARD
  },
  'Western Elite': {
    id: 'Western Elite', region: 'Kandarin', tier: 'Elite', difficulty: DropSource.DIARY_ELITE
  },
  // --- WILDERNESS ---
  'Wilderness Easy': {
    id: 'Wilderness Easy', region: 'Wilderness', tier: 'Easy', difficulty: DropSource.DIARY_EASY
  },
  'Wilderness Medium': {
    id: 'Wilderness Medium', region: 'Wilderness', tier: 'Medium', difficulty: DropSource.DIARY_MEDIUM
  },
  'Wilderness Hard': {
    id: 'Wilderness Hard', region: 'Wilderness', tier: 'Hard', difficulty: DropSource.DIARY_HARD
  },
  'Wilderness Elite': {
    id: 'Wilderness Elite', region: 'Wilderness', tier: 'Elite', difficulty: DropSource.DIARY_ELITE
  },
};