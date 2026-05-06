// Generate two solid-color PNG icons for the PWA manifest.
// Pure Node, zero deps. Personal-use placeholder — the brand mark can come later.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '..', 'public');
mkdirSync(outDir, { recursive: true });

// Brand color matching --primary in styles.css
const COLOR = { r: 0x1d, g: 0x35, b: 0x57 };
const ACCENT = { r: 0xff, g: 0xff, b: 0xff };

function crc32(buf) {
  let c;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = (table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)) >>> 0;
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function makePng(size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Solid background, with a thick centered "L" stroke in white. Coarse pixel art.
  const pad = Math.round(size * 0.22);
  const stroke = Math.round(size * 0.12);
  const lLeft = pad;
  const lRight = lLeft + stroke;
  const lTop = pad;
  const lBottom = size - pad;
  const hRight = size - pad;

  const raw = Buffer.alloc(size * (1 + size * 3));
  let off = 0;
  for (let y = 0; y < size; y++) {
    raw[off++] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const inVertical = x >= lLeft && x < lRight && y >= lTop && y < lBottom;
      const inHorizontal = y >= lBottom - stroke && y < lBottom && x >= lLeft && x < hRight;
      const c = inVertical || inHorizontal ? ACCENT : COLOR;
      raw[off++] = c.r;
      raw[off++] = c.g;
      raw[off++] = c.b;
    }
  }
  const idat = deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  const path = resolve(outDir, `icon-${size}.png`);
  writeFileSync(path, makePng(size));
  console.log(`wrote ${path}`);
}
