"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import collectionData from "@/content/misc.json";
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

function CollectionGallery({ collection, first }: { collection: Collection; first: boolean }) {
  const [selected, setSelected] = useState(0);
  const { photos } = collection;
  const photo = photos[selected];

  return (
    <section className={styles.event} aria-label={collection.title}>
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

        <div className={styles.photo}>
          <Image
            src={photo.src}
            alt={photo.alt}
            fill
            priority={first}
            sizes="(max-width: 760px) 100vw, 55vw"
          />
        </div>

        <div className={styles.previews} role="group" aria-label="Choose a photo">
          {photos.map((item, index) => (
            <button
              key={item.src}
              type="button"
              onClick={() => setSelected(index)}
              aria-label={`View photo ${index + 1}: ${item.alt}`}
              aria-pressed={selected === index}
              className={styles.preview}
            >
              <Image src={item.src} alt="" fill sizes="88px" />
              <span>{String(index + 1).padStart(2, "0")}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Misc() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/">Raul Kolarić</Link>
        <h1>/misc</h1>
      </header>

      {collections.map((collection, index) => (
        <CollectionGallery
          key={`${collection.date}-${collection.title}`}
          collection={collection}
          first={index === 0}
        />
      ))}

      <footer className={styles.footer}>
        <Link href="/">← Back home</Link>
        <span>Layout sketch · sample events &amp; photographs</span>
      </footer>
    </main>
  );
}
