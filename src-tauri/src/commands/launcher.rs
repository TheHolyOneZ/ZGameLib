use tauri::{AppHandle, Emitter, Manager, State};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::{Duration, Instant};
use crate::db::{DbState, queries};

const CHECKPOINT_KEY: &str = "active_session";
const TICK: Duration = Duration::from_secs(5);
const MAX_SESSION_SECS: u64 = 86_400;
const IDLE_THRESHOLD_SECS: u64 = 300;
const SUSPEND_GAP_SECS: u64 = 90;

#[cfg(windows)]
fn show_native_alert(title: &str, message: &str) {
    let t: Vec<u16> = title.encode_utf16().chain(std::iter::once(0)).collect();
    let m: Vec<u16> = message.encode_utf16().chain(std::iter::once(0)).collect();
    std::thread::spawn(move || {
        extern "system" {
            fn MessageBoxW(hwnd: isize, text: *const u16, caption: *const u16, utype: u32) -> i32;
        }
        unsafe { MessageBoxW(0, m.as_ptr(), t.as_ptr(), 0x30); }
    });
}

#[cfg(windows)]
fn get_foreground_pid() -> Option<u32> {
    use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId};
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0.is_null() {
            return None;
        }
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        if pid == 0 { None } else { Some(pid) }
    }
}

#[cfg(windows)]
fn get_process_exe_path(pid: u32) -> Option<String> {
    use windows::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_NAME_FORMAT,
    };
    use windows::Win32::Foundation::CloseHandle;
    use windows::core::PWSTR;
    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
        let mut buf = [0u16; 1024];
        let mut size = 1024u32;
        let ok = QueryFullProcessImageNameW(
            handle,
            PROCESS_NAME_FORMAT(0),
            PWSTR(buf.as_mut_ptr()),
            &mut size,
        );
        let _ = CloseHandle(handle);
        if ok.is_ok() {
            Some(String::from_utf16_lossy(&buf[..size as usize]))
        } else {
            None
        }
    }
}

#[cfg(windows)]
fn snapshot_processes() -> Vec<(u32, String)> {
    use windows::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
    };
    use windows::Win32::Foundation::CloseHandle;
    let mut result = Vec::new();
    unsafe {
        let snap = match CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) {
            Ok(h) => h,
            Err(_) => return result,
        };
        let mut entry: PROCESSENTRY32W = std::mem::zeroed();
        entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;
        if Process32FirstW(snap, &mut entry).is_ok() {
            loop {
                let len = entry.szExeFile.iter().position(|&c| c == 0).unwrap_or(entry.szExeFile.len());
                let name = String::from_utf16_lossy(&entry.szExeFile[..len]);
                result.push((entry.th32ProcessID, name.to_string()));
                if Process32NextW(snap, &mut entry).is_err() {
                    break;
                }
            }
        }
        let _ = CloseHandle(snap);
    }
    result
}

#[cfg(windows)]
fn find_pids_in_directory(dir: &str) -> Vec<u32> {
    let dir_norm = normalize_dir(dir);
    let dir_path = std::path::Path::new(dir);
    let mut result = Vec::new();
    for (pid, exe_name) in snapshot_processes() {
        if pid == 0 {
            continue;
        }
        if let Some(path) = get_process_exe_path(pid) {
            if path.to_lowercase().starts_with(&dir_norm) {
                result.push(pid);
            }
        } else if !exe_name.is_empty() {
            if dir_path.join(&exe_name).exists() {
                result.push(pid);
            }
        }
    }
    result
}

#[cfg(windows)]
fn normalize_dir(dir: &str) -> String {
    let lower = dir.replace('/', "\\").to_lowercase();
    if lower.ends_with('\\') { lower } else { format!("{}\\", lower) }
}

