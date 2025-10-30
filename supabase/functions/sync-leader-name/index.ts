import { createClient } from 'npm:@supabase/supabase-js@2.44.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

declare const Deno: any;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // This function is deprecated because the `departments` table no longer stores
  // the leader's name directly. The leader's name is fetched dynamically.
  console.warn("DEPRECATED: The 'sync-leader-name' function was called but is obsolete.");

  return new Response(JSON.stringify({
    error: "This function is obsolete. The leader's name is now displayed dynamically and does not need to be synchronized."
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 410, // 410 Gone
  });
});
