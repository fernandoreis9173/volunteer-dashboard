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
    const { userId } = await req.json()
     if (!userId) {
      throw new Error('User ID is required.')
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Fetch the user to get existing metadata
    const { data: { user }, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId)
    if (getUserError) throw getUserError;
    if (!user) throw new Error(`Usuário com ID ${userId} não encontrado.`);
    
    // 2. Safely merge metadata, ensuring it's an object
    const existingMetadata = (typeof user.user_metadata === 'object' && user.user_metadata !== null)
      ? user.user_metadata
      : {};
    const newMetadata = { ...existingMetadata, status: 'Ativo' };

    // 3. Update the user with the merged metadata to avoid data loss
    const { data: updatedUserData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { user_metadata: newMetadata }
    )

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ message: 'Líder reativado com sucesso.' }), {
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