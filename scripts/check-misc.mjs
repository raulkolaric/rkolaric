import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { listenForPinch } from "../src/app/misc/pinch.mjs";

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

const target = new EventTarget();
const gestures = [];
const stop = listenForPinch(target, (direction) => gestures.push(direction));
const send = (type, fields = {}) => {
  const event = Object.assign(new Event(type, { cancelable: true }), fields);
  target.dispatchEvent(event);
  return event.defaultPrevented;
};

assert.equal(send("wheel", { deltaY: 200 }), false, "Normal scrolling stays native");
send("wheel", { ctrlKey: true, deltaY: 5 });
assert.deepEqual(gestures, [], "Small trackpad movements do not switch views");
assert.equal(send("wheel", { ctrlKey: true, deltaY: 50 }), true);
send("wheel", { ctrlKey: true, deltaY: 100 });
assert.deepEqual(gestures, ["out"], "One transition per pinch, even with momentum");
send("gesturestart");
send("wheel", { ctrlKey: true, deltaY: -100 });
assert.deepEqual(gestures, ["out"], "Safari gesture events take precedence over duplicate wheel events");
send("gesturechange", { scale: 1.3 });
send("gesturechange", { scale: 1.5 });
send("gestureend");
send("gesturestart");
send("gesturechange", { scale: Number.NaN });
send("gesturechange", { scale: 0.75 });
send("gestureend");
send("wheel", { ctrlKey: true, deltaY: -50 });
assert.deepEqual(gestures, ["out", "in", "out", "in"], "Both browsers support both pinch directions");
stop();
assert.equal(send("wheel", { ctrlKey: true, deltaY: 100 }), false, "Listeners are removed on cleanup");

console.log("Gallery content, image files, and pinch gestures checked.");
