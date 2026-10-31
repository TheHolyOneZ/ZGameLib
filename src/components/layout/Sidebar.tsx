import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useGameStore } from "@/store/useGameStore";
import { useUIStore } from "@/store/useUIStore";
import { useNavigate, useLocation } from "react-router-dom";
import { api } from "@/lib/tauri";
import { useQuery } from "@tanstack/react-query";
import GameCover from "@/components/ui/GameCover";
import {
  GamepadIcon, LibraryIcon, HeartIcon, ClockIcon, ChartIcon,
  SettingsIcon, SpinIcon, ChevronLeftIcon,
  TvIcon, CollectionIcon, WrappedIcon, ChevronDownIcon, StopIcon,
} from "@/components/ui/Icons";

const STORAGE_KEY = "zgamelib-sidebar-collapsed";

function SectionHeader({ label, open, onToggle, dot }: { label: string; open?: boolean; onToggle?: () => void; dot?: boolean }) {
  return (
    <button
      onClick={onToggle}
      disabled={!onToggle}
      className="w-full flex items-center gap-2 px-3 pt-4 pb-1.5 group"
    >
      <span className="text-[10.5px] font-semibold text-slate-500 uppercase tracking-[0.16em] group-hover:text-slate-300 transition-colors">{label}</span>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-accent-400" />}
      <span className="flex-1" />
      {onToggle && (
        <motion.span animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.2 }} className="text-slate-600 group-hover:text-slate-400">
          <ChevronDownIcon size={11} />
        </motion.span>
      )}
    </button>
  );
}

