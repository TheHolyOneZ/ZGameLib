import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "@/store/useGameStore";
import { useUIStore } from "@/store/useUIStore";
import { cn } from "@/lib/utils";
import type { GameStatus, Platform } from "@/lib/types";
import FilterBuilder from "./FilterBuilder";
import {
  SteamIcon, EpicIcon, GogIcon, UbisoftIcon, CustomGameIcon, ImageIcon, DownloadIcon,
  SlidersIcon, ChevronDownIcon, HeartIcon, StarIcon,
} from "@/components/ui/Icons";

const PLATFORMS: { key: Platform; label: string; icon: typeof SteamIcon }[] = [
  { key: "steam", label: "Steam", icon: SteamIcon },
  { key: "epic", label: "Epic Games", icon: EpicIcon },
  { key: "gog", label: "GOG", icon: GogIcon },
  { key: "ubisoft", label: "Ubisoft", icon: UbisoftIcon },
  { key: "custom", label: "Custom", icon: CustomGameIcon },
];

export default function FilterPopover({ hideFavorite }: { hideFavorite?: boolean }) {
  const games = useGameStore((s) => s.games);
  const filters = useGameStore((s) => s.filters);
  const setFilter = useGameStore((s) => s.setFilter);
  const resetFilters = useGameStore((s) => s.resetFilters);
  const filterRules = useGameStore((s) => s.filterRules);
  const clearFilterRules = useGameStore((s) => s.clearFilterRules);
  const customStatuses = useUIStore((s) => s.customStatuses);
  const [open, setOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onRules = () => { setOpen(true); setRulesOpen(true); };
    const onClose = () => { setOpen(false); setRulesOpen(false); };
    window.addEventListener("tour:filters-open", onOpen);
    window.addEventListener("tour:filters-rules", onRules);
    window.addEventListener("tour:filters-close", onClose);
    return () => {
      window.removeEventListener("tour:filters-open", onOpen);
      window.removeEventListener("tour:filters-rules", onRules);
      window.removeEventListener("tour:filters-close", onClose);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Element;
      if (ref.current?.contains(t) || t.closest?.("[data-tour-card]")) return;
      if (useUIStore.getState().tourOpen) return;
      setOpen(false);
    };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", handler);
    window.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", handler); window.removeEventListener("keydown", key); };
  }, [open]);

  const counts = useMemo(() => {
    const platform: Record<string, number> = {};
    const status: Record<string, number> = {};
    let noCover = 0, notInstalled = 0;
    for (const g of games) {
      platform[g.platform] = (platform[g.platform] ?? 0) + 1;
      status[g.status] = (status[g.status] ?? 0) + 1;
      if (!g.cover_path) noCover++;
      if (g.not_installed) notInstalled++;
    }
    return { platform, status, noCover, notInstalled };
  }, [games]);

  const active =
    (filters.platform !== "all" ? 1 : 0) +
    (filters.status !== "all" ? 1 : 0) +
    (filters.hasCover !== null ? 1 : 0) +
    (filters.notInstalledOnly ? 1 : 0) +
    (filters.minRating > 0 ? 1 : 0) +
    (!hideFavorite && filters.favoritesOnly ? 1 : 0) +
    filterRules.length;

  const chip = (on: boolean) => cn("chip !py-1.5", on && "chip-active");

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn("btn-ghost h-9 py-0 px-3 text-[12.5px]", (open || active > 0) && "!text-white !border-accent-400/40 !bg-accent-500/15")}
        aria-expanded={open}
      >
        <SlidersIcon size={14} />
        Filters
        {active > 0 && <span className="min-w-[18px] h-[18px] px-1 rounded-md bg-accent-500 text-[10.5px] font-bold flex items-center justify-center">{active}</span>}
        <ChevronDownIcon size={11} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-2 w-[440px] max-h-[70vh] overflow-y-auto rounded-2xl glass-strong shadow-2xl z-50 p-4 flex flex-col gap-4"
            style={{ background: "rgb(19 19 28)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 30px 80px -20px rgba(0,0,0,0.85)" }}
          >
            <div className="flex flex-col gap-4" data-tour="sidebar-platform">
              <div>
                <p className="section-label !text-[10px] mb-2">Platform</p>
                <div className="flex flex-wrap gap-1.5">
                  {PLATFORMS.filter((p) => (counts.platform[p.key] ?? 0) > 0 || filters.platform === p.key).map((p) => (
                    <button key={p.key} onClick={() => setFilter("platform", filters.platform === p.key ? "all" : p.key)} className={chip(filters.platform === p.key)}>
                      <p.icon size={12} /> {p.label}
                      <span className="text-[10.5px] opacity-60 tabular-nums">{counts.platform[p.key] ?? 0}</span>
                    </button>
                  ))}
                  {games.length === 0 && <span className="text-[12px] text-slate-500">Platforms appear after a scan</span>}
                </div>
              </div>
              <div>
                <p className="section-label !text-[10px] mb-2">Status</p>
                <div className="flex flex-wrap gap-1.5">
                  {customStatuses.map((s) => (
                    <button key={s.key} onClick={() => setFilter("status", (filters.status === s.key ? "all" : s.key) as GameStatus | "all")} className={chip(filters.status === s.key)}>
                      <span className="w-2 h-2 rounded-full" style={{ background: s.color }} /> {s.label}
                      <span className="text-[10.5px] opacity-60 tabular-nums">{counts.status[s.key] ?? 0}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="section-label !text-[10px] mb-2">More</p>
                <div className="flex flex-wrap gap-1.5">
                  {!hideFavorite && (
                    <button onClick={() => setFilter("favoritesOnly", !filters.favoritesOnly)} className={chip(filters.favoritesOnly)}>
                      <HeartIcon size={12} /> Favorites
                    </button>
                  )}
                  {[6, 8].map((r) => (
                    <button key={r} onClick={() => setFilter("minRating", filters.minRating === r ? 0 : r)} className={chip(filters.minRating === r)}>
                      <StarIcon size={12} filled /> {r}+
                    </button>
                  ))}
                  <button onClick={() => setFilter("hasCover", filters.hasCover === false ? null : false)} className={chip(filters.hasCover === false)}>
                    <ImageIcon size={12} /> Missing cover <span className="text-[10.5px] opacity-60 tabular-nums">{counts.noCover}</span>
                  </button>
                  {counts.notInstalled > 0 && (
                    <button onClick={() => setFilter("notInstalledOnly", !filters.notInstalledOnly)} className={chip(filters.notInstalledOnly)}>
                      <DownloadIcon size={12} /> Not installed <span className="text-[10.5px] opacity-60 tabular-nums">{counts.notInstalled}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div data-tour="sidebar-advanced" className="border-t border-white/[0.06] pt-3">
              <button onClick={() => setRulesOpen((v) => !v)} className="w-full flex items-center gap-2 text-[12.5px] text-slate-300 hover:text-white">
                <SlidersIcon size={13} className="text-accent-300" />
                <span className="flex-1 text-left font-medium">Rule builder</span>
                {filterRules.length > 0 && <span className="text-[10.5px] px-1.5 py-0.5 rounded-md bg-accent-500/20 text-accent-200">{filterRules.length} active</span>}
                <ChevronDownIcon size={11} className={cn("transition-transform text-slate-500", rulesOpen && "rotate-180")} />
              </button>
              <AnimatePresence initial={false}>
                {rulesOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pt-3">
                    <FilterBuilder />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {active > 0 && (
              <button
                onClick={() => { const fav = hideFavorite && filters.favoritesOnly; resetFilters(); if (fav) setFilter("favoritesOnly", true); clearFilterRules(); }}
                className="self-start text-[12px] text-slate-400 hover:text-white"
              >
                Reset all filters
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
