"use client";

import { useEffect, useRef } from "react";

/*
 * Port of shapes.c — spinning, shaded ASCII 3D shapes.
 * Same engine (z-buffer + normal-based shading, auto-fit to the viewport).
 * One of the four shapes is chosen at random on each mount (page load).
 */

// ─── global look/motion knobs (from shapes.c) ──────────────────────────────
const K2 = 11.0; // viewer distance (perspective strength)
const FILL = 0.62; // fraction of viewport height the shape fills
const SAMPLE = 0.4; // target on-screen sample spacing, in cells
const BUDGET = 130000; // max surface samples per frame (caps CPU cost)
const DA = 0.03; // tilt speed per rendered frame
const DB = 0.02; // turn speed per rendered frame
const FRAME_MS = 33; // ~30 fps
const RAMP = ".,-~:;=!*#$@";
// directional light
const LX = 0.0;
const LY = 0.70710678;
const LZ = -0.70710678;

// ─── tiny 3D vector helpers ────────────────────────────────────────────────
type V3 = [number, number, number];

function dot3(a: V3, b: V3) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function cross3(a: V3, b: V3, r: V3) {
  r[0] = a[1] * b[2] - a[2] * b[1];
  r[1] = a[2] * b[0] - a[0] * b[2];
  r[2] = a[0] * b[1] - a[1] * b[0];
}
function norm3(a: V3) {
  return Math.sqrt(dot3(a, a));
}
function normalize3(a: V3) {
  const n = norm3(a);
  if (n > 1e-12) {
    a[0] /= n;
    a[1] /= n;
    a[2] /= n;
  }
}

type PointFn = (u: number, v: number, p: V3) => void;
type CurveFn = (t: number, c: V3) => void;
type RadFn = (t: number) => number;
type SurfFn = (u: number, v: number, P: V3, N: V3) => void;

// scratch buffers (avoid per-sample allocation)
const _p0: V3 = [0, 0, 0];
const _pu: V3 = [0, 0, 0];
const _pv: V3 = [0, 0, 0];
const _c: V3 = [0, 0, 0];
const _cp: V3 = [0, 0, 0];
const _cm: V3 = [0, 0, 0];
const _T: V3 = [0, 0, 0];
const _D2: V3 = [0, 0, 0];
const _Nn: V3 = [0, 0, 0];
const _B: V3 = [0, 0, 0];

// surface normal by finite differences — works for any smooth point fn
function numericNormal(pt: PointFn, u: number, v: number, N: V3) {
  const h = 1e-3;
  pt(u, v, _p0);
  pt(u + h, v, _pu);
  pt(u, v + h, _pv);
  const Tu: V3 = [_pu[0] - _p0[0], _pu[1] - _p0[1], _pu[2] - _p0[2]];
  const Tv: V3 = [_pv[0] - _p0[0], _pv[1] - _p0[1], _pv[2] - _p0[2]];
  cross3(Tu, Tv, N);
  normalize3(N);
}

// tube of radius rad(t) swept around a space curve crv(t)
function tubeSurf(
  crv: CurveFn,
  rad: RadFn,
  u: number,
  v: number,
  P: V3,
  N: V3
) {
  const h = 1e-3;
  crv(u, _c);
  crv(u + h, _cp);
  crv(u - h, _cm);
  for (let i = 0; i < 3; i++) {
    _T[i] = (_cp[i] - _cm[i]) / (2 * h);
    _D2[i] = (_cp[i] - 2 * _c[i] + _cm[i]) / (h * h);
  }
  normalize3(_T);
  const d = dot3(_D2, _T);
  for (let i = 0; i < 3; i++) _Nn[i] = _D2[i] - d * _T[i];
  if (norm3(_Nn) < 1e-6) {
    const up: V3 = [0, 0, 1];
    if (Math.abs(dot3(up, _T)) > 0.9) {
      up[0] = 1;
      up[1] = 0;
      up[2] = 0;
    }
    const du = dot3(up, _T);
    for (let i = 0; i < 3; i++) _Nn[i] = up[i] - du * _T[i];
  }
  normalize3(_Nn);
  cross3(_T, _Nn, _B);
  const a = rad(u);
  const cv = Math.cos(v);
  const sv = Math.sin(v);
  for (let i = 0; i < 3; i++) {
    const radial = cv * _Nn[i] + sv * _B[i];
    P[i] = _c[i] + a * radial;
    N[i] = radial;
  }
}

