# Tauri Desktop App Setup

This document provides detailed instructions for building and running Just REST Client as a native desktop application using Tauri.

## Prerequisites

### Required Tools

1. **Rust** (latest stable)
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. **Node.js** (v20 or later)
   ```bash
   # macOS with Homebrew
   brew install node@20
   
   # Or download from https://nodejs.org/
   ```

3. **System Dependencies** (macOS)
   ```bash
   xcode-select --install
   ```

## Setup

1. **Install Dependencies**
   ```bash
   # Install npm packages (including Vite and Tauri HTTP plugin)
   npm install
   
   # Install Rust dependencies (automatically done on first run)
   cargo tauri dev
   ```

## Development

### Running the App

**Option 1: Separate Terminals (Recommended for debugging)**
```bash
# Terminal 1: Start Vite dev server
npm run dev

# Terminal 2: Start Tauri app (waits for Vite)
npm run tauri:dev
```

**Option 2: Single Command**
```bash
npm run tauri:dev
# Note: This will wait for Vite to start automatically
```

### Hot Reload

- **Frontend changes**: Vite automatically reloads the app
- **Rust changes**: Tauri automatically rebuilds and restarts

### Development Workflow

1. Edit files in `web/` folder
2. Changes are instantly reflected in the app
3. Test CORS-restricted APIs without issues

## Building for Production

### Debug Build (Faster, for testing)
```bash
npm run tauri:build --debug
```

Output: `src-tauri/target/debug/bundle/`

### Release Build (Optimized)
```bash
npm run tauri:build
```

Output: `src-tauri/target/release/bundle/`

### Build Artifacts

**macOS:**
- `.dmg` - Disk image installer
- `.app` - Application bundle
- Located in `src-tauri/target/[debug|release]/bundle/macos/`

## Architecture

### Project Structure

```
just-rest-client/
├── web/                    # Frontend assets (served by Vite)
│   ├── index.html         # Main HTML
│   ├── js/                # JavaScript modules
│   ├── css/               # Stylesheets
│   └── icons/             # App icons
├── src-tauri/             # Tauri (Rust) backend
│   ├── src/
│   │   └── main.rs        # Rust entry point
│   ├── Cargo.toml         # Rust dependencies
│   ├── tauri.conf.json    # Tauri configuration
│   └── capabilities/      # Security permissions
├── vite.config.js         # Vite bundler config
└── package.json           # NPM dependencies
```

### Key Technologies

- **Vite**: Modern bundler for ES modules
- **Tauri v2**: Rust-based desktop framework
- **Plugins**:
  - `tauri-plugin-http` - Native HTTP client (bypasses CORS)
  - `tauri-plugin-dialog` - Native file dialogs for export/import
  - `tauri-plugin-fs` - File system access for data export
  - `tauri-plugin-shell` - Shell command execution

## Features

### No CORS Restrictions

The Tauri HTTP plugin routes all `fetch()` calls through Rust's native HTTP client (reqwest), which:
- ✅ Works like `curl` - no browser CORS checks
- ✅ Better SSL/TLS certificate handling
- ✅ Supports all HTTP methods and headers
- ✅ Handles binary data efficiently
- ✅ Available in both main requests AND scripts

### Advanced Scripting

Scripts can make HTTP requests using the same CORS-free client:
```javascript
// Pre-request script: Fetch OAuth token
const response = await http('https://auth.api.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ client_id: getVar('client_id') })
});
setVar('access_token', response.data.access_token);
```

See [SCRIPTING.md](SCRIPTING.md) for full documentation.

### Grouping & Organization

- **Variable Groups**: Organize variables by environment (dev, staging, production)
- **Request Collections**: Group API calls by feature or module
- **Script Libraries**: Organize reusable pre/post-request scripts
- **Global Scope**: Variables in 'global' group accessible everywhere

### Security

Permissions are configured in `src-tauri/capabilities/default.json`:
```json
{
  "identifier": "http:default",
  "allow": [
    { "url": "https://**" },
    { "url": "http://**" }
  ]
}
```

This allows HTTP requests to any URL. Adjust as needed for your security requirements.

## Troubleshooting

### Build Errors

**Error: "Failed to bundle project"**
```bash
# Clean and rebuild
cd src-tauri
cargo clean
cd ..
npm run tauri:build
```

**Error: "Waiting for dev server..."**
```bash
# Ensure Vite is running first
npm run dev  # In one terminal
npm run tauri:dev  # In another terminal
```

### Runtime Issues

**Problem: HTTP requests fail**
- Check `src-tauri/capabilities/default.json` has proper permissions
- Verify the plugin is initialized in `src-tauri/src/main.rs`

**Problem: Module import errors**
```bash
# Reinstall dependencies
rm -rf node_modules
npm install
```

### Debugging

**View Logs:**
```bash
# macOS
~/Library/Logs/just-rest-client/
```

**Enable Rust Logging:**
```bash
RUST_LOG=debug npm run tauri:dev
```

## Distribution

### Code Signing (macOS)

For distribution outside the App Store:
```bash
# Sign the app
codesign --sign "Developer ID Application: Your Name" \
  --deep --force --options runtime \
  src-tauri/target/release/bundle/macos/Just\ REST\ Client.app

# Create notarized DMG
xcrun notarytool submit src-tauri/target/release/bundle/dmg/*.dmg \
  --apple-id your@email.com \
  --team-id TEAMID \
  --password app-specific-password
```

See [Apple's documentation](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution) for details.

## Script HTTP Client

### Using HTTP in Scripts

Scripts have full access to the Tauri HTTP client via the `http()` function:

**Pre-Request Script:**
```javascript
// Fetch token before main request
const tokenResponse = await http('https://auth.example.com/oauth/token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  body: 'grant_type=client_credentials&client_id=xxx&client_secret=yyy'
});

if (tokenResponse.status === 200) {
  setVar('access_token', tokenResponse.data.access_token);
  log('Token obtained successfully');
}
```

**Post-Request Script:**
```javascript
// Chain requests based on response
const userId = responseData.id;
const detailsResponse = await http(`https://api.example.com/users/${userId}/details`, {
  headers: {
    'Authorization': `Bearer ${getVar('access_token')}`
  }
});

setVar('user_name', detailsResponse.data.name);
```

**Benefits:**
- ✅ No CORS - works like curl
- ✅ Automatic logging to script output
- ✅ JSON/text parsing based on Content-Type
- ✅ Full async/await support
- ✅ Error handling with try/catch

See [SCRIPTING.md](SCRIPTING.md) for complete documentation and examples.

## Additional Resources

- [Tauri v2 Documentation](https://v2.tauri.app/)
- [Vite Documentation](https://vitejs.dev/)
- [Tauri HTTP Plugin](https://v2.tauri.app/plugin/http-client/)
- [Scripting Guide](SCRIPTING.md)
- [Architecture Documentation](ARCHITECTURE.md)

## Support

For issues or questions:
- GitHub Issues: https://github.com/nicechester/just-rest-client/issues
- Tauri Discord: https://discord.gg/tauri
