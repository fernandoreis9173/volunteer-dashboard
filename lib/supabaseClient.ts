import { createClient } from '@supabase/supabase-js';

// 1. Acessa as variáveis de ambiente usando o método do Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 2. Uma verificação mais robusta: se as chaves não existirem, lança um erro.
// Isso impede que o app tente funcionar com credenciais inválidas.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("As variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não foram encontradas. Verifique seu arquivo .env");
}

// 3. Inicializa o cliente Supabase com as variáveis corretas.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);