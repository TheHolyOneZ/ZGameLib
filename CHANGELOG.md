# Changelog

## [0.9.0] — 2026-03-20

### Added

#### Uninstalled Steam Games (F-017)
- **Pull Uninstalled Steam Games** — import all owned but uninstalled Steam games into the library via Steam Web API (`IPlayerService/GetOwnedGames`)
- **"Not Installed" badge** shown on game cards (top-left, next to platform badge) and in list-view rows for any uninstalled game
- **Install via ZGameLib** — clicking launch/play on a "Not Installed" Steam game opens Steam's install dialog (`steam://install/{appId}`) instead of running the game
- **Scan Games dropdown** in the top bar — replaces the single Scan button with a split button/dropdown: "Scan Installed Games" (existing behavior) and "Pull Uninstalled Steam Games"
- **Sidebar filter** — "Not Installed" section appears in the sidebar when any uninstalled games are present, with a count badge; clicking it filters the library to show only uninstalled games
- **Auto-pull on startup** toggle in Settings → Behavior — "Pull uninstalled Steam games on startup"; requires Steam API Key and SteamID64 to be configured
- **Scanner auto-detects installs** — when a Steam scan runs and finds a game previously marked as "Not Installed", it automatically marks it as installed and populates the `exe_path` and `install_dir`
- **Database migration** — new `not_installed` column (INTEGER, default 0) added to `games` table via schema migration
- **Settings key** — `include_uninstalled_steam` (default `false`) persisted in app settings

#### Library Pagination (F-042)
- **Pagination toggle** in Settings → Appearance — off by default; when enabled the library splits into pages instead of one continuous scroll
- **Page size selector** — choose 12, 24, 36, 48, 60, or 100 games per page; selector only visible when pagination is on
- **Pagination bar** — prev/next arrows with numbered page buttons; smart ellipsis condensing for large page counts (e.g. `1 … 4 5 6 … 20`); current page highlighted with accent gradient; appears below the grid in all view modes (grid, list, manual sort order)
- Page resets to 1 automatically when search, filters, page size, or toggle change
- New settings keys: `pagination_enabled` (default `false`), `pagination_page_size` (default `24`, clamped 6–200)

#### Steam Playtime Sync (F-013)
- **Steam Playtime Sync** in Settings → Integrations — enter your Steam API Key and SteamID64 to sync playtime from Steam; only increases local values, never decreases
- **Sync button** shows updated/skipped count in a toast

#### Idle Detection (F-014)
- **Exclude idle time from playtime** toggle in Settings → Behavior (default: on) — deducts time when the game isn't in focus for 5+ consecutive minutes; brief alt-tabs are ignored

#### Advanced Filter Builder (F-016)
- **Advanced filter section** in the sidebar — under a collapsible "Advanced" toggle below the Cover Art section
- **Filter rules** with field/operator/value — supports platform, status, rating, playtime, tags, date_added, is_favorite, has_cover
- **AND / OR logic toggle** between rules
- **Add Rule** and **Clear All** buttons; each rule has a remove button

#### Game Tracking Overhaul (I-046)
- **Directory-based process tracking** — all launchers (Steam, Epic, direct exe) now watch the game's `install_dir` for any running process instead of tracking a single spawned PID; handles multi-process games that previously recorded 0 playtime
- **Launcher stub support** — games that start via a stub launcher no longer lose their session when the stub exits; the tracker maintains a grace window between process deaths so the real game process is picked up seamlessly
- **install_dir fallback** — `launch_game` now fetches `install_dir` from the database; if unset, derives it from the exe's parent directory; falls back to single-PID tracking only when no directory is resolvable
- **Directory-based idle detection** — `exclude_idle_time` now checks whether the foreground window belongs to any process in the game directory, not just the originally spawned PID
- **ToolHelp process enumeration** — replaced all `tasklist` subprocess calls with `CreateToolhelp32Snapshot` + `QueryFullProcessImageNameW`; process scans are now ~10× faster and create no console flicker
- **Steam / Epic install_dir tracking** — Steam and Epic launch paths use the game's stored `install_dir` for directory tracking with a 300-second startup window; falls back to exe-name scanning only when install_dir is unavailable
- **Parallel process tracking prevention** — direct launches now register in `ActivePids` alongside Steam/Epic, preventing duplicate session threads if the user clicks play twice before the tracking thread starts

