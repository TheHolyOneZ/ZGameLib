import * as gameActions from "@/lib/gameActions";
import { displayName } from "@/lib/gameName";
import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn, formatPlaytime, timeAgo } from "@/lib/utils";
import type { Game } from "@/lib/types";
import { useGameStore } from "@/store/useGameStore";
import { useUIStore } from "@/store/useUIStore";
import { api } from "@/lib/tauri";
import { useLaunchGame } from "@/lib/useLaunchGame";
import GameContextMenu from "@/components/ui/GameContextMenu";
import GameCover from "@/components/ui/GameCover";
import { PLATFORM_ICONS } from "@/components/ui/PlatformBadge";
import { HeartIcon, PlayIcon, FolderIcon, StarIcon, AlertIcon, CheckIcon, DownloadIcon } from "@/components/ui/Icons";

interface GameCardProps {
  game: Game;
  subtitle?: string;
  collectionId?: string;
  onRemoveFromCollection?: () => void;
}

function GameCard({ game, subtitle, collectionId, onRemoveFromCollection }: GameCardProps) {
  const setSelectedGameId = useGameStore((s) => s.setSelectedGameId);
  const setDetailOpen = useUIStore((s) => s.setDetailOpen);
  const addToast = useUIStore((s) => s.addToast);
  const activeGameId = useUIStore((s) => s.activeGameId);
  const customStatuses = useUIStore((s) => s.customStatuses);
  const toggleFavorite = gameActions.toggleFavorite;
  const { launch } = useLaunchGame();
  const isSelected = useGameStore((s) => s.selectedIds.includes(game.id));
  const anySelected = useGameStore((s) => s.selectedIds.length > 0);
  const toggleSelected = useGameStore((s) => s.toggleSelected);

  const { data: appSettings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings(),
    staleTime: 5 * 60 * 1000,
  });
  const showPlaytime = appSettings?.show_playtime_on_cards ?? true;

  const { data: missingExe } = useQuery({
    queryKey: ["missing-exe"],
    queryFn: async () => new Set(await api.getMissingExeIds()),
    staleTime: 5 * 60 * 1000,
  });
  const exeMissing = !!game.exe_path && !!missingExe?.has(game.id);
  const running = activeGameId === game.id;
  const statusConfig = customStatuses.find((s) => s.key === game.status);
  const PlatformIcon = PLATFORM_ICONS[game.platform];

  const openDetail = () => {
    if (anySelected) { toggleSelected(game.id); return; }
    setSelectedGameId(game.id);
    setDetailOpen(true);
  };

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const meta = subtitle
    ?? (showPlaytime && game.playtime_mins > 0
      ? formatPlaytime(game.playtime_mins)
      : game.last_played
        ? timeAgo(game.last_played)
        : "Not played yet");

  return (
    <GameContextMenu game={game} collectionId={collectionId} onRemoveFromCollection={onRemoveFromCollection}>
      <div
        onClick={openDetail}
        tabIndex={0}
        role="button"
        aria-label={game.name}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDetail(); } }}
        className="group relative cursor-pointer outline-none"
      >
        <div
          className={cn(
            "relative aspect-[3/4] rounded-xl overflow-hidden card-lift bg-bg-elevated",
            isSelected && "ring-2 ring-white",
            "group-focus-visible:ring-2 group-focus-visible:ring-white"
          )}
        >
          <GameCover
            game={game}
            imgClassName={cn("transition-transform duration-700 ease-out group-hover:scale-[1.06]", game.not_installed && "grayscale-[0.6] opacity-80")}
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/25 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

          <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-1.5 z-10">
            <div className="flex items-center gap-1.5">
              <button
                onClick={(e) => { stop(e); toggleSelected(game.id); }}
                className={cn(
                  "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all duration-200",
                  isSelected ? "bg-white border-white opacity-100" : "border-white/60 bg-black/40 backdrop-blur opacity-0 group-hover:opacity-100",
                  anySelected && !isSelected && "opacity-70"
                )}
                aria-label={isSelected ? "Deselect" : "Select"}
              >
                {isSelected && <CheckIcon size={12} className="text-black" />}
              </button>
              {exeMissing && !game.not_installed && (
                <span className="w-6 h-6 rounded-lg bg-amber-500/25 border border-amber-400/40 backdrop-blur flex items-center justify-center" title="Executable not found">
                  <AlertIcon size={12} className="text-amber-300" />
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {game.rating !== null && (
                <span className="flex items-center gap-1 px-1.5 h-6 rounded-lg bg-black/55 backdrop-blur text-[11px] font-bold text-white tabular-nums group-hover:opacity-0 transition-opacity">
                  <StarIcon size={10} filled className={game.rating >= 8 ? "text-amber-300" : "text-accent-300"} />
                  {game.rating}
                </span>
              )}
              <button
                onClick={(e) => { stop(e); toggleFavorite(game.id); }}
                className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center backdrop-blur transition-all duration-200",
                  game.is_favorite ? "bg-pink-500/25 text-pink-300 opacity-100" : "bg-black/55 text-white/80 hover:text-pink-300 opacity-0 group-hover:opacity-100"
                )}
                title={game.is_favorite ? "Remove from favorites" : "Add to favorites"}
              >
                <HeartIcon size={13} filled={game.is_favorite} />
              </button>
            </div>
          </div>

          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 z-10 pointer-events-none">
            <button
              onClick={(e) => { stop(e); launch(game); }}
              className="pointer-events-auto w-12 h-12 rounded-full flex items-center justify-center bg-white text-black scale-90 group-hover:scale-100 hover:scale-105 transition-transform duration-200 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.8)]"
              title={game.not_installed ? "Install" : "Play"}
              aria-label={`Play ${game.name}`}
            >
              {game.not_installed ? <DownloadIcon size={20} /> : <PlayIcon size={20} className="ml-0.5" />}
            </button>
          </div>

          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between z-10">
            {running ? (
              <span className="flex items-center gap-1.5 px-2 h-6 rounded-lg bg-black/70 backdrop-blur text-[11px] font-semibold text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Playing
              </span>
            ) : (
              <span className="w-6 h-6 rounded-lg bg-black/55 backdrop-blur flex items-center justify-center text-white/80" title={game.platform}>
                {PlatformIcon && <PlatformIcon size={12} />}
              </span>
            )}
            {game.not_installed ? (
              <span className="px-2 h-6 flex items-center rounded-lg bg-black/65 backdrop-blur text-[11px] font-semibold text-slate-200">Not installed</span>
            ) : (
              <button
                onClick={async (e) => { stop(e); try { await api.openGameFolder(game.id); } catch (err) { addToast(String(err), "error"); } }}
                className="w-6 h-6 rounded-lg bg-black/55 backdrop-blur flex items-center justify-center text-white/80 hover:text-accent-200 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Open folder"
              >
                <FolderIcon size={12} />
              </button>
            )}
          </div>
        </div>

        <div className="pt-2.5 px-0.5">
          <p className="text-[13px] font-semibold text-slate-100 truncate leading-tight group-hover:text-white">{displayName(game.name)}</p>
          <div className="flex items-center gap-1.5 mt-1 min-w-0">
            {statusConfig && game.status !== "none" && (
              <>
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: statusConfig.color }} />
                <span className="text-[11px] font-medium shrink-0" style={{ color: statusConfig.color }}>{statusConfig.label}</span>
                <span className="text-slate-700 text-[11px]">·</span>
              </>
            )}
            <span className="text-[11px] text-slate-500 truncate tabular-nums">{meta}</span>
          </div>
        </div>
      </div>
    </GameContextMenu>
  );
}

export default memo(GameCard);
