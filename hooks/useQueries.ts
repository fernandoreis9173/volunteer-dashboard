import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { DetailedVolunteer, VolunteerSchedule, Invitation } from '../types';
import { User } from '@supabase/supabase-js';

// ============================================
// DEPARTMENTS HOOKS
// ============================================

export const useDepartments = () => {
    return useQuery({
        queryKey: ['departments'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('departments')
                .select('id, name')
                .order('name', { ascending: true });

            if (error) throw error;
            return data;
        },
        staleTime: 10 * 60 * 1000, // 10 minutos (dados raramente mudam)
        refetchOnWindowFocus: false, // Não refetch ao mudar de aba
    });
};

export const useActiveDepartments = () => {
    return useQuery({
        queryKey: ['departments', 'active'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('departments')
                .select('id, name')
                .eq('status', 'Ativo')
                .order('name', { ascending: true });

            if (error) throw error;
            return data;
        },
        staleTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false,
    });
};

// ============================================
// EVENTS HOOKS
// ============================================

interface UseEventsOptions {
    departmentId?: number | null;
    startDate?: string;
    status?: string;
    volunteerId?: number;
}

export const useEvents = (options: UseEventsOptions = {}) => {
    const { departmentId, startDate, status, volunteerId } = options;

    return useQuery({
        queryKey: ['events', { departmentId, startDate, status, volunteerId }],
        queryFn: async () => {
            let query = supabase
                .from('events')
                .select('*, event_departments(*, departments(*)), event_volunteers(*, volunteers(*))');

            if (departmentId) {
                query = query
                    .select('*, event_departments!inner(*, departments(*)), event_volunteers(*, volunteers(*))')
                    .eq('event_departments.department_id', departmentId);
            }

            if (startDate) {
                query = query.gte('date', startDate);
            }

            if (status) {
                query = query.eq('status', status);
            }

            if (volunteerId) {
                query = query
                    .select('*, event_departments(*, departments(*)), event_volunteers!inner(*, volunteers(*))')
                    .eq('event_volunteers.volunteer_id', volunteerId);
            }

            query = query.order('date', { ascending: true });

            const { data: events, error } = await query;

            if (error) throw error;

            // Enrich with avatars
            const userIds = new Set<string>();
            events?.forEach((event: any) => {
                event.event_volunteers?.forEach((ev: any) => {
                    if (ev.volunteers?.user_id) {
                        userIds.add(ev.volunteers.user_id);
                    }
                });
            });

            if (userIds.size > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, avatar_url')
                    .in('id', Array.from(userIds));

                const avatarMap = new Map();
                profiles?.forEach((p: any) => avatarMap.set(p.id, p.avatar_url));

                events?.forEach((event: any) => {
                    event.event_volunteers?.forEach((ev: any) => {
                        if (ev.volunteers?.user_id) {
                            ev.volunteers.avatar_url = avatarMap.get(ev.volunteers.user_id);
                        }
                    });
                });
            }

            return events;
        },
        staleTime: 10 * 60 * 1000, // 10 minutos (otimizado para scale)
        gcTime: 30 * 60 * 1000, // Garbage collection após 30 minutos
        refetchOnWindowFocus: false, // Não refetch ao mudar de aba
    });
};

export const useTodaysEvents = (userId: string, userRole: string, departmentId?: number | null, volunteerId?: number | null) => {
    const today = new Date().toISOString().split('T')[0];

    return useQuery({
        queryKey: ['events', 'today', userId, userRole, departmentId, volunteerId],
        queryFn: async () => {
            let query = supabase
                .from('events')
                .select('*, event_departments(*, departments(*)), event_volunteers(*, volunteers(*))')
                .eq('date', today)
                .eq('status', 'Confirmado');

            if ((userRole === 'leader' || userRole === 'lider') && departmentId) {
                query = query
                    .select('*, event_departments!inner(*, departments(*)), event_volunteers(*, volunteers(*))')
                    .eq('event_departments.department_id', departmentId);
            } else if (userRole === 'volunteer' && volunteerId) {
                query = query
                    .select('*, event_departments(*, departments(*)), event_volunteers!inner(*, volunteers(*))')
                    .eq('event_volunteers.volunteer_id', volunteerId);
            }

            const { data, error } = await query;

            if (error) throw error;
            return data;
        },
        staleTime: 5 * 60 * 1000, // 5 minutos
        gcTime: 15 * 60 * 1000, // Garbage collection após 15 minutos
        refetchOnWindowFocus: false, // Não refetch ao mudar de aba
        enabled: !!userId,
        // refetchInterval removido - usar Realtime para atualizações
    });
};

