import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  plugins: [react(), tailwindcss()],
  define: {
    'process.env': {},
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  worker: {
    format: 'es' as const,
  },
}));
