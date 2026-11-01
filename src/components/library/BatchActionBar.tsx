import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGameStore } from "@/store/useGameStore";
import { useUIStore } from "@/store/useUIStore";
import { api } from "@/lib/tauri";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import type { Collection } from "@/lib/types";
import { HeartIcon, CollectionIcon, TrashIcon, CloseIcon } from "@/components/ui/Icons";

const STATUSES = [
  { key: "none", label: "None" },
  { key: "backlog", label: "Backlog" },
  { key: "playing", label: "Playing" },
  { key: "completed", label: "Completed" },
  { key: "dropped", label: "Dropped" },
  { key: "on_hold", label: "On Hold" },
];

export default function BatchActionBar({ visibleIds = [] }: { visibleIds?: string[] }) {
  const selectedIds = useGameStore((s) => s.selectedIds);
  const clearSelected = useGameStore((s) => s.clearSelected);
  const setGames = useGameStore((s) => s.setGames);
  const addToast = useUIStore((s) => s.addToast);
  const openConfirm = useUIStore((s) => s.openConfirm);
  const qc = useQueryClient();

  const [statusValue, setStatusValue] = useState("");
  const [ratingValue, setRatingValue] = useState("");
  const [tagValue, setTagValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCollections, setShowCollections] = useState(false);
  const collectionMenuRef = useRef<HTMLDivElement>(null);

  const { data: allCollections = [] } = useQuery<Collection[]>({
    queryKey: ["collections"],
    queryFn: () => api.getCollections(),
  });

  useEffect(() => {
    if (!showCollections) return;
    const handler = (e: MouseEvent) => {
      if (collectionMenuRef.current && !collectionMenuRef.current.contains(e.target as Node)) {
        setShowCollections(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showCollections]);

  const count = selectedIds.length;

  useEffect(() => {
    if (count === 0) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (e.key === "Escape" && tag !== "INPUT" && tag !== "SELECT" && !useUIStore.getState().isDetailOpen) clearSelected();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count, clearSelected]);

  const reload = async () => {
    const games = await api.getAllGames();
    setGames(games);
    qc.invalidateQueries({ queryKey: ["games"] });
  };

  const handleApply = async () => {
    if (!statusValue && !ratingValue && !tagValue) return;
    setLoading(true);
    try {
      const status = statusValue || undefined;
      const rating = ratingValue ? Number(ratingValue) : undefined;
      const tagsToAdd = tagValue.trim() ? [tagValue.trim()] : undefined;
      await api.batchUpdateGames(selectedIds, status, rating, tagsToAdd);
      await reload();
      addToast(`Updated ${count} game${count !== 1 ? "s" : ""}`);
      setStatusValue("");
      setRatingValue("");
      setTagValue("");
      clearSelected();
    } catch (err) {
      addToast(String(err), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCollection = async (col: Collection) => {
    setLoading(true);
    try {
      await Promise.all(selectedIds.map((id) => api.addGameToCollection(col.id, id).catch(() => {})));
      qc.invalidateQueries({ queryKey: ["collections"] });
      addToast(`Added ${count} game${count !== 1 ? "s" : ""} to "${col.name}"`);
      setShowCollections(false);
    } catch (err) {
      addToast(String(err), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    openConfirm(`Move ${count} game${count !== 1 ? "s" : ""} to trash?`, async () => {
      setLoading(true);
      try {
        await Promise.all(selectedIds.map((id) => api.deleteGame(id)));
        await reload();
        addToast(`Moved ${count} game${count !== 1 ? "s" : ""} to trash`);
        clearSelected();
      } catch (err) {
        addToast(String(err), "error");
      } finally {
        setLoading(false);
      }
    });
  };

  const selectAllVisible = () => {
    const ids = useGameStore.getState().selectedIds;
    const next = new Set(ids);
    visibleIds.forEach((id) => next.add(id));
    useGameStore.setState({ selectedIds: [...next] });
  };

  const favoriteAll = async () => {
    setLoading(true);
    try {
      const games = useGameStore.getState().games.filter((g) => selectedIds.includes(g.id) && !g.is_favorite);
      await Promise.all(games.map((g) => api.toggleFavorite(g.id)));
      await reload();
      addToast(games.length ? `Added ${games.length} game${games.length !== 1 ? "s" : ""} to favorites` : "All selected games are already favorites", games.length ? "success" : "info");
    } catch (err) {
      addToast(String(err), "error");
    } finally {
      setLoading(false);
    }
  };

  const fieldCls = "h-9 bg-white/[0.05] border border-white/10 rounded-xl px-3 text-[12.5px] text-slate-200 placeholder-slate-500 outline-none focus:border-accent-500/60 transition-colors";

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.98, pointerEvents: "none" }}
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 pl-4 pr-2 py-2 rounded-2xl glass-strong whitespace-nowrap"
          style={{ boxShadow: "0 24px 60px -12px rgba(0,0,0,0.85), 0 0 0 1px rgb(var(--accent-400) / 0.25)" }}
        >
          <span className="flex items-center gap-2 text-[13px] font-semibold text-white tabular-nums pr-1">
            <span className="min-w-[24px] h-6 px-1.5 rounded-lg bg-accent-500 flex items-center justify-center text-[12px]">{count}</span>
            selected
          </span>
          {visibleIds.length > count && (
            <button onClick={selectAllVisible} className="text-[12px] text-accent-300 hover:text-accent-200 px-1">Select all {visibleIds.length}</button>
          )}

          <div className="w-px h-6 bg-white/10 mx-1" />

          <select value={statusValue} onChange={(e) => setStatusValue(e.target.value)} className={cn(fieldCls, "pr-7 cursor-pointer")}>
            <option value="">Set status…</option>
            {STATUSES.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>

          <input
            type="number"
            min={1}
            max={10}
            placeholder="Rating"
            value={ratingValue}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "") { setRatingValue(""); return; }
              const n = parseInt(val, 10);
              if (!isNaN(n)) setRatingValue(String(Math.min(10, Math.max(1, n))));
            }}
            className={cn(fieldCls, "w-20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none")}
          />

          <input
            type="text"
            placeholder="Add tag"
            value={tagValue}
            onChange={(e) => setTagValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleApply(); }}
            className={cn(fieldCls, "w-24")}
          />

          <button
            onClick={handleApply}
            disabled={loading || (!statusValue && !ratingValue && !tagValue)}
            className="btn-primary h-9 py-0 px-4 text-[12.5px] disabled:opacity-40"
          >
            Apply
          </button>

          <div className="w-px h-6 bg-white/10 mx-1" />

          <button onClick={favoriteAll} disabled={loading} className="btn-icon hover:!text-pink-300" title="Add all to favorites">
            <HeartIcon size={14} />
          </button>

          {allCollections.length > 0 && (
            <div className="relative" ref={collectionMenuRef}>
              <button
                onClick={() => setShowCollections((v) => !v)}
                disabled={loading}
                className={cn("btn-icon", showCollections && "!text-accent-300 !border-accent-500/40")}
                title="Add to collection"
              >
                <CollectionIcon size={14} />
              </button>
              <AnimatePresence>
                {showCollections && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.96, pointerEvents: "none" }}
                    transition={{ duration: 0.15 }}
                    className="absolute bottom-full mb-3 right-0 min-w-[200px] rounded-2xl glass-strong shadow-2xl z-50 overflow-hidden p-1.5"
                  >
                    <p className="section-label !text-[10px] px-2.5 pt-1.5 pb-1">Add all to</p>
                    {allCollections.map((col) => (
                      <button
                        key={col.id}
                        onClick={() => handleAddToCollection(col)}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12.5px] text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors text-left"
                      >
                        <span className="flex-1 truncate">{col.name}</span>
                        <span className="text-[11px] text-slate-500 tabular-nums">{col.game_count}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <button onClick={handleDelete} disabled={loading} className="btn-icon hover:!text-red-300 hover:!border-red-500/40" title="Move to trash">
            <TrashIcon size={14} />
          </button>

          <button onClick={clearSelected} className="btn-icon !bg-transparent !border-transparent" title="Clear selection (Esc)">
            <CloseIcon size={13} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
