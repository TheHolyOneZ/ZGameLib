# Changelog

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
