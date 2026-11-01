use crate::commands::games::fetch_fresh_igdb_token;
use crate::commands::scanner::{clean_title_for_search, steam_search};
use crate::db::{queries, DbState, IgdbTokenState};
use serde::Serialize;
use std::io::Read;
use tauri::State;

#[derive(Debug, Clone, Serialize)]
pub struct CoverResult {
    pub source: String,
    pub name: String,
    pub url: String,
    pub thumb: String,
    pub score: i32,
}

const UA: &str = "ZGameLib/1.3 (+https://zsync.eu/zgamelib/)";

fn norm(s: &str) -> String {
    s.to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { ' ' })
        .collect::<String>()
        .split_whitespace()
        .map(|w| match w {
            "ii" => "2", "iii" => "3", "iv" => "4", "v" => "5", "vi" => "6", "vii" => "7", "viii" => "8", "ix" => "9", "x" => "10",
            other => other,
        })
        .collect::<Vec<_>>()
        .join(" ")
}

pub(crate) fn name_score(query: &str, candidate: &str) -> i32 {
    let q = norm(query);
    let c = norm(candidate);
    if q.is_empty() || c.is_empty() { return 0; }
    let noise = ["soundtrack", "ost", "artbook", "demo", "dlc", "season pass", "dedicated server", "sdk", "playtest", "wallpaper", "upgrade", "expansion pack"];
    let mut score = if c == q {
        100
    } else if c.starts_with(&format!("{} ", q)) {
        70 - (c.len() as i32 - q.len() as i32).min(30)
    } else if q.starts_with(&format!("{} ", c)) {
        55
    } else if c.contains(&q) {
        35
    } else {
        let qw: Vec<&str> = q.split(' ').collect();
        let cw: Vec<&str> = c.split(' ').collect();
        let common = qw.iter().filter(|w| cw.contains(w)).count() as i32;
        (common * 40) / (qw.len().max(cw.len()) as i32).max(1)
    };
    if !noise.iter().any(|w| q.contains(w)) && noise.iter().any(|w| c.contains(w)) { score -= 45; }
    let qn: Vec<&str> = q.split(' ').filter(|w| w.chars().all(|ch| ch.is_ascii_digit())).collect();
    let cn: Vec<&str> = c.split(' ').filter(|w| w.chars().all(|ch| ch.is_ascii_digit())).collect();
    if qn != cn { score -= 30; }
    score
}

fn http_json(req: ureq::Request) -> Option<serde_json::Value> {
    let resp = req.set("User-Agent", UA).timeout(std::time::Duration::from_secs(12)).call().ok()?;
    let mut body = String::new();
    resp.into_reader().take(8 * 1024 * 1024).read_to_string(&mut body).ok()?;
    serde_json::from_str(&body).ok()
}

fn steam_urls(app_id: &str) -> (String, String) {
    (
        format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{}/library_600x900_2x.jpg", app_id),
        format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{}/library_600x900.jpg", app_id),
    )
}

pub(crate) fn parse_steam_store(json: &serde_json::Value) -> Vec<(String, String)> {
    json["items"].as_array().map(|items| {
        items.iter().filter_map(|it| {
            let id = match &it["id"] {
                serde_json::Value::Number(n) => n.to_string(),
                serde_json::Value::String(s) => s.clone(),
                _ => return None,
            };
            let kind = it["type"].as_str().unwrap_or("app");
            if kind != "app" { return None; }
            Some((id, it["name"].as_str().unwrap_or_default().to_string()))
        }).collect()
    }).unwrap_or_default()
}

fn steam_store(query: &str) -> Vec<CoverResult> {
    let Some(json) = http_json(ureq::get("https://store.steampowered.com/api/storesearch/").query("term", query).query("l", "english").query("cc", "US")) else { return Vec::new(); };
    parse_steam_store(&json).into_iter().take(8).map(|(id, name)| {
        let (url, thumb) = steam_urls(&id);
        CoverResult { source: "Steam".into(), score: name_score(query, &name), name, url, thumb }
    }).collect()
}

fn steam_community(query: &str) -> Vec<CoverResult> {
    steam_search(query, 12).into_iter().take(8).map(|(id, name)| {
        let (url, thumb) = steam_urls(&id);
        CoverResult { source: "Steam".into(), score: name_score(query, &name), name, url, thumb }
    }).collect()
}

