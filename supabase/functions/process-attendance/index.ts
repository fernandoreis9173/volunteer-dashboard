// supabase/functions/process-attendance/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2.44.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

declare const Deno: any;

// This function is designed to be triggered by a Supabase Cron Job.
// It finds events that have ended but still have unconfirmed volunteers,
// marks those volunteers as absent, and notifies relevant leaders and admins.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Step 1: Find all distinct event IDs that have at least one volunteer with attendance not marked.
    const { data: unprocessedAttendances, error: unprocessedError } = await supabaseAdmin
      .from('event_volunteers')
      .select('event_id')
      .is('present', null);

    if (unprocessedError) throw unprocessedError;

    if (!unprocessedAttendances || unprocessedAttendances.length === 0) {
      return new Response(JSON.stringify({ message: 'No unprocessed attendances found. Nothing to do.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }
    const unprocessedEventIds = [...new Set(unprocessedAttendances.map(a => a.event_id))];

    // Step 2: From that list, get the details of the events that are confirmed.
    const { data: eventsToCheck, error: eventsError } = await supabaseAdmin
      .from('events')
      .select('id, date, end_time')
      .in('id', unprocessedEventIds)
      .eq('status', 'Confirmado');

    if (eventsError) throw eventsError;

    // Step 3: Filter this list in memory to find events that have actually ended.
    // This is more robust than a narrow time window.
    const nowUTC = new Date();
    const endedEventIds = eventsToCheck
      .filter(event => {
        // Construct a timezone-aware date string assuming stored time is UTC-3 (Brazil time)
        const endDateTimeLocalString = `${event.date}T${event.end_time}-03:00`;
        const eventEndUTC = new Date(endDateTimeLocalString);
        // Check if the event's end time is in the past
        return eventEndUTC < nowUTC;
      })
      .map(event => event.id);

    if (endedEventIds.length === 0) {
      return new Response(JSON.stringify({ message: 'No ended events with unprocessed attendance found.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Step 4: Update attendance for volunteers in the identified ended events.
    const { data: updatedAttendances, error: updateError } = await supabaseAdmin
      .from('event_volunteers')
      .update({ present: false })
      .in('event_id', endedEventIds)
      .is('present', null)
      .select('event_id, volunteer_id');

    if (updateError) throw updateError;

    // Step 5: Prepare and send summary notifications to leaders and admins.
    let notificationsToInsert: any[] = [];
    if (updatedAttendances && updatedAttendances.length > 0) {
      const absenteesByEvent = new Map<number, { count: number }>();
      for (const attendance of updatedAttendances) {
        const entry = absenteesByEvent.get(attendance.event_id) || { count: 0 };
        entry.count++;
        absenteesByEvent.set(attendance.event_id, entry);
      }

      const eventIdsWithAbsentees = Array.from(absenteesByEvent.keys());
      const { data: eventDetails, error: eventDetailsError } = await supabaseAdmin
        .from('events')
        .select('id, name')
        .in('id', eventIdsWithAbsentees);
      if (eventDetailsError) throw eventDetailsError;

      const eventIdToNameMap = new Map(eventDetails.map(e => [e.id, e.name]));

      const { data: admins, error: adminError } = await supabaseAdmin.from('profiles').select('id').eq('role', 'admin');
      if (adminError) console.error("Could not fetch admins for notifications:", adminError);
      const adminIds = admins?.map(a => a.id) || [];

      for (const [eventId, { count }] of absenteesByEvent.entries()) {
        const eventName = eventIdToNameMap.get(eventId) || 'Evento Desconhecido';
        const message = `A frequência para "${eventName}" foi processada. ${count} voluntário(s) receberam falta.`;

        const { data: eventDepts, error: deptsError } = await supabaseAdmin.from('event_departments').select('department_id').eq('event_id', eventId);
        if (deptsError) {
          console.error(`Could not fetch departments for event ${eventId}:`, deptsError);
          continue;
        }

        const departmentIds = eventDepts.map(d => d.department_id);
        const userIdsToNotify = new Set<string>([...adminIds]);

        if (departmentIds.length > 0) {
          // FIX: Query the correct table `department_leaders` to find leaders by `department_id`.
          const { data: leaders, error: leadersError } = await supabaseAdmin
            .from('department_leaders')
            .select('user_id')
            .in('department_id', departmentIds);

          if (leadersError) {
            console.error(`Could not fetch leaders for event ${eventId}:`, leadersError);
          } else if (leaders) {
            // FIX: Use `leader_id` from the correct query result.
            leaders.forEach(l => userIdsToNotify.add(l.user_id));
          }
        }

        for (const userId of userIdsToNotify) {
          notificationsToInsert.push({ user_id: userId, message, type: 'info', related_event_id: eventId });
        }
      }

      if (notificationsToInsert.length > 0) {
        const { error: notificationError } = await supabaseAdmin.from('notifications').insert(notificationsToInsert);
        if (notificationError) {
          console.error("Failed to insert attendance summary notifications:", notificationError);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Processed ${endedEventIds.length} event(s). Marked ${updatedAttendances?.length || 0} volunteer(s) as absent. Sent ${notificationsToInsert.length} summary notifications.`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in process-attendance function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});