// supabase/functions/enable-user/index.ts

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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const { userId, volunteerId } = await req.json()
     if (!userId) {
      throw new Error('User ID is required.')
    }

    // --- Update Auth User Metadata ---
    const { data: { user }, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId)
    if (getUserError) throw getUserError;
    if (!user) throw new Error(`Usuário com ID ${userId} não encontrado.`);
    
    const existingMetadata = (typeof user.user_metadata === 'object' && user.user_metadata !== null)
      ? user.user_metadata
      : {};
    const newMetadata = { ...existingMetadata, status: 'Ativo' };

    const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { user_metadata: newMetadata }
    )
    if (updateAuthError) throw updateAuthError;

    // --- Update Volunteers Table Status (if volunteerId is provided) ---
    if (volunteerId) {
        const { error: updateProfileError } = await supabaseAdmin
            .from('volunteers')
            .update({ status: 'Ativo' })
            .eq('id', volunteerId);
        
        if (updateProfileError) {
             console.warn(`Auth status updated for user ${userId}, but failed to update volunteers table for volunteer ${volunteerId}:`, updateProfileError.message);
        }
    }

    return new Response(JSON.stringify({ message: 'Usuário reativado com sucesso.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Error in enable-user function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro inesperado na função.';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})