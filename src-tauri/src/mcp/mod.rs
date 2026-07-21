pub mod bridge;
pub mod commands;

use axum::{extract::Json, http::StatusCode, routing::{get, post}, Router};
use serde_json::{json, Value};
use std::sync::Arc;
use tauri::AppHandle;
use tokio::sync::RwLock;
use tokio::task::JoinHandle;
use self::bridge::PendingCalls;

#[derive(Clone)]
pub struct McpServerState {
    server_handle: Arc<RwLock<Option<JoinHandle<()>>>>,
    pending_calls: Arc<PendingCalls>,
}

impl McpServerState {
    pub fn new() -> Self {
        McpServerState {
            server_handle: Arc::new(RwLock::new(None)),
            pending_calls: Arc::new(PendingCalls::new()),
        }
    }

    pub fn pending_calls(&self) -> Arc<PendingCalls> {
        Arc::clone(&self.pending_calls)
    }

    pub async fn start_server(
        &self,
        port: u16,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        let handle = self.server_handle.read().await;
        if handle.is_some() {
            return Err("Server already running".to_string());
        }
        drop(handle);

        let server_state = self.clone();
        let handle = tokio::spawn(async move {
            if let Err(e) = run_mcp_server(port, app_handle, server_state).await {
                eprintln!("MCP server error: {}", e);
            }
        });

        let mut server_handle_write = self.server_handle.write().await;
        *server_handle_write = Some(handle);
        Ok(())
    }

    pub async fn stop_server(&self) {
        let mut handle = self.server_handle.write().await;
        if let Some(h) = handle.take() {
            h.abort();
        }
    }
}

impl Default for McpServerState {
    fn default() -> Self {
        Self::new()
    }
}

async fn run_mcp_server(
    port: u16,
    app_handle: AppHandle,
    state: McpServerState,
) -> Result<(), Box<dyn std::error::Error>> {
    let router = Router::new()
        .route("/mcp", get(|| async { (StatusCode::OK, "MCP Server ready") }))
        .route("/mcp", post({
            let app_handle = app_handle.clone();
            let pending_calls = state.pending_calls.clone();
            move |Json(payload): Json<Value>| {
                let app_handle = app_handle.clone();
                let pending_calls = pending_calls.clone();
                async move {
                    handle_mcp_request(payload, &app_handle, &pending_calls).await
                }
            }
        }))
        .fallback(|| async { (StatusCode::OK, "MCP Server running") });

    let addr = std::net::SocketAddr::from(([127, 0, 0, 1], port));
    println!("[MCP] Starting HTTP server on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, router).await?;
    Ok(())
}

async fn handle_mcp_request(
    payload: Value,
    app_handle: &AppHandle,
    pending_calls: &Arc<PendingCalls>,
) -> (StatusCode, Json<Value>) {
    let jsonrpc = payload.get("jsonrpc").and_then(|v| v.as_str()).unwrap_or("2.0");
    let method = payload.get("method").and_then(|v| v.as_str());
    let id = payload.get("id").cloned();
    let params = payload.get("params").cloned();

    if method.is_none() {
        let err_response = json!({
            "jsonrpc": jsonrpc,
            "id": id,
            "error": {"code": -32600, "message": "Invalid Request"}
        });
        return (StatusCode::BAD_REQUEST, Json(err_response));
    }

    let method_str = method.unwrap();

    let result = match method_str {
        "initialize" => {
            Ok(json!({
                "protocolVersion": "2024-11-05",
                "capabilities": { "tools": {} },
                "serverInfo": {
                    "name": "just-rest-client",
                    "version": "1.0.0"
                }
            }))
        }
        "tools/list" => {
            Ok(json!({
                "tools": [
                    {
                        "name": "list_requests",
                        "description": "List all saved requests",
                        "inputSchema": { "type": "object", "properties": {} }
                    },
                    {
                        "name": "get_request",
                        "description": "Get a specific request",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "group": { "type": "string" },
                                "name": { "type": "string" }
                            },
                            "required": ["group", "name"]
                        }
                    },
                    {
                        "name": "execute_request",
                        "description": "Execute a saved request",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "group": { "type": "string" },
                                "name": { "type": "string" },
                                "environment": { "type": "string" }
                            },
                            "required": ["group", "name"]
                        }
                    }
                ]
            }))
        }
        "tools/call" => {
            if let Some(params_obj) = params {
                let tool_name = params_obj.get("name").and_then(|n| n.as_str()).map(|s| s.to_string());
                let args = params_obj.get("arguments").cloned();
                
                if tool_name.is_none() {
                    return (
                        StatusCode::BAD_REQUEST,
                        Json(json!({
                            "jsonrpc": jsonrpc,
                            "id": id,
                            "error": { "code": -32602, "message": "Missing tool name" }
                        })),
                    );
                }

                let call_result = match tool_name.unwrap().as_str() {
                    "list_requests" => {
                        pending_calls.call_frontend(app_handle, "list_requests", None).await
                    }
                    "get_request" => {
                        pending_calls.call_frontend(app_handle, "get_request", args).await
                    }
                    "execute_request" => {
                        pending_calls.call_frontend(app_handle, "execute_request", args).await
                    }
                    tool => Err(format!("Unknown tool: {}", tool)),
                };

                match call_result {
                    Ok(value) => {
                        Ok(json!({
                            "content": [
                                {
                                    "type": "text",
                                    "text": value.to_string()
                                }
                            ]
                        }))
                    },
                    Err(e) => Err(e),
                }
            } else {
                Err("Missing params for tools/call".to_string())
            }
        }
        _ => Err(format!("Unknown method: {}", method_str)),
    };

    let response = match result {
        Ok(value) => json!({
            "jsonrpc": jsonrpc,
            "id": id,
            "result": value
        }),
        Err(e) => json!({
            "jsonrpc": jsonrpc,
            "id": id,
            "error": {
                "code": -32603,
                "message": format!("Internal error: {}", e)
            }
        }),
    };

    (StatusCode::OK, Json(response))
}