// ============================================
// VOLUNTEERS HOOKS
// ============================================

export const useVolunteers = (departmentId?: number | null) => {
    return useQuery({
        queryKey: ['volunteers', departmentId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('volunteers')
                .select('id, user_id, name, email, phone, initials, status, skills, availability, created_at, volunteer_departments(departments(id, name))')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        },
        staleTime: 10 * 60 * 1000, // 10 minutos
        refetchOnWindowFocus: false,
    });
};

export const useActiveVolunteers = () => {
    return useQuery({
        queryKey: ['volunteers', 'active'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('volunteers')
                .select('id, name, initials, volunteer_departments(departments(id, name))')
                .eq('status', 'Ativo');

            if (error) throw error;
            return data;
        },
        staleTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false,
    });
};

// ============================================
// NOTIFICATIONS HOOKS
// ============================================

export const useNotifications = (userId: string, limit = 15) => {
    return useQuery({
        queryKey: ['notifications', userId, limit],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return data;
        },
        staleTime: 2 * 60 * 1000, // 2 minutos (otimizado)
        refetchOnWindowFocus: false,
    });
};

export const useUnreadNotificationsCount = (userId: string) => {
    return useQuery({
        queryKey: ['notifications', 'unread', userId],
        queryFn: async () => {
            const { count, error } = await supabase
                .from('notifications')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .eq('is_read', false);

            if (error) throw error;
            return count ?? 0;
        },
        staleTime: 2 * 60 * 1000,
        refetchOnWindowFocus: false,
        enabled: !!userId, // Only run when userId is available
    });
};

// ============================================
// MUTATIONS
// ============================================

export const useMarkNotificationAsRead = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (notificationId: number) => {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('id', notificationId);

            if (error) throw error;
        },
        onSuccess: () => {
            // Invalidar cache de notificações para refetch
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });
};

export const useCreateEvent = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (eventData: any) => {
            const { data, error } = await supabase
                .from('events')
                .insert(eventData)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            // Invalidar cache de eventos para refetch
            queryClient.invalidateQueries({ queryKey: ['events'] });
        },
    });
};

export const useUpdateEvent = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, ...eventData }: any) => {
            const { data, error } = await supabase
                .from('events')
                .update(eventData)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['events'] });
        },
    });
};

export const useDeleteEvent = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (eventId: number) => {
            const { error } = await supabase
                .from('events')
                .delete()
                .eq('id', eventId);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['events'] });
        },
    });
};

// ============================================
// CRONOGRAMA (TIMELINES) HOOKS
// ============================================

export const useCronogramaModelos = () => {
    return useQuery({
        queryKey: ['cronograma_modelos'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('cronograma_modelos')
                .select('id, nome_modelo')
                .order('nome_modelo', { ascending: true });

            if (error) throw error;
            return data;
        },
        staleTime: 30 * 60 * 1000, // 30 minutos (raramente muda)
        refetchOnWindowFocus: false,
    });
};

export const useCronogramaModeloDetalhes = (ids: string[]) => {
    return useQuery({
        queryKey: ['cronograma_modelos', 'detalhes', ids],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('cronograma_modelos')
                .select('*, cronograma_itens(*)')
                .in('id', ids);

            if (error) throw error;
            return data;
        },
        enabled: ids.length > 0,
        staleTime: 30 * 60 * 1000,
        refetchOnWindowFocus: false,
    });
};

// ============================================
// UTILITY HOOKS
// ============================================

