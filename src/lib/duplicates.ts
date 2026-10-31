import type { Game, GameStatus } from "./types";
import { canonicalKey, cleanTitle, normalizeText, levenshtein, variantKind, type VariantKind } from "./gameName";

export type DuplicateReason = "same-id" | "same-path" | "exact" | "edition" | "variant" | "similar";

export interface DuplicateGroup {
  key: string;
  games: Game[];
  keeperId: string;
  reason: DuplicateReason;
  confidence: number;
}

const IGNORE_KEY = "zgamelib-dup-ignored";

function pairKey(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function loadIgnoredPairs(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(IGNORE_KEY) ?? "[]") as string[]); } catch { return new Set(); }
}

export function ignoreGroup(ids: string[]) {
  const set = loadIgnoredPairs();
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) set.add(pairKey(ids[i], ids[j]));
  try { localStorage.setItem(IGNORE_KEY, JSON.stringify([...set])); } catch {}
}

export function clearIgnoredPairs() {
  try { localStorage.removeItem(IGNORE_KEY); } catch {}
}

const REASON_RANK: Record<DuplicateReason, number> = { "same-id": 0, "same-path": 1, exact: 2, edition: 3, variant: 4, similar: 5 };
const REASON_CONFIDENCE: Record<DuplicateReason, number> = { "same-id": 1, "same-path": 0.98, exact: 0.97, edition: 0.9, variant: 0.75, similar: 0.7 };

const VARIANT_PENALTY: Record<VariantKind, number> = { game: 0, test: 60, demo: 80, extra: 120, tool: 120 };

const STATUS_RANK: Record<string, number> = { completed: 5, playing: 4, on_hold: 3, backlog: 2, dropped: 1, none: 0 };

export function keeperScore(g: Game): number {
  let s = 0;
  if (!g.not_installed) s += 40;
  if (g.exe_path || g.steam_app_id || g.epic_app_name || g.ubisoft_game_id) s += 15;
  if (g.platform !== "custom") s += 10;
  s -= VARIANT_PENALTY[variantKind(g.name)];
  s += Math.min(30, Math.log2(1 + g.playtime_mins) * 3);
  if (g.cover_path) s += 8;
  if (g.rating !== null) s += 5;
  if (g.is_favorite) s += 5;
  if (g.is_pinned) s += 3;
  if (g.genre || g.developer) s += 3;
  if (cleanTitle(g.name) === g.name) s += 2;
  return s;
}

function pickKeeper(games: Game[]): string {
  return [...games].sort((a, b) => keeperScore(b) - keeperScore(a) || (a.date_added ?? "").localeCompare(b.date_added ?? ""))[0].id;
}

function numbersOf(key: string) {
  return (key.match(/\d+/g) ?? []).join(",");
}

function normPath(p: string | null) {
  return p ? p.replace(/[\\/]+/g, "/").replace(/\/$/, "").toLowerCase() : null;
}

