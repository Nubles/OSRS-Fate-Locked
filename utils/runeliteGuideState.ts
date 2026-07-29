const GUIDE_QUERY_VALUE = 'runelite-guide';

const normalizeSearch = (search: string): string =>
  search.startsWith('?') ? search.slice(1) : search;

export const hasRuneliteGuideQuery = (search: string): boolean => {
  const params = new URLSearchParams(normalizeSearch(search));
  return params.get('open') === GUIDE_QUERY_VALUE;
};

export const removeRuneliteGuideQuery = (search: string): string => {
  const params = new URLSearchParams(normalizeSearch(search));
  if (params.get('open') !== GUIDE_QUERY_VALUE) return search;
  params.delete('open');
  const remaining = params.toString();
  return remaining ? `?${remaining}` : '';
};
