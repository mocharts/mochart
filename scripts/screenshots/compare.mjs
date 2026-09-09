#!/usr/bin/env node
// Diffs two screenshot capture directories produced by capture.mjs.
//
// Usage:
//   node scripts/screenshots/compare.mjs <dirA> <dirB> [options]
//   npm run screenshots:compare -- <dirA> <dirB> [options]
//
// Options:
//   --threshold <n>   per-channel delta that still counts as equal (default 0)
//   --diff-dir <dir>  write red-highlight diff PNGs for the files that differ
//   --quiet           only print differing files and the summary
//
// No image dependencies are installed in this repo (no pixelmatch / pngjs /
// sharp), and the brief says not to add any, so the PNG decoding below is done
// by hand against node's built-in zlib. Playwright writes 8-bit non-interlaced
// PNGs, which is what this supports (colour types 0/2/3/4/6, bit depth 8).

import { deflateSync, inflateSync } from 'node:zlib';
import { readdirSync, readFileSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

// ---------------------------------------------------------------------------
// minimal PNG codec
// ---------------------------------------------------------------------------

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const crcTable = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    c = crcTable[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) { return a; }
  return pb <= pc ? b : c;
}

/** Decodes a PNG buffer into { width, height, data } with data as RGBA bytes. */
function decodePng(buffer) {
  if (!buffer.subarray(0, 8).equals(pngSignature)) {
    throw new Error('not a PNG');
  }
  let offset = 8;
  let header = null;
  let palette = null;
  let transparency = null;
  const idat = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const start = offset + 8;
    if (type === 'IHDR') {
      header = {
        width: buffer.readUInt32BE(start),
        height: buffer.readUInt32BE(start + 4),
        bitDepth: buffer[start + 8],
        colorType: buffer[start + 9],
        interlace: buffer[start + 12]
      };
    }
    else if (type === 'PLTE') { palette = buffer.subarray(start, start + length); }
    else if (type === 'tRNS') { transparency = buffer.subarray(start, start + length); }
    else if (type === 'IDAT') { idat.push(buffer.subarray(start, start + length)); }
    else if (type === 'IEND') { break; }
    offset = start + length + 4;
  }

  if (header === null) { throw new Error('PNG has no IHDR'); }
  if (header.bitDepth !== 8) { throw new Error('unsupported PNG bit depth ' + header.bitDepth); }
  if (header.interlace !== 0) { throw new Error('interlaced PNGs are not supported'); }

  const channelCounts = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
  const channels = channelCounts[header.colorType];
  if (channels === undefined) { throw new Error('unsupported PNG colour type ' + header.colorType); }

  const { width, height } = header;
  const bytesPerPixel = channels;
  const stride = width * bytesPerPixel;
  const raw = inflateSync(Buffer.concat(idat));
  const pixels = Buffer.alloc(height * stride);

  // Undo the per-scanline filters (PNG spec section 9).
  let rawOffset = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[rawOffset++];
    const line = raw.subarray(rawOffset, rawOffset + stride);
    rawOffset += stride;
    const out = y * stride;
    const prior = out - stride;
    for (let x = 0; x < stride; x++) {
      const left = x >= bytesPerPixel ? pixels[out + x - bytesPerPixel] : 0;
      const up = y > 0 ? pixels[prior + x] : 0;
      const upLeft = (y > 0 && x >= bytesPerPixel) ? pixels[prior + x - bytesPerPixel] : 0;
      let value = line[x];
      if (filter === 1) { value += left; }
      else if (filter === 2) { value += up; }
      else if (filter === 3) { value += (left + up) >> 1; }
      else if (filter === 4) { value += paeth(left, up, upLeft); }
      else if (filter !== 0) { throw new Error('unknown PNG filter ' + filter); }
      pixels[out + x] = value & 0xff;
    }
  }

  // Normalize everything to RGBA so comparisons are uniform.
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0, count = width * height; i < count; i++) {
    const source = i * bytesPerPixel;
    const target = i * 4;
    if (header.colorType === 6) {
      pixels.copy(rgba, target, source, source + 4);
    }
    else if (header.colorType === 2) {
      pixels.copy(rgba, target, source, source + 3);
      rgba[target + 3] = 255;
    }
    else if (header.colorType === 0) {
      rgba[target] = rgba[target + 1] = rgba[target + 2] = pixels[source];
      rgba[target + 3] = 255;
    }
    else if (header.colorType === 4) {
      rgba[target] = rgba[target + 1] = rgba[target + 2] = pixels[source];
      rgba[target + 3] = pixels[source + 1];
    }
    else {
      const index = pixels[source];
      rgba[target] = palette[index * 3];
      rgba[target + 1] = palette[index * 3 + 1];
      rgba[target + 2] = palette[index * 3 + 2];
      rgba[target + 3] = transparency !== null && index < transparency.length ? transparency[index] : 255;
    }
  }

  return { width, height, data: rgba };
}

function chunk(type, body) {
  const out = Buffer.alloc(body.length + 12);
  out.writeUInt32BE(body.length, 0);
  out.write(type, 4, 'ascii');
  body.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + body.length)), 8 + body.length);
  return out;
}

function encodePng({ width, height, data }) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    pngSignature,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// ---------------------------------------------------------------------------
// comparison
// ---------------------------------------------------------------------------

