import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGameStore } from "@/store/useGameStore";
import { useUIStore } from "@/store/useUIStore";
import { api } from "@/lib/tauri";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import type { Collection } from "@/lib/types";

const STATUSES = [
  { key: "none", label: "None" },
  { key: "backlog", label: "Backlog" },
  { key: "playing", label: "Playing" },
  { key: "completed", label: "Completed" },
  { key: "dropped", label: "Dropped" },
  { key: "on_hold", label: "On Hold" },
];

export default function BatchActionBar() {
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

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl glass-strong border border-white/10 shadow-2xl"
        >
          <span className="text-sm font-semibold text-white tabular-nums min-w-[60px]">
            {count} selected
          </span>

          <div className="w-px h-5 bg-white/10" />

          <select
            value={statusValue}
            onChange={(e) => setStatusValue(e.target.value)}
            className="bg-[#1a1825] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-accent-500/50 [&>option]:bg-[#1a1825] [&>option]:text-slate-200"
          >
            <option value="">Set Status</option>
            {STATUSES.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>

          <input
            type="number"
            min={1}
            max={10}
            placeholder="Rate (1-10)"
            value={ratingValue}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "") { setRatingValue(""); return; }
              const n = parseInt(val, 10);
              if (!isNaN(n)) setRatingValue(String(Math.min(10, Math.max(1, n))));
            }}
            className="w-24 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-accent-500/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />

          <input
            type="text"
            placeholder="Add tag"
            value={tagValue}
            onChange={(e) => setTagValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleApply(); }}
            className="w-24 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-accent-500/50"
          />

          {allCollections.length > 0 && (
            <div className="relative" ref={collectionMenuRef}>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowCollections((v) => !v)}
                disabled={loading}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border",
                  showCollections
                    ? "bg-accent-500/20 text-accent-300 border-accent-500/40"
                    : "bg-white/5 text-slate-400 hover:text-slate-200 border-white/10 hover:border-white/20"
                )}
              >
                + Collection
              </motion.button>
              <AnimatePresence>
                {showCollections && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute bottom-full mb-2 left-0 min-w-[160px] rounded-xl border border-white/10 shadow-2xl z-50 overflow-hidden"
                    style={{ background: "rgba(12, 10, 20, 0.96)", backdropFilter: "blur(20px)" }}
                  >
                    <p className="text-[10px] text-slate-600 uppercase tracking-[0.12em] font-semibold px-3 pt-2.5 pb-1.5">Add all to</p>
                    <div className="flex flex-col pb-1.5">
                      {allCollections.map((col) => (
                        <button
                          key={col.id}
                          onClick={() => handleAddToCollection(col)}
                          className="flex items-center gap-2 px-3 py-2 text-[12px] text-slate-400 hover:text-white hover:bg-white/5 transition-colors text-left"
                        >
                          {col.name}
                          <span className="ml-auto text-[10px] text-slate-700 tabular-nums">{col.game_count}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleApply}
            disabled={loading || (!statusValue && !ratingValue && !tagValue)}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors", (!statusValue && !ratingValue && !tagValue) || loading ? "bg-accent-500/30 text-accent-300/50 cursor-not-allowed" : "bg-accent-500 text-white hover:bg-accent-400")}
          >
            Apply
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleDelete}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
          >
            Delete
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={clearSelected}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors text-lg leading-none"
          >
            ×
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
