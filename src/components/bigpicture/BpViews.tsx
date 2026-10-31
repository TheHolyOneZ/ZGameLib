import { memo, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/tauri";
import { cn, formatPlaytime, timeAgo, PLATFORM_LABELS } from "@/lib/utils";
import type { Collection, Game } from "@/lib/types";
import GameCover from "@/components/ui/GameCover";
import { HeartIcon, PlayIcon, CollectionIcon, LibraryIcon, ClockIcon, StarIcon } from "@/components/ui/Icons";

export type BpTab = "home" | "library" | "favorites" | "recent" | "collections";
export type LibraryFilter = "all" | "installed" | "playing" | "backlog" | "completed" | "unplayed";
export type LibrarySort = "name" | "recent" | "playtime" | "rating";

export const BP_TABS: { key: BpTab; label: string }[] = [
  { key: "home", label: "Home" },
  { key: "library", label: "Library" },
  { key: "favorites", label: "Favorites" },
  { key: "recent", label: "Recent" },
  { key: "collections", label: "Collections" },
];

export const FILTERS: { key: LibraryFilter; label: string }[] = [
  { key: "all", label: "All Games" },
  { key: "installed", label: "Installed" },
  { key: "playing", label: "Playing" },
  { key: "backlog", label: "Backlog" },
  { key: "completed", label: "Completed" },
  { key: "unplayed", label: "Never Played" },
];

export const SORTS: { key: LibrarySort; label: string }[] = [
  { key: "name", label: "A – Z" },
  { key: "recent", label: "Recently Played" },
  { key: "playtime", label: "Most Played" },
  { key: "rating", label: "Top Rated" },
];

export function applyLibraryView(games: Game[], filter: LibraryFilter, sort: LibrarySort, query: string) {
  let list = games;
  const q = query.trim().toLowerCase();
  if (q) list = list.filter((g) => g.name.toLowerCase().includes(q) || (g.genre?.toLowerCase().includes(q) ?? false) || g.tags.some((t) => t.includes(q)));
  if (filter === "installed") list = list.filter((g) => !g.not_installed);
  else if (filter === "unplayed") list = list.filter((g) => g.playtime_mins === 0);
  else if (filter !== "all") list = list.filter((g) => g.status === filter);
  const sorted = [...list];
  if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  else if (sort === "recent") sorted.sort((a, b) => (b.last_played ?? "").localeCompare(a.last_played ?? "") || a.name.localeCompare(b.name));
  else if (sort === "playtime") sorted.sort((a, b) => b.playtime_mins - a.playtime_mins || a.name.localeCompare(b.name));
  else sorted.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || a.name.localeCompare(b.name));
  return sorted;
}

const BpCardInner = ({ game, size = "md", running, onSelect, autofocus }: { game: Game; size?: "md" | "lg"; running?: boolean; onSelect: (g: Game) => void; autofocus?: boolean }) => (
  <button
    tabIndex={-1}
    data-bp-focusable
    data-bp-game-id={game.id}
    data-bp-autofocus={autofocus || undefined}
    onClick={() => onSelect(game)}
    className="bp-focusable bp-card group relative shrink-0 rounded-[18px] text-left"
    style={{ width: size === "lg" ? "var(--bp-card-lg)" : "var(--bp-card)", scrollMargin: "140px 120px" }}
  >
    <div className="bp-ring relative aspect-[3/4] rounded-[18px] overflow-hidden ring-1 ring-white/10 shadow-[0_18px_40px_-14px_rgba(0,0,0,0.8)]">
      <GameCover game={game} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-data-[bp-active=true]:opacity-100 transition-opacity" />
      {running && (
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/90 text-[11px] font-bold text-white">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          RUNNING
        </div>
      )}
      {game.is_favorite && (
        <div className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/55 backdrop-blur flex items-center justify-center">
          <HeartIcon size={13} filled className="text-pink-400" />
        </div>
      )}
      {game.not_installed && (
        <div className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/70 text-[10px] font-semibold text-slate-300 tracking-wide">NOT INSTALLED</div>
      )}
    </div>
    <p className="mt-2.5 px-1 text-[15px] font-semibold text-white/60 truncate group-data-[bp-active=true]:text-white transition-colors">{game.name}</p>
  </button>
);

