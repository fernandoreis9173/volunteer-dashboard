import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4'
import { corsHeaders } from '../_shared/cors.ts';

declare const Deno: any;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
    });
    if (authError) throw authError;

    // Fetch all leader statuses to enrich the user data
    const { data: leadersData, error: leadersError } = await supabaseAdmin
        .from('leaders')
        .select('email, status');
    if (leadersError) throw leadersError;
    
    // Create a map for quick lookup: email -> status
    const statusMap = new Map(leadersData.map(l => [l.email, l.status]));

    // Enrich users with the application-specific status from the leaders table
    const enrichedUsers = authData.users
      .filter(u => {
        const role = u.user_metadata?.role || u.user_metadata?.papel;
        return role === 'admin' || role === 'lider';
      })
      .map(user => ({
        ...user,
        app_status: statusMap.get(user.email) || 'Ativo' // Default to 'Ativo' if no profile exists
      }));

    return new Response(JSON.stringify({ users: enrichedUsers }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})