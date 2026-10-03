import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // En dev local avec `netlify dev`, les fonctions tournent sur le port 8888.
      // Si tu lances uniquement `npm run dev`, les appels /.netlify/functions/*
      // échoueront : utilise `netlify dev` pour tester l'app avec le backend.
    }
  }
});
