import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { useGameStore } from "@/store/useGameStore";
import { useUIStore } from "@/store/useUIStore";
import { api } from "@/lib/tauri";
import { cn, formatPlaytime, PLATFORM_LABELS } from "@/lib/utils";
import { findDuplicateGroups, mergedFields, ignoreGroup, clearIgnoredPairs, REASON_LABEL, type DuplicateGroup, type DuplicateReason } from "@/lib/duplicates";
import { cleanTitle, variantKind } from "@/lib/gameName";
import GameCover from "@/components/ui/GameCover";
import { CloseIcon, LayersIcon, CheckIcon, EyeOffIcon, TrashIcon, SparkleIcon, InfoIcon } from "@/components/ui/Icons";
import type { Game } from "@/lib/types";

const REASON_TONE: Record<DuplicateReason, string> = {
  "same-id": "#34d399",
  "same-path": "#34d399",
  exact: "#34d399",
  edition: "#60a5fa",
  variant: "#fbbf24",
  similar: "#f97316",
};

async function mergeOne(group: DuplicateGroup, keeperId: string) {
  const keeper = group.games.find((g) => g.id === keeperId)!;
  const others = group.games.filter((g) => g.id !== keeperId);
  await api.updateGame(mergedFields(keeper, others));
  for (const o of others) {
    const cols = await api.getCollectionsForGame(o.id).catch(() => []);
    for (const c of cols) await api.addGameToCollection(c.id, keeper.id).catch(() => {});
    await api.deleteGame(o.id);
  }
}

function EntryTile({ game, keeper, onPick }: { game: Game; keeper: boolean; onPick: () => void }) {
  const kind = variantKind(game.name);
  return (
    <button
      onClick={onPick}
      className={cn(
        "relative flex gap-3 p-2.5 rounded-2xl text-left transition-all min-w-0 flex-1 basis-[240px] border",
        keeper ? "bg-accent-500/[0.12] border-accent-400/60" : "bg-white/[0.025] border-white/[0.06] hover:border-white/15 opacity-80 hover:opacity-100"
      )}
    >
      <div className="w-12 h-16 rounded-lg overflow-hidden shrink-0 ring-1 ring-white/10">
        <GameCover game={game} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-medium text-slate-100 leading-snug line-clamp-2" title={game.name}>{game.name}</p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[11px] text-slate-400">
          <span>{PLATFORM_LABELS[game.platform]}</span>
          <span>{game.playtime_mins > 0 ? formatPlaytime(game.playtime_mins) : "Unplayed"}</span>
          {game.not_installed && <span className="text-amber-300/90">Not installed</span>}
          {kind !== "game" && <span className="text-amber-300/90 capitalize">{kind}</span>}
          {game.rating !== null && <span>★ {game.rating}</span>}
        </div>
      </div>
      <span className={cn(
        "absolute top-2 right-2 h-5 px-1.5 rounded-md text-[9.5px] font-bold tracking-wider flex items-center gap-1",
        keeper ? "bg-accent-500 text-white" : "bg-white/[0.06] text-slate-500"
      )}>
        {keeper ? <><CheckIcon size={9} /> KEEP</> : "EXTRA"}
      </span>
    </button>
  );
}

