"use client";

import { useEffect, useState } from "react";
import { bn } from "@/lib/format";

interface Counting {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  over: boolean;
}

function diff(target: string): Counting {
  const end = new Date(`${target}T09:00:00`).getTime();
  const now = Date.now();
  const delta = end - now;
  if (!Number.isFinite(end) || delta <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, over: true };
  const seconds = Math.floor(delta / 1000);
  return {
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
    over: false,
  };
}

/** Live countdown to the fair — the heartbeat of the big homepage banner. */
export function Countdown({ date, label = "মেলা শুরু হবে" }: { date: string; label?: string }) {
  const [value, setValue] = useState<Counting>(() => diff(date));

  useEffect(() => {
    setValue(diff(date));
    const timer = setInterval(() => setValue(diff(date)), 1000);
    return () => clearInterval(timer);
  }, [date]);

  if (!date) return null;

  if (value.over) {
    return (
      <div className="countdown" aria-live="polite">
        <div style={{ gridColumn: "1 / -1" }}>
          <strong>মেলা শুরু হয়ে গেছে 🎉</strong>
          <small>স্বাগতম</small>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p style={{ margin: "0 0 8px", fontSize: 13, letterSpacing: ".1em", textTransform: "uppercase", opacity: 0.78 }}>{label}</p>
      <div className="countdown" aria-live="polite">
        <div>
          <strong>{bn(value.days)}</strong>
          <small>দিন</small>
        </div>
        <div>
          <strong>{bn(value.hours)}</strong>
          <small>ঘণ্টা</small>
        </div>
        <div>
          <strong>{bn(value.minutes)}</strong>
          <small>মিনিট</small>
        </div>
        <div>
          <strong>{bn(value.seconds)}</strong>
          <small>সেকেন্ড</small>
        </div>
      </div>
    </div>
  );
}
