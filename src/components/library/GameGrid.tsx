import { AnimatePresence, motion, Reorder } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { useGameStore } from "@/store/useGameStore";
import { useFilteredGames, useScan, usePullUninstalled } from "@/hooks/useGames";
import { api } from "@/lib/tauri";
import GameCard from "./GameCard";
import VirtualGrid from "./VirtualGrid";
import GameListRow from "./GameListRow";
import BatchActionBar from "./BatchActionBar";
import EmptyState from "@/components/ui/EmptyState";
import { useUIStore } from "@/store/useUIStore";
import { SearchIcon, GamepadIcon, ScanIcon, PlusIcon, DownloadIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/utils";

const itemVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } },
};

function gridTemplate(columns: number, cardSize: number) {
  return columns === 0 ? `repeat(auto-fill, minmax(${cardSize}px, 1fr))` : `repeat(${columns}, minmax(0, 1fr))`;
}

function SkeletonGrid({ columns, cardSize }: { columns: number; cardSize: number }) {
  return (
    <div className="px-8 py-6 grid gap-x-5 gap-y-6" style={{ gridTemplateColumns: gridTemplate(columns, cardSize) }}>
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i}>
          <div className="aspect-[3/4] rounded-2xl bg-white/[0.04] animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
          <div className="h-3 w-3/4 rounded bg-white/[0.04] mt-3 animate-pulse" />
          <div className="h-2.5 w-1/3 rounded bg-white/[0.03] mt-2 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  const pages: (number | "…")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-center gap-1.5 py-6 px-4">
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={() => onPage(page - 1)}
        disabled={page === 1}
        className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-white transition-all disabled:opacity-25 disabled:cursor-not-allowed"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
      </motion.button>

      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`ellipsis-${i}`} className="w-8 text-center text-[12px] text-slate-600">…</span>
        ) : (
          <motion.button
            key={p}
            whileTap={{ scale: 0.92 }}
            onClick={() => onPage(p as number)}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-[12px] font-medium transition-all duration-150"
            style={
              p === page
                ? {
                    background: "rgb(var(--accent-500))",
                    border: "1px solid rgb(var(--accent-400) / 0.3)",
                    color: "white",
                    
                  }
                : {
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    color: "#94a3b8",
                  }
            }
          >
            {p}
          </motion.button>
        )
      )}

      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={() => onPage(page + 1)}
        disabled={page === totalPages}
        className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-white transition-all disabled:opacity-25 disabled:cursor-not-allowed"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
      </motion.button>
    </div>
  );
}

