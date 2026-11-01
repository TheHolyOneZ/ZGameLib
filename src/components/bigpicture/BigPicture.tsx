import Logo from "@/components/ui/Logo";
import * as gameActions from "@/lib/gameActions";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGameStore } from "@/store/useGameStore";
import { useUIStore } from "@/store/useUIStore";
import { useScan, useLibraryGames } from "@/hooks/useGames";
import { useLaunchGame } from "@/lib/useLaunchGame";
import { api } from "@/lib/tauri";
import { startGamepadLoop, KEY_MAP, rumble, getConnectedPads, detectControllerKind, prettyControllerName } from "@/lib/gamepad";
import type { PadAction, ControllerKind, InputSource } from "@/lib/gamepad";
import type { Collection, Game, GameStatus } from "@/lib/types";
import GameCover from "@/components/ui/GameCover";
import ButtonGlyph from "./ButtonGlyph";
import { SpatialNav } from "./spatialNav";
import { playSound, isSoundEnabled, setSoundEnabled } from "./sound";
import {
  BP_TABS, FILTERS, SORTS, HomeView, GridView, CollectionsView, Chip, applyLibraryView,
  type BpTab, type LibraryFilter, type LibrarySort,
} from "./BpViews";
import { GamePage, Picker, OnScreenKeyboard, MenuPanel, ConfirmDialog, LaunchSplash } from "./BpOverlays";
import { NowPlayingCard } from "./BpNowPlaying";
import LiveSessionClock from "@/components/ui/SessionClock";
import { displayName } from "@/lib/gameName";
import { GamepadIcon, SearchIcon, CloseIcon } from "@/components/ui/Icons";

export const BP_AUTOSTART_KEY = "zgamelib-bp-autostart";
const BP_FULLSCREEN_KEY = "zgamelib-bp-fullscreen";

function readFlag(key: string, fallback: boolean) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === "1";
  } catch { return fallback; }
}

function writeFlag(key: string, v: boolean) {
  try { localStorage.setItem(key, v ? "1" : "0"); } catch {}
}

async function setWindowFullscreen(v: boolean): Promise<boolean | null> {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const w = getCurrentWindow();
    const prev = await w.isFullscreen();
    await w.setFullscreen(v);
    return prev;
  } catch {
    return null;
  }
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);
  return <span className="tabular-nums">{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>;
}

type Picking = { kind: "status" } | { kind: "rating" } | null;

export default function BigPicture() {
  const open = useUIStore((s) => s.bigPicture);
  return <AnimatePresence>{open && <BigPictureShell key="bp" />}</AnimatePresence>;
}

