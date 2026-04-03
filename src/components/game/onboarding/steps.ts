import { useGameStore } from "@/store/useGameStore";

export type TourCardPosition = "top" | "bottom" | "left" | "right" | "center";

export interface TourStep {
  id: string;
  title: string;
  body: string;
  hint?: string;
  target?: string;
  cardPosition?: TourCardPosition;
  before?: () => Promise<void>;
  afterRender?: () => Promise<void>;
  after?: () => Promise<void>;
  chapter?: string;
}

export interface TourDeps {
  navigate: (path: string) => void;
  setSelectedGameId: (id: string | null) => void;
  setDetailOpen: (v: boolean) => void;
  setAddGameOpen: (v: boolean) => void;
  triggerScan: () => void;
}

function raf(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function openScanDropdown() {
  window.dispatchEvent(new Event("tour:scan-menu-open"));
}

function closeScanDropdown() {
  window.dispatchEvent(new Event("tour:scan-menu-close"));
}

function openContextMenuOn(selector: string) {
  const wrapper = document.querySelector(selector);
  if (!wrapper) return;
  const target = wrapper.querySelector("img") ?? wrapper.querySelector("div") ?? wrapper;
  const rect = wrapper.getBoundingClientRect();
  const evt = new MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    clientX: rect.left + rect.width * 0.55,
    clientY: rect.top + rect.height * 0.35,
    view: window,
  });
  target.dispatchEvent(evt);
}

function closeContextMenu() {
  const body = document.body;
  body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, view: window }));
}

function clickElement(selector: string) {
  const el = document.querySelector(selector) as HTMLElement | null;
  el?.click();
}

function getFirstGame() {
  return useGameStore.getState().games[0] ?? null;
}

