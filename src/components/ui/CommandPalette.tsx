import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "@/store/useGameStore";
import { useUIStore } from "@/store/useUIStore";
import { useCover } from "@/hooks/useCover";
import PlatformBadge from "@/components/ui/PlatformBadge";
import {
  SearchIcon, GamepadIcon, LibraryIcon, HeartIcon,
  ChartIcon, SpinIcon, SettingsIcon, PlusIcon,
} from "@/components/ui/Icons";
import { cn } from "@/lib/utils";
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
  const src = useCover(game);
  return (
    <div className={cn("flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors", active ? "bg-accent-500/10" : "hover:bg-white/[0.03]")}>
      {src ? (
        <img src={src} alt="" className="w-8 h-10 rounded-md object-cover shrink-0 border border-white/[0.05]" />
      ) : (
        <div className="w-8 h-10 rounded-md bg-white/5 shrink-0" />
      )}
      <span className="flex-1 text-[13px] text-slate-200 truncate">{game.name}</span>
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

  const makeActions = useCallback((): ActionItem[] => [
    { type: "action", id: "add-game", label: "Add Game", icon: <PlusIcon size={14} />, action: () => { setAddGameOpen(true); setOpen(false); } },
    { type: "action", id: "library", label: "Library", icon: <LibraryIcon size={14} />, action: () => { navigate("/"); setOpen(false); } },
    { type: "action", id: "favorites", label: "Favorites", icon: <HeartIcon size={14} />, action: () => { navigate("/favorites"); setOpen(false); } },
    { type: "action", id: "stats", label: "Stats", icon: <ChartIcon size={14} />, action: () => { navigate("/stats"); setOpen(false); } },
    { type: "action", id: "spin", label: "Game Spin", icon: <SpinIcon size={14} />, action: () => { navigate("/spin"); setOpen(false); } },
    { type: "action", id: "settings", label: "Settings", icon: <SettingsIcon size={14} />, action: () => { navigate("/settings"); setOpen(false); } },
  ], [navigate, setAddGameOpen, setOpen]);

  const results: ResultItem[] = (() => {
    const q = query.toLowerCase();
    const filteredGames: GameItem[] = games
      .filter((g) => g.name.toLowerCase().includes(q))
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
            className="w-[580px] max-h-[480px] flex flex-col rounded-2xl overflow-hidden"
            style={{
              background: "rgba(12,10,20,0.96)",
              backdropFilter: "blur(40px)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
            }}
          >
            <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <SearchIcon size={16} className="text-slate-500 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search games or actions…"
                className="flex-1 bg-transparent text-[14px] text-white placeholder-slate-600 outline-none"
              />
              <kbd className="px-2 py-0.5 rounded-md text-[10px] font-mono text-slate-600 border border-white/8">ESC</kbd>
            </div>

            <div ref={listRef} className="overflow-y-auto flex-1">
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
                            <div className="px-4 py-1.5">
                              <span className="text-[10px] text-slate-700 uppercase tracking-[0.14em] font-semibold">Games</span>
                            </div>
                            {gameItems.map((item) => {
                              const i = idx++;
                              return (
                                <div key={item.game.id} onClick={() => activate(item)}>
                                  <GameRow game={item.game} active={activeIndex === i} />
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {actionItems.length > 0 && (
                          <div>
                            <div className="px-4 py-1.5">
                              <span className="text-[10px] text-slate-700 uppercase tracking-[0.14em] font-semibold">Actions</span>
                            </div>
                            {actionItems.map((item) => {
                              const i = idx++;
                              return (
                                <div
                                  key={item.id}
                                  onClick={() => activate(item)}
                                  className={cn("flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors", activeIndex === i ? "bg-accent-500/10" : "hover:bg-white/[0.03]")}
                                >
                                  <span className="text-slate-500 shrink-0">{item.icon}</span>
                                  <span className="text-[13px] text-slate-300">{item.label}</span>
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
