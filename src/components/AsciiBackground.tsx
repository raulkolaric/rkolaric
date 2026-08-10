"use client";

import { useEffect, useRef } from "react";

const VIEWER_DISTANCE = 11;
const VIEWPORT_FILL = 0.62;
const SAMPLE_SPACING = 0.4;
const LUMINANCE_RAMP = ".,-~:;=!*#$@";
const LIGHT: V3 = [0, 0.70710678, -0.70710678];

type V3 = [number, number, number];

function dot3(a: V3, b: V3) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross3(a: V3, b: V3, result: V3) {
  result[0] = a[1] * b[2] - a[2] * b[1];
  result[1] = a[2] * b[0] - a[0] * b[2];
  result[2] = a[0] * b[1] - a[1] * b[0];
}

function norm3(vector: V3) {
  return Math.sqrt(dot3(vector, vector));
}

function normalize3(vector: V3) {
  const length = norm3(vector);
  if (length > 1e-12) {
    vector[0] /= length;
    vector[1] /= length;
    vector[2] /= length;
  }
}

type PointFn = (u: number, v: number, point: V3) => void;
type CurveFn = (t: number, point: V3) => void;
type RadiusFn = (t: number) => number;
type SurfaceFn = (u: number, v: number, point: V3, normal: V3) => void;

const basePoint: V3 = [0, 0, 0];
const pointU: V3 = [0, 0, 0];
const pointV: V3 = [0, 0, 0];
const curvePoint: V3 = [0, 0, 0];
const curveNext: V3 = [0, 0, 0];
const curvePrevious: V3 = [0, 0, 0];
const tangent: V3 = [0, 0, 0];
const curvature: V3 = [0, 0, 0];
const normalFrame: V3 = [0, 0, 0];
const binormal: V3 = [0, 0, 0];

function numericNormal(pointFn: PointFn, u: number, v: number, normal: V3) {
  const delta = 1e-3;
  pointFn(u, v, basePoint);
  pointFn(u + delta, v, pointU);
  pointFn(u, v + delta, pointV);
  const tangentU: V3 = [
    pointU[0] - basePoint[0],
    pointU[1] - basePoint[1],
    pointU[2] - basePoint[2],
  ];
  const tangentV: V3 = [
    pointV[0] - basePoint[0],
    pointV[1] - basePoint[1],
    pointV[2] - basePoint[2],
  ];
  cross3(tangentU, tangentV, normal);
  normalize3(normal);
}