export function getAllSteps(deps: TourDeps): TourStep[] {
  const { navigate, setSelectedGameId, setDetailOpen, setAddGameOpen, triggerScan } = deps;

  return [
    {
      id: "welcome",
      title: "Welcome to ZGameLib",
      body: "Your personal game library — offline, private, and fully yours. Track playtime, organize collections, and launch every game from one beautiful interface.",
      cardPosition: "center",
      chapter: "Start",
      before: async () => {
        navigate("/");
        await raf();
        triggerScan();
      },
    },

    {
      id: "scan-btn",
      title: "Scan for Games",
      body: "This scans your PC for installed Steam, Epic, and GOG games. Only these three platforms are auto-detected — for ROMs, indie installs, emulators, or anything else, use the Add Game button instead.",
      target: '[data-tour="scan-btn"]',
      cardPosition: "bottom",
      chapter: "Getting Games In",
      before: async () => {
        navigate("/");
        setDetailOpen(false);
        setAddGameOpen(false);
        await raf();
        openScanDropdown();
        await wait(300);
      },
      after: async () => {
        closeScanDropdown();
        await wait(150);
      },
    },

    {
      id: "scan-dropdown",
      title: "Scan Options",
      body: "The dropdown gives you two choices: Scan Installed Games detects what's on your disk right now. Pull Uninstalled Steam Games imports your entire Steam library — even games you haven't downloaded yet.",
      target: '[data-tour="scan-dropdown"]',
      cardPosition: "left",
      chapter: "Getting Games In",
      before: async () => {
        navigate("/");
        setDetailOpen(false);
        await raf();
        openScanDropdown();
        await wait(300);
      },
      after: async () => {
        closeScanDropdown();
        await wait(150);
      },
    },

    {
      id: "add-game-btn",
      title: "Add Games Manually",
      body: "For anything the scanner can't detect — ROMs, indie games, DRM-free titles, emulators, or custom executables. You can add a single game or bulk-scan an entire folder.",
      target: '[data-tour="add-game-btn"]',
      cardPosition: "bottom",
      chapter: "Getting Games In",
      before: async () => {
        navigate("/");
        closeScanDropdown();
        setDetailOpen(false);
        await raf();
      },
    },

    {
      id: "add-game-modal",
      title: "Single & Bulk Add",
      body: "Single mode: pick a name and an exe. Bulk mode: point to a folder and every subfolder's main exe is auto-detected. Cover art is fetched automatically for both.",
      target: '[data-tour="add-game-modal"]',
      cardPosition: "right",
      chapter: "Getting Games In",
      before: async () => {
        setAddGameOpen(true);
        await wait(450);
      },
      after: async () => {
        setAddGameOpen(false);
        await wait(300);
      },
    },

    {
      id: "igdb-scan-btn",
      title: "Bulk IGDB Metadata",
      body: "One click fetches genre, developer, publisher, and release year from IGDB for every game that's missing metadata. Requires IGDB credentials in Settings.",
      target: '[data-tour="igdb-scan-btn"]',
      cardPosition: "bottom",
      chapter: "Getting Games In",
      before: async () => {
        navigate("/");
        setDetailOpen(false);
        setAddGameOpen(false);
        closeScanDropdown();
        await raf();
      },
    },

    {
      id: "dedup-btn",
      title: "Remove Duplicates",
      body: "If you scanned multiple sources and got the same game twice, this button detects duplicates by name and hides the extras. You can always unhide them later.",
      target: '[data-tour="dedup-btn"]',
      cardPosition: "bottom",
      chapter: "Getting Games In",
    },

    {
      id: "log-btn",
      title: "Scan Log",
      body: "Shows a live log of what the scanner found and any errors. Useful to check if a game was detected or if something went wrong during a scan.",
      target: '[data-tour="log-btn"]',
      cardPosition: "bottom",
      chapter: "Getting Games In",
    },

    {
      id: "game-grid",
      title: "Your Library",
      body: "Every game you add lives here. Click any card to open its detail panel. The grid adapts to your window size or you can set fixed columns in Settings.",
      target: '[data-tour="game-grid"]',
      cardPosition: "top",
      chapter: "The Library",
      before: async () => {
        navigate("/");
        setDetailOpen(false);
        setAddGameOpen(false);
        await raf();
      },
    },

    {
      id: "list-view",
      title: "View Modes",
      body: "Switch between grid and list view. List view shows compact rows with thumbnail, name, status, tags, playtime, and rating — great for scanning a large library quickly.",
      target: '[data-tour="view-toggle"]',
      cardPosition: "bottom",
      chapter: "The Library",
    },

    {
      id: "sort-key",
      title: "Sorting",
      body: "Sort by name, rating, last played, date added, playtime, or Custom Order. Custom Order enables drag-and-drop — arrange your cards in any layout you want.",
      target: '[data-tour="sort-key"]',
      cardPosition: "bottom",
      chapter: "The Library",
    },

    {
      id: "search-input",
      title: "Search",
      body: "Live search as you type. The A/A+ scope toggle inside the input switches between name-only and name + description search.",
      hint: "Shortcut: /",
      target: '[data-tour="search-input"]',
      cardPosition: "bottom",
      chapter: "The Library",
    },

    {
      id: "command-palette",
      title: "Command Palette",
      body: "Fuzzy search across your entire library plus quick actions — all in one overlay. Works from any page, any time.",
      hint: "Shortcut: Ctrl + K",
      cardPosition: "center",
      chapter: "The Library",
    },

    {
      id: "sidebar-platform",
      title: "Platform & Status Filters",
      body: "Click any badge to filter instantly. Click again to deselect. Each badge shows a count so you know how many games match before you click.",
      target: '[data-tour="sidebar-platform"]',
      cardPosition: "right",
      chapter: "Filtering",
      before: async () => {
        navigate("/");
        setDetailOpen(false);
        await raf();
      },
    },

    {
      id: "sidebar-advanced",
      title: "Advanced Filter Builder",
      body: "Build multi-rule filters like \"Rating >= 8 AND Status = Backlog\". Every field supports multiple operators. AND/OR toggle applies across all rules.",
      target: '[data-tour="sidebar-advanced"]',
      cardPosition: "right",
      chapter: "Filtering",
    },

    {
      id: "right-click",
      title: "Right-Click Menu",
      body: "Play, Open Folder, Favorite, Pin, Copy Name, View Details, and a full Collections submenu — all without opening the detail panel.",
      target: '[data-tour="game-card-first"]',
      cardPosition: "right",
      chapter: "Game Cards",
      before: async () => {
        navigate("/");
        setDetailOpen(false);
        closeContextMenu();
        await raf();
        await wait(300);
      },
      afterRender: async () => {
        await wait(350);
        openContextMenuOn('[data-tour="game-card-first"]');
        await wait(200);
      },
      after: async () => {
        closeContextMenu();
        await wait(150);
      },
    },

    {
      id: "pinned-row",
      title: "Pinned Games",
      body: "Right-click any game and select Pin. Pinned games appear in a persistent strip above the grid — always one click away, no matter what filters are active.",
      cardPosition: "center",
      chapter: "Game Cards",
      before: async () => {
        navigate("/");
        setDetailOpen(false);
        closeContextMenu();
        await raf();
      },
    },

    {
      id: "batch-select",
      title: "Batch Multi-Select",
      body: "Hold-click the checkbox on any card to start multi-selection. A batch bar slides up: set status, rate, tag, add to collection, or delete — all at once.",
      target: '[data-tour="game-card-first"]',
      cardPosition: "right",
      chapter: "Game Cards",
    },

    {
      id: "exe-health",
      title: "Exe Health Badge",
      body: "If a game's exe was moved or deleted, an amber badge appears on the card. Open the detail panel to update the path and the badge disappears.",
      cardPosition: "center",
      chapter: "Game Cards",
    },

    {
      id: "game-detail",
      title: "Game Detail Panel",
      body: "The command center for each game. Rate 1-10, set status, add tags, write a description, and see all metadata at a glance.",
      target: '[data-tour="game-detail"]',
      cardPosition: "left",
      chapter: "Game Detail",
      before: async () => {
        navigate("/");
        closeContextMenu();
        const game = getFirstGame();
        if (game) {
          setSelectedGameId(game.id);
          setDetailOpen(true);
        }
        await raf();
        await wait(450);
      },
    },

    {
      id: "play-btn",
      title: "Launch & Track",
      body: "Hit Play and playtime tracking starts automatically. When you close the game, the session is saved and stats update. Idle time is excluded by default — no inflated hours.",
      target: '[data-tour="play-btn"]',
      cardPosition: "left",
      chapter: "Game Detail",
    },

    {
      id: "hltb-btn",
      title: "HowLongToBeat",
      body: "Click the clock icon to fetch time-to-beat estimates from HowLongToBeat. Shows main story and completionist times so you know what you're getting into.",
      target: '[data-tour="hltb-btn"]',
      cardPosition: "left",
      chapter: "Game Detail",
    },

    {
      id: "igdb-btn",
      title: "IGDB Metadata",
      body: "Click the search icon to fetch genre, developer, publisher, and release year from IGDB. Requires IGDB Client ID and Secret set up in Settings → Integrations.",
      target: '[data-tour="igdb-btn"]',
      cardPosition: "left",
      chapter: "Game Detail",
    },

    {
      id: "detail-info",
      title: "Info Tab",
      body: "The default view — rate your game, set a status, add tags, edit the description. Notes live here too: timestamped, Markdown-enabled, one per session or topic.",
      target: '[data-tour="detail-tab-info"]',
      cardPosition: "left",
      chapter: "Game Detail",
      before: async () => {
        clickElement('[data-tour="detail-tab-info"]');
        await raf();
      },
    },

    {
      id: "detail-screenshots",
      title: "Screenshots",
      body: "All Steam screenshots for this game in a masonry grid. Click any to open a full-screen lightbox with arrow key navigation.",
      target: '[data-tour="detail-tab-screenshots"]',
      cardPosition: "left",
      chapter: "Game Detail",
      before: async () => {
        clickElement('[data-tour="detail-tab-screenshots"]');
        await raf();
      },
    },

    {
      id: "detail-history",
      title: "Play History",
      body: "Every play session with start time, duration, and date. Sessions are recorded automatically whenever you launch and close games through ZGameLib.",
      target: '[data-tour="detail-tab-history"]',
      cardPosition: "left",
      chapter: "Game Detail",
      before: async () => {
        clickElement('[data-tour="detail-tab-history"]');
        await raf();
      },
    },

    {
      id: "detail-mods",
      title: "Mod Manager",
      body: "Only visible for games with an install directory. Detects BepInEx and MelonLoader automatically. One-click install/uninstall. Add mods via file picker.",
      target: '[data-tour="detail-tab-mods"]',
      cardPosition: "left",
      chapter: "Game Detail",
      before: async () => {
        clickElement('[data-tour="detail-tab-mods"]');
        await raf();
      },
    },

    {
      id: "collections",
      title: "Collections",
      body: "Group games any way you like — \"Weekend Chill\", \"Masterpieces\", \"Co-op Night\". A game can belong to multiple collections. Add via right-click or the detail panel.",
      target: '[data-tour="nav-collections"]',
      cardPosition: "right",
      chapter: "Pages",
      before: async () => {
        setDetailOpen(false);
        await wait(250);
        navigate("/collections");
        await raf();
      },
    },

    {
      id: "stats",
      title: "Stats Dashboard",
      body: "Platform breakdown, status pie chart, top rated, most neglected, weekly playtime graph, library growth timeline, and completion rate. Every card is clickable.",
      target: '[data-tour="nav-stats"]',
      cardPosition: "right",
      chapter: "Pages",
      before: async () => {
        navigate("/stats");
        await raf();
      },
    },

    {
      id: "wrapped",
      title: "Year in Review",
      body: "Your annual gaming recap: total hours played, most played game, top rated, games completed, busiest month, and platform split. Select any year from the dropdown.",
      target: '[data-tour="nav-wrapped"]',
      cardPosition: "right",
      chapter: "Pages",
      before: async () => {
        navigate("/wrapped");
        await raf();
      },
    },

    {
      id: "spin",
      title: "Game Spin",
      body: "Can't decide what to play? A full roulette wheel with every game as a segment. Filter the pool by platform, tag, favorites, or search — then spin the wheel. The winner shows a Play Now button, cover art, and recent session history.",
      target: '[data-tour="nav-spin"]',
      cardPosition: "right",
      chapter: "Pages",
      before: async () => {
        navigate("/spin");
        await raf();
      },
    },

    {
      id: "settings-appearance",
      title: "Appearance",
      body: "7 built-in themes plus a Custom Theme Creator with full color control. Grid columns: fixed 3-6 or Auto. Pagination with configurable page size.",
      target: '[data-tour="settings-appearance"]',
      cardPosition: "right",
      chapter: "Settings",
      before: async () => {
        navigate("/settings");
        await raf();
        await wait(250);
      },
    },

    {
      id: "settings-behavior",
      title: "Behavior",
      body: "Minimize on game launch, idle detection, auto-scan on startup, close to tray, and playtime reminders. Tune ZGameLib to fit your workflow perfectly.",
      target: '[data-tour="settings-behavior"]',
      cardPosition: "right",
      chapter: "Settings",
    },

    {
      id: "settings-integrations",
      title: "Integrations",
      body: "Steam API Key + SteamID64 for playtime sync and pulling uninstalled games. IGDB Client ID + Secret for automatic metadata enrichment.",
      target: '[data-tour="settings-integrations"]',
      cardPosition: "right",
      chapter: "Settings",
    },

    {
      id: "settings-data",
      title: "Data Management",
      body: "Export your library as JSON or CSV. Import from JSON. Fetch all missing covers at once. Bulk IGDB scan. Empty the trash. Copy error logs for debugging.",
      target: '[data-tour="settings-data"]',
      cardPosition: "right",
      chapter: "Settings",
    },

    {
      id: "shortcuts",
      title: "Keyboard Shortcuts",
      body: "Press ? to see all shortcuts. Ctrl+K for command palette. / for search. N to add. F to favorite. S for scan. W for wrapped. 1-9/0 to quick-rate. And more.",
      hint: "Press ? anytime to see the full list",
      cardPosition: "center",
      chapter: "Finish",
    },

    {
      id: "done",
      title: "",
      body: "",
      cardPosition: "center",
      chapter: "Finish",
      before: async () => {
        setDetailOpen(false);
        navigate("/");
        await raf();
      },
    },
  ];
}

