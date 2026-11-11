//! App updates from the repo's GitHub Releases. Nothing happens on its own:
//! the app only checks, and downloads + restarts when the person clicks
//! "Install & Restart". Updates are verified against the public key in
//! tauri.conf.json (plugins.updater.pubkey).

use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Url};
use tauri_plugin_updater::{Update, Updater, UpdaterExt};
use tauri_plugin_window_state::{AppHandleExt, StateFlags};

/// The update found by the last check, ready to install.
#[derive(Default)]
pub struct PendingUpdate(Mutex<Option<Update>>);

#[derive(Serialize, Clone)]
pub struct UpdateInfo {
    version: String,
    notes: Option<String>,
}

fn updater(app: &AppHandle) -> Result<Updater, String> {
    let mut builder = app.updater_builder();
    // For testing the update flow locally: build with DESK_PET_UPDATE_URL set
    // to a manifest served from this Mac (see scripts/release.sh).
    if let Some(url) = option_env!("DESK_PET_UPDATE_URL") {
        let url = Url::parse(url).map_err(|e| e.to_string())?;
        builder = builder.endpoints(vec![url]).map_err(|e| e.to_string())?;
    }
    builder.build().map_err(|e| e.to_string())
}

/// Looks for a newer release. Returns None when up to date (always, in dev builds).
#[tauri::command]
pub async fn check_update(app: AppHandle) -> Result<Option<UpdateInfo>, String> {
    if cfg!(debug_assertions) {
        return Ok(None);
    }
    let update = updater(&app)?.check().await.map_err(|e| e.to_string())?;
    let info = update.as_ref().map(|u| UpdateInfo {
        version: u.version.clone(),
        notes: u.body.clone().filter(|b| !b.trim().is_empty()),
    });
    *app.state::<PendingUpdate>().0.lock().unwrap() = update;
    crate::set_update_item(&app, info.as_ref().map(|i| i.version.as_str()));
    Ok(info)
}

/// Downloads and installs the pending update (progress via "update-progress"
/// events: [downloaded, total]), then restarts into the new version.
#[tauri::command]
pub async fn install_update(app: AppHandle) -> Result<(), String> {
    let update = app
        .state::<PendingUpdate>()
        .0
        .lock()
        .unwrap()
        .clone()
        .ok_or("no update to install")?;
    let mut downloaded: u64 = 0;
    update
        .download_and_install(
            |chunk, total| {
                downloaded += chunk as u64;
                let _ = app.emit("update-progress", (downloaded, total));
            },
            || {},
        )
        .await
        .map_err(|e| e.to_string())?;
    let _ = app.save_window_state(StateFlags::POSITION);
    app.restart();
}
