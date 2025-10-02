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

    // 3. Safely handle the response data
    const users = authData?.users || [];

    // FIX: Enhanced logic to correctly determine user status ('Pendente', 'Ativo', 'Inativo') on the backend.
    // This makes the backend the single source of truth for user status and resolves frontend type errors.
    const enrichedUsers = users
      .filter(u => {
        // Ensure user_metadata is an object before accessing properties
        const metadata = u.user_metadata;
        if (typeof metadata !== 'object' || metadata === null) return false;
        
        const role = metadata.role || metadata.papel;
        return role === 'admin' || role === 'lider';
      })
      .map(user => {
        let status: 'Ativo' | 'Inativo' | 'Pendente' = 'Pendente';
        // A user explicitly set to 'Inativo' in metadata should always be Inativo.
        if (user.user_metadata?.status === 'Inativo') {
          status = 'Inativo';
        // A user who has signed in is 'Ativo'.
        } else if (user.last_sign_in_at) {
          status = 'Ativo';
        }
        // Otherwise, the user is 'Pendente' (invited but never signed in).
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