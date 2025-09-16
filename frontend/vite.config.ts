import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import nodePolyfills from 'rollup-plugin-node-polyfills';
export default defineConfig({
  resolve: {

    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@web3': fileURLToPath(new URL('../web3', import.meta.url))
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      }
    }
  }
});