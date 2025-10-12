// lib/supabaseFrontend.ts (anteriormente supabaseClient.ts)
import { createClient } from '@supabase/supabase-js';

// Lê as chaves do ambiente, usando o prefixo NEXT_PUBLIC_ para que o Next.js as exponha ao frontend.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Verifica se as chaves foram encontradas.
if (!supabaseUrl || !supabaseAnonKey) {
    console.error("ERRO: Chaves do Supabase para frontend não encontradas! Verifique o arquivo .env.local e a configuração do ambiente de deploy.");
    // Em um ambiente de produção, é melhor lançar um erro ou não inicializar o cliente.
    throw new Error("Chaves do Supabase para frontend não configuradas.");
}

// Cria e exporta o cliente Supabase para uso no frontend (navegador).
// Este cliente usa a anon key e é seguro apenas se o RLS estiver configurado no Supabase.
export const supabaseFrontend = createClient(supabaseUrl, supabaseAnonKey);

// A linha original `export const supabase = ...` foi substituída por `export const supabaseFrontend = ...`
// para clareza. Se você quiser manter o nome `supabase`, pode renomear `supabaseFrontend` para `supabase`.