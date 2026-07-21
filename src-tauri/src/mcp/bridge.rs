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
        let (tx, rx) = oneshot::channel();

        {
            let mut calls = self.calls.lock().await;
            calls.insert(call_id.clone(), tx);
        }

        let payload = serde_json::json!({
            "kind": kind,
            "callId": call_id.clone(),
            "args": args
        });

        if let Err(e) = app_handle.emit("mcp:call", payload) {
            let mut calls = self.calls.lock().await;
            calls.remove(&call_id);
            return Err(format!("Failed to emit event: {}", e));
        }

        match tokio::time::timeout(std::time::Duration::from_secs(120), rx).await {
            Ok(Ok(result)) => Ok(result),
            Ok(Err(_)) => Err("Channel closed".to_string()),
            Err(_) => {
                let mut calls = self.calls.lock().await;
                calls.remove(&call_id);
                Err("Timeout".to_string())
            }
        }
    }

    /// Resolve a pending call from frontend
    pub async fn resolve_call(&self, call_id: &str, result: Value) {
        let mut calls = self.calls.lock().await;
        if let Some(tx) = calls.remove(call_id) {
            let _ = tx.send(result);
        }
    }
}

impl Default for PendingCalls {
    fn default() -> Self {
        Self::new()
    }
}
