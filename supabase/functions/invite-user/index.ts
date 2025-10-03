

// supabase/functions/invite-user/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4';
import { corsHeaders } from '../_shared/cors.ts';

declare const Deno: any;

Deno.serve(async (req) => {
  // Handles CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, role } = await req.json();
    if (!email || !role) {
      throw new Error("Email and role are required in the request body.");
    }
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Step 1: Invite the user without setting metadata in the initial call.
    // This separates the invitation from the metadata update for more reliability.
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);

    if (inviteError) throw inviteError;
    if (!inviteData.user) throw new Error("User invitation failed, no user object was returned.");

    // Step 2: Explicitly update the metadata for the newly created user.
    // This ensures the status is correctly set to 'Pendente' immediately after creation.
    let page_permissions: string[];
    switch (role) {
        case 'admin':
            page_permissions = ['dashboard', 'volunteers', 'departments', 'events', 'admin'];
            break;
        case 'lider':
            page_permissions = ['dashboard', 'volunteers', 'departments', 'events'];
            break;
        case 'volunteer':
            page_permissions = ['dashboard']; // Volunteers only see their dashboard
            break;
        default:
            page_permissions = ['dashboard']; // Safest default
    }

    const metadata = {
        status: 'Pendente',
        role,
        page_permissions
    };

    const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      inviteData.user.id,
      { user_metadata: metadata }
    );
    
    if (updateError) throw updateError;
    
    return new Response(JSON.stringify({ user: updateData.user }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
});
