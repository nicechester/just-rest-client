import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  root: 'web',
  
  // Development server configuration
  server: {
    port: 9001,
    strictPort: true,
    host: 'localhost',
  },

  // Build output configuration
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: './web/index.html'
      }
    }
  },

  // Ensure proper handling of ES modules
  optimizeDeps: {
    include: ['@tauri-apps/plugin-http']
  },

  // Clear the screen on dev server start
  clearScreen: false,
});

