// supabase/functions/disable-user/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4'
import { corsHeaders } from '../_shared/cors.ts'

declare const Deno: any;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { userId } = await req.json()
    if (!userId) {
      throw new Error('User ID é obrigatório.')
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    // Get user's email to find them in the leaders table
    const { data: { user }, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (getUserError) throw getUserError;
    if (!user) throw new Error("Usuário não encontrado.");

    const { email, user_metadata } = user;
    const name = user_metadata?.name || email;
    const initials = name.trim().split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();

    // Upsert the leader profile, ensuring it exists and setting its status to 'Inativo'
    const { error: upsertError } = await supabaseAdmin
      .from('leaders')
      .upsert({
        email: email,
        name: name,
        initials: initials,
        status: 'Inativo'
      }, { onConflict: 'email' });

    if (upsertError) throw upsertError;

    return new Response(JSON.stringify({ message: 'Líder desativado com sucesso.' }), {
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