import { displayName } from "@/lib/gameName";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/tauri";
import { useLocation } from "react-router-dom";
import { useUIStore } from "@/store/useUIStore";
import { useGameStore } from "@/store/useGameStore";
import type { Collection, Game } from "@/lib/types";
import { cn } from "@/lib/utils";
import GameCard from "@/components/library/GameCard";
import GameListRow from "@/components/library/GameListRow";
import GameCover from "@/components/ui/GameCover";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import {
  PlusIcon, TrashIcon, EditIcon, CheckIcon, CloseIcon,
  ChevronLeftIcon, SearchIcon, GridIcon, ListIcon, CollectionIcon,
} from "@/components/ui/Icons";

interface CtxMenuState { x: number; y: number; col: Collection }

function useCollectionGames(collectionId: string | null) {
  const games = useGameStore((s) => s.games);
  const { data = [] } = useQuery({
    queryKey: ["collection-games", collectionId],
    queryFn: () => api.getCollectionGames(collectionId!),
    enabled: !!collectionId,
  });
  return useMemo(() => {
    const byId = new Map(games.map((g) => [g.id, g]));
    return data.map((g) => byId.get(g.id) ?? g);
  }, [data, games]);
}

function CollectionContextMenu({ state, onRename, onDelete, onClose }: {
  state: CtxMenuState;
  onRename: (col: Collection) => void;
  onDelete: (col: Collection) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: state.x, y: state.y });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let { x, y } = state;
    if (x + rect.width > window.innerWidth - 8) x = window.innerWidth - rect.width - 8;
    if (y + rect.height > window.innerHeight - 8) y = window.innerHeight - rect.height - 8;
    setPos({ x, y });
  }, [state]);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const id = requestAnimationFrame(() => document.addEventListener("mousedown", handler));
    document.addEventListener("keydown", keyHandler);
    return () => { cancelAnimationFrame(id); document.removeEventListener("mousedown", handler); document.removeEventListener("keydown", keyHandler); };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-[9999] min-w-[170px] p-1.5 glass-strong rounded-2xl shadow-2xl"
      style={{ left: pos.x, top: pos.y, animation: "ctx-menu-in 0.12s ease-out" }}
    >
      <button onClick={() => { onRename(state.col); onClose(); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-slate-300 hover:text-white hover:bg-white/[0.07] transition-colors">
        <EditIcon size={13} /> Rename
      </button>
      <button onClick={() => { onDelete(state.col); onClose(); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors">
        <TrashIcon size={13} /> Delete
      </button>
    </div>
  );
}

function Mosaic({ games, className }: { games: Game[]; className?: string }) {
  const covers = games.slice(0, 4);
  if (covers.length === 0) {
    return (
      <div className={cn("flex items-center justify-center", className)} style={{ background: "rgba(255,255,255,0.04)" }}>
        <CollectionIcon size={34} className="text-slate-600" />
      </div>
    );
  }
  return (
    <div className={cn("grid gap-[2px]", covers.length === 1 ? "grid-cols-1" : "grid-cols-2", className)}>
      {covers.map((g, i) => (
        <div key={g.id} className={cn("overflow-hidden", covers.length === 3 && i === 0 && "row-span-2")}>
          <GameCover game={g} />
        </div>
      ))}
    </div>
  );
}

function CollectionCard({ col, renaming, renameVal, setRenameVal, onCommitRename, onCancelRename, onOpen, onContext, onStartRename, onDelete, index }: {
  col: Collection;
  renaming: boolean;
  renameVal: string;
  setRenameVal: (v: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onOpen: () => void;
  onContext: (e: React.MouseEvent) => void;
  onStartRename: () => void;
  onDelete: () => void;
  index: number;
}) {
  const games = useCollectionGames(col.id);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 12) * 0.03, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      onClick={() => { if (!renaming) onOpen(); }}
      onContextMenu={onContext}
      className="group cursor-pointer"
    >
      <div className="relative aspect-[4/3] rounded-2xl overflow-hidden card-lift">
        <Mosaic games={games} className="absolute inset-0" />
        <div className="absolute top-2.5 right-2.5 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          <button onClick={onStartRename} className="w-8 h-8 rounded-lg bg-black/60 backdrop-blur flex items-center justify-center text-white/80 hover:text-white" title="Rename"><EditIcon size={13} /></button>
          <button onClick={onDelete} className="w-8 h-8 rounded-lg bg-black/60 backdrop-blur flex items-center justify-center text-white/80 hover:text-red-300" title="Delete"><TrashIcon size={13} /></button>
        </div>
      </div>
      <div className="pt-3 px-0.5">
          {renaming ? (
            <input
              autoFocus
              value={renameVal}
              onChange={(e) => setRenameVal(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onBlur={onCancelRename}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") onCommitRename();
                if (e.key === "Escape") onCancelRename();
              }}
              className="input-glass h-9 py-0 text-[14px] font-semibold"
            />
          ) : (
            <p className="text-[15px] font-semibold text-white leading-tight truncate">{col.name}</p>
          )}
          <p className="text-[12.5px] text-slate-500 mt-1 truncate">
            {col.game_count} game{col.game_count !== 1 ? "s" : ""}{col.description ? ` · ${col.description}` : ""}
          </p>
      </div>
    </motion.div>
  );
}

function AddGamesModal({ collection, existing, onClose }: { collection: Collection; existing: Set<string>; onClose: () => void }) {
  const games = useGameStore((s) => s.games);
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return games
      .filter((g) => !existing.has(g.id) && (!q || g.name.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [games, existing, query]);

  const toggle = (id: string) => setPicked((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const save = async () => {
    if (picked.size === 0) return;
    setSaving(true);
    try {
      await Promise.all([...picked].map((id) => api.addGameToCollection(collection.id, id)));
      qc.invalidateQueries({ queryKey: ["collection-games", collection.id] });
      qc.invalidateQueries({ queryKey: ["collections"] });
      addToast(`Added ${picked.size} game${picked.size !== 1 ? "s" : ""} to "${collection.name}"`);
      onClose();
    } catch (e) {
      addToast(String(e), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: "none" }} className="fixed inset-0 z-50 flex items-center justify-center p-8" style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)" }} onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, pointerEvents: "none" }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="w-[720px] max-h-[80vh] flex flex-col rounded-3xl glass-strong overflow-hidden"
        style={{ boxShadow: "0 40px 100px -20px rgba(0,0,0,0.85)" }}
      >
        <div className="flex items-center gap-3 px-6 pt-5 pb-4">
          <div className="flex-1">
            <h2 className="text-[18px] font-bold text-white">Add games to {collection.name}</h2>
            <p className="text-[12px] text-slate-400 mt-0.5">Click games to select them</p>
          </div>
          <button onClick={onClose} className="btn-icon"><CloseIcon size={14} /></button>
        </div>
        <div className="px-6 pb-4">
          <div className="relative">
            <SearchIcon size={14} className="absolute left-3.5 inset-y-0 my-auto text-slate-500 pointer-events-none" />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your library…" className="input-glass pl-9 text-[13px]" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-4">
          {list.length === 0 ? (
            <p className="text-center text-[13px] text-slate-500 py-12">{query ? "No games match your search" : "Every game is already in this collection"}</p>
          ) : (
            <div className="grid grid-cols-6 gap-3">
              {list.map((g) => {
                const on = picked.has(g.id);
                return (
                  <button key={g.id} onClick={() => toggle(g.id)} className="text-left group">
                    <div className={cn("relative aspect-[3/4] rounded-xl overflow-hidden ring-2 transition-all", on ? "ring-accent-400 scale-[0.97]" : "ring-transparent hover:ring-white/20")}>
                      <GameCover game={g} />
                      <div className={cn("absolute inset-0 transition-colors", on ? "bg-accent-500/30" : "bg-transparent")} />
                      <span className={cn("absolute top-1.5 right-1.5 w-5 h-5 rounded-md flex items-center justify-center border-2 transition-all", on ? "bg-accent-500 border-accent-300" : "bg-black/40 border-white/50 opacity-0 group-hover:opacity-100")}>
                        {on && <CheckIcon size={10} className="text-white" />}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-1.5 truncate">{displayName(g.name)}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 px-6 py-4 border-t border-white/[0.06]">
          <span className="text-[12.5px] text-slate-400 flex-1">{picked.size} selected</span>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={save} disabled={picked.size === 0 || saving} className="btn-primary">
            <PlusIcon size={14} /> Add {picked.size > 0 ? picked.size : ""} game{picked.size !== 1 ? "s" : ""}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ViewToggle({ value, onChange }: { value: "grid" | "list"; onChange: (v: "grid" | "list") => void }) {
  return (
    <div className="flex items-center rounded-xl p-1 gap-0.5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
      {(["grid", "list"] as const).map((m) => (
        <button key={m} onClick={() => onChange(m)} className={cn("w-8 h-7 rounded-lg flex items-center justify-center transition-colors", value === m ? "bg-accent-500 text-white" : "text-slate-500 hover:text-slate-300")}>
          {m === "grid" ? <GridIcon size={14} /> : <ListIcon size={14} />}
        </button>
      ))}
    </div>
  );
}

export default function Collections() {
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  const openConfirm = useUIStore((s) => s.openConfirm);
  const viewMode = useGameStore((s) => s.viewMode);

  const location = useLocation();
  const [selectedId, setSelectedId] = useState<string | null>(() => (location.state as { collectionId?: string } | null)?.collectionId ?? null);

  useEffect(() => {
    const id = (location.state as { collectionId?: string } | null)?.collectionId;
    setSelectedId(id ?? null);
    setGameSearch("");
    setEditingDesc(false);
  }, [location.key]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [search, setSearch] = useState("");
  const [gameSearch, setGameSearch] = useState("");
  const [localView, setLocalView] = useState<"grid" | "list">(viewMode);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descVal, setDescVal] = useState("");
  const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null);
  const [adding, setAdding] = useState(false);

  const { data: collections = [] } = useQuery({ queryKey: ["collections"], queryFn: () => api.getCollections() });
  const selected = collections.find((c) => c.id === selectedId) ?? null;
  const collectionGames = useCollectionGames(selectedId);

  useEffect(() => {
    if (selectedId && collections.length > 0 && !selected) setSelectedId(null);
  }, [selectedId, selected, collections.length]);

  const createMutation = useMutation({
    mutationFn: (name: string) => api.createCollection(name),
    onSuccess: (col) => {
      qc.invalidateQueries({ queryKey: ["collections"] });
      setCreating(false);
      setNewName("");
      addToast(`Collection "${col.name}" created`, "success");
    },
    onError: (e) => addToast(String(e), "error"),
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.renameCollection(id, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collections"] });
      setRenamingId(null);
    },
    onError: (e) => addToast(String(e), "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteCollection(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["collections"] });
      if (selectedId === id) setSelectedId(null);
      addToast("Collection deleted", "success");
    },
    onError: (e) => addToast(String(e), "error"),
  });

  const descMutation = useMutation({
    mutationFn: ({ id, description }: { id: string; description: string | null }) => api.updateCollectionDescription(id, description),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collections"] });
      setEditingDesc(false);
    },
    onError: (e) => addToast(String(e), "error"),
  });

  const removeMutation = useMutation({
    mutationFn: ({ collectionId, gameId }: { collectionId: string; gameId: string }) => api.removeGameFromCollection(collectionId, gameId),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["collection-games", vars.collectionId] });
      qc.invalidateQueries({ queryKey: ["collections"] });
      qc.invalidateQueries({ queryKey: ["game-collections", vars.gameId] });
    },
    onError: (e) => addToast(String(e), "error"),
  });

  const confirmDelete = (col: Collection) => {
    openConfirm(`Delete the collection "${col.name}"? The games themselves stay in your library.`, () => deleteMutation.mutate(col.id), "Delete");
  };

  const handleContextMenu = useCallback((e: React.MouseEvent, col: Collection) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, col });
  }, []);

  const startRename = (col: Collection) => {
    setRenameVal(col.name);
    setRenamingId(col.id);
  };

  const commitRename = () => {
    if (renamingId && renameVal.trim()) renameMutation.mutate({ id: renamingId, name: renameVal.trim() });
    else setRenamingId(null);
  };

  const filteredCollections = collections.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
  const filteredGames = collectionGames.filter((g) => g.name.toLowerCase().includes(gameSearch.toLowerCase()));

  if (selected) {
    const existing = new Set(collectionGames.map((g) => g.id));
    return (
      <div className="h-full overflow-y-auto page-enter">
        <div className="relative overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute -inset-10 blur-[60px] opacity-50 saturate-150">
              <Mosaic games={collectionGames} className="w-full h-full" />
            </div>
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgb(var(--bg-base) / 0.55) 0%, rgb(var(--bg-base)) 100%)" }} />
          </div>
          <div className="relative px-8 pt-6 pb-6">
            <button onClick={() => { setSelectedId(null); setGameSearch(""); setEditingDesc(false); }} className="flex items-center gap-1.5 text-[12.5px] text-slate-300 hover:text-white mb-5">
              <ChevronLeftIcon size={14} /> All collections
            </button>
            <div className="flex items-end gap-6">
              <div className="w-[150px] aspect-square rounded-2xl overflow-hidden ring-1 ring-white/15 shrink-0" style={{ boxShadow: "0 24px 50px -16px rgba(0,0,0,0.9)" }}>
                <Mosaic games={collectionGames} className="w-full h-full" />
              </div>
              <div className="flex-1 min-w-0 pb-1">
                <p className="text-[12px] font-bold text-accent-200/90">Collection</p>
                {renamingId === selected.id ? (
                  <input
                    autoFocus
                    value={renameVal}
                    onChange={(e) => setRenameVal(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenamingId(null); }}
                    className="input-glass text-[26px] font-bold mt-1 h-12 py-0"
                  />
                ) : (
                  <h1 onClick={() => startRename(selected)} className="text-[34px] font-bold text-white leading-tight mt-1 truncate cursor-text hover:text-accent-100 transition-colors" title="Click to rename">{selected.name}</h1>
                )}
                {editingDesc ? (
                  <div className="flex gap-2 mt-2 max-w-2xl">
                    <input
                      autoFocus
                      value={descVal}
                      onChange={(e) => setDescVal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") descMutation.mutate({ id: selected.id, description: descVal.trim() || null });
                        if (e.key === "Escape") setEditingDesc(false);
                      }}
                      placeholder="Describe this collection…"
                      className="input-glass text-[13px] h-9 py-0"
                    />
                    <button onClick={() => descMutation.mutate({ id: selected.id, description: descVal.trim() || null })} className="btn-primary h-9 py-0">Save</button>
                    <button onClick={() => setEditingDesc(false)} className="btn-ghost h-9 py-0">Cancel</button>
                  </div>
                ) : (
                  <p
                    onClick={() => { setDescVal(selected.description ?? ""); setEditingDesc(true); }}
                    className={cn("text-[13.5px] mt-1.5 cursor-text max-w-2xl", selected.description ? "text-slate-300" : "text-slate-500 italic hover:text-slate-300")}
                  >
                    {selected.description || "Add a description…"}
                  </p>
                )}
                <p className="text-[12px] text-slate-400 mt-2">{collectionGames.length} game{collectionGames.length !== 1 ? "s" : ""}</p>
              </div>
              <div className="flex items-center gap-2 pb-1">
                <button onClick={() => setAdding(true)} className="btn-primary"><PlusIcon size={14} /> Add Games</button>
                <button onClick={() => confirmDelete(selected)} className="btn-icon w-10 h-10 hover:!text-red-300" title="Delete collection"><TrashIcon size={15} /></button>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky top-0 z-10 flex items-center gap-3 px-8 py-3 backdrop-blur-xl" style={{ background: "rgb(var(--bg-base) / 0.88)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <div className="relative w-[280px] group">
            <SearchIcon size={14} className="absolute left-3.5 inset-y-0 my-auto text-slate-500 pointer-events-none group-focus-within:text-accent-300" />
            <input value={gameSearch} onChange={(e) => setGameSearch(e.target.value)} placeholder="Filter this collection…" className="input-glass h-9 py-0 pl-9 text-[13px]" />
          </div>
          <div className="flex-1" />
          <ViewToggle value={localView} onChange={setLocalView} />
        </div>

        {filteredGames.length === 0 ? (
          <EmptyState
            icon={<CollectionIcon size={34} />}
            title={gameSearch ? "No matches" : "This collection is empty"}
            description={gameSearch ? "No game in this collection matches your filter." : "Add games with the button above, or right-click any game in your library and choose Collections."}
            action={!gameSearch ? <button onClick={() => setAdding(true)} className="btn-primary"><PlusIcon size={14} /> Add Games</button> : undefined}
          />
        ) : localView === "grid" ? (
          <div className="grid gap-x-5 gap-y-6 px-8 pt-5 pb-10" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
            {filteredGames.map((g) => (
              <div key={g.id} className="relative group/item">
                <GameCard game={g} collectionId={selected.id} onRemoveFromCollection={() => removeMutation.mutate({ collectionId: selected.id, gameId: g.id })} />
                <button
                  onClick={() => removeMutation.mutate({ collectionId: selected.id, gameId: g.id })}
                  className="absolute -top-2 -right-2 z-20 w-7 h-7 rounded-full bg-bg-elevated border border-white/15 text-slate-300 hover:text-red-300 hover:border-red-400/40 opacity-0 group-hover/item:opacity-100 transition-opacity flex items-center justify-center shadow-lg"
                  title="Remove from collection"
                >
                  <CloseIcon size={11} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1 px-6 pt-3 pb-10">
            {filteredGames.map((g) => (
              <div key={g.id} className="relative group/item flex items-center">
                <div className="flex-1 min-w-0">
                  <GameListRow game={g} collectionId={selected.id} onRemoveFromCollection={() => removeMutation.mutate({ collectionId: selected.id, gameId: g.id })} />
                </div>
                <button
                  onClick={() => removeMutation.mutate({ collectionId: selected.id, gameId: g.id })}
                  className="btn-icon w-8 h-8 opacity-0 group-hover/item:opacity-100 hover:!text-red-300 ml-1"
                  title="Remove from collection"
                >
                  <CloseIcon size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <AnimatePresence>
          {adding && <AddGamesModal collection={selected} existing={existing} onClose={() => setAdding(false)} />}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto page-enter">
      {ctxMenu && (
        <CollectionContextMenu state={ctxMenu} onRename={startRename} onDelete={confirmDelete} onClose={() => setCtxMenu(null)} />
      )}

      <PageHeader
        icon={<CollectionIcon size={22} />}
        title="Collections"
        subtitle={collections.length ? `${collections.length} collection${collections.length !== 1 ? "s" : ""} — group games your way` : "Group your games into playlists, themes or to-do lists"}
        actions={
          <>
            {collections.length > 0 && (
              <div className="relative w-[220px] group">
                <SearchIcon size={14} className="absolute left-3.5 inset-y-0 my-auto text-slate-500 pointer-events-none group-focus-within:text-accent-300" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search collections…" className="input-glass h-9 py-0 pl-9 text-[13px]" />
              </div>
            )}
            <button onClick={() => setCreating(true)} className="btn-primary h-9 py-0">
              <PlusIcon size={14} /> New Collection
            </button>
          </>
        }
      />

      <div className="px-8 pt-5 pb-10">
        <AnimatePresence>
          {creating && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0, pointerEvents: "none" }}
              className="overflow-hidden"
            >
              <div className="surface p-3 flex items-center gap-2 mb-5 max-w-xl">
                <span className="w-9 h-9 rounded-xl bg-accent-500/20 text-accent-200 flex items-center justify-center shrink-0"><CollectionIcon size={16} /></span>
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newName.trim()) createMutation.mutate(newName.trim());
                    if (e.key === "Escape") { setCreating(false); setNewName(""); }
                  }}
                  placeholder="Name your collection…"
                  className="input-glass flex-1 h-9 py-0 text-[13px]"
                />
                <button onClick={() => newName.trim() && createMutation.mutate(newName.trim())} disabled={!newName.trim()} className="btn-primary h-9 py-0">Create</button>
                <button onClick={() => { setCreating(false); setNewName(""); }} className="btn-icon"><CloseIcon size={12} /></button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {filteredCollections.length === 0 && !creating ? (
          <EmptyState
            icon={<CollectionIcon size={34} />}
            title={search ? "No matches" : "No collections yet"}
            description={search ? `No collection is called "${search}".` : "Create collections like \"Couch co-op\", \"Finish in 2026\" or \"Comfort games\" to keep your library organised."}
            action={!search ? <button onClick={() => setCreating(true)} className="btn-primary"><PlusIcon size={14} /> Create your first collection</button> : undefined}
          />
        ) : (
          <div className="grid gap-x-5 gap-y-7" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
            {filteredCollections.map((col, i) => (
              <CollectionCard
                key={col.id}
                index={i}
                col={col}
                renaming={renamingId === col.id}
                renameVal={renameVal}
                setRenameVal={setRenameVal}
                onCommitRename={commitRename}
                onCancelRename={() => setRenamingId(null)}
                onOpen={() => setSelectedId(col.id)}
                onContext={(e) => handleContextMenu(e, col)}
                onStartRename={() => startRename(col)}
                onDelete={() => confirmDelete(col)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
