/**
 * Deepens the colours of the exported 3D models (public/models, pets included).
 *
 * osrscachereader's GLTFExporter turns the game's face colours into RGB at the
 * game's brightest setting (gamma 0.6) and stores them as a small palette PNG in
 * each .gltf. The 3D viewer then lights the model as well, so every model looked
 * washed out. This re-grades each palette to a darker brightness setting:
 * c' = c ^ (MODEL_BRIGHTNESS / 0.6), done once per file and marked in
 * asset.extras so running it again changes nothing.
 *
 *   node scripts/model-colours.mjs           # re-grade every model not yet done
 *   node scripts/model-colours.mjs --check   # fail if any model isn't re-graded
 *
 * scripts/export-models.mjs runs each new export through deepenModelColours.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';

/** The exporter's brightness (RuneLite's BRIGHTNESS_MAX). */
export const EXPORTED_BRIGHTNESS = 0.6;
/** The brightness the models are shown at: the game's second-darkest setting. */
export const MODEL_BRIGHTNESS = 0.8;

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
};

/** Decodes an 8-bit, non-interlaced RGBA PNG (what the exporter's canvas writes). */
export const decodeRgbaPng = (buf) => {
  if (!buf.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error('not a PNG');
  let width = 0, height = 0;
  const idat = [];
  for (let at = 8; at < buf.length;) {
    const len = buf.readUInt32BE(at);
    const type = buf.toString('ascii', at + 4, at + 8);
    const data = buf.subarray(at + 8, at + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const [depth, colourType, , , interlace] = data.subarray(8);
      if (depth !== 8 || colourType !== 6 || interlace !== 0) throw new Error('only 8-bit RGBA, non-interlaced PNGs');
    } else if (type === 'IDAT') idat.push(data);
    at += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? pixels[y * stride + x - 4] : 0;
      const b = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const c = x >= 4 && y > 0 ? pixels[(y - 1) * stride + x - 4] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      pixels[y * stride + x] = v & 0xff;
    }
  }
  return { width, height, pixels };
};

export const encodeRgbaPng = ({ width, height, pixels }) => {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([PNG_SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
};

/** One colour channel moved from the exported brightness to MODEL_BRIGHTNESS. */
export const deepenChannel = (c) => Math.round(255 * (c / 255) ** (MODEL_BRIGHTNESS / EXPORTED_BRIGHTNESS));

const deepenPng = (buf) => {
  const png = decodeRgbaPng(buf);
  for (let i = 0; i < png.pixels.length; i += 4) {
    for (let k = 0; k < 3; k++) png.pixels[i + k] = deepenChannel(png.pixels[i + k]);
  }
  return encodeRgbaPng(png);
};

const PNG_URI = 'data:image/png;base64,';

/** A .gltf's text with its palette re-graded; unchanged if it already was. */
export const deepenModelColours = (text) => {
  const g = JSON.parse(text);
  if (g.asset?.extras?.brightness === MODEL_BRIGHTNESS) return text;
  for (const image of g.images ?? []) {
    if (!image.uri?.startsWith(PNG_URI)) continue;
    image.uri = PNG_URI + deepenPng(Buffer.from(image.uri.slice(PNG_URI.length), 'base64')).toString('base64');
  }
  g.asset = { ...g.asset, extras: { ...g.asset?.extras, brightness: MODEL_BRIGHTNESS } };
  return JSON.stringify(g);
};

export const isDeepened = (text) => JSON.parse(text).asset?.extras?.brightness === MODEL_BRIGHTNESS;

const MODELS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'models');

export const modelFiles = (dir = MODELS_DIR) => readdirSync(dir, { recursive: true })
  .filter((f) => f.endsWith('.gltf'))
  .map((f) => path.join(dir, f));

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  let changed = 0;
  const stale = [];
  for (const file of modelFiles()) {
    const text = readFileSync(file, 'utf8');
    if (isDeepened(text)) continue;
    if (check) { stale.push(path.relative(MODELS_DIR, file)); continue; }
    writeFileSync(file, deepenModelColours(text));
    changed++;
  }
  if (check && stale.length) {
    console.error(`${stale.length} model(s) still have the exporter's washed-out colours. Run: node scripts/model-colours.mjs\n  ${stale.join('\n  ')}`);
    process.exit(1);
  }
  console.log(check ? 'Every model has its deepened colours.' : `Deepened the colours of ${changed} model(s).`);
}
