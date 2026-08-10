"use client";

import { useEffect, useState } from "react";
import AsciiBackground from "@/components/AsciiBackground";

// Left-column links. Add/remove freely — order is preserved.
const links = [
  { label: "GitHub", href: "https://github.com/raulkolaric" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/raulkolaric/" },
  { label: "Backup Teams", href: "https://github.com/raulkolaric/backup-teams" },
  { label: "ICS Parse", href: "https://github.com/raulkolaric/ics-parse" },
  { label: "Game of Life", href: "https://github.com/raulkolaric/jogo-da-vida-puc" },
  { label: "PUC Tech Challenge", href: "https://github.com/raulkolaric/puc-tech-challenge" },
];

export default function Home() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  // Restore saved theme on mount.
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
    }
  }, []);

  // Reflect theme on <html> so CSS variables switch.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <main className="page">
      <header className="masthead">
        <h1 className="name">Raul Kolarić</h1>
        <p className="tagline">Full Stack Developer · CS @ PUC-SP</p>

        <nav className="links">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target={link.href.startsWith("http") ? "_blank" : undefined}
              rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
            >
              {link.label}
            </a>
          ))}
        </nav>
      </header>

      <button
        className="theme-toggle"
        onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
        aria-label="Toggle color theme"
      >
        {theme === "light" ? "☾" : "☀"}
      </button>

      {/* ─── ASCII animation (ported from shapes.c) ──────────────── */}
      <div className="stage">
        <AsciiBackground />
      </div>

      <footer className="footer">
        <span className="copyright">© raulkolaric</span>
      </footer>
    </main>
  );
}
