import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DetailedVolunteer, DashboardEvent, Page, Event as VolunteerEvent, Invitation, VolunteerSchedule } from '../types';
import { supabase } from '../lib/supabaseClient';
// FIX: Restored Supabase v2 types for type safety.
import { type Session, type User } from '@supabase/supabase-js';
import { getErrorMessage, convertUTCToLocal } from '../lib/utils';
import LiveEventDetailsModal from './LiveEventDetailsModal';
import QRCodeDisplayModal from './QRCodeDisplayModal';
import RequestSwapModal from './RequestSwapModal';
import VolunteerStatCard from './VolunteerStatCard';
import EventTimelineViewerModal from './EventTimelineViewerModal';

interface LiveEventTimerProps {
  event: VolunteerEvent;
  onShowDetails: () => void;
}

const LiveEventTimer: React.FC<LiveEventTimerProps> = ({ event, onShowDetails }) => {
    const handleClick = () => {
        onShowDetails();
    };

    return (
        <div className="block md:inline-block bg-red-50 border border-red-200 rounded-lg p-4 dark:bg-red-900/20 dark:border-red-800/30" aria-label="Um evento está ao vivo">
            <div className="flex justify-between md:justify-start items-center gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-3 w-3 relative flex-shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                    <div className="min-w-0">
                        <h3 className="text-base font-semibold text-red-800 dark:text-red-300">Estamos Ao Vivo</h3>
                        <p className="text-sm text-red-700 dark:text-red-400 truncate" title={event.name}>{event.name}</p>
                    </div>
                </div>
                 <button onClick={handleClick} className="p-2 text-red-600 hover:text-red-800 bg-red-100 hover:bg-red-200 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-400 flex-shrink-0 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50" aria-label="Ver detalhes do evento">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </button>
            </div>
        </div>
    );
};


interface VolunteerDashboardProps {
  session: Session | null;
  activeEvent: VolunteerEvent | null;
  onNavigate: (page: Page) => void;
  leaders: User[];
}

const getShortName = (fullName?: string | null): string => {
    if (!fullName) return 'Voluntário';
    const nameParts = fullName.trim().split(/\s+/);
    return nameParts[0] || 'Voluntário';
};

const GenericDepartmentIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
    </svg>
);

const departmentIcons: { [key: string]: React.ReactElement } = {
    default: GenericDepartmentIcon,
};

const getDepartmentIcon = (deptName: string | undefined) => {
    return departmentIcons['default'];
};