#[cfg(windows)]
fn find_steam_game_dir(app_id: &str) -> Option<String> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let steam_key = hkcu.open_subkey("Software\\Valve\\Steam").ok()?;
    let steam_path: String = steam_key.get_value("SteamPath").ok()?;
    let steam_path = steam_path.replace('/', "\\");

    let mut library_dirs = vec![steam_path.clone()];
    let vdf = std::path::Path::new(&steam_path).join("steamapps").join("libraryfolders.vdf");
    if let Ok(content) = std::fs::read_to_string(vdf) {
        for line in content.lines() {
            let line = line.trim();
            if line.to_lowercase().contains("\"path\"") {
                let parts: Vec<&str> = line.splitn(4, '"').collect();
                if parts.len() >= 4 {
                    library_dirs.push(parts[3].replace("\\\\", "\\").replace('/', "\\"));
                }
            }
        }
    }

    let acf_name = format!("appmanifest_{}.acf", app_id);
    for lib in &library_dirs {
        let acf_path = std::path::Path::new(lib).join("steamapps").join(&acf_name);
        if let Ok(content) = std::fs::read_to_string(&acf_path) {
            for line in content.lines() {
                let line = line.trim();
                if line.to_lowercase().starts_with("\"installdir\"") {
                    let parts: Vec<&str> = line.splitn(4, '"').collect();
                    if parts.len() >= 4 && !parts[3].is_empty() {
                        let full = std::path::Path::new(lib)
                            .join("steamapps")
                            .join("common")
                            .join(parts[3]);
                        return Some(full.to_string_lossy().to_string().replace('/', "\\"));
                    }
                }
            }
        }
    }
    None
}

#[derive(Clone, Serialize)]
pub struct RunningGame {
    pub game_id: String,
    pub name: String,
    pub started_at: String,
    pub elapsed_secs: u64,
    pub idle_secs: u64,
    pub idle: bool,
    pub detected: bool,
}

struct SessionState {
    token: u64,
    sid: String,
    game_id: String,
    name: String,
    started_at: String,
    exe_hint: Option<String>,
    install_dir: Option<String>,
    secs: u64,
    idle_secs: u64,
    idle: bool,
    detected: bool,
}

impl SessionState {
    fn snapshot(&self) -> RunningGame {
        RunningGame {
            game_id: self.game_id.clone(),
            name: self.name.clone(),
            started_at: self.started_at.clone(),
            elapsed_secs: self.secs,
            idle_secs: self.idle_secs,
            idle: self.idle,
            detected: self.detected,
        }
    }

