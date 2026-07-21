use crate::mcp::bridge::PendingCalls;
use crate::mcp::McpServerState;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;
use tauri::{AppHandle, Manager, State};
use tokio::sync::RwLock;

#[derive(Serialize, Deserialize, Clone)]
pub struct McpStatus {
    pub enabled: bool,
    pub port: u16,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub struct McpSettingsStore {
    port: Arc<RwLock<u16>>,
}

impl McpSettingsStore {
    pub fn new() -> Self {
        McpSettingsStore {
            port: Arc::new(RwLock::new(3001)),
        }
    }

    pub async fn set_port(&self, port: u16) {
        let mut p = self.port.write().await;
        *p = port;
    }

    pub async fn get_port(&self) -> u16 {
        *self.port.read().await
    }
}

impl Default for McpSettingsStore {
    fn default() -> Self {
        Self::new()
    }
}

#[tauri::command]
pub async fn set_mcp_enabled(
    enabled: bool,
    port: u16,
    app_handle: AppHandle,
    state: State<'_, McpServerState>,
) -> Result<McpStatus, String> {
    if let Some(settings) = app_handle.try_state::<McpSettingsStore>() {
        settings.set_port(port).await;
    }

    if enabled {
        state.start_server(port, app_handle).await?;
        Ok(McpStatus {
            enabled: true,
            port,
            error: None,
        })
    } else {
        state.stop_server().await;
        Ok(McpStatus {
            enabled: false,
            port,
            error: None,
        })
    }
}

#[tauri::command]
pub async fn get_mcp_status(
    app_handle: AppHandle,
    state: State<'_, McpServerState>,
) -> Result<McpStatus, String> {
    let handle = state.server_handle.read().await;
    let enabled = handle.is_some();
    drop(handle);

    let port = if let Some(settings) = app_handle.try_state::<McpSettingsStore>() {
        settings.get_port().await
    } else {
        3001
    };

    Ok(McpStatus {
        enabled,
        port,
        error: None,
    })
}

/// Helper function to fetch all requests from frontend (for potential future use)
#[allow(dead_code)]
pub async fn fetch_all_requests(
    app_handle: &AppHandle,
    pending_calls: &PendingCalls,
) -> Result<Value, String> {
    pending_calls.call_frontend(app_handle, "get_all_requests_data", None).await
}

/// Helper function to fetch all variables from frontend (for potential future use)
#[allow(dead_code)]
pub async fn fetch_variables_data(
    app_handle: &AppHandle,
    pending_calls: &PendingCalls,
) -> Result<Value, String> {
    pending_calls.call_frontend(app_handle, "get_variables_data", None).await
}

/// Helper function to fetch all scripts from frontend (for potential future use)
#[allow(dead_code)]
pub async fn fetch_scripts_data(
    app_handle: &AppHandle,
    pending_calls: &PendingCalls,
) -> Result<Value, String> {
    pending_calls.call_frontend(app_handle, "get_scripts_data", None).await
}

/// Resolve a pending MCP call from frontend
#[tauri::command]
pub async fn mcp_bridge_result(
    call_id: String,
    result: Option<Value>,
    error: Option<String>,
    state: State<'_, McpServerState>,
) -> Result<(), String> {
    let pending_calls = state.pending_calls();

    if let Some(error_msg) = error {
        let error_value = serde_json::json!({
            "error": error_msg
        });
        pending_calls.resolve_call(&call_id, error_value).await;
    } else if let Some(result_value) = result {
        pending_calls.resolve_call(&call_id, result_value).await;
    } else {
        return Err("Either result or error must be provided".to_string());
    }

    Ok(())
}