// Hook para invalidar cache manualmente
export const useInvalidateQueries = () => {
    const queryClient = useQueryClient();

    return {
        invalidateEvents: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
        invalidateDepartments: () => queryClient.invalidateQueries({ queryKey: ['departments'] }),
        invalidateVolunteers: () => queryClient.invalidateQueries({ queryKey: ['volunteers'] }),
        invalidateVolunteersPage: () => queryClient.invalidateQueries({ queryKey: ['volunteers_page'] }),
        invalidateDepartmentsPage: () => queryClient.invalidateQueries({ queryKey: ['departments_page'] }),
        invalidateRanking: () => queryClient.invalidateQueries({ queryKey: ['ranking_data'] }),
        invalidateTimelineTemplates: () => queryClient.invalidateQueries({ queryKey: ['timeline_templates'] }),
        invalidateFrequencyPage: () => queryClient.invalidateQueries({ queryKey: ['frequency_events'] }),
        invalidateNotifications: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
        invalidateAll: () => queryClient.invalidateQueries(),
    };
};

// ============================================
// ADMIN HOOKS
// ============================================

// Função auxiliar para fetch de usuários (compartilhada)
export const fetchAdminUsers = async () => {
    const { data, error: fetchError } = await supabase.functions.invoke('list-users');
    if (fetchError) throw fetchError;
    if (data && data.error) throw new Error(data.error);
    return data.users || [];
};

export const useAdminUsers = () => {
    return useQuery({
        queryKey: ['admin', 'users'],
        queryFn: fetchAdminUsers,
        staleTime: 5 * 60 * 1000, // 5 minutos
        gcTime: 15 * 60 * 1000,
        refetchOnWindowFocus: false,
    });
};

export const useLeaders = () => {
    return useQuery({
        queryKey: ['admin', 'users'], // Compartilha cache com useAdminUsers
        queryFn: fetchAdminUsers,
        select: (users: any[]) => {
            return users.filter((user) => {
                const role = user.user_metadata?.role;
                return (role === 'leader' || role === 'lider' || role === 'admin') && user.app_status === 'Ativo';
            });
        },
        staleTime: 5 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
        refetchOnWindowFocus: false,
    });
};

export const useAdminDashboardStats = () => {
    return useQuery({
        queryKey: ['admin', 'dashboard_stats'],
        queryFn: async () => {
            const [
                activeVolunteersCountRes,
                departmentsCountRes,
                activeLeadersRes,
            ] = await Promise.all([
                supabase.from('volunteers').select('*', { count: 'exact', head: true }).eq('status', 'Ativo'),
                supabase.from('departments').select('*', { count: 'exact', head: true }).eq('status', 'Ativo'),
                supabase.functions.invoke('list-users', { body: { context: 'dashboard' } }),
            ]);

            if (activeVolunteersCountRes.error) throw activeVolunteersCountRes.error;
            if (departmentsCountRes.error) throw departmentsCountRes.error;
            if (activeLeadersRes.error) throw activeLeadersRes.error;

            return {
                activeVolunteers: activeVolunteersCountRes.count ?? 0,
                departments: departmentsCountRes.count ?? 0,
                activeLeaders: activeLeadersRes.data?.users || [],
            };
        },
        staleTime: 5 * 60 * 1000, // 5 minutos
        refetchOnWindowFocus: false,
    });
};

