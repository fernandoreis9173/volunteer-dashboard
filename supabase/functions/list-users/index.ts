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
    const userIds = users.map(u => u.id);

    // Fetch profiles and volunteers to get phone numbers
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, phone')
      .in('id', userIds);

    const { data: volunteers } = await supabaseAdmin
      .from('volunteers')
      .select('user_id, phone')
      .in('user_id', userIds);

    const enrichedUsers = users.map(user => {
      // FIX: Cast user_metadata to 'any' to handle potential 'unknown' type from Supabase client in Deno environment, allowing safe property access and spreading.
      const userMetadata = (user.user_metadata as any) || {};
      const role = userMetadata.role;

      // Determine phone number based on role
      let phone = user.phone || userMetadata.phone; // Default from auth
      const profile = profiles?.find((p: any) => p.id === user.id);
      const volunteer = volunteers?.find((v: any) => v.user_id === user.id);

      if (role === 'admin' || role === 'leader' || role === 'lider') {
        // Admins/Leaders: Prefer profile phone
        if (profile?.phone) phone = profile.phone;
        else if (volunteer?.phone) phone = volunteer.phone;
      } else {
        // Volunteers: Prefer volunteer phone
        if (volunteer?.phone) phone = volunteer.phone;
        else if (profile?.phone) phone = profile.phone;
      }

      // Fallback to auth phone if still empty
      if (!phone) phone = user.phone || userMetadata.phone;

      let status: 'Ativo' | 'Inativo' | 'Pendente' = 'Ativo';
      if (userMetadata.status === 'Ativo' || userMetadata.status === 'Inativo' || userMetadata.status === 'Pendente') {
        status = userMetadata.status;
      } else if (user.invited_at && !user.last_sign_in_at) {
        status = 'Pendente';
      }

      return {
        ...user,
        phone, // Override phone with the correct one
        app_status: status
      };
    }); // Removed filter - show all users including those without phone

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