// ─── the shapes ────────────────────────────────────────────────────────────

// 1) trefoil knot
function curveTrefoil(t: number, c: V3) {
  const p = 2.0,
    q = 3.0,
    r = 2.0 + Math.cos(q * t);
  c[0] = r * Math.cos(p * t);
  c[1] = r * Math.sin(p * t);
  c[2] = -Math.sin(q * t);
}
const surfTrefoil: SurfFn = (u, v, P, N) =>
  tubeSurf(curveTrefoil, () => 0.5, u, v, P, N);

// 2) klein bottle (figure-8 immersion)
function kleinPoint(u: number, v: number, p: V3) {
  const r = 2.5,
    c2 = Math.cos(u / 2),
    s2 = Math.sin(u / 2);
  const sv = Math.sin(v),
    s2v = Math.sin(2 * v);
  const rad = r + c2 * sv - s2 * s2v;
  p[0] = rad * Math.cos(u);
  p[1] = rad * Math.sin(u);
  p[2] = s2 * sv + c2 * s2v;
}
const surfKlein: SurfFn = (u, v, P, N) => {
  kleinPoint(u, v, P);
  numericNormal(kleinPoint, u, v, N);
};

// 3) seashell (growing tube on a log spiral)
function curveShell(t: number, c: V3) {
  const g = Math.exp(0.05 * t);
  c[0] = g * Math.cos(t);
  c[1] = g * Math.sin(t);
  c[2] = -0.4 * g;
}
const surfShell: SurfFn = (u, v, P, N) =>
  tubeSurf(curveShell, (t) => 0.18 * Math.exp(0.05 * t), u, v, P, N);

// 4) twisted torus ("cruller")
function crullerPoint(u: number, v: number, p: V3) {
  const Rmaj = 2.5,
    ex = 0.8,
    ey = 0.35,
    twist = 4.0;
  const a = ex * Math.cos(v),
    b = ey * Math.sin(v),
    ang = twist * u;
  const la = a * Math.cos(ang) - b * Math.sin(ang);
  const lb = a * Math.sin(ang) + b * Math.cos(ang);
  p[0] = (Rmaj + la) * Math.cos(u);
  p[1] = (Rmaj + la) * Math.sin(u);
  p[2] = lb;
}
const surfCruller: SurfFn = (u, v, P, N) => {
  crullerPoint(u, v, P);
  numericNormal(crullerPoint, u, v, N);
};

interface Shape {
  name: string;
  umin: number;
  umax: number;
  vmin: number;
  vmax: number;
  extent: number;
  surf: SurfFn;
}

const SHAPES: Shape[] = [
  { name: "trefoil knot", umin: 0, umax: 2 * Math.PI, vmin: 0, vmax: 2 * Math.PI, extent: 3.7, surf: surfTrefoil },
  { name: "klein bottle", umin: 0, umax: 2 * Math.PI, vmin: 0, vmax: 2 * Math.PI, extent: 5.0, surf: surfKlein },
  { name: "seashell", umin: 0, umax: 10 * Math.PI, vmin: 0, vmax: 2 * Math.PI, extent: 5.5, surf: surfShell },
  { name: "twisted torus", umin: 0, umax: 2 * Math.PI, vmin: 0, vmax: 2 * Math.PI, extent: 3.3, surf: surfCruller },
];

function rot(P: V3, cA: number, sA: number, cB: number, sB: number) {
  const X = P[0],
    Y = P[1],
    Z = P[2];
  const y1 = Y * cA - Z * sA,
    z1 = Y * sA + Z * cA;
  P[0] = X * cB + z1 * sB;
  P[1] = y1;
  P[2] = -X * sB + z1 * cB;
}

