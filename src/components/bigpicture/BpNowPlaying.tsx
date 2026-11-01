import { motion } from "framer-motion";
import type { Game, StatusConfig } from "@/lib/types";
import GameCover from "@/components/ui/GameCover";
import { displayName } from "@/lib/gameName";
import { formatPlaytime, PLATFORM_LABELS } from "@/lib/utils";
import { useUIStore } from "@/store/useUIStore";
import { formatClock, useSessionSeconds } from "@/hooks/useSession";
import { BpButton } from "./BpOverlays";
import { ClockIcon, StarIcon, StopIcon, MaximizeIcon, InfoIcon, TrophyIcon } from "@/components/ui/Icons";

const REVEAL = "460px 0 60px";

function startedLabel(iso: string | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function NowPlayingCard({ game, statuses, onSwitch, onDetails, onStop }: {
  game: Game;
  statuses: StatusConfig[];
  onSwitch: () => void;
  onDetails: () => void;
  onStop: () => void;
}) {
  const session = useUIStore((s) => s.session);
  const secs = useSessionSeconds() ?? 0;
  const totalMins = game.playtime_mins + Math.floor(secs / 60);
  const status = statuses.find((s) => s.key === game.status);
  const started = startedLabel(session?.started_at);
  const waiting = session ? !session.detected : false;
  const idle = !!session?.idle;
  const hltb = game.hltb_main_mins ?? 0;
  const progress = hltb > 0 ? Math.min(1, totalMins / hltb) : null;
  const meta = [game.genre, game.developer, game.release_year].filter(Boolean).join(" · ");

  const stats = [
    { icon: <ClockIcon size={16} />, label: "Total playtime", value: totalMins > 0 ? formatPlaytime(totalMins) : "Under a minute" },
    { icon: <StarIcon size={16} filled />, label: "Your rating", value: game.rating !== null ? `${game.rating} / 10` : "Unrated" },
    { icon: <TrophyIcon size={16} />, label: "Status", value: status && game.status !== "none" ? status.label : "No status", color: status && game.status !== "none" ? status.color : undefined },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="px-[5vw] pt-[3.5vh] pb-[3vh]"
    >
      <div className="relative overflow-clip rounded-[32px] ring-1 ring-white/[0.12] shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)]">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute opacity-60" style={{ left: "-10%", top: "-30%", width: "30%", height: "40%", transform: "scale(4.4)", transformOrigin: "0 0", filter: "blur(14px) saturate(1.6)" }}>
            <GameCover game={game} eager />
          </div>
          <div className="absolute inset-0" style={{ background: "linear-gradient(100deg, rgb(var(--bg-base) / 0.55) 0%, rgb(var(--bg-base) / 0.82) 45%, rgb(var(--bg-base) / 0.94) 100%)" }} />
          <div className="absolute inset-0" style={{ background: "radial-gradient(70% 120% at 0% 100%, rgba(16,185,129,0.22), transparent 60%), radial-gradient(60% 90% at 100% 0%, rgb(var(--accent-500) / 0.22), transparent 65%)" }} />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        </div>

        <div className="relative flex items-stretch gap-[3vw] p-[2.2vw]">
          <div className="relative shrink-0 self-center" style={{ width: "clamp(170px, 14vw, 280px)" }}>
            <motion.div
              className="absolute -inset-3 rounded-[26px]"
              style={{ background: "radial-gradient(closest-side, rgba(16,185,129,0.45), transparent)" }}
              animate={{ opacity: idle || waiting ? 0.25 : [0.45, 0.9, 0.45] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            />
            <div className="relative aspect-[3/4] rounded-[22px] overflow-hidden ring-2 ring-emerald-400/50 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)]">
              <GameCover game={game} eager />
            </div>
          </div>

          <div className="min-w-0 flex-1 flex flex-col justify-center">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-2 pl-2.5 pr-3.5 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-[13px] font-bold tracking-[0.14em]">
                <span className="relative flex w-2.5 h-2.5">
                  <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
                  <span className="relative w-2.5 h-2.5 rounded-full bg-emerald-400" />
                </span>
                NOW PLAYING
              </span>
              <span className="text-[15px] text-white/55">{PLATFORM_LABELS[game.platform]}</span>
              {started && <span className="text-[15px] text-white/40">· Started {started}</span>}
              {waiting && <span className="px-3 py-1 rounded-full bg-white/10 text-white/70 text-[13px] font-semibold">Waiting for the game to start…</span>}
              {idle && !waiting && <span className="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-200 text-[13px] font-semibold">Paused · game is in the background</span>}
            </div>

            <h1 className="mt-3 text-[clamp(32px,3.6vw,64px)] font-bold leading-[1.02] text-white tracking-tight line-clamp-2 drop-shadow-[0_4px_30px_rgba(0,0,0,0.6)]">{displayName(game.name)}</h1>
            {meta && <p className="mt-2 text-[16px] text-white/50 truncate">{meta}</p>}

            <div className="mt-6 flex flex-wrap items-end gap-x-10 gap-y-5">
              <div>
                <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-white/45">This session</p>
                <p className={`mt-1 font-display tabular-nums leading-none text-[clamp(44px,4.4vw,80px)] font-bold ${idle || waiting ? "text-white/55" : "text-white"}`}>{formatClock(secs)}</p>
              </div>
              <div className="flex flex-wrap gap-3 pb-1">
                {stats.map((s) => (
                  <div key={s.label} className="rounded-2xl px-4 py-3 bg-white/[0.06] border border-white/[0.08] min-w-[150px]">
                    <div className="flex items-center gap-2 text-white/45 text-[11.5px] font-bold uppercase tracking-[0.14em]">{s.icon}{s.label}</div>
                    <p className="mt-1 text-[19px] font-semibold text-white truncate flex items-center gap-2">
                      {s.color && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />}
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {progress !== null && (
              <div className="mt-5 max-w-[640px]">
                <div className="flex justify-between text-[13px] text-white/45 mb-1.5">
                  <span>Story progress (HowLongToBeat)</span>
                  <span className="tabular-nums">{Math.round(progress * 100)}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-accent-400" style={{ width: `${progress * 100}%` }} />
                </div>
              </div>
            )}

            <div data-bp-row className="mt-7 flex flex-wrap items-center gap-3">
              <BpButton primary autofocus onClick={onSwitch} className="min-w-[220px]" scrollMargin={REVEAL}><MaximizeIcon size={19} /> Switch to Game</BpButton>
              <BpButton onClick={onDetails} scrollMargin={REVEAL}><InfoIcon size={19} /> Game Details</BpButton>
              <BpButton danger onClick={onStop} scrollMargin={REVEAL}><StopIcon size={19} /> Stop Game</BpButton>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
