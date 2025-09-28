import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { copyFileSync, existsSync } from 'fs'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-staticwebapp-config',
      writeBundle() {
        if (existsSync('staticwebapp.config.json')) {
          try {
            copyFileSync('staticwebapp.config.json', 'dist/staticwebapp.config.json')
            console.log('✅ staticwebapp.config.json copied successfully')
          } catch (error) {
            console.warn('⚠️ Failed to copy staticwebapp.config.json:', error)
          }
        } else {
          console.warn('⚠️ staticwebapp.config.json not found, skipping copy')
        }
      }
    }
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@grc-ai-platform/shared': resolve(__dirname, '../shared/src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3005',
        changeOrigin: true,
        secure: false
      },
      '/health': {
        target: 'http://localhost:3005',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})