    fn checkpoint(&self) -> Checkpoint {
        Checkpoint {
            sid: self.sid.clone(),
            game_id: self.game_id.clone(),
            started_at: self.started_at.clone(),
            secs: self.secs,
            saved_at: Utc::now().to_rfc3339(),
            exe_hint: self.exe_hint.clone(),
            install_dir: self.install_dir.clone(),
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Checkpoint {
    sid: String,
    game_id: String,
    started_at: String,
    secs: u64,
    saved_at: String,
    exe_hint: Option<String>,
    install_dir: Option<String>,
}

pub struct ActivePids {
    pids: Mutex<HashSet<u32>>,
    game_active: AtomicBool,
    next_token: AtomicU64,
    session: Mutex<Option<SessionState>>,
}

impl ActivePids {
    pub fn new() -> Self {
        Self {
            pids: Mutex::new(HashSet::new()),
            game_active: AtomicBool::new(false),
            next_token: AtomicU64::new(1),
            session: Mutex::new(None),
        }
    }

    fn running_name(&self) -> String {
        self.session.lock().ok()
            .and_then(|s| s.as_ref().map(|s| s.name.clone()))
            .filter(|n| !n.is_empty())
            .unwrap_or_else(|| "another game".to_string())
    }

    fn is_current(&self, token: u64) -> bool {
        self.game_active.load(Ordering::SeqCst)
            && self.session.lock().map(|s| s.as_ref().map(|s| s.token) == Some(token)).unwrap_or(false)
    }
}

fn write_checkpoint(app: &AppHandle, cp: &Checkpoint) {
    if let Ok(json) = serde_json::to_string(cp) {
        let db = app.state::<DbState>();
        let lock = db.0.lock();
        if let Ok(conn) = lock {
            let _ = queries::set_setting(&conn, CHECKPOINT_KEY, &json);
        }
    }
}

fn read_checkpoint(conn: &rusqlite::Connection) -> Option<Checkpoint> {
    queries::get_setting(conn, CHECKPOINT_KEY)
        .filter(|v| !v.is_empty())
        .and_then(|v| serde_json::from_str(&v).ok())
}

fn clear_checkpoint(conn: &rusqlite::Connection, sid: &str) {
    if read_checkpoint(conn).map(|c| c.sid == sid).unwrap_or(false) {
        let _ = conn.execute("DELETE FROM settings WHERE key = ?1", rusqlite::params![CHECKPOINT_KEY]);
    }
}

fn record_session(conn: &rusqlite::Connection, game_id: &str, started_at: &str, ended_at: &str, secs: u64) {
    let mins = ((secs + 30) / 60) as i64;
    if mins > 0 {
        let _ = conn.execute(
            "UPDATE games SET playtime_mins = playtime_mins + ?1, last_played = ?2 WHERE id = ?3",
            rusqlite::params![mins, ended_at, game_id],
        );
        let _ = conn.execute(
            "INSERT INTO sessions (id, game_id, started_at, ended_at, duration_mins) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![uuid::Uuid::new_v4().to_string(), game_id, started_at, ended_at, mins],
        );
    } else {
        let _ = conn.execute(
            "UPDATE games SET last_played = ?1 WHERE id = ?2",
            rusqlite::params![ended_at, game_id],
        );
    }
}

#[cfg(windows)]
struct Probe {
    dir: Option<String>,
    dir_norm: Option<String>,
    hint: Option<String>,
}

#[cfg(windows)]
impl Probe {
    fn new(dir: Option<String>, hint: Option<String>) -> Self {
        let dir_norm = dir.as_deref().map(normalize_dir);
        Self { dir, dir_norm, hint: hint.map(|h| h.to_lowercase()).filter(|h| !h.is_empty()) }
    }

    fn is_usable(&self) -> bool {
        self.dir.is_some() || self.hint.is_some()
    }

    fn locate(&self, current: Option<u32>) -> Option<u32> {
        let procs = snapshot_processes();
        if let Some(pid) = current {
            if procs.iter().any(|(p, _)| *p == pid) {
                return Some(pid);
            }
        }
        if let Some(h) = &self.hint {
            if let Some((pid, _)) = procs.iter().find(|(_, n)| n.to_lowercase() == *h) {
                return Some(*pid);
            }
        }
        if let Some(dir) = &self.dir {
            return find_pids_in_directory(dir).into_iter().next();
        }
        None
    }

    fn is_foreground(&self, pid: u32) -> bool {
        let fg = match get_foreground_pid() {
            Some(p) => p,
            None => return false,
        };
        if fg == pid {
            return true;
        }
        let path = match get_process_exe_path(fg) {
            Some(p) => p.to_lowercase(),
            None => return false,
        };
        if let Some(d) = &self.dir_norm {
            if path.starts_with(d.as_str()) {
                return true;
            }
        }
        if let Some(h) = &self.hint {
            if path.ends_with(&format!("\\{}", h)) {
                return true;
            }
        }
        false
    }
}

enum Watch {
    #[cfg(windows)]
    Process { probe: Probe, pid: Option<u32>, wait_secs: u64 },
    #[cfg(not(windows))]
    Child(std::process::Child),
    Manual,
}

#[derive(Default)]
struct PlayClock {
    exclude_idle: bool,
    base_secs: u64,
    active_ms: u128,
    idle_run_ms: u128,
    idle_total_ms: u128,
}

impl PlayClock {
    fn pending_idle_counts(&self) -> bool {
        self.idle_run_ms < (IDLE_THRESHOLD_SECS as u128) * 1000
    }

    fn total_secs(&self) -> u64 {
        let pending = if self.pending_idle_counts() { self.idle_run_ms } else { 0 };
        self.base_secs + ((self.active_ms + pending) / 1000) as u64
    }

    fn idle_secs(&self) -> u64 {
        let pending = if self.pending_idle_counts() { 0 } else { self.idle_run_ms };
        ((self.idle_total_ms + pending) / 1000) as u64
    }

    fn is_idle(&self) -> bool {
        self.idle_run_ms >= 30_000
    }

    fn add(&mut self, dt: Duration, foreground: Option<bool>) {
        if dt.as_secs() > SUSPEND_GAP_SECS {
            return;
        }
        let ms = dt.as_millis();
        if self.exclude_idle && foreground == Some(false) {
            self.idle_run_ms += ms;
        } else {
            self.settle();
            self.active_ms += ms;
        }
    }

    fn settle(&mut self) {
        if self.pending_idle_counts() {
            self.active_ms += self.idle_run_ms;
        } else {
            self.idle_total_ms += self.idle_run_ms;
        }
        self.idle_run_ms = 0;
    }
}

struct Tracker {
    app: AppHandle,
    token: u64,
    sid: String,
    game_id: String,
    started_at: String,
    clock: PlayClock,
    last_tick: Instant,
    last_checkpoint: Instant,
    detected: bool,
}

impl Tracker {
    fn alive(&self) -> bool {
        self.app.state::<ActivePids>().is_current(self.token)
    }

    fn rest(&self, total: Duration) -> bool {
        let step = Duration::from_millis(250);
        let mut waited = Duration::ZERO;
        while waited < total {
            std::thread::sleep(step);
            waited += step;
            if !self.alive() {
                return false;
            }
        }
        true
    }

    fn total_secs(&self) -> u64 {
        self.clock.total_secs()
    }

    fn skip(&mut self) {
        self.last_tick = Instant::now();
    }

    fn tick(&mut self, foreground: Option<bool>) {
        let now = Instant::now();
        let dt = now.duration_since(self.last_tick);
        self.last_tick = now;
        self.clock.add(dt, foreground);
    }

    fn publish(&mut self) {
        let snapshot = {
            let ap = self.app.state::<ActivePids>();
            let mut guard = match ap.session.lock() {
                Ok(g) => g,
                Err(_) => return,
            };
            match guard.as_mut() {
                Some(s) if s.token == self.token => {
                    s.secs = self.clock.total_secs();
                    s.idle_secs = self.clock.idle_secs();
                    s.idle = self.clock.is_idle();
                    s.detected = self.detected;
                    Some((s.snapshot(), s.checkpoint()))
                }
                _ => None,
            }
        };
        if let Some((snap, cp)) = snapshot {
            let _ = self.app.emit("game-session-tick", &snap);
            if self.detected && self.last_checkpoint.elapsed().as_secs() >= 60 {
                self.last_checkpoint = Instant::now();
                write_checkpoint(&self.app, &cp);
            }
        }
    }

    fn mark_detected(&mut self, pid: Option<u32>) {
        self.detected = true;
        self.last_tick = Instant::now();
        if let Some(p) = pid {
            self.register(p);
        }
        self.publish();
    }

    fn register(&self, pid: u32) {
        if let Ok(mut set) = self.app.state::<ActivePids>().pids.lock() {
            set.insert(pid);
        }
    }

    fn finish(mut self) {
        self.clock.settle();
        let secs = if self.detected { self.clock.total_secs() } else { self.clock.base_secs };
        let now = Utc::now().to_rfc3339();
        {
            let db = self.app.state::<DbState>();
            let lock = db.0.lock();
            if let Ok(conn) = lock {
                record_session(&conn, &self.game_id, &self.started_at, &now, secs);
                clear_checkpoint(&conn, &self.sid);
            }
        }
        let was_current = {
            let ap = self.app.state::<ActivePids>();
            let mut guard = ap.session.lock().unwrap_or_else(|e| e.into_inner());
            if guard.as_ref().map(|s| s.token) == Some(self.token) {
                *guard = None;
                ap.game_active.store(false, Ordering::SeqCst);
                ap.pids.lock().unwrap_or_else(|e| e.into_inner()).clear();
                true
            } else {
                false
            }
        };
        let _ = self.app.emit("game-session-ended", &self.game_id);
        if was_current {
            if let Some(win) = self.app.get_webview_window("main") {
                let _ = win.unminimize();
                let _ = win.set_focus();
            }
        }
    }

    fn run(self, watch: Watch) {
        match watch {
            #[cfg(windows)]
            Watch::Process { probe, pid, wait_secs } => self.run_process(probe, pid, wait_secs),
            #[cfg(not(windows))]
            Watch::Child(child) => self.run_child(child),
            Watch::Manual => self.run_manual(),
        }
    }

    fn run_manual(mut self) {
        self.mark_detected(None);
        while self.rest(TICK) {
            self.tick(None);
            self.publish();
            if self.total_secs() > MAX_SESSION_SECS {
                break;
            }
        }
        self.tick(None);
        self.finish();
    }

    #[cfg(not(windows))]
    fn run_child(mut self, mut child: std::process::Child) {
        self.mark_detected(Some(child.id()));
        loop {
            if !self.rest(TICK) {
                break;
            }
            self.tick(None);
            self.publish();
            if self.total_secs() > MAX_SESSION_SECS {
                break;
            }
            match child.try_wait() {
                Ok(Some(_)) | Err(_) => break,
                Ok(None) => {}
            }
        }
        self.finish();
    }

    #[cfg(windows)]
    fn run_process(mut self, probe: Probe, sentinel: Option<u32>, wait_secs: u64) {
        if let Some(p) = sentinel {
            self.register(p);
        }
        let wait_start = Instant::now();
        let mut pid = loop {
            if let Some(p) = probe.locate(sentinel) {
                break p;
            }
            if wait_start.elapsed().as_secs() >= wait_secs || !self.rest(Duration::from_secs(1)) {
                self.finish();
                return;
            }
        };
        self.mark_detected(Some(pid));

        let mut empty_ticks: u32 = 0;
        let mut continuous_secs: u64 = 0;
        let mut confirmed = self.clock.base_secs > 0;

        loop {
            if !self.rest(TICK) {
                self.tick(Some(probe.is_foreground(pid)));
                break;
            }
            match probe.locate(Some(pid)) {
                Some(p) => {
                    if p != pid {
                        pid = p;
                        self.register(p);
                    }
                    if empty_ticks > 0 {
                        confirmed = true;
                        continuous_secs = 0;
                        self.skip();
                    }
                    empty_ticks = 0;
                    continuous_secs += TICK.as_secs();
                    if continuous_secs >= 30 {
                        confirmed = true;
                    }
                    let fg = probe.is_foreground(pid);
                    self.tick(Some(fg));
                    self.publish();
                }
                None => {
                    self.skip();
                    empty_ticks += 1;
                    let grace = if confirmed { 6 } else { 36 };
                    if empty_ticks >= grace {
                        break;
                    }
                }
            }
            if self.total_secs() > MAX_SESSION_SECS {
                break;
            }
        }
        self.finish();
    }
}

fn start_session(
    app: &AppHandle,
    game_id: &str,
    name: &str,
    started_at: &str,
    exe_hint: Option<String>,
    install_dir: Option<String>,
    exclude_idle: bool,
    base_secs: u64,
    sid: Option<String>,
    watch: Watch,
) {
    let ap = app.state::<ActivePids>();
    let token = ap.next_token.fetch_add(1, Ordering::SeqCst);
    let sid = sid.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let state = SessionState {
        token,
        sid: sid.clone(),
        game_id: game_id.to_string(),
        name: name.to_string(),
        started_at: started_at.to_string(),
        exe_hint,
        install_dir,
        secs: base_secs,
        idle_secs: 0,
        idle: false,
        detected: base_secs > 0,
    };
    let snap = state.snapshot();
    *ap.session.lock().unwrap_or_else(|e| e.into_inner()) = Some(state);
    ap.pids.lock().unwrap_or_else(|e| e.into_inner()).clear();
    ap.game_active.store(true, Ordering::SeqCst);
    let _ = app.emit("game-session-started", &snap);

    let tracker = Tracker {
        app: app.clone(),
        token,
        sid,
        game_id: game_id.to_string(),
        started_at: started_at.to_string(),
        clock: PlayClock { exclude_idle, base_secs, ..Default::default() },
        last_tick: Instant::now(),
        last_checkpoint: Instant::now(),
        detected: false,
    };
    std::thread::spawn(move || tracker.run(watch));
}

pub fn persist_active_session(app: &AppHandle) {
    let cp = {
        let ap = app.state::<ActivePids>();
        let guard = ap.session.lock().unwrap_or_else(|e| e.into_inner());
        guard.as_ref().filter(|s| s.detected).map(|s| s.checkpoint())
    };
    if let Some(cp) = cp {
        write_checkpoint(app, &cp);
    }
}

pub fn recover_session(app: &AppHandle) {
    let (cp, name, exclude_idle) = {
        let db = app.state::<DbState>();
        let lock = db.0.lock();
        let conn = match lock {
            Ok(c) => c,
            Err(_) => return,
        };
        let cp = match read_checkpoint(&conn) {
            Some(c) => c,
            None => return,
        };
        let name = queries::get_game_by_id(&conn, &cp.game_id).ok().flatten().map(|g| g.name);
        let idle = queries::get_setting(&conn, "exclude_idle_time").map(|v| v != "false").unwrap_or(true);
        if name.is_none() {
            clear_checkpoint(&conn, &cp.sid);
            return;
        }
        (cp, name.unwrap_or_default(), idle)
    };

    let gap = chrono::DateTime::parse_from_rfc3339(&cp.saved_at)
        .map(|t| Utc::now().signed_duration_since(t.with_timezone(&Utc)).num_seconds().max(0) as u64)
        .unwrap_or(0);

    #[cfg(windows)]
    {
        let probe = Probe::new(cp.install_dir.clone(), cp.exe_hint.clone());
        if gap < 12 * 3600 && probe.is_usable() {
            if let Some(pid) = probe.locate(None) {
                let base = cp.secs + gap;
                start_session(
                    app, &cp.game_id, &name, &cp.started_at,
                    cp.exe_hint.clone(), cp.install_dir.clone(), exclude_idle, base, Some(cp.sid.clone()),
                    Watch::Process { probe, pid: Some(pid), wait_secs: 0 },
                );
                return;
            }
        }
    }
    let _ = (gap, exclude_idle, &name);

    let db = app.state::<DbState>();
    let lock = db.0.lock();
    if let Ok(conn) = lock {
        record_session(&conn, &cp.game_id, &cp.started_at, &cp.saved_at, cp.secs);
        clear_checkpoint(&conn, &cp.sid);
    }
}

struct LaunchInfo {
    exe_path: Option<String>,
    install_dir: Option<String>,
    name: String,
    minimize: bool,
    exclude_idle: bool,
    not_installed: bool,
}

fn load_launch_info(state: &DbState, game_id: &str) -> Result<Option<LaunchInfo>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let game = queries::get_game_by_id(&conn, game_id).map_err(|e| e.to_string())?;
    let minimize = queries::get_setting(&conn, "minimize_on_launch").map(|v| v == "true").unwrap_or(false);
    let exclude_idle = queries::get_setting(&conn, "exclude_idle_time").map(|v| v != "false").unwrap_or(true);
    Ok(game.map(|g| {
        let exe = g.exe_path.clone().filter(|e| !e.trim().is_empty());
        let dir = g.install_dir.clone().filter(|d| !d.trim().is_empty()).or_else(|| {
            let parent = std::path::Path::new(exe.as_ref()?).parent()?;
            if parent.components().count() <= 1 {
                return None;
            }
            Some(parent.to_string_lossy().to_string())
        });
        LaunchInfo { exe_path: exe, install_dir: dir, name: g.name, minimize, exclude_idle, not_installed: g.not_installed }
    }))
}

fn claim_slot(app: &AppHandle) -> Result<(), String> {
    let ap = app.state::<ActivePids>();
    if ap.game_active.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst).is_err() {
        let running_name = ap.running_name();
        let _ = app.emit("game-already-running", &running_name);
        #[cfg(windows)]
        show_native_alert("ZGameLib", &format!("\"{}\" is already being tracked.\nClose it first or use Stop Tracking.", running_name));
        return Err(format!("GAME_ALREADY_RUNNING:{}", running_name));
    }
    Ok(())
}

fn release_slot(app: &AppHandle) {
    app.state::<ActivePids>().game_active.store(false, Ordering::SeqCst);
}

fn end_current(app: &AppHandle, active_pids: &ActivePids) {
    active_pids.game_active.store(false, Ordering::SeqCst);
    let ended = active_pids.session.lock().ok().and_then(|mut s| s.take()).map(|s| s.game_id).unwrap_or_default();
    let _ = app.emit("game-session-ended", &ended);
}

fn exe_file_name(exe: &Option<String>) -> Option<String> {
    exe.as_ref().and_then(|e| std::path::Path::new(e).file_name().map(|n| n.to_string_lossy().to_string()))
}

fn after_launch(app: &AppHandle, state: &DbState, game_id: &str, info: LaunchInfo, watch: Watch) {
    let now = Utc::now().to_rfc3339();
    if let Ok(conn) = state.0.lock() {
        let _ = conn.execute("UPDATE games SET last_played = ?1 WHERE id = ?2", rusqlite::params![now, game_id]);
    }
    if info.minimize {
        let app_min = app.clone();
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(400));
            if let Some(win) = app_min.get_webview_window("main") {
                let _ = win.minimize();
            }
        });
    }
    let hint = exe_file_name(&info.exe_path);
    start_session(app, game_id, &info.name, &now, hint, info.install_dir.clone(), info.exclude_idle, 0, None, watch);
}

