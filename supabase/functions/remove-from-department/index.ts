// supabase/functions/remove-from-department/index.ts
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
      throw new Error('Supabase configuration is missing.');
    }
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: req.headers.get('Authorization')! } }
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error('Authentication failed.');

    // 2. Get leader's department
    const { data: leaderDept, error: profileError } = await supabaseAdmin
      .from('department_leaders')
      .select('department_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !leaderDept || !leaderDept.department_id) {
      throw new Error('Could not find a department associated with this leader.');
    }
    const leaderDepartmentId = leaderDept.department_id;

    // 3. Get volunteer ID from request
    const { volunteerId } = await req.json();
    if (!volunteerId) throw new Error('Volunteer ID is required.');

    // 4. Delete the association from the junction table
    const { error: deleteError } = await supabaseAdmin
      .from('volunteer_departments')
      .delete()
      .match({
        volunteer_id: volunteerId,
        department_id: leaderDepartmentId,
      });

    if (deleteError) throw deleteError;

    // 5. Create a notification for the volunteer
    const { data: volunteer, error: volError } = await supabaseAdmin
      .from('volunteers')
      .select('user_id')
      .eq('id', volunteerId)
      .single();

    if (volError) {
      console.warn(`Could not fetch volunteer for notification: ${volError.message}`);
    } else if (volunteer && volunteer.user_id) {
      const { data: department, error: deptError } = await supabaseAdmin
        .from('departments')
        .select('name')
        .eq('id', leaderDepartmentId)
        .single();

      if (deptError || !department) {
        console.warn(`Could not fetch department name for notification.`);
      } else {
        await supabaseAdmin.from('notifications').insert({
          user_id: volunteer.user_id,
          message: `Você foi removido(a) do departamento "${department.name}".`,
          type: 'info'
        });
      }
    }

    return new Response(JSON.stringify({ success: true, message: 'Voluntário removido com sucesso!' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error in remove-from-department function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});