#### Auto Grid Columns (I-042)
- **"Auto" option** for grid columns in Settings → Appearance — uses `repeat(auto-fill, minmax(180px, 1fr))` to fill the available space automatically

#### Persistent Error Log (I-045)
- **Copy Logs** button in Settings → About — copies the last 200 error log lines to the clipboard; errors are written to `%APPDATA%\zgamelib\logs\app.log` with rotation at 1 MB (keeps last 3 files)

### Changed
- Version bumped to **0.9.0**

---

## [0.8.0] — 2026-03-19

### Added

#### Collections (F-020)
- **Collections page** — create, rename, delete, and describe collections; grid/list view toggle; search bar to filter by name
- **Collection description** — click-to-edit description/notes field per collection; stored in `collections.description` (backwards-compatible `ALTER TABLE`)
- **Collection detail view** — click a collection to see its games with search and grid/list toggle
- **Right-click context menu on collections** — rename / delete directly from the collections page
- **Game context menu → Collections submenu** — right-click any game anywhere → hover Collections → submenu shows all collections with checkmarks; click to add or remove; a game can belong to multiple collections simultaneously
- **Remove from Collection** — when viewing a collection's game list, right-click a game → orange "Remove from Collection" option
- **Batch operations → Add to Collection** — select multiple games → `+ Collection` button in the `BatchActionBar` → pick a collection to add all selected games at once
- **Full export v3** — export now includes `collections` and `collection_games` arrays; import is fully backwards-compatible (`#[serde(default)]`); old v1/v2 exports still import correctly

#### IGDB Metadata (F-006)
- **Settings → Integrations** — IGDB Client ID and Client Secret fields with a clear 6-step setup guide: create a Twitch Developer app at `dev.twitch.tv/console`, set OAuth Redirect URL to `http://localhost`, set Category to **Other**, copy Client ID and Client Secret
- **Fetch IGDB button** in Game Detail — fetches genre, developer, publisher, and release year for the open game; populates description if empty
- **IGDB metadata card** in Game Detail Info tab — shown when any IGDB field is present; modern 2×2 flex-wrap grid with custom SVG icons (gamepad · code · building · calendar) for each field; adapts to any panel width
- **(i) info button** in metadata card header — hover or click reveals: *"Data sourced from IGDB by game name. If another title shares a similar name, the wrong match may have been returned"*
- **Clear IGDB data button** (trash icon) in metadata card header — removes all IGDB fields and sets an `igdb_skipped` flag on the game
- **`igdb_skipped` flag** (`ALTER TABLE games ADD COLUMN igdb_skipped INTEGER`) — persisted in SQLite; once set, the bulk scan silently skips the game and the individual fetch button shows a confirmation dialog before proceeding
- **Bulk IGDB scan button** (sparkle icon) in library Topbar — fetches IGDB data for every game that has none and is not flagged; spins while running with a live `X/Y` counter badge; reloads the game list on completion; if no credentials are configured shows an error toast pointing to Settings → Integrations

#### Notes — Markdown Preview (I-026)
- Notes in Game Detail now have a per-note **preview/edit toggle** (eye and pencil SVG icons)
- Preview renders full Markdown using `react-markdown` + `rehype-sanitize` with prose styling

#### Tags — Undo Deletion (I-012)
- Removing a tag in Game Detail now starts a **5-second countdown** instead of deleting immediately — tag shows strikethrough at 45% opacity with a `↩` undo indicator
- Click the pending tag to cancel the deletion; after 5 seconds the removal is committed

#### Statistics — Library Growth Chart (F-036)
- **Library Growth** section on the Stats page — stacked bar chart showing how many games were added per calendar month, bars colored by platform using the existing `PLATFORM_COLORS_HEX` palette, legend at the bottom; data comes from the new `get_library_growth` backend command

