// A saved star feed override can still point at a workers.dev subdomain that
// was retired when the proxy moved. The retired subdomain is kept as a hash so
// the old account name stays out of the source.
export const RETIRED_FEED_HOST_HASH = 1722808074;

/** djb2 over the characters, wrapped to a signed 32-bit integer. */
export const hostHash = (s: string): number => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return h;
};

/**
 * True when `url` points at a worker under the retired workers.dev subdomain.
 * Any other workers.dev address (a player's own proxy, the current default)
 * is left alone.
 */
export const pointsAtRetiredFeed = (url: string, retired: number = RETIRED_FEED_HOST_HASH): boolean => {
  const labels = /\.([a-z0-9-]+)\.workers\.dev/gi;
  for (let m = labels.exec(url); m; m = labels.exec(url)) {
    if (hostHash(m[1].toLowerCase()) === retired) return true;
  }
  return false;
};
