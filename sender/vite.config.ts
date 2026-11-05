import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Fixed port so the Supabase sign-in redirect URL stays the same.
  server: { port: 5174, strictPort: true },
})