export const useVolunteerDashboardData = (userId: string | undefined) => {
    return useQuery({
        queryKey: ['volunteer', 'dashboard', userId],
        queryFn: async () => {
            if (!userId) throw new Error("User ID is required");

            // 1. Fetch Volunteer Profile & Departments
            const { data: volProfile, error: volProfileError } = await supabase
                .from('volunteers')
                .select('id, name, departments:volunteer_departments(departments(id, name))')
                .eq('user_id', userId)
                .single();

            if (volProfileError) throw volProfileError;
            if (!volProfile) throw new Error("Perfil de voluntário não encontrado.");

            const volunteerId = volProfile.id;

            // 2. Fetch Data in Parallel
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayStr = today.toISOString().split('T')[0];

            const [scheduleRes, rawInvitationsRes, totalPresencesRes, totalScheduledRes, leadersRes] = await Promise.all([
                supabase
                    .from('event_volunteers')
                    .select(`
                        present,
                        department_id,
                        departments(name),
                        events(
                            id, name, date, start_time, end_time, status, local, location_iframe, observations,
                            cronograma_principal_id, cronograma_kids_id
                        )
                    `)
                    .eq('volunteer_id', volunteerId)
                    .gte('events.date', todayStr)
                    .eq('events.status', 'Confirmado')
                    .order('date', { foreignTable: 'events', ascending: true })
                    .order('start_time', { foreignTable: 'events', ascending: true }),

                supabase.from('invitations').select('id, created_at, user_id, departments(id, name)').eq('volunteer_id', volunteerId).eq('status', 'pendente'),

                supabase
                    .from('event_volunteers')
                    .select('events!inner(id)', { count: 'exact', head: true })
                    .eq('volunteer_id', volunteerId)
                    .eq('present', true)
                    .eq('events.status', 'Confirmado'),

                supabase
                    .from('event_volunteers')
                    .select('events!inner(id)', { count: 'exact', head: true })
                    .eq('volunteer_id', volunteerId)
                    .eq('events.status', 'Confirmado'),

                // Fetch leaders internally
                fetchAdminUsers(),
            ]);

            if (scheduleRes.error) throw scheduleRes.error;
            if (rawInvitationsRes.error) throw rawInvitationsRes.error;

            const leaders = leadersRes || [];

            // Process Invitations
            const rawInvitations = rawInvitationsRes.data || [];
            const leadersMap = new Map<string, string | null>();
            leaders.forEach((l: any) => leadersMap.set(l.id, l.user_metadata?.name || null));

            const invitations: Invitation[] = rawInvitations.map((inv: any) => ({
                id: inv.id,
                created_at: inv.created_at,
                departments: inv.departments,
                profiles: { name: inv.user_id ? leadersMap.get(inv.user_id) || 'Líder' : 'Líder' }
            }));

            // Process Profile
            const transformedDepartments = (volProfile.departments || []).map((d: any) => d.departments).filter(Boolean);
            const completeProfile = { ...volProfile, departments: transformedDepartments } as unknown as DetailedVolunteer;

            // Process Schedule
            const rawSchedule = scheduleRes.data || [];
            const relevantDeptIds = [...new Set(rawSchedule.map((item: any) => item.department_id))];

            const { data: deptLeaders } = await supabase
                .from('department_leaders')
                .select('department_id, user_id')
                .in('department_id', relevantDeptIds);

            const deptLeaderMap = new Map<number, string>();
            (deptLeaders || []).forEach((dl: any) => {
                const leaderUser = leaders.find((u: any) => u.id === dl.user_id);
                if (leaderUser) {
                    deptLeaderMap.set(dl.department_id, leaderUser.user_metadata?.name || 'Líder');
                }
            });

            const allMySchedules: VolunteerSchedule[] = rawSchedule
                .filter((item: any) => item.events)
                .map((item: any) => {
                    const evt = item.events;
                    return {
                        id: evt.id,
                        name: evt.name,
                        date: evt.date,
                        start_time: evt.start_time,
                        end_time: evt.end_time,
                        status: evt.status,
                        local: evt.local,
                        location_iframe: evt.location_iframe,
                        observations: evt.observations,
                        department_id: item.department_id,
                        department_name: item.departments?.name || 'Departamento',
                        leader_name: deptLeaderMap.get(item.department_id) || '',
                        present: item.present,
                        cronograma_principal_id: evt.cronograma_principal_id,
                        cronograma_kids_id: evt.cronograma_kids_id,
                    };
                });

            const todayEvents = allMySchedules.filter(e => e.date === todayStr);
            const upcomingEvents = allMySchedules.filter(e => e.date > todayStr);

            const stats = {
                upcoming: upcomingEvents.length,
                attended: totalPresencesRes.count ?? 0,
                totalScheduled: totalScheduledRes.count ?? 0,
                eventsToday: todayEvents.length,
            };

            return {
                volunteerProfile: completeProfile,
                todayEvents,
                upcomingEvents,
                invitations,
                stats
            };
        },
        enabled: !!userId,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });
};

