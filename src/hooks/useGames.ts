import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/tauri";
import { useGameStore } from "@/store/useGameStore";
import { useUIStore } from "@/store/useUIStore";
import type { UpdateGamePayload, CreateGamePayload, FilterRule } from "@/lib/types";
import { parseQuery, scoreGame } from "@/lib/search";
import { compareNames } from "@/lib/gameName";
import { findDuplicateGroups } from "@/lib/duplicates";

export function useGames() {
  const setGames = useGameStore((s) => s.setGames);
  const updateGameInStore = useGameStore((s) => s.updateGame);
  const removeFromStore = useGameStore((s) => s.removeGame);
  const addToStore = useGameStore((s) => s.addGame);
  const addToast = useUIStore((s) => s.addToast);
  const qc = useQueryClient();

  const { isLoading } = useQuery({
    queryKey: ["games"],
    queryFn: async () => {
      const [games, settings] = await Promise.all([api.getAllGames(), api.getSettings()]);
      setGames(games);
      if (settings.custom_statuses?.length > 0) {
        useUIStore.getState().setCustomStatuses(settings.custom_statuses);
      }
      return games;
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateGamePayload) => api.updateGame(payload),
    onSuccess: (game) => {
      updateGameInStore(game);
      qc.invalidateQueries({ queryKey: ["games"] });
    },
    onError: (e) => addToast(String(e), "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteGame(id),
    onSuccess: (_, id) => {
      removeFromStore(id);
      addToast("Game moved to trash", "info");
    },
    onError: (e) => addToast(String(e), "error"),
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateGamePayload) => api.createGame(payload),
    onSuccess: (game) => {
      addToStore(game);
      addToast(`"${game.name}" added to library`);
    },
    onError: (e) => addToast(String(e), "error"),
  });

  const toggleFavMutation = useMutation({
    mutationFn: (id: string) => api.toggleFavorite(id),
    onSuccess: (isFav, id) => {
      const games = useGameStore.getState().games;
      const game = games.find((g) => g.id === id);
      if (game) updateGameInStore({ ...game, is_favorite: isFav });
    },
  });

  const togglePinnedMutation = useMutation({
    mutationFn: (id: string) => api.togglePinned(id),
    onSuccess: (isPinned, id) => {
      const games = useGameStore.getState().games;
      const game = games.find((g) => g.id === id);
      if (game) updateGameInStore({ ...game, is_pinned: isPinned });
    },
  });

  return {
    isLoading,
    update: updateMutation.mutate,
    remove: deleteMutation.mutate,
    create: createMutation.mutate,
    toggleFavorite: toggleFavMutation.mutate,
    togglePinned: togglePinnedMutation.mutate,
  };
}

export function useScan() {
  const setGames = useGameStore((s) => s.setGames);
  const addToast = useUIStore((s) => s.addToast);
  const setScanning = useUIStore((s) => s.setScanning);
  const qc = useQueryClient();

  const scanMutation = useMutation({
    mutationFn: () => api.scanAll(),
    onMutate: () => setScanning(true),
    onSuccess: (result) => {
      setScanning(false);
      addToast(
        result.added > 0
          ? `Scan complete — ${result.added} new game${result.added !== 1 ? "s" : ""} found`
          : "Scan complete — no new games found",
        result.added > 0 ? "success" : "info"
      );
      qc.invalidateQueries({ queryKey: ["games"] });
    },
    onError: (e) => {
      setScanning(false);
      addToast(String(e), "error");
    },
  });

  return { scan: scanMutation.mutate, isScanning: scanMutation.isPending };
}