function comparePngs(bufferA, bufferB, threshold, wantDiffImage) {
  if (bufferA.equals(bufferB)) {
    return { identical: true, differing: 0, total: 0, maxDelta: 0 };
  }
  const a = decodePng(bufferA);
  const b = decodePng(bufferB);
  if (a.width !== b.width || a.height !== b.height) {
    return {
      identical: false,
      sizeMismatch: `${a.width}x${a.height} vs ${b.width}x${b.height}`,
      differing: NaN, total: NaN, maxDelta: NaN
    };
  }

  const total = a.width * a.height;
  const diffImage = wantDiffImage ? Buffer.alloc(total * 4) : null;
  let differing = 0;
  let maxDelta = 0;
  let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;

  for (let i = 0; i < total; i++) {
    const p = i * 4;
    const dr = Math.abs(a.data[p] - b.data[p]);
    const dg = Math.abs(a.data[p + 1] - b.data[p + 1]);
    const db = Math.abs(a.data[p + 2] - b.data[p + 2]);
    const da = Math.abs(a.data[p + 3] - b.data[p + 3]);
    const delta = Math.max(dr, dg, db, da);
    const changed = delta > threshold;
    if (changed) {
      differing++;
      if (delta > maxDelta) { maxDelta = delta; }
      const x = i % a.width;
      const y = (i - x) / a.width;
      if (x < minX) { minX = x; }
      if (x > maxX) { maxX = x; }
      if (y < minY) { minY = y; }
      if (y > maxY) { maxY = y; }
    }
    if (diffImage !== null) {
      if (changed) {
        diffImage[p] = 255; diffImage[p + 1] = 0; diffImage[p + 2] = 0; diffImage[p + 3] = 255;
      }
      else {
        // Faded original, so the highlighted pixels stand out in context.
        const grey = Math.round((a.data[p] * 0.3 + a.data[p + 1] * 0.59 + a.data[p + 2] * 0.11));
        const faded = Math.round(255 - (255 - grey) * 0.25);
        diffImage[p] = diffImage[p + 1] = diffImage[p + 2] = faded;
        diffImage[p + 3] = 255;
      }
    }
  }

  return {
    identical: differing === 0,
    differing,
    total,
    maxDelta,
    box: maxX >= 0 ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 } : null,
    diffImage: diffImage !== null && differing > 0
      ? encodePng({ width: a.width, height: a.height, data: diffImage })
      : null
  };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function listPngs(dir) {
  return readdirSync(dir)
    .filter(name => name.endsWith('.png') && statSync(join(dir, name)).isFile())
    .sort();
}

function main() {
  const argv = process.argv.slice(2);
  const positional = [];
  let threshold = 0;
  let diffDir = null;
  let quiet = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--threshold') { threshold = Number(argv[++i]); }
    else if (arg === '--diff-dir') { diffDir = argv[++i]; }
    else if (arg === '--quiet') { quiet = true; }
    else if (arg.startsWith('--')) { throw new Error('unknown option: ' + arg); }
    else { positional.push(arg); }
  }
  if (positional.length !== 2) {
    console.error('usage: compare.mjs <dirA> <dirB> [--threshold n] [--diff-dir dir] [--quiet]');
    process.exitCode = 2;
    return;
  }

  const dirA = resolve(positional[0]);
  const dirB = resolve(positional[1]);
  if (diffDir !== null) { mkdirSync(resolve(diffDir), { recursive: true }); }

  const filesA = listPngs(dirA);
  const filesB = listPngs(dirB);
  const setB = new Set(filesB);
  const onlyA = filesA.filter(name => !setB.has(name));
  const setA = new Set(filesA);
  const onlyB = filesB.filter(name => !setA.has(name));
  const shared = filesA.filter(name => setB.has(name));

  let differed = 0;
  let identical = 0;
  let totalChangedPixels = 0;

  for (const name of shared) {
    const result = comparePngs(
      readFileSync(join(dirA, name)),
      readFileSync(join(dirB, name)),
      threshold,
      diffDir !== null
    );
    if (result.identical) {
      identical++;
      if (!quiet) { console.log('  same  ' + name); }
      continue;
    }
    differed++;
    if (result.sizeMismatch !== undefined) {
      console.log('  DIFF  ' + name + '  size mismatch ' + result.sizeMismatch);
      continue;
    }
    totalChangedPixels += result.differing;
    const percent = (result.differing / result.total * 100).toFixed(3);
    const box = result.box !== null
      ? `  box ${result.box.x},${result.box.y} ${result.box.width}x${result.box.height}`
      : '';
    console.log(`  DIFF  ${name}  ${result.differing} px (${percent}%)  maxDelta ${result.maxDelta}${box}`);
    if (diffDir !== null && result.diffImage !== null) {
      writeFileSync(join(resolve(diffDir), name), result.diffImage);
    }
  }

  for (const name of onlyA) { console.log('  ONLY-A ' + name); }
  for (const name of onlyB) { console.log('  ONLY-B ' + name); }

  console.log('');
  console.log(`compared ${shared.length} shared files: ${identical} identical, ${differed} different`
    + (differed > 0 ? ` (${totalChangedPixels} changed pixels total)` : ''));
  if (onlyA.length > 0 || onlyB.length > 0) {
    console.log(`only in A: ${onlyA.length}, only in B: ${onlyB.length}`);
  }
  if (diffDir !== null && differed > 0) {
    console.log('diff images written to ' + resolve(diffDir));
  }
  process.exitCode = differed > 0 || onlyA.length > 0 || onlyB.length > 0 ? 1 : 0;
}

main();