export default function GameGrid({ isLoading = false }: { isLoading?: boolean }) {
  const games = useFilteredGames();
  const { scan } = useScan();
  const { pullUninstalled } = usePullUninstalled();
  const allGamesRaw = useGameStore((s) => s.games);
  const viewMode = useGameStore((s) => s.viewMode);
  const sortKey = useGameStore((s) => s.sortKey);
  const cardSize = useGameStore((s) => s.cardSize);
  const filterRules = useGameStore((s) => s.filterRules);
  const clearFilterRules = useGameStore((s) => s.clearFilterRules);
  const setGames = useGameStore((s) => s.setGames);
  const setAddGameOpen = useUIStore((s) => s.setAddGameOpen);
  const search = useGameStore((s) => s.search);
  const filters = useGameStore((s) => s.filters);
  const resetFilters = useGameStore((s) => s.resetFilters);
  const setSearch = useGameStore((s) => s.setSearch);
  const { data: appSettings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings(),
    staleTime: 5 * 60 * 1000,
  });
  const gridColumns = appSettings?.grid_columns ?? 0;
  const paginationEnabled = appSettings?.pagination_enabled ?? false;
  const pageSize = appSettings?.pagination_page_size ?? 24;

  const [page, setPage] = useState(1);
  const [animateIn, setAnimateIn] = useState(true);
  const visibleIds = useMemo(() => games.map((g) => g.id), [games]);

  useEffect(() => {
    const t = setTimeout(() => setAnimateIn(false), 900);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => { setPage(1); }, [search, filters, paginationEnabled, pageSize]);

  if (isLoading && games.length === 0) {
    return <SkeletonGrid columns={gridColumns} cardSize={cardSize} />;
  }

  const hasActiveFilters = search.trim() !== "" || filters.platform !== "all" || filters.status !== "all" || filters.favoritesOnly || filters.minRating > 0 || filters.tags.length > 0 || filters.dateAddedFrom !== null || filters.dateAddedTo !== null || filters.hasCover !== null || filters.notInstalledOnly || filterRules.length > 0;

  if (games.length === 0 && filters.favoritesOnly && !search.trim() && filters.platform === "all" && filters.status === "all" && filterRules.length === 0) {
    return (
      <EmptyState
        title="No favorites yet"
        description="Click the heart on any game, or press F with a game open, to pin it here."
      />
    );
  }

  if (games.length === 0 && allGamesRaw.length > 0 && hasActiveFilters) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-28 gap-5 text-center"
      >
        <div className="w-20 h-20 rounded-2xl glass-strong flex items-center justify-center">
          <SearchIcon size={32} className="text-slate-600" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-slate-300">No games match your filters</h3>
          <p className="text-sm text-slate-600 max-w-sm leading-relaxed">
            {search.trim() ? `No results for "${search}"` : "Try adjusting your filters to see more games"}
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => { const fav = filters.favoritesOnly; resetFilters(); if (fav) useGameStore.getState().setFilter("favoritesOnly", true); clearFilterRules(); setSearch(""); }}
          className="btn-primary mt-2"
        >
          Clear Filters
        </motion.button>
      </motion.div>
    );
  }

  if (games.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center justify-center py-16 gap-8 text-center px-8"
      >
        <div className="relative">
          <div className="absolute inset-0 blur-3xl opacity-60" style={{ background: "radial-gradient(circle, rgb(var(--accent-500) / 0.6), transparent 70%)" }} />
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            className="relative w-24 h-24 rounded-[28px] flex items-center justify-center"
            style={{ background: "rgb(var(--accent-500))", boxShadow: "0 20px 50px -12px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.3)" }}
          >
            <GamepadIcon size={44} className="text-white" />
          </motion.div>
        </div>
        <div>
          <h3 className="text-[28px] font-bold text-white">Let's build your library</h3>
          <p className="text-[14px] text-slate-400 max-w-md leading-relaxed mt-2">ZGameLib finds games from Steam, Epic, GOG and Ubisoft Connect automatically. You can also add any game by pointing at its executable.</p>
        </div>
        <div className="grid grid-cols-3 gap-4 w-full max-w-3xl">
          {[
            { icon: <ScanIcon size={20} />, label: "Scan this PC", desc: "Detect installed games from every launcher", onClick: () => scan(), primary: true },
            { icon: <PlusIcon size={20} />, label: "Add manually", desc: "Pick an .exe, shortcut or folder", onClick: () => setAddGameOpen(true) },
            { icon: <DownloadIcon size={20} />, label: "Import owned Steam games", desc: "Uses your Steam API key from Settings", onClick: () => pullUninstalled() },
          ].map((card, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.07 }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              onClick={card.onClick}
              className={cn("flex flex-col items-start gap-3 p-5 rounded-2xl text-left transition-colors", card.primary ? "border-gradient" : "")}
              style={{ background: card.primary ? "linear-gradient(160deg, rgb(var(--accent-500) / 0.2), rgba(255,255,255,0.03))" : "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <span className={cn("w-10 h-10 rounded-xl flex items-center justify-center", card.primary ? "bg-accent-500 text-white" : "bg-white/[0.06] text-accent-300")}>{card.icon}</span>
              <span>
                <span className="block text-[14px] font-semibold text-white">{card.label}</span>
                <span className="block text-[12px] text-slate-400 mt-1 leading-snug">{card.desc}</span>
              </span>
            </motion.button>
          ))}
        </div>
      </motion.div>
    );
  }

  const totalPages = paginationEnabled ? Math.max(1, Math.ceil(games.length / pageSize)) : 1;
  const safePage = Math.min(page, totalPages);
  const visibleGames = paginationEnabled ? games.slice((safePage - 1) * pageSize, safePage * pageSize) : games;

  if (sortKey === "sort_order") {
    return (
      <Reorder.Group
        axis="y"
        values={games}
        onReorder={(newOrder) => {
          const ids = newOrder.map((g) => g.id);
          api.reorderGames(ids).catch(() => {});
          const idSet = new Set(ids);
          const updated = newOrder.map((g, i) => ({ ...g, sort_order: i }));
          setGames([...updated, ...allGamesRaw.filter((g) => !idSet.has(g.id))]);
        }}
        className="flex flex-col gap-1 px-6 pt-3 pb-10"
      >
        <p className="text-[12px] text-slate-500 px-2 pb-2">Drag games to set your own order.</p>
        {visibleGames.map((g) => (
          <Reorder.Item key={g.id} value={g} className="list-none">
            <GameListRow game={g} />
          </Reorder.Item>
        ))}
        {paginationEnabled && totalPages > 1 && (
          <Pagination page={safePage} totalPages={totalPages} onPage={setPage} />
        )}
      </Reorder.Group>
    );
  }

  if (viewMode === "list") {
    return (
      <>
        <div className="flex flex-col gap-1 px-6 pt-3 pb-10 page-enter">
          <div className="flex items-center gap-4 px-4 py-2.5 text-[12px] text-slate-500 font-semibold"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="w-5 shrink-0" />
            <div className="w-10 shrink-0" />
            <div className="flex-1">Name</div>
            <div className="hidden lg:block w-40">Tags</div>
            <div className="hidden md:block w-24 text-right">Last played</div>
            <div className="hidden md:block w-20 text-right">Playtime</div>
            <div className="w-14 text-right">Rating</div>
            <div className="w-[104px]" />
          </div>
          <VirtualGrid
            items={visibleGames}
            getKey={(g) => g.id}
            columns={1}
            gapX={0}
            gapY={4}
            fixedRowHeight={68}
            overscanRows={8}
            render={(g) => <GameListRow game={g} />}
          />
        </div>
        {paginationEnabled && totalPages > 1 && (
          <Pagination page={safePage} totalPages={totalPages} onPage={setPage} />
        )}
        <BatchActionBar visibleIds={visibleIds} />
      </>
    );
  }

  return (
    <>
      <VirtualGrid
        dataTour="game-grid"
        className="mx-8 mt-5 mb-10"
        items={visibleGames}
        getKey={(g) => g.id}
        columns={gridColumns}
        minColumnWidth={cardSize}
        gapX={20}
        gapY={24}
        render={(g, idx) => (
          <motion.div
            data-tour={idx === 0 ? "game-card-first" : undefined}
            variants={itemVariants}
            initial={animateIn && idx < 40 ? "hidden" : false}
            animate="show"
            transition={{ delay: Math.min(idx, 24) * 0.012 }}
          >
            <GameCard game={g} />
          </motion.div>
        )}
      />
      {paginationEnabled && totalPages > 1 && (
        <Pagination page={safePage} totalPages={totalPages} onPage={setPage} />
      )}
      <BatchActionBar visibleIds={visibleIds} />
    </>
  );
}
