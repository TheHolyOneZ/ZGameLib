import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useGameStore } from "@/store/useGameStore";
import { useUIStore } from "@/store/useUIStore";
import { useFilteredGames } from "@/hooks/useGames";
import { api } from "@/lib/tauri";
import FilterPopover from "@/components/library/FilterPopover";
import type { SortKey } from "@/lib/types";
import { cn, PLATFORM_LABELS } from "@/lib/utils";
import {
  SearchIcon, CloseIcon, GridIcon, ListIcon,
  SortAscIcon, SortDescIcon, EyeIcon, EyeOffIcon, ImageIcon,
} from "@/components/ui/Icons";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "last_played", label: "Last Played" },
  { key: "playtime_mins", label: "Playtime" },
  { key: "rating", label: "Rating" },
  { key: "date_added", label: "Date Added" },
  { key: "sort_order", label: "Custom Order" },
];

interface PageSearchProps {
  showSort?: boolean;
  showViewToggle?: boolean;
  sticky?: boolean;
  title?: string;
  hideFavoriteFilter?: boolean;
}

export default function PageSearch({ showSort = true, showViewToggle = true, sticky = false, title, hideFavoriteFilter = false }: PageSearchProps) {
  const search = useGameStore((s) => s.search);
  const setSearch = useGameStore((s) => s.setSearch);
  const [localSearch, setLocalSearch] = useState(search);
  const viewMode = useGameStore((s) => s.viewMode);
  const setViewMode = useGameStore((s) => s.setViewMode);
  const sortKey = useGameStore((s) => s.sortKey);
  const setSortKey = useGameStore((s) => s.setSortKey);
  const sortAsc = useGameStore((s) => s.sortAsc);
  const setSortAsc = useGameStore((s) => s.setSortAsc);
  const cardSize = useGameStore((s) => s.cardSize);
  const setCardSize = useGameStore((s) => s.setCardSize);
  const filters = useGameStore((s) => s.filters);
  const setFilter = useGameStore((s) => s.setFilter);
  const filterRules = useGameStore((s) => s.filterRules);
  const clearFilterRules = useGameStore((s) => s.clearFilterRules);
  const filteredGames = useFilteredGames();
  const totalCount = useGameStore((s) => s.games.length);
  const hiddenIds = useGameStore((s) => s.hiddenIds);
  const showHidden = useGameStore((s) => s.showHidden);
  const toggleShowHidden = useGameStore((s) => s.toggleShowHidden);
  const searchScope = useGameStore((s) => s.searchScope);
  const setSearchScope = useGameStore((s) => s.setSearchScope);
  const customStatuses = useUIStore((s) => s.customStatuses);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: appSettings } = useQuery({ queryKey: ["settings"], queryFn: () => api.getSettings(), staleTime: 5 * 60 * 1000 });
  const autoColumns = (appSettings?.grid_columns ?? 0) === 0;

  const visibleTotal = showHidden ? totalCount : totalCount - hiddenIds.length;
  const filteredCount = filteredGames.length;

  useEffect(() => {
    const timer = setTimeout(() => setSearch(localSearch), 120);
    return () => clearTimeout(timer);
  }, [localSearch, setSearch]);

  useEffect(() => { if (search === "" && localSearch !== "") setLocalSearch(""); }, [search]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (useUIStore.getState().bigPicture) return;
      const tag = document.activeElement?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape" && document.activeElement === inputRef.current) inputRef.current?.blur();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const chips: { key: string; label: React.ReactNode; clear: () => void }[] = [];
  if (filters.platform !== "all") chips.push({ key: "platform", label: PLATFORM_LABELS[filters.platform], clear: () => setFilter("platform", "all") });
  if (filters.status !== "all") {
    const st = customStatuses.find((s) => s.key === filters.status);
    chips.push({ key: "status", label: <><span className="w-1.5 h-1.5 rounded-full" style={{ background: st?.color }} />{st?.label ?? filters.status}</>, clear: () => setFilter("status", "all") });
  }
  if (filters.hasCover === true) chips.push({ key: "cover", label: "Has cover", clear: () => setFilter("hasCover", null) });
  if (filters.hasCover === false) chips.push({ key: "cover", label: <><ImageIcon size={11} />Missing cover</>, clear: () => setFilter("hasCover", null) });
  if (filters.notInstalledOnly) chips.push({ key: "inst", label: "Not installed", clear: () => setFilter("notInstalledOnly", false) });
  if (!hideFavoriteFilter && filters.favoritesOnly) chips.push({ key: "fav", label: "Favorites", clear: () => setFilter("favoritesOnly", false) });
  if (filters.minRating > 0) chips.push({ key: "rating", label: `Rating ${filters.minRating}+`, clear: () => setFilter("minRating", 0) });
  if (filterRules.length > 0) chips.push({ key: "rules", label: `${filterRules.length} custom rule${filterRules.length > 1 ? "s" : ""}`, clear: clearFilterRules });

  return (
    <div
      className={cn(
        "z-20 px-8 py-3.5",
        sticky && "sticky top-0 backdrop-blur-xl mt-4",
      )}
      style={sticky ? { background: "linear-gradient(180deg, rgb(var(--bg-base) / 0.94), rgb(var(--bg-base) / 0.82))", borderBottom: "1px solid rgba(255,255,255,0.04)" } : undefined}
    >
      <div className="flex items-center gap-3">
        {title && <h2 className="text-[17px] font-semibold text-white mr-1 shrink-0">{title}</h2>}
        <div className="relative w-[280px] group shrink-0" data-tour="search-input">
          <SearchIcon size={14} className="absolute left-3.5 inset-y-0 my-auto text-slate-500 pointer-events-none group-focus-within:text-accent-300 transition-colors" />
          <input
            ref={inputRef}
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Filter games…"
            className="input-glass h-9 py-0 pl-9 pr-16 text-[13px]"
            aria-label="Search games"
          />
          <div className="absolute right-2 inset-y-0 flex items-center gap-1">
            <AnimatePresence>
              {localSearch ? (
                <motion.button
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  onClick={() => setLocalSearch("")}
                  className="w-5 h-5 flex items-center justify-center rounded-md text-slate-400 hover:text-white hover:bg-white/10"
                  aria-label="Clear search"
                >
                  <CloseIcon size={11} />
                </motion.button>
              ) : (
                <span className="kbd !h-5 !min-w-[18px] !text-[10px]">/</span>
              )}
            </AnimatePresence>
            <button
              onClick={() => setSearchScope(searchScope === "name" ? "all" : "name")}
              title={searchScope === "all" ? "Searching names and descriptions" : "Searching names only — click to include descriptions"}
              aria-label="Toggle search scope"
              className={cn("h-5 px-1 rounded text-[9px] font-bold transition-colors", searchScope === "all" ? "text-accent-300 bg-accent-500/15" : "text-slate-500 hover:text-slate-300")}
            >
              {searchScope === "all" ? "ALL" : "NAME"}
            </button>
          </div>
        </div>

        <FilterPopover hideFavorite={hideFavoriteFilter} />

        <span className="text-[12px] text-slate-400 tabular-nums shrink-0">
          {filteredCount === visibleTotal ? `${visibleTotal} games` : <><span className="text-white font-semibold">{filteredCount}</span> of {visibleTotal}</>}
        </span>

        {hiddenIds.length > 0 && (
          <button
            onClick={toggleShowHidden}
            className={cn("chip !py-1 !text-[11px]", showHidden && "chip-active")}
            title={showHidden ? "Hide hidden games" : "Show hidden games"}
          >
            {showHidden ? <EyeOffIcon size={11} /> : <EyeIcon size={11} />}
            {hiddenIds.length} hidden
          </button>
        )}

        <div className="flex-1" />

        {showViewToggle && viewMode === "grid" && autoColumns && (
          <div className="hidden lg:flex items-center gap-2 shrink-0" title="Card size">
            <GridIcon size={11} className="text-slate-500" />
            <input
              type="range"
              min={120}
              max={260}
              step={4}
              value={cardSize}
              onChange={(e) => setCardSize(parseInt(e.target.value, 10))}
              className="w-24 accent-[rgb(var(--accent-500))] cursor-pointer"
              aria-label="Card size"
            />
            <GridIcon size={15} className="text-slate-500" />
          </div>
        )}

        {showSort && (
          <div className="flex items-center gap-1.5 shrink-0" data-tour="sort-key">
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="input-glass h-9 py-0 text-[12.5px] pr-8 w-auto min-w-[130px] cursor-pointer"
              aria-label="Sort by"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
            <button
              onClick={() => setSortAsc(!sortAsc)}
              className="btn-icon"
              title={sortAsc ? "Ascending" : "Descending"}
              aria-label="Toggle sort direction"
            >
              {sortAsc ? <SortAscIcon size={14} /> : <SortDescIcon size={14} />}
            </button>
          </div>
        )}

        {showViewToggle && (
          <div className="flex items-center rounded-xl p-1 gap-0.5 shrink-0" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }} data-tour="view-toggle">
            {[
              { mode: "grid" as const, Icon: GridIcon, label: "Grid view" },
              { mode: "list" as const, Icon: ListIcon, label: "List view" },
            ].map(({ mode, Icon, label }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                title={label}
                aria-label={label}
                className={cn("w-8 h-7 rounded-lg flex items-center justify-center relative transition-colors", viewMode === mode ? "text-white" : "text-slate-500 hover:text-slate-300")}
              >
                {viewMode === mode && (
                  <motion.div
                    layoutId={`view-toggle-${title ?? "page"}`}
                    className="absolute inset-0 rounded-lg"
                    style={{ background: "rgb(var(--accent-500) / 0.9)" }}
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  />
                )}
                <span className="relative z-10"><Icon size={14} /></span>
              </button>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence initial={false}>
        {chips.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 pt-3 flex-wrap">
              <span className="text-[11px] text-slate-500">Filtered by</span>
              {chips.map((c) => (
                <button key={c.key} onClick={c.clear} className="chip chip-active !py-1 !text-[11.5px] group">
                  {c.label}
                  <CloseIcon size={9} className="opacity-60 group-hover:opacity-100" />
                </button>
              ))}
              {chips.length > 1 && (
                <button
                  onClick={() => { chips.forEach((c) => c.clear()); }}
                  className="text-[11.5px] text-slate-400 hover:text-white underline-offset-2 hover:underline"
                >
                  Clear all
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
