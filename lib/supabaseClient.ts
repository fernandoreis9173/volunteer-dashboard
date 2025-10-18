import { createClient } from '@supabase/supabase-js';

// Pega as variáveis do .env.local (Vite só expõe variáveis que começam com VITE_)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Verifica se as variáveis estão definidas
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '❌ Variáveis de ambiente do Supabase não estão definidas! Verifique seu .env.local'
  );
}

// Inicializa o client do Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