pub(crate) fn parse_sgdb_search(json: &serde_json::Value) -> Vec<(u64, String)> {
    json["data"].as_array().map(|a| a.iter().filter_map(|g| Some((g["id"].as_u64()?, g["name"].as_str().unwrap_or_default().to_string()))).collect()).unwrap_or_default()
}

pub(crate) fn parse_sgdb_grids(json: &serde_json::Value) -> Vec<(String, String)> {
    json["data"].as_array().map(|a| a.iter().filter_map(|g| {
        let url = g["url"].as_str()?.to_string();
        let thumb = g["thumb"].as_str().map(|s| s.to_string()).unwrap_or_else(|| url.clone());
        Some((url, thumb))
    }).collect()).unwrap_or_default()
}

fn steamgriddb(query: &str, key: &str) -> Vec<CoverResult> {
    let auth = format!("Bearer {}", key.trim());
    let search_url = format!("https://www.steamgriddb.com/api/v2/search/autocomplete/{}", urlencode(query));
    let Some(json) = http_json(ureq::get(&search_url).set("Authorization", &auth)) else { return Vec::new(); };
    let mut games = parse_sgdb_search(&json);
    games.sort_by_key(|(_, name)| -name_score(query, name));
    let mut out = Vec::new();
    for (id, name) in games.into_iter().take(3) {
        let base = name_score(query, &name);
        if base < 20 && !out.is_empty() { continue; }
        let grids_url = format!("https://www.steamgriddb.com/api/v2/grids/game/{}?dimensions=600x900,342x482,660x930&types=static&nsfw=false", id);
        let Some(g) = http_json(ureq::get(&grids_url).set("Authorization", &auth)) else { continue; };
        for (i, (url, thumb)) in parse_sgdb_grids(&g).into_iter().take(6).enumerate() {
            out.push(CoverResult { source: "SteamGridDB".into(), name: name.clone(), url, thumb, score: base + 4 - i as i32 });
        }
    }
    out
}

pub(crate) fn parse_igdb(json: &serde_json::Value) -> Vec<(String, String)> {
    json.as_array().map(|a| a.iter().filter_map(|g| {
        let image_id = g["cover"]["image_id"].as_str()?.to_string();
        Some((g["name"].as_str().unwrap_or_default().to_string(), image_id))
    }).collect()).unwrap_or_default()
}

fn igdb(query: &str, client_id: &str, secret: &str, token_state: &IgdbTokenState) -> Vec<CoverResult> {
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    let cached = token_state.0.lock().ok().and_then(|c| c.clone());
    let token = match cached {
        Some((t, exp)) if now + 60 < exp => t,
        _ => match fetch_fresh_igdb_token(client_id, secret, now) {
            Ok((t, exp)) => {
                if let Ok(mut c) = token_state.0.lock() { *c = Some((t.clone(), exp)); }
                t
            }
            Err(_) => return Vec::new(),
        },
    };
    let body = format!("fields name,cover.image_id; search \"{}\"; where cover != null; limit 10;", query.replace('"', ""));
    let Ok(resp) = ureq::post("https://api.igdb.com/v4/games")
        .set("Client-ID", client_id.trim())
        .set("Authorization", &format!("Bearer {}", token))
        .set("Content-Type", "text/plain")
        .set("User-Agent", UA)
        .timeout(std::time::Duration::from_secs(12))
        .send_string(&body) else { return Vec::new(); };
    let Ok(text) = resp.into_string() else { return Vec::new(); };
    let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) else { return Vec::new(); };
    parse_igdb(&json).into_iter().map(|(name, image_id)| CoverResult {
        source: "IGDB".into(),
        score: name_score(query, &name),
        url: format!("https://images.igdb.com/igdb/image/upload/t_cover_big_2x/{}.jpg", image_id),
        thumb: format!("https://images.igdb.com/igdb/image/upload/t_cover_big/{}.jpg", image_id),
        name,
    }).collect()
}

fn urlencode(s: &str) -> String {
    let mut out = String::new();
    for b in s.as_bytes() {
        if b.is_ascii_alphanumeric() || matches!(*b, b'-' | b'_' | b'.' | b'~') { out.push(*b as char); } else { out.push_str(&format!("%{:02X}", b)); }
    }
    out
}

