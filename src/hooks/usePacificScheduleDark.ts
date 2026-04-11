import { useEffect, useState } from "react";

/**
 * True when local time in America/Los_Angeles is in "evening" dark window:
 * from 7:30 PM through 6:00 AM (next calendar morning).
 */
export function computePacificScheduleDark(now: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const mins = hour * 60 + minute;
  const eveningStart = 19 * 60 + 30;
  const morningEnd = 6 * 60;
  return mins >= eveningStart || mins < morningEnd;
}

export function usePacificScheduleDark(): boolean {
  const [isDark, setIsDark] = useState(() => computePacificScheduleDark());

  useEffect(() => {
    const tick = () => setIsDark(computePacificScheduleDark());
    const id = setInterval(tick, 60 * 1000);
    return () => clearInterval(id);
  }, []);

  return isDark;
}