export default function DuplicatesModal() {
  const open = useUIStore((s) => s.duplicatesOpen);
  const setOpen = useUIStore((s) => s.setDuplicatesOpen);
  const addToast = useUIStore((s) => s.addToast);
  const openConfirm = useUIStore((s) => s.openConfirm);
  const games = useGameStore((s) => s.games);
  const hiddenIds = useGameStore((s) => s.hiddenIds);
  const hideGames = useGameStore((s) => s.hideGames);
  const version = useGameStore((s) => s.duplicateVersion);
  const bump = useGameStore((s) => s.bumpDuplicates);
  const collapse = useGameStore((s) => s.collapseDuplicates);
  const setCollapse = useGameStore((s) => s.setCollapseDuplicates);
  const qc = useQueryClient();

  const [reasonFilter, setReasonFilter] = useState<DuplicateReason | "all">("all");
  const [keepers, setKeepers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const groups = useMemo(() => {
    if (!open) return [];
    const hidden = new Set(hiddenIds);
    return findDuplicateGroups(games.filter((g) => !hidden.has(g.id)));
  }, [open, games, hiddenIds, version]);

  const counts = useMemo(() => {
    const c: Partial<Record<DuplicateReason, number>> = {};
    for (const g of groups) c[g.reason] = (c[g.reason] ?? 0) + 1;
    return c;
  }, [groups]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !progress && !useUIStore.getState().confirmDialog) { e.stopPropagation(); setOpen(false); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, progress, setOpen]);

  const visible = reasonFilter === "all" ? groups : groups.filter((g) => g.reason === reasonFilter);
  const extras = visible.reduce((a, g) => a + g.games.length - 1, 0);
  const keeperOf = (g: DuplicateGroup) => keepers[g.key] ?? g.keeperId;

  const refresh = async () => {
    const all = await api.getAllGames();
    useGameStore.getState().setGames(all);
    qc.invalidateQueries({ queryKey: ["games"] });
    qc.invalidateQueries({ queryKey: ["collections"] });
    qc.invalidateQueries({ queryKey: ["collection-games"] });
  };

  const merge = async (g: DuplicateGroup) => {
    setBusy(g.key);
    try {
      await mergeOne(g, keeperOf(g));
      await refresh();
      addToast(`Merged ${g.games.length} entries into "${cleanTitle(g.games.find((x) => x.id === keeperOf(g))!.name)}"`, "success");
    } catch (e) {
      addToast(String(e), "error");
    } finally {
      setBusy(null);
    }
  };

  const hideExtras = (g: DuplicateGroup) => {
    const k = keeperOf(g);
    hideGames(g.games.filter((x) => x.id !== k).map((x) => x.id));
    addToast(`Hid ${g.games.length - 1} duplicate${g.games.length > 2 ? "s" : ""}`, "info");
  };

  const notDuplicates = (g: DuplicateGroup) => {
    ignoreGroup(g.games.map((x) => x.id));
    bump();
  };

  const mergeAll = () => {
    openConfirm(
      `Merge ${visible.length} group${visible.length !== 1 ? "s" : ""}? The best copy of each game is kept and gets the combined playtime, rating, tags, favorite and collections. ${extras} extra entr${extras !== 1 ? "ies" : "y"} move to Trash, where you can restore them.`,
      async () => {
        setProgress({ done: 0, total: visible.length });
        let ok = 0;
        for (let i = 0; i < visible.length; i++) {
          try { await mergeOne(visible[i], keeperOf(visible[i])); ok++; } catch {}
          setProgress({ done: i + 1, total: visible.length });
        }
        await refresh();
        setProgress(null);
        addToast(`Merged ${ok} duplicate group${ok !== 1 ? "s" : ""}`, "success");
      },
      "Merge All"
    );
  };

  const hideAll = () => {
    const ids = visible.flatMap((g) => g.games.filter((x) => x.id !== keeperOf(g)).map((x) => x.id));
    hideGames(ids);
    addToast(`Hid ${ids.length} duplicate entr${ids.length !== 1 ? "ies" : "y"} — show them again from the library toolbar`, "info");
  };

  const reasons = (Object.keys(REASON_LABEL) as DuplicateReason[]).filter((r) => counts[r]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-8"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
          onClick={() => !progress && setOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="w-[980px] max-w-full h-[84vh] flex flex-col rounded-3xl overflow-hidden"
            style={{ background: "rgb(17 17 25)", border: "1px solid rgba(255,255,255,0.09)", boxShadow: "0 50px 120px -20px rgba(0,0,0,0.9)" }}
          >
            <div className="flex items-start gap-4 px-7 pt-6 pb-5 border-b border-white/[0.06]">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(140deg, rgb(var(--accent-500) / 0.35), rgb(var(--accent-700) / 0.1))", border: "1px solid rgb(var(--accent-400) / 0.3)" }}>
                <LayersIcon size={22} className="text-accent-200" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-[22px] font-bold text-white leading-tight">Duplicate Manager</h2>
                <p className="text-[13px] text-slate-400 mt-1">
                  {groups.length === 0
                    ? "Matches titles across stores, editions, versions, builds and typos."
                    : `${groups.length} game${groups.length !== 1 ? "s" : ""} found more than once · ${groups.reduce((a, g) => a + g.games.length - 1, 0)} extra entries`}
                </p>
              </div>
              <label className="flex items-center gap-2.5 text-[12.5px] text-slate-300 cursor-pointer select-none mt-1" title="Show only the best copy of each duplicated game in the library, without changing anything">
                <span>Collapse in library</span>
                <button
                  onClick={() => setCollapse(!collapse)}
                  className="relative w-10 h-[22px] rounded-full transition-colors"
                  style={{ background: collapse ? "rgb(var(--accent-500))" : "rgba(255,255,255,0.12)" }}
                >
                  <motion.span animate={{ x: collapse ? 20 : 2 }} transition={{ type: "spring", stiffness: 500, damping: 35 }} className="absolute top-[3px] w-4 h-4 rounded-full bg-white block" />
                </button>
              </label>
              <button onClick={() => setOpen(false)} disabled={!!progress} className="btn-icon"><CloseIcon size={14} /></button>
            </div>

            {groups.length > 0 && (
              <div className="flex items-center gap-2 px-7 py-3.5 border-b border-white/[0.06]">
                <div className="flex items-center gap-2 flex-1 min-w-0 overflow-x-auto scrollbar-none">
                <button onClick={() => setReasonFilter("all")} className={cn("chip !py-1 shrink-0", reasonFilter === "all" && "chip-active")}>All <span className="opacity-60">{groups.length}</span></button>
                {reasons.map((r) => (
                  <button key={r} onClick={() => setReasonFilter(r)} className={cn("chip !py-1 shrink-0", reasonFilter === r && "chip-active")} title={REASON_LABEL[r].hint}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: REASON_TONE[r] }} />
                    {REASON_LABEL[r].label} <span className="opacity-60">{counts[r]}</span>
                  </button>
                ))}
                </div>
                <button onClick={hideAll} disabled={!!progress || visible.length === 0} className="btn-ghost h-9 py-0 text-[12.5px] shrink-0"><EyeOffIcon size={13} /> Hide extras</button>
                <button onClick={mergeAll} disabled={!!progress || visible.length === 0} className="btn-primary h-9 py-0 text-[12.5px] shrink-0"><SparkleIcon size={13} /> Merge all {visible.length}</button>
              </div>
            )}

            {progress && (
              <div className="px-7 py-3 border-b border-white/[0.06]">
                <div className="flex justify-between text-[12px] text-slate-300 mb-1.5"><span>Merging duplicates…</span><span className="tabular-nums">{progress.done}/{progress.total}</span></div>
                <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <motion.div className="h-full bg-accent-500 rounded-full" animate={{ width: `${(progress.done / progress.total) * 100}%` }} />
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-7 py-5">
              {groups.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center gap-4">
                  <div className="w-20 h-20 rounded-3xl flex items-center justify-center bg-emerald-500/10 border border-emerald-400/25">
                    <CheckIcon size={34} className="text-emerald-300" />
                  </div>
                  <div>
                    <p className="text-[20px] font-semibold text-white">Your library is clean</p>
                    <p className="text-[13px] text-slate-400 mt-1 max-w-md">No duplicates found across stores, editions, versions or similar spellings.</p>
                  </div>
                  <button onClick={() => { clearIgnoredPairs(); bump(); }} className="text-[12px] text-slate-500 hover:text-slate-200">Re-check pairs you marked as "not duplicates"</button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <AnimatePresence initial={false}>
                    {visible.map((g) => {
                      const k = keeperOf(g);
                      const title = cleanTitle(g.games.find((x) => x.id === k)!.name);
                      return (
                        <motion.div
                          key={g.key}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: busy === g.key ? 0.5 : 1, y: 0 }}
                          exit={{ opacity: 0, height: 0, marginTop: 0, transition: { duration: 0.2 } }}
                          className="surface p-4"
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <p className="text-[15px] font-semibold text-white truncate">{title}</p>
                            <span
                              className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10.5px] font-semibold shrink-0"
                              style={{ background: `${REASON_TONE[g.reason]}1f`, color: REASON_TONE[g.reason] }}
                              title={REASON_LABEL[g.reason].hint}
                            >
                              {REASON_LABEL[g.reason].label}
                              <InfoIcon size={10} />
                            </span>
                            <span className="text-[11.5px] text-slate-500 shrink-0">{g.games.length} entries</span>
                            <div className="flex-1" />
                            <button onClick={() => notDuplicates(g)} disabled={!!busy || !!progress} className="text-[12px] text-slate-500 hover:text-slate-200 px-2">Not duplicates</button>
                            <button onClick={() => hideExtras(g)} disabled={!!busy || !!progress} className="btn-ghost h-8 py-0 px-3 text-[12px]"><EyeOffIcon size={12} /> Hide extras</button>
                            <button onClick={() => merge(g)} disabled={!!busy || !!progress} className="btn-primary h-8 py-0 px-3 text-[12px]">
                              {busy === g.key ? <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <CheckIcon size={12} />}
                              Merge
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {g.games.map((x) => (
                              <EntryTile key={x.id} game={x} keeper={x.id === k} onPick={() => setKeepers((s) => ({ ...s, [g.key]: x.id }))} />
                            ))}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {groups.length > 0 && (
              <div className="px-7 py-3 border-t border-white/[0.06] flex items-center gap-2 text-[11.5px] text-slate-500">
                <TrashIcon size={12} />
                Click an entry to choose which copy to keep. Merge combines playtime, rating, tags, status, favorite and collections into it and moves the rest to Trash (restorable in Settings).
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