#[cfg(windows)]
fn store_watch(info: &LaunchInfo, resolved_dir: Option<String>) -> Watch {
    let probe = Probe::new(resolved_dir.or_else(|| info.install_dir.clone()), exe_file_name(&info.exe_path));
    if probe.is_usable() {
        Watch::Process { probe, pid: None, wait_secs: 300 }
    } else {
        Watch::Manual
    }
}

fn launch_with_uri(app: AppHandle, state: State<DbState>, game_id: String, uri: String, label: &str, steam_app_id: Option<String>) -> Result<(), String> {
    let info = load_launch_info(&state, &game_id)?.unwrap_or(LaunchInfo {
        exe_path: None, install_dir: None, name: String::new(), minimize: false, exclude_idle: true, not_installed: false,
    });
    if info.not_installed {
        if let Some(id) = &steam_app_id {
            open::that(format!("steam://install/{}", id)).map_err(|e| format!("Failed to open Steam install dialog: {}", e))?;
            return Ok(());
        }
    }
    claim_slot(&app)?;
    if let Err(e) = open::that(&uri) {
        release_slot(&app);
        return Err(format!("Failed to launch {}: {}", label, e));
    }
    #[cfg(windows)]
    let watch = {
        let resolved = if info.install_dir.is_none() { steam_app_id.as_deref().and_then(find_steam_game_dir) } else { None };
        store_watch(&info, resolved)
    };
    #[cfg(not(windows))]
    let watch = {
        let _ = &steam_app_id;
        Watch::Manual
    };
    after_launch(&app, &state, &game_id, info, watch);
    Ok(())
}

