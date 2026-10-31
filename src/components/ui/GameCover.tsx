import { useState, useEffect, useRef, memo } from "react";
import { useCover } from "@/hooks/useCover";
import { cn } from "@/lib/utils";
import { cleanTitle } from "@/lib/gameName";
import type { Game } from "@/lib/types";

function hashHue(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function initials(name: string) {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function CoverFallback({ name, className, large }: { name: string; className?: string; large?: boolean }) {
  name = cleanTitle(name);
  const hue = hashHue(name);
  return (
    <div
      className={cn("w-full h-full flex flex-col items-center justify-center relative overflow-hidden", className)}
      style={{
        background: `radial-gradient(120% 90% at 20% 10%, hsl(${hue} 70% 32% / 0.95) 0%, hsl(${(hue + 40) % 360} 60% 14%) 55%, hsl(${(hue + 80) % 360} 50% 7%) 100%)`,
      }}
    >
      <div
        className="absolute inset-0 opacity-[0.15]"
        style={{ backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,0.5) 0 1px, transparent 1px 14px)" }}
      />
      <span className={cn("relative font-display font-bold text-white/90 tracking-tight drop-shadow-lg", large ? "text-6xl" : "text-3xl")}>
        {initials(name)}
      </span>
    </div>
  );
}

const NO_COVER = { cover_path: null };

function GameCoverInner({ game, className, imgClassName, large, eager }: { game: Game; className?: string; imgClassName?: string; large?: boolean; eager?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(!!eager);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setVisible(true); io.disconnect(); }
    }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  const src = useCover(visible ? game : ({ ...game, ...NO_COVER } as Game));
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const failed = !!src && failedSrc === src;
  const loaded = !!src && loadedSrc === src;

  useEffect(() => {
    setTimedOut(false);
    if (!visible || !game.cover_path || src) return;
    const t = setTimeout(() => setTimedOut(true), 5000);
    return () => clearTimeout(t);
  }, [visible, game.cover_path, src]);

  const hasPath = !!game.cover_path;
  const showImg = !!src && !failed;
  const showFallback = !hasPath || failed || (timedOut && !src);
  const showPulse = hasPath && !showImg && !showFallback;

  return (
    <div ref={ref} className={cn("relative w-full h-full overflow-hidden bg-bg-elevated", className)}>
      {showFallback && <CoverFallback name={game.name} large={large} />}
      {showPulse && <div className="absolute inset-0 bg-white/[0.04] animate-pulse" />}
      {showImg && (
        <img
          src={src ?? undefined}
          alt={game.name}
          loading="lazy"
          draggable={false}
          ref={(img) => { if (img && img.complete && img.naturalWidth > 0 && loadedSrc !== src) setLoadedSrc(src); }}
          onLoad={() => setLoadedSrc(src)}
          onError={() => setFailedSrc(src)}
          className={cn("w-full h-full object-cover transition-opacity duration-500", loaded ? "opacity-100" : "opacity-0", imgClassName)}
        />
      )}
    </div>
  );
}

const GameCover = memo(GameCoverInner);
export default GameCover;
