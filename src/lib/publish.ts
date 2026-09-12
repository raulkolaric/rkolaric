import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fallback from "@/content/misc.json";
import { eventPath, isGallery, type Collection } from "@/lib/gallery";

export const SESSION_COOKIE = "publish_session";
export const SESSION_AGE = 60 * 60 * 24 * 7;
export const MAX_FILE_SIZE = 15 * 1024 * 1024;
const INDEX_KEY = "misc/index.json";
const TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/png", "png"],
]);

export class PublishError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const env = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

const sessionSecret = () => {
  const secret = env("SESSION_SECRET");
  if (secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return secret;
};

const sign = (value: string) => createHmac("sha256", sessionSecret()).update(value).digest("base64url");

export function createSession() {
  const payload = `${Math.floor(Date.now() / 1000) + SESSION_AGE}.${randomBytes(18).toString("base64url")}`;
  return `${payload}.${sign(payload)}`;
}

export function validSession(token?: string) {
  if (!token || !/^\d{10}\.[\w-]{24}\.[\w-]{43}$/.test(token)) return false;
  const [expires, nonce, signature] = token.split(".");
  if (Number(expires) <= Math.floor(Date.now() / 1000)) return false;
  const expected = sign(`${expires}.${nonce}`);
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export function validPassword(password: unknown) {
  if (typeof password !== "string" || password.length > 1024) return false;
  const expected = env("PUBLISH_PASSWORD");
  if (expected.length < 16) throw new Error("PUBLISH_PASSWORD must be at least 16 characters");
  return timingSafeEqual(
    createHash("sha256").update(password).digest(),
    createHash("sha256").update(expected).digest(),
  );
}

export function requireSession(token?: string) {
  if (!validSession(token)) throw new PublishError(401, "Sign in to publish.");
}

export async function jsonBody(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    throw new PublishError(415, "Expected a JSON request.");
  }
  try {
    return await request.json() as unknown;
  } catch {
    throw new PublishError(400, "Invalid JSON.");
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof PublishError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return Response.json({ error: "Publishing service unavailable." }, { status: 500 });
}

let client: S3Client | undefined;
const r2 = () => client ||= new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT?.trim() || `https://${env("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
  requestChecksumCalculation: "WHEN_REQUIRED",
  credentials: {
    accessKeyId: env("R2_ACCESS_KEY_ID"),
    secretAccessKey: env("R2_SECRET_ACCESS_KEY"),
  },
});
const bucket = () => env("R2_BUCKET");
export const publicUrl = () => env("R2_PUBLIC_URL").replace(/\/$/, "");

const missing = (error: unknown) =>
  typeof error === "object" && error !== null
  && "$metadata" in error
  && (error.$metadata as { httpStatusCode?: number }).httpStatusCode === 404;

async function metadata(): Promise<{ collections: Collection[]; etag?: string }> {
  try {
    const response = await r2().send(new GetObjectCommand({ Bucket: bucket(), Key: INDEX_KEY }));
    const value: unknown = response.Body ? JSON.parse(await response.Body.transformToString()) : null;
    if (!isGallery(value, publicUrl())) throw new PublishError(502, "Gallery metadata is invalid.");
    if (!response.ETag) throw new PublishError(502, "Gallery metadata has no revision.");
    return { collections: value, etag: response.ETag };
  } catch (error) {
    if (!missing(error)) throw error;
    if (!isGallery(fallback, publicUrl())) throw new PublishError(500, "Bundled gallery metadata is invalid.");
    return { collections: fallback };
  }
}

const isDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
};

const cleanTitle = (value: unknown) => {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 160) {
    throw new PublishError(400, "Enter a title of 160 characters or fewer.");
  }
  return value.trim();
};

const pathFor = (date: unknown, title: unknown) => {
  if (!isDate(date)) throw new PublishError(400, "Use a valid date.");
  const path = eventPath(date, cleanTitle(title));
  if (!path) throw new PublishError(400, "The title must contain letters or numbers.");
  return path;
};

const eventExists = (collections: Collection[], path: string) => {
  const prefix = `${publicUrl()}/${path}`;
  return collections.some((collection) =>
    eventPath(collection.date, collection.title) === path
    || collection.photos.some((photo) => photo.src.startsWith(prefix)));
};

const objectExists = async (key: string) => {
  try {
    await r2().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return true;
  } catch (error) {
    if (missing(error)) return false;
    throw error;
  }
};

const fileStem = (name: string) => name.replace(/\.[^.]*$/, "")
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "")
  .slice(0, 60)
  .replace(/-$/, "") || "photo";

type UploadManifest = { name: string; type: string; size: number };

export async function prepareUploads(value: unknown) {
  if (typeof value !== "object" || value === null) throw new PublishError(400, "Invalid upload request.");
  const body = value as Record<string, unknown>;
  const path = pathFor(body.date, body.title);
  if (!Array.isArray(body.files) || body.files.length < 1 || body.files.length > 50) {
    throw new PublishError(400, "Select between 1 and 50 images.");
  }
  const files = body.files.map((file): UploadManifest => {
    if (typeof file !== "object" || file === null) throw new PublishError(400, "Invalid file.");
    const item = file as Record<string, unknown>;
    if (typeof item.name !== "string" || !item.name || item.name.length > 255) {
      throw new PublishError(400, "Invalid filename.");
    }
    if (typeof item.type !== "string" || !TYPES.has(item.type)) {
      throw new PublishError(400, "Use JPEG, WebP, or PNG images.");
    }
    if (typeof item.size !== "number" || !Number.isInteger(item.size) || item.size < 1 || item.size > MAX_FILE_SIZE) {
      throw new PublishError(400, "Each image must be 15 MB or smaller.");
    }
    return { name: item.name, type: item.type, size: item.size };
  });

  const current = await metadata();
  if (eventExists(current.collections, path)) throw new PublishError(409, "That event path already exists. Change the title.");
  const records = files.map((file, index) => {
    const extension = TYPES.get(file.type)!;
    const key = `${path}${String(index + 1).padStart(2, "0")}-${fileStem(file.name)}.${extension}`;
    return { file, key };
  });
  if ((await Promise.all(records.map(({ key }) => objectExists(key)))).some(Boolean)) {
    throw new PublishError(409, "That event path already contains uploaded files. Change the title.");
  }

  const uploads = await Promise.all(records.map(async ({ file, key }) => ({
    key,
    type: file.type,
    publicUrl: `${publicUrl()}/${key}`,
    uploadUrl: await getSignedUrl(r2(), new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      ContentLength: file.size,
      ContentType: file.type,
    }), { expiresIn: 10 * 60, signableHeaders: new Set(["content-type"]) }),
  })));
  return { path, uploads };
}

const imageType = (bytes: Uint8Array) => {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if ([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte)) return "image/png";
  if (new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
};

async function verifyImage(key: string) {
  const head = await r2().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
  if (!head.ContentLength || head.ContentLength > MAX_FILE_SIZE || !head.ContentType || !TYPES.has(head.ContentType)) {
    throw new PublishError(400, `${key} is not an allowed image under 15 MB.`);
  }
  const response = await r2().send(new GetObjectCommand({ Bucket: bucket(), Key: key, Range: "bytes=0-11" }));
  const bytes = response.Body ? await response.Body.transformToByteArray() : new Uint8Array();
  if (imageType(bytes) !== head.ContentType || !key.endsWith(`.${TYPES.get(head.ContentType)}`)) {
    throw new PublishError(400, `${key} does not match its image type.`);
  }
}

type PendingPhoto = { key: string; description: string; alt: string };

export async function publishEvent(value: unknown) {
  if (typeof value !== "object" || value === null) throw new PublishError(400, "Invalid event.");
  const body = value as Record<string, unknown>;
  const title = cleanTitle(body.title);
  const path = pathFor(body.date, title);
  if (!Array.isArray(body.photos) || body.photos.length < 1 || body.photos.length > 50) {
    throw new PublishError(400, "Add between 1 and 50 photos.");
  }
  const keyPattern = new RegExp(`^${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\d{2}-[a-z0-9-]+\\.(jpg|webp|png)$`);
  const photos = body.photos.map((photo): PendingPhoto => {
    if (typeof photo !== "object" || photo === null) throw new PublishError(400, "Invalid photo metadata.");
    const item = photo as Record<string, unknown>;
    if (typeof item.key !== "string" || !keyPattern.test(item.key)) throw new PublishError(400, "Invalid photo path.");
    if (typeof item.description !== "string" || !item.description.trim() || item.description.trim().length > 1000) {
      throw new PublishError(400, "Each photo needs a description of 1,000 characters or fewer.");
    }
    if (typeof item.alt !== "string" || !item.alt.trim() || item.alt.trim().length > 500) {
      throw new PublishError(400, "Each photo needs alt text of 500 characters or fewer.");
    }
    return { key: item.key, description: item.description.trim(), alt: item.alt.trim() };
  });
  if (new Set(photos.map(({ key }) => key)).size !== photos.length) throw new PublishError(400, "Photo paths must be unique.");
  await Promise.all(photos.map(({ key }) => verifyImage(key)));

  const current = await metadata();
  if (eventExists(current.collections, path)) throw new PublishError(409, "That event path already exists. Change the title.");
  const collection: Collection = {
    title,
    date: body.date as string,
    photos: photos.map(({ key, description, alt }) => ({ src: `${publicUrl()}/${key}`, description, alt })),
  };
  try {
    await r2().send(new PutObjectCommand({
      Bucket: bucket(),
      Key: INDEX_KEY,
      Body: `${JSON.stringify([collection, ...current.collections], null, 2)}\n`,
      ContentType: "application/json; charset=utf-8",
      CacheControl: "no-cache",
      ...(current.etag ? { IfMatch: current.etag } : { IfNoneMatch: "*" }),
    }));
  } catch (error) {
    if (typeof error === "object" && error !== null && "$metadata" in error
      && (error.$metadata as { httpStatusCode?: number }).httpStatusCode === 412) {
      throw new PublishError(409, "The gallery changed while publishing. Retry with a new event path.");
    }
    throw error;
  }
  return { path, collection };
}