#[tauri::command(async)]
pub fn launch_game(app: AppHandle, state: State<DbState>, id: String) -> Result<(), String> {
    let info = load_launch_info(&state, &id)?.ok_or("Game not found")?;
    let exe_path = info.exe_path.clone().ok_or("No executable path set for this game")?;
    claim_slot(&app)?;
    let mut cmd = std::process::Command::new(&exe_path);
    if let Some(parent) = std::path::Path::new(&exe_path).parent().filter(|p| p.is_dir()) {
        cmd.current_dir(parent);
    }
    let child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            release_slot(&app);
            return Err(format!("Failed to launch: {}", e));
        }
    };
    #[cfg(windows)]
    let watch = {
        let pid = child.id();
        drop(child);
        Watch::Process { probe: Probe::new(info.install_dir.clone(), exe_file_name(&info.exe_path)), pid: Some(pid), wait_secs: 300 }
    };
    #[cfg(not(windows))]
    let watch = Watch::Child(child);
    after_launch(&app, &state, &id, info, watch);
    Ok(())
}

#[tauri::command(async)]
pub fn launch_steam_game(app: AppHandle, state: State<DbState>, app_id: String, game_id: String) -> Result<(), String> {
    let uri = format!("steam://run/{}", app_id);
    launch_with_uri(app, state, game_id, uri, "Steam game", Some(app_id))
}

