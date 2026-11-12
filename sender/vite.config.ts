import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'

// Locally, /gift (no slash) would fall back to the admin page; send it to /gift/ like Vercel does.
const giftSlash: Plugin = {
  name: 'gift-slash',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url === '/gift') return res.writeHead(302, { Location: '/gift/' }).end()
      next()
    })
  },
  configurePreviewServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url === '/gift') return res.writeHead(302, { Location: '/gift/' }).end()
      next()
    })
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), giftSlash],
  // Fixed port so the Supabase sign-in redirect URL stays the same. The gift page imports the app's
  // plant art from ../app, so the dev server may read outside this folder.
  server: { port: 5174, strictPort: true, fs: { allow: ['..'] } },
  // Two pages: the signed-in notes admin (/) and the public birthday gift page (/gift).
  build: {
    rolldownOptions: {
      input: { main: resolve(import.meta.dirname, 'index.html'), gift: resolve(import.meta.dirname, 'gift/index.html') },
    },
  },
})
