import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const collections = JSON.parse(readFileSync(new URL("src/content/misc.json", root), "utf8"));

assert.ok(collections.length, "Add at least one collection");
for (const collection of collections) {
  assert.ok(collection.title.trim(), "Each collection needs a title");
  assert.match(collection.date, /^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD dates");
  assert.ok(collection.photos.length, `${collection.title} needs at least one photo`);
  for (const photo of collection.photos) {
    assert.ok(!("title" in photo), "Titles belong to collections, not individual photos");
    for (const field of ["description", "alt"]) {
      assert.ok(photo[field]?.trim(), `${photo.src} needs ${field}`);
    }
    assert.ok(photo.src.startsWith("/misc/"), "Store gallery images under public/misc");
    assert.ok(existsSync(new URL(`public${photo.src}`, root)), `Missing image: ${photo.src}`);
  }
}

console.log("Gallery content and image files checked.");