export const BpCard = memo(BpCardInner);

export function Shelf({ title, icon, games, size, runningId, onSelect, extra, first }: {
  title: string;
  icon?: React.ReactNode;
  games: Game[];
  size?: "md" | "lg";
  runningId: string | null;
  onSelect: (g: Game) => void;
  extra?: React.ReactNode;
  first?: boolean;
}) {
  if (games.length === 0 && !extra) return null;
  return (
    <section className="mb-2">
      <h2 className="flex items-center gap-3 px-[5vw] text-[22px] font-semibold text-white/90 tracking-tight">
        {icon && <span className="text-accent-300">{icon}</span>}
        {title}
        <span className="text-[15px] font-medium text-white/35">{games.length}</span>
      </h2>
      <div data-bp-row className="flex gap-6 overflow-x-auto scrollbar-none px-[5vw] pt-5 pb-8">
        {games.map((g, i) => (
          <BpCard key={g.id} game={g} size={size} running={runningId === g.id} onSelect={onSelect} autofocus={first && i === 0} />
        ))}
        {extra}
      </div>
    </section>
  );
}

export function ViewAllTile({ label, count, onClick }: { label: string; count: number; onClick: () => void }) {
  return (
    <button
      tabIndex={-1}
      data-bp-focusable
      onClick={onClick}
      className="bp-focusable bp-ring bp-card shrink-0 rounded-[18px] flex flex-col items-center justify-center gap-3 text-white/80 relative"
      style={{ width: "var(--bp-card)", aspectRatio: "3 / 4", background: "linear-gradient(160deg, rgb(var(--accent-500) / 0.25), rgba(255,255,255,0.04))", border: "1px solid rgba(255,255,255,0.12)", scrollMargin: "140px 120px" }}
    >
      <LibraryIcon size={34} className="text-accent-200" />
      <span className="text-[16px] font-semibold">{label}</span>
      <span className="text-[13px] text-white/50">{count} games</span>
    </button>
  );
}

