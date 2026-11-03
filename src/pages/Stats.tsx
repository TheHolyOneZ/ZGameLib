import { displayName } from "@/lib/gameName";
import { motion } from "framer-motion";
import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useGameStore } from "@/store/useGameStore";
import { useLibraryGames } from "@/hooks/useGames";
import { useUIStore } from "@/store/useUIStore";
import { formatPlaytime, PLATFORM_LABELS, cn } from "@/lib/utils";
import type { Platform, Game, LibraryGrowthEntry } from "@/lib/types";
import { TrophyIcon, StarIcon, HeartIcon, GamepadIcon, ClockIcon, ChartIcon, FireIcon, LibraryIcon } from "@/components/ui/Icons";
import GameCover from "@/components/ui/GameCover";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { api } from "@/lib/tauri";

const PLATFORM_HEX: Record<Platform, string> = {
  steam: "#38bdf8",
  epic: "#cbd5e1",
  gog: "#c084fc",
  custom: "#34d399",
  ubisoft: "#60a5fa",
};

function hoursLabel(mins: number) {
  if (mins <= 0) return "0h";
  const h = mins / 60;
  return h >= 100 ? `${Math.round(h)}h` : `${Math.round(h * 10) / 10}h`;
}

function Card({ title, subtitle, children, className, delay = 0, action }: { title: string; subtitle?: string; children: ReactNode; className?: string; delay?: number; action?: ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={cn("surface p-5 flex flex-col", className)}
    >
      <div className="flex items-start gap-3 mb-4">
        <div className="flex-1">
          <h3 className="text-[14px] font-semibold text-white">{title}</h3>
          {subtitle && <p className="text-[12px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </motion.section>
  );
}

function Kpi({ icon, label, value, sub, onClick, delay, tint }: { icon: ReactNode; label: string; value: string | number; sub?: string; onClick?: () => void; delay: number; tint: string }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      onClick={onClick}
      className="surface-interactive p-4 text-left group relative overflow-hidden"
    >
      <div className="relative flex items-center gap-2 text-slate-400">
        <span className="flex items-center" style={{ color: tint }}>{icon}</span>
        <span className="text-[12.5px] font-medium">{label}</span>
      </div>
      <p className="relative text-[30px] font-semibold text-white mt-3 leading-none tabular-nums font-display">{value}</p>
      {sub && <p className="relative text-[11.5px] text-slate-500 mt-1.5">{sub}</p>}
    </motion.button>
  );
}

function GameRow({ game, rank, right, onOpen }: { game: Game; rank: number; right: ReactNode; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="flex items-center gap-3 px-2 py-1.5 rounded-xl hover:bg-white/[0.04] transition-colors text-left group w-full">
      <span className="w-5 text-[12px] font-bold text-slate-600 tabular-nums text-right group-hover:text-accent-300">{rank}</span>
      <div className="w-8 h-11 rounded-md overflow-hidden ring-1 ring-white/10 shrink-0"><GameCover game={game} /></div>
      <span className="flex-1 min-w-0 text-[13px] text-slate-200 truncate group-hover:text-white">{displayName(game.name)}</span>
      {right}
    </button>
  );
}

