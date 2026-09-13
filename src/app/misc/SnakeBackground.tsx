"use client";

import { useEffect, useRef } from "react";
import { createSnake, spawnApple, stepSnake } from "./snake.mjs";
import styles from "./page.module.css";

const TAIL = "@#*+=-:,.";

export default function SnakeBackground() {
  const pre = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const element = pre.current as HTMLPreElement;
    if (!element) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let timer = 0;

    function start() {
      clearInterval(timer);
      const width = Math.max(32, Math.floor(innerWidth / 5.5));
      const height = Math.max(18, Math.floor(innerHeight / 9.5));
      const snake = createSnake(width, height);
      const occupied = new Set(snake.map(({ x, y }) => `${x}:${y}`));
      const apples = Array.from({ length: 2 }, () => {
        const apple = spawnApple(width, height, occupied)!;
        occupied.add(`${apple.x}:${apple.y}`);
        return apple;
      });
      let state = { snake, apples, direction: [1, 0] };

      const frame = () => {
        const screen = Array.from({ length: height }, () => Array(width).fill(" "));
        state.apples.forEach(({ x, y }) => { screen[y][x] = "*"; });
        state.snake.forEach(({ x, y }, index) => {
          screen[y][x] = TAIL[Math.min(TAIL.length - 1, Math.floor(index * TAIL.length / state.snake.length))];
        });
        element.textContent = screen.map((row) => row.join("")).join("\n");
        state = stepSnake(state, width, height);
      };

      frame();
      if (!motion.matches) timer = window.setInterval(frame, 90);
    }

    start();
    addEventListener("resize", start);
    motion.addEventListener("change", start);
    return () => {
      clearInterval(timer);
      removeEventListener("resize", start);
      motion.removeEventListener("change", start);
    };
  }, []);

  return <pre ref={pre} className={styles.snakeBackground} aria-hidden="true" />;
}
