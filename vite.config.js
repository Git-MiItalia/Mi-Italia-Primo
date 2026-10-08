import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  /* Dev server only — `server` is ignored by `vite build`, so nothing here
   * reaches dev, qa or production.
   *
   * It lets .env keep the relative `VITE_API_URL=/api` that the deployed
   * builds use, which means the API is same-origin here too: no CORS, and
   * the app works from a phone on the LAN (`npm run dev -- --host`) without
   * that device's address having to be on any allowlist. Point it at qa by
   * changing the one URL below. */
  server: {
    proxy: {
      '/api': {
        target: 'https://apidev.revoltution.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
