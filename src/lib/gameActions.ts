import { api } from "./tauri";
import { useGameStore } from "@/store/useGameStore";
import { useUIStore } from "@/store/useUIStore";
import type { Game, UpdateGamePayload } from "./types";

const seq = new Map<string, number>();

function bump(id: string) {
  const n = (seq.get(id) ?? 0) + 1;
  seq.set(id, n);
  return n;
}

function isLatest(id: string, n: number) {
  return seq.get(id) === n;
}

function current(id: string) {
  return useGameStore.getState().games.find((g) => g.id === id);
}

function apply(id: string, patch: Partial<Game>) {
  const g = current(id);
  if (g) useGameStore.getState().updateGame({ ...g, ...patch });
}

async function resync(id: string) {
  try {
    const fresh = await api.getGame(id);
    if (fresh) useGameStore.getState().updateGame(fresh);
  } catch {}
}

function fail(e: unknown) {
  useUIStore.getState().addToast(String(e), "error");
}

export function updateGame(payload: UpdateGamePayload, opts?: { onSuccess?: (g: Game) => void }) {
  const n = bump(payload.id);
  const patch: Partial<Game> = {};
  for (const [k, v] of Object.entries(payload)) if (v !== undefined && k !== "id") (patch as Record<string, unknown>)[k] = v;
  apply(payload.id, patch);
  return api.updateGame(payload).then(
    (game) => {
      if (isLatest(payload.id, n)) useGameStore.getState().updateGame(game);
      opts?.onSuccess?.(game);
      return game;
    },
    (e) => {
      fail(e);
      if (isLatest(payload.id, n)) resync(payload.id);
      throw e;
    }
  ).catch(() => undefined);
}

export function toggleFavorite(id: string) {
  const g = current(id);
  if (!g) return;
  const n = bump(id);
  apply(id, { is_favorite: !g.is_favorite });
  api.toggleFavorite(id).then(
    (v) => { if (isLatest(id, n)) apply(id, { is_favorite: v }); },
    (e) => { fail(e); if (isLatest(id, n)) resync(id); }
  );
}

export function togglePinned(id: string) {
  const g = current(id);
  if (!g) return;
  const n = bump(id);
  apply(id, { is_pinned: !g.is_pinned });
  api.togglePinned(id).then(
    (v) => { if (isLatest(id, n)) apply(id, { is_pinned: v }); },
    (e) => { fail(e); if (isLatest(id, n)) resync(id); }
  );
}

export function addTag(id: string, tag: string) {
  const g = current(id);
  const t = tag.trim().toLowerCase();
  if (!g || !t || g.tags.includes(t)) return;
  return updateGame({ id, tags: [...g.tags, t] });
}

export function removeTag(id: string, tag: string) {
  const g = current(id);
  if (!g || !g.tags.includes(tag)) return;
  return updateGame({ id, tags: g.tags.filter((x) => x !== tag) });
}

export function moveToTrash(id: string) {
  const g = current(id);
  bump(id);
  useGameStore.getState().removeGame(id);
  useGameStore.setState((s) => ({ selectedIds: s.selectedIds.filter((x) => x !== id) }));
  api.deleteGame(id).then(
    () => useUIStore.getState().addToast("Game moved to trash", "info"),
    (e) => {
      fail(e);
      if (g) useGameStore.getState().addGame(g);
    }
  );
}
