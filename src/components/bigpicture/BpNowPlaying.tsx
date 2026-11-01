import { motion } from "framer-motion";
import type { Game, StatusConfig } from "@/lib/types";
import GameCover from "@/components/ui/GameCover";
import { displayName } from "@/lib/gameName";
import { formatPlaytime, PLATFORM_LABELS } from "@/lib/utils";
import { useUIStore } from "@/store/useUIStore";
import { formatClock, useSessionSeconds } from "@/hooks/useSession";
import { BpButton } from "./BpOverlays";
import { StopIcon, MaximizeIcon, InfoIcon } from "@/components/ui/Icons";

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
    { label: "Total playtime", value: totalMins > 0 ? formatPlaytime(totalMins) : "Under a minute" },
    { label: "Your rating", value: game.rating !== null ? `${game.rating}/10` : "Unrated" },
    { label: "Status", value: status && game.status !== "none" ? status.label : "No status", color: status && game.status !== "none" ? status.color : undefined },
    ...(progress !== null ? [{ label: "Story progress", value: `${Math.round(progress * 100)}%` }] : []),
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="px-[5vw] pt-[3.5vh] pb-[3vh]"
    >
      <div className="relative overflow-clip rounded-[24px] bg-white/[0.03]">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute opacity-50" style={{ left: "-10%", top: "-30%", width: "30%", height: "40%", transform: "scale(4.4)", transformOrigin: "0 0", filter: "blur(24px) saturate(1.2)" }}>
            <GameCover game={game} eager />
          </div>
          <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgb(var(--bg-base) / 0.5) 0%, rgb(var(--bg-base) / 0.85) 40%, rgb(var(--bg-base) / 0.95) 100%)" }} />
        </div>

        <div className="relative flex items-center gap-[2.6vw] p-[2.2vw]">
          <div className="relative shrink-0 aspect-[3/4] rounded-[16px] overflow-hidden" style={{ width: "clamp(160px, 13vw, 260px)" }}>
            <GameCover game={game} eager />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px]">
              <span className="flex items-center gap-2 font-semibold text-emerald-300">
                <span className={`w-2 h-2 rounded-full ${idle || waiting ? "bg-white/40" : "bg-emerald-400"}`} />
                {waiting ? "Starting" : idle ? "In the background" : "Now playing"}
              </span>
              <span className="text-white/45">{PLATFORM_LABELS[game.platform]}{started ? ` · Started ${started}` : ""}</span>
            </div>

            <h1 className="mt-2 text-[clamp(32px,3.4vw,60px)] font-bold leading-[1.04] text-white tracking-tight line-clamp-2">{displayName(game.name)}</h1>
            {meta && <p className="mt-1.5 text-[16px] text-white/50 truncate">{meta}</p>}

            <div className="mt-6 flex flex-wrap items-end gap-x-12 gap-y-5">
              <div>
                <p className="text-[14px] text-white/50">This session</p>
                <p className={`mt-0.5 font-display tabular-nums leading-none text-[clamp(40px,4vw,72px)] font-semibold ${idle || waiting ? "text-white/50" : "text-white"}`}>{waiting ? "–:––" : formatClock(secs)}</p>
              </div>
              {stats.map((s) => (
                <div key={s.label} className="pb-1">
                  <p className="text-[14px] text-white/50">{s.label}</p>
                  <p className="mt-1 text-[20px] font-semibold text-white flex items-center gap-2 whitespace-nowrap">
                    {s.color && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />}
                    {s.value}
                  </p>
                </div>
              ))}
            </div>

            <div data-bp-row className="mt-8 flex flex-wrap items-center gap-3">
              <BpButton primary autofocus onClick={onSwitch} className="min-w-[210px]" scrollMargin={REVEAL}><MaximizeIcon size={19} /> Switch to Game</BpButton>
              <BpButton onClick={onDetails} scrollMargin={REVEAL}><InfoIcon size={19} /> Details</BpButton>
              <BpButton onClick={onStop} scrollMargin={REVEAL}><StopIcon size={18} /> Stop</BpButton>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