function BigPictureShell() {
  const setBigPicture = useUIStore((s) => s.setBigPicture);
  const activeGameId = useUIStore((s) => s.activeGameId);
  const customStatuses = useUIStore((s) => s.customStatuses);
  const confirmDialog = useUIStore((s) => s.confirmDialog);
  const closeConfirm = useUIStore((s) => s.closeConfirm);
  const { updateGame: update, toggleFavorite } = gameActions;
  const { scan } = useScan();
  const { launch } = useLaunchGame();

  const games = useLibraryGames();

  const rootRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<SpatialNav | null>(null);
  const returnFocus = useRef<HTMLElement[]>([]);

  const [tab, setTab] = useState<BpTab>("home");
  const [source, setSource] = useState<InputSource>(() => (getConnectedPads().length ? "gamepad" : "keyboard"));
  const [kind, setKind] = useState<ControllerKind | null>(() => {
    const p = getConnectedPads()[0];
    return p ? detectControllerKind(p.id) : null;
  });
  const [controllerName, setControllerName] = useState<string | null>(() => getConnectedPads()[0]?.id ?? null);
  const [focusedGameId, setFocusedGameId] = useState<string | null>(null);
  const [pageGameId, setPageGameId] = useState<string | null>(null);
  const [picking, setPicking] = useState<Picking>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [sort, setSort] = useState<LibrarySort>("name");
  const [openCollection, setOpenCollection] = useState<Collection | null>(null);
  const [launching, setLaunching] = useState<Game | null>(null);
  const [sound, setSound] = useState(isSoundEnabled());
  const [fullscreen, setFullscreen] = useState(() => readFlag(BP_FULLSCREEN_KEY, true));
  const [autostart, setAutostart] = useState(() => readFlag(BP_AUTOSTART_KEY, false));

  const pageGame = pageGameId ? games.find((g) => g.id === pageGameId) ?? null : null;
  const focusedGame = focusedGameId ? games.find((g) => g.id === focusedGameId) ?? null : null;
  const [settledId, setSettledId] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setSettledId(focusedGameId), 180);
    return () => clearTimeout(t);
  }, [focusedGameId]);
  const settledGame = settledId ? games.find((g) => g.id === settledId) ?? null : null;

  useEffect(() => {
    let prev: boolean | null = null;
    if (readFlag(BP_FULLSCREEN_KEY, true)) {
      setWindowFullscreen(true).then((p) => { prev = p; });
    }
    document.documentElement.style.overflow = "hidden";
    return () => {
      if (prev === false) setWindowFullscreen(false);
      document.documentElement.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const nav = new SpatialNav(root);
    nav.onFocus = (el) => {
      const id = el.dataset.bpGameId;
      if (id) setFocusedGameId(id);
    };
    navRef.current = nav;
    const t = setTimeout(() => nav.ensure(true), 60);
    return () => clearTimeout(t);
  }, []);

  const pushLayer = useCallback(() => {
    const cur = navRef.current?.current;
    if (cur) returnFocus.current.push(cur);
  }, []);

  const popLayer = useCallback(() => {
    const el = returnFocus.current.pop() ?? null;
    requestAnimationFrame(() => requestAnimationFrame(() => navRef.current?.restore(el)));
  }, []);

  const focusFresh = useCallback(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => navRef.current?.ensure(true)));
  }, []);

  useEffect(() => {
    focusFresh();
    rootRef.current?.querySelector("[data-bp-content]")?.scrollTo({ top: 0 });
  }, [tab, openCollection, focusFresh]);

  const switchTab = useCallback((dir: 1 | -1) => {
    setTab((t) => {
      const i = BP_TABS.findIndex((x) => x.key === t);
      const next = BP_TABS[(i + dir + BP_TABS.length) % BP_TABS.length].key;
      return next;
    });
    setOpenCollection(null);
    playSound("tab");
  }, []);

  const openGame = useCallback((g: Game) => {
    pushLayer();
    setPageGameId(g.id);
    playSound("select");
    focusFresh();
  }, [pushLayer, focusFresh]);

  const closeGame = useCallback(() => {
    setPageGameId(null);
    setPicking(null);
    popLayer();
  }, [popLayer]);

  const doLaunch = useCallback((g: Game) => {
    launch(g, () => {
      playSound("launch");
      rumble(0.5, 140);
      setLaunching(g);
      setTimeout(() => setLaunching(null), 2600);
    });
  }, [launch]);

  const doStop = useCallback(() => {
    api.stopGame()
      .then(() => { useUIStore.getState().setActiveGameId(null); playSound("back"); })
      .catch((e) => useUIStore.getState().addToast(String(e), "error"));
  }, []);

  const confirmStop = useCallback((name: string) => {
    useUIStore.getState().openConfirm(`Stop "${displayName(name)}"? Your playtime so far is saved.`, doStop, "Stop Game");
  }, [doStop]);

  const switchToGame = useCallback(() => {
    playSound("select");
    api.focusRunningGame()
      .then((ok) => { if (!ok) useUIStore.getState().addToast("Couldn't find the game window — switch with Alt+Tab", "info"); })
      .catch(() => {});
  }, []);

  const openKeyboard = useCallback(() => {
    pushLayer();
    setKeyboardOpen(true);
    if (tab !== "library") { setTab("library"); setOpenCollection(null); }
    playSound("select");
    focusFresh();
  }, [pushLayer, focusFresh, tab]);

  const closeKeyboard = useCallback(() => {
    setKeyboardOpen(false);
    returnFocus.current.pop();
    focusFresh();
  }, [focusFresh]);

  const openMenu = useCallback(() => {
    pushLayer();
    setMenuOpen(true);
    playSound("select");
    focusFresh();
  }, [pushLayer, focusFresh]);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    popLayer();
  }, [popLayer]);

  const openPicker = useCallback((p: Picking) => {
    pushLayer();
    setPicking(p);
    focusFresh();
  }, [pushLayer, focusFresh]);

  const closePicker = useCallback(() => {
    setPicking(null);
    popLayer();
  }, [popLayer]);

  const exit = useCallback(() => {
    playSound("back");
    setBigPicture(false);
  }, [setBigPicture]);

  const confirmOpen = !!confirmDialog?.open;
  const wasConfirmOpen = useRef(false);
  useEffect(() => {
    if (confirmOpen && !wasConfirmOpen.current) { pushLayer(); focusFresh(); }
    if (!confirmOpen && wasConfirmOpen.current) popLayer();
    wasConfirmOpen.current = confirmOpen;
  }, [confirmOpen, pushLayer, popLayer, focusFresh]);

  const stateRef = useRef({ tab, pageGame, picking, keyboardOpen, menuOpen, confirmDialog, openCollection, focusedGameId, launching });
  stateRef.current = { tab, pageGame, picking, keyboardOpen, menuOpen, confirmDialog, openCollection, focusedGameId, launching };

  const handlersRef = useRef<(action: PadAction, src: InputSource, k?: ControllerKind) => void>(() => {});
  handlersRef.current = (action, src, k) => {
    setSource(src);
    if (k) setKind(k);
    const nav = navRef.current;
    if (!nav) return;
    const s = stateRef.current;

    if (action === "up" || action === "down" || action === "left" || action === "right") {
      if (nav.move(action)) playSound("move");
      return;
    }
    if (action === "lt" || action === "rt") {
      let moved = false;
      for (let i = 0; i < 3; i++) moved = nav.move(action === "lt" ? "up" : "down") || moved;
      if (moved) playSound("move");
      return;
    }
    if (action === "a") {
      if (nav.activate()) playSound("select");
      return;
    }

    if (s.confirmDialog) {
      if (action === "b") { closeConfirm(); playSound("back"); }
      return;
    }
    if (s.picking) {
      if (action === "b") { closePicker(); playSound("back"); }
      return;
    }
    if (s.keyboardOpen) {
      if (action === "b" || action === "start") { closeKeyboard(); playSound("back"); }
      else if (action === "x") { setQuery((q) => q.slice(0, -1)); playSound("move"); }
      else if (action === "y") { setQuery((q) => q + " "); playSound("move"); }
      return;
    }
    if (s.menuOpen) {
      if (action === "b" || action === "start" || action === "select") { closeMenu(); playSound("back"); }
      return;
    }
    if (s.pageGame) {
      if (action === "b") { closeGame(); playSound("back"); }
      else if (action === "x") { toggleFavorite(s.pageGame.id); playSound("select"); }
      else if (action === "start" || action === "select") openMenu();
      return;
    }

    switch (action) {
      case "b":
        if (s.tab === "collections" && s.openCollection) { setOpenCollection(null); playSound("back"); }
        else if (s.tab !== "home") { setTab("home"); playSound("back"); }
        else openMenu();
        break;
      case "lb": switchTab(-1); break;
      case "rb": switchTab(1); break;
      case "y": openKeyboard(); break;
      case "x": {
        const id = nav.current?.dataset.bpGameId;
        if (id) { toggleFavorite(id); playSound("select"); rumble(0.2, 40); }
        break;
      }
      case "start":
      case "select":
        openMenu();
        break;
    }
  };

  useEffect(() => {
    return startGamepadLoop(
      (action, src, k) => handlersRef.current(action, src, k),
      (k, name) => { setKind(k); setControllerName(name); if (k) setSource("gamepad"); },
    );
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.ctrlKey && (e.key === "b" || e.key === "B")) { e.preventDefault(); exit(); return; }
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const s = stateRef.current;
      if (s.keyboardOpen && !s.confirmDialog) {
        if (e.key === "Backspace") { e.preventDefault(); setQuery((q) => q.slice(0, -1)); return; }
        if (e.key === "Enter") { e.preventDefault(); closeKeyboard(); return; }
        if (e.key.length === 1) { e.preventDefault(); setQuery((q) => q + e.key); return; }
      }
      const action = KEY_MAP[e.key];
      if (!action) return;
      e.preventDefault();
      if (e.repeat && !(action === "up" || action === "down" || action === "left" || action === "right")) return;
      handlersRef.current(action, "keyboard");
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [exit, closeKeyboard]);

  const onMouseMove = (e: React.MouseEvent) => {
    if (source !== "mouse") setSource("mouse");
    const nav = navRef.current;
    if (!nav) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-bp-focusable]");
    if (el && el !== nav.current && nav.scope().contains(el)) nav.set(el, { scroll: false });
  };

  const libraryGames = useMemo(() => applyLibraryView(games, filter, sort, query), [games, filter, sort, query]);
  const favoriteGames = useMemo(() => games.filter((g) => g.is_favorite).sort((a, b) => a.name.localeCompare(b.name)), [games]);
  const recentGames = useMemo(() => games.filter((g) => g.last_played).sort((a, b) => (b.last_played ?? "").localeCompare(a.last_played ?? "")), [games]);

  const runningGame = activeGameId ? games.find((g) => g.id === activeGameId) ?? null : null;
  const backdropGame = pageGame ?? settledGame ?? runningGame ?? recentGames[0] ?? games[0] ?? null;

  const hints: { action: PadAction; label: string }[] = (() => {
    if (confirmDialog) return [{ action: "a", label: "Select" }, { action: "b", label: "Cancel" }];
    if (picking) return [{ action: "a", label: "Choose" }, { action: "b", label: "Cancel" }];
    if (keyboardOpen) return [{ action: "a", label: "Type" }, { action: "x", label: "Delete" }, { action: "y", label: "Space" }, { action: "b", label: "Done" }];
    if (menuOpen) return [{ action: "a", label: "Select" }, { action: "b", label: "Close" }];
    if (pageGame) return [{ action: "a", label: "Select" }, { action: "x", label: pageGame.is_favorite ? "Unfavorite" : "Favorite" }, { action: "b", label: "Back" }];
    const list: { action: PadAction; label: string }[] = [{ action: "a", label: "Select" }];
    if (focusedGame) list.push({ action: "x", label: focusedGame.is_favorite ? "Unfavorite" : "Favorite" });
    list.push({ action: "y", label: "Search" });
    list.push({ action: "start", label: "Menu" });
    if (tab !== "home") list.push({ action: "b", label: "Back" });
    return list;
  })();

  const chips = (
    <>
      {query && (
        <button
          tabIndex={-1}
          data-bp-focusable
          onClick={() => setQuery("")}
          className="bp-focusable bp-btn relative px-5 h-11 rounded-full text-[16px] font-semibold bg-accent-500/30 text-white border border-accent-400/50 flex items-center gap-2"
        >
          <SearchIcon size={16} /> “{query}” <CloseIcon size={14} />
        </button>
      )}
      {FILTERS.map((f, i) => (
        <Chip key={f.key} label={f.label} active={filter === f.key} onClick={() => setFilter(f.key)} autofocus={i === 0 && !query} />
      ))}
      <span className="w-px h-11 bg-white/10 mx-2" />
      {SORTS.map((o) => (
        <Chip key={o.key} label={o.label} active={sort === o.key} onClick={() => setSort(o.key)} />
      ))}
    </>
  );

  return (
    <motion.div
      ref={rootRef}
      initial={{ opacity: 0, scale: 1.02 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      onMouseMove={onMouseMove}
      className={`bp-root fixed inset-0 z-[90] overflow-clip ${source === "gamepad" ? "bp-hide-cursor" : ""}`}
      style={{ ["--bp-card" as string]: "clamp(150px, 11vw, 230px)", ["--bp-card-lg" as string]: "clamp(180px, 13.5vw, 280px)" }}
    >
      <div className="absolute inset-0 pointer-events-none">
        <AnimatePresence>
          {backdropGame && (
            <motion.div
              key={backdropGame.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7 }}
              className="absolute inset-0"
            >
              <div
                className="absolute opacity-45"
                style={{ left: "-5%", top: "-5%", width: "13.75%", height: "13.75%", transform: "scale(8)", transformOrigin: "0 0", filter: "blur(9px) saturate(1.5)" }}
              >
                <GameCover game={backdropGame} eager />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgb(var(--bg-base) / 0.35) 0%, rgb(var(--bg-base) / 0.78) 45%, rgb(var(--bg-base) / 0.97) 100%)" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(120% 80% at 0% 0%, rgb(var(--accent-600) / 0.18), transparent 60%)" }} />
      </div>

      <div className="relative h-full flex flex-col">
        <header className="shrink-0 flex items-center gap-6 px-[5vw] pt-6 pb-2">
          <div className="flex items-center gap-3 mr-4">
            <Logo size={46} />
          </div>
          <ButtonGlyph action="lb" kind={kind} source={source} size={32} />
          <nav className="flex items-center gap-1">
            {BP_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); setOpenCollection(null); playSound("tab"); }}
                className={`relative px-5 py-2.5 text-[19px] font-semibold rounded-full transition-colors ${tab === t.key ? "text-white" : "text-white/45 hover:text-white/80"}`}
              >
                {tab === t.key && (
                  <motion.span layoutId="bp-tab" className="absolute inset-0 rounded-full bg-white/[0.12] border border-white/15" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
                )}
                <span className="relative">{t.label}</span>
              </button>
            ))}
          </nav>
          <ButtonGlyph action="rb" kind={kind} source={source} size={32} />
          <div className="flex-1" />
          <div className="flex items-center gap-5 text-[18px] font-semibold text-white/75">
            {activeGameId && (
              <span className="flex items-center gap-2.5 pl-3 pr-4 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/25 text-emerald-200 text-[15px]">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="max-w-[18vw] truncate">{runningGame ? displayName(runningGame.name) : "Game running"}</span>
                <LiveSessionClock className="tabular-nums text-emerald-100/80 font-bold" />
              </span>
            )}
            <span className={`flex items-center gap-2 text-[14px] ${kind ? "text-white/70" : "text-white/35"}`} title={controllerName ?? undefined}>
              <GamepadIcon size={20} />
              {kind ? prettyControllerName(controllerName) : "No controller"}
            </span>
            <Clock />
          </div>
        </header>

        <div data-bp-content className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-none">
          {tab === "home" && (
            <HomeView
              games={games}
              runningId={activeGameId}
              focusedGame={settledGame}
              onSelect={openGame}
              onOpenTab={(t) => setTab(t)}
              nowPlaying={runningGame ? (
                <NowPlayingCard
                  game={runningGame}
                  statuses={customStatuses}
                  onSwitch={switchToGame}
                  onDetails={() => openGame(runningGame)}
                  onStop={() => confirmStop(runningGame.name)}
                />
              ) : undefined}
            />
          )}
          {tab === "library" && (
            <GridView title="Library" games={libraryGames} runningId={activeGameId} onSelect={openGame} chips={chips} empty={query ? `No games match “${query}”.` : "No games match this filter."} />
          )}
          {tab === "favorites" && (
            <GridView title="Favorites" games={favoriteGames} runningId={activeGameId} onSelect={openGame} empty="Press X on any game to add it to your favorites." />
          )}
          {tab === "recent" && (
            <GridView title="Recently Played" games={recentGames} runningId={activeGameId} onSelect={openGame} empty="Games you launch will show up here." />
          )}
          {tab === "collections" && (
            <CollectionsView games={games} runningId={activeGameId} onSelect={openGame} openCollection={openCollection} setOpenCollection={setOpenCollection} />
          )}
        </div>

        <footer className="relative z-[65] shrink-0 flex items-center justify-end gap-7 px-[5vw] py-5 border-t border-white/[0.06]" style={{ background: "linear-gradient(0deg, rgb(var(--bg-base) / 0.95), rgb(var(--bg-base) / 0.6))" }}>
          {source !== "gamepad" && (
            <span className="mr-auto text-[14px] text-white/35">Connect an Xbox or PlayStation controller for the full experience · Ctrl+B to exit</span>
          )}
          {hints.map((h) => (
            <button
              key={h.action + h.label}
              onClick={() => handlersRef.current(h.action, source === "gamepad" ? "gamepad" : "mouse")}
              className="flex items-center gap-2.5 text-[17px] font-semibold text-white/80 hover:text-white"
            >
              <ButtonGlyph action={h.action} kind={kind} source={source} size={30} />
              {h.label}
            </button>
          ))}
        </footer>
      </div>

      {pageGame && (
        <GamePage
          game={pageGame}
          running={activeGameId === pageGame.id}
          statuses={customStatuses}
          onPlay={() => doLaunch(pageGame)}
          onStop={() => confirmStop(pageGame.name)}
          onFavorite={() => toggleFavorite(pageGame.id)}
          onStatus={() => openPicker({ kind: "status" })}
          onRate={() => openPicker({ kind: "rating" })}
          onClose={closeGame}
        />
      )}

      {pageGame && picking?.kind === "status" && (
        <Picker<string>
          title="Set Status"
          value={pageGame.status}
          options={[{ value: "none", label: "No Status", color: "#64748b" }, ...customStatuses.map((s) => ({ value: s.key, label: s.label, color: s.color }))]}
          onPick={(v) => { update({ id: pageGame.id, status: v as GameStatus }); closePicker(); }}
        />
      )}

      {pageGame && picking?.kind === "rating" && (
        <Picker<number>
          title="Rate this game"
          columns={5}
          value={pageGame.rating}
          options={Array.from({ length: 10 }, (_, i) => ({ value: i + 1, label: String(i + 1) }))}
          onPick={(v) => { update({ id: pageGame.id, rating: v }); closePicker(); }}
        />
      )}

      {keyboardOpen && (
        <OnScreenKeyboard
          query={query}
          onKey={(k) => setQuery((q) => q + k)}
          onBackspace={() => setQuery((q) => q.slice(0, -1))}
          onClear={() => setQuery("")}
          onDone={closeKeyboard}
        />
      )}

      {menuOpen && (
        <MenuPanel
          sound={sound}
          fullscreen={fullscreen}
          autostart={autostart}
          controllerName={prettyControllerName(controllerName)}
          onResume={closeMenu}
          onScan={() => { scan(); closeMenu(); }}
          onToggleSound={() => { const v = !sound; setSound(v); setSoundEnabled(v); if (v) playSound("select"); }}
          onToggleFullscreen={() => { const v = !fullscreen; setFullscreen(v); writeFlag(BP_FULLSCREEN_KEY, v); setWindowFullscreen(v); }}
          onToggleAutostart={() => { const v = !autostart; setAutostart(v); writeFlag(BP_AUTOSTART_KEY, v); }}
          onExit={exit}
          onQuit={() => {
            useUIStore.getState().openConfirm("Quit ZGameLib?", async () => {
              try { const { exit: quit } = await import("@tauri-apps/plugin-process"); await quit(0); } catch {}
            }, "Quit");
          }}
        />
      )}

      {confirmDialog?.open && (
        <ConfirmDialog
          title={confirmDialog.title}
          confirmLabel={confirmDialog.confirmLabel ?? "Confirm"}
          onConfirm={() => { const fn = confirmDialog.onConfirm; closeConfirm(); fn(); }}
          onCancel={() => closeConfirm()}
        />
      )}

      <AnimatePresence>{launching && <LaunchSplash game={launching} />}</AnimatePresence>
    </motion.div>
  );
}
