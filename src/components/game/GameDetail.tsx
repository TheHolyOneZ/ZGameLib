import * as gameActions from "@/lib/gameActions";
import { AnimatePresence, motion } from "framer-motion";
import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { useGameStore } from "@/store/useGameStore";
import { useUIStore } from "@/store/useUIStore";
import { useCover, setCoverCache, clearCoverCache, queueFetch, want } from "@/hooks/useCover";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/tauri";
import { useLaunchGame } from "@/lib/useLaunchGame";
import { cn, formatPlaytime, formatDate, timeAgo, PLATFORM_LABELS } from "@/lib/utils";
import { cleanTitle, displayName } from "@/lib/gameName";
import StarRating from "@/components/ui/StarRating";
import GameNotes from "./GameNotes";
import ModLoaderPanel from "./ModLoaderPanel";
import PlatformBadge from "@/components/ui/PlatformBadge";
import GameCover from "@/components/ui/GameCover";
import CoverSearchModal from "@/components/modals/CoverSearchModal";
import {
  CloseIcon, HeartIcon, PlayIcon, FolderIcon, TrashIcon,
  CheckIcon, TagIcon, ClockIcon, StarIcon, ImageIcon, SearchIcon,
  CopyIcon, ExternalLinkIcon, PlusIcon, StopIcon, ChevronLeftIcon, ChevronRightIcon,
  CollectionIcon, SparkleIcon, DownloadIcon, PinIcon,
} from "@/components/ui/Icons";
import type { Session, Collection, Game, GameStatus } from "@/lib/types";

function GenreIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="7" width="20" height="14" rx="3" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8 14H10M9 13V15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M14 14H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M8 4H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function DevIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M8 9L4 12L8 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16 9L20 12L16 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14 4L10 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function PubIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M3 21H21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M5 21V7L12 3L19 7V21" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <rect x="9" y="13" width="6" height="8" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

function CalIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="17" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M3 10H21" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8 3V7M16 3V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

const PLACEHOLDER_GAME: Game = {
  id: "", name: "", platform: "custom", cover_path: null, exe_path: null, install_dir: null, description: null, rating: null,
  status: "none", is_favorite: false, is_pinned: false, playtime_mins: 0, last_played: null, date_added: "", steam_app_id: null,
  epic_app_name: null, ubisoft_game_id: null, tags: [], sort_order: 0, deleted_at: null, custom_fields: {}, hltb_main_mins: null,
  hltb_extra_mins: null, genre: null, developer: null, publisher: null, release_year: null, igdb_skipped: false, not_installed: false,
};

function SectionTitle({ icon, children, action }: { icon?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {icon && <span className="text-slate-500">{icon}</span>}
      <span className="section-label">{children}</span>
      <div className="flex-1" />
      {action}
    </div>
  );
}

function IgdbMetadataCard({ game, onClear }: { game: Game; onClear: () => void }) {
  const fields: { label: string; value: string | number | null | undefined; icon: ReactNode }[] = [
    { label: "Genre", value: game.genre, icon: <GenreIcon /> },
    { label: "Developer", value: game.developer, icon: <DevIcon /> },
    { label: "Publisher", value: game.publisher, icon: <PubIcon /> },
    { label: "Released", value: game.release_year, icon: <CalIcon /> },
  ].filter((f) => f.value != null && f.value !== "");

  return (
    <div className="surface overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span className="section-label !text-[10px]">Details from IGDB</span>
        <button
          onClick={onClear}
          className="text-[11px] text-slate-500 hover:text-red-400 transition-colors"
          title="Data is matched by name. Remove it if the match is wrong."
        >
          Remove
        </button>
      </div>
      <div className="grid grid-cols-2">
        {fields.map((f, i) => (
          <div
            key={f.label}
            className={cn("flex items-start gap-2.5 px-4 py-3 min-w-0 border-t border-white/[0.05]", i % 2 === 1 && "border-l", fields.length === 1 && "col-span-2")}
          >
            <span className="text-slate-500 shrink-0 mt-0.5">{f.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-slate-500 uppercase tracking-[0.12em] font-semibold">{f.label}</p>
              <p className="text-[12.5px] text-slate-100 font-medium leading-snug break-words mt-0.5">{f.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const shotCache = new Map<string, string>();

function useScreenshotUrl(path: string, enabled = true) {
  const [url, setUrl] = useState<string | null>(() => shotCache.get(path) ?? null);
  useEffect(() => {
    if (!enabled) return;
    const hit = shotCache.get(path);
    if (hit) { setUrl(hit); return; }
    let cancelled = false;
    const release = want("shot:" + path);
    queueFetch(() => api.readImageBase64(path), "shot:" + path)
      .then((data) => {
        if (shotCache.size > 60) shotCache.delete(shotCache.keys().next().value!);
        shotCache.set(path, data);
        if (!cancelled) setUrl(data);
      })
      .catch(() => {});
    return () => { cancelled = true; release(); };
  }, [path, enabled]);
  return url || null;
}

function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) { setInView(true); io.disconnect(); } }, { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, [inView]);
  return [ref, inView] as const;
}

function ScreenshotThumb({ path, onOpen }: { path: string; onOpen: () => void }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  const dataUrl = useScreenshotUrl(path, inView);
  const addToast = useUIStore((s) => s.addToast);
  const folderPath = path.replace(/[\\/][^\\/]+$/, "");

  const action = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn(); };
  const btn = "p-1.5 rounded-lg bg-black/50 hover:bg-black/70 text-slate-200 hover:text-white transition-colors backdrop-blur";

  return (
    <div ref={ref} className="break-inside-avoid rounded-xl overflow-hidden mb-2 ring-1 ring-white/[0.06] hover:ring-accent-400/40 transition-all relative group cursor-zoom-in" onClick={onOpen}>
      {dataUrl ? <img src={dataUrl} alt="" className="w-full h-auto block" /> : <div className="w-full aspect-video bg-white/[0.04] animate-pulse" />}
      {dataUrl && (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-1 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)" }}>
          <button onClick={action(async () => { await navigator.clipboard.writeText(path); addToast("Path copied", "success"); })} title="Copy path" className={btn}><CopyIcon size={11} /></button>
          <button onClick={action(() => { api.openUrl(path).catch(() => {}); })} title="Open file" className={btn}><ExternalLinkIcon size={11} /></button>
          <button onClick={action(() => { api.openUrl(folderPath).catch(() => {}); })} title="Open folder" className={btn}><FolderIcon size={11} /></button>
          <button
            onClick={action(() => {
              const a = document.createElement("a");
              a.href = dataUrl;
              a.download = path.split(/[\\/]/).pop() ?? "screenshot.jpg";
              a.click();
            })}
            title="Save a copy"
            className={btn}
          >
            <DownloadIcon size={11} />
          </button>
        </div>
      )}
    </div>
  );
}

function ScreenshotLightbox({ shots, index, setIndex }: { shots: string[]; index: number; setIndex: (i: number | null) => void }) {
  const dataUrl = useScreenshotUrl(shots[index]);
  const len = shots.length;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, pointerEvents: "none" }}
      className="fixed inset-0 z-[70] flex items-center justify-center p-16"
      style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(10px)" }}
      onClick={() => setIndex(null)}
    >
      <span className="absolute top-5 left-1/2 -translate-x-1/2 text-[12px] text-slate-400 tabular-nums">{index + 1} / {len}</span>
      <button onClick={(e) => { e.stopPropagation(); setIndex((index - 1 + len) % len); }} className="absolute left-5 top-1/2 -translate-y-1/2 btn-icon w-11 h-11"><ChevronLeftIcon size={18} /></button>
      {dataUrl ? (
        <motion.img key={index} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} src={dataUrl} alt="" className="max-w-full max-h-full rounded-xl object-contain shadow-2xl" onClick={(e) => e.stopPropagation()} />
      ) : (
        <div className="w-96 h-56 animate-pulse bg-white/5 rounded-xl" />
      )}
      <button onClick={(e) => { e.stopPropagation(); setIndex((index + 1) % len); }} className="absolute right-5 top-1/2 -translate-y-1/2 btn-icon w-11 h-11"><ChevronRightIcon size={18} /></button>
      <button onClick={() => setIndex(null)} className="absolute top-5 right-5 btn-icon"><CloseIcon size={15} /></button>
    </motion.div>
  );
}

