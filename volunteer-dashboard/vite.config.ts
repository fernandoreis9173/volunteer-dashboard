
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    server: {
        port: 3000,
        host: '0.0.0.0',
        // ADICIONE ESTE BLOCO PARA CORRIGIR O WEBSOCKET 👇
        hmr: {
            host: 'localhost',
        }
    },
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'), // Seu alias está correto
        }
    },
});
