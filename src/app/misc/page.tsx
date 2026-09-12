import fallback from "@/content/misc.json";
import { isGallery, type Collection } from "@/lib/gallery";
import Gallery from "./Gallery";

async function loadCollections(): Promise<Collection[]> {
  const publicUrl = (process.env.R2_PUBLIC_URL || "https://photos.rkolaric.com").replace(/\/$/, "");
  try {
    const response = await fetch(`${publicUrl}/misc/index.json`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    const data: unknown = response.ok ? await response.json() : null;
    if (isGallery(data, publicUrl)) return data;
  } catch {}
  return fallback;
}

export default async function Misc() {
  return <Gallery collections={await loadCollections()} />;
}
