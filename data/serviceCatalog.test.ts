import { expect, it } from 'vitest';
import { MOBILITY_LIST, MERCHANTS_LIST } from './items';
import { ownsService, serviceId } from './serviceCatalog';
import { classifyShop } from '../utils/shopClassification';
import { mobilityFor } from '../utils/chunkMobility';

it('joins classified shops and transport networks to legacy saves using allocated IDs', () => {
  const category = classifyShop('Lumbridge General Store')!;
  expect(ownsService('merchants', [serviceId('merchants', category)!], category)).toBe(true);
  const network = mobilityFor('Spirit tree')!;
  expect(ownsService('mobility', [serviceId('mobility', network)!], network)).toBe(true);
  expect(ownsService('mobility', ['Unknown'], 'Unknown')).toBe(false);
  expect(serviceId('mobility', serviceId('merchants', category)!)).toBeUndefined();
});
it('keeps every service list registered and rejects prototype names as shops', () => {
  for (const name of MOBILITY_LIST) expect(serviceId('mobility', name)).toBeDefined();
  for (const name of MERCHANTS_LIST) expect(serviceId('merchants', name)).toBeDefined();
  expect(classifyShop('constructor')).toBeNull();
  expect(classifyShop('__proto__')).toBeNull();
});
