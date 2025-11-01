// supabase/functions/create-leader-transfer-request/index.ts
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

  // This entire function is deprecated as leader assignment is now direct.
  // Return a "410 Gone" to indicate this endpoint is no longer active.
  console.warn("DEPRECATED: The 'create-leader-transfer-request' function was called but is obsolete.");

  return new Response(JSON.stringify({
    error: "This function is obsolete. Leader assignment is now handled directly by 'update-department-leader'."
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 410, // 410 Gone
  });
});