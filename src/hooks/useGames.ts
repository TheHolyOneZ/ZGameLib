import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/tauri";
import { useGameStore } from "@/store/useGameStore";
import { useUIStore } from "@/store/useUIStore";
import type { UpdateGamePayload, CreateGamePayload, FilterRule, FilterLogic } from "@/lib/types";

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

  return useMemo(() => {
    let result = [...games];
    if (!showHidden && hiddenIds.length > 0) {
      const hiddenSet = new Set(hiddenIds);
      result = result.filter((g) => !hiddenSet.has(g.id));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      if (searchScope === "all") {
        result = result.filter((g) =>
          g.name.toLowerCase().includes(q) ||
          (g.description?.toLowerCase().includes(q) ?? false)
        );
      } else {
        result = result.filter((g) => g.name.toLowerCase().includes(q));
      }
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
      result = result.filter((g) => {
        if (filterLogic === "and") {
          return filterRules.every((rule) => matchesRule(g, rule));
        } else {
          return filterRules.some((rule) => matchesRule(g, rule));
        }
      });
    }

    result.sort((a, b) => {
      let av: number | string = "";
      let bv: number | string = "";
      switch (sortKey) {
        case "name": av = a.name.toLowerCase(); bv = b.name.toLowerCase(); break;
        case "rating": av = a.rating ?? -1; bv = b.rating ?? -1; break;
        case "last_played": av = a.last_played ?? ""; bv = b.last_played ?? ""; break;
        case "date_added": av = a.date_added; bv = b.date_added; break;
        case "playtime_mins": av = a.playtime_mins; bv = b.playtime_mins; break;
        case "sort_order": av = a.sort_order; bv = b.sort_order; break;
      }
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });

    return result;
  }, [games, search, searchScope, sortKey, sortAsc, filters, hiddenIds, showHidden, filterRules, filterLogic]);
}
