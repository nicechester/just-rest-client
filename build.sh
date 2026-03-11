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
echo "   macOS App: src-tauri/target/release/bundle/macos/"
echo "   macOS DMG: src-tauri/target/release/bundle/dmg/"
echo ""
echo "💡 To create a release:"
echo "   1. Tag the commit: git tag 1.1.6"
echo "   2. Push the tag: git push origin 1.1.6"
echo "   3. GitHub Actions will build and create a release automatically"
echo ""