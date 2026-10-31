import { useRef, useState, useEffect, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "@/store/useGameStore";
import { useUIStore } from "@/store/useUIStore";
import GameCover from "@/components/ui/GameCover";
import GameContextMenu from "@/components/ui/GameContextMenu";
import { useLaunchGame } from "@/lib/useLaunchGame";
import { cn } from "@/lib/utils";
import { ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon, PlayIcon, CloseIcon } from "@/components/ui/Icons";
import type { Game } from "@/lib/types";

export function ShelfCard({ game, sub, badge, onDismiss, index = 0 }: { game: Game; sub?: string; badge?: ReactNode; onDismiss?: () => void; index?: number }) {
  const setSelectedGameId = useGameStore((s) => s.setSelectedGameId);
  const setDetailOpen = useUIStore((s) => s.setDetailOpen);
  const running = useUIStore((s) => s.activeGameId === game.id);
  const { launch } = useLaunchGame();

  return (
    <GameContextMenu game={game}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(index, 10) * 0.03, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        onClick={() => { setSelectedGameId(game.id); setDetailOpen(true); }}
        className="group shrink-0 w-[128px] cursor-pointer relative"
      >
        <div className={cn("relative aspect-[3/4] rounded-xl overflow-hidden card-lift ring-1", running ? "ring-2 ring-emerald-400/80" : "ring-white/[0.07]")} style={{ boxShadow: "0 10px 24px -12px rgba(0,0,0,0.8)" }}>
          <GameCover game={game} imgClassName="transition-transform duration-700 ease-out group-hover:scale-[1.07]" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <button
            onClick={(e) => { e.stopPropagation(); launch(game); }}
            className="absolute inset-0 m-auto w-11 h-11 rounded-full flex items-center justify-center text-white opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300"
            style={{ background: "linear-gradient(180deg, rgb(var(--accent-400)), rgb(var(--accent-600)))", boxShadow: "0 8px 24px -6px rgb(var(--accent-500) / 0.9)" }}
            title="Play"
          >
            <PlayIcon size={16} className="ml-0.5" />
          </button>
          {badge && <div className="absolute bottom-1.5 left-1.5 right-1.5">{badge}</div>}
          {onDismiss && (
            <button
              onClick={(e) => { e.stopPropagation(); onDismiss(); }}
              className="absolute top-1.5 right-1.5 w-6 h-6 rounded-lg bg-black/60 backdrop-blur flex items-center justify-center text-white/70 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
              title="Not interested"
            >
              <CloseIcon size={10} />
            </button>
          )}
        </div>
        <p className="text-[12px] font-medium text-slate-300 mt-2 truncate group-hover:text-white transition-colors">{game.name}</p>
        {sub && <p className="text-[10.5px] text-slate-500 truncate">{sub}</p>}
      </motion.div>
    </GameContextMenu>
  );
}

export default function Shelf({ title, icon, storageKey, hint, children, count }: { title: string; icon: ReactNode; storageKey?: string; hint?: string; children: ReactNode; count?: number }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const [open, setOpen] = useState(() => {
    if (!storageKey) return true;
    try { return localStorage.getItem(storageKey) !== "false"; } catch { return true; }
  });

  const update = () => {
    const el = scroller.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    update();
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, children]);

  const toggle = () => setOpen((v) => {
    const next = !v;
    if (storageKey) { try { localStorage.setItem(storageKey, String(next)); } catch {} }
    return next;
  });

  const page = (dir: 1 | -1) => scroller.current?.scrollBy({ left: dir * scroller.current.clientWidth * 0.8, behavior: "smooth" });

  return (
    <section className="px-8 pt-6">
      <div className="flex items-center gap-2.5 mb-3">
        <button onClick={toggle} className="flex items-center gap-2.5 group">
          <span className="w-7 h-7 rounded-lg flex items-center justify-center text-accent-300" style={{ background: "rgb(var(--accent-500) / 0.14)" }}>{icon}</span>
          <h2 className="text-[15px] font-semibold text-white">{title}</h2>
          {count !== undefined && <span className="text-[12px] text-slate-500 tabular-nums">{count}</span>}
          <motion.span animate={{ rotate: open ? 0 : -90 }} className="text-slate-600 group-hover:text-slate-300 transition-colors"><ChevronDownIcon size={12} /></motion.span>
        </button>
        {hint && open && <span className="text-[11.5px] text-slate-500 ml-1">{hint}</span>}
        <div className="flex-1" />
        {open && (canLeft || canRight) && (
          <div className="flex gap-1">
            <button disabled={!canLeft} onClick={() => page(-1)} className="btn-icon w-7 h-7 disabled:opacity-30 disabled:pointer-events-none"><ChevronLeftIcon size={13} /></button>
            <button disabled={!canRight} onClick={() => page(1)} className="btn-icon w-7 h-7 disabled:opacity-30 disabled:pointer-events-none"><ChevronRightIcon size={13} /></button>
          </div>
        )}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden -mx-8"
          >
            <div ref={scroller} onScroll={update} className="flex gap-4 overflow-x-auto scrollbar-none px-8 pt-1 pb-2">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
