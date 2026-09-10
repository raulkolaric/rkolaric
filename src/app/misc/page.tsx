"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import collectionData from "@/content/misc.json";
import { listenForPinch } from "./pinch.mjs";
import styles from "./page.module.css";

type Collection = {
  title: string;
  date: string;
  photos: {
    src: string;
    description: string;
    alt: string;
    photographer?: string;
    source?: string;
  }[];
};

const collections: Collection[] = collectionData;

type PhotoPosition = { collection: number; photo: number };
const photoName = (collection: number, photo: number) => `misc-photo-${collection}-${photo}`;

function CollectionGallery({ collection, index, selected, onSelect }: {
  collection: Collection;
  index: number;
  selected: number;
  onSelect: (photo: number) => void;
}) {
  const { photos } = collection;
  const photo = photos[selected];

  return (
    <section className={styles.event} aria-label={collection.title} data-event={index} tabIndex={-1}>
      <header className={styles.eventHeading}>
        <time dateTime={collection.date}>{collection.date}</time>
      </header>

      <div className={styles.gallery}>
        <div className={styles.caption} aria-live="polite" aria-atomic="true">
          <p className={styles.index}>
            {String(selected + 1).padStart(2, "0")} / {String(photos.length).padStart(2, "0")}
          </p>
          <h2>{collection.title}</h2>
          <p className={styles.description}>{photo.description}</p>
          {photo.photographer && (
            <p className={styles.credit}>
              Photo by {photo.source ? <a href={photo.source}>{photo.photographer}</a> : photo.photographer}
            </p>
          )}
        </div>

        <div className={styles.photo} data-photo={`${index}:${selected}`}>
          <Image
            src={photo.src}
            alt={photo.alt}
            fill
            priority={index === 0}
            sizes="(max-width: 760px) 100vw, 55vw"
            style={{ viewTransitionName: photoName(index, selected) }}
          />
        </div>

        <div className={styles.previews} role="group" aria-label="Choose a photo">
          {photos.map((item, photoIndex) => (
            <button
              key={item.src}
              type="button"
              onClick={() => onSelect(photoIndex)}
              data-photo={`${index}:${photoIndex}`}
              aria-label={`View photo ${photoIndex + 1}: ${item.alt}`}
              aria-pressed={selected === photoIndex}
              className={styles.preview}
            >
              <Image src={item.src} alt="" fill sizes="88px"
                style={{ viewTransitionName: selected === photoIndex ? "none" : photoName(index, photoIndex) }} />
              <span>{String(photoIndex + 1).padStart(2, "0")}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Misc() {
  const [overview, setOverview] = useState(false);
  const [selected, setSelected] = useState(() => collections.map(() => 0));
  const page = useRef<HTMLElement>(null);
  const mode = useRef(false);
  const busy = useRef(false);
  const scrollPosition = useRef(0);
  const lastPhoto = useRef<PhotoPosition>({ collection: 0, photo: 0 });

  const changeView = useCallback((next: boolean, target?: PhotoPosition) => {
    if (busy.current || next === mode.current) return;
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
        page.current?.querySelector(`[data-event="${target.collection}"]`)
          ?.scrollIntoView({ behavior: "instant", block: "center" });
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
      const focusTarget = !next && target
        ? page.current?.querySelector<HTMLElement>(`[data-event="${target.collection}"]`)
        : page.current?.querySelector<HTMLElement>("[data-overview-toggle]");
      focusTarget?.focus({ preventScroll: true });
    };
    if (!document.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      update();
      finish();
      return;
    }
    const transition = document.startViewTransition(update);
    // A skipped animation must still leave the requested view usable.
    void transition.ready.catch(() => {});
    void transition.finished.then(finish, finish);
  }, []);

  useEffect(() => {
    if (!page.current) return;
    return listenForPinch(document, (direction, x, y) => {
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
      changeView(direction === "out", target);
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
          <p className={styles.overviewHint}>
            {collections.reduce((total, collection) => total + collection.photos.length, 0)} photos · Click a photo or pinch open to return
          </p>
          <div className={styles.photoGrid}>
            {collections.flatMap((collection, collectionIndex) => collection.photos.map((photo, photoIndex) => (
              <button key={photoName(collectionIndex, photoIndex)} type="button"
                className={styles.gridPhoto} data-photo={`${collectionIndex}:${photoIndex}`}
                aria-label={`Open ${photo.alt} — ${collection.title}, ${collection.date}`}
                title={`${collection.date} · ${collection.title}`}
                onClick={() => changeView(false, { collection: collectionIndex, photo: photoIndex })}>
                <Image src={photo.src} alt="" fill sizes="88px"
                  style={{ viewTransitionName: photoName(collectionIndex, photoIndex) }} />
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
          onSelect={(photo) => {
            setSelected((previous) => previous.map((value, event) => event === index ? photo : value));
            lastPhoto.current = { collection: index, photo };
          }}
        />
      ))}

      <footer className={styles.footer}>
        <Link href="/">← Back home</Link>
        <span>Layout sketch · sample events &amp; photographs</span>
      </footer>
    </main>
  );
}
