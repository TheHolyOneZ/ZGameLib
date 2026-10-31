import { useState, useEffect, useRef } from "react";
import { version as APP_VERSION } from "../../package.json";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { api } from "@/lib/tauri";
import { useUIStore } from "@/store/useUIStore";
import { useNavigate } from "react-router-dom";
import { useCover } from "@/hooks/useCover";
import type { AppSettings, StatusConfig, Game, CustomTheme } from "@/lib/types";
import { COVER_PLACEHOLDER } from "@/lib/utils";
import {
  DownloadIcon, SettingsIcon, CheckIcon, PlusIcon, TrashIcon,
  CloseIcon, GamepadIcon, SparkleIcon, GlobeIcon, TvIcon, PowerIcon, InfoIcon, GridIcon,
} from "@/components/ui/Icons";
import { BP_AUTOSTART_KEY } from "@/components/bigpicture/BigPicture";
import { isSoundEnabled, setSoundEnabled } from "@/components/bigpicture/sound";
import { getConnectedPads, detectControllerKind, prettyControllerName } from "@/lib/gamepad";
import { open } from "@tauri-apps/plugin-dialog";
import { cn } from "@/lib/utils";
import { PromoCards } from "@/components/game/ModsPromoPanel";
import { useFilteredGames } from "@/hooks/useGames";

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <motion.button
      onClick={() => onChange(!value)}
      className="relative w-10 h-5 rounded-full shrink-0 transition-colors duration-200"
      style={{ background: value ? "rgb(var(--accent-600))" : "rgba(255,255,255,0.1)" }}
    >
      <motion.span
        animate={{ x: value ? 20 : 2 }}
        transition={{ type: "spring", stiffness: 500, damping: 35 }}
        className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm"
        style={{ display: "block" }}
      />
    </motion.button>
  );
}

const COLOR_PRESETS = [
  "#4ade80", "#60a5fa", "#a78bfa", "#f87171", "#fbbf24",
  "#f472b6", "#22d3ee", "#fb923c", "#34d399", "#818cf8",
  "#e879f9", "#a3e635", "#94a3b8",
];

function sectionId(title: string) {
  return "settings-" + title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function Section({ title, icon, delay = 0, dataTour, description, children }: {
  title: string;
  icon: React.ReactNode;
  delay?: number;
  dataTour?: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      id={sectionId(title)}
      data-settings-section={title}
      data-tour={dataTour}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="surface overflow-hidden scroll-mt-6"
    >
      <div className="flex items-center gap-3 px-6 pt-5 pb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <span className="w-8 h-8 rounded-xl flex items-center justify-center text-accent-300 shrink-0" style={{ background: "rgb(var(--accent-500) / 0.14)" }}>{icon}</span>
        <div>
          <h2 className="text-[15px] font-semibold text-white leading-tight">{title}</h2>
          {description && <p className="text-[12px] text-slate-500 mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </motion.section>
  );
}

function Row({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div className="min-w-0">
        <p className="text-[13.5px] text-slate-100">{title}</p>
        {description && <p className="text-[12px] text-slate-500 mt-0.5 leading-snug">{description}</p>}
      </div>
      {children}
    </div>
  );
}

const NAV_SECTIONS: { title: string; icon: React.ReactNode }[] = [
  { title: "General", icon: <SparkleIcon size={14} /> },
  { title: "Appearance", icon: <GridIcon size={14} /> },
  { title: "Big Picture & Controllers", icon: <TvIcon size={14} /> },
  { title: "Behavior", icon: <SettingsIcon size={14} /> },
  { title: "System", icon: <PowerIcon size={14} /> },
  { title: "Platform Paths", icon: <GamepadIcon size={14} /> },
  { title: "Game Statuses", icon: <span className="w-2.5 h-2.5 rounded-full bg-accent-400" /> },
  { title: "Integrations", icon: <GlobeIcon size={14} /> },
  { title: "Data", icon: <DownloadIcon size={14} /> },
  { title: "Trash", icon: <TrashIcon size={14} /> },
  { title: "About", icon: <InfoIcon size={14} /> },
];

function ControllerSection() {
  const [autostart, setAutostart] = useState(() => { try { return localStorage.getItem(BP_AUTOSTART_KEY) === "1"; } catch { return false; } });
  const [fullscreen, setFullscreen] = useState(() => { try { return localStorage.getItem("zgamelib-bp-fullscreen") !== "0"; } catch { return true; } });
  const [sound, setSound] = useState(isSoundEnabled());
  const [pad, setPad] = useState<string | null>(() => getConnectedPads()[0]?.id ?? null);

  useEffect(() => {
    const update = () => setPad(getConnectedPads()[0]?.id ?? null);
    window.addEventListener("gamepadconnected", update);
    window.addEventListener("gamepaddisconnected", update);
    const t = setInterval(update, 2000);
    return () => { window.removeEventListener("gamepadconnected", update); window.removeEventListener("gamepaddisconnected", update); clearInterval(t); };
  }, []);

  const kind = pad ? detectControllerKind(pad) : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4 p-4 rounded-2xl" style={{ background: "linear-gradient(120deg, rgb(var(--accent-600) / 0.25), rgba(255,255,255,0.02))", border: "1px solid rgb(var(--accent-400) / 0.2)" }}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(140deg, rgb(var(--accent-400)), rgb(var(--accent-700)))" }}>
          <TvIcon size={22} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-white">Big Picture mode</p>
          <p className="text-[12px] text-slate-400 mt-0.5">A full-screen, couch-friendly interface built for Xbox and PlayStation controllers. Press Start / Options on a controller or Ctrl+B to open it.</p>
        </div>
        <button onClick={() => useUIStore.getState().setBigPicture(true)} className="btn-primary shrink-0">Launch</button>
      </div>
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", pad ? "bg-emerald-400 shadow-[0_0_10px_#34d399]" : "bg-slate-600")} />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-slate-100">{pad ? prettyControllerName(pad) : "No controller detected"}</p>
          <p className="text-[11.5px] text-slate-500 truncate">{pad ? `${kind === "playstation" ? "PlayStation" : kind === "xbox" ? "Xbox" : kind === "nintendo" ? "Nintendo" : "Generic"} button layout` : "Connect a controller and press any button so the app can see it."}</p>
        </div>
      </div>
      <Row title="Start in Big Picture" description="Open straight into Big Picture mode whenever ZGameLib launches">
        <Toggle value={autostart} onChange={(v) => { setAutostart(v); try { localStorage.setItem(BP_AUTOSTART_KEY, v ? "1" : "0"); } catch {} }} />
      </Row>
      <Row title="Go fullscreen" description="Switch the window to fullscreen while Big Picture is open">
        <Toggle value={fullscreen} onChange={(v) => { setFullscreen(v); try { localStorage.setItem("zgamelib-bp-fullscreen", v ? "1" : "0"); } catch {} }} />
      </Row>
      <Row title="Interface sounds" description="Subtle navigation and selection sounds in Big Picture">
        <Toggle value={sound} onChange={(v) => { setSound(v); setSoundEnabled(v); }} />
      </Row>
    </div>
  );
}

import { applyTheme, applyCustomThemeVars, clearCustomThemeVars, generateShades, darkenHex } from "@/lib/theme";