export const useVolunteersPageData = (userRole: string | null, leaderDepartmentId: number | null) => {
    return useQuery({
        queryKey: ['volunteers_page', userRole, leaderDepartmentId],
        queryFn: async () => {
            const isLeader = userRole === 'leader' || userRole === 'lider';

            // 1. Build query for volunteers
            let query = supabase
                .from('volunteers')
                .select(`
                    id,
                    user_id,
                    name,
                    email,
                    phone,
                    initials,
                    status,
                    skills,
                    availability,
                    created_at,
                    volunteer_departments (
                        departments ( id, name )
                    )
                `);

            if (isLeader) {
                query = query.eq('status', 'Ativo');
            }

            // 2. Execute parallel fetches
            const [volunteersRes, profilesRes, invitesRes, deptNameRes] = await Promise.all([
                query.order('created_at', { ascending: false }),
                supabase.from('profiles').select('id, avatar_url, role'),
                (isLeader && leaderDepartmentId)
                    ? supabase.from('invitations').select('volunteer_id').eq('department_id', leaderDepartmentId).eq('status', 'pendente')
                    : Promise.resolve({ data: [], error: null }),
                (isLeader && leaderDepartmentId)
                    ? supabase.from('departments').select('name').eq('id', leaderDepartmentId).single()
                    : Promise.resolve({ data: null, error: null })
            ]);

            if (volunteersRes.error) throw volunteersRes.error;
            if (profilesRes.error) throw profilesRes.error;
            if (invitesRes.error) throw invitesRes.error;

            // 3. Process Data
            const avatarMap = new Map<string, string>();
            const roleMap = new Map<string, string>();

            (profilesRes.data || []).forEach((profile: any) => {
                if (profile.avatar_url) avatarMap.set(profile.id, profile.avatar_url);
                if (profile.role) roleMap.set(profile.id, profile.role);
            });

            const masterVolunteers = (volunteersRes.data || [])
                .map((volunteer: any) => {
                    const approvedDepartments = (volunteer.volunteer_departments || [])
                        .filter((relation: any) => relation.departments)
                        .flatMap((relation: any) => relation.departments);

                    return {
                        ...volunteer,
                        departments: approvedDepartments,
                        volunteer_departments: volunteer.volunteer_departments,
                        avatar_url: volunteer.user_id ? avatarMap.get(volunteer.user_id) : undefined
                    };
                })
                .filter((volunteer: any) => {
                    if (!volunteer.user_id) return true;
                    const userRole = roleMap.get(volunteer.user_id);
                    return userRole === 'volunteer';
                }) as DetailedVolunteer[];

            const pendingInvites = new Set((invitesRes.data || []).map((i: any) => i.volunteer_id));
            const leaderDepartmentName = deptNameRes.data?.name || null;

            return {
                masterVolunteers,
                pendingInvites,
                leaderDepartmentName
            };
        },
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });
};

export const useRankingData = () => {
    return useQuery({
        queryKey: ['ranking_data'],
        queryFn: async () => {
            const [volunteersRes, attendanceRes, departmentsRes] = await Promise.all([
                supabase.from('volunteers').select('id, user_id, name, initials, volunteer_departments(departments(id, name))').eq('status', 'Ativo'),
                supabase.from('event_volunteers').select('volunteer_id, present, events(date)'),
                supabase.from('departments').select('id, name').order('name')
            ]);

            if (volunteersRes.error) throw volunteersRes.error;
            if (attendanceRes.error) throw attendanceRes.error;
            if (departmentsRes.error) throw departmentsRes.error;

            const volunteers = volunteersRes.data || [];
            const userIds = volunteers.map((v: any) => v.user_id).filter(Boolean);

            let avatarMap = new Map<string, string>();
            if (userIds.length > 0) {
                const { data: profiles, error: profilesError } = await supabase
                    .from('profiles')
                    .select('id, avatar_url')
                    .in('id', userIds);

                if (profilesError) {
                    console.error("Error fetching avatars for ranking:", profilesError);
                } else if (profiles) {
                    profiles.forEach((p: any) => {
                        if (p.avatar_url) avatarMap.set(p.id, p.avatar_url);
                    });
                }
            }

            const enrichedVolunteers = volunteers.map((v: any) => ({
                ...v,
                avatar_url: v.user_id ? avatarMap.get(v.user_id) : undefined
            }));

            return {
                volunteers: enrichedVolunteers,
                attendance: attendanceRes.data || [],
                departments: departmentsRes.data || []
            };
        },
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });
};

