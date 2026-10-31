import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { useGameStore } from "@/store/useGameStore";
import { useUIStore } from "@/store/useUIStore";
import GameCover from "@/components/ui/GameCover";
import PlatformBadge from "@/components/ui/PlatformBadge";
import {
  SearchIcon, GamepadIcon, LibraryIcon, HeartIcon,
  ChartIcon, SpinIcon, SettingsIcon, PlusIcon, TvIcon, ClockIcon, CollectionIcon, WrappedIcon, LayersIcon,
} from "@/components/ui/Icons";
import { cn, timeAgo, formatPlaytime } from "@/lib/utils";
import { searchGames } from "@/lib/search";
import { displayName } from "@/lib/gameName";
import type { Game } from "@/lib/types";

type ActionItem = {
  type: "action";
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
};

type GameItem = {
  type: "game";
  game: Game;
};

type ResultItem = ActionItem | GameItem;

function GameRow({ game, active }: { game: Game; active: boolean }) {
  return (
    <div className={cn("flex items-center gap-3 mx-2 px-3 py-2 rounded-xl cursor-pointer transition-colors", active ? "bg-accent-500/15" : "hover:bg-white/[0.04]")}>
      <div className="w-8 h-11 rounded-md overflow-hidden shrink-0 ring-1 ring-white/10">
        <GameCover game={game} eager />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-[13.5px] truncate", active ? "text-white font-medium" : "text-slate-200")}>{displayName(game.name)}</p>
        <p className="text-[11px] text-slate-500">{game.last_played ? `Played ${timeAgo(game.last_played)}` : game.playtime_mins > 0 ? formatPlaytime(game.playtime_mins) : "Not played yet"}</p>
      </div>
      <PlatformBadge platform={game.platform} />
    </div>
  );
}

