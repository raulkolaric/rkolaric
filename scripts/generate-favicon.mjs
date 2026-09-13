// Depth-tested torus samples from the approved Pixels prototype.
export function donut(angle, size = 16) {
  const depth = new Float64Array(size * size);
  const light = new Float64Array(size * size).fill(-1);
  const a = 1.3 + angle, b = angle;
  const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
  for (let t = 0; t < Math.PI * 2; t += 0.07) {
    for (let p = 0; p < Math.PI * 2; p += 0.035) {
      const ct = Math.cos(t), st = Math.sin(t), cp = Math.cos(p), sp = Math.sin(p);
      const r = 2 + ct;
      const x = r * (cb * cp + sa * sb * sp) - st * ca * sb;
      const y = r * (sb * cp - sa * cb * sp) + st * ca * cb;
      const z = 1 / (7 + ca * r * sp + st * sa);
      const px = Math.floor(size / 2 + size * 0.95 * z * x);
      const py = Math.floor(size / 2 - size * 0.95 * z * y);
      const i = py * size + px;
      if (px < 0 || px >= size || py < 0 || py >= size || z <= depth[i]) continue;
      depth[i] = z;
      const luminance = cp * ct * sb - ca * ct * sp - sa * st + cb * (ca * st - ct * sa * sp);
      light[i] = Math.max(0.15, Math.min(1, luminance / Math.sqrt(2)));
    }
  }
  return light;
}

// Use the image encoder already installed with Next.js; run with node scripts/generate-favicon.mjs.
import sharp from 'sharp';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
assert.equal(donut(0)[136], -1, 'The static frame must have a visible hole');
assert.notDeepEqual(donut(0), donut(Math.PI / 2));
assert.deepEqual(donut(0).map(v => v.toFixed(6)), donut(Math.PI * 2).map(v => v.toFixed(6)));
const samples = donut(0);
const rgba = Buffer.alloc(64 * 64 * 4);
for (let y = 0; y < 64; y++) {
  for (let x = 0; x < 64; x++) {
    const value = samples[Math.floor(y / 4) * 16 + Math.floor(x / 4)];
    if (value < 0) continue;
    assert(value >= 0.15 && value <= 1);
    const offset = (y * 64 + x) * 4;
    // Match the landing page dark-theme accent (#22c55e), preserving shading.
    const brightness = (70 + value * 185) / 255;
    rgba[offset] = Math.round(34 * brightness);
    rgba[offset + 1] = Math.round(197 * brightness);
    rgba[offset + 2] = Math.round(94 * brightness);
    rgba[offset + 3] = 255;
  }
}
const png = await sharp(rgba, { raw: { width: 64, height: 64, channels: 4 } })
  .png({ palette: true, colours: 16, compressionLevel: 9, effort: 10 })
  .toBuffer();
await writeFile(new URL('../public/favicon.png', import.meta.url), png);
console.log('Generated optimized static favicon; geometry and shading checks passed.');
