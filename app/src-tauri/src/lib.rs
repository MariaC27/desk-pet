use std::{sync::Mutex, thread, time::Duration};

use tauri::{
    image::Image,
    menu::{CheckMenuItem, Menu, MenuEvent, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder, Wry,
};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
use tauri_plugin_store::StoreExt;
use tauri_plugin_window_state::{AppHandleExt, StateFlags, WindowExt};

const STORE: &str = "settings.json";

/// Logical pixel size of the pet sprite canvas (see src/pet/sprite.ts).
const PET_W: f64 = 40.0;
const PET_H: f64 = 44.0;
const DEFAULT_SCALE: f64 = 4.0;

/// How often the cursor is checked against the pet's shape.
const HIT_TEST_INTERVAL: Duration = Duration::from_millis(40);

/// Which sprite pixels catch the mouse (row-major, PET_W x PET_H).
/// Empty until the pet window sends one: then the whole window is clickable.
#[derive(Default)]
struct HitMask(Mutex<Vec<bool>>);

/// Tray menu items whose label/checked state changes at runtime.
struct TrayItems {
    toggle_pet: MenuItem<Wry>,
    autostart: CheckMenuItem<Wry>,
}

fn pet_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    app.get_webview_window("pet")
        .ok_or_else(|| "pet window missing".into())
}

fn store_bool(app: &AppHandle, key: &str, default: bool) -> bool {
    app.store(STORE)
        .ok()
        .and_then(|s| s.get(key))
        .and_then(|v| v.as_bool())
        .unwrap_or(default)
}

fn store_set(app: &AppHandle, key: &str, value: serde_json::Value) {
    if let Ok(store) = app.store(STORE) {
        store.set(key, value);
    }
}

/// Refresh tray labels and tell any open windows that settings changed.
fn settings_changed(app: &AppHandle) {
    if let Some(items) = app.try_state::<TrayItems>() {
        let visible = pet_window(app)
            .and_then(|w| w.is_visible().map_err(|e| e.to_string()))
            .unwrap_or(false);
        let _ = items
            .toggle_pet
            .set_text(if visible { "Hide Pet" } else { "Show Pet" });
        let _ = items
            .autostart
            .set_checked(app.autolaunch().is_enabled().unwrap_or(false));
    }
    let _ = app.emit("settings-changed", ());
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct Settings {
    pet_visible: bool,
    always_on_top: bool,
    pet_scale: f64,
    autostart: bool,
}

#[tauri::command]
fn get_settings(app: AppHandle) -> Settings {
    Settings {
        pet_visible: pet_window(&app)
            .and_then(|w| w.is_visible().map_err(|e| e.to_string()))
            .unwrap_or(false),
        always_on_top: store_bool(&app, "alwaysOnTop", true),
        pet_scale: pet_scale(&app),
        autostart: app.autolaunch().is_enabled().unwrap_or(false),
    }
}

#[tauri::command]
fn set_pet_visible(app: AppHandle, visible: bool) -> Result<(), String> {
    let pet = pet_window(&app)?;
    if visible { pet.show() } else { pet.hide() }.map_err(|e| e.to_string())?;
    store_set(&app, "petVisible", visible.into());
    settings_changed(&app);
    Ok(())
}

#[tauri::command]
fn set_always_on_top(app: AppHandle, enabled: bool) -> Result<(), String> {
    pet_window(&app)?
        .set_always_on_top(enabled)
        .map_err(|e| e.to_string())?;
    store_set(&app, "alwaysOnTop", enabled.into());
    settings_changed(&app);
    Ok(())
}

fn pet_scale(app: &AppHandle) -> f64 {
    app.store(STORE)
        .ok()
        .and_then(|s| s.get("petScale"))
        .and_then(|v| v.as_f64())
        .unwrap_or(DEFAULT_SCALE)
}

#[tauri::command]
fn set_pet_scale(app: AppHandle, scale: f64) -> Result<(), String> {
    let scale = scale.clamp(2.0, 6.0);
    pet_window(&app)?
        .set_size(LogicalSize::new(PET_W * scale, PET_H * scale))
        .map_err(|e| e.to_string())?;
    store_set(&app, "petScale", scale.into());
    settings_changed(&app);
    Ok(())
}

#[tauri::command]
fn set_autostart(app: AppHandle, enabled: bool) -> Result<(), String> {
    let launcher = app.autolaunch();
    if enabled { launcher.enable() } else { launcher.disable() }.map_err(|e| e.to_string())?;
    settings_changed(&app);
    Ok(())
}

#[tauri::command]
fn open_tracker(app: AppHandle, tab: String) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("tracker") {
        let _ = win.emit("tracker:tab", &tab);
        win.show().map_err(|e| e.to_string())?;
        return win.set_focus().map_err(|e| e.to_string());
    }
    let tab_json = serde_json::to_string(&tab).map_err(|e| e.to_string())?;
    let win = WebviewWindowBuilder::new(&app, "tracker", WebviewUrl::App("index.html".into()))
        .title(if cfg!(debug_assertions) { "Desk Pet (Dev)" } else { "Desk Pet" })
        .inner_size(480.0, 600.0)
        .min_inner_size(400.0, 460.0)
        .initialization_script(format!("window.__INITIAL_TAB__ = {tab_json};"))
        .build()
        .map_err(|e| e.to_string())?;
    win.set_focus().map_err(|e| e.to_string())
}

