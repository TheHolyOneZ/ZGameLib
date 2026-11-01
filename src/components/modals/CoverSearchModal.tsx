import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/tauri";
import { useGameStore } from "@/store/useGameStore";
import { useUIStore } from "@/store/useUIStore";
import { clearCoverCache } from "@/hooks/useCover";
import { buildQuery, loadRules, loadSceneCleanup } from "@/lib/coverQuery";
import type { CoverResult } from "@/lib/types";
import { SearchIcon, CloseIcon, ImageIcon } from "@/components/ui/Icons";
import CoverCandidateTile from "./CoverCandidate";

interface Props {
  gameId: string;
  gameName: string;
  currentCoverPath: string | null;
  onClose: () => void;
}

export default function CoverSearchModal({ gameId, gameName, currentCoverPath, onClose }: Props) {
  const addToast = useUIStore((s) => s.addToast);
  const [query, setQuery] = useState(() => buildQuery(gameName, loadRules(), loadSceneCleanup()));
  const [results, setResults] = useState<CoverResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const reqId = useRef(0);

  const search = async (q = query) => {
    if (!q.trim()) return;
    const id = ++reqId.current;
    setHasSearched(true);
    setLoading(true);
    try {
      const res = await api.searchCoverArt(q.trim());
      if (id === reqId.current) setResults(res);
    } catch (e) {
      if (id === reqId.current) addToast(String(e), "error");
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  };

  useEffect(() => { search(); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const applyCover = async (r: CoverResult) => {
    if (applying) return;
    setApplying(r.url);
    try {
      const path = await api.applyCoverUrl(gameId, r.url);
      if (currentCoverPath) clearCoverCache(currentCoverPath);
      const g = useGameStore.getState().games.find((x) => x.id === gameId);
      if (g) useGameStore.getState().updateGame({ ...g, cover_path: path });
      addToast("Cover updated", "success");
      onClose();
    } catch (e) {
      addToast(String(e), "error");
    } finally {
      setApplying(null);
    }
  };

  const sources = [...new Set(results.map((r) => r.source))];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, pointerEvents: "none" }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
        className="w-[760px] max-w-full h-[78vh] flex flex-col rounded-3xl overflow-hidden"
        style={{ background: "rgb(17 17 25)", border: "1px solid rgba(255,255,255,0.09)", boxShadow: "0 50px 120px -20px rgba(0,0,0,0.9)" }}
      >
        <div className="flex items-center gap-3 px-6 pt-5 pb-4">
          <span className="w-10 h-10 rounded-xl bg-accent-500/15 text-accent-200 flex items-center justify-center"><ImageIcon size={18} /></span>
          <div className="flex-1 min-w-0">
            <h2 className="text-[17px] font-bold text-white">Find cover art</h2>
            <p className="text-[12px] text-slate-500 truncate">For {gameName}</p>
          </div>
          <button onClick={onClose} className="btn-icon"><CloseIcon size={14} /></button>
        </div>
        <div className="px-6 pb-4 flex gap-2">
          <div className="relative flex-1">
            <SearchIcon size={14} className="absolute left-3.5 inset-y-0 my-auto text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="Search by game name…"
              className="input-glass pl-9 text-[13px]"
              autoFocus
            />
          </div>
          <button onClick={() => search()} disabled={loading || !query.trim()} className="btn-primary shrink-0">
            {loading ? <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <SearchIcon size={14} />}
            Search
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-5">
          {loading && results.length === 0 ? (
            <div className="grid grid-cols-5 gap-3">
              {Array.from({ length: 10 }).map((_, i) => <div key={i} className="aspect-[3/4] rounded-xl bg-white/[0.04] animate-pulse" />)}
            </div>
          ) : results.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <ImageIcon size={30} className="text-slate-600 mb-3" />
              <p className="text-[13.5px] text-slate-300">{hasSearched ? `No artwork found for "${query}"` : "Search to find cover art"}</p>
              <p className="text-[12px] text-slate-500 mt-1 max-w-sm">Try a shorter name. Add a free SteamGridDB key or IGDB credentials in Settings → Integrations for far more results, especially for new and non-Steam games.</p>
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-3">
              {results.map((r) => (
                <CoverCandidateTile key={r.url} result={r} busy={applying === r.url} onClick={() => applyCover(r)} />
              ))}
            </div>
          )}
        </div>
        <div className="px-6 py-3 border-t border-white/[0.06] flex items-center gap-2 text-[11.5px] text-slate-500">
          {results.length > 0 ? <>{results.length} results from {sources.join(", ")} · click a cover to use it</> : <>Searches Steam, SteamGridDB and IGDB</>}
        </div>
      </motion.div>
    </motion.div>
  );
}
