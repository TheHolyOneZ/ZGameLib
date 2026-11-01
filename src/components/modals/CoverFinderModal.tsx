import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/tauri";
import { useGameStore } from "@/store/useGameStore";
import { useUIStore } from "@/store/useUIStore";
import { useLibraryGames } from "@/hooks/useGames";
import { clearCoverCache } from "@/hooks/useCover";
import { cn, PLATFORM_LABELS } from "@/lib/utils";
import { displayName } from "@/lib/gameName";
import { buildQuery, compileRule, loadRules, loadSceneCleanup, saveRules, saveSceneCleanup, RULE_PRESETS, type QueryRule } from "@/lib/coverQuery";
import type { CoverResult, Game } from "@/lib/types";
import GameCover from "@/components/ui/GameCover";
import VirtualGrid from "@/components/library/VirtualGrid";
import CoverCandidateTile from "./CoverCandidate";
import { CloseIcon, ImageIcon, PlusIcon, TrashIcon, SearchIcon, CheckIcon, SparkleIcon, ChevronDownIcon } from "@/components/ui/Icons";

type Status = "idle" | "queued" | "searching" | "found" | "none" | "error" | "applied";
interface Row {
  query: string | null;
  status: Status;
  results: CoverResult[];
  pick: string | null;
  include: boolean;
}
type Scope = "missing" | "selected" | "all";

const CONFIDENT = 70;
const CONCURRENCY = 3;

function Switch({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="relative w-9 h-5 rounded-full transition-colors shrink-0 disabled:opacity-40"
      style={{ background: on ? "rgb(var(--accent-500))" : "rgba(255,255,255,0.12)" }}
    >
      <motion.span animate={{ x: on ? 18 : 2 }} transition={{ type: "spring", stiffness: 500, damping: 35 }} className="absolute top-[3px] w-[14px] h-[14px] rounded-full bg-white block" />
    </button>
  );
}

const STATUS_LABEL: Record<Status, { text: string; tone: string }> = {
  idle: { text: "Ready", tone: "text-slate-500" },
  queued: { text: "Queued", tone: "text-slate-400" },
  searching: { text: "Searching…", tone: "text-accent-300" },
  found: { text: "Match found", tone: "text-emerald-300" },
  none: { text: "No match", tone: "text-amber-300" },
  error: { text: "Error", tone: "text-red-300" },
  applied: { text: "Applied", tone: "text-emerald-300" },
};

export default function CoverFinderModal() {
  const state = useUIStore((s) => s.coverFinder);
  const close = useUIStore((s) => s.closeCoverFinder);
  return <AnimatePresence>{state.open && <Finder key="finder" presetIds={state.ids} onClose={close} />}</AnimatePresence>;
}

