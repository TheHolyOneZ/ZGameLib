import { useGameStore } from "@/store/useGameStore";
import { timeAgo } from "@/lib/utils";
import { ClockIcon } from "@/components/ui/Icons";
import Shelf, { ShelfCard } from "./Shelf";

export default function RecentlyPlayed() {
  const games = useGameStore((s) => s.games);
  const recent = [...games]
    .filter((g) => g.last_played)
    .sort((a, b) => (b.last_played! > a.last_played! ? 1 : -1))
    .slice(1, 16);
  if (recent.length === 0) return null;
  return (
    <Shelf title="Recently Played" icon={<ClockIcon size={13} />} storageKey="section_recentlyplayed_open">
      {recent.map((g, i) => <ShelfCard key={g.id} game={g} sub={timeAgo(g.last_played)} index={i} />)}
    </Shelf>
  );
}
