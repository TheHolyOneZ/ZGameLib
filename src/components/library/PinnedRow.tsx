import { useGameStore } from "@/store/useGameStore";
import { PinIcon } from "@/components/ui/Icons";
import Shelf, { ShelfCard } from "./Shelf";

export default function PinnedRow() {
  const games = useGameStore((s) => s.games);
  const pinned = games.filter((g) => g.is_pinned);
  if (pinned.length === 0) return null;
  return (
    <Shelf title="Pinned" icon={<PinIcon size={13} filled />} storageKey="section_pinned_open" count={pinned.length}>
      {pinned.map((g, i) => <ShelfCard key={g.id} game={g} index={i} />)}
    </Shelf>
  );
}
