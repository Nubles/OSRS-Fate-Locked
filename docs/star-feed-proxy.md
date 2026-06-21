# Live shooting-star feed proxy

The map's **Live stars** toggle (World tab → Overlays panel) glows the sites that
currently have an active shooting star, with world / size / landing-time on
hover. The data is crowdsourced by [starminers](https://map.starminers.site),
whose `/data2` endpoint sends **no CORS header**, so a browser on
`*.github.io` can't read it directly.

You host a tiny proxy once that re-serves the feed with CORS. A free Cloudflare
Worker is ~12 lines:

## Cloudflare Worker

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Worker**.
2. Replace the code with:

```js
export default {
  async fetch() {
    const upstream = 'https://map.starminers.site/data2?timestamp=' + Date.now();
    const r = await fetch(upstream, { headers: { 'User-Agent': 'fate-locked star proxy' }, cf: { cacheTtl: 30 } });
    return new Response(r.body, {
      status: r.status,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'access-control-allow-origin': '*',
        'cache-control': 'public, max-age=30',
      },
    });
  },
};
```

3. **Deploy**. You'll get a URL like `https://star-proxy.<you>.workers.dev`.

## Point the app at it

Either is fine:

- **Per browser (no rebuild):** open the app, World tab → Overlays → **Live
  stars**. On first enable it prompts for the URL; paste your Worker URL. It's
  saved in `localStorage` (`fate_star_feed`).
- **Baked into the build:** set `VITE_STAR_FEED=https://star-proxy.<you>.workers.dev`
  in the deploy environment before `vite build`.

The app appends a cache-busting query param and polls every 60s while the layer
is on. Use the **world** box to narrow to a single world (e.g. your home world) —
then typically only the star(s) on that world glow.

> This depends on a third-party crowdsourced feed; if starminers changes its
> endpoint or format, the layer degrades gracefully (shows a feed-error note and
> the rest of the map keeps working). The static site→coordinate map lives in
> `public/star-sites.json`.