function tubeSurface(
  curve: CurveFn,
  radius: RadiusFn,
  u: number,
  v: number,
  point: V3,
  normal: V3,
) {
  const delta = 1e-3;
  curve(u, curvePoint);
  curve(u + delta, curveNext);
  curve(u - delta, curvePrevious);

  for (let index = 0; index < 3; index++) {
    tangent[index] = (curveNext[index] - curvePrevious[index]) / (2 * delta);
    curvature[index] =
      (curveNext[index] - 2 * curvePoint[index] + curvePrevious[index]) /
      (delta * delta);
  }

  normalize3(tangent);
  const tangentProjection = dot3(curvature, tangent);
  for (let index = 0; index < 3; index++) {
    normalFrame[index] = curvature[index] - tangentProjection * tangent[index];
  }

  if (norm3(normalFrame) < 1e-6) {
    const up: V3 = Math.abs(tangent[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
    const upProjection = dot3(up, tangent);
    for (let index = 0; index < 3; index++) {
      normalFrame[index] = up[index] - upProjection * tangent[index];
    }
  }

  normalize3(normalFrame);
  cross3(tangent, normalFrame, binormal);

  const distance = radius(u);
  const cosV = Math.cos(v);
  const sinV = Math.sin(v);
  for (let index = 0; index < 3; index++) {
    const radial = cosV * normalFrame[index] + sinV * binormal[index];
    point[index] = curvePoint[index] + distance * radial;
    normal[index] = radial;
  }
}

function trefoilCurve(t: number, point: V3) {
  const p = 2;
  const q = 3;
  const radius = 2 + Math.cos(q * t);
  point[0] = radius * Math.cos(p * t);
  point[1] = radius * Math.sin(p * t);
  point[2] = -Math.sin(q * t);
}

const trefoilSurface: SurfaceFn = (u, v, point, normal) => {
  tubeSurface(trefoilCurve, () => 0.5, u, v, point, normal);
};

function kleinPoint(u: number, v: number, point: V3) {
  const radius = 2.5;
  const cosHalfU = Math.cos(u / 2);
  const sinHalfU = Math.sin(u / 2);
  const sinV = Math.sin(v);
  const sinDoubleV = Math.sin(2 * v);
  const ring = radius + cosHalfU * sinV - sinHalfU * sinDoubleV;

  point[0] = ring * Math.cos(u);
  point[1] = ring * Math.sin(u);
  point[2] = sinHalfU * sinV + cosHalfU * sinDoubleV;
}

const kleinSurface: SurfaceFn = (u, v, point, normal) => {
  kleinPoint(u, v, point);
  numericNormal(kleinPoint, u, v, normal);
};

function shellCurve(t: number, point: V3) {
  const growth = Math.exp(0.05 * t);
  point[0] = growth * Math.cos(t);
  point[1] = growth * Math.sin(t);
  point[2] = -0.4 * growth;
}

const shellSurface: SurfaceFn = (u, v, point, normal) => {
  tubeSurface(
    shellCurve,
    (t) => 0.18 * Math.exp(0.05 * t),
    u,
    v,
    point,
    normal,
  );
};

function crullerPoint(u: number, v: number, point: V3) {
  const majorRadius = 2.5;
  const horizontalRadius = 0.8;
  const verticalRadius = 0.35;
  const twist = 4;
  const a = horizontalRadius * Math.cos(v);
  const b = verticalRadius * Math.sin(v);
  const angle = twist * u;
  const localA = a * Math.cos(angle) - b * Math.sin(angle);
  const localB = a * Math.sin(angle) + b * Math.cos(angle);

  point[0] = (majorRadius + localA) * Math.cos(u);
  point[1] = (majorRadius + localA) * Math.sin(u);
  point[2] = localB;
}

const crullerSurface: SurfaceFn = (u, v, point, normal) => {
  crullerPoint(u, v, point);
  numericNormal(crullerPoint, u, v, normal);
};

interface Shape {
  name: string;
  umin: number;
  umax: number;
  vmin: number;
  vmax: number;
  extent: number;
  surface: SurfaceFn;
}

const shapes: Shape[] = [
  { name: "trefoil knot", umin: 0, umax: 2 * Math.PI, vmin: 0, vmax: 2 * Math.PI, extent: 3.7, surface: trefoilSurface },
  { name: "klein bottle", umin: 0, umax: 2 * Math.PI, vmin: 0, vmax: 2 * Math.PI, extent: 5, surface: kleinSurface },
  { name: "seashell", umin: 0, umax: 10 * Math.PI, vmin: 0, vmax: 2 * Math.PI, extent: 5.5, surface: shellSurface },
  { name: "twisted torus", umin: 0, umax: 2 * Math.PI, vmin: 0, vmax: 2 * Math.PI, extent: 3.3, surface: crullerSurface },
];

interface Raster {
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  projectionScale: number;
  characterAspect: number;
  uStep: number;
  vStep: number;
  screen: Uint8Array;
  zBuffer: Float32Array;
}

function createRaster(
  viewportWidth: number,
  viewportHeight: number,
  characterWidth: number,
  characterHeight: number,
  shape: Shape,
): Raster {
  const width = Math.max(20, Math.floor(viewportWidth / characterWidth));
  const height = Math.max(10, Math.floor(viewportHeight / characterHeight));
  const projectionScale =
    (VIEWPORT_FILL * (height / 2) * VIEWER_DISTANCE) / shape.extent;
  const step =
    (SAMPLE_SPACING * VIEWER_DISTANCE) / (projectionScale * shape.extent);

  return {
    width,
    height,
    centerX: width / 2,
    centerY: height / 2,
    projectionScale,
    characterAspect: characterHeight / characterWidth,
    uStep: step,
    vStep: step,
    screen: new Uint8Array(width * height),
    zBuffer: new Float32Array(width * height),
  };
}

function clearRaster(raster: Raster) {
  raster.screen.fill(32);
  raster.zBuffer.fill(0);
}

function projectPoint(point: V3, raster: Raster) {
  const cameraZ = point[2] + VIEWER_DISTANCE;
  if (cameraZ <= 0.1) return null;

  const inverseZ = 1 / cameraZ;
  const x =
    (raster.centerX +
      raster.characterAspect * raster.projectionScale * inverseZ * point[0] +
      0.5) |
    0;
  const y =
    (raster.centerY - raster.projectionScale * inverseZ * point[1] + 0.5) |
    0;

  if (x < 0 || x >= raster.width || y < 0 || y >= raster.height) return null;
  return { x, y, inverseZ, index: x + y * raster.width };
}

function rotate(point: V3, cosA: number, sinA: number, cosB: number, sinB: number) {
  const x = point[0];
  const y = point[1];
  const z = point[2];
  const tiltedY = y * cosA - z * sinA;
  const tiltedZ = y * sinA + z * cosA;

  point[0] = x * cosB + tiltedZ * sinB;
  point[1] = tiltedY;
  point[2] = -x * sinB + tiltedZ * cosB;
}

function renderSurface(shape: Shape, raster: Raster, angleA: number, angleB: number) {
  clearRaster(raster);

  const cosA = Math.cos(angleA);
  const sinA = Math.sin(angleA);
  const cosB = Math.cos(angleB);
  const sinB = Math.sin(angleB);
  const point: V3 = [0, 0, 0];
  const normal: V3 = [0, 0, 0];

  for (let u = shape.umin; u < shape.umax; u += raster.uStep) {
    for (let v = shape.vmin; v < shape.vmax; v += raster.vStep) {
      shape.surface(u, v, point, normal);
      rotate(point, cosA, sinA, cosB, sinB);
      rotate(normal, cosA, sinA, cosB, sinB);

      const projected = projectPoint(point, raster);
      if (!projected || projected.inverseZ <= raster.zBuffer[projected.index]) {
        continue;
      }

      const luminance = Math.abs(dot3(normal, LIGHT));
      const rampIndex = Math.max(
        0,
        Math.min(LUMINANCE_RAMP.length - 1, Math.round(luminance * 11)),
      );
      raster.zBuffer[projected.index] = projected.inverseZ;
      raster.screen[projected.index] = LUMINANCE_RAMP.charCodeAt(rampIndex);
    }
  }
}

function rasterToString(raster: Raster) {
  let output = "";
  for (let row = 0; row < raster.height; row++) {
    output += String.fromCharCode(
      ...raster.screen.subarray(row * raster.width, row * raster.width + raster.width),
    );
    if (row < raster.height - 1) output += "\n";
  }
  return output;
}

export default function AsciiBackground() {
  const preRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const pre = preRef.current;
    if (!pre) return;

    const shape = shapes[Math.floor(Math.random() * shapes.length)];
    const probe = document.createElement("span");
    probe.textContent = "0";
    const style = getComputedStyle(pre);
    probe.style.cssText = `position:absolute;visibility:hidden;font-family:${style.fontFamily};font-size:${style.fontSize};line-height:${style.lineHeight};white-space:pre;`;
    document.body.appendChild(probe);
    const bounds = probe.getBoundingClientRect();
    document.body.removeChild(probe);
    const characterWidth = bounds.width || 6;
    const characterHeight = bounds.height || 11;

    let raster = createRaster(
      window.innerWidth,
      window.innerHeight,
      characterWidth,
      characterHeight,
      shape,
    );
    let angleA = 0;
    let angleB = 0;

    function frame() {
      renderSurface(shape, raster, angleA, angleB);
      pre.textContent = rasterToString(raster);
      angleA += 0.03;
      angleB += 0.02;
      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
    window.addEventListener("resize", () => {
      raster = createRaster(
        window.innerWidth,
        window.innerHeight,
        characterWidth,
        characterHeight,
        shape,
      );
    });
  }, []);

  return (
    <pre ref={preRef} id="ascii-art" className="ascii-art" aria-hidden="true" />
  );
}
