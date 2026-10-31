import { displayName } from "@/lib/gameName";
import { useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { useGameStore } from "@/store/useGameStore";
import { useUIStore } from "@/store/useUIStore";
import { useLaunchGame } from "@/lib/useLaunchGame";
import GameCard from "@/components/library/GameCard";
import GameCover from "@/components/ui/GameCover";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import ScrollToTop from "@/components/ui/ScrollToTop";
import { timeAgo, formatPlaytime, PLATFORM_LABELS } from "@/lib/utils";
import { ClockIcon, PlayIcon, SearchIcon, CloseIcon } from "@/components/ui/Icons";
import type { Game } from "@/lib/types";
import { useState } from "react";

function bucketOf(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t = d.getTime();
  if (t >= startOfDay) return "Today";
  if (t >= startOfDay - 86400000) return "Yesterday";
  if (t >= startOfDay - 6 * 86400000) return "This Week";
  if (t >= startOfDay - 29 * 86400000) return "This Month";
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString(undefined, { month: "long" });
  return String(d.getFullYear());
}

function FeaturedRecent({ game }: { game: Game }) {
  const setSelectedGameId = useGameStore((s) => s.setSelectedGameId);
  const setDetailOpen = useUIStore((s) => s.setDetailOpen);
  const { launch } = useLaunchGame();
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => { setSelectedGameId(game.id); setDetailOpen(true); }}
      className="group relative flex items-center gap-4 p-3 rounded-2xl cursor-pointer overflow-hidden surface-interactive"
    >
      <div className="w-14 h-[74px] rounded-xl overflow-hidden shrink-0 ring-1 ring-white/10">
        <GameCover game={game} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-white truncate">{displayName(game.name)}</p>
        <p className="text-[12px] text-slate-400 mt-0.5">{timeAgo(game.last_played)} · {formatPlaytime(game.playtime_mins)}</p>
        <p className="text-[11px] text-slate-500 mt-0.5">{PLATFORM_LABELS[game.platform]}</p>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); launch(game); }}
        className="w-10 h-10 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        style={{ background: "linear-gradient(180deg, rgb(var(--accent-400)), rgb(var(--accent-600)))" }}
        title="Play"
      >
        <PlayIcon size={15} className="ml-0.5" />
      </button>
    </motion.div>
  );
}

export default function RecentlyPlayedPage() {
  const games = useGameStore((s) => s.games);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");

  const recent = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...games]
      .filter((g) => g.last_played && (!q || g.name.toLowerCase().includes(q)))
      .sort((a, b) => (b.last_played! > a.last_played! ? 1 : -1));
  }, [games, query]);

  const groups = useMemo(() => {
    const out: { label: string; games: Game[] }[] = [];
    for (const g of recent) {
      const label = bucketOf(g.last_played!);
      const last = out[out.length - 1];
      if (last && last.label === label) last.games.push(g);
      else out.push({ label, games: [g] });
    }
    return out;
  }, [recent]);

  const weekCount = useMemo(() => {
    const cutoff = Date.now() - 7 * 86400000;
    return recent.filter((g) => new Date(g.last_played!).getTime() >= cutoff).length;
  }, [recent]);

  return (
    <div className="h-full flex flex-col page-enter">
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto pb-10">
        <PageHeader
          icon={<ClockIcon size={22} />}
          title="Recently Played"
          subtitle={recent.length ? `${weekCount} game${weekCount !== 1 ? "s" : ""} played in the last 7 days` : "Games you launch from ZGameLib show up here"}
          actions={
            <div className="relative w-[240px] group">
              <SearchIcon size={14} className="absolute left-3.5 inset-y-0 my-auto text-slate-500 pointer-events-none group-focus-within:text-accent-300" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter history…" className="input-glass h-9 py-0 pl-9 pr-8 text-[13px]" />
              {query && (
                <button onClick={() => setQuery("")} className="absolute right-2 inset-y-0 my-auto w-5 h-5 flex items-center justify-center rounded-md text-slate-400 hover:text-white"><CloseIcon size={11} /></button>
              )}
            </div>
          }
        />

        {recent.length === 0 ? (
          <EmptyState
            icon={<ClockIcon size={34} />}
            title={query ? "Nothing matches that" : "No play history yet"}
            description={query ? `No recently played game matches "${query}".` : "Launch a game from your library and it will appear here with when you last played it."}
          />
        ) : (
          <>
            {!query && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 px-8 pt-5">
                {recent.slice(0, 3).map((g) => <FeaturedRecent key={g.id} game={g} />)}
              </div>
            )}
            {groups.map((group) => (
              <section key={group.label} className="px-8 pt-8">
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-[15px] font-semibold text-white">{group.label}</h2>
                  <span className="text-[12px] text-slate-500">{group.games.length}</span>
                  <div className="flex-1 h-px bg-white/[0.05]" />
                </div>
                <div className="grid gap-x-5 gap-y-6" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
                  {group.games.map((g, i) => (
                    <motion.div key={g.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.025 }}>
                      <GameCard game={g} subtitle={`${timeAgo(g.last_played)} · ${formatPlaytime(g.playtime_mins)}`} />
                    </motion.div>
                  ))}
                </div>
              </section>
            ))}
          </>
        )}
      </div>
      <ScrollToTop scrollRef={scrollRef} />
    </div>
  );
}
