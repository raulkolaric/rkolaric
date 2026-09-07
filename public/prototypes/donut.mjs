// Depth-tested torus samples, shared by all three previews.
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
