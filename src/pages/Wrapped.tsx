import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/tauri";
import { useCover } from "@/hooks/useCover";
import { formatPlaytime } from "@/lib/utils";
import type { GameSummary, Platform } from "@/lib/types";

const PLATFORM_COLORS: Record<string, string> = {
  steam: "#38bdf8",
  epic: "#94a3b8",
  gog: "#c084fc",
  custom: "#a78bfa",
};

function GameCoverMini({ game }: { game: GameSummary }) {
  const fakeGame = { ...game, is_favorite: false, tags: [], status: "none" as const, is_pinned: false, igdb_skipped: false, not_installed: false, sort_order: 0, playtime_mins: game.playtime_mins, date_added: "", deleted_at: null, exe_path: null, install_dir: null, description: null, last_played: null, steam_app_id: null, epic_app_name: null, custom_fields: {}, hltb_main_mins: null, hltb_extra_mins: null, genre: null, developer: null, publisher: null, release_year: null, platform: game.platform as Platform };
  const coverUrl = useCover(fakeGame);

  return (
    <div className="w-16 h-[85px] rounded-xl overflow-hidden shrink-0 border border-white/[0.08]">
      {coverUrl ? (
        <img src={coverUrl} alt={game.name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full" style={{ background: "rgba(255,255,255,0.04)" }} />
      )}
    </div>
  );
}

function StatCard({ label, value, sub, delay, accent, icon }: { label: string; value: string | number; sub?: string; delay: number; accent?: boolean; icon: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl p-5"
      style={{
        background: accent
          ? "linear-gradient(135deg, rgb(var(--accent-700) / 0.25) 0%, rgb(var(--accent-600) / 0.1) 100%)"
          : "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)",
        border: accent ? "1px solid rgb(var(--accent-500) / 0.25)" : "1px solid rgba(255,255,255,0.06)",
        boxShadow: accent ? "0 0 30px rgb(var(--accent-500) / 0.08)" : undefined,
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgb(var(--accent-500) / 0.12)", border: "1px solid rgb(var(--accent-500) / 0.15)" }}>
          {icon}
        </div>
        <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.15em]">{label}</span>
      </div>
      <p className="text-3xl font-bold" style={{ color: accent ? "rgb(var(--accent-300))" : "white" }}>{value}</p>
      {sub && <p className="text-[11px] text-slate-600 mt-1">{sub}</p>}
    </motion.div>
  );
}

const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function MonthsChart({ busiest }: { busiest: string | null }) {
  const busiestIdx = busiest ? ["January","February","March","April","May","June","July","August","September","October","November","December"].indexOf(busiest) : -1;
  return (
    <div className="flex items-end gap-1 h-10">
      {MONTHS_SHORT.map((m, i) => (
        <div key={m} className="flex-1 flex flex-col items-center gap-0.5">
          <motion.div
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ delay: 0.05 * i, duration: 0.4 }}
            style={{ transformOrigin: "bottom" }}
            className="w-full rounded-sm"
            style={{
              background: i === busiestIdx ? "rgb(var(--accent-400))" : "rgba(255,255,255,0.1)",
              height: i === busiestIdx ? 32 : 10,
              transformOrigin: "bottom",
            } as React.CSSProperties}
          />
        </div>
      ))}
    </div>
  );
}

