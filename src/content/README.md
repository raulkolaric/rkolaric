# Adding a gallery day or event

The gallery at `/misc` reads `misc.json`. The current entries are sample events and photos.

1. Put your images in `public/misc/<event-name>/`, for example `public/misc/beach-day/sunset.jpg`. Export web-sized JPEG, PNG, or WebP files; portrait, landscape, and square photos all work.
2. Add a collection to `misc.json` using the example below. The collection has one shared title; each photo has its own description and accessibility text (`alt`). Add one photo entry for each image. Collections and photos appear in the order written, so put the newest event first.
3. Run `node scripts/check-misc.mjs` from the project root to catch missing files or captions, then preview `/misc`.
4. Publish the site through its usual deployment process. Photos are included with the website; this sketch has no browser upload or admin screen.

```json
{
  "title": "Beach day",
  "date": "2026-09-06",
  "photos": [
    {
      "src": "/misc/beach-day/sunset.jpg",
      "description": "An afternoon at the beach with friends.",
      "alt": "Orange sunset over the sea"
    }
  ]
}
```

`photographer` and `source` are optional credit fields. Existing sample photos link to their Unsplash sources. The main image is displayed in full; thumbnails are cropped to a uniform size. Days appear one after another in a continuous scroll, and each day keeps its own selected photo. Adding another collection extends the feed automatically.

Events fade and slide in and out with scrolling through native CSS view timelines. Browsers without view-timeline support and visitors who request reduced motion see the same feed without animation.

Pinch inward on a Mac trackpad, or choose **All photos**, to see a compact grid of every photo. Pinch open over a tile or click it to return to that photo's event. **Back to events** restores your previous scroll position. Photo selections are preserved while switching views. The overview includes only the real entries in `misc.json`.

The zoom morph uses native View Transitions, with a direct view switch for older browsers or reduced-motion preferences. Trackpad handling covers Chromium/Firefox Ctrl-wheel events and Safari gesture events; ordinary scrolling and keyboard browser zoom remain native. The gesture check uses simulated events; physical Mac trackpad testing is still needed to tune the feel. The animation recreates the Photos interaction with web-native timing; it has not been matched frame by frame against Apple Photos.

For a small personal gallery, hosting the images with the site keeps this simple. If the archive grows large or browser uploads become necessary, move the images to object storage and add an editor then.