export default function Stats() {
  const games = useLibraryGames();
  const customStatuses = useUIStore((s) => s.customStatuses);
  const navigate = useNavigate();
  const [hoverWeek, setHoverWeek] = useState<number | null>(null);
  const [hoverMonth, setHoverMonth] = useState<number | null>(null);

  const { data: weeklyPlaytime = [] } = useQuery({ queryKey: ["weekly-playtime"], queryFn: () => api.getWeeklyPlaytime(), staleTime: 5 * 60 * 1000 });
  const { data: libraryGrowth = [] } = useQuery<LibraryGrowthEntry[]>({ queryKey: ["library-growth"], queryFn: () => api.getLibraryGrowth(), staleTime: 5 * 60 * 1000 });

  const openGame = (g: Game) => {
    useGameStore.getState().setSelectedGameId(g.id);
    useUIStore.getState().setDetailOpen(true);
  };

  const goToLibrary = (setup?: () => void) => () => {
    const { resetFilters, setSortKey, setSortAsc, clearFilterRules } = useGameStore.getState();
    resetFilters();
    clearFilterRules();
    setSortKey("name");
    setSortAsc(true);
    setup?.();
    navigate("/");
  };

  const s = useMemo(() => {
    const totalMins = games.reduce((a, g) => a + g.playtime_mins, 0);
    const rated = games.filter((g) => g.rating !== null);
    const avgRating = rated.length ? rated.reduce((a, g) => a + (g.rating ?? 0), 0) / rated.length : null;
    const completed = games.filter((g) => g.status === "completed").length;
    const played = games.filter((g) => g.playtime_mins > 0).length;
    const platforms = (Object.keys(PLATFORM_HEX) as Platform[])
      .map((p) => ({ p, count: games.filter((g) => g.platform === p).length, mins: games.filter((g) => g.platform === p).reduce((a, g) => a + g.playtime_mins, 0) }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count);
    const statuses = customStatuses.map((st) => ({ ...st, count: games.filter((g) => g.status === st.key).length })).filter((x) => x.count > 0);
    const unset = games.filter((g) => g.status === "none").length;
    const ratingDist = Array.from({ length: 10 }, (_, i) => games.filter((g) => g.rating === i + 1).length);
    const mostPlayed = [...games].filter((g) => g.playtime_mins > 0).sort((a, b) => b.playtime_mins - a.playtime_mins).slice(0, 8);
    const topRated = [...games].filter((g) => g.rating !== null).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.playtime_mins - a.playtime_mins).slice(0, 8);
    const neglected = [...games]
      .filter((g) => g.playtime_mins === 0 && g.date_added && Date.now() - new Date(g.date_added).getTime() > 60 * 86400000)
      .sort((a, b) => new Date(a.date_added).getTime() - new Date(b.date_added).getTime())
      .slice(0, 8);
    const genreMap = new Map<string, number>();
    for (const g of games) if (g.genre) for (const part of g.genre.split(/[,/]/).map((x) => x.trim()).filter(Boolean)) genreMap.set(part, (genreMap.get(part) ?? 0) + 1);
    const genres = [...genreMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    return { totalMins, rated, avgRating, completed, played, platforms, statuses, unset, ratingDist, mostPlayed, topRated, neglected, genres };
  }, [games, customStatuses]);

  if (games.length === 0) {
    return (
      <div className="h-full overflow-y-auto page-enter">
        <PageHeader icon={<ChartIcon size={22} />} title="Statistics" subtitle="Insights about your library and play habits" />
        <EmptyState icon={<ChartIcon size={34} />} title="No data yet" description="Scan or add some games and your stats will appear here." />
      </div>
    );
  }

  const totalGames = games.length;
  const completionRate = Math.round((s.completed / totalGames) * 100);
  const maxWeek = Math.max(...weeklyPlaytime.map((w) => w.mins), 1);
  const weekTotal = weeklyPlaytime.reduce((a, w) => a + w.mins, 0);
  const maxRating = Math.max(...s.ratingDist, 1);
  const growthTotals = libraryGrowth.map((e) => e.steam + e.epic + e.gog + e.custom + e.ubisoft);
  const maxGrowth = Math.max(...growthTotals, 1);
  const R = 46;
  const C = 2 * Math.PI * R;
  let acc = 0;

  return (
    <div className="h-full overflow-y-auto page-enter">
      <PageHeader icon={<ChartIcon size={22} />} title="Statistics" subtitle={`${totalGames} games · ${formatPlaytime(s.totalMins)} played in total`} />

      <div className="px-8 pt-5 pb-10 flex flex-col gap-4 max-w-[1400px]">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <Kpi delay={0} tint="#8b5cf6" icon={<GamepadIcon size={14} />} label="Games" value={totalGames} sub={`${s.played} played at least once`} onClick={goToLibrary()} />
          <Kpi delay={0.03} tint="#38bdf8" icon={<ClockIcon size={14} />} label="Playtime" value={hoursLabel(s.totalMins)} sub={`${hoursLabel(Math.round(s.totalMins / Math.max(1, s.played)))} avg per played game`} onClick={goToLibrary(() => { useGameStore.getState().setSortKey("playtime_mins"); useGameStore.getState().setSortAsc(false); })} />
          <Kpi delay={0.06} tint="#a78bfa" icon={<TrophyIcon size={14} />} label="Completed" value={s.completed} sub={`${completionRate}% of library`} onClick={goToLibrary(() => useGameStore.getState().setFilter("status", "completed"))} />
          <Kpi delay={0.09} tint="#fbbf24" icon={<StarIcon size={14} filled />} label="Avg rating" value={s.avgRating !== null ? s.avgRating.toFixed(1) : "—"} sub={`${s.rated.length} rated games`} onClick={goToLibrary(() => { useGameStore.getState().setSortKey("rating"); useGameStore.getState().setSortAsc(false); })} />
          <Kpi delay={0.12} tint="#ec4899" icon={<HeartIcon size={14} filled />} label="Favorites" value={games.filter((g) => g.is_favorite).length} sub={`${totalGames ? Math.round((games.filter((g) => g.is_favorite).length / totalGames) * 100) : 0}% of library`} onClick={() => navigate("/favorites")} />
          <Kpi delay={0.15} tint="#f97316" icon={<FireIcon size={14} />} label="Last 12 weeks" value={hoursLabel(weekTotal)} sub="tracked in ZGameLib" onClick={() => navigate("/recent")} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card title="Weekly playtime" subtitle="Hours played per week, last 12 weeks" className="xl:col-span-2" delay={0.1}>
            {weeklyPlaytime.length === 0 ? (
              <div className="flex-1 flex items-center justify-center py-10 text-[13px] text-slate-500">Launch games from ZGameLib to start tracking sessions.</div>
            ) : (
              <div className="flex-1 flex flex-col">
                <div className="flex items-end gap-2 h-44">
                  {weeklyPlaytime.map((w, i) => (
                    <div key={w.week} className="flex-1 h-full flex flex-col justify-end items-center relative" onMouseEnter={() => setHoverWeek(i)} onMouseLeave={() => setHoverWeek(null)}>
                      {hoverWeek === i && (
                        <span className="absolute -top-1 -translate-y-full px-2 py-1 rounded-lg bg-bg-elevated border border-white/10 text-[11px] text-white whitespace-nowrap z-10 shadow-xl">{formatPlaytime(w.mins)}</span>
                      )}
                      <motion.div
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ delay: 0.15 + i * 0.03, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                        style={{ height: `${Math.max(2, (w.mins / maxWeek) * 100)}%`, originY: 1 }}
                        className={cn("w-full rounded-lg transition-all", hoverWeek === i ? "brightness-125" : "")}
                      >
                        <div className="w-full h-full rounded-lg" style={{ background: i === weeklyPlaytime.length - 1 ? "rgb(var(--accent-400))" : "rgb(var(--accent-500) / 0.55)" }} />
                      </motion.div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  {weeklyPlaytime.map((w, i) => (
                    <span key={w.week} className={cn("flex-1 text-center text-[10px] tabular-nums", hoverWeek === i ? "text-white" : "text-slate-600")}>W{w.week.split("-")[1]}</span>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card title="Progress" subtitle="Where your games stand" delay={0.13}>
            <div className="flex items-center gap-5">
              <div className="relative w-[120px] h-[120px] shrink-0">
                <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                  <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
                  {s.statuses.map((st) => {
                    const frac = st.count / totalGames;
                    const el = (
                      <motion.circle
                        key={st.key}
                        cx="60" cy="60" r={R} fill="none" stroke={st.color} strokeWidth="12"
                        strokeDasharray={`${C * frac} ${C}`}
                        strokeDashoffset={-C * acc}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                      />
                    );
                    acc += frac;
                    return el;
                  })}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[24px] font-bold text-white font-display leading-none">{completionRate}%</span>
                  <span className="text-[12px] text-slate-500 mt-1">complete</span>
                </div>
              </div>
              <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                {s.statuses.map((st) => (
                  <button key={st.key} onClick={goToLibrary(() => useGameStore.getState().setFilter("status", st.key as Game["status"]))} className="flex items-center gap-2 text-[12.5px] hover:bg-white/[0.04] rounded-lg px-2 py-1 -mx-2 transition-colors">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: st.color }} />
                    <span className="flex-1 text-left text-slate-300 truncate">{st.label}</span>
                    <span className="text-slate-400 tabular-nums">{st.count}</span>
                  </button>
                ))}
                {s.unset > 0 && (
                  <div className="flex items-center gap-2 text-[12.5px] px-2 py-1 -mx-2">
                    <span className="w-2 h-2 rounded-full bg-white/10 shrink-0" />
                    <span className="flex-1 text-slate-500">No status</span>
                    <span className="text-slate-500 tabular-nums">{s.unset}</span>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card title="Platforms" subtitle="Games and hours by store" delay={0.16}>
            <div className="flex flex-col gap-3">
              {s.platforms.map((p, i) => (
                <button key={p.p} onClick={goToLibrary(() => useGameStore.getState().setFilter("platform", p.p))} className="text-left group">
                  <div className="flex items-baseline justify-between text-[12.5px] mb-1.5">
                    <span className="text-slate-200 group-hover:text-white">{PLATFORM_LABELS[p.p]}</span>
                    <span className="text-slate-500 tabular-nums">{p.count} · {hoursLabel(p.mins)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(p.count / totalGames) * 100}%` }}
                      transition={{ delay: 0.25 + i * 0.06, duration: 0.7, ease: "easeOut" }}
                      className="h-full rounded-full"
                      style={{ background: PLATFORM_HEX[p.p] }}
                    />
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <Card title="Ratings" subtitle={s.rated.length ? `${s.rated.length} rated · average ${s.avgRating?.toFixed(1)}` : "Rate games to see your taste"} delay={0.19}>
            <div className="flex items-end gap-1.5 h-36">
              {s.ratingDist.map((count, i) => (
                <div key={i} className="flex-1 h-full flex flex-col justify-end items-center gap-1">
                  {count > 0 && <span className="text-[10px] text-slate-400 tabular-nums">{count}</span>}
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(count ? 6 : 2, (count / maxRating) * 100)}%` }}
                    transition={{ delay: 0.25 + i * 0.03, duration: 0.5 }}
                    className="w-full rounded-md"
                    style={{ background: count ? `rgb(var(--accent-500) / ${0.35 + (i / 9) * 0.65})` : "rgba(255,255,255,0.05)" }}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-1.5 mt-2">
              {s.ratingDist.map((_, i) => <span key={i} className="flex-1 text-center text-[10.5px] text-slate-500 tabular-nums">{i + 1}</span>)}
            </div>
          </Card>

          <Card title="Genres" subtitle={s.genres.length ? "Most common in your library" : "Fetch IGDB metadata to see genres"} delay={0.22}>
            {s.genres.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-[12.5px] text-slate-500 py-6 text-center">Use the sparkle button in the top bar to fetch genres for all games.</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {s.genres.map(([g, count], i) => (
                  <span
                    key={g}
                    className="px-3 py-1.5 rounded-full text-[12px] font-medium border"
                    style={{
                      background: `rgb(var(--accent-500) / ${0.28 - i * 0.022})`,
                      borderColor: `rgb(var(--accent-400) / ${0.4 - i * 0.03})`,
                      color: i < 3 ? "white" : "rgb(203 213 225)",
                    }}
                  >
                    {g} <span className="opacity-60 tabular-nums">{count}</span>
                  </span>
                ))}
              </div>
            )}
          </Card>
        </div>

        {libraryGrowth.length > 1 && (
          <Card title="Library growth" subtitle="Games added per month, by platform" delay={0.25}>
            <div className="flex items-end gap-2 h-40">
              {libraryGrowth.map((entry, i) => (
                <div key={entry.month} className="flex-1 h-full flex flex-col justify-end relative" onMouseEnter={() => setHoverMonth(i)} onMouseLeave={() => setHoverMonth(null)}>
                  {hoverMonth === i && (
                    <span className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full px-2 py-1 rounded-lg bg-bg-elevated border border-white/10 text-[11px] text-white whitespace-nowrap z-10 shadow-xl">{growthTotals[i]} games</span>
                  )}
                  <motion.div
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ delay: 0.3 + i * 0.03, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    style={{ height: `${Math.max(3, (growthTotals[i] / maxGrowth) * 100)}%`, originY: 1 }}
                    className="w-full rounded-lg overflow-hidden flex flex-col-reverse"
                  >
                    {(["steam", "epic", "gog", "ubisoft", "custom"] as Platform[]).map((p) => entry[p] ? <div key={p} style={{ flex: entry[p], background: PLATFORM_HEX[p] }} className="opacity-80" /> : null)}
                  </motion.div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              {libraryGrowth.map((e, i) => <span key={e.month} className={cn("flex-1 text-center text-[10px] tabular-nums", hoverMonth === i ? "text-white" : "text-slate-600")}>{e.month.slice(2).replace("-", "/")}</span>)}
            </div>
            <div className="flex items-center gap-4 mt-4 flex-wrap">
              {(Object.keys(PLATFORM_HEX) as Platform[]).filter((p) => libraryGrowth.some((e) => e[p] > 0)).map((p) => (
                <span key={p} className="flex items-center gap-1.5 text-[11.5px] text-slate-400"><span className="w-2.5 h-2.5 rounded" style={{ background: PLATFORM_HEX[p] }} />{PLATFORM_LABELS[p]}</span>
              ))}
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card title="Most played" subtitle="Your biggest time sinks" delay={0.28}>
            {s.mostPlayed.length === 0 ? <p className="text-[12.5px] text-slate-500">Nothing played yet.</p> : (
              <div className="flex flex-col gap-0.5 -mx-2">
                {s.mostPlayed.map((g, i) => (
                  <GameRow key={g.id} game={g} rank={i + 1} onOpen={() => openGame(g)} right={<span className="text-[12px] font-semibold text-slate-300 tabular-nums">{hoursLabel(g.playtime_mins)}</span>} />
                ))}
              </div>
            )}
          </Card>
          <Card title="Top rated" subtitle="Your all-time favorites" delay={0.31}>
            {s.topRated.length === 0 ? <p className="text-[12.5px] text-slate-500">Rate some games to build this list.</p> : (
              <div className="flex flex-col gap-0.5 -mx-2">
                {s.topRated.map((g, i) => (
                  <GameRow key={g.id} game={g} rank={i + 1} onOpen={() => openGame(g)} right={<span className="flex items-center gap-1 text-[12px] font-bold text-amber-300 tabular-nums"><StarIcon size={11} filled />{g.rating}</span>} />
                ))}
              </div>
            )}
          </Card>
          <Card title="Pile of shame" subtitle="Added 2+ months ago, never played" delay={0.34}>
            {s.neglected.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                <LibraryIcon size={24} className="text-emerald-400/70 mb-2" />
                <p className="text-[12.5px] text-slate-400">Clean conscience — no neglected games.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-0.5 -mx-2">
                {s.neglected.map((g, i) => (
                  <GameRow key={g.id} game={g} rank={i + 1} onOpen={() => openGame(g)} right={<span className="text-[11.5px] text-slate-500 tabular-nums">{Math.floor((Date.now() - new Date(g.date_added).getTime()) / 86400000)}d</span>} />
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
