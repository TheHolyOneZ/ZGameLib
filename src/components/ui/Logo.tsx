import { useId } from "react";

export const LOGO_Z = "M20.5 18.5h23.4c2.4 0 3.6 2.9 1.9 4.6L28.6 40.8h14.9c1.8 0 3.3 1.5 3.3 3.3s-1.5 3.3-3.3 3.3H20.1c-2.4 0-3.6-2.9-1.9-4.6L35.4 25.1H20.5c-1.8 0-3.3-1.5-3.3-3.3s1.5-3.3 3.3-3.3z";

export default function Logo({ size = 40, className, glow = false }: { size?: number; className?: string; glow?: boolean }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      style={glow ? { filter: "drop-shadow(0 8px 20px rgb(var(--accent-600) / 0.45))" } : undefined}
      role="img"
      aria-label="ZGameLib"
    >
      <defs>
        <radialGradient id={`bg-${id}`} cx="30%" cy="18%" r="95%">
          <stop offset="0" stopColor="rgb(var(--accent-800))" />
          <stop offset="0.55" stopColor="rgb(var(--accent-900) / 0.55)" />
          <stop offset="1" stopColor="#08060f" />
        </radialGradient>
        <radialGradient id={`gl-${id}`} cx="50%" cy="58%" r="45%">
          <stop offset="0" stopColor="rgb(var(--accent-500))" stopOpacity="0.55" />
          <stop offset="1" stopColor="rgb(var(--accent-500))" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`ed-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="0.35" stopColor="#fff" stopOpacity="0.04" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.1" />
        </linearGradient>
        <linearGradient id={`z-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.45" stopColor="rgb(var(--accent-200))" />
          <stop offset="1" stopColor="rgb(var(--accent-400))" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="#08060f" />
      <rect width="64" height="64" rx="15" fill={`url(#bg-${id})`} />
      <rect width="64" height="64" rx="15" fill={`url(#gl-${id})`} />
      <rect x="0.6" y="0.6" width="62.8" height="62.8" rx="14.4" fill="none" stroke={`url(#ed-${id})`} strokeWidth="1.2" />
      <path d={LOGO_Z} fill={`url(#z-${id})`} />
      <path d="M12.4 41.2v6.4M9.2 44.4h6.4" stroke="rgb(var(--accent-300))" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="51.3" cy="19.6" r="2" fill="rgb(var(--accent-300))" />
      <circle cx="55.3" cy="23.6" r="2" fill="rgb(var(--accent-300))" fillOpacity="0.7" />
    </svg>
  );
}
