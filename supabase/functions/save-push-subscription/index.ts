// supabase/functions/save-push-subscription/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4'

// Inlined CORS headers to avoid relative path issues in deployment
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

declare const Deno: any;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { subscription } = await req.json();
    if (!subscription || !subscription.endpoint) {
      throw new Error('O objeto de inscrição (subscription) é obrigatório.');
    }

    // Cria um cliente Supabase com o contexto de autenticação do usuário para identificá-lo.
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
        throw new Error('Usuário não autenticado.');
    }

    const subscriptionData = {
      user_id: user.id,
      endpoint: subscription.endpoint,
      subscription_data: subscription, // Armazena o objeto inteiro para as chaves
    };
    
    // Cria um cliente admin com a service role key para contornar a RLS e garantir a escrita.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Faz um "upsert" na tabela push_subscriptions usando o cliente admin.
    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .upsert(subscriptionData, { onConflict: 'user_id, endpoint' });

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Erro ao salvar inscrição push:', error);
    const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro inesperado na função.';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})