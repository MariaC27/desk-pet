//! Secrets (GitHub token, message-pairing device secret) live in the macOS
//! Keychain, never in the settings file. Items are namespaced by the bundle
//! identifier, so the dev build and the installed app don't share them.
//!
//! Reads are cached for the life of the process, so macOS asks for Keychain
//! access at most once per launch rather than on every sync.

use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};
use tauri::AppHandle;

/// The only keys the webview may read or write.
const KEYS: &[&str] = &["github_token", "device_secret"];

/// Known values (None = known to be absent), shared by all windows.
static CACHE: LazyLock<Mutex<HashMap<String, Option<String>>>> = LazyLock::new(Default::default);

fn remember(key: &str, value: Option<String>) {
    CACHE.lock().unwrap().insert(key.to_string(), value);
}

fn entry(app: &AppHandle, key: &str) -> Result<keyring::Entry, String> {
    if !KEYS.contains(&key) {
        return Err(format!("unknown secret: {key}"));
    }
    keyring::Entry::new(&app.config().identifier, key).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn secret_get(app: AppHandle, key: String) -> Result<Option<String>, String> {
    let entry = entry(&app, &key)?;
    if let Some(value) = CACHE.lock().unwrap().get(&key) {
        return Ok(value.clone());
    }
    // A failure here (e.g. the person clicked Deny) is not cached, so it's retried.
    let value = match entry.get_password() {
        Ok(value) => Some(value),
        Err(keyring::Error::NoEntry) => None,
        Err(e) => return Err(e.to_string()),
    };
    remember(&key, value.clone());
    Ok(value)
}

#[tauri::command]
pub fn secret_set(app: AppHandle, key: String, value: String) -> Result<(), String> {
    entry(&app, &key)?
        .set_password(&value)
        .map_err(|e| e.to_string())?;
    remember(&key, Some(value));
    Ok(())
}

#[tauri::command]
pub fn secret_delete(app: AppHandle, key: String) -> Result<(), String> {
    match entry(&app, &key)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => {
            remember(&key, None);
            Ok(())
        }
        Err(e) => Err(e.to_string()),
    }
}

pub fn delete_all(app: &AppHandle) -> Result<(), String> {
    KEYS.iter()
        .try_for_each(|key| secret_delete(app.clone(), key.to_string()))
}
