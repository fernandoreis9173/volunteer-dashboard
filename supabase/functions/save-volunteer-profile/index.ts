// supabase/functions/save-volunteer-profile/index.ts
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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // User client is needed to securely get the user ID from the token
    const userClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error('Authentication failed.');

    const { volunteerData, departmentIds } = await req.json();
    if (!volunteerData) {
      throw new Error('`volunteerData` is required.');
    }
    if (!Array.isArray(departmentIds)) {
        throw new Error('`departmentIds` must be an array of numbers.');
    }

    // 1. Prepare the final payload for the 'volunteers' table, ensuring user_id is from the token
    const finalVolunteerData = {
        ...volunteerData,
        user_id: user.id, // Overwrite user_id with the one from the JWT for security
    };
    
    // Remove properties that are not columns in the 'volunteers' table
    delete finalVolunteerData.departments;
    delete finalVolunteerData.volunteer_departments; // Clean up relation if it exists

    // 2. Upsert the main volunteer profile
    const { data: savedVolunteer, error: upsertError } = await supabaseAdmin
        .from('volunteers')
        .upsert(finalVolunteerData, { onConflict: 'user_id' })
        .select('id')
        .single();
    
    if (upsertError) throw upsertError;
    if (!savedVolunteer) throw new Error("Failed to save volunteer profile.");
    
    const volunteerId = savedVolunteer.id;
    
    // 3. Sync departments in the junction table
    // 3a. Delete all existing associations for this volunteer
    const { error: deleteError } = await supabaseAdmin
        .from('volunteer_departments')
        .delete()
        .eq('volunteer_id', volunteerId);

    if (deleteError) {
        console.error(`Failed to clear old departments for volunteer ${volunteerId}:`, deleteError);
        throw new Error(`Failed to update departments: ${deleteError.message}`);
    }

    // 3b. Insert new associations if any are provided
    if (departmentIds.length > 0) {
        const newAssociations = departmentIds.map(deptId => ({
            volunteer_id: volunteerId,
            department_id: deptId,
        }));

        const { error: insertError } = await supabaseAdmin
            .from('volunteer_departments')
            .insert(newAssociations);
        
        if (insertError) {
            console.error(`Failed to insert new departments for volunteer ${volunteerId}:`, insertError);
            throw new Error(`Failed to save new department associations: ${insertError.message}`);
        }
    }
    
    return new Response(JSON.stringify({ success: true, volunteerId: volunteerId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in save-volunteer-profile function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