const VolunteerDashboard: React.FC<VolunteerDashboardProps> = ({ session, activeEvent, onNavigate, leaders }) => {
    const [volunteerProfile, setVolunteerProfile] = useState<DetailedVolunteer | null>(null);
    const [todayEvents, setTodayEvents] = useState<VolunteerSchedule[]>([]);
    const [upcomingEvents, setUpcomingEvents] = useState<VolunteerSchedule[]>([]);
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [stats, setStats] = useState({ upcoming: 0, attended: 0, totalScheduled: 0, eventsToday: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isQrModalOpen, setIsQrModalOpen] = useState(false);
    const [qrCodeData, setQrCodeData] = useState<object | null>(null);
    const [qrCodeEvent, setQrCodeEvent] = useState<VolunteerSchedule | null>(null);
    
    const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
    const [swapRequestEvent, setSwapRequestEvent] = useState<VolunteerSchedule | null>(null);
    const [isSubmittingSwap, setIsSubmittingSwap] = useState(false);
    const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
    const [viewingTimelineFor, setViewingTimelineFor] = useState<VolunteerSchedule | null>(null);

    const userId = session?.user?.id;
    
    const showNotification = useCallback((message: string, type: 'success' | 'error') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 5000);
    }, []);

    const fetchDashboardData = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        setError(null);
    
        try {
            // 1. Fetch Volunteer Profile & Departments
            const { data: volProfile, error: volProfileError } = await supabase
                .from('volunteers')
                .select('id, name, departments:volunteer_departments(departments(id, name))')
                .eq('user_id', userId)
                .single();
    
            if (volProfileError) throw volProfileError;
            if (!volProfile) throw new Error("Perfil de voluntário não encontrado.");
            
            const volunteerId = volProfile.id;

            // 2. Fetch Data in Parallel: Direct Schedule Query (Optimized) + Invitations
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayStr = today.toISOString().split('T')[0];

            // Replaced `get_my_schedule` RPC with a direct, filtered join.
            const [scheduleRes, rawInvitationsRes] = await Promise.all([
                supabase
                    .from('event_volunteers')
                    .select(`
                        present,
                        department_id,
                        departments(name),
                        events(
                            id, name, date, start_time, end_time, status, local, observations,
                            cronograma_principal_id, cronograma_kids_id,
                            event_departments(departments(leader:leader_name_hint)) 
                        )
                    `) // Note: leader_name_hint is hypothetical or needs lookup. Standard approach below.
                    .eq('volunteer_id', volunteerId)
                    .gte('events.date', todayStr) // Fetch only today and future
                    .eq('events.status', 'Confirmado')
                    .order('date', { foreignTable: 'events', ascending: true })
                    .order('start_time', { foreignTable: 'events', ascending: true }),
                
                supabase.from('invitations').select('id, created_at, leader_id, departments(id, name)').eq('volunteer_id', volunteerId).eq('status', 'pendente'),
            ]);
    
            if (scheduleRes.error) throw scheduleRes.error;
            if (rawInvitationsRes.error) throw rawInvitationsRes.error;

            // --- Process Invitations ---
            const rawInvitations = rawInvitationsRes.data || [];
            if (rawInvitations.length > 0) {
                const leadersMap = new Map<string, string | null>();
                leaders.forEach(l => leadersMap.set(l.id, l.user_metadata?.name || null));
    
                const enrichedInvitations: Invitation[] = rawInvitations.map((inv: any) => ({
                    id: inv.id,
                    created_at: inv.created_at,
                    departments: inv.departments,
                    profiles: { name: inv.leader_id ? leadersMap.get(inv.leader_id) || 'Líder' : 'Líder' }
                }));
                setInvitations(enrichedInvitations);
            } else {
                setInvitations([]);
            }
            
            // --- Process Profile ---
            const transformedDepartments = (volProfile.departments || []).map((d: any) => d.departments).filter(Boolean);
            const completeProfile = { ...volProfile, departments: transformedDepartments };
            setVolunteerProfile(completeProfile as unknown as DetailedVolunteer);
    
            // --- Process Schedule & Enrich with Leader Names ---
            const rawSchedule = scheduleRes.data || [];
            
            // We need to manually map leader names because `event_departments` structure implies one leader per dept in `department_leaders` table, which isn't directly joined here easily without complexity.
            // We'll use the `leaders` prop passed to this component to lookup leader names for the department associated with the schedule item.
            
            // 1. Get all unique department IDs from schedule
            const relevantDeptIds = [...new Set(rawSchedule.map((item: any) => item.department_id))];
            
            // 2. Fetch leaders for these departments (Optimization: could be cached/passed from App, but safe to fetch here if list is small)
            const { data: deptLeaders, error: dlError } = await supabase
                .from('department_leaders')
                .select('department_id, leader_id')
                .in('department_id', relevantDeptIds);
                
            if (dlError) console.warn("Could not fetch leaders for schedule items", dlError);
            
            const deptLeaderMap = new Map<number, string>();
            (deptLeaders || []).forEach((dl: any) => {
                const leaderUser = leaders.find(u => u.id === dl.leader_id);
                if (leaderUser) {
                    deptLeaderMap.set(dl.department_id, leaderUser.user_metadata?.name || 'Líder');
                }
            });

            const allMySchedules: VolunteerSchedule[] = rawSchedule
                .filter((item: any) => item.events) // Filter out if event join failed (e.g. deleted event)
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
                        observations: evt.observations,
                        department_id: item.department_id,
                        department_name: item.departments?.name || 'Departamento',
                        leader_name: deptLeaderMap.get(item.department_id) || '',
                        present: item.present,
                        cronograma_principal_id: evt.cronograma_principal_id,
                        cronograma_kids_id: evt.cronograma_kids_id,
                    };
                });
                
            setTodayEvents(allMySchedules.filter(e => e.date === todayStr));
            setUpcomingEvents(allMySchedules.filter(e => e.date > todayStr));
            
            const attended = allMySchedules.filter(e => e.present === true).length;
    
            setStats({
                upcoming: allMySchedules.filter(e => e.date > todayStr).length,
                attended: attended,
                totalScheduled: allMySchedules.length,
                eventsToday: allMySchedules.filter(e => e.date === todayStr).length,
            });
    
        } catch (err) {
            const errorMessage = getErrorMessage(err);
            setError(errorMessage);
            console.error("Error fetching volunteer dashboard data:", err);
        } finally {
            setLoading(false);
        }
    }, [userId, leaders]);


    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    const handleInvitationResponse = async (invitationId: number, response: 'aceito' | 'recusado') => {
        try {
            const { error } = await supabase.functions.invoke('respond-to-invitation', {
                body: { invitationId, response },
            });
            if (error) throw error;
            showNotification(`Convite ${response === 'aceito' ? 'aceito' : 'recusado'} com sucesso!`, 'success');
            // Refetch all data to update department list, schedules, etc.
            fetchDashboardData(); 
        } catch (err) {
            showNotification(`Erro ao responder ao convite: ${getErrorMessage(err)}`, 'error');
        }
    };
    
    const departmentNames = useMemo(() => {
        if (loading || !volunteerProfile || !Array.isArray(volunteerProfile.departments)) return [];
        return volunteerProfile.departments.map(d => d.name).filter(Boolean);
    }, [loading, volunteerProfile]);

    const handleLiveEventNavigate = () => {
        if (activeEvent && volunteerProfile) {
            // The active event might involve the volunteer in multiple departments.
            // We find the first one to scroll to.
            const scheduleDetails = activeEvent.event_volunteers.find(
                ev => ev.volunteer_id === volunteerProfile.id
            );
    
            if (scheduleDetails) {
                const cardId = `event-card-${activeEvent.id}-${scheduleDetails.department_id}`;
                const cardElement = document.getElementById(cardId);
                if (cardElement) {
                    cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    
                    // Add a temporary highlight effect for better UX. Using classes for cleaner state management.
                    cardElement.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2', 'transition-shadow', 'duration-300');
                    setTimeout(() => {
                        cardElement.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2');
                    }, 2500); // Highlight for 2.5 seconds
                } else {
                    console.warn(`Could not find event card with ID: ${cardId}`);
                }
            }
        }
    };

    const handleGenerateQrCode = (event: VolunteerSchedule) => {
        if (!volunteerProfile) return;
        setQrCodeData({ vId: volunteerProfile.id, eId: event.id, dId: event.department_id });
        setQrCodeEvent(event);
        setIsQrModalOpen(true);
    };
    
    const handleRequestSwap = (event: VolunteerSchedule) => {
        setSwapRequestEvent(event);
        setIsSwapModalOpen(true);
    };

    const handleSubmitSwapRequest = async (reason: string) => {
        if (!swapRequestEvent) return;
        setIsSubmittingSwap(true);
        try {
            const { error } = await supabase.functions.invoke('request-shift-swap', {
                body: { eventId: swapRequestEvent.id, departmentId: swapRequestEvent.department_id, reason },
            });
            if (error) throw error;
            showNotification('Sua solicitação de troca foi enviada ao líder.', 'success');
            await fetchDashboardData(); // Refetch to update status
        } catch (err) {
            showNotification(`Erro ao solicitar troca: ${getErrorMessage(err)}`, 'error');
        } finally {
            setIsSubmittingSwap(false);
            setIsSwapModalOpen(false);
            setSwapRequestEvent(null);
        }
    };
    
    const statCardsData = [
        { key: 'upcoming', title: 'Próximos Eventos', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0h18" /></svg>, color: 'blue' as const },
        { key: 'attended', title: 'Presenças Confirmadas', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>, color: 'green' as const },
        { key: 'totalScheduled', title: 'Total Escalado', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" /></svg>, color: 'yellow' as const },
        { key: 'eventsToday', title: 'Eventos Hoje', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0h18" /></svg>, color: 'purple' as const },
    ];


    const userName = getShortName(session?.user?.user_metadata?.name);
    
    return (
        <div className="space-y-6">
            {notification && (
                <div className={`fixed top-20 right-4 z-[9999] p-4 rounded-lg shadow-lg text-white ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
                    {notification.message}
                </div>
            )}
            <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Olá, {userName}!</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Bem-vindo(a) ao seu painel de voluntário.</p>
                </div>
                {activeEvent && <LiveEventTimer event={activeEvent} onShowDetails={handleLiveEventNavigate} />}
            </div>

            {error && <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">{error}</div>}

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-x sm:divide-y-0 divide-slate-200 dark:divide-slate-700">
                    {statCardsData.map(card => (
                        <VolunteerStatCard 
                            key={card.key}
                            title={card.title}
                            value={stats[card.key as keyof typeof stats]}
                            icon={card.icon}
                            color={card.color}
                            loading={loading}
                        />
                    ))}
                </div>
            </div>

            {invitations.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Convites Pendentes</h2>
                    {invitations.map(inv => (
                        <InvitationCard key={inv.id} invitation={inv} onRespond={handleInvitationResponse} />
                    ))}
                </div>
            )}
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {(loading || todayEvents.length > 0) && (
                        <EventList 
                            title="Minhas Escalas de Hoje"
                            events={todayEvents}
                            volunteerId={volunteerProfile?.id}
                            onGenerateQrCode={handleGenerateQrCode}
                            onRequestSwap={handleRequestSwap}
                            onViewTimeline={setViewingTimelineFor}
                            isToday
                            loading={loading}
                        />
                    )}
                    {(loading || upcomingEvents.length > 0) && (
                        <EventList 
                            title="Próximas Escalas"
                            events={upcomingEvents}
                            volunteerId={volunteerProfile?.id}
                            onGenerateQrCode={handleGenerateQrCode}
                            onRequestSwap={handleRequestSwap}
                            onViewTimeline={setViewingTimelineFor}
                            isToday={false}
                            loading={loading}
                        />
                    )}
                     {!loading && todayEvents.length === 0 && upcomingEvents.length === 0 && (
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm text-center">
                            <h3 className="text-lg font-medium text-slate-800 dark:text-slate-100">Nenhuma escala encontrada</h3>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Você não está escalado para nenhum evento futuro no momento.</p>
                        </div>
                    )}
                </div>
                
                <div className="lg:col-span-1">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">Meus Departamentos</h2>
                        {loading ? (
                             <div className="space-y-3 animate-pulse">
                                <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
                                <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
                            </div>
                        ) : departmentNames.length > 0 ? (
                            <ul className="space-y-3">
                                {departmentNames.map(name => (
                                    <li key={name} className="flex items-center space-x-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                        {getDepartmentIcon(name)}
                                        <span className="font-semibold text-slate-700 dark:text-slate-300">{name}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-slate-500 dark:text-slate-400">Você ainda não faz parte de nenhum departamento.</p>
                        )}
                    </div>
                </div>
            </div>

            <QRCodeDisplayModal
                isOpen={isQrModalOpen}
                onClose={() => setIsQrModalOpen(false)}
                data={qrCodeData}
                title={`QR Code para ${qrCodeEvent?.name}`}
            />
             <RequestSwapModal 
                isOpen={isSwapModalOpen}
                onClose={() => setIsSwapModalOpen(false)}
                onSubmit={handleSubmitSwapRequest}
                event={swapRequestEvent}
                isSubmitting={isSubmittingSwap}
            />
             <EventTimelineViewerModal 
                isOpen={!!viewingTimelineFor}
                onClose={() => setViewingTimelineFor(null)}
                event={viewingTimelineFor}
            />
        </div>
    );
};


const InvitationCard: React.FC<{ invitation: Invitation; onRespond: (id: number, response: 'aceito' | 'recusado') => void }> = ({ invitation, onRespond }) => {
    return (
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg shadow-sm dark:bg-slate-800 dark:border-blue-500">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="min-w-0 flex-grow">
                    <p className="font-semibold text-blue-800 dark:text-blue-300">Você foi convidado!</p>
                    <p className="text-sm text-blue-700 dark:text-slate-300 mt-1">
                        {invitation.profiles?.name || 'Um líder'} convidou você para o departamento <strong>{invitation.departments?.name || 'desconhecido'}</strong>.
                    </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 self-end sm:self-center">
                    <button onClick={() => onRespond(invitation.id, 'recusado')} className="px-4 py-2 text-sm font-semibold text-red-700 bg-red-100 rounded-lg hover:bg-red-200 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/40">Recusar</button>
                    <button onClick={() => onRespond(invitation.id, 'aceito')} className="px-4 py-2 text-sm font-semibold text-white bg-green-500 rounded-lg hover:bg-green-600">Aceitar</button>
                </div>
            </div>
        </div>
    );
};

// --- Reusable Components for this page ---

const EventList: React.FC<{
    title: string;
    events: VolunteerSchedule[];
    volunteerId: number | null | undefined;
    onGenerateQrCode: (event: VolunteerSchedule) => void;
    onRequestSwap: (event: VolunteerSchedule) => void;
    onViewTimeline: (event: VolunteerSchedule) => void;
    isToday: boolean;
    loading: boolean;
}> = ({ title, events, volunteerId, onGenerateQrCode, onRequestSwap, onViewTimeline, isToday, loading }) => {
    
    if (loading) {
        return (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm animate-pulse">
                <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-4"></div>
                <div className="space-y-4">
                    <div className="h-24 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
                    <div className="h-24 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">{title}</h2>
            <div className="space-y-4">
                {events.map(event => (
                    <EventCard 
                        key={`${event.id}-${event.department_id}`}
                        event={event}
                        isToday={isToday}
                        volunteerId={volunteerId}
                        onGenerateQrCode={onGenerateQrCode}
                        onRequestSwap={onRequestSwap}
                        onViewTimeline={onViewTimeline}
                    />
                ))}
            </div>
        </div>
    );
};

const EventCard: React.FC<{
    event: VolunteerSchedule;
    isToday: boolean;
    volunteerId: number | null | undefined;
    onGenerateQrCode: (event: VolunteerSchedule) => void;
    onRequestSwap: (event: VolunteerSchedule) => void;
    onViewTimeline: (event: VolunteerSchedule) => void;
}> = ({ event, isToday, volunteerId, onGenerateQrCode, onRequestSwap, onViewTimeline }) => {
    
    const { fullDate: formattedDate, dateTime: startDateTime, time: startTime } = convertUTCToLocal(event.date, event.start_time);
    const { dateTime: endDateTime, time: endTime } = convertUTCToLocal(event.date, event.end_time);

    // FIX: Handle events that cross midnight in UTC timezone.
    if (startDateTime && endDateTime && endDateTime < startDateTime) {
        endDateTime.setDate(endDateTime.getDate() + 1);
    }

    const now = new Date();
    const isFinished = endDateTime ? now > endDateTime : false;
    const isLive = startDateTime && endDateTime ? now >= startDateTime && now < endDateTime : false;

    const myAttendance = event.present;

    return (
        <div id={`event-card-${event.id}-${event.department_id}`} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 transition-shadow">
            <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 dark:text-slate-100 truncate" title={event.name}>{event.name}</p>
                    <div className="mt-2 space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-2">
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0h18" />
                            </svg>
                           <span>{formattedDate}</span>
                        </div>
                        <div className="flex items-center gap-2">
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                           <span>{startTime} - {endTime}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {getDepartmentIcon(event.department_name)}
                           <span className="font-medium">{event.department_name}</span>
                        </div>
                        {event.leader_name && (
                            <div className="flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>
                               <span className="font-medium">Líder: {event.leader_name}</span>
                            </div>
                        )}
                        {(event.cronograma_principal_id || event.cronograma_kids_id) && !isFinished && (
                            <div className="flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
                                </svg>
                                <button
                                    onClick={() => onViewTimeline(event)}
                                    className="font-medium text-blue-600 hover:underline"
                                >
                                    Ver Cronograma
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex-shrink-0 ml-4">
                    {myAttendance === true ? (
                        <span className="inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300">Presente</span>
                    ) : isFinished ? (
                        <span className="inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300">Faltou</span>
                    ) : (
                        <span className="inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300">Não Marcado</span>
                    )}
                </div>
            </div>
             {/* Show buttons container if event is not finished, or if it is today (to show the "Encerrado" state) */}
            {(isToday || !isFinished) && (
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row gap-3">
                    {isFinished ? (
                        <div className="flex-1 text-center px-4 py-2 text-sm font-semibold rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                            Encerrado
                        </div>
                    ) : isLive ? (
                        <button
                            onClick={() => onGenerateQrCode(event)}
                            className="flex-1 text-center px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 shadow-sm"
                        >
                            Gerar QR Code
                        </button>
                    ) : (
                        <button
                            onClick={() => onRequestSwap(event)}
                            className="flex-1 text-center px-4 py-2 text-sm bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 shadow-sm disabled:bg-orange-300 disabled:cursor-not-allowed"
                        >
                            Preciso Trocar
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

export default VolunteerDashboard;