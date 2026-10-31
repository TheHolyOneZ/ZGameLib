import { useState, useMemo } from "react";
import { useGameStore } from "@/store/useGameStore";
import { SparkleIcon } from "@/components/ui/Icons";
import Shelf, { ShelfCard } from "./Shelf";

export default function Recommendations() {
  const games = useGameStore((s) => s.games);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const recommendations = useMemo(() => {
    const highRated = games.filter((g) => (g.rating ?? 0) >= 8);
    if (highRated.length < 3) return [];

    const tasteTags = new Set(highRated.flatMap((g) => g.tags));
    const tasteGenres = new Set(highRated.map((g) => g.genre).filter(Boolean) as string[]);

    const eligible = games.filter(
      (g) => (g.status === "none" || g.status === "backlog") && g.playtime_mins < 30
    );
    if (eligible.length < 3) return [];

    const scored = eligible.map((g) => {
      const tagMatches = g.tags.filter((t) => tasteTags.has(t)).length;
      const genreMatch = g.genre && tasteGenres.has(g.genre) ? 1 : 0;
      const score = tagMatches * 2 + genreMatch * 3;
      const daysOld = Math.floor((Date.now() - new Date(g.date_added).getTime()) / 86400000);
      return { game: g, score, tagMatches: tagMatches + genreMatch, daysOld };
    });

    return scored
      .sort((a, b) => b.score - a.score || b.daysOld - a.daysOld)
      .slice(0, 12);
  }, [games]);

  const visible = recommendations.filter((r) => !dismissed.has(r.game.id));

  if (visible.length === 0) return null;

  return (
    <Shelf title="Play Next" icon={<SparkleIcon size={13} />} storageKey="section_playnext_open" hint="Picked from the tags and genres of your top-rated games">
      {visible.map(({ game, tagMatches }, i) => (
        <ShelfCard
          key={game.id}
          game={game}
          index={i}
          sub={game.genre ?? (game.tags[0] ? `#${game.tags[0]}` : undefined)}
          onDismiss={() => setDismissed((s) => new Set([...s, game.id]))}
          badge={tagMatches > 0 ? (
            <span className="block text-center text-[9.5px] font-semibold px-1 py-0.5 rounded-md backdrop-blur" style={{ background: "rgb(var(--accent-600) / 0.85)", color: "white" }}>
              {tagMatches} match{tagMatches !== 1 ? "es" : ""}
            </span>
          ) : undefined}
        />
      ))}
    </Shelf>
  );
}