export const useDepartmentsPageData = () => {
    return useQuery({
        queryKey: ['departments_page'],
        queryFn: async () => {
            // Step 1: Fetch all departments
            const { data: departmentsData, error: departmentsError } = await supabase
                .from('departments')
                .select('*')
                .order('name', { ascending: true });

            if (departmentsError) throw departmentsError;

            // Step 2: Fetch all leader relationships
            const { data: leadersData, error: leadersError } = await supabase
                .from('department_leaders')
                .select('department_id, user_id');

            if (leadersError) throw leadersError;

            return {
                departments: departmentsData || [],
                departmentLeaders: leadersData || []
            };
        },
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });
};

export const useTimelineTemplates = () => {
    return useQuery({
        queryKey: ['timeline_templates'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('cronograma_modelos')
                .select('*, cronograma_itens(*)')
                .order('nome_modelo', { ascending: true });

            if (error) throw error;
            return data || [];
        },
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });
};

export const useFrequencyPageData = () => {
    return useQuery({
        queryKey: ['frequency_events'],
        queryFn: async () => {
            const startOfYear = `${new Date().getFullYear()}-01-01`;

            const { data, error } = await supabase
                .from('events')
                .select('*, event_departments(department_id, departments(id, name)), event_volunteers(volunteer_id, department_id, present, volunteers(id, name))')
                .eq('status', 'Confirmado')
                .gte('date', startOfYear)
                .order('date', { ascending: false });

            if (error) throw error;
            return (data as any[]) || [];
        },
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });
};

