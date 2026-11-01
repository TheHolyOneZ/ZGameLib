import { formatClock, useSessionSeconds } from "@/hooks/useSession";

export default function SessionClock({ className }: { className?: string }) {
  const secs = useSessionSeconds();
  return <span className={className}>{formatClock(secs ?? 0)}</span>;
}
