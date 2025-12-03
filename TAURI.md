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
- **Tauri**: Rust-based desktop framework
- **tauri-plugin-http**: Native HTTP client (bypasses CORS)

## Features

### No CORS Restrictions

The Tauri HTTP plugin routes all `fetch()` calls through Rust's native HTTP client (reqwest), which:
- ✅ Works like `curl` - no browser CORS checks
- ✅ Better SSL/TLS certificate handling
- ✅ Supports all HTTP methods and headers
- ✅ Handles binary data efficiently

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

## Additional Resources

- [Tauri Documentation](https://v2.tauri.app/)
- [Vite Documentation](https://vitejs.dev/)
- [Tauri HTTP Plugin](https://v2.tauri.app/plugin/http-client/)

## Support

For issues or questions:
- GitHub Issues: https://github.com/nicechester/just-rest-client/issues
- Tauri Discord: https://discord.gg/tauri
