import Logo from "@/components/ui/Logo";
import { displayName } from "@/lib/gameName";
import { motion } from "framer-motion";
import { cn, formatPlaytime, timeAgo, formatDate, PLATFORM_LABELS } from "@/lib/utils";
import type { Game, StatusConfig } from "@/lib/types";
import GameCover from "@/components/ui/GameCover";
import SessionClock from "@/components/ui/SessionClock";
import {
  PlayIcon, HeartIcon, StopIcon, StarIcon, ClockIcon, CheckIcon, CloseIcon,
  ScanIcon, PowerIcon, VolumeIcon, MaximizeIcon, TvIcon, SearchIcon, GamepadIcon,
} from "@/components/ui/Icons";

export function BpButton({ children, onClick, primary, danger, autofocus, className, active, scrollMargin }: {
  children: React.ReactNode;
  scrollMargin?: string;
  onClick: () => void;
  primary?: boolean;
  danger?: boolean;
  autofocus?: boolean;
  className?: string;
  active?: boolean;
}) {
  return (
    <button
      tabIndex={-1}
      data-bp-focusable
      data-bp-autofocus={autofocus || undefined}
      onClick={onClick}
      className={cn(
        "bp-focusable bp-btn relative h-14 px-6 rounded-2xl flex items-center justify-center gap-2.5 text-[17px] font-semibold whitespace-nowrap",
        primary
          ? "text-white"
          : danger
            ? "bg-red-500/20 text-red-200 border border-red-400/30"
            : active
              ? "bg-white text-black"
              : "bg-white/[0.09] text-white border border-white/10",
        className
      )}
      style={{ ...(primary ? { background: "rgb(var(--accent-500))" } : {}), ...(scrollMargin ? { scrollMargin } : {}) }}
    >
      {children}
    </button>
  );
}

