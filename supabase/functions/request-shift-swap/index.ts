// supabase/functions/request-shift-swap/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2.44.4';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const userClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: {
        headers: {
          Authorization: req.headers.get('Authorization')
        }
      }
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error('Authentication failed.');
    const { eventId, reason } = await req.json();
    if (!eventId) throw new Error('Event ID is required.');
    // 1. Get volunteer profile
    const { data: volunteer, error: volError } = await supabaseAdmin.from('volunteers').select('id, name').eq('user_id', user.id).single();
    if (volError || !volunteer) throw new Error('Volunteer profile not found.');
    // 2. Find the specific event-volunteer record to get the department
    const { data: eventVolunteer, error: evError } = await supabaseAdmin.from('event_volunteers').select('department_id').match({
      event_id: eventId,
      volunteer_id: volunteer.id
    }).single();
    if (evError || !eventVolunteer) throw new Error('You are not scheduled for this event in any department.');
    const departmentId = eventVolunteer.department_id;
    // 3. Check for existing pending request
    const { data: existingRequest, error: checkError } = await supabaseAdmin.from('shift_swap_requests').select('id').match({
      requesting_volunteer_id: volunteer.id,
      event_id: eventId,
      department_id: departmentId,
      status: 'pendente'
    }).maybeSingle();
    if (checkError) throw checkError;
    if (existingRequest) throw new Error('You already have a pending swap request for this shift.');
    // 4. Create the swap request
    const { error: insertError } = await supabaseAdmin.from('shift_swap_requests').insert({
      requesting_volunteer_id: volunteer.id,
      event_id: eventId,
      department_id: departmentId,
      reason_for_swap: reason
    });
    if (insertError) throw insertError;
    // 5. Find the leader and notify them
    const { data: leaderRel, error: leaderError } = await supabaseAdmin.from('department_leaders').select('leader_id').eq('department_id', departmentId).limit(1).maybeSingle();
    if (leaderError) {
      console.warn(`Error fetching leader for department ${departmentId}:`, leaderError.message);
    }
    const leaderId = leaderRel?.leader_id;
    if (leaderId) {
      const { data: eventData } = await supabaseAdmin.from('events').select('name').eq('id', eventId).single();
      const eventName = eventData?.name || 'um evento';
      const message = `${volunteer.name} solicitou uma troca de escala para o evento "${eventName}". Por favor, encontre um substituto.`;
      await supabaseAdmin.from('notifications').insert({
        user_id: leaderId,
        message: message,
        type: 'shift_swap_request',
        related_event_id: eventId
      });
    } else {
      console.warn(`Could not find a leader for department ${departmentId} to notify.`);
    }
    return new Response(JSON.stringify({
      success: true
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('Error in request-shift-swap function:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
