import { createClient } from 'npm:@supabase/supabase-js@2.44.4';

// Inlined CORS headers to avoid relative path issues in deployment
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

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

    // 2. Safely parse body to check for context
    let body: { context?: string } = {};
    if (req.body) {
        try {
            body = await req.json();
        } catch (e) {
            // Ignore parsing error if body is empty or invalid
        }
    }
    const context = body.context;

    // 3. Optimized path for Dashboard
    if (context === 'dashboard') {
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({
            page: 1,
            perPage: 200, // Fetch a reasonable number to find active leaders
        });

        if (authError) throw authError;

        const users = (authData?.users || [])
            .filter(user => {
                const role = user.user_metadata?.role;
                return (role === 'admin' || role === 'leader' || role === 'lider') && user.user_metadata?.status !== 'Inativo' && user.last_sign_in_at;
            })
            .sort((a, b) => new Date(b.last_sign_in_at || 0).getTime() - new Date(a.last_sign_in_at || 0).getTime())
            .slice(0, 5)
            .map(user => ({ ...user, app_status: 'Ativo' }));

        return new Response(JSON.stringify({ users }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
    }

    // 4. Default path for AdminPage and other general uses
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
    });

    if (authError) throw authError;

    const users = (authData?.users || []);
    
    const enrichedUsers = users.map(user => {
        // FIX: Cast user_metadata to 'any' to handle potential 'unknown' type from Supabase client in Deno environment, allowing safe property access and spreading.
        const userMetadata = (user.user_metadata as any) || {};

        let status: 'Ativo' | 'Inativo' | 'Pendente' = 'Ativo';
        if (userMetadata.status === 'Ativo' || userMetadata.status === 'Inativo' || userMetadata.status === 'Pendente') {
            status = userMetadata.status;
        } else if (user.invited_at && !user.last_sign_in_at) {
            status = 'Pendente';
        }
        
        return { 
            ...user,
            app_status: status 
        };
      });

    return new Response(JSON.stringify({ users: enrichedUsers }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Error in list-users function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro inesperado na função.';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})