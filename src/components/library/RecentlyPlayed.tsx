import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "@/store/useGameStore";
import { timeAgo, COVER_PLACEHOLDER } from "@/lib/utils";
import { useUIStore } from "@/store/useUIStore";
import { useCover } from "@/hooks/useCover";
import { ClockIcon } from "@/components/ui/Icons";
import type { Game } from "@/lib/types";

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

function RecentCard({ game, index }: { game: Game; index: number }) {
  const setSelectedGameId = useGameStore((s) => s.setSelectedGameId);
  const setDetailOpen = useUIStore((s) => s.setDetailOpen);
  const coverUrl = useCover(game);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.35 }}
      onClick={() => { setSelectedGameId(game.id); setDetailOpen(true); }}
      className="group flex-shrink-0 w-[90px] cursor-pointer"
    >
      <div className="relative rounded-xl overflow-hidden aspect-[3/4] bg-bg-elevated border border-white/[0.04] group-hover:border-accent-500/30 transition-all duration-400 card-lift card-shine">
        <img
          src={coverUrl || COVER_PLACEHOLDER}
          alt={game.name}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
          onError={(e) => { (e.target as HTMLImageElement).src = COVER_PLACEHOLDER; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="w-8 h-8 rounded-full glass-strong flex items-center justify-center">
            <div className="w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[8px] border-l-white ml-0.5" />
          </div>
        </div>
      </div>
      <p className="text-[11px] text-slate-500 mt-2 truncate group-hover:text-slate-300 transition-colors">{game.name}</p>
      <p className="text-[9px] text-slate-700">{timeAgo(game.last_played)}</p>
    </motion.div>
  );
}

export default function RecentlyPlayed() {
  const games = useGameStore((s) => s.games);
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem("section_recentlyplayed_open") !== "false"; } catch { return true; }
  });

  const toggle = () => setOpen((v) => {
    const next = !v;
    try { localStorage.setItem("section_recentlyplayed_open", String(next)); } catch {}
    return next;
  });

  const recent = [...games]
    .filter((g) => g.last_played)
    .sort((a, b) => (b.last_played! > a.last_played! ? 1 : -1))
    .slice(0, 12);

  if (recent.length === 0) return null;

  return (
    <div className="px-6 pt-4 pb-2">
      <button
        onClick={toggle}
        className="flex items-center gap-2 mb-3 w-full text-left group"
      >
        <ClockIcon size={14} className="text-slate-600" />
        <h2 className="text-[11px] font-semibold text-slate-600 uppercase tracking-[0.15em] group-hover:text-slate-400 transition-colors">
          Recently Played
        </h2>
        <div className="flex-1 h-px bg-white/[0.03]" />
        <ChevronIcon open={open} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="recent-cards"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div className="flex gap-3 overflow-x-auto pb-3" style={{ scrollbarWidth: "none" }}>
              {recent.map((g, i) => (
                <RecentCard key={g.id} game={g} index={i} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
