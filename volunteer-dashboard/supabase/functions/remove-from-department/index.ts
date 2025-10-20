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
    const { data: leaderProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('department_id')
      .eq('id', user.id)
      .single();
    if (profileError || !leaderProfile || !leaderProfile.department_id) {
      throw new Error('Could not find a department associated with this leader.');
    }
    const leaderDepartmentId = leaderProfile.department_id;

    // 3. Get volunteer ID from request and fetch volunteer data
    const { volunteerId } = await req.json();
    if (!volunteerId) throw new Error('Volunteer ID is required.');
    
    const { data: volunteer, error: volunteerError } = await supabaseAdmin
      .from('volunteers')
      .select('id, user_id, name, departaments')
      .eq('id', volunteerId)
      .single();
    
    if (volunteerError) throw volunteerError;
    if (!volunteer) throw new Error('Volunteer not found.');
    
    // 4. Fetch department name
    const { data: department, error: deptError } = await supabaseAdmin
        .from('departments')
        .select('name')
        .eq('id', leaderDepartmentId)
        .single();
    if(deptError || !department) throw new Error('Could not find the leader\'s department name.');
    const departmentNameToRemove = department.name;

    // 5. Check if volunteer is actually in the department
    const currentDepartments = Array.isArray(volunteer.departaments) ? volunteer.departaments : [];
    if(!currentDepartments.includes(departmentNameToRemove)) {
        throw new Error(`This volunteer is not in your department.`);
    }

    // 6. Remove the department and update the volunteer record
    const updatedDepartments = currentDepartments.filter(dept => dept !== departmentNameToRemove);
    const { error: updateError } = await supabaseAdmin
        .from('volunteers')
        .update({ departaments: updatedDepartments })
        .eq('id', volunteer.id);

    if (updateError) throw updateError;

    // 7. Create a notification for the volunteer
    if (volunteer.user_id) {
      await supabaseAdmin.from('notifications').insert({
        user_id: volunteer.user_id,
        message: `Você foi removido(a) do departamento "${departmentNameToRemove}".`,
        type: 'info'
      });
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