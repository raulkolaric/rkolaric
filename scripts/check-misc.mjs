import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { listenForPinch } from "../src/app/misc/pinch.mjs";

const root = new URL("../", import.meta.url);
const collections = JSON.parse(readFileSync(new URL("src/content/misc.json", root), "utf8"));
const remotePrefix = "https://photos.rkolaric.com/misc/";

for (const collection of collections) {
  assert.ok(collection.title.trim(), "Each collection needs a title");
  assert.match(collection.date, /^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD dates");
  if (collection.description !== undefined) {
    assert.equal(typeof collection.description, "string", `${collection.title} has an invalid description`);
    assert.ok(collection.description.length <= 1000, `${collection.title} description is too long`);
  }
  assert.ok(collection.photos.length, `${collection.title} needs at least one photo`);
  for (const photo of collection.photos) {
    assert.ok(!("title" in photo), "Titles belong to collections, not individual photos");
    if (photo.alt !== undefined) {
      assert.equal(typeof photo.alt, "string", `${photo.src} has invalid alt text`);
      assert.ok(photo.alt.length <= 500, `${photo.src} alt text is too long`);
    }
    const local = photo.src.startsWith("/misc/");
    assert.ok(local || photo.src.startsWith(remotePrefix), `Use /misc/ or ${remotePrefix} for gallery images`);
    if (local) assert.ok(existsSync(new URL(`public${photo.src}`, root)), `Missing image: ${photo.src}`);
  }
}

const target = new EventTarget();
const gestures = [];
let busy = false;
const stop = listenForPinch(target, (direction) => {
  if (busy) return false;
  gestures.push(direction);
});
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
assert.equal(send("wheel", { ctrlKey: true, deltaY: -2 }), true, "Even sub-threshold pinches suppress browser zoom");
send("wheel", { ctrlKey: true, deltaY: -11 });
assert.deepEqual(gestures, ["out", "in"], "A light reverse pinch returns without waiting for an idle timeout");
send("gesturestart");
send("wheel", { ctrlKey: true, deltaY: -100 });
assert.deepEqual(gestures, ["out", "in"], "Safari gesture events take precedence over duplicate wheel events");
assert.equal(send("gesturechange", { scale: 1.07 }), true);
assert.deepEqual(gestures, ["out", "in", "in"], "A light Safari pinch returns to the event");
send("gesturechange", { scale: 1.5 });
send("gestureend");
send("gesturestart");
send("gesturechange", { scale: Number.NaN });
send("gesturechange", { scale: 0.75 });
send("gestureend");
send("wheel", { ctrlKey: true, deltaY: -50 });
assert.deepEqual(gestures, ["out", "in", "in", "out", "in"], "Both browsers support both pinch directions");
send("gesturestart");
busy = true;
send("gesturechange", { scale: 1.07 });
busy = false;
send("gesturechange", { scale: 1.08 });
assert.deepEqual(gestures, ["out", "in", "in", "out", "in", "in"], "An animating view does not consume the next pinch");
send("gestureend");
stop();
assert.equal(send("wheel", { ctrlKey: true, deltaY: 100 }), false, "Listeners are removed on cleanup");

console.log("Gallery content, image files, and pinch gestures checked.");
