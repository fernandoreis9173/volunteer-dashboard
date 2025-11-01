// supabase/functions/get-events/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2.44.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
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
    
    // Auth client to get current user to determine their role and department
    const userClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error('Authentication failed.');

    const userRole = user.user_metadata?.role;
    const isLeader = userRole === 'leader' || userRole === 'lider';

    let leaderDepartmentId: number | null = null;
    if (isLeader) {
      const { data: leaderDept } = await supabaseAdmin
        .from('department_leaders')
        .select('department_id')
        .eq('leader_id', user.id)
        .single();
      if (leaderDept) {
        leaderDepartmentId = leaderDept.department_id;
      }
    }
    
    const baseSelect = `
        id, name, date, start_time, end_time, local, status, observations, color,
        event_departments(
            department_id,
            departments (id, name)
        ),
        event_volunteers(
            volunteer_id, department_id, present,
            volunteers (id, user_id, name, email, initials)
        )
    `;

    let query;
    if (isLeader && leaderDepartmentId) {
        query = supabaseAdmin
            .from('events')
            .select(baseSelect.replace('event_departments(', 'event_departments!inner('))
            .eq('event_departments.department_id', leaderDepartmentId);
    } else { // Admin
        query = supabaseAdmin
            .from('events')
            .select(baseSelect);
    }
    
    const { data: eventsData, error: fetchError } = await query
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

    if (fetchError) throw fetchError;
    if (!eventsData) {
      return new Response(JSON.stringify({ events: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Now, enrich with leader names
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (authError) throw authError;

    const leaders = (authData?.users || []).filter(u => u.user_metadata?.role === 'leader' || u.user_metadata?.role === 'lider' || u.user_metadata?.role === 'admin');
    const leaderMap = new Map(leaders.map(l => [l.id, l.user_metadata?.name]));

    const { data: deptLeadersRes, error: deptLeadersError } = await supabaseAdmin
        .from('department_leaders')
        .select('department_id, leader_id');
    if (deptLeadersError) throw deptLeadersError;
    
    const enrichedEvents = eventsData.map(event => {
        const enrichedDepts = (event.event_departments as any[]).map((ed: any) => {
            const leadersForDept = (deptLeadersRes || [])
                ?.filter(dl => dl.department_id === ed.department_id)
                .map(dl => leaderMap.get(dl.leader_id))
                .filter(Boolean);
            
            return { 
                ...ed, 
                departments: { 
                    ...ed.departments, 
                    leader: leadersForDept?.join(', ') || 'N/A' 
                }
            };
        });

        return {
            ...event,
            event_departments: enrichedDepts,
        };
    });

    return new Response(JSON.stringify({ events: enrichedEvents }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error in get-events function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});