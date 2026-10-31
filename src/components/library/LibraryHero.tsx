import { displayName } from "@/lib/gameName";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useGameStore } from "@/store/useGameStore";
import { useUIStore } from "@/store/useUIStore";
import { useLaunchGame } from "@/lib/useLaunchGame";
import { api } from "@/lib/tauri";
import { sqliteWeekKey } from "@/lib/week";
import { formatPlaytime, timeAgo, PLATFORM_LABELS, cn } from "@/lib/utils";
import GameCover from "@/components/ui/GameCover";
import { PlayIcon, StopIcon, ClockIcon, StarIcon, TrophyIcon, EditIcon, CheckIcon } from "@/components/ui/Icons";

const GOAL_KEY = "zgamelib-weekly-goal-mins";
const GOAL_ENABLED_KEY = "zgamelib-weekly-goal-enabled";

function WeeklyGoal() {
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem(GOAL_ENABLED_KEY) === "1"; } catch { return false; }
  });
  const [goalMins, setGoalMins] = useState(() => {
    try { return parseInt(localStorage.getItem(GOAL_KEY) ?? "300", 10) || 300; } catch { return 300; }
  });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const { data: weekly = [] } = useQuery({ queryKey: ["weekly-playtime"], queryFn: () => api.getWeeklyPlaytime(), staleTime: 60_000 });

  const thisWeek = weekly.find((w) => w.week === sqliteWeekKey(new Date()))?.mins ?? 0;
  const pct = Math.min(100, Math.round((thisWeek / goalMins) * 100));
  const done = thisWeek >= goalMins;
  const R = 34;
  const C = 2 * Math.PI * R;

  const commit = () => {
    const v = parseFloat(draft);
    if (!isNaN(v) && v > 0) {
      const mins = Math.round(v * 60);
      setGoalMins(mins);
      try { localStorage.setItem(GOAL_KEY, String(mins)); } catch {}
    }
    setEditing(false);
  };

  if (!enabled) {
    return (
      <button
        onClick={() => { setEnabled(true); try { localStorage.setItem(GOAL_ENABLED_KEY, "1"); } catch {} }}
        className="flex flex-col items-center justify-center gap-2 w-full h-full rounded-2xl border border-dashed border-white/10 text-slate-500 hover:text-slate-200 hover:border-accent-400/40 transition-colors px-4"
      >
        <TrophyIcon size={20} />
        <span className="text-[12px] font-medium text-center">Set a weekly playtime goal</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-4 h-full">
      <div className="relative w-[84px] h-[84px] shrink-0">
        <svg viewBox="0 0 84 84" className="w-full h-full -rotate-90">
          <circle cx="42" cy="42" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
          <motion.circle
            cx="42" cy="42" r={R} fill="none"
            stroke={done ? "#34d399" : "rgb(var(--accent-400))"}
            strokeWidth="7" strokeLinecap="round"
            strokeDasharray={C}
            initial={{ strokeDashoffset: C }}
            animate={{ strokeDashoffset: C * (1 - pct / 100) }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[17px] font-bold text-white tabular-nums leading-none">{pct}%</span>
        </div>
      </div>
      <div className="min-w-0">
        <p className="section-label !text-[10px]">This week</p>
        <p className="text-[18px] font-bold text-white tabular-nums mt-0.5">{formatPlaytime(thisWeek) === "Never played" ? "0h" : formatPlaytime(thisWeek)}</p>
        {editing ? (
          <div className="flex items-center gap-1 mt-1">
            <input
              autoFocus
              type="number"
              min={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
              onBlur={commit}
              className="w-12 bg-white/5 border border-accent-500/40 rounded-md text-[12px] text-white text-center outline-none tabular-nums py-0.5 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-[11px] text-slate-500">hours</span>
            <button onMouseDown={(e) => e.preventDefault()} onClick={commit} className="text-accent-300"><CheckIcon size={12} /></button>
          </div>
        ) : (
          <button onClick={() => { setDraft(String(Math.round((goalMins / 60) * 10) / 10)); setEditing(true); }} className="flex items-center gap-1.5 text-[11.5px] text-slate-400 hover:text-white mt-0.5 group">
            {done ? <span className="text-emerald-300 font-medium">Goal reached</span> : <span>of {Math.round((goalMins / 60) * 10) / 10}h goal</span>}
            <EditIcon size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        )}
        <button
          onClick={() => { setEnabled(false); try { localStorage.setItem(GOAL_ENABLED_KEY, "0"); } catch {} }}
          className="block text-[10.5px] text-slate-600 hover:text-slate-400 mt-1"
        >
          Hide goal
        </button>
      </div>
    </div>
  );
}

export default function LibraryHero() {
  const games = useGameStore((s) => s.games);
  const activeGameId = useUIStore((s) => s.activeGameId);
  const setSelectedGameId = useGameStore((s) => s.setSelectedGameId);
  const setDetailOpen = useUIStore((s) => s.setDetailOpen);
  const { launch } = useLaunchGame();

  const hero = useMemo(() => {
    if (activeGameId) {
      const g = games.find((x) => x.id === activeGameId);
      if (g) return g;
    }
    const recent = games.filter((g) => g.last_played).sort((a, b) => (b.last_played ?? "").localeCompare(a.last_played ?? ""));
    return recent[0] ?? null;
  }, [games, activeGameId]);

  const stats = useMemo(() => {
    const total = games.reduce((a, g) => a + g.playtime_mins, 0);
    const completed = games.filter((g) => g.status === "completed").length;
    const playing = games.filter((g) => g.status === "playing").length;
    return { total, completed, playing };
  }, [games]);

  if (!hero) return null;
  const running = hero.id === activeGameId;

  const stopGame = () => {
    useUIStore.getState().openConfirm(`Stop "${hero.name}"?`, async () => {
      try { await api.stopGame(); useUIStore.getState().setActiveGameId(null); }
      catch (e) { useUIStore.getState().addToast(String(e), "error"); }
    }, "Stop Game");
  };

  return (
    <div className="px-8 pt-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative rounded-[24px] overflow-hidden flex"
        style={{ border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 30px 60px -30px rgba(0,0,0,0.9)" }}
      >
        <div className="absolute inset-0">
          <div className="absolute -inset-10 blur-[50px] opacity-70 saturate-150">
            <GameCover game={hero} eager />
          </div>
          <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgb(var(--bg-base) / 0.92) 0%, rgb(var(--bg-base) / 0.72) 50%, rgb(var(--bg-base) / 0.55) 100%)" }} />
        </div>

        <div className="relative flex-1 flex items-center gap-6 p-6 min-w-0">
          <button
            onClick={() => { setSelectedGameId(hero.id); setDetailOpen(true); }}
            className="w-[124px] aspect-[3/4] rounded-2xl overflow-hidden shrink-0 ring-1 ring-white/15 card-lift"
            style={{ boxShadow: "0 20px 40px -12px rgba(0,0,0,0.9)" }}
          >
            <GameCover game={hero} eager />
          </button>
          <div className="min-w-0 flex-1">
            {running ? (
              <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10.5px] font-bold tracking-[0.14em]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> NOW PLAYING
              </span>
            ) : (
              <span className="text-[10.5px] font-bold tracking-[0.18em] text-accent-200/90 uppercase">Continue playing</span>
            )}
            <h2 className="text-[30px] font-bold text-white leading-tight mt-2 truncate">{displayName(hero.name)}</h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-[12.5px] text-slate-300/80">
              <span>{PLATFORM_LABELS[hero.platform]}</span>
              <span className="flex items-center gap-1.5"><ClockIcon size={12} className="text-slate-400" />{formatPlaytime(hero.playtime_mins)}</span>
              {hero.last_played && <span>Last played {timeAgo(hero.last_played)}</span>}
              {hero.rating !== null && <span className="flex items-center gap-1"><StarIcon size={11} filled className="text-amber-300" />{hero.rating}/10</span>}
            </div>
            <div className="flex items-center gap-2 mt-5">
              {running ? (
                <button onClick={stopGame} className="h-11 px-6 rounded-xl flex items-center gap-2 text-[14px] font-semibold text-white bg-red-500/80 hover:bg-red-500 transition-colors">
                  <StopIcon size={14} /> Stop
                </button>
              ) : (
                <button onClick={() => launch(hero)} className="btn-primary h-11 px-7 text-[14px]">
                  <PlayIcon size={15} /> {hero.not_installed ? "Install" : "Play"}
                </button>
              )}
              <button onClick={() => { setSelectedGameId(hero.id); setDetailOpen(true); }} className="btn-ghost h-11 px-5 text-[13px] !bg-black/20">
                Details
              </button>
            </div>
          </div>
        </div>

        <div className="relative hidden xl:flex shrink-0 w-[340px] p-5 gap-3 items-stretch border-l border-white/[0.06] bg-black/10">
          <div className="flex-1 flex flex-col justify-center gap-3">
            {[
              { label: "Total playtime", value: formatPlaytime(stats.total) === "Never played" ? "0h" : formatPlaytime(stats.total) },
              { label: "Playing now", value: String(stats.playing) },
              { label: "Completed", value: String(stats.completed) },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500 font-semibold">{s.label}</p>
                <p className="text-[16px] font-bold text-white tabular-nums">{s.value}</p>
              </div>
            ))}
          </div>
          <div className={cn("w-[180px] flex items-center")}>
            <WeeklyGoal />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
