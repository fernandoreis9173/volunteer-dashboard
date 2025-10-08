// supabase/functions/save-push-subscription/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2.44.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};

declare const Deno: any;

// This function securely saves a web push notification subscription object.
// It identifies the user SOLELY from the JWT passed in the Authorization header for enhanced security.
Deno.serve(async (req) => {
  console.log('Request received for save-push-subscription function.');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Processing request...');
    // 1. Create a Supabase client with the user's auth context to get the authenticated user
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // 2. Get the authenticated user from the token
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError) throw userError;
    if (!user) {
      throw new Error('Usuário não autenticado.');
    }

    // 3. Get ONLY the subscription object from the request body
    const { subscription } = await req.json();
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      throw new Error('O objeto de inscrição (subscription) é obrigatório e deve ter endpoint e keys.');
    }
    
    // 4. Prepare data for upsert using the secure user ID from the token
    const subscriptionPayload = {
      user_id: user.id, // Use the secure user ID from the auth token
      endpoint: subscription.endpoint,
      subscription_data: subscription // Store the full subscription object
    };

    // 5. Use the admin client to perform the upsert, bypassing any RLS policies
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .upsert(subscriptionPayload, { onConflict: 'endpoint' });

    if (error) {
        console.error('Supabase upsert error:', JSON.stringify(error, null, 2));
        throw error;
    }
    
    console.log(`Successfully saved subscription for user ${user.id}.`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error('Error saving push subscription:', error);
    const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro inesperado.';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});