/// Right-click menu on the pet itself.
#[tauri::command]
fn show_pet_menu(app: AppHandle) -> Result<(), String> {
    let pet = pet_window(&app)?;
    let menu = Menu::with_items(
        &app,
        &[
            &MenuItem::with_id(&app, "open_tracker", "Open Tracker", true, None::<&str>)
                .map_err(|e| e.to_string())?,
            &MenuItem::with_id(&app, "hide_pet", "Hide Pet", true, None::<&str>)
                .map_err(|e| e.to_string())?,
        ],
    )
    .map_err(|e| e.to_string())?;
    pet.popup_menu(&menu).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_hit_mask(mask: String, hit: tauri::State<HitMask>) {
    if let Ok(mut bits) = hit.0.lock() {
        *bits = mask.bytes().map(|b| b == b'1').collect();
    }
}

/// Is the cursor over a visible part of the pet? None if it can't be determined.
fn cursor_over_pet(app: &AppHandle, pet: &WebviewWindow) -> Option<bool> {
    let cursor = app.cursor_position().ok()?;
    let pos = pet.outer_position().ok()?;
    let size = pet.outer_size().ok()?;
    let fx = (cursor.x - pos.x as f64) / size.width as f64;
    let fy = (cursor.y - pos.y as f64) / size.height as f64;
    if !(0.0..1.0).contains(&fx) || !(0.0..1.0).contains(&fy) {
        return Some(false);
    }
    let mask = app.state::<HitMask>();
    let bits = mask.0.lock().ok()?;
    if bits.is_empty() {
        return Some(true);
    }
    let (x, y) = ((fx * PET_W) as usize, (fy * PET_H) as usize);
    Some(bits.get(y * PET_W as usize + x).copied().unwrap_or(false))
}

/// Let clicks pass through the transparent parts of the pet window, so only
/// the plant itself is draggable/clickable. A webview that ignores the mouse
/// gets no events, so the cursor is watched from here instead.
fn spawn_click_through(app: AppHandle) {
    thread::spawn(move || {
        let mut ignoring = false;
        loop {
            thread::sleep(HIT_TEST_INTERVAL);
            let Some(pet) = app.get_webview_window("pet") else { continue };
            if !pet.is_visible().unwrap_or(false) {
                continue;
            }
            let Some(over) = cursor_over_pet(&app, &pet) else { continue };
            if over == ignoring && pet.set_ignore_cursor_events(!over).is_ok() {
                ignoring = !over;
            }
        }
    });
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    let _ = app.save_window_state(StateFlags::POSITION);
    app.exit(0);
}

fn on_menu_event(app: &AppHandle, event: MenuEvent) {
    let result = match event.id().as_ref() {
        "toggle_pet" => {
            let visible = pet_window(app)
                .and_then(|w| w.is_visible().map_err(|e| e.to_string()))
                .unwrap_or(false);
            set_pet_visible(app.clone(), !visible)
        }
        "hide_pet" => set_pet_visible(app.clone(), false),
        "open_tracker" => open_tracker(app.clone(), "activity".into()),
        "settings" => open_tracker(app.clone(), "settings".into()),
        "dev_panel" => open_tracker(app.clone(), "dev".into()),
        "sync_now" => app.emit("sync-now", ()).map_err(|e| e.to_string()),
        "autostart" => {
            let enabled = app.autolaunch().is_enabled().unwrap_or(false);
            set_autostart(app.clone(), !enabled)
        }
        "quit" => {
            quit_app(app.clone());
            Ok(())
        }
        _ => Ok(()),
    };
    if let Err(err) = result {
        eprintln!("menu action failed: {err}");
    }
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let toggle_pet = MenuItem::with_id(app, "toggle_pet", "Hide Pet", true, None::<&str>)?;
    let autostart = CheckMenuItem::with_id(
        app,
        "autostart",
        "Open at Login",
        true,
        app.autolaunch().is_enabled().unwrap_or(false),
        None::<&str>,
    )?;
    let open_tracker = MenuItem::with_id(app, "open_tracker", "Open Tracker", true, None::<&str>)?;
    let sync_now = MenuItem::with_id(app, "sync_now", "Sync Now", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "Settings…", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Desk Pet", true, Some("CmdOrCtrl+Q"))?;
    let sep = || PredefinedMenuItem::separator(app);

    let menu = Menu::with_items(
        app,
        &[&toggle_pet, &open_tracker, &sync_now, &sep()?, &settings, &autostart],
    )?;
    if cfg!(debug_assertions) {
        menu.append(&MenuItem::with_id(app, "dev_panel", "Dev Panel", true, None::<&str>)?)?;
    }
    menu.append_items(&[&sep()?, &quit])?;

    TrayIconBuilder::with_id("main")
        .icon(Image::from_bytes(include_bytes!("../icons/tray.png"))?)
        .icon_as_template(true)
        .tooltip("Desk Pet")
        .menu(&menu)
        .build(app)?;

    app.manage(TrayItems { toggle_pet, autostart });
    Ok(())
}

/// Put the pet in the bottom-right corner of the main screen on first launch.
fn place_pet_first_time(app: &AppHandle, pet: &WebviewWindow) -> tauri::Result<()> {
    if store_bool(app, "petPlaced", false) {
        return Ok(());
    }
    if let Some(monitor) = pet.primary_monitor()? {
        let scale = monitor.scale_factor();
        let area = monitor.work_area();
        let size = pet.outer_size()?.to_logical::<f64>(scale);
        let pos = area.position.to_logical::<f64>(scale);
        let dims = area.size.to_logical::<f64>(scale);
        pet.set_position(LogicalPosition::new(
            pos.x + dims.width - size.width - 40.0,
            pos.y + dims.height - size.height - 24.0,
        ))?;
    }
    store_set(app, "petPlaced", true.into());
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let _ = open_tracker(app.clone(), "activity".into());
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::POSITION)
                .build(),
        )
        .manage(HitMask::default())
        .on_menu_event(on_menu_event)
        .invoke_handler(tauri::generate_handler![
            get_settings,
            set_pet_visible,
            set_always_on_top,
            set_pet_scale,
            set_autostart,
            open_tracker,
            show_pet_menu,
            set_hit_mask,
            quit_app,
        ])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let handle = app.handle();

            // Open at login defaults to on for the installed app. Dev builds never
            // register themselves, so a `tauri dev` binary can't end up in Login Items.
            if !store_bool(handle, "autostartInitialized", false) {
                if !cfg!(debug_assertions) {
                    let _ = app.autolaunch().enable();
                }
                store_set(handle, "autostartInitialized", true.into());
            }

            let pet = pet_window(handle).map_err(|e| e.to_string())?;
            let scale = pet_scale(handle);
            pet.set_size(LogicalSize::new(PET_W * scale, PET_H * scale))?;
            pet.set_always_on_top(store_bool(handle, "alwaysOnTop", true))?;
            place_pet_first_time(handle, &pet)?;
            let _ = pet.restore_state(StateFlags::POSITION);
            if store_bool(handle, "petVisible", true) {
                pet.show()?;
            }

            build_tray(handle)?;
            spawn_click_through(handle.clone());
            settings_changed(handle);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
