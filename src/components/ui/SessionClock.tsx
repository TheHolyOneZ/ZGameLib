import { useUIStore } from "@/store/useUIStore";
import { formatClock, useSessionSeconds } from "@/hooks/useSession";

export default function SessionClock({ className }: { className?: string }) {
  const secs = useSessionSeconds();
  const starting = useUIStore((s) => !!s.session && !s.session.detected);
  return <span className={className}>{starting ? "Starting…" : formatClock(secs ?? 0)}</span>;
}
