import { useGameStore } from "@/store/useGameStore";
import { useUIStore } from "@/store/useUIStore";
import { useScan } from "@/hooks/useGames";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { TerminalIcon, PlusIcon, ScanIcon, LayersIcon } from "@/components/ui/Icons";

export default function Topbar() {
  const hiddenIds = useGameStore((s) => s.hiddenIds);
  const hideGames = useGameStore((s) => s.hideGames);
  const logPanelOpen = useUIStore((s) => s.logPanelOpen);
  const setLogPanelOpen = useUIStore((s) => s.setLogPanelOpen);
  const logCount = useUIStore((s) => s.logs.length);
  const setAddGameOpen = useUIStore((s) => s.setAddGameOpen);
  const addToast = useUIStore((s) => s.addToast);
  const { scan, isScanning } = useScan();

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
      hideGames(toHide);
      addToast(`${toHide.length} duplicate${toHide.length !== 1 ? "s" : ""} hidden`, "success");
    }
  };

  return (
    <div className="flex items-center justify-end gap-2 px-4 py-3 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
      {/* Log */}
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => setLogPanelOpen(!logPanelOpen)}
        className={cn("btn-icon relative", logPanelOpen && "text-emerald-400")}
        title="Scan log"
      >
        <TerminalIcon size={14} />
        {logCount > 0 && !logPanelOpen && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500" />
        )}
      </motion.button>

      <div className="w-px h-5 bg-white/6 shrink-0" />

      {/* Remove Duplicates */}
      <motion.button
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.93 }}
        onClick={handleRemoveDuplicates}
        className="btn-icon"
        title="Remove duplicate games"
      >
        <LayersIcon size={14} />
      </motion.button>

      {/* Scan + Add Game */}
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
  );
}
