// supabase/functions/_shared/cors.ts

// É uma boa prática compartilhar os cabeçalhos CORS entre as funções.
export const corsHeaders = {
  // Usar um curinga '*' permite qualquer origem. Para produção, você pode querer restringir
  // isso ao seu domínio Vercel específico: 'https://volunteer-dashboard-one.vercel.app'
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  // FIX: Adicionado para permitir explicitamente os métodos de requisição usados pelo frontend.
  // A ausência deste cabeçalho é uma causa comum para falhas de CORS em requisições POST.
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};