export function findDuplicateGroups(games: Game[], ignored: Set<string> = loadIgnoredPairs()): DuplicateGroup[] {
  const live = games.filter((g) => !g.deleted_at);
  const n = live.length;
  const parent = live.map((_, i) => i);
  const reasonOf = new Map<number, DuplicateReason>();
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (a: number, b: number, reason: DuplicateReason) => {
    if (ignored.has(pairKey(live[a].id, live[b].id))) return;
    const ra = find(a), rb = find(b);
    const cands = [reason, reasonOf.get(ra), reasonOf.get(rb)].filter((r): r is DuplicateReason => !!r);
    const weakest = cands.sort((x, y) => REASON_RANK[y] - REASON_RANK[x])[0];
    if (ra !== rb) parent[rb] = ra;
    reasonOf.set(ra, weakest);
  };

  const keys = live.map((g) => canonicalKey(g.name));
  const raw = live.map((g) => normalizeText(g.name));
  const kinds = live.map((g) => variantKind(g.name));

  const bucket = <T,>(get: (i: number) => T | null, cb: (idxs: number[]) => void) => {
    const m = new Map<T, number[]>();
    for (let i = 0; i < n; i++) {
      const k = get(i);
      if (k === null || k === "" || k === undefined) continue;
      const arr = m.get(k);
      if (arr) arr.push(i); else m.set(k, [i]);
    }
    for (const idxs of m.values()) if (idxs.length > 1) cb(idxs);
  };

  bucket((i) => live[i].steam_app_id, (idxs) => idxs.slice(1).forEach((j) => union(idxs[0], j, "same-id")));
  bucket((i) => live[i].epic_app_name, (idxs) => idxs.slice(1).forEach((j) => union(idxs[0], j, "same-id")));
  bucket((i) => normPath(live[i].exe_path), (idxs) => idxs.slice(1).forEach((j) => union(idxs[0], j, "same-path")));

  bucket((i) => keys[i], (idxs) => {
    for (let a = 0; a < idxs.length; a++) {
      for (let b = a + 1; b < idxs.length; b++) {
        const i = idxs[a], j = idxs[b];
        const reason: DuplicateReason = kinds[i] !== kinds[j] ? "variant" : raw[i] === raw[j] ? "exact" : "edition";
        union(i, j, reason);
      }
    }
  });

  const byFirst = new Map<string, number[]>();
  for (let i = 0; i < n; i++) {
    const k = keys[i];
    if (k.length < 5) continue;
    const f = k[0];
    const arr = byFirst.get(f);
    if (arr) arr.push(i); else byFirst.set(f, [i]);
  }
  for (const idxs of byFirst.values()) {
    for (let a = 0; a < idxs.length; a++) {
      const i = idxs[a];
      const ki = keys[i];
      const ni = numbersOf(ki);
      for (let b = a + 1; b < idxs.length; b++) {
        const j = idxs[b];
        const kj = keys[j];
        if (ki === kj || find(i) === find(j)) continue;
        if (Math.abs(ki.length - kj.length) > Math.max(2, Math.floor(ki.length * 0.12))) continue;
        if (numbersOf(kj) !== ni) continue;
        const li = ki.replace(/\s/g, ""), lj = kj.replace(/\s/g, "");
        if (li === lj) { union(i, j, "edition"); continue; }
        const maxDist = li.length >= 16 ? 3 : li.length >= 9 ? 2 : 1;
        if (levenshtein(li, lj, maxDist) <= maxDist) union(i, j, "similar");
      }
    }
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    const arr = groups.get(r);
    if (arr) arr.push(i); else groups.set(r, [i]);
  }

  const out: DuplicateGroup[] = [];
  for (const [root, idxs] of groups) {
    if (idxs.length < 2) continue;
    const gs = idxs.map((i) => live[i]);
    const reason = reasonOf.get(root) ?? "similar";
    out.push({
      key: gs.map((g) => g.id).sort().join("|"),
      games: gs.sort((a, b) => keeperScore(b) - keeperScore(a)),
      keeperId: pickKeeper(gs),
      reason,
      confidence: REASON_CONFIDENCE[reason],
    });
  }
  return out.sort((a, b) => REASON_RANK[a.reason] - REASON_RANK[b.reason] || cleanTitle(a.games[0].name).localeCompare(cleanTitle(b.games[0].name)));
}

export function mergedFields(keeper: Game, others: Game[]) {
  const all = [keeper, ...others];
  const tags = [...new Set(all.flatMap((g) => g.tags))];
  const ratings = all.map((g) => g.rating).filter((r): r is number => r !== null);
  const status = all.reduce<GameStatus>((best, g) => ((STATUS_RANK[g.status] ?? 0) > (STATUS_RANK[best] ?? 0) ? g.status : best), keeper.status);
  const customFields = Object.assign({}, ...others.map((g) => g.custom_fields), keeper.custom_fields) as Record<string, string>;
  return {
    id: keeper.id,
    tags,
    rating: ratings.length ? Math.max(...ratings) : undefined,
    status,
    is_favorite: all.some((g) => g.is_favorite) || undefined,
    playtime_mins: all.reduce((a, g) => a + g.playtime_mins, 0),
    description: keeper.description ?? others.find((g) => g.description)?.description ?? undefined,
    genre: keeper.genre ?? others.find((g) => g.genre)?.genre ?? undefined,
    developer: keeper.developer ?? others.find((g) => g.developer)?.developer ?? undefined,
    publisher: keeper.publisher ?? others.find((g) => g.publisher)?.publisher ?? undefined,
    release_year: keeper.release_year ?? others.find((g) => g.release_year)?.release_year ?? undefined,
    cover_path: keeper.cover_path ?? others.find((g) => g.cover_path)?.cover_path ?? undefined,
    custom_fields: customFields,
  };
}

export const REASON_LABEL: Record<DuplicateReason, { label: string; hint: string }> = {
  "same-id": { label: "Same store ID", hint: "Both entries point at the same store product" },
  "same-path": { label: "Same executable", hint: "Both entries launch the same file" },
  exact: { label: "Identical name", hint: "Names match once spacing, symbols and case are ignored" },
  edition: { label: "Edition or version", hint: "Same game with a different edition, version or build in the name" },
  variant: { label: "Demo / test build", hint: "A demo, playtest or extra alongside the full game" },
  similar: { label: "Very similar name", hint: "Names differ by a typo or small spelling difference — check before merging" },
};
