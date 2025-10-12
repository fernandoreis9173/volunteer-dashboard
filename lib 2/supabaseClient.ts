// ARQUIVO: supabaseClient.ts - VERSÃO CORRIGIDA PARA VITE ✅

import { createClient } from '@supabase/supabase-js';

// Use a sintaxe do Vite (import.meta.env) para acessar as variáveis de ambiente.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

// A lógica de verificação agora usa a sintaxe correta.
if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
    // Este aviso continua útil para os desenvolvedores no console.
    console.warn("URL do Supabase ou Chave Anon estão ausentes nas variáveis de ambiente. A página de configuração será exibida.");
}

// Inicializa o cliente do Supabase.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);