function NowPlaying({ collapsed }: { collapsed: boolean }) {
  const activeGameId = useUIStore((s) => s.activeGameId);
  const games = useGameStore((s) => s.games);
  const game = games.find((g) => g.id === activeGameId);
  const setSelectedGameId = useGameStore((s) => s.setSelectedGameId);
  const setDetailOpen = useUIStore((s) => s.setDetailOpen);
  if (!game) return null;

  const stop = () => {
    useUIStore.getState().openConfirm(`Stop "${game.name}"?`, async () => {
      try { await api.stopGame(); useUIStore.getState().setActiveGameId(null); }
      catch (e) { useUIStore.getState().addToast(String(e), "error"); }
    }, "Stop Game");
  };

  if (collapsed) {
    return (
      <button
        onClick={() => { setSelectedGameId(game.id); setDetailOpen(true); }}
        title={`Now playing: ${game.name}`}
        className="relative w-10 h-10 mx-auto rounded-xl overflow-hidden ring-2 ring-emerald-400/60"
      >
        <GameCover game={game} />
        <span className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-black" />
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-1 rounded-2xl overflow-hidden relative"
      style={{ border: "1px solid rgba(52,211,153,0.25)", background: "linear-gradient(160deg, rgba(16,185,129,0.14), rgba(16,185,129,0.03))" }}
    >
      <div className="flex items-center gap-3 p-2.5">
        <button
          onClick={() => { setSelectedGameId(game.id); setDetailOpen(true); }}
          className="w-10 h-[52px] rounded-lg overflow-hidden shrink-0 ring-1 ring-white/10"
        >
          <GameCover game={game} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <span className="text-[10px] font-semibold text-emerald-300 uppercase tracking-[0.14em]">Now Playing</span>
          </div>
          <p className="text-[12.5px] font-semibold text-white truncate mt-0.5">{game.name}</p>
        </div>
        <button onClick={stop} title="Stop game" className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-red-500/30 transition-colors shrink-0">
          <StopIcon size={12} />
        </button>
      </div>
    </motion.div>
  );
}

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const games = useGameStore((s) => s.games);
  const resetFilters = useGameStore((s) => s.resetFilters);
  const setBigPicture = useUIStore((s) => s.setBigPicture);
  const settingsDirty = useUIStore((s) => s.settingsDirty);
  const setSettingsUnsavedNav = useUIStore((s) => s.setSettingsUnsavedNav);

  const guardedNavigate = (path: string, state?: unknown) => {
    if (settingsDirty && location.pathname === "/settings" && path !== "/settings") {
      setSettingsUnsavedNav({ path, proceed: () => { useUIStore.getState().setSettingsDirty(false); navigate(path, { state }); } });
      return;
    }
    navigate(path, { state });
  };
  const { data: collections = [] } = useQuery({ queryKey: ["collections"], queryFn: () => api.getCollections() });

  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
  });

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem(STORAGE_KEY, next ? "1" : "0"); } catch {}
      return next;
    });
  };

  const favCount = useMemo(() => games.filter((g) => g.is_favorite).length, [games]);
  const recentCount = useMemo(() => games.filter((g) => g.last_played).length, [games]);

  const navItem = (path: string, Icon: typeof LibraryIcon, label: string, count?: number, dataTour?: string) => {
    const isActive = location.pathname === path;
    return (
      <button
        key={path}
        data-tour={dataTour}
        onClick={() => { resetFilters(); guardedNavigate(path); }}
        title={collapsed ? label : undefined}
        className={cn(
          "w-full flex items-center rounded-xl text-[13px] font-medium transition-colors duration-200 relative group",
          collapsed ? "justify-center h-10" : "gap-3 px-3 h-9",
          isActive ? "text-white" : "text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]"
        )}
      >
        {isActive && (
          <motion.span
            layoutId="sidebar-active"
            className="absolute inset-0 rounded-xl"
            style={{
              background: "linear-gradient(90deg, rgb(var(--accent-500) / 0.24), rgb(var(--accent-500) / 0.06))",
              boxShadow: "inset 0 0 0 1px rgb(var(--accent-400) / 0.22)",
            }}
            transition={{ type: "spring", stiffness: 500, damping: 38 }}
          />
        )}
        {isActive && !collapsed && (
          <motion.span layoutId="sidebar-active-bar" className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-accent-400" />
        )}
        <span className={cn("relative z-10 shrink-0", isActive ? "text-accent-300" : "text-slate-500 group-hover:text-slate-300")}>
          <Icon size={17} />
        </span>
        {!collapsed && (
          <>
            <span className="relative z-10 flex-1 text-left truncate">{label}</span>
            {count !== undefined && count > 0 && (
              <span className={cn("relative z-10 text-[11px] tabular-nums", isActive ? "text-accent-200" : "text-slate-600")}>{count}</span>
            )}
          </>
        )}
      </button>
    );
  };

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 252 }}
      transition={{ type: "spring", stiffness: 420, damping: 38 }}
      className="shrink-0 flex flex-col h-full glass-sidebar relative z-10"
    >
      <div className={cn("flex items-center pt-5 pb-4", collapsed ? "flex-col gap-3 px-2" : "gap-3 px-5")}>
        <motion.div
          whileHover={{ rotate: -8, scale: 1.06 }}
          transition={{ type: "spring", stiffness: 400 }}
          className="w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0 relative"
          style={{
            background: "linear-gradient(140deg, rgb(var(--accent-400)) 0%, rgb(var(--accent-600)) 55%, rgb(var(--accent-800)) 100%)",
            boxShadow: "0 8px 24px -6px rgb(var(--accent-500) / 0.7), inset 0 1px 0 rgba(255,255,255,0.25)",
          }}
        >
          <GamepadIcon size={20} className="text-white" />
        </motion.div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <span className="font-display font-bold text-[17px] text-white tracking-tight block leading-none">ZGameLib</span>
            <span className="block text-[11px] text-slate-500 mt-1">{games.length} games in library</span>
          </div>
        )}
        <button
          onClick={toggleCollapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/[0.06] transition-all duration-200 shrink-0"
        >
          <motion.div animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.25 }}>
            <ChevronLeftIcon size={14} />
          </motion.div>
        </button>
      </div>

      <div className={cn("flex-1 overflow-y-auto overflow-x-hidden scrollbar-none pb-3", collapsed ? "px-3" : "px-3")}>
        <div className="flex flex-col gap-0.5">
          {!collapsed && <SectionHeader label="Library" />}
          {navItem("/", LibraryIcon, "All Games", games.length)}
          {navItem("/favorites", HeartIcon, "Favorites", favCount)}
          {navItem("/recent", ClockIcon, "Recently Played", recentCount)}
          {navItem("/collections", CollectionIcon, "Collections", undefined, "nav-collections")}
          {!collapsed ? <SectionHeader label="Discover" /> : <div className="h-3" />}
          {navItem("/stats", ChartIcon, "Statistics", undefined, "nav-stats")}
          {navItem("/wrapped", WrappedIcon, "Year in Review", undefined, "nav-wrapped")}
          {navItem("/spin", SpinIcon, "Game Spin", undefined, "nav-spin")}
        </div>

        {!collapsed && collections.length > 0 && (
          <div className="mt-1">
            <SectionHeader label="Collections" />
            <div className="flex flex-col gap-0.5">
              {collections.slice(0, 6).map((c) => {
                const active = location.pathname === "/collections" && (location.state as { collectionId?: string } | null)?.collectionId === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => { resetFilters(); guardedNavigate("/collections", { collectionId: c.id }); }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 h-8 rounded-lg text-[12.5px] transition-colors",
                      active ? "text-white bg-white/[0.06]" : "text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]"
                    )}
                  >
                    <span className="w-[17px] flex justify-center">
                      <span className="w-2 h-2 rounded-[3px]" style={{ background: `hsl(${(c.name.length * 47 + c.name.charCodeAt(0) * 13) % 360} 70% 62%)` }} />
                    </span>
                    <span className="flex-1 text-left truncate">{c.name}</span>
                    <span className="text-[11px] text-slate-600 tabular-nums">{c.game_count}</span>
                  </button>
                );
              })}
              {collections.length > 6 && (
                <button onClick={() => guardedNavigate("/collections")} className="px-3 h-8 text-left text-[12px] text-slate-500 hover:text-slate-200">
                  +{collections.length - 6} more
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className={cn("shrink-0 flex flex-col gap-2 pb-4 pt-3 border-t border-white/[0.05]", collapsed ? "px-3" : "px-3")}>
        <NowPlaying collapsed={collapsed} />
        <motion.button
          whileHover={{ scale: 1.015 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setBigPicture(true)}
          title="Big Picture Mode (Ctrl+B)"
          className={cn(
            "relative overflow-hidden rounded-xl flex items-center text-[13px] font-semibold text-white group",
            collapsed ? "h-10 justify-center" : "h-10 gap-3 px-3"
          )}
          style={{
            background: "linear-gradient(110deg, rgb(var(--accent-600) / 0.5), rgb(var(--accent-800) / 0.35))",
            border: "1px solid rgb(var(--accent-400) / 0.3)",
          }}
        >
          <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "linear-gradient(110deg, rgb(var(--accent-500) / 0.35), transparent)" }} />
          <TvIcon size={17} className="relative text-accent-200" />
          {!collapsed && (
            <>
              <span className="relative flex-1 text-left">Big Picture</span>
              <span className="relative kbd !h-5 !text-[9px] !bg-black/20">Ctrl B</span>
            </>
          )}
        </motion.button>
        {navItem("/settings", SettingsIcon, "Settings", undefined, "nav-settings")}
      </div>
    </motion.aside>
  );
}