export function HeroInfo({ game, running, label }: { game: Game | null; running: boolean; label: string }) {
  if (!game) return null;
  return (
    <motion.div
      key={game.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="px-[5vw] pt-[4vh] pb-[3vh] max-w-[70vw]"
    >
      <div className="flex items-center gap-3 mb-3">
        {running ? (
          <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[13px] font-bold tracking-wide">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> NOW PLAYING
          </span>
        ) : (
          <span className="text-[13px] font-bold tracking-[0.2em] text-accent-200/80 uppercase">{label}</span>
        )}
      </div>
      <h1 className="text-[clamp(34px,4.2vw,72px)] font-bold leading-[1.02] text-white drop-shadow-[0_4px_30px_rgba(0,0,0,0.6)] line-clamp-2">{game.name}</h1>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-4 text-[16px] text-white/70">
        <span>{PLATFORM_LABELS[game.platform]}</span>
        <span className="flex items-center gap-2"><ClockIcon size={16} className="text-white/50" />{game.playtime_mins > 0 ? formatPlaytime(game.playtime_mins) : "Never played"}</span>
        {game.last_played && <span>Last played {timeAgo(game.last_played)}</span>}
        {game.rating !== null && <span className="flex items-center gap-1.5"><StarIcon size={15} filled className="text-amber-300" />{game.rating}/10</span>}
        {game.genre && <span className="text-white/50">{game.genre}</span>}
      </div>
    </motion.div>
  );
}

export function HomeView({ games, runningId, focusedGame, onSelect, onOpenTab }: {
  games: Game[];
  runningId: string | null;
  focusedGame: Game | null;
  onSelect: (g: Game) => void;
  onOpenTab: (t: BpTab) => void;
}) {
  const shelves = useMemo(() => {
    const recent = games.filter((g) => g.last_played).sort((a, b) => (b.last_played ?? "").localeCompare(a.last_played ?? "")).slice(0, 14);
    const running = runningId ? games.find((g) => g.id === runningId) : undefined;
    const continuePlaying = running ? [running, ...recent.filter((g) => g.id !== running.id)] : recent;
    const favorites = games.filter((g) => g.is_favorite).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 20);
    const playNext = games
      .filter((g) => (g.status === "backlog" || g.status === "playing" || g.status === "none") && !g.not_installed && g.playtime_mins < 120 && !recent.some((r) => r.id === g.id))
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.date_added ?? "").localeCompare(a.date_added ?? ""))
      .slice(0, 16);
    const added = [...games].sort((a, b) => (b.date_added ?? "").localeCompare(a.date_added ?? "")).slice(0, 16);
    return { continuePlaying, favorites, playNext, added };
  }, [games, runningId]);

  const hero = focusedGame ?? shelves.continuePlaying[0] ?? shelves.added[0] ?? null;
  const heroLabel = focusedGame ? (focusedGame.last_played ? "Continue Playing" : "From Your Library") : "Welcome Back";
  const firstShelf = shelves.continuePlaying.length ? "continue" : shelves.favorites.length ? "fav" : "added";

  if (games.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-10">
        <LibraryIcon size={64} className="text-accent-300" />
        <h1 className="text-5xl font-bold">Your library is empty</h1>
        <p className="text-xl text-white/60 max-w-xl">Open the menu to scan for installed games from Steam, Epic, GOG and Ubisoft Connect.</p>
      </div>
    );
  }

  return (
    <div className="pb-10">
      <HeroInfo game={hero} running={!!hero && hero.id === runningId} label={heroLabel} />
      <Shelf first={firstShelf === "continue"} title={runningId ? "Jump Back In" : "Continue Playing"} icon={<PlayIcon size={18} />} games={shelves.continuePlaying} size="lg" runningId={runningId} onSelect={onSelect} />
      <Shelf first={firstShelf === "fav"} title="Favorites" icon={<HeartIcon size={18} filled />} games={shelves.favorites} runningId={runningId} onSelect={onSelect}
        extra={games.filter((g) => g.is_favorite).length > 20 ? <ViewAllTile label="All Favorites" count={games.filter((g) => g.is_favorite).length} onClick={() => onOpenTab("favorites")} /> : undefined} />
      <Shelf title="Up Next" icon={<StarIcon size={18} />} games={shelves.playNext} runningId={runningId} onSelect={onSelect} />
      <Shelf first={firstShelf === "added"} title="Recently Added" icon={<LibraryIcon size={18} />} games={shelves.added} runningId={runningId} onSelect={onSelect}
        extra={<ViewAllTile label="Browse Library" count={games.length} onClick={() => onOpenTab("library")} />} />
    </div>
  );
}

const PAGE = 240;

