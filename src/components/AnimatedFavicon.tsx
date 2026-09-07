"use client";

import { useEffect } from "react";
import frames from "../generated/favicon-frames.json";

export default function AnimatedFavicon() {
  useEffect(() => {
    const icon = document.querySelector<HTMLLinkElement>(
      'link[data-animated-favicon="true"]'
    );
    if (!icon) return;
    const favicon = icon;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setInterval> | undefined;
    let frame = 0;

    function sync() {
      clearInterval(timer);
      frame = 0;
      favicon.href = "/favicon.png";
      if (motion.matches) return;
      timer = setInterval(() => {
        frame = (frame + 1) % frames.length;
        favicon.href = frames[frame];
      }, 125);
    }

    sync();
    document.addEventListener("visibilitychange", sync);
    motion.addEventListener("change", sync);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", sync);
      motion.removeEventListener("change", sync);
    };
  }, []);

  return (
    <link
      data-animated-favicon="true"
      itemProp="image"
      rel="icon"
      type="image/png"
      sizes="64x64"
      href="/favicon.png"
    />
  );
}
