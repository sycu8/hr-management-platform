import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import { cloudflare } from "@cloudflare/vite-plugin";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Local-only bindings for QA/e2e — no Cloudflare API token required.
    // AI / Email remain unavailable locally unless remoteBindings is re-enabled.
    cloudflare({ remoteBindings: false }),
  ],
})