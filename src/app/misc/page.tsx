import { loadCollections } from "@/lib/gallery-data";
import Gallery from "./Gallery";

export default async function Misc() {
  return <Gallery collections={await loadCollections()} />;
}
