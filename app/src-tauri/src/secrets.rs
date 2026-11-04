//! Secrets (GitHub token, message-pairing device secret) live in the macOS
//! Keychain, never in the settings file. Items are namespaced by the bundle
//! identifier, so the dev build and the installed app don't share them.

use tauri::AppHandle;

/// The only keys the webview may read or write.
const KEYS: &[&str] = &["github_token", "device_secret"];

fn entry(app: &AppHandle, key: &str) -> Result<keyring::Entry, String> {
    if !KEYS.contains(&key) {
        return Err(format!("unknown secret: {key}"));
    }
    keyring::Entry::new(&app.config().identifier, key).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn secret_get(app: AppHandle, key: String) -> Result<Option<String>, String> {
    match entry(&app, &key)?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn secret_set(app: AppHandle, key: String, value: String) -> Result<(), String> {
    entry(&app, &key)?
        .set_password(&value)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn secret_delete(app: AppHandle, key: String) -> Result<(), String> {
    match entry(&app, &key)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

pub fn delete_all(app: &AppHandle) -> Result<(), String> {
    KEYS.iter()
        .try_for_each(|key| secret_delete(app.clone(), key.to_string()))
}
