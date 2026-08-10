"use client";

import { useEffect, useState } from "react";

const links = [
  { label: "GitHub", href: "https://github.com/raulkolaric" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/raulkolaric/" },
  { label: "Backup Teams", href: "https://github.com/raulkolaric/backup-teams" },
  { label: "ICS Parse", href: "https://github.com/raulkolaric/ics-parse" },
  { label: "Game of Life", href: "https://github.com/raulkolaric/jogo-da-vida-puc" },
  { label: "PUC Tech Challenge", href: "https://github.com/raulkolaric/puc-tech-challenge" },
];

export default function Home() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("theme");
    return saved === "light" ? "light" : "dark";
  });

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
              target="_blank"
              rel="noopener noreferrer"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </header>

      <button
        className="theme-toggle"
        onClick={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
        aria-label="Toggle color theme"
      >
        {theme === "light" ? "☾" : "☀"}
      </button>

      <footer className="footer">
        <span className="copyright">© raulkolaric</span>
      </footer>
    </main>
  );
}
