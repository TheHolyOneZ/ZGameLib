import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "@/store/useGameStore";
import { useUIStore } from "@/store/useUIStore";
import { useCover } from "@/hooks/useCover";
import { COVER_PLACEHOLDER } from "@/lib/utils";
import { CloseIcon } from "@/components/ui/Icons";
import type { Game } from "@/lib/types";

function RecommendCard({ game, matchCount, onDismiss }: { game: Game; matchCount: number; onDismiss: () => void }) {
  const setSelectedGameId = useGameStore((s) => s.setSelectedGameId);
  const setDetailOpen = useUIStore((s) => s.setDetailOpen);
  const coverUrl = useCover(game);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.25 }}
      className="group flex-shrink-0 w-[88px] cursor-pointer relative"
    >
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(); }}
        className="absolute -top-1.5 -right-1.5 z-10 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.12)" }}
        title="Not interested"
      >
        <CloseIcon size={9} className="text-slate-300" />
      </button>

      <div
        onClick={() => { setSelectedGameId(game.id); setDetailOpen(true); }}
        className="relative rounded-xl overflow-hidden aspect-[3/4] border border-accent-500/15 group-hover:border-accent-500/40 transition-all duration-300 card-lift"
      >
        <img
          src={coverUrl || COVER_PLACEHOLDER}
          alt={game.name}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
          onError={(e) => { (e.target as HTMLImageElement).src = COVER_PLACEHOLDER; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        {matchCount > 0 && (
          <div className="absolute bottom-1.5 left-1 right-1">
            <span className="block text-center text-[9px] font-medium px-1 py-0.5 rounded-md" style={{ background: "rgb(var(--accent-600) / 0.9)", color: "rgb(var(--accent-200))" }}>
              {matchCount} match{matchCount !== 1 ? "es" : ""}
            </span>
          </div>
        )}
      </div>
      <p className="text-[10px] text-slate-500 mt-1.5 truncate group-hover:text-slate-200 transition-colors">{game.name}</p>
    </motion.div>
  );
}

function SparkleIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-accent-400">
      <path d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z" fill="currentColor"/>
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12" height="12" viewBox="0 0 24 24" fill="none"
      className="text-slate-600 transition-transform duration-300"
      style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
    >
      <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function Recommendations() {
  const games = useGameStore((s) => s.games);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem("section_playnext_open") !== "false"; } catch { return true; }
  });

  const toggle = () => setOpen((v) => {
    const next = !v;
    try { localStorage.setItem("section_playnext_open", String(next)); } catch {}
    return next;
  });

  const recommendations = useMemo(() => {
    const highRated = games.filter((g) => (g.rating ?? 0) >= 8);
    if (highRated.length < 3) return [];

    const tasteTags = new Set(highRated.flatMap((g) => g.tags));
    const tasteGenres = new Set(highRated.map((g) => g.genre).filter(Boolean) as string[]);

    const eligible = games.filter(
      (g) => (g.status === "none" || g.status === "backlog") && g.playtime_mins < 30
    );
    if (eligible.length < 3) return [];

    const scored = eligible.map((g) => {
      const tagMatches = g.tags.filter((t) => tasteTags.has(t)).length;
      const genreMatch = g.genre && tasteGenres.has(g.genre) ? 1 : 0;
      const score = tagMatches * 2 + genreMatch * 3;
      const daysOld = Math.floor((Date.now() - new Date(g.date_added).getTime()) / 86400000);
      return { game: g, score, tagMatches: tagMatches + genreMatch, daysOld };
    });

    return scored
      .sort((a, b) => b.score - a.score || b.daysOld - a.daysOld)
      .slice(0, 5);
  }, [games]);

  const visible = recommendations.filter((r) => !dismissed.has(r.game.id));

  if (visible.length === 0) return null;

  return (
    <div className="px-6 pt-4 pb-2">
      <button
        onClick={toggle}
        className="flex items-center gap-2 mb-3 w-full text-left group"
      >
        <SparkleIcon />
        <h2 className="text-[11px] font-semibold text-slate-600 uppercase tracking-[0.15em] group-hover:text-slate-400 transition-colors">
          Play Next
        </h2>
        <div className="flex-1 h-px bg-white/[0.03]" />
        {open && <span className="text-[10px] text-slate-700">Based on your highly-rated games</span>}
        <ChevronIcon open={open} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="playnext-cards"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div className="flex gap-3 overflow-x-auto pb-3" style={{ scrollbarWidth: "none" }}>
              <AnimatePresence>
                {visible.map(({ game, tagMatches }) => (
                  <RecommendCard
                    key={game.id}
                    game={game}
                    matchCount={tagMatches}
                    onDismiss={() => setDismissed((s) => new Set([...s, game.id]))}
                  />
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
