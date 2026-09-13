"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { Collection } from "@/lib/gallery";
import { photoForArrow } from "./navigation.mjs";
import { listenForPinch } from "./pinch.mjs";
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

function CollectionGallery({ collection, index, selected, animate, onSelect }: {
  collection: Collection;
  index: number;
  selected: number;
  animate: boolean;
  onSelect: (photo: number) => void;
}) {
  const { photos } = collection;
  const photo = photos[selected];

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
            style={{ viewTransitionName: animate ? photoName(index, selected) : "none" }}>
            <Image
              src={photo.src}
              alt={photo.alt || ""}
              fill
              priority={index === 0}
              sizes="(max-width: 760px) calc(100vw - 5rem), calc(46vw - 84px)"
            />
          </div>
          <figcaption className={styles.photoCount} aria-live="polite" aria-atomic="true"
            aria-label={`Photo ${selected + 1} of ${photos.length}`}>
            {String(selected + 1).padStart(2, "0")} / {String(photos.length).padStart(2, "0")}
          </figcaption>
        </figure>

        <div className={styles.previews} role="group" aria-label="Choose a photo"
          style={{ viewTransitionName: animate ? `misc-previews-${index}` : "none" }}>
          {photos.map((item, photoIndex) => (
            <button
              key={`${item.src}-${photoIndex}`}
              type="button"
              onClick={() => onSelect(photoIndex)}
              data-photo={`${index}:${photoIndex}`}
              aria-label={`View photo ${photoIndex + 1}${item.alt ? `: ${item.alt}` : ""}`}
              aria-pressed={selected === photoIndex}
              className={styles.preview}
              style={{ viewTransitionName: animate && selected !== photoIndex ? photoName(index, photoIndex) : "none" }}
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
  const [transitionCollection, setTransitionCollection] = useState<number | null>(null);
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
      if (scrollEvent) event?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
        block: "center",
      });
      event?.querySelector(`[data-photo="${target.collection}:${target.photo}"][aria-pressed]`)
        ?.scrollIntoView({ behavior: "instant", block: "nearest", inline: "nearest" });
    });
  }, []);

  const changeView = useCallback((next: boolean, target?: PhotoPosition) => {
    if (busy.current || next === mode.current) return false;
    if (next) {
      scrollPosition.current = window.scrollY;
      if (target) lastPhoto.current = target;
    }
    mode.current = next;
    busy.current = true;
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
        const anchor = target ?? lastPhoto.current;
        page.current?.querySelector(`[data-photo="${anchor.collection}:${anchor.photo}"]`)
          ?.scrollIntoView({ behavior: "instant", block: "nearest" });
      }
    };
    const finish = () => {
      busy.current = false;
      setTransitionCollection(null);
      const focusTarget = !next && target
        ? page.current?.querySelector<HTMLElement>(`[data-event="${target.collection}"]`)
        : page.current?.querySelector<HTMLElement>("[data-overview-toggle]");
      focusTarget?.focus({ preventScroll: true });
    };
    if (!document.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      update();
      finish();
      return true;
    }
    flushSync(() => setTransitionCollection((target ?? lastPhoto.current).collection));
    const transition = document.startViewTransition(update);
    // A skipped animation must still leave the requested view usable.
    void transition.ready.catch(() => {});
    void transition.finished.then(finish, finish);
    return true;
  }, []);

  useEffect(() => {
    if (!page.current) return;
    return listenForPinch(window, (direction, x, y) => {
      const target = currentPhoto(page.current!, lastPhoto.current, x, y);
      return changeView(direction === "out", target);
    });
  }, [changeView]);

  useEffect(() => {
    const lengths = collections.map(({ photos }) => photos.length);
    const onKeyDown = (event: KeyboardEvent) => {
      if (mode.current || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")
        || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const element = event.target as HTMLElement | null;
      if (element?.matches("input, textarea, select, [contenteditable='true']")) return;
      const current = page.current ? currentPhoto(page.current, lastPhoto.current) : lastPhoto.current;
      const target = photoForArrow(lengths, current, event.key);
      if (target.collection === current.collection && target.photo === current.photo) return;
      event.preventDefault();
      selectPhoto(target, target.collection !== current.collection);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [collections, selectPhoto]);

  return (
    <main className={styles.page} ref={page}>
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
            {collections.reduce((total, collection) => total + collection.photos.length, 0)} photos
          </p>
          <div className={styles.photoGrid}>
            {collections.flatMap((collection, collectionIndex) => collection.photos.map((photo, photoIndex) => (
              <button key={photoName(collectionIndex, photoIndex)} type="button"
                className={styles.gridPhoto} data-photo={`${collectionIndex}:${photoIndex}`}
                style={{ viewTransitionName: transitionCollection === null || transitionCollection === collectionIndex
                  ? photoName(collectionIndex, photoIndex)
                  : "none" }}
                aria-label={`Open ${photo.alt || `photo ${photoIndex + 1}`} — ${collection.title}, ${collection.date}`}
                title={`${collection.date} · ${collection.title}`}
                onClick={() => changeView(false, { collection: collectionIndex, photo: photoIndex })}>
                <Image src={photo.src} alt="" fill sizes="88px" quality={60} />
              </button>
            )))}
          </div>
        </section>
      ) : collections.map((collection, index) => (
        <CollectionGallery
          key={`${collection.date}-${collection.title}`}
          collection={collection}
          index={index}
          selected={selected[index]}
          animate={transitionCollection === null || transitionCollection === index}
          onSelect={(photo) => selectPhoto({ collection: index, photo })}
        />
      ))}

      <footer className={styles.footer}>
        <Link href="/">← Back home</Link>
      </footer>
    </main>
  );
}
