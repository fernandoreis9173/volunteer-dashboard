import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

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

            const { data, error } = await query;

            if (error) throw error;
            return data;
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

            if (userRole === 'leader' && departmentId) {
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
        invalidateNotifications: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
        invalidateAll: () => queryClient.invalidateQueries(),
    };
};
