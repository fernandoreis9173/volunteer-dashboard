// supabase/functions/respond-to-invitation/index.ts
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
    // 1. Initialize clients and get authenticated user (the volunteer)
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase configuration is missing.');
    }
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: req.headers.get('Authorization')! } }
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error('Authentication failed.');

    // 2. Get request body
    const { invitationId, response } = await req.json();
    if (!invitationId || !response || !['aceito', 'recusado'].includes(response)) {
      throw new Error('Invitation ID and a valid response ("aceito" or "recusado") are required.');
    }

    // 3. Fetch invitation and verify ownership
    const { data: invitation, error: invError } = await supabaseAdmin
      .from('invitations')
      .select('*, volunteers!inner(id, user_id, name), departments(id, name)')
      .eq('id', invitationId)
      .eq('volunteers.user_id', user.id)
      .eq('status', 'pendente')
      .single();

    if (invError || !invitation) {
      throw new Error('Invitation not found, already actioned, or you do not have permission.');
    }
    
    // 4. Process based on response
    if (response === 'aceito') {
      const volunteer = Array.isArray(invitation.volunteers) ? invitation.volunteers[0] : invitation.volunteers;
      const department = Array.isArray(invitation.departments) ? invitation.departments[0] : invitation.departments;

      if (!volunteer || !department) {
        throw new Error('Could not retrieve volunteer or department details for this invitation.');
      }
      
      const { error: insertError } = await supabaseAdmin
          .from('volunteer_departments')
          .insert({
              volunteer_id: volunteer.id,
              department_id: department.id,
          });

      // We don't throw on duplicate error (code 23505), as it means they are already in the dept.
      if (insertError && insertError.code !== '23505') {
          console.error('Error adding volunteer to department:', insertError);
          throw new Error(`Failed to add to department: ${insertError.message}`);
      }
    }

    // 5. Update invitation status
    const { error: updateInvError } = await supabaseAdmin
      .from('invitations')
      .update({ status: response })
      .eq('id', invitationId);

    if (updateInvError) throw updateInvError;
    
    // 6. Notify the leader
    const volunteerName = (Array.isArray(invitation.volunteers) ? invitation.volunteers[0] : invitation.volunteers)?.name || 'Um voluntário';
    const departmentName = (Array.isArray(invitation.departments) ? invitation.departments[0] : invitation.departments)?.name || 'seu departamento';

    const leaderMessage = response === 'aceito'
      ? `${volunteerName} aceitou seu convite para o departamento ${departmentName}.`
      : `${volunteerName} recusou seu convite para o departamento ${departmentName}.`;

    await supabaseAdmin.from('notifications').insert({
        user_id: invitation.leader_id,
        message: leaderMessage,
        type: 'info'
    });

    return new Response(JSON.stringify({ success: true, message: `Invitation ${response}.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in respond-to-invitation function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});