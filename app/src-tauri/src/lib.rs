mod secrets;
mod updates;

use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    thread,
    time::Duration,
};

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
const DEFAULT_SCALE: f64 = 3.0;
/// The size picker's range (see PET_SIZES in src/lib/settings.ts).
const MIN_SCALE: f64 = 2.0;
const MAX_SCALE: f64 = 4.0;

/// How often the cursor is checked against the pet's shape.
const HIT_TEST_INTERVAL: Duration = Duration::from_millis(40);

/// How often the pet follows the cursor while being dragged (~120 fps).
const DRAG_INTERVAL: Duration = Duration::from_millis(8);

/// True while the pet is being dragged, so clicks aren't let through mid-drag.
static DRAGGING: AtomicBool = AtomicBool::new(false);

/// Which sprite pixels catch the mouse (row-major, PET_W x PET_H).
/// Empty until the pet window sends one: then the whole window is clickable.
#[derive(Default)]
struct HitMask(Mutex<Vec<bool>>);

/// Tray menu items whose label/checked state changes at runtime.
struct TrayItems {
    menu: Menu<Wry>,
    status: MenuItem<Wry>,
    toggle_pet: MenuItem<Wry>,
    autostart: CheckMenuItem<Wry>,
    /// "Update Available…" + separator, at the top of the menu only while there is one.
    update: (MenuItem<Wry>, PredefinedMenuItem<Wry>),
    update_shown: Mutex<bool>,
}

/// Show or hide the tray's "Update Available" item.
pub(crate) fn set_update_item(app: &AppHandle, version: Option<&str>) {
    let Some(items) = app.try_state::<TrayItems>() else { return };
    let mut shown = items.update_shown.lock().unwrap();
    let (item, sep) = &items.update;
    match version {
        Some(v) => {
            let _ = item.set_text(format!("Update Available ({v})…"));
            if !*shown && items.menu.insert_items(&[item, sep], 0).is_ok() {
                *shown = true;
            }
        }
        None if *shown => {
            let _ = items.menu.remove(item);
            let _ = items.menu.remove(sep);
            *shown = false;
        }
        None => {}
    }
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
        .map_or(DEFAULT_SCALE, |s| s.clamp(MIN_SCALE, MAX_SCALE))
}

#[tauri::command]
fn set_pet_scale(app: AppHandle, scale: f64) -> Result<(), String> {
    let scale = scale.clamp(MIN_SCALE, MAX_SCALE);
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

/// Focus a window if it's open (telling it which `route` to show), or create it.
/// The route is passed to a fresh window as `window.__ROUTE__`.
fn open_window(
    app: &AppHandle,
    label: &str,
    route: &str,
    configure: impl FnOnce(
        WebviewWindowBuilder<'_, Wry, AppHandle>,
    ) -> WebviewWindowBuilder<'_, Wry, AppHandle>,
) -> Result<(), String> {
    if let Some(win) = app.get_webview_window(label) {
        let _ = win.emit_to(label, "route", route);
        win.show().map_err(|e| e.to_string())?;
        return win.set_focus().map_err(|e| e.to_string());
    }
    let route_json = serde_json::to_string(route).map_err(|e| e.to_string())?;
    let builder = WebviewWindowBuilder::new(app, label, WebviewUrl::App("index.html".into()))
        .initialization_script(format!("window.__ROUTE__ = {route_json};"));
    let win = configure(builder).build().map_err(|e| e.to_string())?;
    win.set_focus().map_err(|e| e.to_string())
}

#[tauri::command]
fn open_tracker(app: AppHandle, tab: String) -> Result<(), String> {
    open_window(&app, "tracker", &tab, |b| {
        b.title(if cfg!(debug_assertions) { "Desk Pet (Dev)" } else { "Desk Pet" })
            .inner_size(480.0, 640.0)
            .min_inner_size(450.0, 460.0)
    })
}

#[tauri::command]
fn open_onboarding(app: AppHandle, step: String) -> Result<(), String> {
    open_window(&app, "onboarding", &step, |b| {
        b.title("Welcome to Desk Pet")
            .inner_size(440.0, 580.0)
            .resizable(false)
            .center()
    })
}

fn onboarded(app: &AppHandle) -> bool {
    store_bool(app, "onboarded", false)
}

#[tauri::command]
fn finish_onboarding(app: AppHandle) -> Result<(), String> {
    store_set(&app, "onboarded", true.into());
    set_pet_visible(app.clone(), true)?;
    if let Some(win) = app.get_webview_window("onboarding") {
        let _ = win.close();
    }
    Ok(())
}

/// Forget everything (Keychain items, settings, cached activity) and start
/// setup again, exactly as a brand-new install would.
#[tauri::command]
fn reset_app(app: AppHandle) -> Result<(), String> {
    secrets::delete_all(&app)?;
    if let Ok(store) = app.store(STORE) {
        store.clear();
        store.save().map_err(|e| e.to_string())?;
    }
    let _ = app.autolaunch().disable();
    set_pet_scale(app.clone(), DEFAULT_SCALE)?;
    set_always_on_top(app.clone(), true)?;
    pet_window(&app)?.hide().map_err(|e| e.to_string())?;
    if let Some(win) = app.get_webview_window("tracker") {
        let _ = win.close();
    }
    let _ = app.emit("data-changed", ());
    settings_changed(&app);
    open_onboarding(app, "welcome".into())
}

/// The first line of the tray menu, e.g. "Synced 3 min ago".
#[tauri::command]
fn set_tray_status(app: AppHandle, text: String) {
    if let Some(items) = app.try_state::<TrayItems>() {
        let _ = items.status.set_text(text);
    }
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

/// The cursor in screen points. Tauri reports it in pixels of the *primary*
/// display, while window positions use the window's own display, so the two
/// only agree once both are converted back to points.
fn cursor_point(app: &AppHandle) -> Option<LogicalPosition<f64>> {
    let scale = app.primary_monitor().ok()??.scale_factor();
    Some(app.cursor_position().ok()?.to_logical(scale))
}

/// The pet window's top-left corner and size in screen points.
fn pet_frame(pet: &WebviewWindow) -> Option<(LogicalPosition<f64>, LogicalSize<f64>)> {
    let scale = pet.scale_factor().ok()?;
    Some((
        pet.outer_position().ok()?.to_logical(scale),
        pet.outer_size().ok()?.to_logical(scale),
    ))
}

/// Is the cursor over a visible part of the pet? None if it can't be determined.
fn cursor_over_pet(app: &AppHandle, pet: &WebviewWindow) -> Option<bool> {
    let cursor = cursor_point(app)?;
    let (pos, size) = pet_frame(pet)?;
    let fx = (cursor.x - pos.x) / size.width;
    let fy = (cursor.y - pos.y) / size.height;
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
            let over = if DRAGGING.load(Ordering::Relaxed) {
                true
            } else {
                let Some(over) = cursor_over_pet(&app, &pet) else { continue };
                over
            };
            if over == ignoring && pet.set_ignore_cursor_events(!over).is_ok() {
                ignoring = !over;
            }
        }
    });
}