export default function AsciiBackground() {
  const preRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const pre = preRef.current;
    if (!pre) return;

    const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];

    // measure one monospace character cell to build the grid
    const probe = document.createElement("span");
    probe.textContent = "0";
    const cs = getComputedStyle(pre);
    probe.style.cssText = `position:absolute;visibility:hidden;font-family:${cs.fontFamily};font-size:${cs.fontSize};line-height:${cs.lineHeight};white-space:pre;`;
    document.body.appendChild(probe);
    const rect = probe.getBoundingClientRect();
    const charW = rect.width || 6;
    const charH = rect.height || 11;
    document.body.removeChild(probe);
    const aspect = charH / charW; // corrects for non-square cells

    let W = 0,
      H = 0,
      cx = 0,
      cy = 0,
      K1 = 0,
      ustep = 0,
      vstep = 0;
    let screen: Uint8Array = new Uint8Array(0);
    let zbuf: Float32Array = new Float32Array(0);

    function fit() {
      W = Math.max(20, Math.floor(window.innerWidth / charW));
      H = Math.max(10, Math.floor(window.innerHeight / charH));
      cx = W / 2;
      cy = H / 2;
      K1 = (FILL * (H / 2) * K2) / shape.extent;

      ustep = vstep = (SAMPLE * K2) / (K1 * shape.extent);
      const nu = (shape.umax - shape.umin) / ustep + 1;
      const nv = (shape.vmax - shape.vmin) / vstep + 1;
      if (nu * nv > BUDGET) {
        const s = Math.sqrt((nu * nv) / BUDGET);
        ustep *= s;
        vstep *= s;
      }
      screen = new Uint8Array(W * H);
      zbuf = new Float32Array(W * H);
    }
    fit();

    let A = 0,
      B = 0;
    let raf = 0;
    let last = 0;
    const P: V3 = [0, 0, 0];
    const N: V3 = [0, 0, 0];
    const SPACE = 32;

    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      if (now - last < FRAME_MS) return;
      last = now;

      screen.fill(SPACE);
      zbuf.fill(0);
      const cA = Math.cos(A),
        sA = Math.sin(A),
        cB = Math.cos(B),
        sB = Math.sin(B);

      for (let u = shape.umin; u < shape.umax; u += ustep) {
        for (let v = shape.vmin; v < shape.vmax; v += vstep) {
          shape.surf(u, v, P, N);
          rot(P, cA, sA, cB, sB);
          rot(N, cA, sA, cB, sB);

          const zc = P[2] + K2;
          if (zc <= 0.1) continue;
          const ooz = 1 / zc;
          const xp = (cx + aspect * K1 * ooz * P[0] + 0.5) | 0;
          const yp = (cy - K1 * ooz * P[1] + 0.5) | 0;
          if (xp < 0 || xp >= W || yp < 0 || yp >= H) continue;

          const i = xp + yp * W;
          if (ooz > zbuf[i]) {
            const L = Math.abs(N[0] * LX + N[1] * LY + N[2] * LZ);
            let li = (L * 11 + 0.5) | 0;
            if (li < 0) li = 0;
            else if (li > 11) li = 11;
            zbuf[i] = ooz;
            screen[i] = RAMP.charCodeAt(li);
          }
        }
      }

      // assemble the frame string (rows joined by newlines)
      let out = "";
      for (let r = 0; r < H; r++) {
        out += String.fromCharCode(...screen.subarray(r * W, r * W + W));
        if (r < H - 1) out += "\n";
      }
      pre!.textContent = out;

      A += DA;
      B += DB;
    }

    raf = requestAnimationFrame(frame);

    let resizeTimer = 0;
    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(fit, 150);
    }
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      clearTimeout(resizeTimer);
    };
  }, []);

  return (
    <pre ref={preRef} id="ascii-art" className="ascii-art" aria-hidden="true" />
  );
}
