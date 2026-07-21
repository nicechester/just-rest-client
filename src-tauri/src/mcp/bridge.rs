use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::Emitter;
use tokio::sync::{Mutex, oneshot};
use uuid::Uuid;

/// Manages pending calls awaiting responses from the frontend
pub struct PendingCalls {
    calls: Arc<Mutex<HashMap<String, oneshot::Sender<Value>>>>,
}

impl PendingCalls {
    pub fn new() -> Self {
        PendingCalls {
            calls: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Emit event to frontend and wait for response
    pub async fn call_frontend(
        &self,
        app_handle: &tauri::AppHandle,
        kind: &str,
        args: Option<Value>,
    ) -> Result<Value, String> {
        let call_id = Uuid::new_v4().to_string();
        eprintln!("[Bridge] Creating call for kind={}, call_id={}", kind, call_id);
        let (tx, rx) = oneshot::channel();

        {
            let mut calls = self.calls.lock().await;
            calls.insert(call_id.clone(), tx);
            eprintln!("[Bridge] Inserted call into map, total pending: {}", calls.len());
        }

        let payload = serde_json::json!({
            "kind": kind,
            "callId": call_id.clone(),
            "args": args
        });

        eprintln!("[Bridge] Emitting event: {}", payload);
        if let Err(e) = app_handle.emit("mcp:call", payload) {
            eprintln!("[Bridge] Failed to emit: {}", e);
            let mut calls = self.calls.lock().await;
            calls.remove(&call_id);
            return Err(format!("Failed to emit event: {}", e));
        }

        eprintln!("[Bridge] Event emitted, waiting for response with {} second timeout", 120);
        match tokio::time::timeout(std::time::Duration::from_secs(120), rx).await {
            Ok(Ok(result)) => {
                eprintln!("[Bridge] Received result for call_id={}: {:?}", call_id, result);
                Ok(result)
            },
            Ok(Err(_)) => {
                eprintln!("[Bridge] Channel closed for call_id={}", call_id);
                Err("Channel closed".to_string())
            },
            Err(_) => {
                eprintln!("[Bridge] Timeout waiting for call_id={}", call_id);
                let mut calls = self.calls.lock().await;
                let was_there = calls.remove(&call_id);
                eprintln!("[Bridge] Call was in map: {}, remaining pending: {}", was_there.is_some(), calls.len());
                Err("Timeout".to_string())
            }
        }
    }

    /// Resolve a pending call from frontend
    pub async fn resolve_call(&self, call_id: &str, result: Value) {
        eprintln!("[Bridge] Resolving call_id={}", call_id);
        let mut calls = self.calls.lock().await;
        eprintln!("[Bridge] Pending calls: {:?}", calls.keys().collect::<Vec<_>>());
        if let Some(tx) = calls.remove(call_id) {
            eprintln!("[Bridge] Found call in map, sending result");
            let _ = tx.send(result);
        } else {
            eprintln!("[Bridge] Call not found in map!");
        }
    }
}

impl Default for PendingCalls {
    fn default() -> Self {
        Self::new()
    }
}
