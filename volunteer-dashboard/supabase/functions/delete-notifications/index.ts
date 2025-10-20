// supabase/functions/delete-notifications/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2.44.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

declare const Deno: any;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Get Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase URL and Service Role Key are required.');
    }
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    
    // User client to get authenticated user
    const supabaseUserClient = createClient(
        supabaseUrl,
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    const { data: { user } } = await supabaseUserClient.auth.getUser();
    if (!user) {
        return new Response(JSON.stringify({ error: 'Authentication required.' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const { notificationId, deleteAll } = await req.json();

    if (deleteAll) {
        // Delete all notifications for the authenticated user
        const { error: deleteError } = await supabaseAdmin
            .from('notifications')
            .delete()
            .eq('user_id', user.id);

        if (deleteError) throw deleteError;
        
        return new Response(JSON.stringify({ message: 'All notifications deleted successfully.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } else if (notificationId) {
        // Delete a single notification, ensuring it belongs to the user
        const { error: deleteError } = await supabaseAdmin
            .from('notifications')
            .delete()
            .match({ id: notificationId, user_id: user.id });

        if (deleteError) throw deleteError;

        return new Response(JSON.stringify({ message: 'Notification deleted successfully.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    } else {
        return new Response(JSON.stringify({ error: 'Invalid request payload. Provide notificationId or deleteAll.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

  } catch (error) {
    console.error('Error in delete-notifications function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
