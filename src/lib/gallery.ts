export type Photo = {
  src: string;
  alt?: string;
  photographer?: string;
  source?: string;
};

export type Collection = {
  title: string;
  date: string;
  description?: string;
  photos: Photo[];
};

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export function isGallery(value: unknown, publicUrl = "https://photos.rkolaric.com"): value is Collection[] {
  const remotePrefix = `${publicUrl.replace(/\/$/, "")}/misc/`;
  return Array.isArray(value) && value.every((collection) =>
    record(collection)
    && typeof collection.title === "string"
    && Boolean(collection.title.trim())
    && typeof collection.date === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(collection.date)
    && (collection.description === undefined || typeof collection.description === "string")
    && Array.isArray(collection.photos)
    && collection.photos.length > 0
    && collection.photos.every((photo) =>
      record(photo)
      && typeof photo.src === "string"
      && (photo.src.startsWith("/misc/") || photo.src.startsWith(remotePrefix))
      && (photo.alt === undefined || typeof photo.alt === "string")
      && (photo.photographer === undefined || typeof photo.photographer === "string")
      && (photo.source === undefined || (typeof photo.source === "string" && photo.source.startsWith("https://")))
    ));
}

export function eventPath(date: string, title: string) {
  const slug = title.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
    .replace(/-$/, "");
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && slug ? `misc/${date}-${slug}/` : "";
}
