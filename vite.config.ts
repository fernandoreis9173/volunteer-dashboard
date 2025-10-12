// vite.config.ts
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path'; // É comum usar 'path' para aliases

export default defineConfig(({ mode }) => {
    // Carrega as variáveis de ambiente do arquivo .env correspondente ao modo.
    // O terceiro parâmetro '' garante que todas as variáveis sejam carregadas.
    const env = loadEnv(mode, process.cwd(), '');

    // Retorna a configuração principal do Vite.
    return {
        // Configurações do servidor de desenvolvimento
        server: {
            port: 3000, // Porta padrão para desenvolvimento
            host: '0.0.0.0', // Permite acesso de outros dispositivos na rede
            // Se você quiser ter certeza que o HMR (Hot Module Replacement) funciona
            // mesmo com o Supabase ou outros plugins, pode descomentar esta linha:
            // hmr: { overlay: false }, // Descomente se o overlay de erro do Vite estiver atrapalhando
        },
        
        // Plugins usados pelo Vite
        plugins: [
            react() // Plugin para suporte a React/JSX
        ],
        
        // Configurações de aliases para facilitar importações
        resolve: {
            alias: {
                // Permite importar módulos usando '@' como atalho para a raiz do projeto.
                // Ex: import { supabaseFrontend } from '@/lib/supabaseFrontend';
                '@': path.resolve(__dirname, './src'), // Assumindo que seu código principal está em src/
                // Se seus arquivos `lib` e `components` estão na raiz do projeto,
                // use: '@': path.resolve(__dirname, './'),
            }
        },

        // Observação sobre `define` para `process.env` em Next.js:
        // O Next.js tem seu próprio sistema para expor variáveis de ambiente ao frontend
        // usando o prefixo `NEXT_PUBLIC_`. O `define` do Vite pode conflitar ou ser redundante.
        // Se você já está usando NEXT_PUBLIC_... em seu código e carregando-as corretamente
        // (e.g., em lib/supabaseFrontend.ts), você provavelmente pode remover ou comentar
        // o bloco `define` abaixo, pois o Next.js builder cuidará disso.
        //
        // define: {
        //     // Exemplo de como expor chaves para o cliente, mas isso é geralmente gerenciado pelo Next.js.
        //     // Se suas chaves Supabase usam NEXT_PUBLIC_..., elas já devem estar disponíveis.
        //     // Exemplo: 'process.env.NEXT_PUBLIC_GEMINI_API_KEY': JSON.stringify(env.NEXT_PUBLIC_GEMINI_API_KEY)
        // },
    };
});