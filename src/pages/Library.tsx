import { useGames } from "@/hooks/useGames";
import GameGrid from "@/components/library/GameGrid";
import RecentlyPlayed from "@/components/library/RecentlyPlayed";
import PageSearch from "@/components/layout/PageSearch";

export default function Library() {
  useGames();
  return (
    <div className="h-full flex flex-col">
      <PageSearch />
      <div className="flex-1 min-h-0 overflow-y-auto">
        <RecentlyPlayed />
        <GameGrid />
      </div>
    </div>
  );
}
