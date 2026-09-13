import { cookies } from "next/headers";
import { loadCollections } from "@/lib/gallery-data";
import { SESSION_COOKIE, validSession } from "@/lib/publish";
import Publisher from "./Publisher";

export default async function PublishPage() {
  const collections = await loadCollections();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  let authenticated = false;
  try {
    authenticated = validSession(token);
  } catch {}
  return <Publisher initialAuthenticated={authenticated} initialCollections={collections} />;
}
