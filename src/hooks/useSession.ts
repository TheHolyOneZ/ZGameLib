import { useEffect, useState } from "react";
import { useUIStore } from "@/store/useUIStore";

export function useSessionSeconds(): number | null {
  const session = useUIStore((s) => s.session);
  const at = useUIStore((s) => s.sessionAt);
  const [now, setNow] = useState(() => Date.now());
  const live = !!session && session.detected && !session.idle;
  useEffect(() => {
    if (!live) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [live, at]);
  if (!session) return null;
  if (!live) return session.elapsed_secs;
  return session.elapsed_secs + Math.max(0, Math.min(15, Math.floor((now - at) / 1000)));
}

export function formatClock(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}
