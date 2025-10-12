import { createClient } from 'npm:@supabase/supabase-js@2.44.4';

// Inlined CORS headers to avoid relative path issues in deployment
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase URL e Service Role Key são obrigatórios.');
    }

    const { email, name } = await req.json();
    if (!email || !name) {
      throw new Error("Email e nome são obrigatórios.");
    }
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: existingVolunteer } = await supabaseAdmin
        .from('volunteers')
        .select('id')
        .eq('email', email)
        .maybeSingle();

    if (existingVolunteer) {
      throw new Error(`Um voluntário com o email ${email} já está cadastrado.`);
    }

    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        name: name,
        role: 'volunteer',
        status: 'Pendente'
      }
    });

    if (error) {
      if (error.message.includes('User already registered')) {
        throw new Error(`Este e-mail já está em uso por um administrador ou líder. Não é possível cadastrá-lo como voluntário.`);
      }
      throw error;
    }
    
    if (!data.user) throw new Error("A falha no convite não retornou um objeto de usuário.");

    const nameParts = name.trim().split(' ').filter((p: string) => p.length > 0);
    const calculatedInitials = (
        (nameParts[0]?.[0] || '') + 
        (nameParts.length > 1 ? nameParts[nameParts.length - 1]?.[0] || '' : '')
    ).toUpperCase();

    const volunteerPayload = {
        user_id: data.user.id,
        email: data.user.email,
        name: name,
        initials: calculatedInitials,
        status: 'Pendente' as const,
    };

    const { error: volunteerUpsertError } = await supabaseAdmin
      .from('volunteers')
      .upsert(volunteerPayload, { onConflict: 'user_id' });

    if (volunteerUpsertError) {
      console.error("Failed to create/update volunteer profile. Rolling back user invitation.", volunteerUpsertError);
      await supabaseAdmin.auth.admin.deleteUser(data.user.id);
      throw new Error(`Falha ao criar o perfil do voluntário. O convite foi cancelado. Erro do banco: ${volunteerUpsertError.message}`);
    }

    return new Response(JSON.stringify({
      user: data.user
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('Error in invite-volunteer function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro inesperado na função.';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});