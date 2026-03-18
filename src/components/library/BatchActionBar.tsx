import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGameStore } from "@/store/useGameStore";
import { useUIStore } from "@/store/useUIStore";
import { api } from "@/lib/tauri";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

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
