"use client";

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
