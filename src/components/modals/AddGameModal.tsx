import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { useUIStore } from "@/store/useUIStore";
import { useGames } from "@/hooks/useGames";
import { api } from "@/lib/tauri";
import type { Platform } from "@/lib/types";
import { CloseIcon, FolderIcon, PlusIcon, ScanIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/utils";
import { useGameStore } from "@/store/useGameStore";
import { canonicalKey, cleanTitle, displayName } from "@/lib/gameName";

type Mode = "single" | "bulk";

export default function AddGameModal() {
  const isOpen = useUIStore((s) => s.isAddGameOpen);
  const setOpen = useUIStore((s) => s.setAddGameOpen);
  const addToast = useUIStore((s) => s.addToast);
  const { create } = useGames();
  const qc = useQueryClient();

  const [mode, setMode] = useState<Mode>("single");
  const [name, setName] = useState("");
  const [exePath, setExePath] = useState("");
  const [platform] = useState<Platform>("custom");
  const [bulkFolder, setBulkFolder] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isBulkAdding = useUIStore((s) => s.isBulkAdding);
  const setBulkAdding = useUIStore((s) => s.setBulkAdding);

  const close = () => {
    setOpen(false);
    setMode("single");
    setName("");
    setExePath("");
    setBulkFolder("");
  };

  const pickExe = async () => {
    const selected = await open({
      filters: [{ name: "Executable", extensions: ["exe"] }],
    });
    if (typeof selected === "string") {
      setExePath(selected);
      if (!name) {
        const parts = selected.split(/[\\/]/);
        const filename = parts[parts.length - 1].replace(/\.exe$/i, "");
        const folder = parts.length > 1 ? parts[parts.length - 2] : "";
        const generic = /^(game|launcher|start|play|run|setup|bin|win64|win32|x64|shipping|client)$/i.test(filename.replace(/[-_.]?(win64|win32|x64|shipping)$/i, ""));
        setName(cleanTitle(generic && folder ? folder : filename.replace(/[-_.](win64|win32|x64|shipping)$/i, "")));
      }
    }
  };

  const pickFolder = async () => {
    const selected = await open({
      directory: true,
      title: "Select folder containing game subfolders",
    });
    if (typeof selected === "string") {
      setBulkFolder(selected);
    }
  };

  const handleSubmitSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || submitting) return;
    const trimmed = name.trim();
    const existing = useGameStore.getState().games.find((g) => (exePath && g.exe_path === exePath) || canonicalKey(g.name) === canonicalKey(trimmed));
    if (existing) {
      const proceed = await new Promise<boolean>((resolve) =>
        useUIStore.getState().openConfirm(`"${displayName(existing.name)}" is already in your library. Add it again anyway?`, () => resolve(true), "Add Anyway")
      );
      if (!proceed) return;
    }
    setSubmitting(true);
    create(
      {
        name: trimmed,
        platform,
        exe_path: exePath || undefined,
        install_dir: exePath ? exePath.split(/[\\/]/).slice(0, -1).join("/") : undefined,
      },
      { onSettled: () => setSubmitting(false) }
    );
    close();
  };

  const handleSubmitBulk = () => {
    if (!bulkFolder || isBulkAdding) return;
    const folder = bulkFolder;
    close();
    setBulkAdding(true);
    addToast("Bulk scan started — working in the background", "info");
    api
      .scanFolder(folder)
      .then((result) => {
        addToast(
          result.added > 0
            ? `Bulk scan done — ${result.added} new game${result.added !== 1 ? "s" : ""} found`
            : "Bulk scan done — no new games found",
          result.added > 0 ? "success" : "info"
        );
        qc.invalidateQueries({ queryKey: ["games"] });
      })
      .catch((e) => addToast(String(e), "error"))
      .finally(() => setBulkAdding(false));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, pointerEvents: "none" }}
            onClick={close}
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(12px)" }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10, pointerEvents: "none" }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none"
          >
            <div
              data-tour="add-game-modal"
              className="glass-strong rounded-3xl w-full max-w-md pointer-events-auto overflow-hidden"
              style={{
                boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
              }}
            >
              <div className="flex items-center justify-between p-6 pb-4">
                <div className="flex items-center gap-3">
                  <div>
                    <h2 className="text-[18px] font-semibold text-white">Add Games</h2>
                    <p className="text-[11px] text-slate-500">
                      {mode === "single" ? "Add a single game" : "Bulk scan a folder"}
                    </p>
                  </div>
                </div>
                <motion.button whileTap={{ scale: 0.85 }} onClick={close} className="btn-icon">
                  <CloseIcon size={14} />
                </motion.button>
              </div>

              <div className="px-6 mb-4">
                <div className="flex rounded-xl glass overflow-hidden p-1 gap-1">
                  {(["single", "bulk"] as Mode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={cn(
                        "flex-1 py-2 px-3 rounded-lg text-[12px] font-medium transition-all duration-200 flex items-center justify-center gap-2",
                        mode === m
                          ? "text-white bg-accent-600/25 border border-accent-500/25"
                          : "text-slate-500 hover:text-slate-300 border border-transparent"
                      )}
                    >
                      {m === "single" ? (
                        <>
                          <PlusIcon size={12} />
                          Single Game
                        </>
                      ) : (
                        <>
                          <ScanIcon size={12} />
                          Bulk Add
                        </>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <AnimatePresence initial={false}>
                {mode === "single" ? (
                  <motion.form
                    key="single"
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16, pointerEvents: "none" }}
                    transition={{ duration: 0.15 }}
                    onSubmit={handleSubmitSingle}
                    className="px-6 pb-6 flex flex-col gap-4"
                  >
                    <div>
                      <label className="text-[12px] text-slate-500 font-semibold mb-1.5 block">
                        Game Name
                      </label>
                      <input
                        autoFocus
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter game name"
                        className="input-glass"
                      />
                    </div>

                    <div>
                      <label className="text-[12px] text-slate-500 font-semibold mb-1.5 block">
                        Executable (.exe)
                      </label>
                      <div className="flex gap-2">
                        <input
                          value={exePath}
                          onChange={(e) => setExePath(e.target.value)}
                          placeholder="Path to .exe file"
                          className="input-glass flex-1 text-[12px] font-mono"
                        />
                        <motion.button
                          whileTap={{ scale: 0.92 }}
                          type="button"
                          onClick={pickExe}
                          className="btn-ghost px-3"
                        >
                          <FolderIcon size={15} />
                        </motion.button>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        type="button"
                        onClick={close}
                        className="btn-ghost flex-1 justify-center"
                      >
                        Cancel
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        disabled={!name.trim()}
                        className="btn-primary flex-1 justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <PlusIcon size={13} />
                        Add Game
                      </motion.button>
                    </div>
                  </motion.form>
                ) : (
                  <motion.div
                    key="bulk"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16, pointerEvents: "none" }}
                    transition={{ duration: 0.15 }}
                    className="px-6 pb-6 flex flex-col gap-4"
                  >
                    <div className="glass rounded-xl p-4">
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Select a folder containing game subfolders. Each subfolder should contain a game's
                        <span className="text-accent-300 font-medium"> .exe</span> file.
                        The largest exe in each subfolder will be auto-detected.
                      </p>
                    </div>

                    <div>
                      <label className="text-[12px] text-slate-500 font-semibold mb-1.5 block">
                        Games Folder
                      </label>
                      <div className="flex gap-2">
                        <input
                          value={bulkFolder}
                          onChange={(e) => setBulkFolder(e.target.value)}
                          placeholder="D:\Games\ or similar"
                          className="input-glass flex-1 text-[12px] font-mono"
                        />
                        <motion.button
                          whileTap={{ scale: 0.92 }}
                          onClick={pickFolder}
                          className="btn-ghost px-3"
                        >
                          <FolderIcon size={15} />
                        </motion.button>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={close}
                        className="btn-ghost flex-1 justify-center"
                      >
                        Cancel
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleSubmitBulk}
                        disabled={!bulkFolder || isBulkAdding}
                        className="btn-primary flex-1 justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ScanIcon size={13} />
                        Scan & Add
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
