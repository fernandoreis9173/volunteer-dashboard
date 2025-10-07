// supabase/functions/invite-user/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4';

// Inlined CORS headers to avoid relative path issues in deployment
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

declare const Deno: any;

Deno.serve(async (req) => {
  // Handles CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, role, name } = await req.json();
    if (!email || !role || !name) {
      throw new Error("Email, nome e função são obrigatórios no corpo da requisição.");
    }
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Define metadata, including page permissions based on role, BEFORE inviting.
    let page_permissions: string[];
    switch (role) {
        case 'admin':
            page_permissions = ['dashboard', 'volunteers', 'departments', 'events', 'admin'];
            break;
        case 'leader':
        case 'lider':
            page_permissions = ['dashboard', 'volunteers', 'departments', 'events', 'notifications'];
            break;
        default:
            // This case should not be hit from the frontend, but provides a safe default.
            page_permissions = ['dashboard'];
    }

    const metadata = {
        name: name,
        status: 'Pendente',
        role,
        page_permissions
    };

    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      { data: metadata }
    );

    if (inviteError) {
        if (inviteError.message && inviteError.message.includes('User already registered')) {
            throw new Error(`Um usuário com o email ${email} já está registrado.`);
        }
        throw inviteError;
    }

    if (!inviteData.user) throw new Error("User invitation failed, no user object was returned.");
    
    return new Response(JSON.stringify({ user: inviteData.user }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (error) {
    console.error('Error in invite-user function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro inesperado na função.';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});