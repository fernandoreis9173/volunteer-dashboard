// supabase/functions/push-notifications/index.ts

// ===================================================================================
// ESTA FUNÇÃO ESTÁ DESATIVADA (DEPRECATED) E NÃO DEVE SER UTILIZADA.
// A sua lógica era uma combinação confusa de 'save-push-subscription' e 'create-notifications'.
//
// - Para SALVAR inscrições, utilize a função 'save-push-subscription'.
// - Para CRIAR e ENVIAR notificações, utilize a função 'create-notifications'.
//
// Manter esta função vazia evita bugs e confusão na arquitetura.
// ===================================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};

// FIX: Declare Deno to resolve TypeScript errors for Deno-specific APIs.
declare const Deno: any;
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.warn("A função 'push-notifications' foi chamada, mas está desativada (deprecated). Use 'save-push-subscription' ou 'create-notifications'.");

  return new Response(JSON.stringify({ 
    error: "Esta função está desativada (deprecated). Por favor, use 'save-push-subscription' para salvar inscrições e 'create-notifications' para enviar notificações." 
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 410 // HTTP 410 Gone - indica que o recurso não está mais disponível.
  });
});