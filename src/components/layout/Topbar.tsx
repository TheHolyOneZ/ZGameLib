import { useState, useRef, useEffect } from "react";
import { useGameStore } from "@/store/useGameStore";
import { useUIStore } from "@/store/useUIStore";
import { useScan, usePullUninstalled } from "@/hooks/useGames";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/tauri";
import { TerminalIcon, PlusIcon, ScanIcon, LayersIcon, SparkleIcon, ChevronDownIcon, SearchIcon, TvIcon, DownloadIcon } from "@/components/ui/Icons";

export default function Topbar() {
  const hiddenIds = useGameStore((s) => s.hiddenIds);
  const hideGames = useGameStore((s) => s.hideGames);
  const logPanelOpen = useUIStore((s) => s.logPanelOpen);
  const setLogPanelOpen = useUIStore((s) => s.setLogPanelOpen);
  const logCount = useUIStore((s) => s.logs.length);
  const setAddGameOpen = useUIStore((s) => s.setAddGameOpen);
  const addToast = useUIStore((s) => s.addToast);
  const openConfirm = useUIStore((s) => s.openConfirm);
  const setCommandPaletteOpen = useUIStore((s) => s.setCommandPaletteOpen);
  const setBigPicture = useUIStore((s) => s.setBigPicture);
  const { scan, isScanning } = useScan();
  const { pullUninstalled, isPulling } = usePullUninstalled();
  const [scanMenuOpen, setScanMenuOpen] = useState(false);
  const scanMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scanMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (scanMenuRef.current && !scanMenuRef.current.contains(e.target as Node)) {
        setScanMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [scanMenuOpen]);

  useEffect(() => {
    const handleOpen = () => setScanMenuOpen(true);
    const handleClose = () => setScanMenuOpen(false);
    window.addEventListener("tour:scan-menu-open", handleOpen);
    window.addEventListener("tour:scan-menu-close", handleClose);
    return () => {
      window.removeEventListener("tour:scan-menu-open", handleOpen);
      window.removeEventListener("tour:scan-menu-close", handleClose);
    };
  }, []);
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
      } catch {}
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
    <div className="flex items-center gap-3 px-6 h-[60px] shrink-0 relative z-20" style={{ borderBottom: "1px solid rgba(255,255,255,0.045)" }}>
      <button
        onClick={() => setCommandPaletteOpen(true)}
        className="group flex items-center gap-2.5 h-9 pl-3 pr-2 rounded-xl text-[13px] text-slate-500 hover:text-slate-300 transition-all w-[320px] max-w-[40vw]"
        style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <SearchIcon size={14} className="text-slate-500 group-hover:text-accent-300 transition-colors" />
        <span className="flex-1 text-left truncate">Jump to a game or command…</span>
        <span className="kbd">Ctrl K</span>
      </button>
      {isPortable && (
        <span className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-semibold tracking-wide text-amber-300 bg-amber-500/10 border border-amber-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
          Portable
        </span>
      )}
      <div className="flex-1" />
      <div className="flex items-center gap-1.5">
        <button
          data-tour="log-btn"
          onClick={() => setLogPanelOpen(!logPanelOpen)}
          className={cn("btn-icon relative", logPanelOpen && "text-emerald-400 border-emerald-500/30")}
          title="Scan log"
          aria-label="Toggle scan log"
        >
          <TerminalIcon size={15} />
          {logCount > 0 && !logPanelOpen && (
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400" />
          )}
        </button>
        <button
          data-tour="dedup-btn"
          onClick={handleRemoveDuplicates}
          className="btn-icon"
          title="Hide duplicate games"
          aria-label="Remove duplicate games"
        >
          <LayersIcon size={15} />
        </button>
        <button
          data-tour="igdb-scan-btn"
          onClick={handleIgdbScanAll}
          disabled={igdbScanning}
          className="btn-icon relative disabled:cursor-wait"
          title={igdbScanning ? `Fetching IGDB metadata ${igdbProgress}/${igdbTotal}` : "Fetch IGDB metadata for all games without it"}
          aria-label="Scan all games with IGDB"
        >
          <motion.span
            animate={igdbScanning ? { rotate: 360 } : { rotate: 0 }}
            transition={igdbScanning ? { duration: 1.8, repeat: Infinity, ease: "linear" } : { duration: 0 }}
            className={cn("flex items-center", igdbScanning && "text-accent-300")}
          >
            <SparkleIcon size={15} />
          </motion.span>
          {igdbScanning && (
            <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 text-[8.5px] font-bold leading-none text-accent-200 bg-bg-elevated border border-accent-500/30 rounded px-1 py-0.5 tabular-nums whitespace-nowrap">
              {igdbProgress}/{igdbTotal}
            </span>
          )}
        </button>
        <button
          onClick={() => setBigPicture(true)}
          className="btn-icon"
          title="Big Picture Mode (Ctrl+B)"
          aria-label="Enter Big Picture mode"
        >
          <TvIcon size={16} />
        </button>
      </div>

      <div className="w-px h-6 bg-white/[0.07] shrink-0 mx-1" />

      <div className="flex items-center gap-2 shrink-0">
        <div className="relative" ref={scanMenuRef} data-tour="scan-btn">
          <div className="flex items-stretch h-9">
            <button
              onClick={() => { scan(); setScanMenuOpen(false); }}
              disabled={isScanning || isPulling}
              className="btn-ghost h-9 text-[12.5px] py-0 pl-3 pr-3 disabled:opacity-50 disabled:cursor-not-allowed rounded-r-none"
              title="Scan installed games"
            >
              <motion.span
                animate={isScanning ? { rotate: 360 } : { rotate: 0 }}
                transition={isScanning ? { duration: 1.5, repeat: Infinity, ease: "linear" } : { duration: 0 }}
                className="flex items-center"
              >
                <ScanIcon size={14} />
              </motion.span>
              {isScanning ? "Scanning…" : isPulling ? "Pulling…" : "Scan"}
            </button>
            <button
              onClick={() => setScanMenuOpen((v) => !v)}
              disabled={isScanning || isPulling}
              className="btn-ghost h-9 py-0 px-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-l-none border-l-0"
              title="More scan options"
            >
              <ChevronDownIcon size={12} />
            </button>
          </div>
          <AnimatePresence>
            {scanMenuOpen && (
              <motion.div
                data-tour="scan-dropdown"
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.14 }}
                className="absolute right-0 top-full mt-2 w-72 rounded-2xl glass-strong shadow-2xl z-50 overflow-hidden p-1.5"
              >
                <button
                  onClick={() => { scan(); setScanMenuOpen(false); }}
                  disabled={isScanning || isPulling}
                  className="w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-[12.5px] text-slate-200 hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-left"
                >
                  <span className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center shrink-0"><ScanIcon size={14} className="text-slate-300" /></span>
                  <div>
                    <div className="font-semibold">Scan Installed Games</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Steam, Epic, GOG and Ubisoft Connect</div>
                  </div>
                </button>
                <button
                  onClick={() => { pullUninstalled(); setScanMenuOpen(false); }}
                  disabled={isScanning || isPulling}
                  className="w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-[12.5px] text-slate-200 hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-left"
                >
                  <span className="w-8 h-8 rounded-lg bg-accent-500/15 flex items-center justify-center shrink-0"><DownloadIcon size={14} className="text-accent-300" /></span>
                  <div>
                    <div className="font-semibold">Pull Uninstalled Steam Games</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Import games you own but haven't installed</div>
                  </div>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button
          data-tour="add-game-btn"
          onClick={() => setAddGameOpen(true)}
          className="btn-primary h-9 text-[12.5px] py-0 px-3.5"
        >
          <PlusIcon size={14} />
          Add Game
        </button>
      </div>
    </div>
  );
}
