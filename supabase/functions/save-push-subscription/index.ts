// supabase/functions/save-push-subscription/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4'
import { corsHeaders } from '../_shared/cors.ts'

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

    // Cria um cliente Supabase com o contexto de autenticação do usuário que chamou a função.
    // Isso permite que a RLS autorize a inserção.
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
    
    // Faz um "upsert" na tabela push_subscriptions.
    // É crucial que esta tabela tenha RLS habilitada para permitir que os usuários insiram/atualizem suas próprias linhas.
    const { error } = await supabaseClient
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
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