pub(crate) fn merge_results(mut all: Vec<CoverResult>) -> Vec<CoverResult> {
    let source_bonus = |s: &str| match s { "SteamGridDB" => 6, "Steam" => 4, "IGDB" => 2, _ => 0 };
    for r in all.iter_mut() { r.score += source_bonus(&r.source); }
    all.sort_by(|a, b| b.score.cmp(&a.score));
    let mut seen = std::collections::HashSet::new();
    all.retain(|r| seen.insert(r.url.clone()));
    all.truncate(36);
    all
}

#[tauri::command(async)]
pub fn search_cover_art(
    state: State<DbState>,
    token_state: State<IgdbTokenState>,
    query: String,
    providers: Option<Vec<String>>,
) -> Result<Vec<CoverResult>, String> {
    let q = clean_title_for_search(&query);
    if q.trim().is_empty() { return Ok(Vec::new()); }
    let (sgdb_key, igdb_id, igdb_secret) = {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        (
            queries::get_setting(&conn, "steamgriddb_api_key").filter(|s| !s.trim().is_empty()),
            queries::get_setting(&conn, "igdb_client_id").filter(|s| !s.trim().is_empty()),
            queries::get_setting(&conn, "igdb_client_secret").filter(|s| !s.trim().is_empty()),
        )
    };
    let wants = |p: &str| providers.as_ref().map_or(true, |list| list.iter().any(|x| x.eq_ignore_ascii_case(p)));
    let token: &IgdbTokenState = &token_state;
    let results = std::thread::scope(|scope| {
        let mut handles = Vec::new();
        if wants("steam") {
            let q1 = q.clone();
            handles.push(scope.spawn(move || steam_store(&q1)));
            let q2 = q.clone();
            handles.push(scope.spawn(move || steam_community(&q2)));
        }
        if wants("steamgriddb") {
            if let Some(key) = sgdb_key.clone() {
                let q3 = q.clone();
                handles.push(scope.spawn(move || steamgriddb(&q3, &key)));
            }
        }
        if wants("igdb") {
            if let (Some(id), Some(secret)) = (igdb_id.clone(), igdb_secret.clone()) {
                let q4 = q.clone();
                handles.push(scope.spawn(move || igdb(&q4, &id, &secret, token)));
            }
        }
        handles.into_iter().flat_map(|h| h.join().unwrap_or_default()).collect::<Vec<_>>()
    });
    Ok(merge_results(results))
}

fn looks_like_image(bytes: &[u8]) -> Option<&'static str> {
    if bytes.len() < 1024 { return None; }
    if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) { return Some("jpg"); }
    if bytes.starts_with(&[0x89, b'P', b'N', b'G']) { return Some("png"); }
    if bytes.len() > 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" { return Some("webp"); }
    None
}

fn download_image(url: &str) -> Result<(Vec<u8>, &'static str), String> {
    let resp = ureq::get(url).set("User-Agent", UA).timeout(std::time::Duration::from_secs(20)).call().map_err(|e| e.to_string())?;
    let mut bytes = Vec::new();
    resp.into_reader().take(25 * 1024 * 1024).read_to_end(&mut bytes).map_err(|e| e.to_string())?;
    let ext = looks_like_image(&bytes).ok_or_else(|| "The link did not return an image".to_string())?;
    Ok((bytes, ext))
}

fn candidate_urls(url: &str) -> Vec<String> {
    let mut urls = vec![url.to_string()];
    if let Some(rest) = url.split("/steam/apps/").nth(1) {
        if let Some(app_id) = rest.split('/').next() {
            for name in ["library_600x900_2x.jpg", "library_600x900.jpg", "header.jpg"] {
                let u = format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{}/{}", app_id, name);
                if !urls.contains(&u) { urls.push(u); }
            }
        }
    }
    if url.contains("/t_cover_big_2x/") { urls.push(url.replace("/t_cover_big_2x/", "/t_cover_big/")); }
    urls
}

