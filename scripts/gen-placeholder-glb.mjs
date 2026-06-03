// Generates public/models/placeholder.glb — a small shaded gold cube used purely
// to demonstrate the 3D entity pipeline. This is our own trivial geometry, NOT a
// game asset. Run: node scripts/gen-placeholder-glb.mjs
import { writeFileSync, mkdirSync } from 'node:fs';

// Six faces, each 4 verts with an outward normal; 2 triangles per face.
const faces = [
  { n: [1, 0, 0], v: [[1, -1, 1], [1, 1, 1], [1, 1, -1], [1, -1, -1]] },   // +X
  { n: [-1, 0, 0], v: [[-1, -1, -1], [-1, 1, -1], [-1, 1, 1], [-1, -1, 1]] }, // -X
  { n: [0, 1, 0], v: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]] },   // +Y
  { n: [0, -1, 0], v: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] }, // -Y
  { n: [0, 0, 1], v: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },   // +Z
  { n: [0, 0, -1], v: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] }, // -Z
];

const positions = [], normals = [], indices = [];
faces.forEach((f, fi) => {
  const base = fi * 4;
  f.v.forEach((p) => { positions.push(...p); normals.push(...f.n); });
  indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
});

const posF = new Float32Array(positions);
const normF = new Float32Array(normals);
const idxU = new Uint16Array(indices);

const pad4 = (n) => (n + 3) & ~3;
const idxBytes = pad4(idxU.byteLength);
const posBytes = posF.byteLength;
const normBytes = normF.byteLength;
const binLen = idxBytes + posBytes + normBytes;
const bin = new Uint8Array(binLen);
bin.set(new Uint8Array(idxU.buffer), 0);
bin.set(new Uint8Array(posF.buffer), idxBytes);
bin.set(new Uint8Array(normF.buffer), idxBytes + posBytes);

const min = [-1, -1, -1], max = [1, 1, 1];
const gltf = {
  asset: { version: '2.0', generator: 'fate-locked placeholder' },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0 }],
  meshes: [{ primitives: [{ attributes: { POSITION: 1, NORMAL: 2 }, indices: 0, material: 0 }] }],
  materials: [{ name: 'gold', pbrMetallicRoughness: { baseColorFactor: [0.85, 0.65, 0.13, 1], metallicFactor: 0.9, roughnessFactor: 0.35 }, doubleSided: true }],
  buffers: [{ byteLength: binLen }],
  bufferViews: [
    { buffer: 0, byteOffset: 0, byteLength: idxU.byteLength, target: 34963 },
    { buffer: 0, byteOffset: idxBytes, byteLength: posBytes, target: 34962 },
    { buffer: 0, byteOffset: idxBytes + posBytes, byteLength: normBytes, target: 34962 },
  ],
  accessors: [
    { bufferView: 0, componentType: 5123, count: idxU.length, type: 'SCALAR' },
    { bufferView: 1, componentType: 5126, count: posF.length / 3, type: 'VEC3', min, max },
    { bufferView: 2, componentType: 5126, count: normF.length / 3, type: 'VEC3' },
  ],
};

const enc = new TextEncoder();
let jsonBytes = enc.encode(JSON.stringify(gltf));
const jsonPad = pad4(jsonBytes.length) - jsonBytes.length;
if (jsonPad) { const t = new Uint8Array(jsonBytes.length + jsonPad).fill(0x20); t.set(jsonBytes); jsonBytes = t; }

const total = 12 + 8 + jsonBytes.length + 8 + bin.length;
const buf = new Uint8Array(total);
const dv = new DataView(buf.buffer);
let o = 0;
dv.setUint32(o, 0x46546c67, true); o += 4; // 'glTF'
dv.setUint32(o, 2, true); o += 4;
dv.setUint32(o, total, true); o += 4;
dv.setUint32(o, jsonBytes.length, true); o += 4;
dv.setUint32(o, 0x4e4f534a, true); o += 4; // 'JSON'
buf.set(jsonBytes, o); o += jsonBytes.length;
dv.setUint32(o, bin.length, true); o += 4;
dv.setUint32(o, 0x004e4942, true); o += 4; // 'BIN\0'
buf.set(bin, o);

mkdirSync('public/models', { recursive: true });
writeFileSync('public/models/placeholder.glb', buf);
console.log(`wrote public/models/placeholder.glb (${total} bytes)`);