#### Custom Theme Creator (F-041)
- **Create Theme** button in Settings → General → Theme — opens an inline editor to build a fully custom theme from scratch
- **Accent color picker** — native color input plus 14 preset swatches; HSL shade generation auto-derives all 8 accent levels (200–900) with a live shade strip preview
- **Background and sidebar color pickers** — 10 dark preset swatches; sidebar auto-derived from background with manual override
- **Live preview** — the entire app updates in real time as colors are adjusted; a miniature sidebar+content mockup is also shown in the editor
- **Save, edit, delete** — custom themes appear alongside built-in themes with hover controls (pencil to edit, trash to delete); stored in the `custom_themes` settings key as JSON
- **Theme utility module** (`src/lib/theme.ts`) — shared HSL math, shade generation, and CSS variable injection used by both Settings and Layout

#### Unsaved Settings Guard (I-029)
- **Dirty detection** — Settings page tracks whether any field has changed since the last save using a JSON snapshot comparison
- **Navigation interception** — Sidebar and Command Palette check the dirty flag before navigating away from Settings; if unsaved changes exist, navigation is blocked and a modal appears
- **Unsaved Changes modal** — glass-morphism dialog with accent-colored info icon, spring animation, and two options: **Discard** (reverts to saved state and navigates) or **Save & Leave** (persists changes then navigates)

### Fixed
- **Collections submenu click closes context menu** — root cause: `CollectionsSubmenu` was rendered via `createPortal` to `document.body`, which placed it outside `menuRef`'s DOM tree; the outside-click `mousedown` handler detected submenu clicks as "outside" and closed the menu before the button registered. Fix: restore `createPortal` (needed so `fixed` positioning works correctly outside the `backdrop-filter` parent), add `data-ctx-submenu="true"` attribute to the portaled div, and update the handler to check `target.closest("[data-ctx-submenu]")` before closing
- **Collections submenu not appearing on hover** — root cause: `CollectionsSubmenu` was a `fixed` child of the main menu div which uses `backdrop-filter` (via `glass-strong`); `backdrop-filter` creates a new CSS containing block for `fixed` children, so the submenu's viewport coordinates were applied relative to the parent, placing it off-screen. Fix: restored `createPortal` so the submenu renders outside the backdrop-filter ancestor
- **IGDB metadata card swallowed / not resizing** — removed `overflow-hidden` from the card wrapper (was clipping the tooltip and preventing content growth); replaced `grid grid-cols-2` with `flex flex-wrap` with percentage widths so cells reflow gracefully at any panel width; added `break-words` to values

### Changed
- Version bumped to **0.8.0**
- **Database additions** (all backwards-compatible `ALTER TABLE`):
  - `games.genre TEXT`
  - `games.developer TEXT`
  - `games.publisher TEXT`
  - `games.release_year INTEGER`
  - `games.igdb_skipped INTEGER NOT NULL DEFAULT 0`
  - New table `collections (id, name, created_at, description)`
  - New table `collection_games (collection_id, game_id)` with cascade delete
  - New setting `custom_themes` — JSON array of user-created themes (id, name, accent, bg, sidebar)


## [0.7.0] — 2026-03-18

