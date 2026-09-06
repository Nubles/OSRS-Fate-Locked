import fs from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

// The large upstream evidence stays offline: this test reads it, never the app bundle.
const raw = JSON.parse(gunzipSync(fs.readFileSync(new URL('../../data/sources/runeproof-helper-graph.json.gz', import.meta.url))).toString('utf8'));
type Node = { id: string; type: string; kind: string; fields: Record<string, unknown>; conditionalEdges?: { ordered: boolean; entries: { key: unknown; value: unknown }[] } };
type Graph = { helperEnum: string; accountProfile: string; status: string; profileDependent: boolean; nodes: Node[]; panels: unknown[]; roots: unknown[]; diagnostics: string[] };
const primary: Graph[] = raw.helperGraphs;
const variants: Graph[] = raw.profileVariants;
function walk(value: unknown, visit: (value: Record<string, unknown>) => void): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach(child => walk(child, visit)); return; }
  visit(value as Record<string, unknown>);
  Object.values(value).forEach(child => walk(child, visit));
}

describe('pinned Quest Helper evidence export contract', () => {
  it('round-trips both compressed evidence files to their original exact SHA-256 bytes', () => {
    const manifest = JSON.parse(fs.readFileSync(new URL('./compression-integrity.json', import.meta.url), 'utf8'));
    for (const [name, expected] of Object.entries(manifest) as [string, { uncompressedSha256: string; uncompressedBytes: number }][]) {
      const bytes = gunzipSync(fs.readFileSync(new URL(`../../data/sources/${name}.gz`, import.meta.url)));
      expect(bytes.length).toBe(expected.uncompressedBytes);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(expected.uncompressedSha256);
      expect(gzipSync(bytes, { level: 9 }).equals(gzipSync(bytes, { level: 9 }))).toBe(true);
    }
  });
  it('accounts for every catalogue entry and every mapped helper without inventing missing sources', () => {
    expect(raw.formatVersion).toBe(1);
    expect(raw.helperRevision).toBe('633ab56e2eb3eb363f21da3fd75f6f2bc0fa073a');
    expect(raw.runeLiteVersion).toBe('1.12.38');
    expect(raw.catalog).toHaveLength(210);
    expect(new Set(raw.catalog.map((entry: { id: string }) => entry.id)).size).toBe(210);
    expect(raw.catalog.filter((entry: { helpers: unknown[] }) => !entry.helpers.length).map((entry: { id: string }) => entry.id).sort())
      .toEqual(['Into the Tombs', 'Learning the Ropes', 'The Frozen Door']);
    const mapped = raw.catalog.flatMap((entry: { helpers: { enum: string }[] }) => entry.helpers.map(helper => helper.enum));
    expect(mapped).toHaveLength(208);
    expect(primary.map(graph => graph.helperEnum).sort()).toEqual(mapped.sort());
    expect(primary.every(graph => graph.status === 'exported-evidence')).toBe(true);
  });

  it('records all Ironman graphs and all three source-dependent normal variants explicitly', () => {
    expect(primary).toHaveLength(208);
    expect(primary.every(graph => graph.accountProfile === 'IRONMAN')).toBe(true);
    const profileDependent = ['MOURNINGS_END_PART_II', 'RECIPE_FOR_DISASTER_PIRATE_PETE', 'THE_FREMENNIK_ISLES'];
    expect(primary.filter(graph => graph.profileDependent).map(graph => graph.helperEnum).sort()).toEqual(profileDependent);
    expect(variants.map(graph => graph.helperEnum).sort()).toEqual(profileDependent);
    expect(variants.every(graph => graph.accountProfile === 'NORMAL' && graph.status === 'exported-evidence')).toBe(true);
    expect(primary.filter(graph => graph.diagnostics.some(message => message.startsWith('Client-state-dependent source:')))).toHaveLength(29);
    expect(raw.initializationProfile).toContain('mocked client and inventory');
    expect(raw.interpretation).toContain('Requirements are not evaluated');
    expect(raw.interpretation).toContain('Panel order is presentation, not dependency order');
  });

  it('preserves every graph reference, conditional edge and panel across all 211 profile exports', () => {
    const errors: string[] = [];
    for (const graph of [...primary, ...variants]) {
      const nodes = new Map(graph.nodes.map(node => [node.id, node]));
      if (nodes.size !== graph.nodes.length) errors.push(`${graph.helperEnum}: duplicate node`);
      walk(graph, value => {
        if ('$ref' in value && !nodes.has(String(value.$ref))) errors.push(`${graph.helperEnum}: missing ${value.$ref}`);
      });
      if (!graph.panels.length) errors.push(`${graph.helperEnum}: no presentation panels`);
      for (const node of graph.nodes) {
        if (!node.conditionalEdges) continue;
        const edges = node.conditionalEdges.entries;
        if (edges.filter(edge => edge.key === null).length > 1) errors.push(`${graph.helperEnum}/${node.id}: multiple defaults`);
        for (const edge of edges) {
          const child = nodes.get((edge.value as { $ref?: string })?.$ref ?? '');
          if (child?.kind !== 'step') errors.push(`${graph.helperEnum}/${node.id}: invalid branch step`);
        }
      }
    }
    expect(errors).toEqual([]);
  });

  it('retains instructions and explicit limitations while omitting only named runtime caches', () => {
    const nodes = primary.flatMap(graph => graph.nodes);
    expect(nodes.filter(node => node.kind === 'step')).toHaveLength(13153);
    expect(nodes.filter(node => node.kind === 'requirement')).toHaveLength(26965);
    expect(nodes.some(node => Object.hasOwn(node.fields, 'QuestStep.text'))).toBe(true);
    expect(nodes.some(node => Object.hasOwn(node.fields, 'ItemRequirement.quantity'))).toBe(true);
    expect(nodes.some(node => Object.keys(node.fields).some(key => key.endsWith('.knownContainerStates')))).toBe(false);
    expect(primary.filter(graph => !graph.roots.length).map(graph => graph.helperEnum).sort())
      .toEqual(['ALFRED_GRIMHANDS_BARCRAWL', 'ELEMENTAL_WORKSHOP_I']);
    const exporter = fs.readFileSync(new URL('./RuneProofExportTest.java', import.meta.url), 'utf8');
    expect(exporter).not.toMatch(/\.check\s*\(\s*client\s*\)/);
  });
});
