import { displayName } from "@/lib/gameName";
import { motion } from "framer-motion";
import { cn, formatPlaytime, timeAgo } from "@/lib/utils";
import { useUIStore } from "@/store/useUIStore";
import type { Game } from "@/lib/types";
import { useGameStore } from "@/store/useGameStore";
import { useGames } from "@/hooks/useGames";
import { api } from "@/lib/tauri";
import { useLaunchGame } from "@/lib/useLaunchGame";
import Badge from "@/components/ui/Badge";
import PlatformBadge from "@/components/ui/PlatformBadge";
import GameContextMenu from "@/components/ui/GameContextMenu";
import GameCover from "@/components/ui/GameCover";
import { HeartIcon, PlayIcon, FolderIcon, StarIcon, CheckIcon } from "@/components/ui/Icons";

export default function GameListRow({ game, collectionId, onRemoveFromCollection }: { game: Game; collectionId?: string; onRemoveFromCollection?: () => void }) {
  const setSelectedGameId = useGameStore((s) => s.setSelectedGameId);
  const setDetailOpen = useUIStore((s) => s.setDetailOpen);
  const addToast = useUIStore((s) => s.addToast);
  const customStatuses = useUIStore((s) => s.customStatuses);
  const running = useUIStore((s) => s.activeGameId === game.id);
  const { toggleFavorite } = useGames();
  const { launch } = useLaunchGame();
  const isSelected = useGameStore((s) => s.selectedIds.includes(game.id));
  const anySelected = useGameStore((s) => s.selectedIds.length > 0);
  const toggleSelected = useGameStore((s) => s.toggleSelected);
  const sc = customStatuses.find((s) => s.key === game.status);

  return (
    <GameContextMenu game={game} collectionId={collectionId} onRemoveFromCollection={onRemoveFromCollection}>
      <motion.div
        layout="position"
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        onClick={() => { if (anySelected) toggleSelected(game.id); else { setSelectedGameId(game.id); setDetailOpen(true); } }}
        className={cn(
          "group flex items-center gap-4 px-3 py-2 cursor-pointer rounded-xl border transition-colors duration-200",
          isSelected ? "border-accent-500/40 bg-accent-500/[0.08]" : "border-transparent hover:bg-white/[0.035] hover:border-white/[0.05]"
        )}
      >
        <button
          className={cn("shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all", isSelected ? "bg-accent-500 border-accent-400 opacity-100" : "border-white/30 opacity-0 group-hover:opacity-100", anySelected && !isSelected && "opacity-60")}
          onClick={(e) => { e.stopPropagation(); toggleSelected(game.id); }}
          aria-label={isSelected ? "Deselect" : "Select"}
        >
          {isSelected && <CheckIcon size={10} className="text-white" />}
        </button>
        <div className={cn("w-10 h-[52px] rounded-lg overflow-hidden shrink-0 ring-1", running ? "ring-2 ring-emerald-400" : "ring-white/[0.07]")}>
          <GameCover game={game} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[13.5px] font-medium text-slate-100 truncate group-hover:text-white transition-colors">{displayName(game.name)}</p>
          <div className="flex items-center gap-2 mt-1">
            <PlatformBadge platform={game.platform} />
            {running && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide bg-emerald-500/20 text-emerald-300">PLAYING</span>}
            {game.not_installed && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide bg-white/[0.05] border border-white/10 text-slate-400">Not Installed</span>
            )}
            {sc && game.status !== "none" && (
              <span className="text-[11px] font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sc.color }} />
                <span style={{ color: sc.color }}>{sc.label}</span>
              </span>
            )}
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-1 min-w-0 w-40 flex-wrap">
          {game.tags.slice(0, 3).map((t) => (
            <Badge key={t} className="text-[10px] normal-case tracking-normal">{t}</Badge>
          ))}
        </div>

        <span className="hidden md:block text-[12px] text-slate-500 w-24 text-right shrink-0 tabular-nums">
          {game.last_played ? timeAgo(game.last_played) : "—"}
        </span>

        <span className="hidden md:block text-[12px] text-slate-400 w-20 text-right shrink-0 tabular-nums">
          {game.playtime_mins > 0 ? formatPlaytime(game.playtime_mins) : "—"}
        </span>

        <div className="flex items-center gap-1 w-14 justify-end shrink-0">
          {game.rating !== null ? (
            <>
              <StarIcon size={11} filled className={game.rating >= 8 ? "text-amber-300" : "text-accent-400"} />
              <span className="text-[12.5px] text-slate-200 font-semibold tabular-nums">{game.rating}</span>
            </>
          ) : (
            <span className="text-[12px] text-slate-600">—</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 w-[104px] justify-end">
          <button
            onClick={(e) => { e.stopPropagation(); toggleFavorite(game.id); }}
            className={cn("btn-icon w-8 h-8 transition-opacity", game.is_favorite ? "!text-pink-400 opacity-100" : "opacity-0 group-hover:opacity-100")}
            title="Favorite"
          >
            <HeartIcon size={13} filled={game.is_favorite} />
          </button>
          <button
            onClick={async (e) => { e.stopPropagation(); try { await api.openGameFolder(game.id); } catch (err) { addToast(String(err), "error"); } }}
            className="btn-icon w-8 h-8 opacity-0 group-hover:opacity-100"
            title="Open folder"
          >
            <FolderIcon size={13} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); launch(game); }}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: "linear-gradient(180deg, rgb(var(--accent-400)), rgb(var(--accent-600)))" }}
            title="Play"
          >
            <PlayIcon size={12} className="ml-0.5" />
          </button>
        </div>
      </motion.div>
    </GameContextMenu>
  );
}