### Fixed
- **Tiny settings labels** — all `text-[10px]` instances in Settings replaced with `text-xs` for readable, consistent label sizing throughout the settings page
- **Invalid platform/status saved silently** — `update_game` now validates `platform` (must be `steam`, `epic`, `gog`, or `custom`) and `status` (must be `none`, `backlog`, `playing`, `completed`, `dropped`, or `on_hold`) and returns a descriptive error instead of persisting garbage values
- **Import library accepts bad data** — `import_library` now validates each game before inserting: skips entries with empty or >255 char names, ratings outside 0–10, and unrecognised platform strings
- **Launcher threads run forever** — background process-polling threads for Steam/Epic/GOG/custom now have a hard 86 400-second (24-hour) cap; previously a game that never launched would leave a thread running indefinitely
- **Batch status dropdown invisible on dark background** — the floating `BatchActionBar` status select now forces a dark background (`bg-[#1a1825]`) with matching dark option elements so the text is readable on all platforms
- **Batch rating input shows number spinners** — the rating field in the batch action bar no longer renders browser-native up/down spinners; uses CSS to suppress them on all engines
- **Batch rating not clamped** — entering a value outside 1–10 in the batch rating field is now rejected on every keystroke; the input clamps to `[1, 10]` immediately
- **Export missing sessions and notes** — `export_library` previously only exported games; the JSON export now uses a v2 `FullExport` envelope (`{ version, games, sessions, notes }`) so all play history and notes are preserved; `import_library` detects v1 (plain array) vs v2 automatically and restores sessions and notes, skipping any whose `game_id` no longer exists
- **Playtime not recorded for short sessions** — three root causes fixed: GOG/custom process polling interval reduced from 30 s to 5 s; Steam/Epic `game_start` timer now begins only after the target PID is found (not at launch time, which inflated playtime by up to 3 minutes); sessions ≥ 30 seconds are now saved (previous threshold was > 0 minutes, silently dropping any session under 1 minute)
- **Game card action buttons invisible on light covers** — overlay buttons changed from `bg-black/40` to `bg-black/70` with an explicit `border border-white/10 shadow-lg`, ensuring they are always legible regardless of cover brightness
- **Fire icon appears squished** — `FireIcon` completely redrawn as a proper three-layer SVG flame; size on game cards raised from 12 px to 18 px, and on list rows from 10 px to 15 px
- **Spin wheel inner hub dominates the empty wheel** — removed the large dark center circle entirely; pie slices now extend from the exact center point, giving the wheel a clean look even with a single entry
- **Spin wheel empty state spinner icon** — removed the decorative rotating icon from the empty state overlay; the empty state now shows text only
- **Spin winner card pushes "Spin the Wheel" button upward** — the right panel is now split into a fixed top section (wheel + button, `shrink-0`) and a separate scrollable bottom section (winner card + history); the button never moves regardless of how much content appears below it
- **Directory traversal in cover file copy** — `set_game_cover` now rejects symlinks (via `symlink_metadata`), validates the file extension against an allowlist (`jpg`, `jpeg`, `png`, `webp`), and checks magic bytes before copying; previously any file path including sensitive system files could be copied into the app data directory
- **N+1 query pattern in scanner** — Steam, Epic, and GOG scan loops previously fired one `SELECT` per discovered game to check for duplicates; each scanner now bulk-fetches all existing IDs into a `HashMap`/`HashSet` before the loop and does in-memory lookups, reducing scan overhead from O(n) queries to a single query per platform
- **Playtime chart renders as a solid block** — the "Last 12 Weeks" chart used `preserveAspectRatio="none"` on its SVG, which stretched all bars to fill the full container width and merged them into an indistinguishable block; replaced with a div-based flexbox chart where bars grow from the bottom, labels show every other week, and a Framer Motion `scaleY` entrance animation staggers each bar in

### Added
- **Command palette** (`Ctrl+K`) — centered overlay with a fuzzy search that matches any game by name; results show cover thumbnail and platform badge; keyboard navigation (↑ ↓ Enter Escape); also surfaces six quick actions (Add Game, Library, Favorites, Stats, Spin, Settings); `Ctrl+K` again or Escape closes it
- **Batch multi-select** — hold-click the checkbox that appears on any game card (top-left, visible on hover) or list row to build a selection; a floating `BatchActionBar` slides up from the bottom showing the selection count, a status dropdown, a rating input, an "add tag" field, and a Delete button; all changes apply to every selected game in one transaction; × clears the selection
- **Weekly playtime chart** — new "Playtime — Last 12 Weeks" SVG bar chart on the Stats page; each bar represents one ISO week; bars animate in on mount; hovering a bar shows the exact playtime and week label in a tooltip; data comes from the `sessions` table
- **Lowest Rated section** — Stats page shows a ranked list of up to 5 games rated ≤ 4 with their scores highlighted in red
- **Most Neglected section** — Stats page shows up to 5 games with zero recorded playtime, sorted by how long they have been in the library, with a "Added X days ago" label
- **Screenshot lightbox navigation** — left / right chevron buttons let you page through all screenshots without closing the lightbox; an "X / Y" counter in the top-right corner tracks position; `ArrowLeft` / `ArrowRight` keyboard support added; navigation wraps around at both ends
- **Playtime reminder on startup** — if Playtime Reminders is enabled in settings, the app checks on launch for the game you have not played in the longest time (minimum 30-day threshold); emits a toast-style notification with the game name and number of days since last session
- **Window position and size memory** — the app saves the window's last position (`window_x`, `window_y`) and size (`window_width`, `window_height`) to the database on close and restores them exactly on next launch; only restores if coordinates are on-screen (≥ 0)
- **Playtime Reminders toggle** — new toggle in Settings → Behavior; persisted as `playtime_reminders` in the settings table; defaults to enabled
- **"Game Started" play button confirmation** — after clicking Play in the game detail panel, the button transitions to a green "Game Started" state with a checkmark for 3 seconds using `AnimatePresence`, giving clear visual feedback that the launch command was sent

