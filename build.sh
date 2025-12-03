#!/bin/bash

# Just REST Client - Clean & Build Script
# This script cleans all build artifacts and creates a fresh production build

set -e  # Exit on any error

echo "🧹 Cleaning build artifacts..."

# Clean Rust/Tauri artifacts
echo "  → Cleaning Rust target directory..."
cd src-tauri
cargo clean
cd ..

# Clean Vite build artifacts
echo "  → Cleaning Vite dist directory..."
rm -rf dist

# Optional: Clean node_modules (uncomment if needed)
# echo "  → Cleaning node_modules..."
# rm -rf node_modules
# npm install

echo ""
echo "🔨 Building production app..."
npm run tauri:build

echo ""
echo "✅ Build complete!"
echo ""
echo "📦 Build artifacts located at:"
echo "   macOS: src-tauri/target/release/bundle/macos/"
echo "   DMG:   src-tauri/target/release/bundle/dmg/"
echo ""

cp src-tauri/target/release/bundle/dmg/Just\ REST\ Client_0.1.0_aarch64.dmg downloads/just_rest_client_0.1.0_aarch64.dmg