"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { eventPath } from "@/lib/gallery";
import styles from "./page.module.css";

type PhotoInput = {
  id: string;
  file: File;
  alt: string;
};

type Upload = {
  key: string;
  type: string;
  publicUrl: string;
  uploadUrl: string;
};

class RequestError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new RequestError(response.status, data.error || "Request failed.");
  return data;
}

function Preview({ file, alt }: { file: File; alt: string }) {
  const [src] = useState(() => URL.createObjectURL(file));
  useEffect(() => () => URL.revokeObjectURL(src), [src]);
  return <div className={styles.preview}><Image src={src} alt={alt} fill unoptimized sizes="360px" /></div>;
}

export default function Publisher({ initialAuthenticated }: { initialAuthenticated: boolean }) {
  const [authenticated, setAuthenticated] = useState(initialAuthenticated);
  const [password, setPassword] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<PhotoInput[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const path = eventPath(date, title);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await post("/api/publish/login", { password });
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
      await post("/api/publish/logout");
    } finally {
      setAuthenticated(false);
      setBusy(false);
      setMessage("");
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
      setMessage("Choose no more than 50 images.");
      return;
    }
    setMessage("");
    setPhotos((current) => [...current, ...next.map((file) => ({
      id: crypto.randomUUID(),
      file,
      alt: "",
    }))]);
  };

  const updateAlt = (id: string, alt: string) => {
    setPhotos((current) => current.map((photo) => photo.id === id ? { ...photo, alt } : photo));
  };

  const publish = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setSuccess(false);
    setMessage("Preparing uploads…");
    let uploads: Upload[] = [];
    try {
      const prepared = await post<{ path: string; uploads: Upload[] }>("/api/publish/upload", {
        title,
        date,
        files: photos.map(({ file }) => ({ name: file.name, type: file.type, size: file.size })),
      });
      uploads = prepared.uploads;
      setMessage(`Uploading ${uploads.length} image${uploads.length === 1 ? "" : "s"}…`);
      const results = await Promise.allSettled(uploads.map((upload, index) => fetch(upload.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": upload.type },
        body: photos[index].file,
      }).then((response) => {
        if (!response.ok) throw new Error(`Upload failed with ${response.status}`);
      })));
      if (results.some((result) => result.status === "rejected")) throw new Error("One or more image uploads failed.");

      setMessage("Publishing gallery metadata…");
      await post("/api/publish/event", {
        title,
        date,
        description,
        photos: photos.map((photo, index) => ({
          key: uploads[index].key,
          alt: photo.alt,
        })),
      });
      setSuccess(true);
      setMessage(`Published ${prepared.path}`);
      setTitle("");
      setDate("");
      setDescription("");
      setPhotos([]);
    } catch (error) {
      if (error instanceof RequestError && error.status === 401) setAuthenticated(false);
      const reason = error instanceof Error ? error.message : "Publishing failed.";
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
          <h1>Publish an event</h1>
        </div>
        {authenticated && <button type="button" onClick={logout} disabled={busy}>Log out</button>}
      </header>

      {!authenticated ? (
        <form className={styles.login} onSubmit={login}>
          <label htmlFor="password">Publishing password</label>
          <input id="password" type="password" autoComplete="current-password" required
            value={password} onChange={(event) => setPassword(event.target.value)} />
          <button disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        </form>
      ) : (
        <form className={styles.form} onSubmit={publish}>
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
            Event description (optional)
            <textarea maxLength={1000} rows={3} value={description}
              onChange={(event) => setDescription(event.target.value)} />
          </label>

          <p className={styles.path}>/{path || "misc/YYYY-MM-DD-event/"}</p>

          <label className={styles.filePicker}>
            Choose images
            <input type="file" accept="image/jpeg,image/webp,image/png" multiple
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = "";
              }} />
          </label>

          <div className={styles.photos}>
            {photos.map((photo, index) => (
              <fieldset key={photo.id} className={styles.photo}>
                <legend>{String(index + 1).padStart(2, "0")} · {photo.file.name}</legend>
                <Preview file={photo.file} alt={photo.alt} />
                <label>
                  Alt text (optional)
                  <textarea maxLength={500} rows={2} value={photo.alt}
                    onChange={(event) => updateAlt(photo.id, event.target.value)} />
                </label>
                <button type="button" className={styles.remove}
                  onClick={() => setPhotos((current) => current.filter(({ id }) => id !== photo.id))}>
                  Remove
                </button>
              </fieldset>
            ))}
          </div>

          <button className={styles.publish} disabled={busy || !path || photos.length === 0}>
            {busy ? "Working…" : "Upload and publish"}
          </button>
        </form>
      )}

      {message && <p className={success ? styles.success : styles.message} role="status">{message}</p>}
    </main>
  );
}
