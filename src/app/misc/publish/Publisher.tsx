"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { eventPath, type Collection } from "@/lib/gallery";
import styles from "./page.module.css";

type PhotoInput = {
  id: string;
  file?: File;
  src?: string;
  alt: string;
  photographer: string;
  source: string;
};

type Upload = {
  key: string;
  type: string;
  publicUrl: string;
  uploadUrl: string;
};

const MAX_IMAGE_EDGE = 2400;

async function optimizeImage(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error(`Could not process ${file.name}.`);
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => result?.type === "image/webp"
      ? resolve(result)
      : reject(new Error(`Could not optimize ${file.name}.`)), "image/webp", 0.82);
  });
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, {
    type: "image/webp",
    lastModified: file.lastModified,
  });
}

class RequestError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, body?: unknown, method = "POST"): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new RequestError(response.status, data.error || "Request failed.");
  return data;
}

function Preview({ photo }: { photo: PhotoInput }) {
  const [src, setSrc] = useState(photo.src || "");
  useEffect(() => {
    if (!photo.file) {
      setSrc(photo.src || "");
      return;
    }
    const objectUrl = URL.createObjectURL(photo.file);
    setSrc(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [photo.file, photo.src]);
  return <div className={styles.preview}>{src && <Image src={src} alt={photo.alt} fill unoptimized sizes="360px" />}</div>;
}

const inputPhotos = (collection: Collection): PhotoInput[] => collection.photos.map((photo) => ({
  id: crypto.randomUUID(),
  src: photo.src,
  alt: photo.alt || "",
  photographer: photo.photographer || "",
  source: photo.source || "",
}));

export default function Publisher({ initialAuthenticated, initialCollections }: {
  initialAuthenticated: boolean;
  initialCollections: Collection[];
}) {
  const [authenticated, setAuthenticated] = useState(initialAuthenticated);
  const [collections, setCollections] = useState(initialCollections);
  const [editingPath, setEditingPath] = useState<string>();
  const [password, setPassword] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<PhotoInput[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const path = eventPath(date, title);

  const clearEditor = () => {
    setEditingPath(undefined);
    setTitle("");
    setDate("");
    setDescription("");
    setPhotos([]);
    setMessage("");
    setSuccess(false);
  };

  const edit = (collection: Collection) => {
    setEditingPath(eventPath(collection.date, collection.title));
    setTitle(collection.title);
    setDate(collection.date);
    setDescription(collection.description || "");
    setPhotos(inputPhotos(collection));
    setMessage("");
    setSuccess(false);
  };

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await request("/api/publish/login", { password });
      setPassword("");
      setAuthenticated(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    setBusy(true);
    try {
      await request("/api/publish/logout");
    } finally {
      setAuthenticated(false);
      setBusy(false);
      clearEditor();
    }
  };

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const allowed = new Set(["image/jpeg", "image/webp", "image/png"]);
    const next = Array.from(files);
    const invalid = next.find((file) => !allowed.has(file.type) || file.size < 1 || file.size > 15 * 1024 * 1024);
    if (invalid) {
      setSuccess(false);
      setMessage(`${invalid.name} must be a JPEG, WebP, or PNG no larger than 15 MB.`);
      return;
    }
    if (photos.length + next.length > 50) {
      setSuccess(false);
      setMessage("Keep no more than 50 images.");
      return;
    }
    setMessage("");
    setPhotos((current) => [...current, ...next.map((file) => ({
      id: crypto.randomUUID(),
      file,
      alt: "",
      photographer: "",
      source: "",
    }))]);
  };

  const updatePhoto = (id: string, changes: Partial<PhotoInput>) => {
    setPhotos((current) => current.map((photo) => photo.id === id ? { ...photo, ...changes } : photo));
  };

  const movePhoto = (index: number, offset: number) => {
    setPhotos((current) => {
      const next = [...current];
      [next[index], next[index + offset]] = [next[index + offset], next[index]];
      return next;
    });
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setSuccess(false);
    const newPhotos = photos.filter((photo) => photo.file);
    setMessage(newPhotos.length ? `Optimizing ${newPhotos.length} new image${newPhotos.length === 1 ? "" : "s"}…` : "Saving event…");
    let uploads: Upload[] = [];
    try {
      if (newPhotos.length) {
        const files: File[] = [];
        for (const photo of newPhotos) files.push(await optimizeImage(photo.file!));
        setMessage("Preparing uploads…");
        const prepared = await request<{ path: string; uploads: Upload[] }>("/api/publish/upload", {
          title,
          date,
          ...(editingPath ? { originalPath: editingPath } : {}),
          files: files.map((file) => ({ name: file.name, type: file.type, size: file.size })),
        });
        uploads = prepared.uploads;
        setMessage(`Uploading ${uploads.length} image${uploads.length === 1 ? "" : "s"}…`);
        const results = await Promise.allSettled(uploads.map((upload, index) => fetch(upload.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": upload.type },
          body: files[index],
        }).then((response) => {
          if (!response.ok) throw new Error(`Upload failed with ${response.status}`);
        })));
        if (results.some((result) => result.status === "rejected")) throw new Error("One or more image uploads failed.");
      }

      let uploadIndex = 0;
      setMessage(editingPath ? "Saving changes…" : "Publishing gallery metadata…");
      const result = await request<{ path: string; collection: Collection }>("/api/publish/event", {
        ...(editingPath ? { originalPath: editingPath } : {}),
        title,
        date,
        description,
        photos: photos.map((photo) => ({
          ...(photo.file ? { key: uploads[uploadIndex++].key } : { src: photo.src }),
          alt: photo.alt,
          photographer: photo.photographer,
          source: photo.source,
        })),
      }, editingPath ? "PUT" : "POST");

      setCollections((current) => (editingPath
        ? current.map((collection) => eventPath(collection.date, collection.title) === editingPath
          ? result.collection : collection)
        : [result.collection, ...current]).sort((a, b) => b.date.localeCompare(a.date)));
      setEditingPath(result.path);
      setPhotos(inputPhotos(result.collection));
      setSuccess(true);
      setMessage(editingPath ? "Changes saved." : "Event published.");
    } catch (error) {
      if (error instanceof RequestError && error.status === 401) setAuthenticated(false);
      const reason = error instanceof Error ? error.message : "Saving failed.";
      const keys = uploads.map(({ key }) => key);
      setMessage(keys.length ? `${reason} Check these possibly orphaned R2 keys: ${keys.join(", ")}` : reason);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <Link href="/misc">← /misc</Link>
          <h1>Gallery publisher</h1>
        </div>
        {authenticated && <button type="button" onClick={logout} disabled={busy}>Log out</button>}
      </header>

      {!authenticated ? (
        <form className={styles.login} onSubmit={login}>
          <label htmlFor="password">Publishing password</label>
          <input id="password" type="password" autoComplete="current-password" required autoFocus
            value={password} onChange={(event) => setPassword(event.target.value)} />
          <button disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        </form>
      ) : (
        <div className={styles.workspace}>
          <aside className={styles.eventList} aria-label="Events">
            <div className={styles.listHeading}>
              <h2>Events</h2>
              <span>{collections.length}</span>
            </div>
            <button type="button" className={styles.newEvent} disabled={busy}
              onClick={clearEditor}>+ New event</button>
            <div className={styles.eventButtons}>
              {collections.map((collection) => {
                const collectionPath = eventPath(collection.date, collection.title);
                return (
                  <button type="button" key={collectionPath} disabled={busy}
                    aria-pressed={editingPath === collectionPath}
                    onClick={() => edit(collection)}>
                    <strong>{collection.title}</strong>
                    <span>{collection.date} · {collection.photos.length} photos</span>
                  </button>
                );
              })}
            </div>
          </aside>

          <form className={styles.form} onSubmit={save}>
            <fieldset className={styles.editorFields} disabled={busy}>
              <div className={styles.editorHeading}>
              <div>
                <p>{editingPath ? "Editing event" : "New event"}</p>
                <h2>{editingPath ? title : "Create a gallery event"}</h2>
              </div>
                {editingPath && <button type="button" onClick={clearEditor}>Cancel</button>}
              </div>

            <section className={styles.panel}>
              <h3>Event details</h3>
              <div className={styles.eventFields}>
                <label>
                  Event title
                  <input required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} />
                </label>
                <label>
                  Date
                  <input required type="date" value={date} onChange={(event) => setDate(event.target.value)} />
                </label>
              </div>
              <label>
                Description <span>(optional)</span>
                <textarea maxLength={1000} rows={4} value={description}
                  onChange={(event) => setDescription(event.target.value)} />
              </label>
              <p className={styles.path}>/{path || "misc/YYYY-MM-DD-event/"}</p>
            </section>

            <section className={styles.panel}>
              <div className={styles.photoHeading}>
                <div>
                  <h3>Photos</h3>
                  <p>{photos.length} of 50</p>
                </div>
                <label className={styles.filePicker}>
                  + Add images
                  <input type="file" accept="image/jpeg,image/webp,image/png" multiple
                    onChange={(event) => {
                      addFiles(event.target.files);
                      event.target.value = "";
                    }} />
                </label>
              </div>

              {photos.length === 0 ? (
                <label className={styles.emptyPhotos}>
                  <strong>Add the first images</strong>
                  <span>JPEG, PNG, or WebP · up to 15 MB each</span>
                  <input type="file" accept="image/jpeg,image/webp,image/png" multiple
                    onChange={(event) => {
                      addFiles(event.target.files);
                      event.target.value = "";
                    }} />
                </label>
              ) : (
                <div className={styles.photos}>
                  {photos.map((photo, index) => (
                    <fieldset key={photo.id} className={styles.photo}>
                      <legend>{String(index + 1).padStart(2, "0")}</legend>
                      <Preview photo={photo} />
                      <div className={styles.photoFields}>
                        <p className={styles.fileName}>{photo.file?.name || photo.src?.split("/").at(-1)}</p>
                        <label>
                          Alt text <span>(optional)</span>
                          <textarea maxLength={500} rows={2} value={photo.alt}
                            onChange={(event) => updatePhoto(photo.id, { alt: event.target.value })} />
                        </label>
                        <div className={styles.creditFields}>
                          <label>
                            Photographer <span>(optional)</span>
                            <input maxLength={160} value={photo.photographer}
                              onChange={(event) => updatePhoto(photo.id, { photographer: event.target.value })} />
                          </label>
                          <label>
                            Source URL <span>(optional)</span>
                            <input type="url" maxLength={2048} placeholder="https://"
                              value={photo.source} onChange={(event) => updatePhoto(photo.id, { source: event.target.value })} />
                          </label>
                        </div>
                        <div className={styles.photoActions}>
                          <button type="button" disabled={index === 0} onClick={() => movePhoto(index, -1)}>Move up</button>
                          <button type="button" disabled={index === photos.length - 1} onClick={() => movePhoto(index, 1)}>Move down</button>
                          <button type="button" className={styles.remove}
                            onClick={() => setPhotos((current) => current.filter(({ id }) => id !== photo.id))}>
                            Remove
                          </button>
                        </div>
                      </div>
                    </fieldset>
                  ))}
                </div>
              )}
              </section>
            </fieldset>

            <div className={styles.saveBar}>
              <button className={styles.publish} disabled={busy || !path || photos.length === 0}>
                {busy ? "Working…" : editingPath ? "Save changes" : "Upload and publish"}
              </button>
              {message && <p className={success ? styles.success : styles.message} role="status">{message}</p>}
            </div>
          </form>
        </div>
      )}

      {!authenticated && message && <p className={styles.message} role="status">{message}</p>}
    </main>
  );
}
