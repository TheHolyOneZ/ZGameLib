import { useRef } from "react";
import { useGames } from "@/hooks/useGames";
import { useGameStore } from "@/store/useGameStore";
import GameGrid from "@/components/library/GameGrid";
import RecentlyPlayed from "@/components/library/RecentlyPlayed";
import PinnedRow from "@/components/library/PinnedRow";
import LibraryHero from "@/components/library/LibraryHero";
import Recommendations from "@/components/library/Recommendations";
import PageSearch from "@/components/layout/PageSearch";
import ScrollToTop from "@/components/ui/ScrollToTop";

export default function Library() {
  const { isLoading } = useGames();
  const scrollRef = useRef<HTMLDivElement>(null);
  const search = useGameStore((s) => s.search);
  const filters = useGameStore((s) => s.filters);
  const filterRules = useGameStore((s) => s.filterRules);
  const browsing =
    search.trim() !== "" ||
    filters.platform !== "all" ||
    filters.status !== "all" ||
    filters.favoritesOnly ||
    filters.minRating > 0 ||
    filters.tags.length > 0 ||
    filters.hasCover !== null ||
    filters.notInstalledOnly ||
    filterRules.length > 0;

  return (
    <div className="h-full flex flex-col">
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        {!browsing && (
          <>
            <LibraryHero />
            <PinnedRow />
            <Recommendations />
            <RecentlyPlayed />
          </>
        )}
        <PageSearch sticky title={browsing ? "Results" : "All Games"} />
        <GameGrid isLoading={isLoading} />
      </div>
      <ScrollToTop scrollRef={scrollRef} />
    </div>
  );
}