export default function CommandPalette() {
  const isOpen = useUIStore((s) => s.isCommandPaletteOpen);
  const setOpen = useUIStore((s) => s.setCommandPaletteOpen);
  const games = useGameStore((s) => s.games);
  const setSelectedGameId = useGameStore((s) => s.setSelectedGameId);
  const setDetailOpen = useUIStore((s) => s.setDetailOpen);
  const setAddGameOpen = useUIStore((s) => s.setAddGameOpen);
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const guardedNavigate = useCallback((path: string) => {
    const { settingsDirty, setSettingsUnsavedNav, setSettingsDirty } = useUIStore.getState();
    if (settingsDirty && location.pathname === "/settings" && path !== "/settings") {
      setSettingsUnsavedNav({ path, proceed: () => { setSettingsDirty(false); navigate(path); } });
      return;
    }
    navigate(path);
  }, [navigate, location.pathname]);

  const makeActions = useCallback((): ActionItem[] => [
    { type: "action", id: "add-game", label: "Add Game", icon: <PlusIcon size={14} />, action: () => { setAddGameOpen(true); setOpen(false); } },
    { type: "action", id: "library", label: "Library", icon: <LibraryIcon size={14} />, action: () => { guardedNavigate("/"); setOpen(false); } },
    { type: "action", id: "favorites", label: "Favorites", icon: <HeartIcon size={14} />, action: () => { guardedNavigate("/favorites"); setOpen(false); } },
    { type: "action", id: "big-picture", label: "Big Picture Mode", icon: <TvIcon size={14} />, action: () => { setOpen(false); useUIStore.getState().setBigPicture(true); } },
    { type: "action", id: "duplicates", label: "Find Duplicate Games", icon: <LayersIcon size={14} />, action: () => { setOpen(false); useUIStore.getState().setDuplicatesOpen(true); } },
    { type: "action", id: "recent", label: "Recently Played", icon: <ClockIcon size={14} />, action: () => { guardedNavigate("/recent"); setOpen(false); } },
    { type: "action", id: "collections", label: "Collections", icon: <CollectionIcon size={14} />, action: () => { guardedNavigate("/collections"); setOpen(false); } },
    { type: "action", id: "wrapped", label: "Year in Review", icon: <WrappedIcon size={14} />, action: () => { guardedNavigate("/wrapped"); setOpen(false); } },
    { type: "action", id: "stats", label: "Stats", icon: <ChartIcon size={14} />, action: () => { guardedNavigate("/stats"); setOpen(false); } },
    { type: "action", id: "spin", label: "Game Spin", icon: <SpinIcon size={14} />, action: () => { guardedNavigate("/spin"); setOpen(false); } },
    { type: "action", id: "settings", label: "Settings", icon: <SettingsIcon size={14} />, action: () => { guardedNavigate("/settings"); setOpen(false); } },
  ], [guardedNavigate, setAddGameOpen, setOpen]);

  const results: ResultItem[] = (() => {
    const q = query.toLowerCase();
    const ranked = q.trim()
      ? searchGames(games, query).map((r) => r.game)
      : [...games].sort((a, b) => (b.last_played ?? "").localeCompare(a.last_played ?? ""));
    const filteredGames: GameItem[] = ranked
      .slice(0, 8)
      .map((g) => ({ type: "game", game: g }));

    const actions = makeActions();
    const filteredActions: ActionItem[] = q
      ? actions.filter((a) => a.label.toLowerCase().includes(q))
      : actions;

    return [...filteredGames, ...filteredActions];
  })();

  const activate = (item: ResultItem) => {
    if (item.type === "game") {
      setSelectedGameId(item.game.id);
      setDetailOpen(true);
      setOpen(false);
    } else {
      item.action();
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = results[activeIndex];
        if (item) activate(item);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, results, activeIndex]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-cp-idx="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex justify-center"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", paddingTop: "15%" }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="w-[620px] max-h-[520px] flex flex-col rounded-3xl overflow-hidden glass-strong"
            style={{ boxShadow: "0 40px 120px -20px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04), 0 0 80px -30px rgb(var(--accent-500) / 0.5)" }}
          >
            <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <SearchIcon size={18} className="text-accent-300 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search games or actions…"
                className="flex-1 bg-transparent text-[16px] text-white placeholder-slate-500 outline-none"
              />
              <kbd className="kbd">ESC</kbd>
            </div>

            <div ref={listRef} className="overflow-y-auto flex-1 py-2">
              {results.length === 0 ? (
                <div className="flex items-center justify-center py-10">
                  <span className="text-[13px] text-slate-600">No results for '{query}'</span>
                </div>
              ) : (
                <>
                  {(() => {
                    const gameItems = results.filter((r): r is GameItem => r.type === "game");
                    const actionItems = results.filter((r): r is ActionItem => r.type === "action");
                    let idx = 0;
                    return (
                      <>
                        {gameItems.length > 0 && (
                          <div>
                            <div className="px-5 pt-2 pb-1.5">
                              <span className="section-label !text-[10px]">Games</span>
                            </div>
                            {gameItems.map((item) => {
                              const i = idx++;
                              return (
                                <div key={item.game.id} data-cp-idx={i} onClick={() => activate(item)} onMouseMove={() => setActiveIndex(i)}>
                                  <GameRow game={item.game} active={activeIndex === i} />
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {actionItems.length > 0 && (
                          <div>
                            <div className="px-5 pt-2 pb-1.5">
                              <span className="section-label !text-[10px]">Actions</span>
                            </div>
                            {actionItems.map((item) => {
                              const i = idx++;
                              return (
                                <div
                                  key={item.id}
                                  data-cp-idx={i}
                                  onClick={() => activate(item)}
                                  onMouseMove={() => setActiveIndex(i)}
                                  className={cn("flex items-center gap-3 mx-2 px-3 py-2.5 rounded-xl cursor-pointer transition-colors", activeIndex === i ? "bg-accent-500/15 text-white" : "text-slate-300")}
                                >
                                  <span className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", activeIndex === i ? "bg-accent-500/25 text-accent-200" : "bg-white/[0.05] text-slate-400")}>{item.icon}</span>
                                  <span className="text-[13.5px]">{item.label}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
