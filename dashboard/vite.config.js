import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Vite's default only binds to localhost -- another device on the
    // local network (a phone/another laptop on the same WiFi) wouldn't be
    // able to open the dashboard at all without this. `host: true` = bind
    // to 0.0.0.0 (every network interface), Vite also automatically shows
    // its LAN URL in the terminal when `npm run dashboard` runs (from
    // which lib/config.js also adjusts the Agent Server base URL -- see
    // the note there).
    host: true,
  },
})
