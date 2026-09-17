"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { Collection } from "@/lib/gallery";
import { cascadeDelay, keyForSwipe, photoForArrow } from "./navigation.mjs";
import { listenForPinch } from "./pinch.mjs";
import { galleryImageSizes, preloadGalleryImage } from "./preload.mjs";
import JellyfishBackground from "./JellyfishBackground";
import styles from "./page.module.css";

type PhotoPosition = { collection: number; photo: number };
const photoName = (collection: number, photo: number) => `misc-photo-${collection}-${photo}`;

function currentPhoto(page: HTMLElement, fallback: PhotoPosition, x = innerWidth / 2, y = innerHeight / 2) {
  const hit = document.elementFromPoint(
    Number.isFinite(x) ? x : innerWidth / 2,
    Number.isFinite(y) ? y : innerHeight / 2,
  )?.closest<HTMLElement>("[data-photo]");
  const closest = hit ?? Array.from(page.querySelectorAll<HTMLElement>("[data-event]"))
    .sort((a, b) => {
      const distance = (element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        return Math.abs(rect.top + rect.height / 2 - innerHeight / 2);
      };
      return distance(a) - distance(b);
    })[0]?.querySelector<HTMLElement>('[aria-pressed="true"]');
  if (!closest?.dataset.photo) return fallback;
  const [collection, photo] = closest.dataset.photo.split(":").map(Number);
  return { collection, photo };
}

