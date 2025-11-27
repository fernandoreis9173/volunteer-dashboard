// supabase/functions/request-shift-swap/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2.44.4';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    console.log("Request received");
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const userClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: {
        headers: {
          Authorization: req.headers.get('Authorization')!
        }
      }
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      console.error("Auth error:", authError);
      throw new Error('Authentication failed.');
    }
    console.log("User authenticated:", user.id);

    const body = await req.json();
    console.log("Request body:", body);
    const { eventId, departmentId, reason } = body;

    if (!eventId || !departmentId) throw new Error('Event ID and Department ID are required.');

    // 1. Get volunteer profile
    const { data: volunteer, error: volError } = await supabaseAdmin.from('volunteers').select('id, name').eq('user_id', user.id).single();
    if (volError || !volunteer) {
      console.error("Volunteer profile error:", volError);
      throw new Error('Volunteer profile not found.');
    }
    console.log("Volunteer found:", volunteer.id);

    // 2. Verify the volunteer is scheduled for this event AND department
    const { data: eventVolunteer, error: evError } = await supabaseAdmin.from('event_volunteers')
      .select('id')
      .eq('event_id', eventId)
      .eq('volunteer_id', volunteer.id)
      .eq('department_id', departmentId)
      .single();

    if (evError || !eventVolunteer) {
      console.error("Event volunteer verification failed:", evError);
      throw new Error('You are not scheduled for this event in the specified department.');
    }
    console.log("Event volunteer verified");

    // 3. Check for existing pending request
    const { data: existingRequest, error: checkError } = await supabaseAdmin.from('shift_swap_requests')
      .select('id')
      .eq('requesting_volunteer_id', volunteer.id)
      .eq('event_id', eventId)
      .eq('department_id', departmentId)
      .eq('status', 'pendente')
      .maybeSingle();

    if (checkError) {
      console.error("Check existing request error:", checkError);
      throw checkError;
    }
    if (existingRequest) throw new Error('You already have a pending swap request for this shift.');

    // 4. Create the swap request
    console.log("Inserting swap request...");
    const { error: insertError } = await supabaseAdmin.from('shift_swap_requests').insert({
      requesting_volunteer_id: volunteer.id,
      event_id: eventId,
      department_id: departmentId,
      reason_for_swap: reason
    });

    if (insertError) {
      console.error("Insert swap request error:", insertError);
      throw insertError;
    }
    console.log("Swap request inserted");

    // 5. Find the leader and notify them
    const { data: leaderRel, error: leaderError } = await supabaseAdmin.from('department_leaders')
      .select('user_id')
      .eq('department_id', departmentId)
      .limit(1)
      .maybeSingle();

    if (leaderError) {
      console.warn(`Error fetching leader for department ${departmentId}:`, leaderError.message);
    }

    const leaderId = leaderRel?.user_id;

    if (leaderId) {
      const { data: eventData } = await supabaseAdmin.from('events').select('name').eq('id', eventId).single();
      const eventName = eventData?.name || 'um evento';
      const message = `${volunteer.name} solicitou uma troca de escala para o evento "${eventName}". Por favor, encontre um substituto.`;

      console.log("Notifying leader:", leaderId);
      const { error: notifError } = await supabaseAdmin.from('notifications').insert({
        user_id: leaderId,
        message: message,
        type: 'shift_swap_request',
        related_event_id: eventId
      });
      if (notifError) {
        console.error("Notification insert error:", notifError);
      }
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
      error: error.message || 'An internal error occurred',
      details: error
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
