// Procedurally rasterizes the Recipe Gen icon (mirrors public/icon.svg) into PNGs.
// No dependencies: shapes are sampled into an RGBA buffer, PNG is encoded by hand.
// Usage: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public');

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const C = {
  bg: hex('#fffaf5'),
  halo: hex('#fde3d8'),
  steam: hex('#f0a089'),
  rice: hex('#ffffff'),
  bowl: hex('#e85d3a'),
  stripe: hex('#fdf0ea'),
  foot: hex('#c94a2a'),
};

// Returns the color at a point in the 512x512 design space (painter's order, topmost wins).
function colorAt(x, y) {
  // foot
  if (x >= 196 && x <= 316 && y >= 428 && y <= 454) {
    const r = 8;
    const cx = Math.min(Math.max(x, 196 + r), 316 - r);
    const cy = Math.min(Math.max(y, 428 + r), 454 - r);
    if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) return C.foot;
  }
  // bowl (lower half disc) with stripe
  if (y >= 280 && (x - 256) ** 2 + (y - 280) ** 2 <= 160 * 160) {
    if (y >= 326 && y <= 338 && x >= 120 && x <= 392) return C.stripe;
    return C.bowl;
  }
  // rice dome
  if (y <= 282 && ((x - 256) / 150) ** 2 + ((y - 282) / 66) ** 2 <= 1) return C.rice;
  // steam: three wavy strokes with round caps
  for (const sx of [196, 256, 316]) {
    if (steamHit(x, y, sx)) return C.steam;
  }
  // halo
  if ((x - 256) ** 2 + (y - 262) ** 2 <= 196 * 196) return C.halo;
  return C.bg;
}

const AMP = 9;
const PERIOD = 108;
const Y0 = 106;
const Y1 = 214;
const HALF = 9;
const waveX = (y, sx) => sx - AMP * Math.sin((2 * Math.PI * (Y1 - y)) / PERIOD);
function steamHit(x, y, sx) {
  if (y < Y0 - HALF || y > Y1 + HALF || Math.abs(x - sx) > AMP + HALF + 2) return false;
  // caps
  for (const cy of [Y0, Y1]) {
    if ((x - waveX(cy, sx)) ** 2 + (y - cy) ** 2 <= HALF * HALF) return true;
  }
  if (y < Y0 || y > Y1) return false;
  const slope = (AMP * 2 * Math.PI) / PERIOD * Math.cos((2 * Math.PI * (Y1 - y)) / PERIOD);
  return Math.abs(x - waveX(y, sx)) <= HALF * Math.sqrt(1 + slope * slope);
}

function render(size, ss = 4) {
  const buf = Buffer.alloc(size * size * 4);
  const scale = 512 / size;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const c = colorAt((px + (sx + 0.5) / ss) * scale, (py + (sy + 0.5) / ss) * scale);
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const n = ss * ss;
      const i = (py * size + px) * 4;
      buf[i] = Math.round(r / n);
      buf[i + 1] = Math.round(g / n);
      buf[i + 2] = Math.round(b / n);
      buf[i + 3] = 255;
    }
  }
  return buf;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(outDir, { recursive: true });
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  const file = join(outDir, name);
  writeFileSync(file, encodePNG(size, render(size)));
  console.log(`wrote ${file} (${size}x${size})`);
}
