import { MERCHANT_SERVICES } from '../data/merchantServices';
import type { EntityKind } from '../services/ChunkContentService';
import { chunkContentService } from '../services/ChunkContentService';
import { classifyShop, onlyShopSource } from './shopClassification';

export { classifyShop } from './shopClassification';

export interface CategoryShop {
  name: string;
  kind?: EntityKind;
  category?: string;
  stockStatus?: string;
  /** Items no other shop sells, which this shop's category therefore unlocks (owner call U2). */
  onlySource?: readonly string[];
  locations: { cx: number; cy: number }[];
}

/**
 * Every classified shop in Gielinor, grouped by merchant category.
 * Requires chunkContentService to be ready; returns null until it is.
 */
export function shopsByCategory(): Map<string, CategoryShop[]> | null {
  if (!chunkContentService.ready) return null;
  const out = new Map<string, CategoryShop[]>();
  for (const hit of chunkContentService.entitiesOfKind('shop')) {
    const category = classifyShop(hit.name);
    if (!category) continue;
    if (!out.has(category)) out.set(category, []);
    const onlySource = onlyShopSource(hit.name);
    out.get(category)!.push({
      name: hit.name, kind: 'shop', category, stockStatus: chunkContentService.shopInfo(hit.name)?.status,
      ...(onlySource.length ? { onlySource } : {}), locations: hit.locations,
    });
  }
  for (const hit of chunkContentService.entitiesOfKind('npc')) {
    const service = MERCHANT_SERVICES[hit.name]; if (!service) continue;
    if (!out.has(service.category)) out.set(service.category, []);
    out.get(service.category)!.push({ name: hit.name, kind: 'npc', category: service.category, stockStatus: 'service', locations: hit.locations });
  }
  for (const list of out.values()) list.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}
