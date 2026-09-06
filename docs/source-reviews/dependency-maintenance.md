# Dependency security maintenance — 2026-09-05

The broad audit reported eight affected package entries. Compatible npm security updates were applied without lifecycle scripts, followed by a deliberate Vite 5.4.21 to7.3.6 upgrade. The existing @vitejs/plugin-react4.7 peer range explicitly supports7.x. The app's old compilation browser targets remain explicit; the upgrade does not silently adopt Vite7's newer default target. CI uses Node22; Vite requires20.19+ or22.12+, while the current test DOM runtime requires22.13+ on22.x.

References: [Vite7 migration](https://v7.vite.dev/guide/migration), [Vite Windows file-deny advisory](https://github.com/advisories/GHSA-fx2h-pf6j-xcff).

A fresh npm audit reports zero vulnerabilities. This is the registry's known-advisory result, not a proof of all application security. No forced upgrade was used. A clean scratch lock resolution was inspected for platform metadata; the reviewed repo lock retains compatible pinned versions rather than adopting unrelated newer packages from the scratch resolution. npm ci --dry-run --ignore-scripts succeeds. Linux optional esbuild/Rollup packages remain present.