export function GridView({ title, games, runningId, onSelect, chips, empty }: {
  title: string;
  games: Game[];
  runningId: string | null;
  onSelect: (g: Game) => void;
  chips?: React.ReactNode;
  empty: string;
}) {
  const [limit, setLimit] = useState(PAGE);
  const shown = games.slice(0, limit);
  return (
    <div className="pb-16">
      <div className="px-[5vw] pt-[4vh] flex items-end gap-6 flex-wrap">
        <h1 className="text-[clamp(30px,3vw,52px)] font-bold text-white leading-none">{title}</h1>
        <span className="text-[18px] text-white/40 pb-1">{games.length} {games.length === 1 ? "game" : "games"}</span>
      </div>
      {chips && <div data-bp-row className="flex flex-wrap gap-3 px-[5vw] pt-6">{chips}</div>}
      {games.length === 0 ? (
        <div className="px-[5vw] pt-24 text-center text-[22px] text-white/50">{empty}</div>
      ) : (
        <div className="grid gap-x-7 gap-y-4 px-[5vw] pt-8" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(var(--bp-card), 1fr))" }}>
          {shown.map((g, i) => (
            <BpCard key={g.id} game={g} running={runningId === g.id} onSelect={onSelect} autofocus={!chips && i === 0} />
          ))}
          {games.length > limit && (
            <button
              tabIndex={-1}
              data-bp-focusable
              onClick={() => setLimit((l) => l + PAGE)}
              className="bp-focusable bp-ring bp-card relative rounded-[18px] flex flex-col items-center justify-center gap-2 text-white/80 aspect-[3/4]"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px dashed rgba(255,255,255,0.2)" }}
            >
              <span className="text-[18px] font-semibold">Show more</span>
              <span className="text-[14px] text-white/50">{games.length - limit} remaining</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function Chip({ label, active, onClick, autofocus }: { label: string; active: boolean; onClick: () => void; autofocus?: boolean }) {
  return (
    <button
      tabIndex={-1}
      data-bp-focusable
      data-bp-autofocus={autofocus || undefined}
      onClick={onClick}
      className={cn(
        "bp-focusable bp-btn relative px-5 h-11 rounded-full text-[16px] font-semibold transition-colors",
        active ? "bg-white text-black" : "bg-white/[0.08] text-white/75 border border-white/10"
      )}
    >
      {label}
    </button>
  );
}

function CollectionTile({ col, games, onOpen, autofocus }: { col: Collection; games: Game[]; onOpen: () => void; autofocus?: boolean }) {
  const { data: ids = [] } = useQuery({
    queryKey: ["collection-games", col.id],
    queryFn: () => api.getCollectionGames(col.id),
    select: (list) => list.map((g) => g.id),
  });
  const covers = ids.map((id) => games.find((g) => g.id === id)).filter((g): g is Game => !!g).slice(0, 3);
  return (
    <button
      tabIndex={-1}
      data-bp-focusable
      data-bp-autofocus={autofocus || undefined}
      onClick={onOpen}
      className="bp-focusable bp-ring bp-card relative rounded-[22px] overflow-hidden text-left aspect-[16/10]"
      style={{ background: "linear-gradient(150deg, rgb(var(--accent-600) / 0.35), rgba(255,255,255,0.04))", border: "1px solid rgba(255,255,255,0.1)", scrollMargin: "140px" }}
    >
      <div className="absolute inset-0 flex justify-end items-end gap-0 pr-4 pb-4 pointer-events-none">
        {covers.map((g, i) => (
          <div key={g.id} className="w-[30%] aspect-[3/4] rounded-xl overflow-hidden ring-1 ring-black/40 shadow-2xl" style={{ transform: `translateX(${(covers.length - 1 - i) * 22}%) rotate(${(i - 1) * 6}deg)`, zIndex: i }}>
            <GameCover game={g} />
          </div>
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/20 to-transparent" />
      <div className="relative p-6 flex flex-col h-full">
        <CollectionIcon size={28} className="text-accent-200" />
        <div className="mt-auto">
          <p className="text-[24px] font-bold text-white leading-tight line-clamp-2 max-w-[60%]">{col.name}</p>
          <p className="text-[15px] text-white/60 mt-1">{col.game_count} games</p>
        </div>
      </div>
    </button>
  );
}

export function CollectionsView({ games, runningId, onSelect, openCollection, setOpenCollection }: {
  games: Game[];
  runningId: string | null;
  onSelect: (g: Game) => void;
  openCollection: Collection | null;
  setOpenCollection: (c: Collection | null) => void;
}) {
  const { data: collections = [] } = useQuery({ queryKey: ["collections"], queryFn: () => api.getCollections() });
  const { data: colGames = [] } = useQuery({
    queryKey: ["collection-games", openCollection?.id],
    queryFn: () => api.getCollectionGames(openCollection!.id),
    enabled: !!openCollection,
  });

  if (openCollection) {
    const list = colGames.map((cg) => games.find((g) => g.id === cg.id) ?? cg).sort((a, b) => a.name.localeCompare(b.name));
    return <GridView title={openCollection.name} games={list} runningId={runningId} onSelect={onSelect} empty="This collection is empty." />;
  }

  return (
    <div className="pb-16">
      <div className="px-[5vw] pt-[4vh] flex items-end gap-6">
        <h1 className="text-[clamp(30px,3vw,52px)] font-bold text-white leading-none">Collections</h1>
        <span className="text-[18px] text-white/40 pb-1">{collections.length}</span>
      </div>
      {collections.length === 0 ? (
        <div className="px-[5vw] pt-24 text-center text-[22px] text-white/50">No collections yet. Create them on the desktop to group your games.</div>
      ) : (
        <div className="grid gap-8 px-[5vw] pt-8" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(clamp(300px, 24vw, 460px), 1fr))" }}>
          {collections.map((c, i) => (
            <CollectionTile key={c.id} col={c} games={games} onOpen={() => setOpenCollection(c)} autofocus={i === 0} />
          ))}
        </div>
      )}
    </div>
  );
}