#[tauri::command(async)]
pub fn launch_epic_game(app: AppHandle, state: State<DbState>, app_name: String, game_id: String) -> Result<(), String> {
    let uri = format!("com.epicgames.launcher://apps/{}?action=launch&silent=true", app_name);
    launch_with_uri(app, state, game_id, uri, "Epic game", None)
}

#[tauri::command(async)]
pub fn launch_ubisoft_game(app: AppHandle, state: State<DbState>, game_id: String, game_db_id: String) -> Result<(), String> {
    let uri = format!("ubisoft://launch/{}", game_id);
    launch_with_uri(app, state, game_db_id, uri, "Ubisoft game", None)
}

#[tauri::command(async)]
pub fn get_running_game(active_pids: State<ActivePids>) -> Option<RunningGame> {
    if !active_pids.game_active.load(Ordering::SeqCst) {
        return None;
    }
    active_pids.session.lock().ok().and_then(|s| s.as_ref().map(|s| s.snapshot()))
}

#[cfg(windows)]
fn focus_window_of(pids: &[u32]) -> bool {
    use windows::Win32::Foundation::{BOOL, HWND, LPARAM};
    use windows::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetWindow, GetWindowThreadProcessId, IsIconic, IsWindowVisible, SetForegroundWindow, ShowWindow, GW_OWNER, SW_RESTORE,
    };
    struct Search {
        pids: Vec<u32>,
        found: Option<HWND>,
    }
    unsafe extern "system" fn visit(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let search = &mut *(lparam.0 as *mut Search);
        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        if search.pids.contains(&pid) && IsWindowVisible(hwnd).as_bool() {
            let owned = GetWindow(hwnd, GW_OWNER).map(|h| !h.0.is_null()).unwrap_or(false);
            if !owned {
                search.found = Some(hwnd);
                return BOOL(0);
            }
        }
        BOOL(1)
    }
    let mut search = Search { pids: pids.to_vec(), found: None };
    unsafe {
        let _ = EnumWindows(Some(visit), LPARAM(&mut search as *mut Search as isize));
        if let Some(hwnd) = search.found {
            if IsIconic(hwnd).as_bool() {
                let _ = ShowWindow(hwnd, SW_RESTORE);
            }
            return SetForegroundWindow(hwnd).as_bool();
        }
    }
    false
}

