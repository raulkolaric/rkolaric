"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AsciiBackground from "@/components/AsciiBackground";
import { preloadGalleryImage } from "./misc/preload.mjs";
// import BrasiliaClock from "@/components/BrasiliaClock";

const contactLinks = [
  { label: "Email", href: "mailto:rlkolaric+website@gmail.com" },
  { label: "GitHub", href: "https://github.com/raulkolaric" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/raulkolaric/" },
];

const projectLinks = [
  { label: "Backup Teams", href: "https://github.com/raulkolaric/backup-teams" },
  { label: "ICS Parse", href: "https://github.com/raulkolaric/ics-parse" },
  { label: "Mapari", href: "https://mapari.app/" },
];

const resumeUrl = "https://photos.rkolaric.com/resume/raul-kolaric-en.pdf";

export default function Home() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  // Restore saved theme on mount.
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch("/api/misc/prefetch", { signal: controller.signal })
        .then((response) => response.ok ? response.json() as Promise<string[]> : [])
        .then(async (photos) => {
          for (const src of photos) {
            if (cancelled) return;
            await preloadGalleryImage(src);
          }
        })
        .catch(() => {});
    }, 750);
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem("theme", nextTheme);
    setTheme(nextTheme);
  };

  return (
    <main className="page">
      <header className="masthead">
        <h1 className="name">Raul Kolarić</h1>
        <p className="tagline">Automation, Cloud, Open Source · CS @ PUC-SP</p>

        <nav className="links" aria-label="Portfolio links">
          <div className="contact-links">
            {contactLinks.map((link, index) => <span key={link.label}>
              {index > 0 && <span aria-hidden="true"> · </span>}
              <a
              href={link.href}
              target={link.href.startsWith("http") ? "_blank" : undefined}
              rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
              >{link.label}</a>
            </span>)}
          </div>

          <a href={resumeUrl} target="_blank" rel="noopener noreferrer">
            Résumé
          </a>

          {projectLinks.map((link) => <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {link.label}
          </a>)}

          <Link className="misc-link" href="/misc">Misc</Link>
        </nav>
      </header>

      <button
        className="theme-toggle"
        onClick={toggleTheme}
        aria-label="Toggle color theme"
      >
        {theme === "light" ? "☾" : "☀︎"}
      </button>

      {/* ─── ASCII animation (ported from shapes.c) ──────────────── */}
      <div className="stage">
        <AsciiBackground />
      </div>

      <div className="bottom-bar">
        <footer className="footer">
          <span className="copyright">© raulkolaric</span>
        </footer>

        {/* <BrasiliaClock /> */}
      </div>
    </main>
  );
}
