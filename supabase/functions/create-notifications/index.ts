// supabase/functions/create-notifications/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4';

// Inlined CORS headers to avoid relative path issues in deployment
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};

// Declaração Deno (necessária para Deno.env.get)
declare const Deno: any;

Deno.serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  
  try {
    const { notifications } = await req.json();
    if (!notifications || !Array.isArray(notifications) || notifications.length === 0) {
      // Retorna 400 se o corpo da requisição for inválido
      return new Response(JSON.stringify({ error: "The 'notifications' array is required in the request body." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }
    
    // Configuração do cliente Supabase com a Service Role Key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // 1. Insert notifications into the database.
    const { error: insertError } = await supabaseAdmin.from('notifications').insert(notifications);
    if (insertError) {
      throw insertError;
    }
    
    // LÓGICA DE PUSH NOTIFICATION REMOVIDA PARA GARANTIR O DEPLOY

    return new Response(JSON.stringify({
      success: true,
      // Mensagem clara para indicar que a inserção no DB funcionou, mas o Push não foi tentado
      message: 'Notifications created successfully. Push skipped.' 
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
    
  } catch (error) {
    console.error('Error in create-notifications function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred in the function.';
    return new Response(JSON.stringify({
      error: errorMessage
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});