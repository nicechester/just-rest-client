// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod mcp;

use mcp::{McpServerState, commands};
use commands::McpSettingsStore;
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(McpServerState::default())
        .manage(McpSettingsStore::default())
        .invoke_handler(tauri::generate_handler![
            commands::set_mcp_enabled,
            commands::get_mcp_status,
            commands::mcp_bridge_result
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let app_handle = window.app_handle();
                let state = app_handle.state::<McpServerState>();
                let state_clone = state.inner().clone();
                std::thread::spawn(move || {
                    tokio::runtime::Runtime::new()
                        .unwrap()
                        .block_on(async {
                            state_clone.stop_server().await;
                        });
                });
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

