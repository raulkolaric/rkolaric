"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { Collection } from "@/lib/gallery";
import { listenForPinch } from "./pinch.mjs";
import styles from "./page.module.css";

type PhotoPosition = { collection: number; photo: number };
const photoName = (collection: number, photo: number) => `misc-photo-${collection}-${photo}`;

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
              sizes="(max-width: 760px) 100vw, 55vw"
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
              <Image src={item.src} alt="" fill sizes="88px" />
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
      const hit = Number.isFinite(x) && Number.isFinite(y)
        ? document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-photo]")
        : null;
      let target = lastPhoto.current;
      if (hit?.dataset.photo) {
        const [collection, photo] = hit.dataset.photo.split(":").map(Number);
        target = { collection, photo };
      } else if (!mode.current) {
        const events = Array.from(page.current?.querySelectorAll<HTMLElement>("[data-event]") ?? []);
        const closest = events.sort((a, b) => {
          const center = (element: HTMLElement) => {
            const rect = element.getBoundingClientRect();
            return Math.abs(rect.top + rect.height / 2 - window.innerHeight / 2);
          };
          return center(a) - center(b);
        })[0];
        const active = closest?.querySelector<HTMLElement>("[data-photo]")?.dataset.photo;
        if (active) {
          const [collection, photo] = active.split(":").map(Number);
          target = { collection, photo };
        }
      }
      return changeView(direction === "out", target);
    });
  }, [changeView]);

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
                <Image src={photo.src} alt="" fill sizes="88px" />
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
          onSelect={(photo) => {
            setSelected((previous) => previous.map((value, event) => event === index ? photo : value));
            lastPhoto.current = { collection: index, photo };
          }}
        />
      ))}

      <footer className={styles.footer}>
        <Link href="/">← Back home</Link>
      </footer>
    </main>
  );
}
