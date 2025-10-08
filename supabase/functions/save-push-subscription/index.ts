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
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase URL and Service Role Key are required environment variables.');
    }

    // Get subscription and user_id data from the request body
    const { subscription, user_id } = await req.json();

    if (!user_id) {
      throw new Error('The user_id is required in the request body.');
    }

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      throw new Error('The subscription object with endpoint and keys is required in the request body.');
    }

    const subscriptionPayload = {
      user_id: user_id, // Use the user_id from the request body
      endpoint: subscription.endpoint,
      subscription_data: subscription
    };

    // Use the admin client to perform the upsert, bypassing any RLS policies
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabaseAdmin
      .from('push_subscriptions')
      .upsert(subscriptionPayload, { onConflict: 'endpoint' })
      .select();

    if (error) {
      console.error('Supabase upsert error:', JSON.stringify(error, null, 2));
      throw error;
    }
    
    if (!data || data.length === 0) {
      console.warn('Upsert operation succeeded but returned no data. Check RLS policies on `push_subscriptions` table.');
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error('Error saving push subscription:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});