export const useLeaderDashboardData = (departmentId: number | null) => {
    return useQuery({
        queryKey: ['leader', 'dashboard', departmentId],
        queryFn: async () => {
            if (!departmentId) throw new Error("Department ID is required");

            const currentYear = new Date().getFullYear();
            const startOfYear = `${currentYear}-01-01`;

            // Parallel fetching for maximum speed
            const [deptRes, volDeptRes, eventsRes] = await Promise.all([
                // 1. Department Name
                supabase
                    .from('departments')
                    .select('name')
                    .eq('id', departmentId)
                    .single(),

                // 2. Department Volunteers
                supabase.from('volunteer_departments')
                    .select('*, volunteers!inner(*, volunteer_departments(departments(id, name)))')
                    .eq('department_id', departmentId)
                    .eq('volunteers.status', 'Ativo'),

                // 3. Events (optimized query)
                supabase
                    .from('events')
                    .select('*, event_departments!inner(*, departments(*)), event_volunteers(*, volunteers(*))')
                    .eq('event_departments.department_id', departmentId)
                    .gte('date', startOfYear)
                    .order('date', { ascending: false }) // Most recent first
            ]);

            if (deptRes.error) throw deptRes.error;
            if (volDeptRes.error) throw volDeptRes.error;
            if (eventsRes.error) throw eventsRes.error;

            // Process Department Name
            const departmentName = deptRes.data.name;

            // Process Volunteers
            const leaderVolunteers = (volDeptRes.data || []).map((vd: any) => vd.volunteers).filter(Boolean);
            const departmentVolunteers = (leaderVolunteers || []).map((v: any) => ({
                ...v,
                departments: v.volunteer_departments.map((vd: any) => vd.departments).filter(Boolean)
            })) as DetailedVolunteer[];

            // Process Events
            // Fetch avatars for event volunteers
            const events = eventsRes.data || [];
            const userIds = new Set<string>();
            events.forEach((event: any) => {
                event.event_volunteers?.forEach((ev: any) => {
                    if (ev.volunteers?.user_id) {
                        userIds.add(ev.volunteers.user_id);
                    }
                });
            });

            if (userIds.size > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, avatar_url')
                    .in('id', Array.from(userIds));

                const avatarMap = new Map();
                profiles?.forEach((p: any) => avatarMap.set(p.id, p.avatar_url));

                events.forEach((event: any) => {
                    event.event_volunteers?.forEach((ev: any) => {
                        if (ev.volunteers?.user_id) {
                            ev.volunteers.avatar_url = avatarMap.get(ev.volunteers.user_id);
                        }
                    });
                });
            }

            // Calculate Stats & Chart Data
            const today = new Date();
            const todayStr = today.toLocaleDateString('en-CA');
            const next7Days = new Date(today);
            next7Days.setDate(today.getDate() + 7);
            const next7DaysStr = next7Days.toLocaleDateString('en-CA');
            const last30Days = new Date(today);
            last30Days.setDate(today.getDate() - 29);
            const last30DaysStr = last30Days.toLocaleDateString('en-CA');

            // Sort events for display (newest first is default from query, but we need specific sorts)
            const allDepartmentEvents = [...events].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            const todaySchedules = allDepartmentEvents.filter(e => e.date === todayStr);
            // Upcoming: future dates, closest first
            const upcomingSchedules = allDepartmentEvents
                .filter(e => e.date > todayStr && e.date <= next7DaysStr)
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .slice(0, 10);

            const chartEvents = allDepartmentEvents.filter(e => e.date >= last30DaysStr && e.date <= todayStr);
            const annualEvents = allDepartmentEvents.filter(e => e.date >= startOfYear);

            const departmentVolunteerIds = new Set(departmentVolunteers.map(v => v.id));

            const annualAttendanceCount = annualEvents.reduce((count, event) => {
                return count + (event.event_volunteers || []).filter((v: any) => departmentVolunteerIds.has(v.volunteer_id) && v.present).length;
            }, 0);

            const stats = {
                activeVolunteers: { value: String(departmentVolunteers.length), change: 0 },
                departments: { value: '1', change: 0 },
                schedulesToday: { value: String(todaySchedules.length), change: 0 },
                upcomingSchedules: { value: String(allDepartmentEvents.filter(e => e.date > todayStr && e.date <= next7DaysStr).length), change: 0 },
                annualAttendance: { value: String(annualAttendanceCount), change: 0 },
            };

            // Chart Data
            const chartDataMap = new Map<string, { scheduledVolunteers: number; involvedDepartments: Set<number>; eventNames: string[] }>();
            for (const event of chartEvents) {
                const date = event.date;
                if (!chartDataMap.has(date)) {
                    chartDataMap.set(date, { scheduledVolunteers: 0, involvedDepartments: new Set(), eventNames: [] });
                }
                const entry = chartDataMap.get(date)!;
                const scheduledInDept = (event.event_volunteers || []).filter((v: any) => Number(v.department_id) === Number(departmentId)).length;
                entry.scheduledVolunteers += scheduledInDept;
                entry.involvedDepartments.add(departmentId);
                entry.eventNames.push(event.name);
            }

            const chartData = [];
            for (let i = 0; i < 30; i++) {
                const day = new Date(last30Days);
                day.setDate(last30Days.getDate() + i);
                const dateStr = day.toISOString().split('T')[0];
                const dataForDay = chartDataMap.get(dateStr);
                chartData.push({
                    date: dateStr,
                    scheduledVolunteers: dataForDay?.scheduledVolunteers || 0,
                    involvedDepartments: dataForDay?.involvedDepartments.size || 0,
                    eventNames: dataForDay?.eventNames || [],
                });
            }

            return {
                departmentName,
                departmentVolunteers,
                stats,
                todaySchedules,
                upcomingSchedules,
                chartData,
                activeLeaders: [], // Leaders don't see active leaders feed usually, or it's separate
                allEvents: allDepartmentEvents
            };
        },
        enabled: !!departmentId,
        staleTime: 5 * 60 * 1000, // 5 minutes cache
        refetchOnWindowFocus: false,
    });
};