#[tauri::command(async)]
pub fn focus_running_game(active_pids: State<ActivePids>) -> Result<bool, String> {
    #[cfg(windows)]
    {
        let mut pids: Vec<u32> = active_pids.pids.lock().map_err(|e| e.to_string())?.iter().copied().collect();
        let probe = active_pids.session.lock().ok().and_then(|s| s.as_ref().map(|s| Probe::new(s.install_dir.clone(), s.exe_hint.clone())));
        if let Some(p) = probe.and_then(|p| p.locate(None)) {
            if !pids.contains(&p) {
                pids.insert(0, p);
            }
        }
        if pids.is_empty() {
            return Ok(false);
        }
        return Ok(focus_window_of(&pids));
    }
    #[cfg(not(windows))]
    {
        let _ = active_pids;
        Ok(false)
    }
}

#[tauri::command(async)]
pub fn stop_tracking(app: AppHandle, active_pids: State<ActivePids>) -> Result<(), String> {
    end_current(&app, &active_pids);
    Ok(())
}

#[tauri::command(async)]
pub fn stop_game(app: AppHandle, active_pids: State<ActivePids>) -> Result<(), String> {
    #[cfg(windows)]
    {
        let pids_to_kill: Vec<u32> = active_pids.pids.lock().map_err(|e| e.to_string())?.iter().copied().collect();
        for pid in &pids_to_kill {
            kill_process(*pid);
        }
    }
    end_current(&app, &active_pids);
    Ok(())
}

