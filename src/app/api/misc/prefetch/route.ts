import { loadCollections } from "@/lib/gallery-data";

export async function GET() {
  const photos = (await loadCollections()).flatMap(({ photos }) => photos.map(({ src }) => src)).slice(0, 3);
  return Response.json(photos, { headers: { "Cache-Control": "public, max-age=300" } });
}
