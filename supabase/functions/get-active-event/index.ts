// supabase/functions/get-active-event/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2.44.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

declare const Deno: any;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Supabase configuration is missing.');
    }
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Get current time details, assuming a UTC-3 (Brasilia) timezone for comparison
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const currentTime = `${hours}:${minutes}:${seconds}`;

    // Query for the active event using admin client to bypass RLS
    const { data: eventData, error: eventError } = await supabaseAdmin
      .from('events')
      .select(`
        id, name, date, start_time, end_time, status, local, observations, color,
        event_departments (
            department_id,
            departments (id, name)
        ),
        event_volunteers (
            volunteer_id,
            department_id,
            present,
            volunteers (id, name, initials)
        )
      `)
      .eq('date', today)
      .lte('start_time', currentTime)
      .gt('end_time', currentTime)
      .eq('status', 'Confirmado')
      .limit(1)
      .maybeSingle();

    if (eventError) throw eventError;
    if (!eventData) {
        return new Response(JSON.stringify({ activeEvent: null }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }

    // Enrich event with leader names
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (authError) throw authError;

    const leaders = (authData?.users || []).filter(user => {
        const role = user.user_metadata?.role;
        return (role === 'leader' || role === 'lider' || role === 'admin');
    });

    const { data: deptLeaders, error: deptLeadersError } = await supabaseAdmin.from('department_leaders').select('department_id, leader_id');
    if (deptLeadersError) throw deptLeadersError;
    
    const leaderMap = new Map(leaders.map(l => [l.id, l.user_metadata?.name]));

    const enrichedEventDepartments = (eventData.event_departments as any[]).map((ed: any) => {
        if (ed.departments?.id) {
            const leadersForDept = (deptLeaders || [])
                .filter(dl => dl.department_id === ed.departments.id)
                .map(dl => leaderMap.get(dl.leader_id))
                .filter(Boolean);

            return {
                ...ed,
                departments: {
                    ...ed.departments,
                    leader: leadersForDept.join(', ') || 'N/A'
                }
            };
        }
        return ed;
    });

    const enrichedEventData = {
        ...eventData,
        event_departments: enrichedEventDepartments
    };

    return new Response(JSON.stringify({ activeEvent: enrichedEventData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in get-active-event function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred in the function.';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});