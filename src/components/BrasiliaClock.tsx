"use client";

import { useEffect, useState } from "react";

const brasiliaTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export default function BrasiliaClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const updateClock = () => setNow(new Date());

    updateClock();
    const interval = window.setInterval(updateClock, 1000);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <aside className="clock" aria-label="Current time in Brasília">
      <time className="clock-time" dateTime={now?.toISOString()}>
        {now ? brasiliaTime.format(now) : "--:--:--"}
      </time>
      <span className="clock-zone">Brasília Time · BRT</span>
    </aside>
  );
}
