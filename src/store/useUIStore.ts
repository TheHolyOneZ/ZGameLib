import { create } from "zustand";
import type { StatusConfig, RunningGame } from "@/lib/types";
import type { Update } from "@tauri-apps/plugin-updater";

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

export interface LogEntry {
  id: string;
  time: string;
  level: "info" | "ok" | "warn" | "error";
  message: string;
}

const DEFAULT_STATUSES: StatusConfig[] = [
  { key: "playing", label: "Playing", color: "#4ade80" },
  { key: "backlog", label: "Backlog", color: "#60a5fa" },
  { key: "completed", label: "Completed", color: "#a78bfa" },
  { key: "dropped", label: "Dropped", color: "#f87171" },
  { key: "on_hold", label: "On Hold", color: "#fbbf24" },
];

interface UIStore {
  toasts: Toast[];
  addToast: (message: string, type?: Toast["type"]) => void;
  removeToast: (id: string) => void;

  isAddGameOpen: boolean;
  setAddGameOpen: (v: boolean) => void;

  isDetailOpen: boolean;
  setDetailOpen: (v: boolean) => void;

  isScanning: boolean;
  setScanning: (v: boolean) => void;

  isBulkAdding: boolean;
  setBulkAdding: (v: boolean) => void;

  confirmDialog: { open: boolean; title: string; onConfirm: () => void; confirmLabel?: string } | null;
  openConfirm: (title: string, onConfirm: () => void, confirmLabel?: string) => void;
  closeConfirm: () => void;

  customStatuses: StatusConfig[];
  setCustomStatuses: (statuses: StatusConfig[]) => void;

  logs: LogEntry[];
  logPanelOpen: boolean;
  addLog: (level: LogEntry["level"], message: string) => void;
  clearLogs: () => void;
  setLogPanelOpen: (v: boolean) => void;

  pendingUpdate: Update | null;
  setPendingUpdate: (u: Update | null) => void;

  isCommandPaletteOpen: boolean;
  setCommandPaletteOpen: (v: boolean) => void;

  settingsDirty: boolean;
  setSettingsDirty: (v: boolean) => void;
  settingsUnsavedNav: { path: string; proceed: () => void } | null;
  setSettingsUnsavedNav: (v: { path: string; proceed: () => void } | null) => void;

  modeSelectorOpen: boolean;
  setModeSelectorOpen: (v: boolean) => void;
  tourOpen: boolean;
  setTourOpen: (v: boolean) => void;
  tourMode: "fast" | "standard" | "detailed" | null;
  setTourMode: (m: "fast" | "standard" | "detailed" | null) => void;

  whatsNewOpen: boolean;
  setWhatsNewOpen: (v: boolean) => void;
  whatsNewVersion: string;
  setWhatsNewVersion: (v: string) => void;

  activeGameId: string | null;
  setActiveGameId: (id: string | null) => void;
  session: RunningGame | null;
  sessionAt: number;
  setSession: (s: RunningGame | null) => void;

  bigPicture: boolean;
  setBigPicture: (v: boolean) => void;

  duplicatesOpen: boolean;
  setDuplicatesOpen: (v: boolean) => void;

  coverFinder: { open: boolean; ids: string[] | null };
  openCoverFinder: (ids?: string[] | null) => void;
  closeCoverFinder: () => void;
}

let logBuffer: LogEntry[] = [];
let logFlush: ReturnType<typeof setTimeout> | null = null;

export const useUIStore = create<UIStore>((set) => ({
  toasts: [],
  addToast: (message, type = "success") => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts.slice(-4), { id, message, type }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 3500);
  },
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  isAddGameOpen: false,
  setAddGameOpen: (v) => set({ isAddGameOpen: v }),

  isDetailOpen: false,
  setDetailOpen: (v) => set({ isDetailOpen: v }),

  isScanning: false,
  setScanning: (v) => set({ isScanning: v }),

  isBulkAdding: false,
  setBulkAdding: (v) => set({ isBulkAdding: v }),

  confirmDialog: null,
  openConfirm: (title, onConfirm, confirmLabel) =>
    set({ confirmDialog: { open: true, title, onConfirm, confirmLabel } }),
  closeConfirm: () => set({ confirmDialog: null }),

  customStatuses: DEFAULT_STATUSES,
  setCustomStatuses: (statuses) => set({ customStatuses: statuses }),

  logs: [],
  logPanelOpen: false,
  addLog: (level, message) => {
    const now = new Date();
    const time = now.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    logBuffer.push({ id: crypto.randomUUID(), time, level, message });
    if (logFlush) return;
    logFlush = setTimeout(() => {
      logFlush = null;
      const batch = logBuffer;
      logBuffer = [];
      set((s) => ({ logs: [...s.logs, ...batch].slice(-500) }));
    }, 100);
  },
  clearLogs: () => set({ logs: [] }),
  setLogPanelOpen: (v) => set({ logPanelOpen: v }),

  pendingUpdate: null,
  setPendingUpdate: (u) => set({ pendingUpdate: u }),

  isCommandPaletteOpen: false,
  setCommandPaletteOpen: (v) => set({ isCommandPaletteOpen: v }),

  settingsDirty: false,
  setSettingsDirty: (v) => set({ settingsDirty: v }),
  settingsUnsavedNav: null,
  setSettingsUnsavedNav: (v) => set({ settingsUnsavedNav: v }),

  modeSelectorOpen: false,
  setModeSelectorOpen: (v) => set({ modeSelectorOpen: v }),
  tourOpen: false,
  setTourOpen: (v) => set({ tourOpen: v }),
  tourMode: null,
  setTourMode: (m) => set({ tourMode: m }),

  whatsNewOpen: false,
  setWhatsNewOpen: (v) => set({ whatsNewOpen: v }),
  whatsNewVersion: "",
  setWhatsNewVersion: (v) => set({ whatsNewVersion: v }),

  activeGameId: null,
  setActiveGameId: (id) => set(id ? { activeGameId: id } : { activeGameId: null, session: null }),
  session: null,
  sessionAt: 0,
  setSession: (s) => set(s ? { session: s, sessionAt: Date.now(), activeGameId: s.game_id } : { session: null, sessionAt: 0 }),

  bigPicture: false,
  setBigPicture: (v) => set({ bigPicture: v }),

  duplicatesOpen: false,
  setDuplicatesOpen: (v) => set({ duplicatesOpen: v }),

  coverFinder: { open: false, ids: null },
  openCoverFinder: (ids = null) => set({ coverFinder: { open: true, ids } }),
  closeCoverFinder: () => set({ coverFinder: { open: false, ids: null } }),
}));