### Changed
- **Sidebar active link** now has a clear left-edge accent bar (`border-l-2 border-accent-500`) plus a subtle background fill and bold white text; previously only the text color changed on the active route
- **Fire icon on high-rated games** now pulses with a Framer Motion breathing animation (scale 1 → 1.2 → 1, 2-second loop) on both game cards and list rows
- **Game card hover overlay** buttons now stagger in (opacity 0→1, y 10→0) with a 50 ms per-button delay instead of appearing all at once
- **Rating buttons on game cards** moved above the game title (previously rendered below the title, partially obscured by the status badge)
- **Spin wheel clock tick marks** removed from the static overlay SVG; the outer ring and pointer triangle are kept; the wheel looks cleaner with no decorative minute-hand lines
- Version bumped to **0.7.0**







---

## [0.6.0] — 2026-03-17

### Fixed
- **Process tracking fallback for Steam/Epic** — when the launched game process is never found within the polling window, the session is now properly closed with 0 minutes and the UI restores correctly; previously the background thread would silently exit leaving the app in a tracking state
- **Cover cache race condition** — multiple components mounting simultaneously for the same game no longer trigger parallel fetches; a per-key in-flight deduplication guard prevents redundant requests; cache capacity raised from 200 to 500 entries
- **Input length validation** — `name` is capped at 255 characters, `description` at 10,000, `tags` limited to 100 items each ≤ 50 characters; the backend rejects out-of-range values with a descriptive error rather than storing them silently
- **No keyboard navigation on game cards** — cards now have `tabIndex={0}`, `role="button"`, and respond to Enter / Space, making the library navigable without a mouse
- **Focus not trapped in modals** — Tab key could previously escape the Game Detail panel and Cover Search modal; a keyboard trap now constrains focus to the active overlay while it is open
- **PowerShell injection in icon extraction** — icon extraction no longer interpolates file paths into the PowerShell command string; paths are now passed via `ZGAMELIB_EXE_PATH` and `ZGAMELIB_DEST_PATH` environment variables, eliminating a potential command injection vector
- **Empty catch blocks in GameListRow** — launch and open-folder errors were silently swallowed; both now display an error toast with the failure message
- **Cover cache memory leak** — the in-memory cover URL cache now uses LRU eviction (max 200 entries); previously it grew unboundedly for large libraries
- **Non-atomic cover downloads** — cover images are now written to a `.tmp` file first and renamed atomically, preventing corrupt partial writes on crash or error
- **Folder scan walk limit** — the custom folder scanner now hard-caps at 10,000 file system entries to prevent runaway walks on deeply nested or large drives
- **Exe icon not refreshing after game update** — the icon cache key now includes the file's modification time (`mtime`); replacing a game's exe now shows the new icon on next launch
- **Game detail shows stale data after switching games** — the detail panel now invalidates and refetches game data when `selectedGameId` changes, preventing stale reads between rapid game switches
- **Auto-scan not triggering on startup** — `scan` was missing from the `useEffect` dependency array in `Layout.tsx`; auto-scan now fires reliably on app start when enabled
- **Cover placeholder constant duplicated** — `COVER_PLACEHOLDER` was defined independently in `RecentlyPlayed` and `PinnedRow`; both now import from the shared `@/lib/utils` module
- **Missing aria labels on scan-related topbar buttons** — scan log toggle and remove-duplicates button now have `aria-label` attributes for screen readers