#[tauri::command(async)]
pub fn open_game_folder(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let game = queries::get_game_by_id(&conn, &id)
        .map_err(|e| e.to_string())?
        .ok_or("Game not found")?;

    let folder = game
        .install_dir
        .or(game.exe_path.as_ref().and_then(|p| {
            std::path::Path::new(p)
                .parent()
                .map(|par| par.to_string_lossy().to_string())
        }))
        .ok_or("No folder path available")?;

    open::that(&folder).map_err(|e: std::io::Error| e.to_string())?;
    Ok(())
}

#[cfg(windows)]
fn kill_process(pid: u32) {
    use windows::Win32::System::Threading::{OpenProcess, TerminateProcess, PROCESS_TERMINATE};
    use windows::Win32::Foundation::CloseHandle;
    unsafe {
        if let Ok(handle) = OpenProcess(PROCESS_TERMINATE, false, pid) {
            let _ = TerminateProcess(handle, 1);
            let _ = CloseHandle(handle);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn secs(n: u64) -> Duration {
        Duration::from_secs(n)
    }

    #[test]
    fn short_alt_tabs_count_as_play() {
        let mut c = PlayClock { exclude_idle: true, ..Default::default() };
        for _ in 0..12 { c.add(secs(5), Some(true)); }
        for _ in 0..24 { c.add(secs(5), Some(false)); }
        for _ in 0..12 { c.add(secs(5), Some(true)); }
        c.settle();
        assert_eq!(c.total_secs(), 240);
        assert_eq!(c.idle_secs(), 0);
    }

    #[test]
    fn long_background_time_is_excluded() {
        let mut c = PlayClock { exclude_idle: true, ..Default::default() };
        for _ in 0..12 { c.add(secs(5), Some(true)); }
        for _ in 0..120 { c.add(secs(5), Some(false)); }
        assert_eq!(c.total_secs(), 60);
        assert_eq!(c.idle_secs(), 600);
        for _ in 0..12 { c.add(secs(5), Some(true)); }
        c.settle();
        assert_eq!(c.total_secs(), 120);
        assert_eq!(c.idle_secs(), 600);
    }

    #[test]
    fn idle_counts_when_exclusion_is_off() {
        let mut c = PlayClock { exclude_idle: false, ..Default::default() };
        for _ in 0..120 { c.add(secs(5), Some(false)); }
        c.settle();
        assert_eq!(c.total_secs(), 600);
    }

    #[test]
    fn sleep_and_hibernate_gaps_are_ignored() {
        let mut c = PlayClock { exclude_idle: true, base_secs: 100, ..Default::default() };
        c.add(secs(5), Some(true));
        c.add(secs(3600), Some(true));
        c.add(secs(5), Some(true));
        c.settle();
        assert_eq!(c.total_secs(), 110);
    }

    #[test]
    fn minutes_are_rounded_not_floored() {
        assert_eq!((89u64 + 30) / 60, 1);
        assert_eq!((90u64 + 30) / 60, 2);
        assert_eq!((29u64 + 30) / 60, 0);
    }
}