export function GamePage({ game, running, statuses, onPlay, onStop, onFavorite, onStatus, onRate, onClose }: {
  game: Game;
  running: boolean;
  statuses: StatusConfig[];
  onPlay: () => void;
  onStop: () => void;
  onFavorite: () => void;
  onStatus: () => void;
  onRate: () => void;
  onClose: () => void;
}) {
  const status = statuses.find((s) => s.key === game.status);
  return (
    <motion.div
      data-bp-scope
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="absolute inset-0 z-30 overflow-clip"
      style={{ background: "rgb(var(--bg-base))" }}
    >
      <div className="absolute inset-0">
        <div className="absolute opacity-60" style={{ left: "-5%", top: "-5%", width: "13.75%", height: "13.75%", transform: "scale(8)", transformOrigin: "0 0", filter: "blur(9px)" }}>
          <GameCover game={game} eager />
        </div>
        <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgb(var(--bg-base) / 0.97) 0%, rgb(var(--bg-base) / 0.85) 45%, rgb(var(--bg-base) / 0.55) 100%)" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(0deg, rgb(var(--bg-base)) 0%, transparent 40%)" }} />
      </div>

      <div className="relative h-full flex items-center gap-[4vw] px-[6vw] pb-[14vh] pt-[8vh]">
        <motion.div
          initial={{ opacity: 0, x: -30, rotate: -2 }}
          animate={{ opacity: 1, x: 0, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 24 }}
          className="shrink-0 w-[clamp(220px,22vw,420px)] aspect-[3/4] rounded-[28px] overflow-hidden ring-1 ring-white/15 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.9)]"
        >
          <GameCover game={game} eager large />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="flex-1 min-w-0"
        >
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span className="px-3 py-1 rounded-full bg-white/10 text-[14px] font-semibold text-white/80">{PLATFORM_LABELS[game.platform]}</span>
            {status && game.status !== "none" && (
              <span className="flex items-center gap-2 px-3 py-1 rounded-full text-[14px] font-semibold" style={{ background: `${status.color}26`, color: status.color }}>
                <span className="w-2 h-2 rounded-full" style={{ background: status.color }} />{status.label}
              </span>
            )}
            {game.not_installed && <span className="px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 text-[14px] font-semibold">Not installed</span>}
            {running && (
              <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[14px] font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Running
              </span>
            )}
          </div>
          <h1 className="text-[clamp(36px,4.6vw,84px)] font-bold leading-[1] text-white line-clamp-2">{displayName(game.name)}</h1>

          <div className="grid grid-cols-4 gap-4 mt-8 max-w-[900px]">
            {[
              { icon: <ClockIcon size={18} />, label: "Play time", value: game.playtime_mins > 0 ? formatPlaytime(game.playtime_mins) : "—" },
              running
                ? { icon: <PlayIcon size={16} />, label: "This session", value: <SessionClock className="tabular-nums text-emerald-200" /> }
                : { icon: <PlayIcon size={16} />, label: "Last played", value: game.last_played ? timeAgo(game.last_played) : "Never" },
              { icon: <StarIcon size={17} filled />, label: "Your rating", value: game.rating !== null ? `${game.rating} / 10` : "Unrated" },
              { icon: <CheckIcon size={17} />, label: game.hltb_main_mins ? "Time to beat" : "Added", value: game.hltb_main_mins ? `${Math.round(game.hltb_main_mins / 6) / 10}h` : formatDate(game.date_added) },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl px-5 py-4 bg-white/[0.06] border border-white/[0.08]">
                <div className="flex items-center gap-2 text-white/50 text-[13px] font-semibold">{s.icon}{s.label}</div>
                <p className="text-[22px] font-semibold text-white mt-1.5 truncate">{s.value}</p>
              </div>
            ))}
          </div>

          {(game.description || game.developer) && (
            <p className="text-[17px] leading-relaxed text-white/65 mt-7 max-w-[900px] line-clamp-3">
              {game.description || [game.developer, game.publisher, game.release_year].filter(Boolean).join(" · ")}
            </p>
          )}

          <div data-bp-row className="flex flex-wrap items-center gap-3 mt-10">
            {running ? (
              <BpButton danger onClick={onStop} autofocus className="min-w-[200px]"><StopIcon size={20} /> Stop Game</BpButton>
            ) : (
              <BpButton primary onClick={onPlay} autofocus className="min-w-[200px]"><PlayIcon size={20} /> {game.not_installed && game.platform === "steam" ? "Install" : "Play"}</BpButton>
            )}
            <BpButton onClick={onFavorite}><HeartIcon size={20} filled={game.is_favorite} className={game.is_favorite ? "text-pink-400" : ""} />{game.is_favorite ? "Favorited" : "Favorite"}</BpButton>
            <BpButton onClick={onStatus}><span className="w-3 h-3 rounded-full" style={{ background: status?.color ?? "#64748b" }} />{status && game.status !== "none" ? status.label : "Set Status"}</BpButton>
            <BpButton onClick={onRate}><StarIcon size={20} filled={game.rating !== null} className="text-amber-300" />Rate</BpButton>
            <BpButton onClick={onClose}><CloseIcon size={18} />Back</BpButton>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