function Finder({ presetIds, onClose }: { presetIds: string[] | null; onClose: () => void }) {
  const library = useLibraryGames();
  const addToast = useUIStore((s) => s.addToast);
  const [scope, setScope] = useState<Scope>(presetIds?.length ? "selected" : "missing");
  const [rules, setRules] = useState<QueryRule[]>(loadRules);
  const [scene, setScene] = useState(loadSceneCleanup);
  const [providers, setProviders] = useState<Record<string, boolean>>({ steam: true, steamgriddb: true, igdb: true });
  const [confidentOnly, setConfidentOnly] = useState(true);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [running, setRunning] = useState(false);
  const [applying, setApplying] = useState<{ done: number; total: number } | null>(null);
  const [rulesOpen, setRulesOpen] = useState(rules.length > 0);
  const stopRef = useRef(false);

  const { data: sgdbKey } = useQuery({ queryKey: ["setting", "steamgriddb_api_key"], queryFn: () => api.getSetting("steamgriddb_api_key").catch(() => null) });
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: () => api.getSettings(), staleTime: 5 * 60 * 1000 });
  const hasSgdb = !!sgdbKey?.trim();
  const hasIgdb = !!(settings?.igdb_client_id && settings?.igdb_client_secret);

  useEffect(() => { saveRules(rules); }, [rules]);
  useEffect(() => { saveSceneCleanup(scene); }, [scene]);

  const scoped = useMemo(() => {
    let list: Game[];
    if (scope === "selected" && presetIds) {
      const ids = new Set(presetIds);
      list = library.filter((g) => ids.has(g.id));
    } else if (scope === "missing") {
      list = library.filter((g) => !g.cover_path);
    } else {
      list = library;
    }
    return [...list].sort((a, b) => displayName(a.name).localeCompare(displayName(b.name)));
  }, [library, scope, presetIds]);

  const autoQuery = useCallback((g: Game) => buildQuery(g.name, rules, scene), [rules, scene]);
  const rowOf = (g: Game): Row => rows[g.id] ?? { query: null, status: "idle", results: [], pick: null, include: true };
  const queryOf = (g: Game) => rowOf(g).query ?? autoQuery(g);

  const patch = (id: string, p: Partial<Row>) =>
    setRows((r) => ({ ...r, [id]: { ...(r[id] ?? { query: null, status: "idle", results: [], pick: null, include: true }), ...p } }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !applying && !useUIStore.getState().confirmDialog) { e.stopPropagation(); stopRef.current = true; onClose(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [applying, onClose]);

  useEffect(() => () => { stopRef.current = true; }, []);

  const activeProviders = Object.entries(providers)
    .filter(([k, v]) => v && (k !== "steamgriddb" || hasSgdb) && (k !== "igdb" || hasIgdb))
    .map(([k]) => k);

  const searchOne = async (g: Game) => {
    const q = queryOf(g);
    patch(g.id, { status: "searching" });
    try {
      const res = await api.searchCoverArt(q, activeProviders);
      const best = res[0];
      const pick = best && (!confidentOnly || best.score >= CONFIDENT) ? best.url : null;
      patch(g.id, { status: res.length ? "found" : "none", results: res, pick });
    } catch {
      patch(g.id, { status: "error" });
    }
  };

  const searchAll = async () => {
    const targets = scoped.filter((g) => rowOf(g).include && rowOf(g).status !== "applied");
    if (!targets.length) return;
    stopRef.current = false;
    setRunning(true);
    setRows((r) => {
      const n = { ...r };
      for (const g of targets) n[g.id] = { ...(n[g.id] ?? { query: null, results: [], pick: null, include: true }), status: "queued" } as Row;
      return n;
    });
    let i = 0;
    const worker = async () => {
      while (!stopRef.current && i < targets.length) {
        const g = targets[i++];
        await searchOne(g);
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    setRows((r) => {
      const n = { ...r };
      for (const g of targets) if (n[g.id]?.status === "queued") n[g.id] = { ...n[g.id], status: "idle" };
      return n;
    });
    setRunning(false);
  };

  const picked = scoped.filter((g) => { const r = rowOf(g); return r.include && r.pick && r.status !== "applied"; });

  const applyAll = async () => {
    if (!picked.length) return;
    setApplying({ done: 0, total: picked.length });
    let ok = 0;
    for (let k = 0; k < picked.length; k++) {
      const g = picked[k];
      const r = rowOf(g);
      try {
        const path = await api.applyCoverUrl(g.id, r.pick!);
        if (g.cover_path) clearCoverCache(g.cover_path);
        const cur = useGameStore.getState().games.find((x) => x.id === g.id);
        if (cur) useGameStore.getState().updateGame({ ...cur, cover_path: path });
        patch(g.id, { status: "applied" });
        ok++;
      } catch (e) {
        patch(g.id, { status: "error" });
      }
      setApplying({ done: k + 1, total: picked.length });
    }
    setApplying(null);
    addToast(`Applied ${ok} cover${ok !== 1 ? "s" : ""}${ok < picked.length ? ` · ${picked.length - ok} failed` : ""}`, ok ? "success" : "error");
  };

  const counts = useMemo(() => {
    let found = 0, none = 0, applied = 0;
    for (const g of scoped) {
      const s = rows[g.id]?.status;
      if (s === "found") found++;
      else if (s === "none" || s === "error") none++;
      else if (s === "applied") applied++;
    }
    return { found, none, applied };
  }, [rows, scoped]);

  const searchedCount = counts.found + counts.none + counts.applied;
  const missingCount = library.filter((g) => !g.cover_path).length;

  const addRule = (preset?: Omit<QueryRule, "id" | "enabled">) => {
    setRules((r) => [...r, { id: crypto.randomUUID(), pattern: preset?.pattern ?? "", replace: preset?.replace ?? "", flags: preset?.flags ?? "gi", enabled: true }]);
    setRulesOpen(true);
  };

  const sample = scoped.slice(0, 3);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, pointerEvents: "none" }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget && !applying) { stopRef.current = true; onClose(); } }}
    >
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98, pointerEvents: "none" }}
        transition={{ type: "spring", stiffness: 360, damping: 32 }}
        className="w-[1180px] max-w-full h-[88vh] flex flex-col rounded-3xl overflow-hidden"
        style={{ background: "rgb(16 16 24)", border: "1px solid rgba(255,255,255,0.09)", boxShadow: "0 50px 120px -20px rgba(0,0,0,0.9)" }}
      >
        <div className="flex items-center gap-4 px-7 pt-6 pb-5 border-b border-white/[0.06]">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.06)" }}>
            <ImageIcon size={22} className="text-accent-200" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[22px] font-bold text-white leading-tight">Cover Art Finder</h2>
            <p className="text-[13px] text-slate-400 mt-0.5">Clean up names with smart rules or your own regex, search several art sources at once, review, apply.</p>
          </div>
          <div className="flex items-center rounded-xl p-1 gap-0.5 bg-white/[0.04] border border-white/[0.07]">
            {([
              ["missing", `Missing covers · ${missingCount}`],
              ...(presetIds?.length ? [["selected", `Selected · ${presetIds.length}`] as const] : []),
              ["all", `Whole library · ${library.length}`],
            ] as [Scope, string][]).map(([k, label]) => (
              <button key={k} onClick={() => setScope(k)} disabled={running || !!applying} className={cn("px-3 h-8 rounded-lg text-[12px] font-medium transition-colors", scope === k ? "bg-accent-500 text-white" : "text-slate-400 hover:text-white")}>
                {label}
              </button>
            ))}
          </div>
          <button onClick={() => { stopRef.current = true; onClose(); }} disabled={!!applying} className="btn-icon"><CloseIcon size={14} /></button>
        </div>

        <div className="flex-1 min-h-0 flex">
          <aside className="w-[340px] shrink-0 border-r border-white/[0.06] overflow-y-auto p-5 flex flex-col gap-6">
            <section>
              <p className="section-label !text-[10px] mb-3">Name cleanup</p>
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <p className="text-[13px] text-slate-100">Scene & repack cleanup</p>
                  <p className="text-[11.5px] text-slate-500 mt-0.5 leading-snug">Turns dots and underscores into spaces and removes group tags, repack labels, versions, builds and languages.</p>
                </div>
                <Switch on={scene} onChange={setScene} />
              </div>

              <button onClick={() => setRulesOpen((v) => !v)} className="w-full flex items-center gap-2 mt-4 text-[12.5px] text-slate-300 hover:text-white">
                <span className="flex-1 text-left font-medium">Custom regex rules {rules.length > 0 && <span className="text-slate-500">· {rules.filter((r) => r.enabled).length} active</span>}</span>
                <ChevronDownIcon size={11} className={cn("transition-transform text-slate-500", rulesOpen && "rotate-180")} />
              </button>
              <AnimatePresence initial={false}>
                {rulesOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="flex flex-col gap-2 pt-3">
                      {rules.map((r) => {
                        const compiled = compileRule(r);
                        const err = r.pattern && typeof compiled === "string" ? compiled : null;
                        return (
                          <div key={r.id} className={cn("rounded-xl p-2.5 border", err ? "border-red-500/40 bg-red-500/[0.05]" : "border-white/[0.07] bg-white/[0.025]", !r.enabled && "opacity-50")}>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-slate-500 w-11">Find</span>
                              <input
                                value={r.pattern}
                                onChange={(e) => setRules((rs) => rs.map((x) => (x.id === r.id ? { ...x, pattern: e.target.value } : x)))}
                                placeholder="regex, e.g. \.|_"
                                spellCheck={false}
                                className="flex-1 min-w-0 h-7 px-2 rounded-md bg-black/30 border border-white/10 text-[11.5px] font-mono text-slate-100 outline-none focus:border-accent-400/60"
                              />
                              <input
                                value={r.flags}
                                onChange={(e) => setRules((rs) => rs.map((x) => (x.id === r.id ? { ...x, flags: e.target.value } : x)))}
                                title="Flags (g, i, m, u)"
                                spellCheck={false}
                                className="w-9 h-7 px-1.5 rounded-md bg-black/30 border border-white/10 text-[11.5px] font-mono text-slate-300 text-center outline-none"
                              />
                            </div>
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <span className="text-[10px] text-slate-500 w-11">Replace</span>
                              <input
                                value={r.replace}
                                onChange={(e) => setRules((rs) => rs.map((x) => (x.id === r.id ? { ...x, replace: e.target.value } : x)))}
                                placeholder="(empty = remove), $1 for groups"
                                spellCheck={false}
                                className="flex-1 min-w-0 h-7 px-2 rounded-md bg-black/30 border border-white/10 text-[11.5px] font-mono text-slate-100 outline-none focus:border-accent-400/60"
                              />
                              <Switch on={r.enabled} onChange={(v) => setRules((rs) => rs.map((x) => (x.id === r.id ? { ...x, enabled: v } : x)))} />
                              <button onClick={() => setRules((rs) => rs.filter((x) => x.id !== r.id))} className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:text-red-300 hover:bg-red-500/10"><TrashIcon size={12} /></button>
                            </div>
                            {err && <p className="text-[10.5px] text-red-300 mt-1.5">{err}</p>}
                          </div>
                        );
                      })}
                      <button onClick={() => addRule()} className="flex items-center justify-center gap-1.5 h-8 rounded-xl text-[12px] text-slate-300 hover:text-white border border-dashed border-white/15 hover:border-accent-400/40">
                        <PlusIcon size={12} /> Add rule
                      </button>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {RULE_PRESETS.map((p) => (
                          <button key={p.label} onClick={() => addRule(p.rule)} className="chip !py-1 !text-[10.5px]">{p.label}</button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {sample.length > 0 && (
                <div className="mt-4 rounded-xl bg-black/25 border border-white/[0.06] p-3 flex flex-col gap-2">
                  <p className="text-[12px] text-slate-500 font-semibold">Preview</p>
                  {sample.map((g) => (
                    <div key={g.id} className="text-[11.5px] leading-snug">
                      <p className="text-slate-500 truncate font-mono">{g.name}</p>
                      <p className="text-slate-100 truncate">→ {autoQuery(g)}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <p className="section-label !text-[10px] mb-3">Art sources</p>
              <div className="flex flex-col gap-3">
                {[
                  { key: "steam", label: "Steam", hint: "Store and community search · portrait library art", available: true },
                  { key: "steamgriddb", label: "SteamGridDB", hint: hasSgdb ? "Huge community library — best for new, indie and non-Steam games" : "Add a free API key in Settings → Integrations", available: hasSgdb },
                  { key: "igdb", label: "IGDB", hint: hasIgdb ? "Official box art from IGDB" : "Add IGDB credentials in Settings → Integrations", available: hasIgdb },
                ].map((p) => (
                  <div key={p.key} className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-[13px]", p.available ? "text-slate-100" : "text-slate-500")}>{p.label}</p>
                      <p className="text-[11.5px] text-slate-500 leading-snug">{p.hint}</p>
                    </div>
                    <Switch on={p.available && providers[p.key]} disabled={!p.available} onChange={(v) => setProviders((s) => ({ ...s, [p.key]: v }))} />
                  </div>
                ))}
              </div>
            </section>

            <section>
              <p className="section-label !text-[10px] mb-3">Auto-pick</p>
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <p className="text-[13px] text-slate-100">Only pick confident matches</p>
                  <p className="text-[11.5px] text-slate-500 leading-snug">Games whose best result doesn't clearly match the name are left for you to choose.</p>
                </div>
                <Switch on={confidentOnly} onChange={setConfidentOnly} />
              </div>
            </section>
          </aside>

          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.06] text-[12px] text-slate-400">
              <span><span className="text-white font-semibold">{scoped.length}</span> games</span>
              {searchedCount > 0 && (
                <>
                  <span className="text-emerald-300">{counts.found} found</span>
                  {counts.none > 0 && <span className="text-amber-300">{counts.none} without match</span>}
                  {counts.applied > 0 && <span className="text-emerald-300">{counts.applied} applied</span>}
                </>
              )}
              <div className="flex-1" />
              <button
                onClick={() => setRows((r) => {
                  const n = { ...r };
                  for (const g of scoped) n[g.id] = { ...(n[g.id] ?? { query: null, status: "idle", results: [], pick: null }), include: true } as Row;
                  return n;
                })}
                className="hover:text-white"
              >
                Select all
              </button>
              <button
                onClick={() => setRows((r) => {
                  const n = { ...r };
                  for (const g of scoped) n[g.id] = { ...(n[g.id] ?? { query: null, status: "idle", results: [], pick: null }), include: false } as Row;
                  return n;
                })}
                className="hover:text-white"
              >
                Select none
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3">
              {scoped.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center gap-3">
                  <CheckIcon size={30} className="text-emerald-300" />
                  <p className="text-[15px] text-white font-semibold">{scope === "missing" ? "Every game has a cover" : "No games in this scope"}</p>
                  {scope === "missing" && <button onClick={() => setScope("all")} className="text-[12.5px] text-accent-300 hover:text-accent-200">Find better art for the whole library</button>}
                </div>
              ) : (
                <VirtualGrid
                  items={scoped}
                  getKey={(g) => g.id}
                  columns={1}
                  gapX={0}
                  gapY={8}
                  fixedRowHeight={124}
                  overscanRows={4}
                  render={(g) => {
                    const r = rowOf(g);
                    const st = STATUS_LABEL[r.status];
                    const pick = r.results.find((x) => x.url === r.pick) ?? null;
                    return (
                      <div className={cn("h-full flex items-center gap-4 px-3 rounded-2xl border transition-colors", r.include ? "border-white/[0.07] bg-white/[0.025]" : "border-transparent opacity-50")}>
                        <button
                          onClick={() => patch(g.id, { include: !r.include })}
                          className={cn("w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0", r.include ? "bg-accent-500 border-accent-400" : "border-white/30")}
                        >
                          {r.include && <CheckIcon size={10} className="text-white" />}
                        </button>
                        <div className="w-[66px] h-[88px] rounded-lg overflow-hidden ring-1 ring-white/10 shrink-0 relative">
                          {pick ? <img src={pick.thumb} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" /> : <GameCover game={g} />}
                          {pick && <span className="absolute bottom-0 inset-x-0 text-center text-[8.5px] font-bold bg-accent-500/90 text-white py-0.5">NEW</span>}
                        </div>
                        <div className="w-[300px] shrink-0 min-w-0">
                          <p className="text-[11px] text-slate-500 truncate font-mono" title={g.name}>{g.name}</p>
                          <div className="relative mt-1">
                            <SearchIcon size={12} className="absolute left-2.5 inset-y-0 my-auto text-slate-500" />
                            <input
                              value={queryOf(g)}
                              onChange={(e) => patch(g.id, { query: e.target.value })}
                              onKeyDown={(e) => { if (e.key === "Enter") searchOne(g); }}
                              className="w-full h-8 pl-7 pr-2 rounded-lg bg-black/30 border border-white/10 text-[12.5px] text-slate-100 outline-none focus:border-accent-400/60"
                            />
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 text-[11px]">
                            <span className={cn("font-medium", st.tone)}>{st.text}</span>
                            <span className="text-slate-600">·</span>
                            <span className="text-slate-500">{PLATFORM_LABELS[g.platform]}</span>
                            {r.query !== null && (
                              <button onClick={() => patch(g.id, { query: null })} className="text-slate-500 hover:text-slate-200">reset</button>
                            )}
                            <button onClick={() => searchOne(g)} disabled={r.status === "searching"} className="ml-auto text-accent-300 hover:text-accent-200 disabled:opacity-40">Search</button>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0 flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
                          {r.status === "searching" && Array.from({ length: 5 }).map((_, i) => <div key={i} className="w-[64px] aspect-[3/4] rounded-xl bg-white/[0.05] animate-pulse shrink-0" />)}
                          {r.status !== "searching" && r.results.slice(0, 10).map((c) => (
                            <CoverCandidateTile key={c.url} size="sm" result={c} selected={r.pick === c.url} onClick={() => patch(g.id, { pick: r.pick === c.url ? null : c.url, include: true })} />
                          ))}
                          {r.status === "none" && <p className="text-[12px] text-slate-500">Nothing found — edit the search text and press Enter.</p>}
                          {r.status === "idle" && r.results.length === 0 && <p className="text-[12px] text-slate-600">Not searched yet</p>}
                        </div>
                      </div>
                    );
                  }}
                />
              )}
            </div>

            <div className="px-5 py-4 border-t border-white/[0.06] flex items-center gap-3">
              {applying ? (
                <div className="flex-1">
                  <div className="flex justify-between text-[12px] text-slate-300 mb-1.5"><span>Downloading and applying covers…</span><span className="tabular-nums">{applying.done}/{applying.total}</span></div>
                  <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden"><motion.div className="h-full bg-accent-500 rounded-full" animate={{ width: `${(applying.done / applying.total) * 100}%` }} /></div>
                </div>
              ) : (
                <p className="flex-1 text-[12px] text-slate-500">
                  {activeProviders.length === 0 ? "Turn on at least one art source." : `Searching ${activeProviders.map((p) => (p === "steamgriddb" ? "SteamGridDB" : p === "igdb" ? "IGDB" : "Steam")).join(", ")}. Pick a different cover any time by clicking it.`}
                </p>
              )}
              {running ? (
                <button onClick={() => { stopRef.current = true; }} className="btn-ghost">Stop</button>
              ) : (
                <button onClick={searchAll} disabled={!!applying || activeProviders.length === 0 || scoped.length === 0} className="btn-ghost">
                  <SearchIcon size={14} /> {searchedCount ? "Search again" : `Search ${scoped.filter((g) => rowOf(g).include).length} games`}
                </button>
              )}
              <button onClick={applyAll} disabled={running || !!applying || picked.length === 0} className="btn-primary">
                <SparkleIcon size={14} /> Apply {picked.length} cover{picked.length !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