fn left_mouse_down() -> bool {
    #[cfg(target_os = "macos")]
    {
        objc2_app_kit::NSEvent::pressedMouseButtons() & 1 == 1
    }
    #[cfg(not(target_os = "macos"))]
    false
}

/// Moves the pet with the cursor until the mouse button is released.
/// The window's native drag (`startDragging`) silently does nothing when Desk
/// Pet isn't the active app, which is most of the time, so it's done here.
#[tauri::command]
fn drag_pet(app: AppHandle) -> Result<(), String> {
    if DRAGGING.swap(true, Ordering::Relaxed) {
        return Ok(());
    }
    let pet = pet_window(&app)?;
    let start = (|| Some((cursor_point(&app)?, pet_frame(&pet)?.0)))();
    let Some((cursor0, window0)) = start else {
        DRAGGING.store(false, Ordering::Relaxed);
        return Err("can't read the cursor position".into());
    };
    thread::spawn(move || {
        while left_mouse_down() {
            if let Some(cursor) = cursor_point(&app) {
                let _ = pet.set_position(LogicalPosition::new(
                    window0.x + cursor.x - cursor0.x,
                    window0.y + cursor.y - cursor0.y,
                ));
            }
            thread::sleep(DRAG_INTERVAL);
        }
        DRAGGING.store(false, Ordering::Relaxed);
        let _ = app.save_window_state(StateFlags::POSITION);
    });
    Ok(())
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
        "open_tracker" | "status" => open_tracker(app.clone(), "activity".into()),
        "settings" | "update" => open_tracker(app.clone(), "settings".into()),
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
    let status = MenuItem::with_id(app, "status", "Not synced yet", true, None::<&str>)?;
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
        &[
            &status,
            &sep()?,
            &toggle_pet,
            &open_tracker,
            &sync_now,
            &sep()?,
            &settings,
            &autostart,
        ],
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

    let update = (
        MenuItem::with_id(app, "update", "Update Available…", true, None::<&str>)?,
        PredefinedMenuItem::separator(app)?,
    );
    app.manage(TrayItems {
        menu,
        status,
        toggle_pet,
        autostart,
        update,
        update_shown: Mutex::new(false),
    });
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
            let _ = if onboarded(app) {
                open_tracker(app.clone(), "activity".into())
            } else {
                open_onboarding(app.clone(), "welcome".into())
            };
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::POSITION)
                .build(),
        )
        .manage(HitMask::default())
        .manage(updates::PendingUpdate::default())
        .on_menu_event(on_menu_event)
        .invoke_handler(tauri::generate_handler![
            get_settings,
            set_pet_visible,
            set_always_on_top,
            set_pet_scale,
            set_autostart,
            open_tracker,
            open_onboarding,
            finish_onboarding,
            reset_app,
            set_tray_status,
            show_pet_menu,
            set_hit_mask,
            drag_pet,
            quit_app,
            secrets::secret_get,
            secrets::secret_set,
            secrets::secret_delete,
            updates::check_update,
            updates::install_update,
        ])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let handle = app.handle();

            let pet = pet_window(handle).map_err(|e| e.to_string())?;
            let scale = pet_scale(handle);
            pet.set_size(LogicalSize::new(PET_W * scale, PET_H * scale))?;
            pet.set_always_on_top(store_bool(handle, "alwaysOnTop", true))?;
            place_pet_first_time(handle, &pet)?;
            let _ = pet.restore_state(StateFlags::POSITION);

            build_tray(handle)?;
            // First run (or after Reset): setup shows the pet when it's done.
            if !onboarded(handle) {
                open_onboarding(handle.clone(), "welcome".into())?;
            } else if store_bool(handle, "petVisible", true) {
                pet.show()?;
            }
            spawn_click_through(handle.clone());
            settings_changed(handle);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