export function usePullUninstalled() {
  const addToast = useUIStore((s) => s.addToast);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const settings = await api.getSettings();
      const apiKey = settings.steam_api_key;
      const steamId = settings.steam_id_64;
      if (!apiKey || !steamId) throw new Error("Steam API Key and SteamID64 must be set in Settings to pull uninstalled games.");
      return api.pullUninstalledSteamGames(apiKey, steamId);
    },
    onSuccess: (result) => {
      addToast(
        result.added > 0
          ? `Pulled ${result.added} uninstalled Steam game${result.added !== 1 ? "s" : ""}`
          : "No new uninstalled Steam games found",
        result.added > 0 ? "success" : "info"
      );
      qc.invalidateQueries({ queryKey: ["games"] });
    },
    onError: (e) => addToast(String(e), "error"),
  });

  return { pullUninstalled: mutation.mutate, isPulling: mutation.isPending };
}

function matchesRule(game: import("@/lib/types").Game, rule: FilterRule): boolean {
  switch (rule.field) {
    case "platform":
      if (rule.operator === "=") return game.platform === rule.value;
      if (rule.operator === "!=") return game.platform !== rule.value;
      return true;
    case "status":
      if (rule.operator === "=") return game.status === rule.value;
      if (rule.operator === "!=") return game.status !== rule.value;
      return true;
    case "rating": {
      const rating = game.rating ?? -1;
      const val = parseFloat(rule.value);
      if (isNaN(val)) return true;
      if (rule.operator === "=") return rating === val;
      if (rule.operator === "!=") return rating !== val;
      if (rule.operator === ">=") return rating >= val;
      if (rule.operator === "<=") return rating <= val;
      return true;
    }
    case "playtime": {
      const val = parseFloat(rule.value);
      if (isNaN(val)) return true;
      if (rule.operator === ">=") return game.playtime_mins >= val;
      if (rule.operator === "<=") return game.playtime_mins <= val;
      return true;
    }
    case "tags":
      if (rule.operator === "contains") return game.tags.includes(rule.value);
      if (rule.operator === "not_contains") return !game.tags.includes(rule.value);
      return true;
    case "date_added":
      if (rule.operator === ">=") return game.date_added >= rule.value;
      if (rule.operator === "<=") return game.date_added <= rule.value;
      return true;
    case "is_favorite":
      if (rule.operator === "=") return game.is_favorite === (rule.value === "true");
      if (rule.operator === "!=") return game.is_favorite !== (rule.value === "true");
      return true;
    case "has_cover": {
      const hasCover = game.cover_path !== null;
      if (rule.operator === "=") return hasCover === (rule.value === "true");
      if (rule.operator === "!=") return hasCover !== (rule.value === "true");
      return true;
    }
    case "not_installed":
      if (rule.operator === "=") return game.not_installed === (rule.value === "true");
      if (rule.operator === "!=") return game.not_installed !== (rule.value === "true");
      return true;
    default:
      return true;
  }
}

export function useDuplicateGroups() {
  const games = useGameStore((s) => s.games);
  const hiddenIds = useGameStore((s) => s.hiddenIds);
  const version = useGameStore((s) => s.duplicateVersion);
  return useMemo(() => {
    if (hiddenIds.length === 0) return findDuplicateGroups(games);
    const hidden = new Set(hiddenIds);
    return findDuplicateGroups(games.filter((g) => !hidden.has(g.id)));
  }, [games, hiddenIds, version]);
}

export function useLibraryGames() {
  const games = useGameStore((s) => s.games);
  const hiddenIds = useGameStore((s) => s.hiddenIds);
  const collapse = useGameStore((s) => s.collapseDuplicates);
  const groups = useDuplicateGroups();
  return useMemo(() => {
    const drop = new Set(hiddenIds);
    if (collapse) for (const g of groups) if (g.reason !== "similar") for (const x of g.games) if (x.id !== g.keeperId) drop.add(x.id);
    return drop.size ? games.filter((g) => !drop.has(g.id)) : games;
  }, [games, hiddenIds, collapse, groups]);
}