function PlatformDonut({ breakdown }: { breakdown: Record<string, number> }) {
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const entries = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
  let cumulativePct = 0;
  const size = 80;
  const r = 28;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
        {entries.map(([platform, count]) => {
          const pct = count / total;
          const offset = circumference * (1 - pct);
          const dashOffset = circumference * cumulativePct;
          cumulativePct += pct;
          return (
            <circle
              key={platform}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={PLATFORM_COLORS[platform] ?? "#94a3b8"}
              strokeWidth="10"
              strokeDasharray={`${circumference * pct} ${circumference * (1 - pct)}`}
              strokeDashoffset={-dashOffset * circumference / circumference * circumference + circumference}
              style={{ strokeDashoffset: -dashOffset * (circumference) / 1 }}
            />
          );
        })}
      </svg>
      <div className="flex flex-col gap-1">
        {entries.map(([platform, count]) => (
          <div key={platform} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: PLATFORM_COLORS[platform] ?? "#94a3b8" }} />
            <span className="text-[11px] text-slate-400 capitalize">{platform}</span>
            <span className="text-[11px] text-slate-600 ml-1">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Wrapped() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const { data, isLoading } = useQuery({
    queryKey: ["year-in-review", year],
    queryFn: () => api.getYearInReview(year),
    staleTime: 2 * 60 * 1000,
  });

  const availableYears = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="min-h-full p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Year in Review</h1>
          <p className="text-sm text-slate-600 mt-0.5">Your gaming year, summarised.</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {availableYears.map((y) => (
            <motion.button
              key={y}
              whileTap={{ scale: 0.95 }}
              onClick={() => setYear(y)}
              className="px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all duration-200"
              style={
                y === year
                  ? { background: "linear-gradient(135deg, rgb(var(--accent-600)), rgb(var(--accent-700)))", color: "white", border: "1px solid rgb(var(--accent-500) / 0.3)" }
                  : { background: "rgba(255,255,255,0.04)", color: "#64748b", border: "1px solid rgba(255,255,255,0.06)" }
              }
            >
              {y}
            </motion.button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="rounded-2xl h-32 animate-pulse" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }} />
          ))}
        </div>
      )}

      {!isLoading && data && data.total_sessions === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-32 text-center gap-4"
        >
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none"><path d="M8 7V3M16 7V3M7 11H17M5 21H19C20.1 21 21 20.1 21 19V7C21 5.9 20.1 5 19 5H5C3.9 5 3 5.9 3 7V19C3 20.1 3.9 21 5 21Z" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-400">No sessions for {year}</h3>
          <p className="text-sm text-slate-600 max-w-xs leading-relaxed">Launch games from ZGameLib to start tracking your playtime — your year in review will appear here.</p>
        </motion.div>
      )}

      {!isLoading && data && data.total_sessions > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0, duration: 0.4 }}
            className="col-span-2 md:col-span-3 rounded-2xl p-6"
            style={{
              background: "linear-gradient(135deg, rgb(var(--accent-700) / 0.3) 0%, rgb(var(--accent-600) / 0.12) 100%)",
              border: "1px solid rgb(var(--accent-500) / 0.3)",
              boxShadow: "0 0 60px rgb(var(--accent-500) / 0.08)",
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-accent-400"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor"/></svg>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.15em]">Your {year} in Games</span>
            </div>
            <p className="text-4xl font-bold" style={{ color: "rgb(var(--accent-300))" }}>
              {data.total_hours < 1 ? `${Math.round(data.total_hours * 60)}m` : `${Math.round(data.total_hours)}h`}
            </p>
            <p className="text-slate-500 text-sm mt-1">{data.total_sessions} sessions across {data.total_unique_games_played} game{data.total_unique_games_played !== 1 ? "s" : ""}</p>
          </motion.div>

          {data.most_played && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.4 }}
              className="rounded-2xl p-5"
              style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.15em] mb-3">Most Played</div>
              <div className="flex items-start gap-3">
                <GameCoverMini game={data.most_played} />
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-white truncate">{data.most_played.name}</div>
                  <div className="text-[11px] text-slate-500 capitalize mt-0.5">{data.most_played.platform}</div>
                  <div className="text-[11px] mt-2" style={{ color: "rgb(var(--accent-400))" }}>
                    {formatPlaytime(data.most_played.playtime_mins)}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {data.top_rated && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.4 }}
              className="rounded-2xl p-5"
              style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.15em] mb-3">Top Rated</div>
              <div className="flex items-start gap-3">
                <GameCoverMini game={data.top_rated} />
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-white truncate">{data.top_rated.name}</div>
                  <div className="text-[11px] text-slate-500 capitalize mt-0.5">{data.top_rated.platform}</div>
                  {data.top_rated.rating != null && (
                    <div className="flex items-center gap-1 mt-2">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="rgb(var(--accent-400))"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
                      <span className="text-[12px] font-bold" style={{ color: "rgb(var(--accent-300))" }}>{data.top_rated.rating}/10</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          <StatCard
            label="New Additions"
            value={data.new_games_added}
            sub="games joined your library"
            delay={0.16}
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-accent-400"><path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>}
          />

          <StatCard
            label="Completed"
            value={data.games_completed}
            sub="games finished"
            delay={0.2}
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-accent-400"><path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          />

          <StatCard
            label="Longest Session"
            value={formatPlaytime(data.longest_session_mins)}
            sub="single sitting"
            delay={0.24}
            accent
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-accent-400"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/><path d="M12 7V12L15 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
          />

          {data.busiest_month && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28, duration: 0.4 }}
              className="rounded-2xl p-5"
              style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgb(var(--accent-500) / 0.12)", border: "1px solid rgb(var(--accent-500) / 0.15)" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-accent-400"><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M3 9H21M9 3V5M15 3V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </div>
                <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.15em]">Busiest Month</span>
              </div>
              <p className="text-xl font-bold text-white mb-3">{data.busiest_month}</p>
              <MonthsChart busiest={data.busiest_month} />
            </motion.div>
          )}

          {Object.keys(data.platform_breakdown).length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.32, duration: 0.4 }}
              className="rounded-2xl p-5"
              style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgb(var(--accent-500) / 0.12)", border: "1px solid rgb(var(--accent-500) / 0.15)" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-accent-400"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/><path d="M12 3C12 3 16 8 16 12C16 16 12 21 12 21" stroke="currentColor" strokeWidth="1.5"/><path d="M3 12H21" stroke="currentColor" strokeWidth="1.5"/></svg>
                </div>
                <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.15em]">Platform Split</span>
              </div>
              <PlatformDonut breakdown={data.platform_breakdown} />
            </motion.div>
          )}

          <StatCard
            label="Games Explored"
            value={data.total_unique_games_played}
            sub="unique games played"
            delay={0.36}
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-accent-400"><rect x="3" y="7" width="18" height="13" rx="3" stroke="currentColor" strokeWidth="1.5"/><path d="M9 14H10M9 11H10M14 14H15M14 11H15M12 7V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
          />
        </div>
      )}
    </div>
  );
}
