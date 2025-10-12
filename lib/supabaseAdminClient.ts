// lib/supabaseAdminClient.ts
import { createClient } from '@supabase/supabase-js';

// Lê as chaves do ambiente para o backend.
// Estas variáveis DEVEM ser configuradas no seu ambiente de servidor (e.g., .env.local para dev,
// ou variáveis de ambiente na plataforma de deploy para produção).
// Elas NÃO DEVEM ter o prefixo NEXT_PUBLIC_.
const supabaseUrl = process.env.MY_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.MY_SUPABASE_SERVICE_ROLE_KEY;

// Verifica se as chaves foram encontradas.
if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error("ERRO: Chaves do Supabase para backend (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) não encontradas! Verifique o arquivo .env.local e a configuração do ambiente de deploy.");
    // Em um ambiente de produção, é crucial que essas chaves estejam disponíveis.
    throw new Error("Chaves do Supabase para backend não configuradas.");
}

// Cria e exporta o cliente Supabase com a service_role key.
// Este cliente tem permissões elevadas e bypassa o RLS.
// Use-o APENAS em código executado no servidor (API Routes, getServerSideProps, etc.).
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);