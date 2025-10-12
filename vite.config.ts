// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    server: {
        port: 3000,
        host: '0.0.0.0',
    },
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'), // Ou o caminho correto para sua pasta src/
        }
    },
    // GARANTA QUE O BLOCO 'define' ESTÁ COMPLETAMENTE REMOVIDO!
});