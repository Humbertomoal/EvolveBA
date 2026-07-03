"use client";

import { useEffect, useRef, useState } from "react";

export default function CountdownTimer({
  fechaFin,
  precision = "minutes",
  className,
}: {
  fechaFin: Date | string;
  precision?: "seconds" | "minutes";
  className?: string;
}) {
  const targetMs = (
    typeof fechaFin === "string" ? new Date(fechaFin) : fechaFin
  ).getTime();

  const spanRef = useRef<HTMLSpanElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [ms, setMs] = useState(() => Math.max(0, targetMs - Date.now()));
  const [visible, setVisible] = useState(false);

  // Pause when scrolled out of view
  useEffect(() => {
    const el = spanRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Start/stop interval based on visibility
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (!visible) return;

    // Sync immediately on becoming visible (time may have passed while hidden)
    setMs(Math.max(0, targetMs - Date.now()));

    const delay = precision === "seconds" ? 1_000 : 60_000;
    intervalRef.current = setInterval(() => {
      setMs(Math.max(0, targetMs - Date.now()));
    }, delay);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [visible, targetMs, precision]);

  // Format and color
  let text: string;
  let colorClass: string;

  if (ms <= 0) {
    text = "Tiempo agotado";
    colorClass = "text-red-600";
  } else {
    const totalSec = Math.floor(ms / 1000);
    const days = Math.floor(totalSec / 86_400);
    const hours = Math.floor((totalSec % 86_400) / 3_600);
    const mins = Math.floor((totalSec % 3_600) / 60);
    const secs = totalSec % 60;

    if (days > 0) text = `${days}d ${hours}h ${mins}m`;
    else if (hours > 0) text = `${hours}h ${mins}m`;
    else if (precision === "seconds") text = `${mins}m ${secs}s`;
    else text = `${mins}m`;

    if (ms < 2 * 60_000) colorClass = "text-red-600 animate-pulse";
    else if (ms < 30 * 60_000) colorClass = "text-amber-600";
    else colorClass = "text-emerald-600";
  }

  return (
    <span
      ref={spanRef}
      className={`font-semibold ${colorClass}${className ? ` ${className}` : ""}`}
    >
      {text}
    </span>
  );
}
