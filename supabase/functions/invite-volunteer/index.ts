import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4';
import { corsHeaders } from '../_shared/cors.ts';

// FIX: Declare Deno to resolve TypeScript errors for Deno-specific APIs.
declare const Deno: any;

Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const { email, name } = await req.json();
    if (!email || !name) {
      throw new Error("Email e nome são obrigatórios.");
    }
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    // 1. Proactively check if a volunteer with this email already exists in the public table.
    const { data: existingVolunteer, error: volunteerCheckError } = await supabaseAdmin
        .from('volunteers')
        .select('id')
        .eq('email', email)
        .maybeSingle();

    if (volunteerCheckError) {
      console.error("Error checking for existing volunteer:", volunteerCheckError);
      // Do not block the request, let the auth invitation handle the primary validation.
    }

    if (existingVolunteer) {
      throw new Error(`Um voluntário com o email ${email} já está cadastrado.`);
    }

    // 2. Attempt to invite the user via Supabase Auth.
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        name: name,
        role: 'volunteer',
        status: 'Pendente'
      }
    });

    if (error) {
      if (error.message.includes('User already registered')) {
        // If the volunteer check passed, this error means the email belongs to a non-volunteer user (admin/leader).
        throw new Error(`Este e-mail já está em uso por um administrador ou líder. Não é possível cadastrá-lo como voluntário.`);
      }
      throw error;
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
    return new Response(JSON.stringify({
      error: error.message
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 400
    });
  }
});
