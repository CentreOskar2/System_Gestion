import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Identifiant du build : l'application le compare à /version.json pour se
// recharger automatiquement dès qu'un nouveau déploiement est en ligne.
const appVersion = new Date().toISOString()

function emitVersionFile() {
  return {
    name: 'oskar-version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version: appVersion }, null, 2),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), emitVersionFile()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  build: {
    chunkSizeWarningLimit: 1400,
  },
})
