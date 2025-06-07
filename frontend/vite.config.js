import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/transcribe': 'http://localhost:3001',
      '/chat': 'http://localhost:3001',
      '/agent': 'http://localhost:3001'
    },
    historyApiFallback: true
  }
}); 