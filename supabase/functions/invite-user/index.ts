// supabase/functions/invite-user/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2.44.4';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};

// FIX: Declare Deno to resolve TypeScript errors for Deno-specific APIs.
declare const Deno: any;

Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    // Step 1: Initialize Supabase Admin Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase configuration is missing.');
    }
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    // Step 2: Get and validate request data
    const { email, role, name } = await req.json();
    if (!email || !role || !name) {
      throw new Error("Email, name, and role are required.");
    }
    // Step 3: Ensure this function is ONLY for 'admin' or 'leader' roles and normalize 'lider' to 'leader'.
    const normalizedRole = role === 'lider' ? 'leader' : role;
    if (normalizedRole !== 'admin' && normalizedRole !== 'leader') {
      throw new Error("This function is exclusively for inviting Admins and Leaders. For volunteers, use 'invite-volunteer'.");
    }
    // Step 4: Invite the user via Supabase Auth.
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        name: name,
        status: 'Pendente',
        role: normalizedRole
      }
    });
    if (inviteError) {
      if (inviteError.message.includes('User already registered')) {
        throw new Error(`A user with the email ${email} is already registered.`);
      }
      throw inviteError;
    }
    if (!inviteData.user) throw new Error("Invitation failed to return a user object.");
    // ---- DEFENSIVE STEP ----
    // Explicitly update the user's metadata immediately after creation.
    // This will override any potential database triggers that might be incorrectly setting the role to 'volunteer'.
    const { data: updatedUserData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(inviteData.user.id, {
      user_metadata: {
        name: name,
        status: 'Pendente',
        role: normalizedRole
      }
    });
    if (updateError) {
      // If this crucial update fails, we must roll back the invitation to prevent an inconsistent state.
      await supabaseAdmin.auth.admin.deleteUser(inviteData.user.id);
      throw new Error(`Failed to correctly set the user's role after invitation. The process has been rolled back. Error: ${updateError.message}`);
    }
    const finalUser = updatedUserData.user;
    // Step 5: Create or update the user's profile in the `profiles` table.
    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
      id: finalUser.id,
      role: normalizedRole
    }, { onConflict: 'id' });
    // Step 6: If creating the profile fails, roll back by deleting the invited user
    if (profileError) {
      console.error(`Failed to create profile for ${normalizedRole}. Rolling back user invitation.`, profileError);
      await supabaseAdmin.auth.admin.deleteUser(finalUser.id);
      throw new Error(`Failed to create the user's profile. The invitation has been cancelled. DB Error: ${profileError.message}`);
    }
    // Step 7: Cleanup step for any stray volunteer records.
    const { error: deleteError } = await supabaseAdmin.from('volunteers').delete().eq('user_id', finalUser.id);
    if (deleteError) {
      console.warn(`Could not clean up potential volunteer record for user ${finalUser.id}. Error: ${deleteError.message}`);
    }
    // Step 8: Success response.
    return new Response(JSON.stringify({
      user: finalUser
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('Error in invite-user function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred in the function.';
    return new Response(JSON.stringify({
      error: errorMessage
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});