export function Picker<T extends string | number>({ title, options, value, onPick, columns = 1 }: {
  title: string;
  options: { value: T; label: string; color?: string }[];
  value: T | null;
  onPick: (v: T) => void;
  columns?: number;
}) {
  return (
    <div data-bp-scope className="absolute inset-0 z-50 flex items-center justify-center overflow-clip" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(10px)" }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className="rounded-[28px] p-8 min-w-[480px] border border-white/10"
        style={{ background: "linear-gradient(180deg, rgba(30,30,42,0.98), rgba(16,16,24,0.98))" }}
      >
        <h2 className="text-[28px] font-bold text-white mb-6">{title}</h2>
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {options.map((o, i) => {
            const active = o.value === value;
            return (
              <button
                key={String(o.value)}
                tabIndex={-1}
                data-bp-focusable
                data-bp-autofocus={active || (value === null && i === 0) || undefined}
                onClick={() => onPick(o.value)}
                className={cn(
                  "bp-focusable bp-btn relative h-16 rounded-2xl px-6 flex items-center gap-4 text-[19px] font-semibold",
                  columns > 1 && "justify-center px-0",
                  active ? "bg-white text-black" : "bg-white/[0.07] text-white border border-white/10"
                )}
              >
                {o.color && <span className="w-3.5 h-3.5 rounded-full" style={{ background: o.color }} />}
                <span className="flex-1 text-left" style={columns > 1 ? { textAlign: "center" } : undefined}>{o.label}</span>
                {active && columns === 1 && <CheckIcon size={20} />}
              </button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}

const KEY_ROWS = [
  "1234567890".split(""),
  "qwertyuiop".split(""),
  "asdfghjkl'".split(""),
  "zxcvbnm-:.".split(""),
];

export function OnScreenKeyboard({ query, onKey, onBackspace, onClear, onDone }: {
  query: string;
  onKey: (k: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onDone: () => void;
}) {
  return (
    <div data-bp-scope className="absolute inset-0 z-50 flex flex-col justify-end overflow-clip" style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.5) 60%, rgba(0,0,0,0.2) 100%)" }}>
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="mx-auto mb-[12vh] w-[min(980px,90vw)] rounded-[28px] p-7 border border-white/10"
        style={{ background: "linear-gradient(180deg, rgba(32,32,44,0.98), rgba(18,18,26,0.98))", boxShadow: "0 40px 100px -20px rgba(0,0,0,0.9)" }}
      >
        <div className="flex items-center gap-4 h-16 px-5 rounded-2xl bg-black/40 border border-white/10 mb-6">
          <SearchIcon size={24} className="text-accent-300 shrink-0" />
          <span className="flex-1 text-[26px] font-semibold text-white truncate">
            {query || <span className="text-white/30">Search your library…</span>}
            <span className="inline-block w-[3px] h-7 bg-accent-300 ml-1 align-middle animate-pulse" />
          </span>
        </div>
        <div className="flex flex-col gap-2.5">
          {KEY_ROWS.map((row, ri) => (
            <div key={ri} data-bp-row className="grid grid-cols-10 gap-2.5">
              {row.map((k) => (
                <button
                  key={k}
                  tabIndex={-1}
                  data-bp-focusable
                  data-bp-autofocus={k === "q" || undefined}
                  onClick={() => onKey(k)}
                  className="bp-focusable bp-tile relative h-14 rounded-xl bg-white/[0.07] text-[22px] font-semibold text-white uppercase"
                >
                  {k}
                </button>
              ))}
            </div>
          ))}
          <div data-bp-row className="grid grid-cols-10 gap-2.5">
            <button tabIndex={-1} data-bp-focusable onClick={onClear} className="bp-focusable bp-tile relative col-span-2 h-14 rounded-xl bg-white/[0.07] text-[17px] font-semibold text-white/80">Clear</button>
            <button tabIndex={-1} data-bp-focusable onClick={() => onKey(" ")} className="bp-focusable bp-tile relative col-span-4 h-14 rounded-xl bg-white/[0.07] text-[17px] font-semibold text-white/80">Space</button>
            <button tabIndex={-1} data-bp-focusable onClick={onBackspace} className="bp-focusable bp-tile relative col-span-2 h-14 rounded-xl bg-white/[0.07] text-[17px] font-semibold text-white/80">⌫ Delete</button>
            <button tabIndex={-1} data-bp-focusable onClick={onDone} className="bp-focusable bp-tile relative col-span-2 h-14 rounded-xl text-[17px] font-bold text-white" style={{ background: "rgb(var(--accent-600))" }}>Done</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export function MenuPanel({ sound, fullscreen, autostart, controllerName, onResume, onScan, onToggleSound, onToggleFullscreen, onToggleAutostart, onExit, onQuit }: {
  sound: boolean;
  fullscreen: boolean;
  autostart: boolean;
  controllerName: string | null;
  onResume: () => void;
  onScan: () => void;
  onToggleSound: () => void;
  onToggleFullscreen: () => void;
  onToggleAutostart: () => void;
  onExit: () => void;
  onQuit: () => void;
}) {
  const item = (icon: React.ReactNode, label: string, onClick: () => void, opts: { value?: string; autofocus?: boolean; danger?: boolean } = {}) => (
    <button
      tabIndex={-1}
      data-bp-focusable
      data-bp-autofocus={opts.autofocus || undefined}
      onClick={onClick}
      className={cn(
        "bp-focusable bp-tile relative w-full h-16 rounded-2xl px-5 flex items-center gap-4 text-[19px] font-semibold text-left",
        opts.danger ? "text-red-300" : "text-white"
      )}
    >
      <span className="w-10 h-10 rounded-xl bg-white/[0.07] flex items-center justify-center shrink-0">{icon}</span>
      <span className="flex-1">{label}</span>
      {opts.value && <span className={cn("text-[15px] font-bold px-3 py-1 rounded-full", opts.value === "On" ? "bg-accent-500/30 text-accent-100" : "bg-white/10 text-white/50")}>{opts.value}</span>}
    </button>
  );

  return (
    <div data-bp-scope className="absolute inset-0 z-50 flex justify-end overflow-clip" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}>
      <motion.div
        initial={{ x: 80, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="h-full w-[min(520px,90vw)] px-8 pt-8 pb-28 flex flex-col gap-2 border-l border-white/10"
        style={{ background: "linear-gradient(180deg, rgba(26,26,36,0.98), rgba(12,12,18,0.99))" }}
      >
        <div className="flex items-center gap-4 mb-6 mt-2">
          <Logo size={56} />
          <div className="min-w-0">
            <p className="text-[24px] font-bold text-white leading-tight">ZGameLib</p>
            <p className="text-[14px] text-white/50 truncate">{controllerName ?? "No controller detected"}</p>
          </div>
        </div>
        {item(<PlayIcon size={18} />, "Resume", onResume, { autofocus: true })}
        {item(<ScanIcon size={18} />, "Scan for Games", onScan)}
        <div className="h-px bg-white/10 my-3" />
        {item(<VolumeIcon size={19} muted={!sound} />, "Interface Sounds", onToggleSound, { value: sound ? "On" : "Off" })}
        {item(<MaximizeIcon size={18} />, "Fullscreen", onToggleFullscreen, { value: fullscreen ? "On" : "Off" })}
        {item(<TvIcon size={19} />, "Start in Big Picture", onToggleAutostart, { value: autostart ? "On" : "Off" })}
        <div className="flex-1" />
        {item(<CloseIcon size={18} />, "Exit Big Picture", onExit)}
        {item(<PowerIcon size={19} />, "Quit ZGameLib", onQuit, { danger: true })}
      </motion.div>
    </div>
  );
}

export function ConfirmDialog({ title, confirmLabel, onConfirm, onCancel }: { title: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div data-bp-scope className="absolute inset-0 z-[60] flex items-center justify-center overflow-clip" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(10px)" }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-[28px] p-9 w-[min(640px,90vw)] border border-white/10"
        style={{ background: "linear-gradient(180deg, rgba(32,32,44,0.98), rgba(18,18,26,0.98))" }}
      >
        <p className="text-[26px] font-semibold text-white leading-snug">{title}</p>
        <div data-bp-row className="flex gap-4 mt-9">
          <BpButton onClick={onCancel} className="flex-1">Cancel</BpButton>
          <BpButton primary autofocus onClick={onConfirm} className="flex-1">{confirmLabel}</BpButton>
        </div>
      </motion.div>
    </div>
  );
}

export function LaunchSplash({ game }: { game: Game }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-[70] flex flex-col items-center justify-center gap-8"
      style={{ background: "rgb(var(--bg-base) / 0.92)", backdropFilter: "blur(20px)" }}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 18 }}
        className="w-[clamp(180px,16vw,300px)] aspect-[3/4] rounded-[26px] overflow-hidden ring-1 ring-white/20"
        style={{ boxShadow: "0 30px 80px -20px rgba(0,0,0,0.9)" }}
      >
        <GameCover game={game} eager large />
      </motion.div>
      <div className="text-center">
        <p className="text-[16px] font-bold text-accent-200">Launching</p>
        <p className="text-[40px] font-bold text-white mt-2">{displayName(game.name)}</p>
      </div>
      <div className="w-[280px] h-1.5 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: "rgb(var(--accent-500))" }}
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    </motion.div>
  );
}
