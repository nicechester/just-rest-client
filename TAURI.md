# Tauri Build Instructions

## Prerequisites

You already have Rust installed. Just need to install Tauri CLI:

```bash
cargo install tauri-cli
```

## Generate Icons (One-time Setup)

First, you need to generate app icons from your chester.png:

```bash
# Install icon generator
cargo install tauri-icns

# Create icons directory
mkdir -p src-tauri/icons

# Option 1: Use online tool
# Upload chester.png to https://icon.kitchen/
# Download all formats and place in src-tauri/icons/

# Option 2: Use ImageMagick (if installed)
# This creates PNG icons
convert chester.png -resize 32x32 src-tauri/icons/32x32.png
convert chester.png -resize 128x128 src-tauri/icons/128x128.png
convert chester.png -resize 256x256 src-tauri/icons/128x128@2x.png
convert chester.png -resize 512x512 src-tauri/icons/icon.png

# For macOS .icns (requires png2icns or iconutil)
# For Windows .ico (requires imagemagick or online tool)
```

**Easiest way**: Copy chester.png to `src-tauri/icons/icon.png` and Tauri will auto-generate during first build!

## Development

### Start the Dev Server (Terminal 1)

```bash
cd web
python3 -m http.server 9001
```

### Run Tauri in Dev Mode (Terminal 2)

```bash
cargo tauri dev
```

This will:
- Load your app from http://localhost:9001
- Enable hot reload for changes
- **No CORS issues!**

## Build for Production

Build optimized native app:

```bash
cargo tauri build
```

This creates:
- **macOS**: `.dmg` and `.app` in `src-tauri/target/release/bundle/dmg/`
- **Windows**: `.exe` and `.msi` in `src-tauri/target/release/bundle/`
- **Linux**: `.deb`, `.AppImage` in `src-tauri/target/release/bundle/`

## Features

✅ **No CORS restrictions** - Make requests to any API
✅ **Native app** - Runs as a desktop application
✅ **Small size** - ~3-5MB app bundle
✅ **Fast startup** - Native performance
✅ **LocalStorage** - Works perfectly (stored in app data)
✅ **Auto-updates** - Can be added easily

## Troubleshooting

### Missing Dependencies (Linux)

```bash
sudo apt install libwebkit2gtk-4.0-dev \
    build-essential \
    curl \
    wget \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev
```

### Icons Not Found

Just copy chester.png to `src-tauri/icons/icon.png` and run build again.

### Port Already in Use

Tauri dev uses a different approach - it serves files directly, no Python server needed!