### Added
- **Drag-and-drop reordering** — a new "Custom Order" sort option enables Framer Motion `Reorder` drag-and-drop for the game grid; dragging a card updates `sort_order` in the database for all affected games in a single batch transaction; order persists across sessions
- **Time-to-beat estimates (HLTB)** — a clock icon button in the Game Detail panel fetches HowLongToBeat data for the game (main story and completionist hours); results are cached in the database (`hltb_main_mins`, `hltb_extra_mins`) and displayed in the stats grid
- **Custom fields** — users can define arbitrary key/value metadata per game (text values); field editor in the Info tab with add/edit/delete; stored as a JSON map in the database under `custom_fields`
- **Global keyboard shortcuts** — `?` toggles a keyboard shortcut help overlay; `N` opens the Add Game modal; `F` toggles favorite on the currently open game; `Escape` closes the detail panel or any overlay; global `keydown` listener in `Layout.tsx`
- **Portable mode** — if a file named `portable.flag` exists next to `zgamelib.exe` at startup, the database and settings are stored in the same directory as the exe instead of `%APPDATA%\zgamelib`; useful for USB drives or self-contained installs
- **Duplicate removal confirmation** — clicking "Remove Duplicates" in the topbar now shows a confirm dialog listing how many games will be hidden before acting; previously it applied the change instantly with no warning
- **Cover lightbox** — clicking the game cover image in the detail panel now opens a full-size lightbox overlay instead of jumping straight to the cover search modal; a separate "Change Cover" button on the hover overlay handles cover replacement
- **Quick rate from game card** — a row of 10 rating buttons appears at the bottom of a game card on hover, allowing ratings to be set without opening the detail panel; the active rating is highlighted
- **Empty library illustration** — the first-run / empty-library state now shows an animated gamepad SVG illustration with orbiting sparkle dots and an accent glow, replacing the previous blank panel
- **Trash bin / soft delete** — deleting a game moves it to trash (`deleted_at` timestamp) instead of hard-deleting it; restore or permanently delete from a new Trash section in Settings → Data; "Empty Trash" purges all at once — backwards-compatible via `ALTER TABLE`
- **Pinned games row** — right-click any game → Pin to show it in a dedicated "Pinned" strip at the top of the Library; pin state persists to the database
- **Session history** — each game launch records a session row (`started_at`, `ended_at`, `duration_mins`) in a new `sessions` table; view the last 50 sessions per game in a new History tab in the Game Detail panel
- **Bulk auto-fetch missing covers** — new "Fetch Missing Covers" button in Settings → Data; fetches covers for all games that have no cover art (Steam games via CDN, others via name search); reports updated/failed counts
- **Platform badge component** — dedicated `PlatformBadge` component with platform icons (Steam / Epic / GOG / Custom) used consistently across GameCard, GameListRow, GameDetail, and Spin pages
- **Collapsible sidebar** — sidebar can be collapsed to a 62 px icon-only strip; collapses with a spring animation; collapse toggle moved to the header (always visible); state persists across sessions via `localStorage`
- **Sort direction toggle** — ascending/descending sort button added to the PageSearch bar
- **Theme hover preview** — hovering a theme button in Settings instantly previews it; the previous theme restores on mouse-out if not confirmed
- **Delete option in right-click context menu** — "Delete" entry with red styling and a visual divider separator added to the `GameContextMenu`
- **Weekly playtime goal** (`GoalBar`) — collapsible goal widget at the top of the Library page; set a target in hours, animated progress bar shows current week's playtime; "Goal reached!" state with green color; persists via `localStorage`
- **Search scope toggle** — small `A` / `A+` toggle embedded inside the search input; switches between searching game name only vs. name + description
- **Cover art filter** — "Has Cover" and "Missing Cover" filter buttons in the sidebar under a dedicated Cover Art section (consistent with Platform/Status styling); shows counts; replaces the old cluttered buttons in the search bar
- **Export library as CSV** — new button in Settings → Data exports the full library as a `.csv` file with proper quoting; fields: id, name, platform, status, rating, playtime\_mins, date\_added, is\_favorite, tags
- **Export Filtered** — new button in Settings → Data exports only the currently visible/filtered games as JSON; button label shows the active count (e.g. "Export Filtered (12)")
- **"Saved ✓" flash indicator** — editing a game's name, description, or rating now flashes a brief "Saved ✓" indicator in the detail panel's tab bar using `AnimatePresence`
- **Scroll-to-top button** — a floating ↑ button appears after scrolling 400 px on the Library, Favorites, and Recently Played pages; smooth animated entrance/exit
- **Tab counts in game detail** — Screenshots and History tab labels now show live counts (e.g. "Screenshots (6)", "History (3)")
- **Description expand/collapse** — long game descriptions are truncated at 200 characters with a "Show more / Show less" toggle in the game detail Info tab
- **Cover search empty state** — the cover search modal now shows "No covers found for 'X'" with a helpful hint ("Try a shorter name or remove subtitles") instead of a blank panel before searching

