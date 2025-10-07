// supabase/functions/save-push-subscription/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2.44.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};

declare const Deno: any;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { subscription, user_id } = await req.json();

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      throw new Error('O objeto de inscrição (subscription) com endpoint e keys é obrigatório.');
    }

    if (!user_id) {
      throw new Error('O user_id é obrigatório para salvar a subscription.');
    }

    // Prepara dados para upsert, salvando apenas as partes essenciais no JSONB.
    const subscriptionPayload = {
      user_id,
      endpoint: subscription.endpoint,
      subscription_data: {
        keys: subscription.keys,
        expirationTime: subscription.expirationTime || null,
      }
    };

    // Cliente admin para contornar RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Upsert na tabela usando endpoint como conflito
    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .upsert(subscriptionPayload, { onConflict: 'endpoint' });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error('Erro ao salvar inscrição push:', error);
    const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro inesperado.';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});