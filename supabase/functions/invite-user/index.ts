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
    
    // Step 1: Invite the user.
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);

    if (inviteError) {
        if (inviteError.message && inviteError.message.includes('User already registered')) {
            throw new Error(`Um usuário com o email ${email} já está registrado.`);
        }
        throw inviteError;
    }

    if (!inviteData.user) throw new Error("User invitation failed, no user object was returned.");
    const user = inviteData.user;

    // Step 2: Define metadata, including page permissions based on role.
    let page_permissions: string[];
    switch (role) {
        case 'admin':
            page_permissions = ['dashboard', 'volunteers', 'departments', 'events', 'admin'];
            break;
        case 'leader':
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
      user.id,
      { user_metadata: metadata }
    );
    
    if (updateError) {
        await supabaseAdmin.auth.admin.deleteUser(user.id);
        throw updateError;
    }

    // Step 3: Create the user's profile in the 'profiles' table.
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({ id: user.id, role: role });

    if (profileError) {
      // Rollback auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(user.id);
      throw new Error(`User was invited, but profile creation failed: ${profileError.message}`);
    }
    
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
