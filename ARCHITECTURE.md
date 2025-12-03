# Architecture Documentation

This document explains the technical architecture of Just REST Client, including how the frontend, backend, and build system work together.

## Table of Contents

- [Overview](#overview)
- [Technology Stack](#technology-stack)
- [Architecture Diagrams](#architecture-diagrams)
- [Module Structure](#module-structure)
- [Data Flow](#data-flow)
- [Development vs Production](#development-vs-production)
- [HTTP Request Flow](#http-request-flow)
- [Storage Architecture](#storage-architecture)

---

## Overview

Just REST Client is a hybrid desktop application built with:
- **Frontend**: Vanilla JavaScript (ES Modules), HTML, CSS with Tailwind
- **Bundler**: Vite (for ES module resolution and hot reload)
- **Backend**: Tauri (Rust-based native desktop framework)
- **WebView**: System WebView (Safari/WebKit on macOS)

The app combines web technologies for the UI with native Rust for backend functionality, resulting in a lightweight, fast, and CORS-free API client.

---

## Technology Stack

### Frontend
- **Language**: Vanilla JavaScript (ES6+ modules)
- **Styling**: Tailwind CSS (CDN in dev, can be optimized for production)
- **Code Editors**: CodeMirror 5 (JavaScript syntax highlighting)
- **Syntax Highlighting**: Prism.js (for JSON/response display)
- **Module System**: ES Modules (ESM)

### Build System
- **Bundler**: Vite 7.x
- **Dev Server**: Vite dev server (port 9001)
- **Module Resolution**: Vite handles `node_modules` imports

### Backend
- **Framework**: Tauri v2
- **Language**: Rust
- **Plugins**:
  - `tauri-plugin-http` - Native HTTP client (bypasses CORS)
  - `tauri-plugin-shell` - Shell command execution
- **WebView**: System-provided (no Chromium bundled)

### Storage
- **Client-side**: localStorage (JSON serialization)
- **Keys**: `restClient.variables`, `restClient.requests`, `restClient.scripts`

---

## Architecture Diagrams

### Development Mode Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  HOST MACHINE                                               │
│                                                             │
│  ┌─────────────────────────────────────────────┐           │
│  │  Vite Dev Server (Node.js Process)          │           │
│  │  - Port: 9001                                │           │
│  │  - Bundles ES modules on-the-fly            │           │
│  │  - Hot Module Replacement (HMR)             │           │
│  │  - Resolves node_modules imports            │           │
│  │  - Source maps for debugging                │           │
│  └──────────────┬──────────────────────────────┘           │
│                 │ HTTP                                      │
│                 │ http://localhost:9001                     │
│                 ↓                                           │
│  ┌─────────────────────────────────────────────┐           │
│  │  Tauri Desktop Application                  │           │
│  │                                              │           │
│  │  ┌────────────────────────────────────────┐ │           │
│  │  │  WebView (System Browser Engine)       │ │           │
│  │  │                                         │ │           │
│  │  │  Loads: http://localhost:9001          │ │           │
│  │  │  - index.html                           │ │           │
│  │  │  - js/app.js (ESM entry point)         │ │           │
│  │  │  - js/*.js (modules)                   │ │           │
│  │  │  - @tauri-apps/plugin-http (from npm)  │ │           │
│  │  │                                         │ │           │
│  │  │  JavaScript Context:                    │ │           │
│  │  │  - window.app (app state/methods)      │ │           │
│  │  │  - window.__TAURI__ (Tauri bridge)     │ │           │
│  │  │  - localStorage (persistence)          │ │           │
│  │  └────────────────────────────────────────┘ │           │
│  │                 ↕ IPC (Inter-Process Comm) │           │
│  │  ┌────────────────────────────────────────┐ │           │
│  │  │  Rust Backend (Native)                 │ │           │
│  │  │                                         │ │           │
│  │  │  - tauri_plugin_http::fetch()          │ │           │
│  │  │    (uses reqwest - native HTTP client) │ │           │
│  │  │  - No CORS restrictions!               │ │           │
│  │  │  - File system access                  │ │           │
│  │  │  - OS integration                       │ │           │
│  │  └────────────────────────────────────────┘ │           │
│  └─────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

### Production Build Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Just REST Client.app (Single Binary)                      │
│                                                             │
│  ┌─────────────────────────────────────────────┐           │
│  │  WebView (System Browser Engine)            │           │
│  │                                              │           │
│  │  Loads: file:///path/to/bundled/files       │           │
│  │                                              │           │
│  │  ┌────────────────────────────────────────┐ │           │
│  │  │  Bundled Web Assets (in app bundle)    │ │           │
│  │  │                                         │ │           │
│  │  │  dist/                                  │ │           │
│  │  │  ├── index.html                         │ │           │
│  │  │  ├── assets/                            │ │           │
│  │  │  │   ├── index-[hash].js (bundled!)    │ │           │
│  │  │  │   │   - All JS modules combined     │ │           │
│  │  │  │   │   - @tauri-apps/plugin-http     │ │           │
│  │  │  │   │   - app.js + all modules        │ │           │
│  │  │  │   └── index-[hash].css              │ │           │
│  │  │  ├── icons/                             │ │           │
│  │  │  └── css/                               │ │           │
│  │  │                                         │ │           │
│  │  │  NO Node.js - just static files!       │ │           │
│  │  └────────────────────────────────────────┘ │           │
│  │                 ↕ IPC                       │           │
│  │  ┌────────────────────────────────────────┐ │           │
│  │  │  Rust Backend (Compiled Binary)        │ │           │
│  │  │                                         │ │           │
│  │  │  - Tauri runtime                        │ │           │
│  │  │  - HTTP plugin (reqwest)               │ │           │
│  │  │  - Shell plugin                         │ │           │
│  │  │  - All dependencies statically linked  │ │           │
│  │  └────────────────────────────────────────┘ │           │
│  └─────────────────────────────────────────────┘           │
│                                                             │
│  App Size: ~5-10 MB (vs Electron ~100+ MB)                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Module Structure

### Frontend Module Organization

```
web/
├── index.html              # Main HTML entry point
├── css/
│   └── main.css           # Custom styles (supplementing Tailwind)
├── js/                    # ES Modules
│   ├── app.js             # Main controller & UI orchestration
│   ├── variable.js        # Variable store management
│   ├── storage.js         # localStorage persistence layer
│   ├── request.js         # HTTP request execution & templating
│   └── scripting.js       # Pre/post-request script engine
└── icons/                 # App icons

Key Design Patterns:
- ES Modules with explicit imports/exports
- Separation of concerns (storage, logic, UI)
- Functional programming style
- No frameworks - vanilla JavaScript
```

### Module Dependencies

```
app.js (main controller)
  ├─→ storage.js (persistence)
  ├─→ variable.js (variable management)
  │     └─→ storage.js (imports saveVariableStore)
  ├─→ request.js (HTTP execution)
  │     ├─→ variable.js (for templating)
  │     ├─→ scripting.js (for pre/post scripts)
  │     └─→ @tauri-apps/plugin-http (Tauri HTTP plugin)
  └─→ scripting.js (script execution sandbox)
        └─→ variable.js (for setVar() helper)
```

### Backend Structure

```
src-tauri/
├── src/
│   └── main.rs            # Rust entry point
│       - Initializes Tauri
│       - Registers plugins
│       - Configures window
│
├── Cargo.toml             # Rust dependencies
│   - tauri = "2.x"
│   - tauri-plugin-http
│   - tauri-plugin-shell
│
├── tauri.conf.json        # Tauri configuration
│   - App metadata
│   - Build settings
│   - Window configuration
│   - Security policies
│
└── capabilities/
    └── default.json       # Permission definitions
        - HTTP scope (allowed URLs)
        - Window permissions
        - Core permissions
```

---

## Data Flow

### 1. Application Initialization Flow

```
User launches app
    ↓
Tauri loads WebView
    ↓
WebView loads index.html
    ↓
index.html loads js/app.js (ES module)
    ↓
app.js imports dependencies:
    - storage.js
    - variable.js
    - request.js
    - scripting.js
    ↓
Variable module loads from localStorage:
    loadInitialVariables() → loadVariableStore()
    ↓
app.init() executes:
    ├─→ renderVariableStore()     (displays variables)
    ├─→ renderCollections()        (displays saved requests/scripts)
    ├─→ renderHeaders()            (initializes header inputs)
    ├─→ Initialize CodeMirror      (script editors)
    └─→ Attach event listeners     (buttons, tabs, etc.)
    ↓
App ready for user interaction
```

### 2. Request Execution Flow

```
User clicks "Send" button
    ↓
app.handleSend()
    ├─→ Reads form values (URL, method, headers, body)
    ├─→ Gets pre/post script IDs
    └─→ Calls executeRequest()
         ↓
    [request.js]
    1. Execute Pre-Request Script (if any)
       executePreScript(preScriptId)
         ├─→ Load script code from storage
         ├─→ Create sandbox: new Function('setVar', 'log', scriptCode)
         ├─→ Execute script
         └─→ setVar() calls update variableStore
    
    2. Apply Variable Templating
       applyTemplate(url, headers, body)
         ├─→ Find {{variableName}} patterns
         └─→ Replace with values from variableStore
    
    3. Execute HTTP Request
       ┌─ if (Tauri app) ────────────────────────┐
       │  import { fetch } from '@tauri-apps/plugin-http'
       │  fetch(url, options)  ← Native Rust HTTP client
       │  - No CORS restrictions
       │  - Uses reqwest library
       │  - Full TLS/SSL support
       └─────────────────────────────────────────┘
       ┌─ else (browser) ─────────────────────────┐
       │  window.fetch(url, options)  ← Browser fetch
       │  - CORS restrictions apply
       │  - Limited by browser security
       └─────────────────────────────────────────┘
    
    4. Parse Response
       ├─→ Check Content-Type header
       ├─→ If JSON: response.json()
       └─→ Else: response.text()
    
    5. Execute Post-Request Script (if any)
       executePostScript(postScriptId, response, responseData)
         ├─→ Load script code
         ├─→ Create sandbox: new Function('response', 'responseData', 'setVar', 'log', code)
         ├─→ Execute script (can parse response & set variables)
         └─→ Collect logs
    
    6. Return Results
       ↓
app.displayResponse()
    ├─→ Display request summary (method, URL, headers)
    ├─→ Display response (status, headers, body with syntax highlighting)
    ├─→ Display script output logs
    └─→ Update variables list if scripts modified variables
```

### 3. Variable Templating Flow

```
Input: "{{baseUrl}}/users/{{userId}}"
       ↓
applyTemplate() in request.js
       ↓
Regex: /\{\{(\w+)\}\}/g
       ↓
For each match:
    ├─→ Extract variable name (e.g., "baseUrl", "userId")
    ├─→ Look up in variableStore
    └─→ Replace {{name}} with value
       ↓
Output: "https://api.example.com/users/123"
```

### 4. Storage Persistence Flow

```
Variables:
  setVariable(key, value)  [variable.js]
    ↓
  variableStore[key] = value
    ↓
  saveVariableStore(variableStore)  [storage.js]
    ↓
  localStorage.setItem('restClient.variables', JSON.stringify(variableStore))

Requests:
  saveRequest(requestObject)  [storage.js]
    ↓
  Load existing: getAllRequests()
    ↓
  Find by ID or add new
    ↓
  saveCollection(STORAGE_KEYS.REQUESTS, requests)
    ↓
  localStorage.setItem('restClient.requests', JSON.stringify(requests))

Scripts:
  saveScript(scriptObject)  [storage.js]
    ↓
  (Same pattern as requests)
    ↓
  localStorage.setItem('restClient.scripts', JSON.stringify(scripts))
```

---

## Development vs Production

### Development Mode (`npm run dev` + `npm run tauri:dev`)

**Characteristics:**
- Vite dev server runs as separate Node.js process
- Fast hot module replacement (HMR)
- Source maps for debugging
- ES modules loaded on-demand
- Tauri connects to `http://localhost:9001`

**Workflow:**
```bash
Terminal 1: npm run dev
  → Vite starts on port 9001
  → Watches for file changes
  → Rebuilds modules on change

Terminal 2: npm run tauri:dev
  → Cargo compiles Rust (debug mode)
  → Launches Tauri window
  → Loads from localhost:9001
  → Hot reload when frontend changes
```

**Pros:**
- Instant feedback (< 1 second)
- Easy debugging with browser DevTools
- Source maps show original code

**Cons:**
- Requires two processes running
- Slightly slower initial startup

### Production Build (`npm run tauri:build`)

**Build Process:**
```
1. Vite Build Phase
   npm run build
     ↓
   Vite bundles all JS modules
     ├─→ Tree-shaking (remove unused code)
     ├─→ Minification
     ├─→ Asset optimization
     └─→ Output to dist/
   
2. Tauri Build Phase
   cargo tauri build
     ↓
   ├─→ Copy dist/ into app bundle
   ├─→ Compile Rust (release mode)
   │     - Full optimizations
   │     - Strip debug symbols
   │     - Link plugins statically
   ├─→ Create app bundle (.app on macOS)
   ├─→ Create installer (.dmg on macOS)
   └─→ Code signing (if configured)
```

**Output:**
```
src-tauri/target/release/bundle/
├── macos/
│   └── Just REST Client.app/
│       ├── Contents/
│       │   ├── MacOS/
│       │   │   └── just-rest-client  (5-10 MB binary)
│       │   ├── Resources/
│       │   │   ├── dist/  (bundled web files)
│       │   │   └── icons/
│       │   └── Info.plist
└── dmg/
    └── Just REST Client_*.dmg  (installer)
```

**Characteristics:**
- Self-contained (no dependencies)
- No Node.js runtime needed
- Pre-bundled JavaScript
- Optimized for size and speed
- Can be distributed to users

---

## HTTP Request Flow

### Tauri HTTP Plugin Integration

**Why the plugin is needed:**

Standard browser `fetch()` has CORS (Cross-Origin Resource Sharing) restrictions:
```javascript
// Browser fetch - CORS enforced
fetch('https://api.example.com/data')
  ❌ Blocked if server doesn't send CORS headers
  ❌ Preflight OPTIONS requests required
  ❌ Can't modify certain headers
```

Tauri's native HTTP plugin bypasses these:
```javascript
// Tauri fetch - No CORS!
import { fetch } from '@tauri-apps/plugin-http';
fetch('https://api.example.com/data')
  ✅ Works like curl - no CORS checks
  ✅ No preflight requests
  ✅ All headers allowed
  ✅ Better TLS/certificate handling
```

### Request Flow with Tauri HTTP Plugin

```
JavaScript Layer:
  import { fetch } from '@tauri-apps/plugin-http';
  const response = await fetch(url, options);
      ↓
  IPC (Inter-Process Communication)
      ↓
Rust Layer:
  tauri_plugin_http::fetch()
      ↓
  reqwest library (native HTTP client)
      ↓
  OS network stack
      ↓
  Internet → API Server
      ↓
  Response flows back up the chain
      ↓
JavaScript receives Response object
```

### Permission Model

Tauri uses a capability-based permission system:

**File:** `src-tauri/capabilities/default.json`
```json
{
  "identifier": "http:default",
  "allow": [
    { "url": "https://**" },      // All HTTPS
    { "url": "http://**" },       // All HTTP
    { "url": "http://localhost:*" },  // Localhost any port
    { "url": "http://127.0.0.1:*" }   // 127.0.0.1 any port
  ]
}
```

**How it works:**
1. JavaScript calls `fetch(url)`
2. Tauri intercepts the call
3. Checks if URL matches allowed patterns
4. If allowed → executes via Rust HTTP client
5. If denied → throws error

---

## Storage Architecture

### localStorage Schema

```javascript
// Key: 'restClient.variables'
{
  "baseUrl": "https://api.example.com",
  "token": "abc123...",
  "userId": "42"
}

// Key: 'restClient.requests'
[
  {
    "id": "req-1234567890",
    "title": "Get User Profile",
    "url": "{{baseUrl}}/users/{{userId}}",
    "method": "GET",
    "rawHeaders": [
      { "key": "Authorization", "value": "Bearer {{token}}" }
    ],
    "body": "",
    "preScriptId": "script-111",
    "postScriptId": "script-222"
  },
  // ... more requests
]

// Key: 'restClient.scripts'
[
  {
    "id": "script-111",
    "name": "Set Auth Token",
    "code": "setVar('token', 'new_token_value');"
  },
  {
    "id": "script-222",
    "name": "Parse User Data",
    "code": "if (responseData.user) { setVar('userName', responseData.user.name); }"
  },
  // ... more scripts
]
```

### Storage Operations

**CRUD Operations:**
```javascript
// Create
setVariable('key', 'value')  → localStorage.setItem()
saveRequest(request)         → push to array, save
saveScript(script)           → push to array, save

// Read
getVariableStore()           → localStorage.getItem() + JSON.parse()
getAllRequests()             → localStorage.getItem() + JSON.parse()
getAllScripts()              → localStorage.getItem() + JSON.parse()

// Update
setVariable('key', 'newValue')  → overwrite, save
saveRequest(existingRequest)    → find by ID, update, save
saveScript(existingScript)      → find by ID, update, save

// Delete
deleteVariable(key)          → delete from object, save
deleteRequest(id)            → filter array, save
deleteScript(id)             → filter array, save
```

### Export/Import

Users can export all data to a JSON file:
```json
{
  "metadata": {
    "version": "1.0",
    "exportedAt": "2024-01-15T10:30:00.000Z"
  },
  "variables": { ... },
  "requests": [ ... ],
  "scripts": [ ... ]
}
```

This allows:
- Backup/restore
- Sharing collections with team members
- Version control (commit to git)

---

## Security Considerations

### Script Execution Sandbox

Pre/post-request scripts run in a sandboxed environment:

```javascript
// Sandboxing implementation (scripting.js)
const sandbox = new Function(
  'response',
  'responseData',
  'setVar',
  'log',
  scriptCode
);

// Scripts have access to:
// - response (Response object - read-only)
// - responseData (parsed JSON/text)
// - setVar(key, value) - controlled variable setter
// - log(...args) - logging function

// Scripts DO NOT have access to:
// ❌ window object
// ❌ document object
// ❌ localStorage directly
// ❌ fetch() or other network APIs
// ❌ Tauri APIs
```

**Why this matters:**
- Prevents malicious scripts from accessing sensitive data
- Limits side effects to setting variables only
- Scripts can't make unauthorized network requests

### Tauri Security

- **Process Isolation**: WebView and Rust backend run in separate processes
- **IPC Validation**: All messages between JS and Rust are validated
- **Capability System**: Explicit permissions required for sensitive operations
- **CSP**: Content Security Policy can be configured
- **No eval() in Tauri APIs**: All commands are pre-defined in Rust

---

## Performance Characteristics

### Bundle Sizes

**Development:**
- Modules loaded on-demand
- Unminified code
- Full source maps
- ~2-3 MB total assets

**Production:**
- Bundled + minified JavaScript: ~200-500 KB
- CSS: ~50-100 KB
- Icons/images: ~100 KB
- Total web assets: < 1 MB
- Rust binary: 5-10 MB
- **Total app size: ~6-11 MB**

Compare to Electron (typical):
- Chromium + Node.js bundle: ~100 MB+
- App code: ~1-5 MB
- **Total: ~100-150 MB**

### Startup Time

- **Cold start**: ~0.5-1 second (depends on Mac)
- **Warm start**: ~0.2-0.5 second
- **Much faster than Electron** (no Chromium initialization)

### Memory Usage

- Typical idle: 50-80 MB
- With large response data: 100-150 MB
- **Electron equivalent: 200-400 MB**

---

## Future Enhancements

Potential architectural improvements:

1. **Web Worker for Scripts**
   - Move script execution to separate thread
   - Prevent UI blocking on long-running scripts

2. **IndexedDB for Large Data**
   - Replace localStorage for better performance
   - Support larger collections (> 5 MB)

3. **SQLite Plugin**
   - Native database for better queries
   - Tauri provides `tauri-plugin-sql`

4. **Streaming Responses**
   - Handle large file downloads
   - Progress tracking for uploads/downloads

5. **WebSocket Support**
   - Real-time API testing
   - GraphQL subscriptions

6. **OAuth2 Flow Handler**
   - Built-in OAuth redirect handling
   - Secure token management

---

## References

- [Tauri Documentation](https://v2.tauri.app/)
- [Vite Documentation](https://vitejs.dev/)
- [Tauri HTTP Plugin](https://v2.tauri.app/plugin/http-client/)
- [MDN: ES Modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
- [Rust reqwest library](https://docs.rs/reqwest/)

---

**Document Version:** 1.0  
**Last Updated:** December 2024  
**Author:** Chester Kim