### Changed
- Version bumped to **0.6.0**
- `delete_game` command is now a soft delete; hard delete is `permanent_delete_game`
- Sidebar collapse toggle moved from the bottom to the header row (always accessible regardless of window height)
- About section in Settings spans full grid width (was half-width like other cards)
- Cover art filter and search scope controls moved out of the search bar into proper locations (sidebar and inside search input respectively) for a cleaner topbar

---

## [0.5.0] — 2026-03-17

### Fixed
- **UI no longer freezes during scan / bulk add / single add** — all scan commands (`scan_steam_games`, `scan_epic_games`, `scan_gog_games`, `scan_all_games`, `scan_folder_for_games`) are now `async` and run on `tokio::task::spawn_blocking`; this frees Tauri's command handler thread pool so navigation, settings, game detail, and all other interactions remain fully responsive while scans run in the background
- **Bulk Add no longer blocks the screen** — the Add Game modal closes immediately when a bulk scan starts; the scan runs in the background with a toast on completion instead of holding the modal open with a blocking backdrop overlay
- **Concurrent scan guard** — an `AtomicBool` (`SCAN_RUNNING`) prevents two folder scans from executing simultaneously; a second attempt returns an error immediately instead of corrupting state
- **Scanner DB transactions** — all four scan functions (Steam, Epic, GOG, Custom) now wrap their DB writes in `BEGIN`/`COMMIT` transactions, preventing partial inserts on failure
- **Top-rated cover images in Stats** — cover thumbnails now load correctly via the `useCover` hook instead of raw file paths (which Tauri's webview cannot display)

### Added
- **Loading beam** — a glowing accent-colored animated bar appears at the very top of the window during any background operation (scan, bulk add); uses the active theme's accent color with a soft glow, fades out smoothly when the operation completes
- **`isBulkAdding` state** — new `useUIStore` field tracks background bulk-add operations separately from platform scans
- **Executable health check** — game cards show an amber warning badge when the game's `.exe` file is missing or was moved; backed by a new `check_exe_health` Tauri command
- **Date range filters** — filter the library by date added (from/to); new `dateAddedFrom` and `dateAddedTo` fields in the filter store
- **Rating distribution chart** — horizontal bar chart on the Stats page showing how many games you rated at each score (1–10)
- **Completion rate tracker** — circular SVG progress ring on the Stats page showing what percentage of your library is marked "Completed"
- **Right-click context menu** — right-click any game card or list row to get a portal-rendered context menu with: Play, Open Folder, Toggle Favorite, Copy Name, View Details
- **Loading skeleton** — a pulsing placeholder grid appears while the library is loading for the first time
- **Toast progress bar** — toasts now show a shrinking progress bar at the bottom indicating time remaining before auto-dismiss
- **Empty search state** — when filters return no results, a dedicated "No games match your filters" view appears with a one-click "Clear Filters" button
- **Clickable stats** — every card, platform bar, and status tile on the Stats page is now clickable and navigates to the Library with the corresponding filter/sort pre-applied

### Changed
- **`DbState` now uses `Arc<Mutex<Connection>>`** — the database connection wrapper is `Arc`-wrapped so it can be safely cloned into background `tokio` tasks without blocking the Tauri IPC thread pool
- Version bumped to **0.5.0**

---

## [0.4.1] — 2026-03-16

### Fixed — Backlog (14 issues)

**Critical**
- `useScreenshotUrl` — rewrote async API call with `useState` + `useEffect` and unmount cleanup flag; was called directly in render causing memory leaks and stale renders
- `useCover` — replaced boolean `cancelled` closure flag with a generation counter ref to correctly guard all async callbacks after unmount; fixes race conditions when components unmount mid-fetch
- Playtime double-count race condition — added `ActivePids` struct (`Mutex<HashSet<u32>>`) in launcher.rs; a second tracker thread is now skipped if the PID is already being watched
- VDF parser — rewrote `parse_vdf_value` as a proper state-machine that respects `\"` escaped quotes; fixes Steam game names containing quote characters being parsed incorrectly

**Real bugs / anti-patterns**
- `window.location.reload()` in `AddGameModal` — replaced with `queryClient.invalidateQueries` + `close()`; full page reloads destroyed all React state inside the SPA
- `useUIStore.getState()` in render — replaced with `useUIStore((s) => s.customStatuses)` selector hook in `GameCard`, `GameListRow`, and `GameDetail`; components were not re-rendering on status changes
- Filtering logic duplication — removed duplicate filter/sort logic from the store, canonical implementation kept in `useFilteredGames` hook only
- Settings validation — `grid_columns` value is now clamped to `1..=8` in `save_settings`; out-of-range values like `0` or `99` were silently saved and broke the grid layout

**Code quality**
- Custom base64 encoder — removed hand-rolled 70-line implementation; replaced with `base64 = "0.22"` crate and `STANDARD.encode()`
- `md5_simple` renamed to `fnv_hash` — function was computing an FNV-1a hash, not MD5; misleading name corrected
- `CoverSearchModal` double fetch — added `fetchCache` ref (URL → base64 map); `fetchUrlAsBase64` is no longer called twice for the same cover URL on selection
- Search debounce — search dispatch now goes through a 150 ms `useEffect` debounce; every keystroke was triggering a full store filter pass
- `app.default_window_icon().unwrap()` — replaced with `.expect("app icon missing")` for a clear panic message at startup
- `Math.random()` for IDs — replaced `Math.random().toString(36).slice(2)` with `crypto.randomUUID()` for toast and log IDs in `useUIStore`

### Fixed — User-reported

- **Settings version display** — hardcoded `v0.4.0` label in Settings page corrected to `v0.4.1`
- **Status edit mode — color swatch closes edit** — clicking a color swatch triggered `onBlur` on the label input and collapsed edit mode; fixed with `onMouseDown={(e) => e.preventDefault()}` on all swatch buttons
- **Status edit mode — typing one character closes edit** — `updateStatus` was called on every keystroke, updating `status.key` which changed the `Reorder.Item` key prop causing a remount and focus loss; fixed by buffering edits in local `editLabelValue` state and committing only on blur/Enter
- **Search bar X button positioning** — clear button was rendering below the input instead of inside it; fixed by replacing `top-1/2 -translate-y-1/2` with `inset-y-0 my-auto` for reliable vertical centering

### Added

- **Remove Duplicates** — new icon button in the topbar that hides duplicate games (case-insensitive name match, keeps first occurrence); hidden games are stored in-memory and restored on app restart or via the toggle
- **Hidden games toggle** — pill indicator appears in the page search bar when duplicates are hidden; click to show/hide them with animated eye icon
- **Screenshot tab enhancements** — per-screenshot hover overlay with: Copy Path, Open File, Open Folder, Export/Download; improved lightbox with close button, Escape key support, and bottom action bar (Copy path · Open folder · Export)
- **Page-level search bar** — search, game count, sort controls, and grid/list toggle moved from the topbar into each page (Library, Favorites, Recently Played) as a contextual header; topbar is now a lean action strip
- **Scan Games promoted** — "Scan Games" is now a full labeled button (alongside "Add Game") in the topbar instead of a bare icon

---

## [0.4.0] — 2026-03-16

### Added
- **Mod Loader support** — new "Mods" tab in the game detail panel (visible for any game with an install directory)
  - Detect whether BepInEx or MelonLoader is already installed in the game folder
  - One-click install for BepInEx (fetches latest release from GitHub, extracts to game directory)
  - One-click install for MelonLoader (fetches latest installer from GitHub, runs silently with `--auto --arch x64`)
  - Mod list — shows all `.dll` files in the plugins/mods folder with name and file size
  - Add Mod button — file picker for `.dll` files, copies them to the correct folder automatically
  - Remove mod button per entry
  - Open Folder button — opens BepInEx/plugins or Mods directory in Explorer
  - Mod folder is detected automatically based on which loader is installed

### Changed
- CSP enabled in `tauri.conf.json` (was `null`)
- Devtools removed from production window config

---

## [0.3.0] — Initial public release

- Game library management (Steam, Epic, GOG, custom)
- Auto-scanner for installed games
- Playtime tracking
- Cover art with multi-source fallback
- Glassmorphic UI with 7 themes
- Notes, tags, custom statuses, ratings
- Spin page (random game picker)
- Stats page
- In-app updater
- System tray support
- Import/export library