function CollectionGallery({ collection, index, selected, transitionPhoto, onSelect, onSwipe }: {
  collection: Collection;
  index: number;
  selected: number;
  transitionPhoto: number | null;
  onSelect: (photo: number) => void;
  onSwipe: (key: "ArrowLeft" | "ArrowRight") => void;
}) {
  const { photos } = collection;
  const photo = photos[selected];
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  return (
    <section className={styles.event} aria-label={collection.title} data-event={index} tabIndex={-1}>
      <div className={styles.gallery}>
        <div className={styles.caption}>
          <header className={styles.eventHeading}>
            <h2>{collection.title}</h2>
            <time dateTime={collection.date}>{collection.date}</time>
          </header>
          {collection.description && <p className={styles.description}>{collection.description}</p>}
          <div aria-live="polite" aria-atomic="true">
            {photo.photographer && (
              <p className={styles.credit}>
                Photo by {photo.source ? <a href={photo.source}>{photo.photographer}</a> : photo.photographer}
              </p>
            )}
          </div>
        </div>

        <figure className={styles.photoFrame}>
          <div className={styles.photo} data-photo={`${index}:${selected}`}
            style={{ viewTransitionName: transitionPhoto === selected ? photoName(index, selected) : "none" }}
            onTouchStart={(event) => {
              if (event.touches.length !== 1) {
                swipeStart.current = null;
                return;
              }
              const touch = event.touches[0];
              swipeStart.current = { x: touch.clientX, y: touch.clientY };
            }}
            onTouchEnd={(event) => {
              const start = swipeStart.current;
              const touch = event.changedTouches[0];
              swipeStart.current = null;
              if (!start || !touch) return;
              const key = keyForSwipe(start, { x: touch.clientX, y: touch.clientY });
              if (key) onSwipe(key);
            }}
            onTouchCancel={() => { swipeStart.current = null; }}>
            <Image
              key={photo.src}
              src={photo.src}
              alt={photo.alt || ""}
              fill
              priority={index === 0}
              sizes={galleryImageSizes}
            />
            <button type="button" className={`${styles.photoArrow} ${styles.previousPhoto}`}
              aria-label="Previous photo" onClick={() => onSwipe("ArrowLeft")} />
            <button type="button" className={`${styles.photoArrow} ${styles.nextPhoto}`}
              aria-label="Next photo" onClick={() => onSwipe("ArrowRight")} />
          </div>
          <figcaption className={styles.photoCount} aria-live="polite" aria-atomic="true"
            aria-label={`Photo ${selected + 1} of ${photos.length}`}>
            {String(selected + 1).padStart(2, "0")} / {String(photos.length).padStart(2, "0")}
          </figcaption>
        </figure>

        <div className={styles.previews} role="group" aria-label="Choose a photo">
          {photos.map((item, photoIndex) => (
            <button
              key={`${item.src}-${photoIndex}`}
              type="button"
              onClick={() => onSelect(photoIndex)}
              data-photo={`${index}:${photoIndex}`}
              aria-label={`View photo ${photoIndex + 1}${item.alt ? `: ${item.alt}` : ""}`}
              aria-pressed={selected === photoIndex}
              className={styles.preview}
            >
              <Image src={item.src} alt="" fill sizes="88px" quality={60} />
              <span>{String(photoIndex + 1).padStart(2, "0")}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Gallery({ collections }: { collections: Collection[] }) {
  const [overview, setOverview] = useState(false);
  const [selected, setSelected] = useState(() => collections.map(() => 0));
  const [transitionPhoto, setTransitionPhoto] = useState<PhotoPosition | null>(null);
  const page = useRef<HTMLElement>(null);
  const mode = useRef(false);
  const busy = useRef(false);
  const scrollPosition = useRef(0);
  const lastPhoto = useRef<PhotoPosition>({ collection: 0, photo: 0 });

  const selectPhoto = useCallback((target: PhotoPosition, scrollEvent = false) => {
    setSelected((previous) => previous.map((photo, index) => index === target.collection ? target.photo : photo));
    lastPhoto.current = target;
    requestAnimationFrame(() => {
      const event = page.current?.querySelector<HTMLElement>(`[data-event="${target.collection}"]`);
      if (scrollEvent) event?.scrollIntoView({ behavior: "auto", block: "center" });
      event?.querySelector(`[data-photo="${target.collection}:${target.photo}"][aria-pressed]`)
        ?.scrollIntoView({ behavior: "auto", block: "nearest", inline: "nearest" });
    });
  }, []);

  const navigatePhoto = useCallback((current: PhotoPosition, key: "ArrowLeft" | "ArrowRight") => {
    const target = photoForArrow(collections.map(({ photos }) => photos.length), current, key);
    if (target.collection === current.collection && target.photo === current.photo) return;
    selectPhoto(target, target.collection !== current.collection);
  }, [collections, selectPhoto]);

  const changeView = useCallback((next: boolean, target?: PhotoPosition) => {
    if (busy.current || next === mode.current) return false;
    if (next) {
      scrollPosition.current = window.scrollY;
      if (target) lastPhoto.current = target;
    }
    mode.current = next;
    busy.current = true;
    const anchor = target ?? lastPhoto.current;
    const animateOverview = () => {
      const photos = Array.from(page.current?.querySelectorAll<HTMLElement>(`.${styles.gridPhoto}`) ?? []);
      photos.forEach((photo, index) => {
        if (photo.dataset.photo === `${anchor.collection}:${anchor.photo}`) return;
        photo.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 220,
          delay: cascadeDelay(index, photos.length),
          easing: "ease-out",
          fill: "backwards",
        });
      });
    };
    const update = () => {
      flushSync(() => {
        setOverview(next);
        if (!next && target) {
          setSelected((previous) => previous.map((photo, index) => index === target.collection ? target.photo : photo));
          lastPhoto.current = target;
        }
      });
      if (!next && target) {
        const event = page.current?.querySelector(`[data-event="${target.collection}"]`);
        event?.scrollIntoView({ behavior: "instant", block: "center" });
        event?.querySelector('[aria-pressed="true"]')
          ?.scrollIntoView({ behavior: "instant", block: "nearest", inline: "nearest" });
      } else {
        window.scrollTo({ top: next ? 0 : scrollPosition.current, behavior: "instant" });
      }
      if (next) {
        page.current?.querySelector(`[data-photo="${anchor.collection}:${anchor.photo}"]`)
          ?.scrollIntoView({ behavior: "instant", block: "nearest" });
      }
    };
    const finish = () => {
      busy.current = false;
      const focusTarget = !next && target
        ? page.current?.querySelector<HTMLElement>(`[data-event="${target.collection}"]`)
        : page.current?.querySelector<HTMLElement>("[data-overview-toggle]");
      focusTarget?.focus({ preventScroll: true });
    };
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!document.startViewTransition || reducedMotion) {
      update();
      if (next && !reducedMotion) requestAnimationFrame(animateOverview);
      finish();
      return true;
    }
    flushSync(() => setTransitionPhoto(anchor));
    const transition = document.startViewTransition(update);
    void transition.ready.then(() => { if (next) animateOverview(); }, () => {});
    void transition.finished.then(finish, finish);
    return true;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      for (const src of collections.flatMap(({ photos }) => photos.map(({ src }) => src))) {
        if (cancelled) return;
        await preloadGalleryImage(src);
      }
    })();
    return () => { cancelled = true; };
  }, [collections]);

  useEffect(() => {
    if (!page.current) return;
    return listenForPinch(window, (direction, x, y) => {
      const target = currentPhoto(page.current!, lastPhoto.current, x, y);
      return changeView(direction === "out", target);
    });
  }, [changeView]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (mode.current || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")
        || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const element = event.target as HTMLElement | null;
      if (element?.matches("input, textarea, select, [contenteditable='true']")) return;
      const current = page.current ? currentPhoto(page.current, lastPhoto.current) : lastPhoto.current;
      event.preventDefault();
      navigatePhoto(current, event.key);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigatePhoto]);

  const allPhotos = collections.flatMap((collection, collectionIndex) =>
    collection.photos.map((photo, photoIndex) => ({ collection, collectionIndex, photo, photoIndex })));
  return (
    <main className={styles.page} ref={page}>
      <JellyfishBackground />
      <header className={styles.header}>
        <Link href="/">Raul Kolarić</Link>
        <h1>/misc</h1>
        <button className={styles.overviewToggle} type="button" data-overview-toggle
          aria-pressed={overview} onClick={() => changeView(!overview)}>
          {overview ? "Back to events" : "All photos"}
        </button>
      </header>

      {overview ? (
        <section className={styles.overview} aria-label="All photos">
          <p className={styles.overviewCount}>
            {allPhotos.length} photos
          </p>
          <div className={styles.photoGrid}>
            {allPhotos.map(({ collection, collectionIndex, photo, photoIndex }) => (
              <button key={photoName(collectionIndex, photoIndex)} type="button"
                className={styles.gridPhoto} data-photo={`${collectionIndex}:${photoIndex}`}
                style={{ viewTransitionName: transitionPhoto?.collection === collectionIndex
                  && transitionPhoto.photo === photoIndex
                  ? photoName(collectionIndex, photoIndex)
                  : "none" }}
                aria-label={`Open ${photo.alt || `photo ${photoIndex + 1}`} — ${collection.title}, ${collection.date}`}
                title={`${collection.date} · ${collection.title}`}
                onClick={() => changeView(false, { collection: collectionIndex, photo: photoIndex })}>
                <Image src={photo.src} alt="" fill sizes="88px" quality={60} />
              </button>
            ))}
          </div>
        </section>
      ) : collections.map((collection, index) => (
        <CollectionGallery
          key={`${collection.date}-${collection.title}`}
          collection={collection}
          index={index}
          selected={selected[index]}
          transitionPhoto={transitionPhoto?.collection === index ? transitionPhoto.photo : null}
          onSelect={(photo) => selectPhoto({ collection: index, photo })}
          onSwipe={(key) => navigatePhoto({ collection: index, photo: selected[index] }, key)}
        />
      ))}

      <footer className={styles.footer}>
        <Link href="/">← Back home</Link>
      </footer>
    </main>
  );
}
