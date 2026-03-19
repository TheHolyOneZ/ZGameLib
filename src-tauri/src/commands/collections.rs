use tauri::State;
use uuid::Uuid;
use chrono::Utc;
use crate::db::{DbState, queries};
use crate::models::{Collection, Game};

#[tauri::command]
pub fn get_collections(state: State<DbState>) -> Result<Vec<Collection>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    queries::get_all_collections(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_collection(state: State<DbState>, name: String) -> Result<Collection, String> {
    if name.trim().is_empty() { return Err("Collection name cannot be empty".to_string()); }
    if name.len() > 100 { return Err("Collection name must be 100 characters or fewer".to_string()); }
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    queries::insert_collection(&conn, &id, name.trim(), &now).map_err(|e| e.to_string())?;
    Ok(Collection { id, name: name.trim().to_string(), created_at: now, game_count: 0, description: None })
}

#[tauri::command]
pub fn rename_collection(state: State<DbState>, id: String, name: String) -> Result<(), String> {
    if name.trim().is_empty() { return Err("Collection name cannot be empty".to_string()); }
    if name.len() > 100 { return Err("Collection name must be 100 characters or fewer".to_string()); }
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    queries::rename_collection(&conn, &id, name.trim()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_collection(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    queries::delete_collection(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_collection_games(state: State<DbState>, collection_id: String) -> Result<Vec<Game>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    queries::get_collection_games(&conn, &collection_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_game_to_collection(state: State<DbState>, collection_id: String, game_id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    queries::add_game_to_collection(&conn, &collection_id, &game_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_game_from_collection(state: State<DbState>, collection_id: String, game_id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    queries::remove_game_from_collection(&conn, &collection_id, &game_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_collections_for_game(state: State<DbState>, game_id: String) -> Result<Vec<Collection>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    queries::get_collections_for_game(&conn, &game_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_collection_description(state: State<DbState>, id: String, description: Option<String>) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    queries::update_collection_description(&conn, &id, description.as_deref()).map_err(|e| e.to_string())
}