const ACCENT_PRESETS = [
  "#7c3aed", "#3b82f6", "#06b6d4", "#10b981", "#f59e0b",
  "#ef4444", "#ec4899", "#8b5cf6", "#14b8a6", "#f97316",
  "#6366f1", "#84cc16", "#e11d48", "#0ea5e9",
];

const BG_PRESETS = [
  "#07060b", "#000000", "#0a0a0f", "#0f172a", "#1a1a2e",
  "#1e1e2e", "#2e3440", "#282a36", "#282828", "#1a1b26",
];

function TrashedGameRow({ game, onRestore, onDelete }: { game: Game; onRestore: () => void; onDelete: () => void }) {
  const coverUrl = useCover(game);
  return (
    <div className="flex items-center gap-3 py-2 border-b border-white/4 last:border-0">
      <img
        src={coverUrl || COVER_PLACEHOLDER}
        alt={game.name}
        className="w-8 h-11 rounded-md object-cover shrink-0 border border-white/[0.05]"
        onError={(e) => { (e.target as HTMLImageElement).src = COVER_PLACEHOLDER; }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-[12px] text-slate-300 truncate font-medium">{game.name}</p>
        <p className="text-xs text-slate-500">{game.platform}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onRestore}
          className="px-2 py-1 rounded-lg text-xs font-medium text-accent-300 hover:bg-accent-500/10 transition-colors"
        >
          Restore
        </button>
        <button
          onClick={onDelete}
          className="px-2 py-1 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const addToast = useUIStore((s) => s.addToast);
  const setCustomStatuses = useUIStore((s) => s.setCustomStatuses);
  const setSettingsDirty = useUIStore((s) => s.setSettingsDirty);
  const settingsUnsavedNav = useUIStore((s) => s.settingsUnsavedNav);
  const setSettingsUnsavedNav = useUIStore((s) => s.setSettingsUnsavedNav);
  const setModeSelectorOpen = useUIStore((s) => s.setModeSelectorOpen);
  const setWhatsNewOpen = useUIStore((s) => s.setWhatsNewOpen);
  const setWhatsNewVersion = useUIStore((s) => s.setWhatsNewVersion);
  const queryClient = useQueryClient();
  const cachedSettings = queryClient.getQueryData<AppSettings>(["settings"]);

  const [settings, setSettings] = useState<AppSettings | null>(cachedSettings ?? null);
  const [editingStatus, setEditingStatus] = useState<number | null>(null);
  const [editLabelValue, setEditLabelValue] = useState("");
  const [newStatusLabel, setNewStatusLabel] = useState("");
  const [newStatusColor, setNewStatusColor] = useState("#60a5fa");
  const [showAddStatus, setShowAddStatus] = useState(false);
  const [checkStatus, setCheckStatus] = useState<"idle" | "checking" | "up-to-date" | "available">("idle");
  const [steamSyncing, setSteamSyncing] = useState(false);
  const [trashedGames, setTrashedGames] = useState<Game[]>([]);
  const [trashLoaded, setTrashLoaded] = useState(false);
  const [fetchingCovers, setFetchingCovers] = useState(false);
  const [themeEditorOpen, setThemeEditorOpen] = useState(false);
  const [editingTheme, setEditingTheme] = useState<CustomTheme | null>(null);
  const [themeName, setThemeName] = useState("");
  const [themeAccent, setThemeAccent] = useState("#7c3aed");
  const [themeBg, setThemeBg] = useState("#07060b");
  const [themeSidebar, setThemeSidebar] = useState("#0c0a12");
  const savedSnapshot = useRef<string>(cachedSettings ? JSON.stringify(cachedSettings) : "");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState("General");
  const dirty = useUIStore((s) => s.settingsDirty);
  const filteredGames = useFilteredGames();

  const customThemes: CustomTheme[] = (() => {
    try { return settings?.custom_themes ? JSON.parse(settings.custom_themes) : []; }
    catch { return []; }
  })();

  const setCustomThemes = (themes: CustomTheme[]) => {
    if (!settings) return;
    setSettings({ ...settings, custom_themes: JSON.stringify(themes) });
  };

  const openThemeEditor = (theme?: CustomTheme) => {
    if (theme) {
      setEditingTheme(theme);
      setThemeName(theme.name);
      setThemeAccent(theme.accent);
      setThemeBg(theme.bg);
      setThemeSidebar(theme.sidebar);
    } else {
      setEditingTheme(null);
      setThemeName("");
      setThemeAccent("#7c3aed");
      setThemeBg("#07060b");
      setThemeSidebar("#0c0a12");
    }
    setThemeEditorOpen(true);
  };

  const closeThemeEditor = () => {
    setThemeEditorOpen(false);
    if (settings) {
      if (settings.theme.startsWith("custom-")) {
        const ct = customThemes.find((c) => `custom-${c.id}` === settings.theme);
        if (ct) applyCustomThemeVars(ct);
        else applyTheme("dark");
      } else {
        applyTheme(settings.theme);
      }
    }
  };

  const saveCustomTheme = () => {
    if (!themeName.trim()) { addToast("Give your theme a name", "error"); return; }
    const id = editingTheme?.id || crypto.randomUUID().slice(0, 8);
    const theme: CustomTheme = { id, name: themeName.trim(), accent: themeAccent, bg: themeBg, sidebar: themeSidebar };
    const existing = customThemes.filter((t) => t.id !== id);
    setCustomThemes([...existing, theme]);
    if (settings) {
      setSettings({ ...settings, theme: `custom-${id}`, custom_themes: JSON.stringify([...existing, theme]) });
    }
    applyCustomThemeVars(theme);
    setThemeEditorOpen(false);
    addToast(`Theme "${theme.name}" saved`, "success");
  };

  const deleteCustomTheme = (id: string) => {
    const updated = customThemes.filter((t) => t.id !== id);
    setCustomThemes(updated);
    if (settings?.theme === `custom-${id}`) {
      setSettings({ ...settings, theme: "dark", custom_themes: JSON.stringify(updated) });
      applyTheme("dark");
    }
    addToast("Theme deleted");
  };

  useEffect(() => {
    if (themeEditorOpen) {
      const preview: CustomTheme = { id: "preview", name: "", accent: themeAccent, bg: themeBg, sidebar: themeSidebar };
      applyCustomThemeVars(preview);
    }
  }, [themeAccent, themeBg, themeSidebar, themeEditorOpen]);

  const { data: querySettings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings(),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const io = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActiveSection((visible[0].target as HTMLElement).dataset.settingsSection ?? "General");
    }, { root, rootMargin: "0px 0px -65% 0px" });
    root.querySelectorAll("[data-settings-section]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [settings === null]);

  useEffect(() => {
    if (querySettings) {
      if (!settings) setSettings(querySettings);
      if (!savedSnapshot.current) savedSnapshot.current = JSON.stringify(querySettings);
    }
  }, [querySettings]);

  useEffect(() => {
    if (settings) {
      const isDirty = JSON.stringify(settings) !== savedSnapshot.current;
      setSettingsDirty(isDirty);
    }
    return () => { setSettingsDirty(false); };
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (s: AppSettings) => api.saveSettings(s),
    onSuccess: () => {
      if (settings) {
        setCustomStatuses(settings.custom_statuses);
        if (settings.theme.startsWith("custom-")) {
          const ct = customThemes.find((c) => `custom-${c.id}` === settings.theme);
          if (ct) applyCustomThemeVars(ct);
        } else {
          applyTheme(settings.theme);
        }
        queryClient.setQueryData(["settings"], settings);
        savedSnapshot.current = JSON.stringify(settings);
      }
      setSettingsDirty(false);
      addToast("Settings saved", "success");
    },
    onError: (e) => addToast(String(e), "error"),
  });

  const loadTrash = async () => {
    try {
      const games = await api.getTrashedGames();
      setTrashedGames(games);
      setTrashLoaded(true);
    } catch (e) {
      addToast(String(e), "error");
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await api.restoreGame(id);
      setTrashedGames((g) => g.filter((x) => x.id !== id));
      addToast("Game restored", "success");
    } catch (e) {
      addToast(String(e), "error");
    }
  };

  const handlePermanentDelete = async (id: string) => {
    try {
      await api.permanentDeleteGame(id);
      setTrashedGames((g) => g.filter((x) => x.id !== id));
      addToast("Game permanently deleted");
    } catch (e) {
      addToast(String(e), "error");
    }
  };

  const handlePurgeTrash = async () => {
    try {
      const count = await api.purgeTrash();
      setTrashedGames([]);
      addToast(`Trash emptied — ${count} game${count !== 1 ? "s" : ""} deleted permanently`);
    } catch (e) {
      addToast(String(e), "error");
    }
  };

  const handleImport = async () => {
    try {
      const selected = await open({ filters: [{ name: "JSON", extensions: ["json"] }] });
      if (typeof selected !== "string") return;
      const result = await api.importLibrary(selected);
      addToast(`Imported ${result.added} games (${result.skipped} skipped)`, result.added > 0 ? "success" : "info");
    } catch (e) {
      addToast(String(e), "error");
    }
  };

  const checkUpdate = async () => {
    setCheckStatus("checking");
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();
      if (update) {
        setCheckStatus("available");
        useUIStore.getState().setPendingUpdate(update);
      } else {
        setCheckStatus("up-to-date");
      }
    } catch {
      setCheckStatus("idle");
      addToast("Could not check for updates", "error");
    }
  };

  const handleFetchCovers = async () => {
    setFetchingCovers(true);
    try {
      const result = await api.fetchMissingCovers();
      addToast(
        result.updated > 0
          ? `Fetched ${result.updated} cover${result.updated !== 1 ? "s" : ""}${result.failed > 0 ? ` (${result.failed} failed)` : ""}`
          : "No missing covers found",
        result.updated > 0 ? "success" : "info"
      );
    } catch (e) {
      addToast(String(e), "error");
    } finally {
      setFetchingCovers(false);
    }
  };

  const handleExport = async () => {
    try {
      const json = await api.exportLibrary();
      const { save } = await import("@tauri-apps/plugin-dialog");
      const path = await save({
        filters: [{ name: "JSON", extensions: ["json"] }],
        defaultPath: `zgamelib-export-${new Date().toISOString().slice(0, 10)}.json`,
      });
      if (!path) return;
      await api.saveFile(path, json);
      addToast("Library exported", "success");
    } catch (e) {
      addToast(String(e), "error");
    }
  };

  const handleExportCsv = async () => {
    try {
      const csv = await api.exportLibraryCsv();
      const { save } = await import("@tauri-apps/plugin-dialog");
      const path = await save({
        filters: [{ name: "CSV", extensions: ["csv"] }],
        defaultPath: `zgamelib-export-${new Date().toISOString().slice(0, 10)}.csv`,
      });
      if (!path) return;
      await api.saveFile(path, csv);
      addToast("Library exported as CSV", "success");
    } catch (e) {
      addToast(String(e), "error");
    }
  };

  const handleExportFiltered = async () => {
    try {
      const ids = filteredGames.map((g) => g.id);
      const json = await api.exportGamesByIds(ids);
      const { save } = await import("@tauri-apps/plugin-dialog");
      const path = await save({
        filters: [{ name: "JSON", extensions: ["json"] }],
        defaultPath: `zgamelib-filtered-${new Date().toISOString().slice(0, 10)}.json`,
      });
      if (!path) return;
      await api.saveFile(path, json);
      addToast(`Exported ${ids.length} game${ids.length !== 1 ? "s" : ""}`, "success");
    } catch (e) {
      addToast(String(e), "error");
    }
  };

  const addStatus = () => {
    if (!settings || !newStatusLabel.trim()) return;
    const key = newStatusLabel.trim().toLowerCase().replace(/\s+/g, "_");
    if (settings.custom_statuses.some((s) => s.key === key)) {
      addToast("Status already exists", "error");
      return;
    }
    setSettings({
      ...settings,
      custom_statuses: [
        ...settings.custom_statuses,
        { key, label: newStatusLabel.trim(), color: newStatusColor },
      ],
    });
    setNewStatusLabel("");
    setShowAddStatus(false);
  };

  const removeStatus = (key: string) => {
    if (!settings) return;
    setSettings({ ...settings, custom_statuses: settings.custom_statuses.filter((s) => s.key !== key) });
  };

  const updateStatus = (index: number, field: keyof StatusConfig, value: string) => {
    if (!settings) return;
    const updated = [...settings.custom_statuses];
    updated[index] = { ...updated[index], [field]: value };
    if (field === "label") updated[index].key = value.toLowerCase().replace(/\s+/g, "_");
    setSettings({ ...settings, custom_statuses: updated });
  };

  const discardChanges = () => {
    if (!savedSnapshot.current) return;
    try {
      const original = JSON.parse(savedSnapshot.current) as AppSettings;
      setSettings(original);
      if (original.theme.startsWith("custom-")) {
        const ct = (JSON.parse(original.custom_themes || "[]") as CustomTheme[]).find((t) => `custom-${t.id}` === original.theme);
        if (ct) applyCustomThemeVars(ct);
        else applyTheme("dark");
      } else {
        applyTheme(original.theme);
      }
    } catch {}
  };

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-5 h-5 rounded-full border-2 border-accent-500/30 border-t-accent-500 animate-spin" />
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto page-enter">
      <div className="flex gap-8 max-w-[1180px] mx-auto px-8 pt-7 pb-32">
        <aside className="w-[210px] shrink-0 hidden lg:block">
          <div className="sticky top-7">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(140deg, rgb(var(--accent-500) / 0.3), rgb(var(--accent-700) / 0.08))", border: "1px solid rgb(var(--accent-400) / 0.25)" }}>
                <SettingsIcon size={20} className="text-accent-300" />
              </div>
              <div>
                <h1 className="text-[22px] font-bold text-white leading-none">Settings</h1>
                <p className="text-[11.5px] text-slate-500 mt-1">v{APP_VERSION}</p>
              </div>
            </div>
            <nav className="flex flex-col gap-0.5">
              {NAV_SECTIONS.map((n) => (
                <button
                  key={n.title}
                  onClick={() => document.getElementById(sectionId(n.title))?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className={cn(
                    "flex items-center gap-2.5 px-3 h-9 rounded-xl text-[13px] text-left transition-colors",
                    activeSection === n.title ? "text-white bg-accent-500/15" : "text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]"
                  )}
                >
                  <span className={cn("w-4 flex justify-center", activeSection === n.title ? "text-accent-300" : "text-slate-500")}>{n.icon}</span>
                  <span className="truncate">{n.title}</span>
                </button>
              ))}
            </nav>
          </div>
        </aside>
      <div className="flex-1 min-w-0">
        <div className="lg:hidden flex items-center gap-3 mb-6">
          <SettingsIcon size={20} className="text-accent-300" />
          <h1 className="text-[22px] font-bold text-white">Settings</h1>
        </div>

        <div className="flex flex-col gap-5">

          <Section title="General" description="Theme and default view" icon={<SparkleIcon size={15} />} delay={0.04}>
            <div className="flex flex-col gap-5">
              <div className="w-48">
                <label className="text-xs text-slate-500 uppercase tracking-[0.14em] font-semibold block mb-2">
                  Default View
                </label>
                <select
                  value={settings.default_view}
                  onChange={(e) => setSettings({ ...settings, default_view: e.target.value })}
                  className="input-glass cursor-pointer"
                >
                  <option value="grid" className="bg-[#0d0c14]">Grid</option>
                  <option value="list" className="bg-[#0d0c14]">List</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-[0.14em] font-semibold block mb-3">
                  Theme
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {([
                    { value: "dark",        label: "Dark",            bg: "#07060b", accent: "#7c3aed" },
                    { value: "amoled",      label: "AMOLED",          bg: "#000000", accent: "#7c3aed" },
                    { value: "nord",        label: "Nord",            bg: "#2e3440", accent: "#5e81ac" },
                    { value: "catppuccin",  label: "Catppuccin",      bg: "#1e1e2e", accent: "#cba6f7" },
                    { value: "dracula",     label: "Dracula",         bg: "#282a36", accent: "#ff79c6" },
                    { value: "gruvbox",     label: "Gruvbox",         bg: "#282828", accent: "#d79921" },
                    { value: "tokyonight",  label: "Tokyo Night",     bg: "#1a1b26", accent: "#7dcfff" },
                  ] as const).map((t) => (
                    <button
                      key={t.value}
                      onClick={() => { clearCustomThemeVars(); setSettings({ ...settings, theme: t.value }); applyTheme(t.value); }}
                      onMouseEnter={() => { clearCustomThemeVars(); applyTheme(t.value); }}
                      onMouseLeave={() => {
                        if (settings.theme.startsWith("custom-")) {
                          const ct = customThemes.find((c) => `custom-${c.id}` === settings.theme);
                          if (ct) applyCustomThemeVars(ct);
                        } else applyTheme(settings.theme);
                      }}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[12px] font-medium transition-all duration-150 border",
                        settings.theme === t.value
                          ? "border-accent-500/50 bg-accent-600/20 text-white"
                          : "border-white/6 bg-white/3 text-slate-400 hover:text-slate-200 hover:border-white/12"
                      )}
                    >
                      <span
                        className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                        style={{ background: `radial-gradient(circle at 30% 30%, ${t.accent}, ${t.bg})` }}
                      />
                      {t.label}
                    </button>
                  ))}

                  {customThemes.map((ct) => (
                    <div key={ct.id} className="relative group">
                      <button
                        onClick={() => { setSettings({ ...settings, theme: `custom-${ct.id}` }); applyCustomThemeVars(ct); }}
                        onMouseEnter={() => applyCustomThemeVars(ct)}
                        onMouseLeave={() => {
                          if (settings.theme.startsWith("custom-")) {
                            const active = customThemes.find((c) => `custom-${c.id}` === settings.theme);
                            if (active) applyCustomThemeVars(active);
                          } else applyTheme(settings.theme);
                        }}
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[12px] font-medium transition-all duration-150 border w-full",
                          settings.theme === `custom-${ct.id}`
                            ? "border-accent-500/50 bg-accent-600/20 text-white"
                            : "border-white/6 bg-white/3 text-slate-400 hover:text-slate-200 hover:border-white/12"
                        )}
                      >
                        <span
                          className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                          style={{ background: `radial-gradient(circle at 30% 30%, ${ct.accent}, ${ct.bg})` }}
                        />
                        <span className="truncate">{ct.name}</span>
                      </button>
                      <div className="absolute -top-1 -right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <button
                          onClick={(e) => { e.stopPropagation(); openThemeEditor(ct); }}
                          className="w-5 h-5 rounded-md flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                          style={{ background: "rgba(0,0,0,0.7)", border: "1px solid rgba(255,255,255,0.1)" }}
                        >
                          <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                            <path d="M11.5 1.5l3 3L5 14H2v-3z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteCustomTheme(ct.id); }}
                          className="w-5 h-5 rounded-md flex items-center justify-center text-slate-400 hover:text-red-400 transition-colors"
                          style={{ background: "rgba(0,0,0,0.7)", border: "1px solid rgba(255,255,255,0.1)" }}
                        >
                          <TrashIcon size={9} />
                        </button>
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={() => openThemeEditor()}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[12px] font-medium transition-all duration-150 border border-dashed border-white/10 text-slate-500 hover:text-slate-300 hover:border-accent-500/30 hover:bg-accent-500/5"
                  >
                    <PlusIcon size={12} />
                    Create Theme
                  </button>
                </div>

                <AnimatePresence>
                  {themeEditorOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div
                        className="mt-4 p-4 rounded-2xl"
                        style={{
                          background: "linear-gradient(135deg, rgb(var(--accent-500) / 0.06) 0%, rgb(var(--accent-900) / 0.04) 100%)",
                          border: "1px solid rgb(var(--accent-500) / 0.15)",
                        }}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-[12px] font-semibold text-white">
                            {editingTheme ? "Edit Theme" : "New Custom Theme"}
                          </span>
                          <button
                            onClick={closeThemeEditor}
                            className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/6 transition-all"
                          >
                            <CloseIcon size={11} />
                          </button>
                        </div>

                        <div className="flex flex-col gap-4">
                          <div>
                            <label className="text-[10px] text-slate-500 uppercase tracking-[0.12em] font-semibold block mb-1.5">Theme Name</label>
                            <input
                              value={themeName}
                              onChange={(e) => setThemeName(e.target.value)}
                              placeholder="My awesome theme…"
                              className="input-glass text-[12px]"
                              maxLength={24}
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-500 uppercase tracking-[0.12em] font-semibold block mb-2">Accent Color</label>
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <input
                                  type="color"
                                  value={themeAccent}
                                  onChange={(e) => setThemeAccent(e.target.value)}
                                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                />
                                <div
                                  className="w-8 h-8 rounded-xl border border-white/15 cursor-pointer transition-transform hover:scale-110"
                                  style={{ background: themeAccent, boxShadow: `0 0 16px ${themeAccent}40` }}
                                />
                              </div>
                              <div className="flex gap-1.5 flex-wrap flex-1">
                                {ACCENT_PRESETS.map((c) => (
                                  <button
                                    key={c}
                                    onClick={() => setThemeAccent(c)}
                                    className={cn(
                                      "w-5 h-5 rounded-lg transition-all duration-150 hover:scale-125",
                                      themeAccent === c ? "ring-2 ring-white/50 scale-110" : "ring-1 ring-white/10"
                                    )}
                                    style={{ background: c }}
                                  />
                                ))}
                              </div>
                            </div>
                            <div className="flex gap-1 mt-2.5">
                              {Object.entries(generateShades(themeAccent)).map(([key, val]) => (
                                <div key={key} className="flex-1 flex flex-col items-center gap-1">
                                  <div
                                    className="w-full h-5 rounded-md"
                                    style={{ background: `rgb(${val})` }}
                                  />
                                  <span className="text-[8px] text-slate-500">{key.replace("--accent-", "")}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] text-slate-500 uppercase tracking-[0.12em] font-semibold block mb-2">Background</label>
                              <div className="flex items-center gap-2">
                                <div className="relative">
                                  <input
                                    type="color"
                                    value={themeBg}
                                    onChange={(e) => { setThemeBg(e.target.value); setThemeSidebar(darkenHex(e.target.value, 3)); }}
                                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                  />
                                  <div
                                    className="w-7 h-7 rounded-lg border border-white/15 cursor-pointer transition-transform hover:scale-110"
                                    style={{ background: themeBg }}
                                  />
                                </div>
                                <div className="flex gap-1 flex-wrap flex-1">
                                  {BG_PRESETS.map((c) => (
                                    <button
                                      key={c}
                                      onClick={() => { setThemeBg(c); setThemeSidebar(darkenHex(c, 3)); }}
                                      className={cn(
                                        "w-4.5 h-4.5 rounded-md transition-all duration-150 hover:scale-125",
                                        themeBg === c ? "ring-2 ring-white/40 scale-110" : "ring-1 ring-white/10"
                                      )}
                                      style={{ background: c }}
                                    />
                                  ))}
                                </div>
                              </div>
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-500 uppercase tracking-[0.12em] font-semibold block mb-2">Sidebar</label>
                              <div className="flex items-center gap-2">
                                <div className="relative">
                                  <input
                                    type="color"
                                    value={themeSidebar}
                                    onChange={(e) => setThemeSidebar(e.target.value)}
                                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                  />
                                  <div
                                    className="w-7 h-7 rounded-lg border border-white/15 cursor-pointer transition-transform hover:scale-110"
                                    style={{ background: themeSidebar }}
                                  />
                                </div>
                                <span className="text-[10px] text-slate-500">Auto-derived from background</span>
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-500 uppercase tracking-[0.12em] font-semibold block mb-2">Preview</label>
                            <div
                              className="rounded-xl overflow-hidden flex h-20"
                              style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                            >
                              <div className="w-14 shrink-0 flex flex-col items-center justify-center gap-1.5 py-2" style={{ background: themeSidebar }}>
                                <div className="w-6 h-6 rounded-lg" style={{ background: themeAccent + "30" }} />
                                <div className="w-6 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }} />
                                <div className="w-6 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }} />
                              </div>
                              <div className="flex-1 p-2.5 flex flex-col gap-1.5" style={{ background: themeBg }}>
                                <div className="flex gap-1.5">
                                  <div className="w-10 h-2 rounded-full" style={{ background: themeAccent }} />
                                  <div className="w-6 h-2 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }} />
                                </div>
                                <div className="flex gap-1.5 flex-1">
                                  {[1, 2, 3].map((i) => (
                                    <div key={i} className="flex-1 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                                      <div className="h-full rounded-lg" style={{ background: `linear-gradient(180deg, ${themeAccent}08, transparent)` }} />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <motion.button
                              whileTap={{ scale: 0.97 }}
                              onClick={saveCustomTheme}
                              className="btn-primary flex-1 justify-center text-[12px] py-2.5"
                            >
                              <CheckIcon size={13} />
                              {editingTheme ? "Update Theme" : "Save Theme"}
                            </motion.button>
                            <motion.button
                              whileTap={{ scale: 0.97 }}
                              onClick={closeThemeEditor}
                              className="btn-ghost text-[12px] py-2.5"
                            >
                              Cancel
                            </motion.button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </Section>

          <Section title="Appearance" description="How the library grid looks" icon={<GridIcon size={15} />} delay={0.06} dataTour="settings-appearance">
            <div className="flex flex-col gap-5">
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-[0.14em] font-semibold block mb-2.5">
                  Grid Columns
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSettings({ ...settings, grid_columns: 0 })}
                    className={cn(
                      "px-3 h-11 rounded-xl text-[12px] font-bold transition-all duration-200 border",
                      settings.grid_columns === 0
                        ? "text-white border-accent-500/50 bg-accent-600/25"
                        : "text-slate-500 border-white/6 bg-white/3 hover:text-slate-300 hover:bg-white/6"
                    )}
                  >
                    Auto
                  </button>
                  {[3, 4, 5, 6].map((n) => (
                    <button
                      key={n}
                      onClick={() => setSettings({ ...settings, grid_columns: n })}
                      className={cn(
                        "w-11 h-11 rounded-xl text-[13px] font-bold transition-all duration-200 border",
                        settings.grid_columns === n
                          ? "text-white border-accent-500/50 bg-accent-600/25"
                          : "text-slate-500 border-white/6 bg-white/3 hover:text-slate-300 hover:bg-white/6"
                      )}
                    >
                      {n}
                    </button>
                  ))}
                  <span className="self-center text-[11px] text-slate-500 ml-1">columns</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] text-slate-300">Show playtime on cards</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Display hours played on each game card</p>
                </div>
                <Toggle
                  value={settings.show_playtime_on_cards}
                  onChange={(v) => setSettings({ ...settings, show_playtime_on_cards: v })}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[13px] text-slate-300">Pagination</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Split the library into pages instead of one long scroll</p>
                  </div>
                  <Toggle
                    value={settings.pagination_enabled}
                    onChange={(v) => setSettings({ ...settings, pagination_enabled: v })}
                  />
                </div>
                <AnimatePresence>
                  {settings.pagination_enabled && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-1">
                        <label className="text-[10px] text-slate-500 uppercase tracking-[0.12em] font-semibold block mb-2">
                          Games per page
                        </label>
                        <div className="flex gap-2 flex-wrap">
                          {[12, 24, 36, 48, 60, 100].map((n) => (
                            <button
                              key={n}
                              onClick={() => setSettings({ ...settings, pagination_page_size: n })}
                              className={cn(
                                "px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-150 border",
                                settings.pagination_page_size === n
                                  ? "border-accent-500/50 bg-accent-600/20 text-white"
                                  : "border-white/6 bg-white/3 text-slate-400 hover:text-slate-200 hover:border-white/12"
                              )}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </Section>

          <Section title="Big Picture & Controllers" description="Saved instantly on this device" icon={<TvIcon size={15} />} delay={0.08}>
            <ControllerSection />
          </Section>

          <Section title="Behavior" description="Scanning, launching and tracking" icon={<SettingsIcon size={15} />} delay={0.1} dataTour="settings-behavior">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] text-slate-300">Auto-scan on startup</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Scan Steam, Epic, GOG & Ubisoft for new games when the app opens</p>
                </div>
                <Toggle
                  value={settings.auto_scan}
                  onChange={(v) => setSettings({ ...settings, auto_scan: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] text-slate-300">Pull uninstalled Steam games on startup</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Automatically import owned but uninstalled Steam games (requires Steam API Key & SteamID64)</p>
                </div>
                <Toggle
                  value={settings.include_uninstalled_steam}
                  onChange={(v) => setSettings({ ...settings, include_uninstalled_steam: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] text-slate-300">Minimize on launch</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Minimize ZGameLib when you launch a game, restore on exit</p>
                </div>
                <Toggle
                  value={settings.minimize_on_launch}
                  onChange={(v) => setSettings({ ...settings, minimize_on_launch: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] text-slate-300">Playtime Reminders</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Notify when you haven't played a game in 30 days</p>
                </div>
                <Toggle
                  value={settings.playtime_reminders}
                  onChange={(v) => setSettings({ ...settings, playtime_reminders: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] text-slate-300">Exclude idle time from playtime</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Automatically deduct time when the game isn't in focus for 5+ minutes</p>
                </div>
                <Toggle
                  value={settings.exclude_idle_time}
                  onChange={(v) => setSettings({ ...settings, exclude_idle_time: v })}
                />
              </div>
            </div>
          </Section>

          <Section title="System" description="Startup and window behavior" icon={<PowerIcon size={15} />} delay={0.12}>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] text-slate-300">Launch on Windows startup</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Start ZGameLib automatically when you log in</p>
                </div>
                <Toggle
                  value={settings.autostart}
                  onChange={(v) => setSettings({ ...settings, autostart: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] text-slate-300">Start minimized</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Open in the taskbar instead of the foreground</p>
                </div>
                <Toggle
                  value={settings.start_minimized}
                  onChange={(v) => setSettings({ ...settings, start_minimized: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] text-slate-300">Close to tray</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Clicking ✕ hides the window — right-click the tray icon to quit</p>
                </div>
                <Toggle
                  value={settings.close_to_tray}
                  onChange={(v) => setSettings({ ...settings, close_to_tray: v })}
                />
              </div>
            </div>
          </Section>

          <Section title="Platform Paths" description="Only needed if auto-detection fails" icon={<GamepadIcon size={15} />} delay={0.14}>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-[0.14em] font-semibold block mb-2">
                  Steam Path Override
                </label>
                <input
                  value={settings.steam_path ?? ""}
                  onChange={(e) => setSettings({ ...settings, steam_path: e.target.value || null })}
                  placeholder="Auto-detected from registry"
                  className="input-glass text-[12px] font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-[0.14em] font-semibold block mb-2">
                  Epic Path Override
                </label>
                <input
                  value={settings.epic_path ?? ""}
                  onChange={(e) => setSettings({ ...settings, epic_path: e.target.value || null })}
                  placeholder="Auto-detected"
                  className="input-glass text-[12px] font-mono"
                />
              </div>
            </div>
          </Section>

          <Section title="Game Statuses" description="Your progress labels" icon={<span className="w-3 h-3 rounded-full bg-accent-400 inline-block" />} delay={0.12}>
            <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
              Drag rows to reorder. Click a label to rename. These appear throughout the app to track progress.
            </p>

            <Reorder.Group
              axis="y"
              values={settings.custom_statuses}
              onReorder={(newOrder) => setSettings({ ...settings, custom_statuses: newOrder })}
              className="flex flex-col gap-1.5 mb-3"
            >
              <AnimatePresence>
                {settings.custom_statuses.map((status, i) => (
                  <Reorder.Item
                    key={status.key}
                    value={status}
                    className="group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-grab active:cursor-grabbing transition-colors"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.05)",
                    }}
                    whileDrag={{ scale: 1.02, boxShadow: "0 8px 30px rgba(0,0,0,0.4)" }}
                  >
                    <div className="text-slate-600 shrink-0">
                      <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor">
                        <circle cx="2" cy="2" r="1.2" /><circle cx="6" cy="2" r="1.2" />
                        <circle cx="2" cy="7" r="1.2" /><circle cx="6" cy="7" r="1.2" />
                        <circle cx="2" cy="12" r="1.2" /><circle cx="6" cy="12" r="1.2" />
                      </svg>
                    </div>

                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        if (editingStatus === i) { setEditingStatus(null); }
                        else { setEditingStatus(i); setEditLabelValue(status.label); }
                      }}
                      className="w-3.5 h-3.5 rounded-full border border-white/10 shrink-0 transition-transform hover:scale-125"
                      style={{ backgroundColor: status.color }}
                    />

                    {editingStatus === i ? (
                      <input
                        autoFocus
                        value={editLabelValue}
                        onChange={(e) => setEditLabelValue(e.target.value)}
                        onBlur={() => { updateStatus(i, "label", editLabelValue); setEditingStatus(null); }}
                        onKeyDown={(e) => { if (e.key === "Enter") { updateStatus(i, "label", editLabelValue); setEditingStatus(null); } }}
                        className="input-glass flex-1 text-[12px] py-1"
                      />
                    ) : (
                      <span
                        className="flex-1 text-[13px] text-slate-300 cursor-text hover:text-white transition-colors"
                        onClick={() => { setEditingStatus(i); setEditLabelValue(status.label); }}
                      >
                        {status.label}
                      </span>
                    )}

                    {editingStatus === i && (
                      <div className="flex gap-1 shrink-0">
                        {COLOR_PRESETS.map((c) => (
                          <button
                            key={c}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => updateStatus(i, "color", c)}
                            className={cn(
                              "w-3.5 h-3.5 rounded-full transition-transform hover:scale-125",
                              status.color === c ? "ring-2 ring-white/40 scale-110" : ""
                            )}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    )}

                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={() => removeStatus(status.key)}
                      className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 shrink-0"
                    >
                      <TrashIcon size={11} />
                    </motion.button>
                  </Reorder.Item>
                ))}
              </AnimatePresence>
            </Reorder.Group>

            <AnimatePresence>
              {showAddStatus && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div
                    className="p-3 rounded-xl mb-2"
                    style={{ background: "rgb(var(--accent-500) /0.06)", border: "1px solid rgb(var(--accent-500) /0.15)" }}
                  >
                    <div className="flex items-center gap-2">
                      <button
                        className="w-4 h-4 rounded-full border border-white/15 shrink-0 transition-transform hover:scale-110"
                        style={{ backgroundColor: newStatusColor }}
                        onClick={() => {
                          const idx = COLOR_PRESETS.indexOf(newStatusColor);
                          setNewStatusColor(COLOR_PRESETS[(idx + 1) % COLOR_PRESETS.length]);
                        }}
                      />
                      <input
                        autoFocus
                        value={newStatusLabel}
                        onChange={(e) => setNewStatusLabel(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addStatus()}
                        placeholder="Status name…"
                        className="input-glass flex-1 text-[12px] py-1.5"
                      />
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={addStatus}
                        disabled={!newStatusLabel.trim()}
                        className="btn-primary text-[11px] py-1.5 px-3 disabled:opacity-30 shrink-0"
                      >
                        Add
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setShowAddStatus(false)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/6 transition-all shrink-0"
                      >
                        <CloseIcon size={11} />
                      </motion.button>
                    </div>
                    <div className="flex gap-1.5 mt-2.5 flex-wrap">
                      {COLOR_PRESETS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setNewStatusColor(c)}
                          className={cn(
                            "w-4 h-4 rounded-full transition-transform hover:scale-125",
                            newStatusColor === c ? "ring-2 ring-white/40 scale-110" : ""
                          )}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => setShowAddStatus(!showAddStatus)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[12px] text-slate-500 hover:text-slate-300 transition-all"
              style={{ border: "1px dashed rgba(255,255,255,0.08)" }}
            >
              <PlusIcon size={12} />
              Add status
            </motion.button>
          </Section>

          <Section title="Integrations" description="IGDB metadata and Steam playtime sync" icon={<GlobeIcon size={15} />} delay={0.15} dataTour="settings-integrations">
            <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
              Connect third-party services to enrich your library with metadata.
            </p>
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-[11px] font-semibold text-slate-400 mb-1">IGDB</p>
                <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">
                  Fetches genre, developer, publisher, and release year for any game.
                </p>
                <div className="text-[11px] text-slate-500 mb-3 leading-relaxed space-y-1">
                  <p className="text-[10px] text-slate-500 uppercase tracking-[0.1em] font-semibold mb-1.5">How to get your keys</p>
                  <p>1. Go to{" "}
                    <button type="button" onClick={() => api.openUrl("https://dev.twitch.tv/console/apps/create").catch(() => {})} className="text-accent-400 hover:text-accent-300 underline underline-offset-2">
                      dev.twitch.tv/console
                    </button>
                    {" "}and sign in with a Twitch account (free).
                  </p>
                  <p>2. Click <span className="text-slate-400 font-medium">Register Your Application</span>. Name it anything.</p>
                  <p>3. For <span className="text-slate-400 font-medium">OAuth Redirect URL</span> enter <span className="text-slate-300 font-mono bg-white/[0.05] px-1 rounded">http://localhost</span> — this field is required but ZGameLib never uses it.</p>
                  <p>4. Category: pick <span className="text-slate-400 font-medium">Other</span>. Click Create.</p>
                  <p>5. Copy the <span className="text-slate-400 font-medium">Client ID</span> shown, then click <span className="text-slate-400 font-medium">New Secret</span> to generate a Client Secret.</p>
                  <p>6. Paste both below and save.</p>
                </div>
                <div className="flex flex-col gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase tracking-[0.12em] font-semibold block mb-1.5">Client ID</label>
                    <input
                      type="text"
                      value={settings.igdb_client_id ?? ""}
                      onChange={(e) => setSettings({ ...settings, igdb_client_id: e.target.value || null })}
                      placeholder="Twitch Client ID"
                      className="input-glass text-[12px] font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase tracking-[0.12em] font-semibold block mb-1.5">Client Secret</label>
                    <input
                      type="password"
                      value={settings.igdb_client_secret ?? ""}
                      onChange={(e) => setSettings({ ...settings, igdb_client_secret: e.target.value || null })}
                      placeholder="Twitch Client Secret"
                      className="input-glass text-[12px] font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-white/[0.04]">
                <p className="text-[11px] font-semibold text-slate-400 mb-1">Steam Playtime Sync</p>
                <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
                  Pull your official Steam playtime into ZGameLib. Only increases local values — it never overwrites hours tracked here. Requires a free Steam Web API key and your SteamID64.
                </p>
                <div className="flex flex-col gap-3 mb-3">
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase tracking-[0.12em] font-semibold block mb-1.5">Steam Web API Key</label>
                    <input
                      type="text"
                      value={settings.steam_api_key ?? ""}
                      onChange={(e) => setSettings({ ...settings, steam_api_key: e.target.value || null })}
                      placeholder="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                      className="input-glass text-[12px] font-mono"
                    />
                    <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                      A free key tied to your Steam account. To get one: go to{" "}
                      <span className="text-accent-400 select-all">store.steampowered.com/dev/apikey</span>
                      , log in, and enter any name (e.g. "ZGameLib") as the domain. The key is a 32-character string.
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase tracking-[0.12em] font-semibold block mb-1.5">SteamID64</label>
                    <input
                      type="text"
                      value={settings.steam_id_64 ?? ""}
                      onChange={(e) => setSettings({ ...settings, steam_id_64: e.target.value || null })}
                      placeholder="76561198XXXXXXXXX"
                      className="input-glass text-[12px] font-mono"
                    />
                    <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                      Your unique 17-digit Steam account ID — not your username or vanity URL. To find it: go to{" "}
                      <span className="text-accent-400 select-all">steamidfinder.com</span>
                      , enter your Steam profile URL or username, and copy the SteamID64 value.
                    </p>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={steamSyncing || !settings.steam_api_key || !settings.steam_id_64}
                  onClick={async () => {
                    if (!settings.steam_api_key || !settings.steam_id_64) return;
                    setSteamSyncing(true);
                    try {
                      const result = await api.syncSteamPlaytime(settings.steam_api_key, settings.steam_id_64);
                      addToast(`${result.updated} games updated, ${result.skipped} skipped`, "success");
                    } catch (e) {
                      addToast(String(e), "error");
                    } finally {
                      setSteamSyncing(false);
                    }
                  }}
                  className="btn-ghost w-full justify-center text-[12px] disabled:opacity-50"
                >
                  {steamSyncing ? (
                    <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                      <SparkleIcon size={13} />
                    </motion.span>
                  ) : (
                    <SparkleIcon size={13} />
                  )}
                  {steamSyncing ? "Syncing…" : "Sync Steam Playtime"}
                </motion.button>
              </div>
            </div>
          </Section>

          <div className="grid grid-cols-2 gap-5">
            <Section title="Data" description="Backup, import and export" icon={<DownloadIcon size={15} />} delay={0.2} dataTour="settings-data">
              <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
                Export your library as JSON or restore from a backup.
              </p>
              <div className="flex flex-col gap-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleExport}
                  className="btn-ghost w-full justify-center text-[12px]"
                >
                  <DownloadIcon size={13} />
                  Export
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleImport}
                  className="btn-ghost w-full justify-center text-[12px]"
                >
                  <PlusIcon size={13} />
                  Import
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleFetchCovers}
                  disabled={fetchingCovers}
                  className="btn-ghost w-full justify-center text-[12px] disabled:opacity-50"
                >
                  {fetchingCovers ? (
                    <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                      <DownloadIcon size={13} />
                    </motion.span>
                  ) : (
                    <DownloadIcon size={13} />
                  )}
                  {fetchingCovers ? "Fetching covers…" : "Fetch Missing Covers"}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleExportCsv}
                  className="btn-ghost w-full justify-center text-[12px]"
                >
                  <DownloadIcon size={13} />
                  Export as CSV
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleExportFiltered}
                  className="btn-ghost w-full justify-center text-[12px]"
                >
                  <DownloadIcon size={13} />
                  Export Filtered ({filteredGames.length})
                </motion.button>
              </div>
            </Section>

            <Section title="Trash" description="Recently removed games" icon={<TrashIcon size={15} />} delay={0.21}>
              <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
                Deleted games are kept here. Restore or permanently delete them.
              </p>
              {!trashLoaded ? (
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  onClick={loadTrash}
                  className="btn-ghost w-full justify-center text-[12px]"
                >
                  <TrashIcon size={13} />
                  View Trash
                </motion.button>
              ) : trashedGames.length === 0 ? (
                <p className="text-[11px] text-slate-500 text-center py-3">Trash is empty</p>
              ) : (
                <>
                  <div className="max-h-[260px] overflow-y-auto mb-3">
                    {trashedGames.map((g) => (
                      <TrashedGameRow
                        key={g.id}
                        game={g}
                        onRestore={() => handleRestore(g.id)}
                        onDelete={() => handlePermanentDelete(g.id)}
                      />
                    ))}
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={handlePurgeTrash}
                    className="btn-ghost w-full justify-center text-[12px] text-red-400 hover:border-red-500/20"
                  >
                    <TrashIcon size={13} />
                    Empty Trash ({trashedGames.length})
                  </motion.button>
                </>
              )}
            </Section>

          <div className="col-span-2">
            <Section title="About" description="Version, updates and help" icon={<InfoIcon size={15} />} delay={0.22}>
              <div className="flex flex-col items-center text-center gap-3 py-1">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, rgb(var(--accent-600)), rgb(var(--accent-400)))", boxShadow: "0 4px 16px rgb(var(--accent-600) / 0.35)" }}
                >
                  <GamepadIcon size={16} className="text-white" />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-white">ZGameLib</p>
                  <p className="text-[11px] text-slate-500">v{APP_VERSION}</p>
                </div>
                <p className="text-[11px] text-slate-500">
                  Made by{" "}
                  <button
                    onClick={() => api.openUrl("https://github.com/TheHolyOneZ")}
                    className="text-accent-400 hover:text-accent-300 transition-colors"
                  >
                    TheHolyOneZ
                  </button>
                </p>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => api.openUrl("https://zsync.eu/zgamelib/")}
                  className="btn-ghost w-full justify-center text-[12px]"
                >
                  <GlobeIcon size={13} />
                  Website
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={checkUpdate}
                  disabled={checkStatus ==="checking"}
                  className="btn-ghost w-full justify-center text-[12px] disabled:opacity-50"
                >
                  {checkStatus ==="checking" ? (
                    <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                      <SettingsIcon size={13} />
                    </motion.span>
                  ) : checkStatus ==="available" ? (
                    <span className="text-green-400">↑</span>
                  ) : checkStatus ==="up-to-date" ? (
                    <CheckIcon size={13} className="text-green-400" />
                  ) : (
                    <DownloadIcon size={13} />
                  )}
                  {checkStatus === "checking" ? "Checking…" : checkStatus === "available" ? "Update ready — see banner" : checkStatus === "up-to-date" ? "Up to date" : "Check for Updates"}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={async () => {
                    try {
                      const lines = await api.getLogContents();
                      await navigator.clipboard.writeText(lines.join('\n'));
                      addToast("Logs copied to clipboard", "success");
                    } catch {
                      addToast("Failed to copy logs", "error");
                    }
                  }}
                  className="btn-ghost w-full justify-center text-[12px]"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  Copy Logs
                </motion.button>
                <div className="w-full h-px bg-white/[0.05] my-1" />
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setModeSelectorOpen(true)}
                  className="btn-ghost w-full justify-center text-[12px]"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L15 8.5L22 9.5L17 14.5L18.5 21.5L12 18L5.5 21.5L7 14.5L2 9.5L9 8.5L12 2Z"/>
                  </svg>
                  Take the Tour
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { setWhatsNewVersion(APP_VERSION); setWhatsNewOpen(true); }}
                  className="btn-ghost w-full justify-center text-[12px]"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 8V12M12 16h.01"/>
                  </svg>
                  What's New
                </motion.button>
              </div>
            </Section>
          </div>
          </div>

          <section className="pt-2">
            <PromoCards />
          </section>

        </div>
      </div>

      </div>

      <AnimatePresence>
        {dirty && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 pl-5 pr-2 py-2 rounded-2xl glass-strong"
            style={{ boxShadow: "0 20px 50px -10px rgba(0,0,0,0.8), 0 0 0 1px rgb(var(--accent-400) / 0.25)" }}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[13px] text-slate-200">You have unsaved changes</span>
            <button onClick={discardChanges} className="btn-ghost h-9 py-0 text-[12.5px]">Discard</button>
            <button onClick={() => saveMutation.mutate(settings)} disabled={saveMutation.isPending} className="btn-primary h-9 py-0 text-[12.5px]">
              <CheckIcon size={13} />
              {saveMutation.isPending ? "Saving…" : "Save changes"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {settingsUnsavedNav && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSettingsUnsavedNav(null)}
              className="fixed inset-0 z-[60]"
              style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(12px)" }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.88, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 8 }}
              transition={{ type: "spring", stiffness: 420, damping: 30 }}
              className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none"
            >
              <div
                className="pointer-events-auto rounded-3xl p-7 w-full max-w-[380px] mx-4"
                style={{
                  background: "linear-gradient(145deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)",
                  border: "1px solid rgb(var(--accent-500) / 0.2)",
                  boxShadow: "0 0 60px rgb(var(--accent-500) / 0.1), 0 30px 60px rgba(0,0,0,0.6)",
                  backdropFilter: "blur(40px) saturate(180%)",
                }}
              >
                <div className="flex items-start gap-4 mb-5">
                  <motion.div
                    initial={{ rotate: -12, scale: 0.8 }}
                    animate={{ rotate: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                    style={{
                      background: "linear-gradient(135deg, rgb(var(--accent-500) / 0.2), rgb(var(--accent-700) / 0.1))",
                      border: "1px solid rgb(var(--accent-400) / 0.2)",
                      boxShadow: "0 0 24px rgb(var(--accent-500) / 0.15)",
                    }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-accent-400">
                      <path d="M12 9v4m0 3h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </motion.div>
                  <div>
                    <h3 className="text-[15px] font-bold text-white mb-1.5">Unsaved Changes</h3>
                    <p className="text-[13px] text-slate-400 leading-relaxed">
                      You have unsaved settings. Save them before leaving or discard your changes.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      const nav = settingsUnsavedNav;
                      setSettingsUnsavedNav(null);
                      setSettingsDirty(false);
                      if (savedSnapshot.current) {
                        try {
                          const original = JSON.parse(savedSnapshot.current);
                          setSettings(original);
                          if (original.theme.startsWith("custom-")) {
                            const ct = JSON.parse(original.custom_themes || "[]").find((t: CustomTheme) => `custom-${t.id}` === original.theme);
                            if (ct) applyCustomThemeVars(ct);
                            else applyTheme("dark");
                          } else {
                            applyTheme(original.theme);
                          }
                        } catch { applyTheme("dark"); }
                      }
                      nav.proceed();
                    }}
                    className="flex-1 justify-center flex items-center gap-2 font-medium px-4 py-2.5 rounded-xl text-[13px] transition-all duration-200 cursor-pointer text-slate-300"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    Discard
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      const nav = settingsUnsavedNav;
                      setSettingsUnsavedNav(null);
                      if (settings) {
                        saveMutation.mutate(settings, {
                          onSuccess: () => {
                            setSettingsDirty(false);
                            nav.proceed();
                          },
                        });
                      }
                    }}
                    className="flex-1 justify-center flex items-center gap-2 font-semibold px-4 py-2.5 rounded-xl text-[13px] transition-all duration-200 cursor-pointer text-white"
                    style={{
                      background: "linear-gradient(135deg, rgb(var(--accent-600)), rgb(var(--accent-700)))",
                      border: "1px solid rgb(var(--accent-400) / 0.3)",
                      boxShadow: "0 0 24px rgb(var(--accent-500) / 0.2)",
                    }}
                  >
                    <CheckIcon size={14} />
                    Save & Leave
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
