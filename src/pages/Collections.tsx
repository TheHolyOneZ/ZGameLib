import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/tauri";
import { useUIStore } from "@/store/useUIStore";
import { useGameStore } from "@/store/useGameStore";
import type { Collection, Game } from "@/lib/types";
import { cn } from "@/lib/utils";
import GameCard from "@/components/library/GameCard";
import GameListRow from "@/components/library/GameListRow";
import GameContextMenu from "@/components/ui/GameContextMenu";
import {
  PlusIcon, TrashIcon, EditIcon, CheckIcon, CloseIcon,
  LibraryIcon, ChevronLeftIcon, SearchIcon,
} from "@/components/ui/Icons";

function FolderIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M3 7C3 5.9 3.9 5 5 5H9.6C10.1 5 10.6 5.2 10.9 5.6L12 7H19C20.1 7 21 7.9 21 9V18C21 19.1 20.1 20 19 20H5C3.9 20 3 19.1 3 18V7Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  );
}

function GridIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="13" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="3" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="13" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

function ListIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M8 6H21M8 12H21M8 18H21M3 6H3.01M3 12H3.01M3 18H3.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

interface CtxMenuState { x: number; y: number; col: Collection }

function CollectionContextMenu({
  state, onRename, onDelete, onClose,
}: {
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
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const id = requestAnimationFrame(() => document.addEventListener("mousedown", handler));
    document.addEventListener("keydown", keyHandler);
    return () => { cancelAnimationFrame(id); document.removeEventListener("mousedown", handler); document.removeEventListener("keydown", keyHandler); };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-[9999] min-w-[160px] py-1.5 glass-strong rounded-xl border border-white/[0.06] shadow-2xl"
      style={{ left: pos.x, top: pos.y, animation: "ctx-menu-in 0.12s ease-out" }}
    >
      <button onClick={() => { onRename(state.col); onClose(); }} className="w-full flex items-center gap-3 px-3.5 py-2 text-[13px] text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors">
        <EditIcon size={13} />
        Rename
      </button>
      <div className="my-1 mx-2 border-t border-white/[0.06]" />
      <button onClick={() => { onDelete(state.col); onClose(); }} className="w-full flex items-center gap-3 px-3.5 py-2 text-[13px] text-red-400 hover:text-red-300 hover:bg-red-500/[0.06] transition-colors">
        <TrashIcon size={13} />
        Delete
      </button>
    </div>
  );
}

