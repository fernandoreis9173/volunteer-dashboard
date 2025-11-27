// supabase/functions/invite-to-department/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2.44.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

declare const Deno: any;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Initialize clients and get authenticated user (the leader)
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('A configuração do Supabase está ausente.');
    }
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: req.headers.get('Authorization')! } }
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error('Falha na autenticação.');

    // 2. Get the leader's department
    const { data: leaderDept, error: deptError } = await supabaseAdmin
      .from('department_leaders')
      .select('department_id')
      .eq('user_id', user.id)
      .single();

    if (deptError || !leaderDept || !leaderDept.department_id) {
      throw new Error('Não foi possível encontrar um departamento associado a este líder.');
    }
    const departmentId = leaderDept.department_id;

    // 3. Get the volunteer ID and their data
    const { volunteerId } = await req.json();
    if (!volunteerId) throw new Error('O ID do voluntário é obrigatório.');

    const { data: volunteer, error: volunteerError } = await supabaseAdmin
      .from('volunteers')
      .select('id, user_id, name')
      .eq('id', volunteerId)
      .single();

    if (volunteerError) throw volunteerError;
    if (!volunteer) throw new Error('Voluntário não encontrado.');

    // 4. Check for existing pending invitation to avoid duplicates
    const { data: existingInvitation, error: checkError } = await supabaseAdmin
      .from('invitations')
      .select('id')
      .match({
        volunteer_id: volunteerId,
        department_id: departmentId,
        status: 'pendente'
      })
      .maybeSingle();

    if (checkError) throw checkError;
    if (existingInvitation) {
      throw new Error(`Um convite para ${volunteer.name} para este departamento já está pendente.`);
    }

    // 5. Create the invitation
    const { error: insertError } = await supabaseAdmin.from('invitations').insert({
      volunteer_id: volunteerId,
      department_id: departmentId,
      user_id: user.id,
      status: 'pendente',
    });
    if (insertError) throw insertError;

    // 6. Create and send notification to the volunteer
    if (volunteer.user_id) {
      const { data: department, error: deptNameError } = await supabaseAdmin
        .from('departments')
        .select('name')
        .eq('id', departmentId)
        .single();

      const leaderName = user.user_metadata?.name || 'Um líder';
      const departmentName = department?.name || 'um departamento';
      const notificationMessage = `${leaderName} convidou você para se juntar ao departamento "${departmentName}".`;

      await supabaseAdmin.from('notifications').insert({
        user_id: volunteer.user_id,
        message: notificationMessage,
        type: 'invitation_received',
      });
    }

    return new Response(JSON.stringify({ success: true, message: 'Convite enviado com sucesso!' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Erro na função invite-to-department:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
