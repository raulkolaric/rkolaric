export const galleryImageSizes = "(max-width: 760px) calc(100vw - 5rem), calc(46vw - 84px)";
const widths = [384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840];

export const gallerySrcSet = (src) => widths
  .map((width) => `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=75 ${width}w`)
  .join(", ");

export function preloadGalleryImage(src) {
  const image = new Image();
  image.sizes = galleryImageSizes;
  image.srcset = gallerySrcSet(src);
  image.src = `/_next/image?url=${encodeURIComponent(src)}&w=384&q=75`;
  return image.decode().catch(() => {});
}
