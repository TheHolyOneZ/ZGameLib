import { useEffect, useRef } from "react";
import { useGameStore } from "@/store/useGameStore";
import GameGrid from "@/components/library/GameGrid";
import PageSearch from "@/components/layout/PageSearch";
import PageHeader from "@/components/ui/PageHeader";
import ScrollToTop from "@/components/ui/ScrollToTop";
import { HeartIcon } from "@/components/ui/Icons";

export default function Favorites() {
  const setFilter = useGameStore((s) => s.setFilter);
  const count = useGameStore((s) => s.games.filter((g) => g.is_favorite).length);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFilter("favoritesOnly", true);
    return () => setFilter("favoritesOnly", false);
  }, [setFilter]);

  return (
    <div className="h-full flex flex-col page-enter">
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        <PageHeader
          icon={<HeartIcon size={22} filled />}
          tint="#ec4899"
          title="Favorites"
          subtitle={count === 0 ? "The games you love most, all in one place" : `${count} game${count !== 1 ? "s" : ""} you love the most`}
        />
        <PageSearch sticky hideFavoriteFilter />
        <GameGrid />
      </div>
      <ScrollToTop scrollRef={scrollRef} />
    </div>
  );
}
