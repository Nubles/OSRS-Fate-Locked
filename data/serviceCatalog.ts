import identities from './serviceCatalog.json';
export type ServiceCategory = 'mobility' | 'merchants';
export type ServiceId = `${ServiceCategory}:${string}`;
export interface ServiceRecord { readonly id: ServiceId; readonly category: ServiceCategory; readonly name: string }
export const SERVICE_CATALOG = identities as readonly ServiceRecord[];
const byReference = new Map<string, ServiceId>();
for (const row of SERVICE_CATALOG) {
  if (!new RegExp(`^${row.category}:\\d{4}$`).test(row.id) || !row.name || byReference.has(row.id) || byReference.has(`${row.category}/${row.name}`)) throw new Error(`Invalid service identity: ${row.id}`);
  byReference.set(row.id, row.id); byReference.set(`${row.category}/${row.name}`, row.id);
}
export const serviceId = (category: ServiceCategory, reference: string): ServiceId | undefined => {
  const id = byReference.get(reference) ?? byReference.get(`${category}/${reference}`);
  return id?.startsWith(`${category}:`) ? id : undefined;
};
export const ownsService = (category: ServiceCategory, saved: readonly string[], reference: string): boolean => {
  const id = serviceId(category, reference);
  return !!id && saved.some(value => serviceId(category, value) === id);
};