#[tauri::command(async)]
pub fn apply_cover_url(state: State<DbState>, game_id: String, url: String) -> Result<String, String> {
    let mut last_err = String::from("No image found");
    let mut got = None;
    for u in candidate_urls(&url) {
        match download_image(&u) {
            Ok(v) => { got = Some(v); break; }
            Err(e) => last_err = e,
        }
    }
    let (bytes, ext) = got.ok_or(last_err)?;
    let dir = dirs::data_local_dir().unwrap_or_else(|| std::path::PathBuf::from(".")).join("ZGameLib").join("covers");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let stamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0);
    let safe_id: String = game_id.chars().filter(|c| c.is_ascii_alphanumeric() || *c == '-').collect();
    let dest = dir.join(format!("{}_{}.{}", safe_id, stamp, ext));
    let tmp = dest.with_extension("part");
    std::fs::write(&tmp, &bytes).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, &dest).map_err(|e| e.to_string())?;
    let path = dest.to_string_lossy().to_string();
    let old = {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        let old: Option<String> = conn.query_row("SELECT cover_path FROM games WHERE id = ?1", [&game_id], |r| r.get(0)).ok().flatten();
        queries::update_cover_path(&conn, &game_id, &path).map_err(|e| e.to_string())?;
        old
    };
    if let Some(old) = old {
        let old_path = std::path::Path::new(&old);
        if old_path.starts_with(&dir) && old_path != dest && old_path.file_name().map_or(false, |n| n.to_string_lossy().starts_with(&format!("{}_", safe_id))) {
            let _ = std::fs::remove_file(old_path);
        }
    }
    Ok(path)
}

#[tauri::command(async)]
pub fn get_setting(state: State<DbState>, key: String) -> Result<Option<String>, String> {
    let allowed = ["steamgriddb_api_key"];
    if !allowed.contains(&key.as_str()) { return Err("Unknown setting".into()); }
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    Ok(queries::get_setting(&conn, &key))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scores_exact_and_rejects_sequels_and_soundtracks() {
        assert!(name_score("Hades II", "Hades II") >= 100);
        assert!(name_score("Hades II", "Hades 2") >= 100);
        assert!(name_score("Hades II", "Hades") < name_score("Hades II", "Hades II"));
        assert!(name_score("Hollow Knight", "Hollow Knight Soundtrack") < name_score("Hollow Knight", "Hollow Knight: Silksong"));
        assert!(name_score("Doom 2", "Doom 3") < 50);
    }

    #[test]
    fn parses_provider_payloads() {
        let store: serde_json::Value = serde_json::from_str(r#"{"total":2,"items":[{"type":"app","name":"Hades II","id":1145350},{"type":"sub","name":"Bundle","id":5}]}"#).unwrap();
        assert_eq!(parse_steam_store(&store), vec![("1145350".to_string(), "Hades II".to_string())]);
        let sgdb: serde_json::Value = serde_json::from_str(r#"{"success":true,"data":[{"id":42,"name":"Hades II","types":["steam"],"verified":true}]}"#).unwrap();
        assert_eq!(parse_sgdb_search(&sgdb), vec![(42, "Hades II".to_string())]);
        let grids: serde_json::Value = serde_json::from_str(r#"{"success":true,"data":[{"id":1,"url":"https://cdn2.steamgriddb.com/grid/a.png","thumb":"https://cdn2.steamgriddb.com/thumb/a.png","width":600,"height":900}]}"#).unwrap();
        assert_eq!(parse_sgdb_grids(&grids)[0].0, "https://cdn2.steamgriddb.com/grid/a.png");
        let ig: serde_json::Value = serde_json::from_str(r#"[{"id":1,"name":"Hades II","cover":{"id":9,"image_id":"co7abc"}},{"id":2,"name":"No cover"}]"#).unwrap();
        assert_eq!(parse_igdb(&ig), vec![("Hades II".to_string(), "co7abc".to_string())]);
    }

    #[test]
    fn steam_fallbacks_and_dedupe() {
        let u = candidate_urls("https://cdn.cloudflare.steamstatic.com/steam/apps/570/library_600x900_2x.jpg");
        assert_eq!(u.len(), 3);
        assert!(u.last().unwrap().ends_with("header.jpg"));
        let merged = merge_results(vec![
            CoverResult { source: "IGDB".into(), name: "A".into(), url: "x".into(), thumb: "x".into(), score: 50 },
            CoverResult { source: "Steam".into(), name: "A".into(), url: "x".into(), thumb: "x".into(), score: 50 },
        ]);
        assert_eq!(merged.len(), 1);
        assert_eq!(merged[0].source, "Steam");
    }

    #[test]
    fn rejects_non_images() {
        assert!(looks_like_image(b"<html>not found</html>").is_none());
        let mut jpg = vec![0xFF, 0xD8, 0xFF];
        jpg.resize(2048, 0);
        assert_eq!(looks_like_image(&jpg), Some("jpg"));
    }
}
