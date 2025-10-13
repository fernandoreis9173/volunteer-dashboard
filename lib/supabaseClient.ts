import { createClient } from '@supabase/supabase-js';

// **CORREÇÃO CRÍTICA:** Usar import.meta.env para variáveis de ambiente no Vite.
// O Vite injeta variáveis de ambiente com o prefixo VITE_.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

// A verificação de advertência também precisa ser atualizada para usar import.meta.env.
if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
    // Esta advertência é útil para desenvolvedores no console.
    console.warn("URL do Supabase ou Chave Anon estão ausentes nas variáveis de ambiente. A página de configuração será exibida.");
}

// Inicializa o cliente.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