export default function Collections() {
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  const viewMode = useGameStore((s) => s.viewMode);

  const [selected, setSelected] = useState<Collection | null>(null);
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

  const { data: collections = [] } = useQuery({
    queryKey: ["collections"],
    queryFn: () => api.getCollections(),
  });

  const { data: collectionGames = [] } = useQuery({
    queryKey: ["collection-games", selected?.id],
    queryFn: () => api.getCollectionGames(selected!.id),
    enabled: !!selected,
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => api.createCollection(name),
    onSuccess: (col) => {
      qc.invalidateQueries({ queryKey: ["collections"] });
      setCreating(false);
      setNewName("");
      addToast(`Collection "${col.name}" created`, "success");
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.renameCollection(id, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collections"] });
      if (selected && selected.id === renamingId) setSelected((s) => s ? { ...s, name: renameVal } : s);
      setRenamingId(null);
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteCollection(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["collections"] });
      if (selected?.id === id) setSelected(null);
      addToast("Collection deleted", "success");
    },
  });

  const descMutation = useMutation({
    mutationFn: ({ id, description }: { id: string; description: string | null }) =>
      api.updateCollectionDescription(id, description),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["collections"] });
      if (selected) setSelected((s) => s ? { ...s, description: vars.description } : s);
      setEditingDesc(false);
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const removeMutation = useMutation({
    mutationFn: ({ collectionId, gameId }: { collectionId: string; gameId: string }) =>
      api.removeGameFromCollection(collectionId, gameId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collection-games", selected?.id] });
      qc.invalidateQueries({ queryKey: ["collections"] });
    },
  });

  const handleCreate = () => {
    if (newName.trim()) createMutation.mutate(newName.trim());
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

  const filteredCollections = collections.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredGames = collectionGames.filter((g: Game) =>
    g.name.toLowerCase().includes(gameSearch.toLowerCase())
  );

  if (selected) {
    return (
      <div className="flex flex-col h-full">
        {ctxMenu && (
          <CollectionContextMenu
            state={ctxMenu}
            onRename={startRename}
            onDelete={(col) => deleteMutation.mutate(col.id)}
            onClose={() => setCtxMenu(null)}
          />
        )}
        <div className="flex items-center gap-3 px-6 pt-5 pb-3 shrink-0">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => { setSelected(null); setGameSearch(""); setEditingDesc(false); }}
            className="btn-icon w-8 h-8"
          >
            <ChevronLeftIcon size={14} />
          </motion.button>
          <FolderIcon size={18} className="text-accent-400" />
          <h1 className="text-[18px] font-bold text-white">{selected.name}</h1>
          <span className="text-[12px] text-slate-600 ml-1">{collectionGames.length} games</span>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => setLocalView("grid")}
              className={cn("btn-icon w-7 h-7", localView === "grid" ? "text-accent-400 border-accent-500/30" : "")}
            >
              <GridIcon size={13} />
            </button>
            <button
              onClick={() => setLocalView("list")}
              className={cn("btn-icon w-7 h-7", localView === "list" ? "text-accent-400 border-accent-500/30" : "")}
            >
              <ListIcon size={13} />
            </button>
          </div>
        </div>

        <div className="px-6 pb-3 shrink-0">
          {editingDesc ? (
            <div className="flex flex-col gap-2">
              <textarea
                autoFocus
                value={descVal}
                onChange={(e) => setDescVal(e.target.value)}
                rows={3}
                placeholder="Collection description..."
                className="input-glass text-[13px] resize-none leading-relaxed"
              />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setEditingDesc(false)} className="btn-ghost text-[12px] py-1.5">Cancel</button>
                <button
                  onClick={() => descMutation.mutate({ id: selected.id, description: descVal.trim() || null })}
                  className="btn-primary text-[12px] py-1.5"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <motion.p
              whileHover={{ borderColor: "rgb(var(--accent-500) /0.2)" }}
              onClick={() => { setDescVal(selected.description ?? ""); setEditingDesc(true); }}
              className={cn(
                "text-[12px] cursor-text leading-relaxed rounded-xl px-3 py-2 glass transition-all duration-300",
                selected.description ? "text-slate-400" : "text-slate-700 italic"
              )}
            >
              {selected.description ?? "Click to add a description..."}
            </motion.p>
          )}
        </div>

        <div className="px-6 pb-3 shrink-0">
          <div className="relative">
            <SearchIcon size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
            <input
              value={gameSearch}
              onChange={(e) => setGameSearch(e.target.value)}
              placeholder="Search games..."
              className="input-glass text-[12px] pl-8 py-2 w-full"
            />
          </div>
        </div>

        {filteredGames.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-600">
            <FolderIcon size={40} />
            <p className="text-[14px]">{gameSearch ? "No matches" : "No games in this collection"}</p>
            {!gameSearch && <p className="text-[12px] text-slate-700">Right-click a game and choose "Add to Collection"</p>}
          </div>
        ) : (
          <div className={cn(
            "flex-1 overflow-y-auto px-4 pb-6",
            localView === "grid" ? "grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3 content-start" : "flex flex-col gap-1"
          )}>
            {localView === "grid"
              ? filteredGames.map((g: Game) => (
                  <div key={g.id} className="relative group">
                    <GameContextMenu game={g} collectionId={selected.id} onRemoveFromCollection={() => removeMutation.mutate({ collectionId: selected.id, gameId: g.id })}>
                      <GameCard game={g} />
                    </GameContextMenu>
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={() => removeMutation.mutate({ collectionId: selected.id, gameId: g.id })}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-lg bg-black/70 border border-white/10 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      <CloseIcon size={10} />
                    </motion.button>
                  </div>
                ))
              : filteredGames.map((g: Game) => (
                  <div key={g.id} className="relative group flex items-center">
                    <div className="flex-1">
                      <GameContextMenu game={g} collectionId={selected.id} onRemoveFromCollection={() => removeMutation.mutate({ collectionId: selected.id, gameId: g.id })}>
                        <GameListRow game={g} />
                      </GameContextMenu>
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={() => removeMutation.mutate({ collectionId: selected.id, gameId: g.id })}
                      className="btn-icon w-7 h-7 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity mr-2"
                    >
                      <TrashIcon size={11} />
                    </motion.button>
                  </div>
                ))
            }
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {ctxMenu && (
        <CollectionContextMenu
          state={ctxMenu}
          onRename={startRename}
          onDelete={(col) => deleteMutation.mutate(col.id)}
          onClose={() => setCtxMenu(null)}
        />
      )}

      <div className="flex items-center justify-between px-6 pt-5 pb-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <FolderIcon size={18} className="text-accent-400" />
          <h1 className="text-[18px] font-bold text-white">Collections</h1>
          {collections.length > 0 && (
            <span className="text-[11px] text-slate-600 bg-white/5 px-1.5 py-0.5 rounded-md">{collections.length}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLocalView("grid")}
            className={cn("btn-icon w-7 h-7", localView === "grid" ? "text-accent-400 border-accent-500/30" : "")}
          >
            <GridIcon size={13} />
          </button>
          <button
            onClick={() => setLocalView("list")}
            className={cn("btn-icon w-7 h-7", localView === "list" ? "text-accent-400 border-accent-500/30" : "")}
          >
            <ListIcon size={13} />
          </button>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setCreating(true)}
            className="btn-primary text-[12px] py-1.5 px-3"
          >
            <PlusIcon size={13} />
            New
          </motion.button>
        </div>
      </div>

      {collections.length > 0 && (
        <div className="px-6 pb-3 shrink-0">
          <div className="relative">
            <SearchIcon size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search collections..."
              className="input-glass text-[12px] pl-8 py-2 w-full"
            />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <AnimatePresence>
          {creating && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="glass rounded-xl p-3 flex items-center gap-2 mb-2"
            >
              <FolderIcon size={15} className="text-accent-400 shrink-0" />
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newName.trim()) handleCreate();
                  if (e.key === "Escape") { setCreating(false); setNewName(""); }
                }}
                placeholder="Collection name..."
                className="input-glass flex-1 text-[13px] py-1"
              />
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => { setCreating(false); setNewName(""); }} className="btn-icon w-7 h-7">
                <CloseIcon size={11} />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="btn-icon w-7 h-7 text-accent-400 border-accent-500/20 disabled:opacity-30"
              >
                <CheckIcon size={11} />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {filteredCollections.length === 0 && !creating ? (
          <div className="flex flex-col items-center justify-center gap-3 text-slate-600 py-24">
            <FolderIcon size={48} />
            <p className="text-[14px]">{search ? "No matches" : "No collections yet"}</p>
            {!search && <p className="text-[12px] text-slate-700">Create one to group your games</p>}
          </div>
        ) : localView === "grid" ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
            {filteredCollections.map((col) => (
              <motion.div
                key={col.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass rounded-xl p-4 flex flex-col gap-2 group hover:border-accent-500/15 transition-all cursor-pointer relative"
                onClick={() => { if (renamingId !== col.id) setSelected(col); }}
                onContextMenu={(e) => handleContextMenu(e, col)}
              >
                <div className="flex items-start justify-between">
                  <FolderIcon size={22} className="text-accent-400" />
                  <span className="text-[11px] text-slate-600 tabular-nums">{col.game_count}</span>
                </div>
                {renamingId === col.id ? (
                  <input
                    autoFocus
                    value={renameVal}
                    onChange={(e) => setRenameVal(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter" && renameVal.trim()) renameMutation.mutate({ id: col.id, name: renameVal.trim() });
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    className="input-glass text-[13px] py-0.5"
                  />
                ) : (
                  <p className="text-[14px] font-medium text-slate-200 leading-tight">{col.name}</p>
                )}
                {col.description && (
                  <p className="text-[11px] text-slate-600 leading-snug line-clamp-2">{col.description}</p>
                )}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                  <motion.button whileTap={{ scale: 0.85 }} onClick={(e) => { e.stopPropagation(); setRenameVal(col.name); setRenamingId(col.id); }} className="btn-icon w-6 h-6">
                    <EditIcon size={10} />
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.85 }} onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(col.id); }} className="btn-icon w-6 h-6 hover:text-red-400">
                    <TrashIcon size={10} />
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredCollections.map((col) => (
              <motion.div
                key={col.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass rounded-xl px-4 py-3 flex items-center gap-3 group hover:border-accent-500/15 transition-all cursor-pointer"
                onClick={() => { if (renamingId !== col.id) setSelected(col); }}
                onContextMenu={(e) => handleContextMenu(e, col)}
              >
                <FolderIcon size={16} className="text-accent-400 shrink-0" />
                {renamingId === col.id ? (
                  <input
                    autoFocus
                    value={renameVal}
                    onChange={(e) => setRenameVal(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter" && renameVal.trim()) renameMutation.mutate({ id: col.id, name: renameVal.trim() });
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    className="input-glass flex-1 text-[13px] py-0.5"
                  />
                ) : (
                  <div className="flex-1 min-w-0">
                    <span className="text-[14px] font-medium text-slate-200">{col.name}</span>
                    {col.description && (
                      <p className="text-[11px] text-slate-600 truncate mt-0.5">{col.description}</p>
                    )}
                  </div>
                )}
                <span className="text-[12px] text-slate-600 tabular-nums shrink-0">{col.game_count}</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {renamingId === col.id ? (
                    <>
                      <motion.button whileTap={{ scale: 0.85 }} onClick={(e) => { e.stopPropagation(); setRenamingId(null); }} className="btn-icon w-6 h-6">
                        <CloseIcon size={10} />
                      </motion.button>
                      <motion.button whileTap={{ scale: 0.85 }} onClick={(e) => { e.stopPropagation(); if (renameVal.trim()) renameMutation.mutate({ id: col.id, name: renameVal.trim() }); }} className="btn-icon w-6 h-6 text-accent-400 border-accent-500/20">
                        <CheckIcon size={10} />
                      </motion.button>
                    </>
                  ) : (
                    <>
                      <motion.button whileTap={{ scale: 0.85 }} onClick={(e) => { e.stopPropagation(); setRenameVal(col.name); setRenamingId(col.id); }} className="btn-icon w-6 h-6">
                        <EditIcon size={10} />
                      </motion.button>
                      <motion.button whileTap={{ scale: 0.85 }} onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(col.id); }} className="btn-icon w-6 h-6 hover:text-red-400">
                        <TrashIcon size={10} />
                      </motion.button>
                    </>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