export function useFilteredGames() {
  const games = useGameStore((s) => s.games);
  const search = useGameStore((s) => s.search);
  const searchScope = useGameStore((s) => s.searchScope);
  const sortKey = useGameStore((s) => s.sortKey);
  const sortAsc = useGameStore((s) => s.sortAsc);
  const filters = useGameStore((s) => s.filters);
  const hiddenIds = useGameStore((s) => s.hiddenIds);
  const showHidden = useGameStore((s) => s.showHidden);
  const filterRules = useGameStore((s) => s.filterRules);
  const filterLogic = useGameStore((s) => s.filterLogic);
  const collapseDuplicates = useGameStore((s) => s.collapseDuplicates);
  const dupGroups = useDuplicateGroups();

  return useMemo(() => {
    let result = [...games];
    if (!showHidden && hiddenIds.length > 0) {
      const hiddenSet = new Set(hiddenIds);
      result = result.filter((g) => !hiddenSet.has(g.id));
    }
    if (collapseDuplicates && dupGroups.length > 0) {
      const extras = new Set<string>();
      const visible = new Set(result.map((g) => g.id));
      for (const grp of dupGroups) {
        if (grp.reason === "similar") continue;
        const keeper = visible.has(grp.keeperId) ? grp.keeperId : grp.games.find((g) => visible.has(g.id))?.id;
        for (const g of grp.games) if (g.id !== keeper) extras.add(g.id);
      }
      result = result.filter((g) => !extras.has(g.id));
    }

    if (filters.platform !== "all") result = result.filter((g) => g.platform === filters.platform);
    if (filters.status !== "all") result = result.filter((g) => g.status === filters.status);
    if (filters.favoritesOnly) result = result.filter((g) => g.is_favorite);
    if (filters.minRating > 0) result = result.filter((g) => g.rating !== null && g.rating >= filters.minRating);
    if (filters.tags.length > 0) result = result.filter((g) => filters.tags.every((t) => g.tags.includes(t)));
    if (filters.dateAddedFrom) result = result.filter((g) => g.date_added >= filters.dateAddedFrom!);
    if (filters.dateAddedTo) result = result.filter((g) => g.date_added <= filters.dateAddedTo!);
    if (filters.hasCover === true) result = result.filter((g) => g.cover_path !== null);
    if (filters.hasCover === false) result = result.filter((g) => g.cover_path === null);
    if (filters.notInstalledOnly) result = result.filter((g) => g.not_installed);

    if (filterRules.length > 0) {
      const active = filterRules.filter((r) => r.value !== "");
      if (active.length > 0) {
        result = result.filter((g) => (filterLogic === "and" ? active.every((rule) => matchesRule(g, rule)) : active.some((rule) => matchesRule(g, rule))));
      }
    }

    const parsed = parseQuery(search);
    const scores = new Map<string, number>();
    if (!parsed.isEmpty && !parsed.error) {
      const deep = searchScope === "all";
      result = result.filter((g) => {
        const sc = scoreGame(g, parsed, deep);
        if (sc > 0) scores.set(g.id, sc);
        return sc > 0;
      });
    }
    const byRelevance = scores.size > 0 && parsed.terms.length > 0 && sortKey === "name";

    const dir = sortAsc ? 1 : -1;
    result.sort((a, b) => {
      if (byRelevance) {
        const d = (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0);
        if (Math.abs(d) > 0.01) return d;
      }
      switch (sortKey) {
        case "name": return dir * compareNames(a.name, b.name);
        case "rating": return dir * ((a.rating ?? -1) - (b.rating ?? -1)) || compareNames(a.name, b.name);
        case "last_played": return dir * (a.last_played ?? "").localeCompare(b.last_played ?? "") || compareNames(a.name, b.name);
        case "date_added": return dir * a.date_added.localeCompare(b.date_added) || compareNames(a.name, b.name);
        case "playtime_mins": return dir * (a.playtime_mins - b.playtime_mins) || compareNames(a.name, b.name);
        case "sort_order": return dir * (a.sort_order - b.sort_order);
      }
      return 0;
    });

    return result;
  }, [games, search, searchScope, sortKey, sortAsc, filters, hiddenIds, showHidden, filterRules, filterLogic, collapseDuplicates, dupGroups]);
}
