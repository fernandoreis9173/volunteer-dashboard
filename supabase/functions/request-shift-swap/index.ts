// supabase/functions/request-shift-swap/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2.44.4';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const userClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        );

        // 1. Auth Check
        const { data: { user }, error: authError } = await userClient.auth.getUser();
        if (authError || !user) throw new Error('Authentication failed.');

        const { eventId, departmentId, reason } = await req.json();
        if (!eventId || !departmentId) throw new Error('Event ID and Department ID are required.');

        // 2. Get Volunteer Info
        const { data: volunteer, error: volError } = await supabaseAdmin
            .from('volunteers')
            .select('id, name')
            .eq('user_id', user.id)
            .single();

        if (volError || !volunteer) throw new Error('Volunteer profile not found.');

        // 3. Mark as Swap Requested in event_volunteers
        // This serves as our "state" without needing a separate table
        const { error: updateError } = await supabaseAdmin
            .from('event_volunteers')
            .update({ swap_requested: true })
            .match({
                event_id: eventId,
                volunteer_id: volunteer.id,
                department_id: departmentId
            });

        if (updateError) {
            console.error("Error updating event_volunteers:", updateError);
            throw new Error('Failed to update schedule status.');
        }

        // 4. Find Leader
        const { data: leaderRel, error: leaderError } = await supabaseAdmin
            .from('department_leaders')
            .select('user_id')
            .eq('department_id', departmentId)
            .limit(1)
            .maybeSingle();

        if (leaderRel?.user_id) {
            // 5. Send Notification
            const { data: eventData } = await supabaseAdmin.from('events').select('name').eq('id', eventId).single();
            const eventName = eventData?.name || 'um evento';

            const message = `${volunteer.name} solicitou troca para "${eventName}". Motivo: ${reason}`;

            await supabaseAdmin.from('notifications').insert({
                user_id: leaderRel.user_id,
                message: message,
                type: 'shift_swap_request',
                related_event_id: eventId,
                data: { reason, volunteer_id: volunteer.id } // Store extra data if needed
            });
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (error) {
        console.error('Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
        });
    }
});
