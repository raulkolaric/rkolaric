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