function HistoryTab({ sessions, loading }: { sessions: Session[] | null; loading: boolean }) {
  if (loading || sessions === null) {
    return <div className="flex justify-center py-16"><div className="w-5 h-5 rounded-full border-2 border-accent-500/30 border-t-accent-500 animate-spin" /></div>;
  }
  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ClockIcon size={30} className="text-slate-600 mb-3" />
        <p className="text-[13.5px] text-slate-300">No sessions recorded yet</p>
        <p className="text-[12px] text-slate-500 mt-1">Sessions are tracked when you launch games from ZGameLib</p>
      </div>
    );
  }
  const total = sessions.reduce((a, s) => a + s.duration_mins, 0);
  const longest = Math.max(...sessions.map((s) => s.duration_mins), 1);
  const recent = [...sessions].slice(0, 24).reverse();
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { label: "Sessions", value: String(sessions.length) },
          { label: "Average", value: formatPlaytime(Math.round(total / sessions.length)) },
          { label: "Longest", value: formatPlaytime(longest) },
        ].map((s) => (
          <div key={s.label} className="surface px-3.5 py-3">
            <p className="text-[10px] text-slate-500 uppercase tracking-[0.12em] font-semibold">{s.label}</p>
            <p className="text-[16px] font-bold text-white mt-0.5 tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>
      <div className="surface p-4">
        <p className="section-label !text-[10px] mb-3">Last {recent.length} sessions</p>
        <div className="flex items-end gap-1 h-20">
          {recent.map((s) => (
            <div key={s.id} className="flex-1 max-w-[28px] group relative flex flex-col justify-end h-full">
              <div
                className="w-full rounded-t-[3px] bg-accent-500/70 group-hover:bg-accent-400 transition-colors"
                style={{ height: `${Math.max(4, (s.duration_mins / longest) * 100)}%` }}
              />
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-bg-elevated border border-white/10 text-[9.5px] text-slate-200 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10">
                {formatPlaytime(s.duration_mins)}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {sessions.map((s) => (
          <div key={s.id} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl hover:bg-white/[0.03] transition-colors">
            <div className="w-9 h-9 rounded-lg bg-white/[0.04] flex flex-col items-center justify-center shrink-0">
              <span className="text-[8.5px] uppercase text-slate-500 font-semibold leading-none">{new Date(s.started_at).toLocaleDateString(undefined, { month: "short" })}</span>
              <span className="text-[13px] font-bold text-white leading-none mt-0.5">{new Date(s.started_at).getDate()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] text-slate-200">{new Date(s.started_at).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: new Date(s.started_at).getFullYear() === new Date().getFullYear() ? undefined : "numeric" })}</p>
              <p className="text-[11px] text-slate-500">{new Date(s.started_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</p>
            </div>
            <span className="text-[12.5px] text-slate-200 font-semibold tabular-nums">{formatPlaytime(s.duration_mins)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function GameDetail() {
  const selectedGameId = useGameStore((s) => s.selectedGameId);
  const game = useGameStore((s) => s.games.find((g) => g.id === s.selectedGameId) ?? null);
  const isOpen = useUIStore((s) => s.isDetailOpen);
  const setDetailOpen = useUIStore((s) => s.setDetailOpen);
  const { updateGame: update, moveToTrash: remove, toggleFavorite, togglePinned } = gameActions;
  const openConfirm = useUIStore((s) => s.openConfirm);
  const addToast = useUIStore((s) => s.addToast);
  const activeGameId = useUIStore((s) => s.activeGameId);
  const { launch } = useLaunchGame();

  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [descVal, setDescVal] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [showCoverSearch, setShowCoverSearch] = useState(false);
  const [activeTab, setActiveTab] = useState<"info" | "screenshots" | "mods" | "history">("info");
  const [screenshots, setScreenshots] = useState<string[] | null>(null);
  const [loadingShots, setLoadingShots] = useState(false);
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [coverLightbox, setCoverLightbox] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [pendingTags, setPendingTags] = useState<Set<string>>(new Set());
  const [showCollectionMenu, setShowCollectionMenu] = useState(false);
  const [igdbFetching, setIgdbFetching] = useState(false);
  const [hltbFetching, setHltbFetching] = useState(false);
  const [newFieldKey, setNewFieldKey] = useState<string | null>(null);
  const pendingTagTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const collectionMenuRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const customStatuses = useUIStore((s) => s.customStatuses);
  const qc = useQueryClient();

  const { data: allCollections = [] } = useQuery<Collection[]>({
    queryKey: ["collections"],
    queryFn: () => api.getCollections(),
  });

  const { data: gameCollections = [], refetch: refetchGameCollections } = useQuery<Collection[]>({
    queryKey: ["game-collections", selectedGameId],
    queryFn: () => api.getCollectionsForGame(selectedGameId ?? ""),
    enabled: !!selectedGameId,
  });

  const flashSaved = useCallback(() => {
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 1800);
  }, []);

  useEffect(() => {
    setActiveTab("info");
    setScreenshots(null);
    setLoadingShots(false);
    setSessions(null);
    setLoadingSessions(false);
    setDescExpanded(false);
    setLightboxIndex(null);
    setShowCollectionMenu(false);
    setEditingName(false);
    setEditingDesc(false);
    setNewFieldKey(null);
    pendingTagTimers.current.forEach((t) => clearTimeout(t));
    pendingTagTimers.current.clear();
    setPendingTags(new Set());
  }, [selectedGameId]);

  useEffect(() => {
    if (!showCollectionMenu) return;
    const handler = (e: MouseEvent) => {
      if (collectionMenuRef.current && !collectionMenuRef.current.contains(e.target as Node)) setShowCollectionMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showCollectionMenu]);

  useEffect(() => {
    if (lightboxIndex === null || !screenshots) return;
    const len = screenshots.length;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setLightboxIndex((i) => (i !== null ? (i - 1 + len) % len : null));
      else if (e.key === "ArrowRight") setLightboxIndex((i) => (i !== null ? (i + 1) % len : null));
      else if (e.key === "Escape") { e.stopPropagation(); setLightboxIndex(null); }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [lightboxIndex, screenshots]);

  useEffect(() => {
    if (!coverLightbox) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setCoverLightbox(false); } };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [coverLightbox]);

  useEffect(() => {
    const gameId = game?.id;
    if (!gameId) return;
    const promise = listen<string>("game-session-ended", async (event) => {
      if (event.payload === gameId) {
        const data = await api.getSessions(gameId).catch(() => null);
        if (data) setSessions((prev) => (prev === null ? prev : data));
      }
    });
    return () => { promise.then((f) => f()); };
  }, [game?.id]);

  useEffect(() => {
    return () => { pendingTagTimers.current.forEach((t) => clearTimeout(t)); };
  }, []);

  const coverUrl = useCover(game ?? PLACEHOLDER_GAME);

  if (!game) return null;

  const close = () => setDetailOpen(false);
  const running = activeGameId === game.id;
  const statusConfig = customStatuses.find((s) => s.key === game.status);

  const refreshGames = async () => {
    const allGames = await api.getAllGames();
    useGameStore.getState().setGames(allGames);
  };

  const handleChangeCover = async () => {
    const selected = await open({ filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "webp", "bmp", "gif"] }] });
    if (typeof selected === "string") {
      try {
        const newPath = await api.setGameCover(game.id, selected);
        if (game.cover_path) clearCoverCache(game.cover_path);
        const dataUri = await api.readImageBase64(newPath);
        setCoverCache(newPath, dataUri);
        await refreshGames();
        addToast("Cover image updated", "success");
      } catch (e) {
        addToast(String(e), "error");
      }
    }
  };

  const handlePlay = () => {
    launch(game, () => {
      setGameStarted(true);
      setTimeout(() => setGameStarted(false), 3000);
    });
  };

  const handleStop = () => {
    openConfirm(`Stop "${game.name}"?`, async () => {
      try { await api.stopGame(); useUIStore.getState().setActiveGameId(null); }
      catch (e) { addToast(String(e), "error"); }
    }, "Stop Game");
  };

  const loadSessions = async () => {
    if (loadingSessions) return;
    const forId = game.id;
    setLoadingSessions(true);
    const data = await api.getSessions(forId).catch(() => [] as Session[]);
    if (useGameStore.getState().selectedGameId !== forId) return;
    setSessions(data);
    setLoadingSessions(false);
  };

  const loadScreenshots = async () => {
    if (!game.steam_app_id || loadingShots) return;
    const forId = game.id;
    setLoadingShots(true);
    const shots = await api.getGameScreenshots(game.steam_app_id).catch(() => [] as string[]);
    if (useGameStore.getState().selectedGameId !== forId) return;
    setScreenshots(shots);
    setLoadingShots(false);
  };

  const handleDelete = () => {
    openConfirm(`Move "${game.name}" to the trash? You can restore it from Settings.`, () => {
      remove(game.id);
      close();
    }, "Move to Trash");
  };

  const saveName = () => {
    if (nameVal.trim() && nameVal.trim() !== game.name) update({ id: game.id, name: nameVal.trim() }, { onSuccess: flashSaved });
    setEditingName(false);
  };

  const saveDesc = () => {
    update({ id: game.id, description: descVal }, { onSuccess: flashSaved });
    setEditingDesc(false);
  };

  const addTag = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
      e.preventDefault();
      const t = tagInput.trim().replace(/,$/, "");
      if (t) gameActions.addTag(game.id, t);
      setTagInput("");
      flashSaved();
    }
  };

  const removeTag = (t: string) => {
    setPendingTags((prev) => new Set([...prev, t]));
    const timer = setTimeout(() => {
      gameActions.removeTag(game.id, t);
      setPendingTags((prev) => { const next = new Set(prev); next.delete(t); return next; });
      pendingTagTimers.current.delete(t);
    }, 4000);
    pendingTagTimers.current.set(t, timer);
  };

  const undoRemoveTag = (t: string) => {
    const timer = pendingTagTimers.current.get(t);
    if (timer) clearTimeout(timer);
    pendingTagTimers.current.delete(t);
    setPendingTags((prev) => { const next = new Set(prev); next.delete(t); return next; });
  };

  const doIgdbFetch = async () => {
    setIgdbFetching(true);
    try {
      const settings = await api.getSettings();
      if (!settings.igdb_client_id || !settings.igdb_client_secret) {
        addToast("Set IGDB credentials in Settings → Integrations", "error");
        return;
      }
      const data = await api.fetchIgdbMetadata(game.id, cleanTitle(game.name), settings.igdb_client_id, settings.igdb_client_secret);
      if (data) { await refreshGames(); addToast("IGDB metadata fetched", "success"); }
      else addToast("No IGDB data found", "info");
    } catch {
      addToast("Could not fetch IGDB metadata", "error");
    } finally {
      setIgdbFetching(false);
    }
  };

  const handleIgdbFetch = () => {
    if (game.igdb_skipped) {
      openConfirm("This game's IGDB data was removed before, so the search may return the wrong match again. Fetch anyway?", doIgdbFetch, "Fetch");
    } else {
      doIgdbFetch();
    }
  };

  const handleHltb = async () => {
    setHltbFetching(true);
    try {
      const data = await api.fetchHltbData(game.id, cleanTitle(game.name));
      if (data) {
        useGameStore.getState().updateGame({ ...game, hltb_main_mins: data.main_mins, hltb_extra_mins: data.extra_mins });
        addToast("HowLongToBeat data fetched", "success");
      } else addToast("No HowLongToBeat data found", "info");
    } catch {
      addToast("Could not fetch HowLongToBeat data", "error");
    } finally {
      setHltbFetching(false);
    }
  };

  const handleClearIgdb = () => {
    openConfirm(`Remove IGDB data for "${game.name}"? You'll be asked to confirm before any future IGDB fetch for this game.`, async () => {
      try { await api.clearIgdbData(game.id); await refreshGames(); addToast("IGDB data removed", "success"); }
      catch { addToast("Failed to remove IGDB data", "error"); }
    }, "Remove");
  };

  const toggleCollection = async (col: Collection) => {
    const inCollection = gameCollections.some((c) => c.id === col.id);
    try {
      if (inCollection) {
        await api.removeGameFromCollection(col.id, game.id);
        addToast(`Removed from "${col.name}"`, "success");
      } else {
        await api.addGameToCollection(col.id, game.id);
        addToast(`Added to "${col.name}"`, "success");
      }
      refetchGameCollections();
      qc.invalidateQueries({ queryKey: ["collections"] });
      qc.invalidateQueries({ queryKey: ["collection-games", col.id] });
    } catch (e) {
      addToast(String(e), "error");
    }
  };

  const commitNewField = () => {
    const key = newFieldKey?.trim();
    if (key && !(key in game.custom_fields)) update({ id: game.id, custom_fields: { ...game.custom_fields, [key]: "" } });
    setNewFieldKey(null);
  };

  const hltbMain = game.hltb_main_mins;
  const hltbPct = hltbMain ? Math.min(100, Math.round((game.playtime_mins / hltbMain) * 100)) : 0;

  const tabs = [
    { key: "info" as const, label: "Overview" },
    ...(game.steam_app_id ? [{ key: "screenshots" as const, label: screenshots !== null ? `Screenshots · ${screenshots.length}` : "Screenshots" }] : []),
    ...(game.install_dir ? [{ key: "mods" as const, label: "Mods" }] : []),
    { key: "history" as const, label: sessions !== null ? `History · ${sessions.length}` : "History" },
  ];

  return (
    <>
      {showCoverSearch && (
        <CoverSearchModal gameId={game.id} gameName={cleanTitle(game.name)} currentCoverPath={game.cover_path} onClose={() => setShowCoverSearch(false)} />
      )}
      <AnimatePresence>
        {coverLightbox && coverUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, pointerEvents: "none" }}
            onClick={() => setCoverLightbox(false)}
            className="fixed inset-0 z-[70] flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.9)", backdropFilter: "blur(20px)" }}
          >
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0, pointerEvents: "none" }}
              transition={{ type: "spring", stiffness: 350, damping: 28 }}
              src={coverUrl}
              alt={game.name}
              className="max-h-[85vh] max-w-[60vw] rounded-2xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {lightboxIndex !== null && screenshots && screenshots.length > 0 && (
          <ScreenshotLightbox shots={screenshots} index={lightboxIndex} setIndex={setLightboxIndex} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isOpen && (
            <motion.div
              key="detail-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, pointerEvents: "none" }}
              transition={{ duration: 0.2 }}
              onClick={close}
              className="fixed inset-0 z-30"
              style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
            />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isOpen && (
            <motion.div
              key="detail-panel"
              ref={panelRef}
              data-tour="game-detail"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%", pointerEvents: "none" }}
              transition={{ type: "spring", damping: 34, stiffness: 320 }}
              className="fixed right-0 top-0 bottom-0 w-[580px] max-w-[92vw] z-40 flex flex-col overflow-hidden"
              style={{
                background: "rgb(var(--bg-base) / 0.97)",
                borderLeft: "1px solid rgba(255,255,255,0.06)",
                boxShadow: "-30px 0 80px rgba(0,0,0,0.6)",
              }}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key !== "Tab") return;
                const sel = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
                const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(sel) ?? []).filter((el) => !el.hasAttribute("disabled"));
                if (!focusable.length) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
              }}
            >
              <div className="relative shrink-0 overflow-hidden">
                <div className="absolute inset-0">
                  <div className="absolute -inset-10 blur-[44px] opacity-70 saturate-150">
                    <GameCover game={game} eager />
                  </div>
                  <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgb(var(--bg-base) / 0.35) 0%, rgb(var(--bg-base) / 0.75) 60%, rgb(var(--bg-base)) 100%)" }} />
                </div>

                <div className="relative flex items-center justify-between px-5 pt-4">
                  <div className="flex items-center gap-2">
                    <PlatformBadge platform={game.platform} />
                    {game.not_installed && <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-black/30 border border-white/10 text-slate-300">Not installed</span>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <AnimatePresence>
                      {showSaved && (
                        <motion.span initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, pointerEvents: "none" }} className="flex items-center gap-1 text-[11px] text-emerald-300 font-medium mr-1">
                          <CheckIcon size={11} /> Saved
                        </motion.span>
                      )}
                    </AnimatePresence>
                    <button onClick={() => togglePinned(game.id)} className={cn("btn-icon w-8 h-8 !bg-black/25", game.is_pinned && "!text-accent-300")} title={game.is_pinned ? "Unpin" : "Pin to library"}>
                      <PinIcon size={13} filled={game.is_pinned} />
                    </button>
                    <button onClick={close} className="btn-icon w-8 h-8 !bg-black/25" title="Close (Esc)"><CloseIcon size={13} /></button>
                  </div>
                </div>

                <div className="relative flex gap-5 px-5 pt-4 pb-5">
                  <div className="relative w-[132px] shrink-0 group/cover">
                    <div className="aspect-[3/4] rounded-2xl overflow-hidden ring-1 ring-white/15 cursor-zoom-in" style={{ boxShadow: "0 24px 50px -16px rgba(0,0,0,0.95)" }} onClick={() => coverUrl && setCoverLightbox(true)}>
                      <GameCover game={game} eager />
                    </div>
                    <div className="absolute inset-x-1.5 bottom-1.5 flex gap-1 opacity-0 group-hover/cover:opacity-100 transition-opacity">
                      <button onClick={handleChangeCover} className="flex-1 flex items-center justify-center gap-1 h-7 rounded-lg bg-black/70 backdrop-blur text-[10.5px] font-medium text-white hover:bg-black/85" title="Choose an image file">
                        <ImageIcon size={11} /> File
                      </button>
                      <button onClick={() => setShowCoverSearch(true)} className="flex-1 flex items-center justify-center gap-1 h-7 rounded-lg bg-accent-600/80 backdrop-blur text-[10.5px] font-medium text-white hover:bg-accent-500" title="Search covers online">
                        <SearchIcon size={11} /> Search
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col">
                    {editingName ? (
                      <input
                        autoFocus
                        value={nameVal}
                        onChange={(e) => setNameVal(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") { e.stopPropagation(); setEditingName(false); } }}
                        onBlur={saveName}
                        className="input-glass text-[20px] font-bold h-11 py-0"
                      />
                    ) : (
                      <h2
                        className="text-[24px] font-bold text-white leading-tight cursor-text hover:text-accent-100 transition-colors line-clamp-2"
                        onClick={() => { setNameVal(game.name); setEditingName(true); }}
                        title="Click to rename"
                      >
                        {displayName(game.name)}
                      </h2>
                    )}
                    {displayName(game.name) !== game.name && (
                      <p className="text-[11px] text-slate-500 mt-1 truncate" title="Original title from the store or scan">{game.name}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[12px] text-slate-300/80">
                      {statusConfig && game.status !== "none" && (
                        <span className="flex items-center gap-1.5 font-medium" style={{ color: statusConfig.color }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusConfig.color }} />{statusConfig.label}
                        </span>
                      )}
                      {game.genre && <span>{game.genre}</span>}
                      {game.release_year && <span>{game.release_year}</span>}
                      {game.developer && <span className="truncate">{game.developer}</span>}
                    </div>

                    <div className="flex items-center gap-2 mt-auto pt-4">
                      {running ? (
                        <button onClick={handleStop} data-tour="play-btn" className="flex-1 h-11 rounded-xl flex items-center justify-center gap-2 text-[14px] font-semibold text-white bg-emerald-600/90 hover:bg-red-500/90 transition-colors group/stop">
                          <span className="relative flex h-2.5 w-2.5 group-hover/stop:hidden"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" /><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" /></span>
                          <StopIcon size={13} className="hidden group-hover/stop:block" />
                          <span className="group-hover/stop:hidden">Playing</span>
                          <span className="hidden group-hover/stop:inline">Stop</span>
                        </button>
                      ) : (
                        <button data-tour="play-btn" onClick={handlePlay} className={cn("btn-primary flex-1 h-11 justify-center text-[14px]", gameStarted && "!bg-emerald-600")}>
                          {gameStarted ? <><CheckIcon size={15} /> Launched</> : game.not_installed ? <><DownloadIcon size={15} /> Install</> : <><PlayIcon size={15} /> Play</>}
                        </button>
                      )}
                      <button
                        onClick={() => toggleFavorite(game.id)}
                        className={cn("btn-icon w-11 h-11", game.is_favorite && "!text-pink-400 !border-pink-500/30 !bg-pink-500/10")}
                        title={game.is_favorite ? "Remove from favorites (F)" : "Add to favorites (F)"}
                      >
                        <HeartIcon size={16} filled={game.is_favorite} />
                      </button>
                      <div className="relative" ref={collectionMenuRef}>
                        <button
                          onClick={() => setShowCollectionMenu((v) => !v)}
                          className={cn("btn-icon w-11 h-11", (showCollectionMenu || gameCollections.length > 0) && "!text-accent-300 !border-accent-500/30")}
                          title="Collections"
                        >
                          <CollectionIcon size={16} />
                        </button>
                        <AnimatePresence>
                          {showCollectionMenu && (
                            <motion.div
                              initial={{ opacity: 0, y: -6, scale: 0.97 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -6, scale: 0.97, pointerEvents: "none" }}
                              transition={{ duration: 0.14 }}
                              className="absolute top-full mt-2 right-0 min-w-[210px] glass-strong rounded-2xl shadow-2xl z-50 overflow-hidden p-1.5"
                            >
                              <p className="section-label !text-[10px] px-2.5 pt-1.5 pb-1">Collections</p>
                              {allCollections.length === 0 ? (
                                <p className="text-[12px] text-slate-500 px-2.5 pb-2">No collections yet — create one on the Collections page.</p>
                              ) : (
                                allCollections.map((col) => {
                                  const active = gameCollections.some((c) => c.id === col.id);
                                  return (
                                    <button key={col.id} onClick={() => toggleCollection(col)} className={cn("w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12.5px] text-left transition-colors hover:bg-white/[0.06]", active ? "text-white" : "text-slate-300")}>
                                      <span className={cn("w-4 h-4 rounded-md flex items-center justify-center border", active ? "bg-accent-500 border-accent-400" : "border-white/20")}>
                                        {active && <CheckIcon size={10} className="text-white" />}
                                      </span>
                                      <span className="flex-1 truncate">{col.name}</span>
                                    </button>
                                  );
                                })
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      <button onClick={() => api.openGameFolder(game.id).catch((e) => addToast(String(e), "error"))} className="btn-icon w-11 h-11" title="Open game folder">
                        <FolderIcon size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="relative flex items-center gap-1 px-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  {tabs.map((tab) => (
                    <button
                      key={tab.key}
                      data-tour={`detail-tab-${tab.key}`}
                      onClick={() => {
                        setActiveTab(tab.key);
                        if (tab.key === "screenshots" && screenshots === null) loadScreenshots();
                        if (tab.key === "history" && sessions === null) loadSessions();
                      }}
                      className={cn("relative px-3.5 py-3 text-[12.5px] font-medium transition-colors", activeTab === tab.key ? "text-white" : "text-slate-500 hover:text-slate-300")}
                    >
                      {tab.label}
                      <span className={cn("absolute left-2 right-2 -bottom-px h-[2px] rounded-full bg-accent-400 transition-all duration-200", activeTab === tab.key ? "opacity-100 scale-x-100" : "opacity-0 scale-x-50")} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {activeTab === "screenshots" && (
                  <div className="p-5">
                    {loadingShots && <div className="flex justify-center py-16"><div className="w-5 h-5 rounded-full border-2 border-accent-500/30 border-t-accent-500 animate-spin" /></div>}
                    {!loadingShots && screenshots !== null && screenshots.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <ImageIcon size={30} className="text-slate-600 mb-3" />
                        <p className="text-[13.5px] text-slate-300">No screenshots found</p>
                        <p className="text-[12px] text-slate-500 mt-1">Press F12 in-game to take Steam screenshots</p>
                      </div>
                    )}
                    {!loadingShots && screenshots && screenshots.length > 0 && (
                      <>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[12px] text-slate-400">{screenshots.length} screenshot{screenshots.length !== 1 ? "s" : ""}</p>
                          <button onClick={() => api.openUrl(screenshots[0].replace(/[\\/][^\\/]+$/, "")).catch(() => {})} className="btn-ghost text-[11.5px] py-1.5 px-3">
                            <FolderIcon size={12} /> Open Folder
                          </button>
                        </div>
                        <div className="columns-2 gap-2">
                          {screenshots.map((path, i) => <ScreenshotThumb key={path} path={path} onOpen={() => setLightboxIndex(i)} />)}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {activeTab === "mods" && game.install_dir && (
                  <div className="p-5"><ModLoaderPanel installDir={game.install_dir} exePath={game.exe_path} /></div>
                )}

                {activeTab === "history" && (
                  <div className="p-5"><HistoryTab sessions={sessions} loading={loadingSessions} /></div>
                )}

                {activeTab === "info" && (
                  <div className="flex flex-col gap-6 p-5">
                    <div className="grid grid-cols-3 gap-2.5">
                      {[
                        { icon: <ClockIcon size={12} />, label: "Playtime", value: game.playtime_mins > 0 ? formatPlaytime(game.playtime_mins) : "—" },
                        { icon: <PlayIcon size={11} />, label: "Last played", value: game.last_played ? timeAgo(game.last_played) : "Never" },
                        { icon: <PlusIcon size={12} />, label: "Added", value: formatDate(game.date_added) },
                      ].map((s) => (
                        <div key={s.label} className="surface px-3.5 py-3">
                          <p className="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase tracking-[0.12em] font-semibold">{s.icon}{s.label}</p>
                          <p className="text-[14.5px] font-semibold text-white mt-1 truncate">{s.value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="surface p-4">
                      <div className="flex items-center gap-2">
                        <ClockIcon size={13} className="text-slate-500" />
                        <span className="section-label">How Long To Beat</span>
                        <div className="flex-1" />
                        <button
                          data-tour="hltb-btn"
                          onClick={handleHltb}
                          disabled={hltbFetching}
                          className="text-[11.5px] text-accent-300 hover:text-accent-200 disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {hltbFetching && <span className="w-3 h-3 rounded-full border-2 border-accent-500/30 border-t-accent-400 animate-spin" />}
                          {hltbMain ? "Refresh" : "Fetch estimate"}
                        </button>
                      </div>
                      {hltbMain ? (
                        <div className="mt-3">
                          <div className="flex items-baseline justify-between text-[12px]">
                            <span className="text-slate-300">
                              Main story <span className="text-white font-semibold">{Math.round((hltbMain / 60) * 10) / 10}h</span>
                              {game.hltb_extra_mins && <span className="text-slate-500"> · Main + extras {Math.round((game.hltb_extra_mins / 60) * 10) / 10}h</span>}
                            </span>
                            <span className={cn("font-semibold tabular-nums", hltbPct >= 100 ? "text-emerald-300" : "text-accent-200")}>{hltbPct}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden mt-2">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${hltbPct}%` }}
                              transition={{ duration: 0.8, ease: "easeOut" }}
                              className="h-full rounded-full"
                              style={{ background: hltbPct >= 100 ? "linear-gradient(90deg, #10b981, #34d399)" : "linear-gradient(90deg, rgb(var(--accent-600)), rgb(var(--accent-400)))" }}
                            />
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1.5">
                            {hltbPct >= 100 ? "You've put in more time than the average main story run." : `About ${formatPlaytime(Math.max(0, hltbMain - game.playtime_mins))} left for the main story.`}
                          </p>
                        </div>
                      ) : (
                        <p className="text-[12px] text-slate-500 mt-2">See how long this game takes to beat and track your progress against it.</p>
                      )}
                    </div>

                    <div>
                      <SectionTitle icon={<StarIcon size={12} />}>Your Rating</SectionTitle>
                      <StarRating value={game.rating} onChange={(v) => update({ id: game.id, rating: v }, { onSuccess: flashSaved })} size="md" />
                    </div>

                    <div>
                      <SectionTitle>Status</SectionTitle>
                      <div className="flex flex-wrap gap-1.5">
                        {[{ key: "none", label: "None", color: "#64748b" }, ...customStatuses].map((s) => {
                          const active = game.status === s.key;
                          return (
                            <button
                              key={s.key}
                              onClick={() => update({ id: game.id, status: s.key as GameStatus }, { onSuccess: flashSaved })}
                              className={cn("chip", active && "!text-white")}
                              style={active ? { background: `${s.color}26`, borderColor: `${s.color}80` } : undefined}
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                              {s.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <SectionTitle icon={<TagIcon size={12} />}>Tags</SectionTitle>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <AnimatePresence>
                          {game.tags.map((t) => {
                            const pending = pendingTags.has(t);
                            return (
                              <motion.button
                                key={t}
                                layout
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: pending ? 0.5 : 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8, pointerEvents: "none" }}
                                onClick={() => (pending ? undoRemoveTag(t) : removeTag(t))}
                                className={cn("chip group !py-1", pending && "line-through")}
                                title={pending ? "Click to undo" : "Click to remove"}
                              >
                                #{t}
                                <span className={cn("text-[10px]", pending ? "text-accent-300 no-underline" : "text-slate-600 group-hover:text-red-400")}>{pending ? "undo" : "✕"}</span>
                              </motion.button>
                            );
                          })}
                        </AnimatePresence>
                        <input
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyDown={addTag}
                          placeholder={game.tags.length ? "Add tag…" : "Add a tag and press Enter…"}
                          className="flex-1 min-w-[140px] bg-transparent text-[12.5px] text-slate-200 placeholder-slate-600 outline-none px-2 py-1.5 rounded-lg focus:bg-white/[0.04]"
                        />
                      </div>
                    </div>

                    <div>
                      <SectionTitle
                        icon={<SparkleIcon size={12} />}
                        action={
                          <button data-tour="igdb-btn" onClick={handleIgdbFetch} disabled={igdbFetching} className="text-[11.5px] text-accent-300 hover:text-accent-200 disabled:opacity-50 flex items-center gap-1.5">
                            {igdbFetching && <span className="w-3 h-3 rounded-full border-2 border-accent-500/30 border-t-accent-400 animate-spin" />}
                            {game.genre || game.developer ? "Refresh from IGDB" : "Fetch from IGDB"}
                          </button>
                        }
                      >
                        About
                      </SectionTitle>
                      {editingDesc ? (
                        <div className="flex flex-col gap-2">
                          <textarea autoFocus value={descVal} onChange={(e) => setDescVal(e.target.value)} rows={5} className="input-glass resize-none text-[13px] leading-relaxed" />
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => setEditingDesc(false)} className="btn-ghost text-[12px] py-1.5">Cancel</button>
                            <button onClick={saveDesc} className="btn-primary text-[12px] py-1.5">Save</button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p
                            onClick={() => { setDescVal(game.description ?? ""); setEditingDesc(true); }}
                            className={cn("text-[13px] cursor-text leading-relaxed rounded-xl px-4 py-3 transition-colors hover:bg-white/[0.03] -mx-1 whitespace-pre-line", game.description ? "text-slate-300" : "text-slate-500 italic")}
                          >
                            {game.description
                              ? !descExpanded && game.description.length > 280 ? game.description.slice(0, 280) + "…" : game.description
                              : "Click to add a description…"}
                          </p>
                          {game.description && game.description.length > 280 && (
                            <button onClick={() => setDescExpanded((v) => !v)} className="text-[11.5px] text-accent-300 hover:text-accent-200 px-3">{descExpanded ? "Show less" : "Show more"}</button>
                          )}
                        </div>
                      )}
                      {(game.genre || game.developer || game.publisher || game.release_year) && (
                        <div className="mt-3"><IgdbMetadataCard game={game} onClear={handleClearIgdb} /></div>
                      )}
                    </div>

                    <div>
                      <SectionTitle action={newFieldKey === null ? <button onClick={() => setNewFieldKey("")} className="text-[11.5px] text-accent-300 hover:text-accent-200">+ Add field</button> : undefined}>
                        Custom Fields
                      </SectionTitle>
                      <div className="flex flex-col gap-1.5">
                        {Object.entries(game.custom_fields).map(([key, val]) => (
                          <div key={key} className="flex items-center gap-2 group/field">
                            <span className="text-[12px] text-slate-400 w-28 shrink-0 truncate" title={key}>{key}</span>
                            <input
                              defaultValue={val}
                              onBlur={(e) => { if (e.target.value !== val) update({ id: game.id, custom_fields: { ...game.custom_fields, [key]: e.target.value } }, { onSuccess: flashSaved }); }}
                              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                              placeholder="Value…"
                              className="input-glass text-[12px] h-8 py-0 flex-1"
                            />
                            <button
                              onClick={() => { const next = { ...game.custom_fields }; delete next[key]; update({ id: game.id, custom_fields: next }); }}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover/field:opacity-100 transition-all shrink-0"
                              title="Remove field"
                            >
                              <TrashIcon size={12} />
                            </button>
                          </div>
                        ))}
                        {newFieldKey !== null && (
                          <div className="flex items-center gap-2">
                            <input
                              autoFocus
                              value={newFieldKey}
                              onChange={(e) => setNewFieldKey(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") commitNewField(); if (e.key === "Escape") { e.stopPropagation(); setNewFieldKey(null); } }}
                              placeholder="Field name, e.g. Save location"
                              className="input-glass text-[12px] h-8 py-0 flex-1"
                            />
                            <button onClick={commitNewField} disabled={!newFieldKey.trim()} className="btn-primary h-8 py-0 text-[12px]">Add</button>
                            <button onClick={() => setNewFieldKey(null)} className="btn-icon w-8 h-8"><CloseIcon size={11} /></button>
                          </div>
                        )}
                        {Object.keys(game.custom_fields).length === 0 && newFieldKey === null && (
                          <p className="text-[12px] text-slate-600">Track anything — save locations, mods, completion %, keys…</p>
                        )}
                      </div>
                    </div>

                    <GameNotes gameId={game.id} />

                    {(game.steam_app_id || game.epic_app_name || game.ubisoft_game_id || game.install_dir || game.exe_path) && (
                      <div className="surface p-4 space-y-2">
                        <p className="section-label !text-[10px] mb-1">Technical</p>
                        {[
                          { label: "Platform", value: PLATFORM_LABELS[game.platform] },
                          { label: "Steam App ID", value: game.steam_app_id },
                          { label: "Epic App", value: game.epic_app_name },
                          { label: "Ubisoft ID", value: game.ubisoft_game_id },
                          { label: "Install folder", value: game.install_dir, mono: true },
                          { label: "Executable", value: game.exe_path, mono: true },
                        ].filter((r) => r.value).map((r) => (
                          <div key={r.label} className="flex gap-3 text-[12px] group/row">
                            <span className="text-slate-500 w-28 shrink-0">{r.label}</span>
                            <span className={cn("text-slate-300 truncate flex-1", r.mono && "font-mono text-[11px]")} title={r.value ?? undefined}>{r.value}</span>
                            <button
                              onClick={async () => { await navigator.clipboard.writeText(r.value ?? ""); addToast("Copied", "success"); }}
                              className="text-slate-600 hover:text-slate-200 opacity-0 group-hover/row:opacity-100 transition-opacity"
                              title="Copy"
                            >
                              <CopyIcon size={11} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <button onClick={handleDelete} className="flex items-center justify-center gap-2 h-10 rounded-xl text-[12.5px] font-medium text-red-400/80 hover:text-red-300 hover:bg-red-500/10 border border-red-500/10 hover:border-red-500/25 transition-colors">
                      <TrashIcon size={13} /> Move to Trash
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
