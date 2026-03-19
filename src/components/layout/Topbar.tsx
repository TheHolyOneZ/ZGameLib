import { useState } from "react";
import { useGameStore } from "@/store/useGameStore";
import { useUIStore } from "@/store/useUIStore";
import { useScan } from "@/hooks/useGames";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/tauri";
import { TerminalIcon, PlusIcon, ScanIcon, LayersIcon, SparkleIcon } from "@/components/ui/Icons";

export default function Topbar() {
  const hiddenIds = useGameStore((s) => s.hiddenIds);
  const hideGames = useGameStore((s) => s.hideGames);
  const logPanelOpen = useUIStore((s) => s.logPanelOpen);
  const setLogPanelOpen = useUIStore((s) => s.setLogPanelOpen);
  const logCount = useUIStore((s) => s.logs.length);
  const setAddGameOpen = useUIStore((s) => s.setAddGameOpen);
  const addToast = useUIStore((s) => s.addToast);
  const openConfirm = useUIStore((s) => s.openConfirm);
  const { scan, isScanning } = useScan();
  const { data: isPortable } = useQuery({ queryKey: ["portable_mode"], queryFn: api.isPortableMode, staleTime: Infinity });
  const [igdbScanning, setIgdbScanning] = useState(false);
  const [igdbProgress, setIgdbProgress] = useState(0);
  const [igdbTotal, setIgdbTotal] = useState(0);

  const handleIgdbScanAll = async () => {
    const settings = await api.getSettings();
    if (!settings.igdb_client_id || !settings.igdb_client_secret) {
      addToast("Set IGDB credentials in Settings → Integrations first", "error");
      return;
    }
    const pending = useGameStore.getState().games.filter(
      (g) => !g.igdb_skipped && !g.genre && !g.developer && !g.publisher && !g.release_year
    );
    if (pending.length === 0) {
      addToast("All games already have IGDB data", "info");
      return;
    }
    setIgdbScanning(true);
    setIgdbTotal(pending.length);
    setIgdbProgress(0);
    let done = 0;
    for (const game of pending) {
      try {
        await api.fetchIgdbMetadata(game.id, game.name, settings.igdb_client_id!, settings.igdb_client_secret!);
      } catch { /* skip failed games */ }
      done++;
      setIgdbProgress(done);
    }
    setIgdbScanning(false);
    const allGames = await api.getAllGames();
    useGameStore.getState().setGames(allGames);
    addToast(`IGDB scan complete — ${done} game${done !== 1 ? "s" : ""} processed`, "success");
  };

  const handleRemoveDuplicates = () => {
    const games = useGameStore.getState().games;
    const currentHidden = new Set(useGameStore.getState().hiddenIds);
    const seen = new Map<string, boolean>();
    const toHide: string[] = [];
    for (const g of games) {
      if (currentHidden.has(g.id)) continue;
      const key = g.name.toLowerCase().trim();
      if (seen.has(key)) toHide.push(g.id);
      else seen.set(key, true);
    }
    if (toHide.length === 0) {
      addToast("No duplicates found", "info");
    } else {
      openConfirm(
        `Hide ${toHide.length} duplicate game${toHide.length !== 1 ? "s" : ""}?`,
        () => {
          hideGames(toHide);
          addToast(`${toHide.length} duplicate${toHide.length !== 1 ? "s" : ""} hidden`, "success");
        }
      );
    }
  };

  return (
    <div className="flex items-center justify-between gap-2 px-4 py-3 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
      <div className="flex items-center">
        {isPortable && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide text-amber-300 bg-amber-500/10 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
            Portable
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => setLogPanelOpen(!logPanelOpen)}
        className={cn("btn-icon relative", logPanelOpen && "text-emerald-400")}
        title="Scan log"
        aria-label="Toggle scan log"
      >
        <TerminalIcon size={14} />
        {logCount > 0 && !logPanelOpen && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500" />
        )}
      </motion.button>

      <div className="w-px h-5 bg-white/6 shrink-0" />

      <motion.button
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.93 }}
        onClick={handleRemoveDuplicates}
        className="btn-icon"
        title="Remove duplicate games"
        aria-label="Remove duplicate games"
      >
        <LayersIcon size={14} />
      </motion.button>

      <motion.button
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.93 }}
        onClick={handleIgdbScanAll}
        disabled={igdbScanning}
        className="btn-icon relative disabled:opacity-40 disabled:cursor-not-allowed"
        title="Fetch IGDB metadata for all games without it"
        aria-label="Scan all games with IGDB"
      >
        <motion.span
          animate={igdbScanning ? { rotate: 360 } : {}}
          transition={igdbScanning ? { duration: 1.8, repeat: Infinity, ease: "linear" } : {}}
          className="flex items-center"
        >
          <SparkleIcon size={14} />
        </motion.span>
        {igdbScanning && (
          <span className="absolute -bottom-0.5 -right-0.5 text-[8px] font-bold leading-none text-accent-300 bg-[#0d0d12] rounded px-0.5">
            {igdbProgress}/{igdbTotal}
          </span>
        )}
      </motion.button>

      <div className="w-px h-5 bg-white/6 shrink-0" />

      <div className="flex items-center gap-1.5 shrink-0">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => scan()}
          disabled={isScanning}
          className="btn-ghost text-[12px] py-2 px-3 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          title="Scan for games"
        >
          <motion.span
            animate={isScanning ? { rotate: 360 } : {}}
            transition={isScanning ? { duration: 1.5, repeat: Infinity, ease: "linear" } : {}}
            className="flex items-center"
          >
            <ScanIcon size={13} />
          </motion.span>
          {isScanning ? "Scanning…" : "Scan Games"}
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setAddGameOpen(true)}
          className="btn-primary text-[12px] py-2 px-3 shrink-0"
        >
          <PlusIcon size={13} />
          Add Game
        </motion.button>
      </div>
      </div>
    </div>
  );
}