const FAST_IDS = [
  "welcome", "scan-btn", "scan-dropdown", "add-game-btn", "add-game-modal",
  "game-grid", "right-click", "game-detail", "play-btn",
  "shortcuts", "done",
];

const STANDARD_IDS = [
  "welcome", "scan-btn", "scan-dropdown", "add-game-btn", "add-game-modal",
  "igdb-scan-btn", "dedup-btn",
  "game-grid", "list-view", "search-input", "sidebar-platform",
  "right-click", "game-detail", "play-btn", "hltb-btn", "igdb-btn",
  "detail-history",
  "collections", "stats", "wrapped", "spin",
  "settings-appearance", "settings-integrations",
  "shortcuts", "done",
];

export function getFastSteps(deps: TourDeps): TourStep[] {
  const all = getAllSteps(deps);
  return FAST_IDS.map((id) => all.find((s) => s.id === id)!).filter(Boolean);
}

export function getStandardSteps(deps: TourDeps): TourStep[] {
  const all = getAllSteps(deps);
  return STANDARD_IDS.map((id) => all.find((s) => s.id === id)!).filter(Boolean);
}

export function getDetailedSteps(deps: TourDeps): TourStep[] {
  return getAllSteps(deps);
}

export const CHAPTERS = [
  "Start", "Getting Games In", "The Library", "Filtering",
  "Game Cards", "Game Detail", "Pages", "Settings", "Finish",
];
