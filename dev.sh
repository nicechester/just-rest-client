#!/bin/bash

# Just REST Client - Development Script
# This script starts both Vite dev server and Tauri in development mode

echo "🚀 Starting Just REST Client in development mode..."
echo ""
echo "This will start two processes:"
echo "  1. Vite dev server (port 9001)"
echo "  2. Tauri development app"
echo ""
echo "Press Ctrl+C to stop both processes"
echo ""

# Function to kill all child processes on exit
cleanup() {
    echo ""
    echo "🛑 Stopping development servers..."
    kill 0
}

trap cleanup EXIT

# Start Vite dev server in background
echo "📦 Starting Vite dev server..."
npm run dev &

# Wait a moment for Vite to start
sleep 3

# Start Tauri dev (this runs in foreground)
echo "🦀 Starting Tauri app..."
npm run tauri:dev

# This line only executes if tauri:dev exits
wait

