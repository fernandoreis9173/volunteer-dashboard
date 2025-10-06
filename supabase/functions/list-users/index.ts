import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4'
import { corsHeaders } from '../_shared/cors.ts';

declare const Deno: any;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  try {
    // 1. Validate environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase URL and Service Role Key are required.');
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // 2. Fetch all users from Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000, // Adjust if you have more users
    });

    if (authError) throw authError;

    // 3. Safely handle the response data and filter out volunteers
    const users = (authData?.users || []).filter(user => user.user_metadata?.role !== 'volunteer');


    // Enriched user logic to determine a definitive status.
    const enrichedUsers = users.map(user => {
        // A user who has been invited but has never signed in is always 'Pendente'.
        // This is a more robust check than relying solely on metadata.
        if (user.invited_at && !user.last_sign_in_at) {
            return {
                ...user,
                app_status: 'Pendente',
            };
        }
        
        // For users who have signed in, their status is determined by metadata.
        const metadataStatus = user.user_metadata?.status;
        let status: 'Ativo' | 'Inativo' | 'Pendente' = 'Ativo'; // Default to 'Ativo' for any user who has signed in.

        if (metadataStatus === 'Ativo' || metadataStatus === 'Inativo') {
            status = metadataStatus;
        } else if (metadataStatus === 'Pendente') {
            // This is an edge case where a user signed in, but activation failed.
            // We keep the status as 'Pendente' to signal an issue.
            status = 'Pendente';
        }

        return {
          ...user,
          app_status: status,
        }
      });

    return new Response(JSON.stringify({ users: enrichedUsers }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Error in list-users function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500, // Internal Server Error for function failures
    })
  }
})