import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Event as VolunteerEvent, DetailedVolunteer, Invitation, DashboardEvent, Page } from '../types';
import { supabase } from '../lib/supabaseClient';
import { type Session } from '@supabase/supabase-js';
import { getErrorMessage, parseArrayFromString } from '../lib/utils';
import VolunteerStatCard from './VolunteerStatCard';
import LiveEventDetailsModal from './LiveEventDetailsModal';
import QRCodeDisplayModal from './QRCodeDisplayModal';
import RequestSwapModal from './RequestSwapModal';

interface LiveEventTimerProps {
  event: VolunteerEvent;
  onShowDetails: () => void;
}

const LiveEventTimer: React.FC<LiveEventTimerProps> = ({ event, onShowDetails }) => {
    const handleClick = () => {
        onShowDetails();
    };

    return (
        <div className="block md:inline-block bg-red-50 border border-red-200 rounded-lg p-4" aria-label="Um evento está ao vivo">
            <div className="flex justify-between md:justify-start items-center gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-3 w-3 relative flex-shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                    <div className="min-w-0">
                        <h3 className="text-base font-semibold text-red-800">Estamos Ao Vivo</h3>
                        <p className="text-sm text-red-700 truncate" title={event.name}>{event.name}</p>
                    </div>
                </div>
                 <button onClick={handleClick} className="p-2 text-red-600 hover:text-red-800 bg-red-100 hover:bg-red-200 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-400 flex-shrink-0" aria-label="Ver detalhes do evento">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </button>
            </div>
        </div>
    );
};


interface VolunteerDashboardProps {
  session: Session | null;
  onDataChange: () => void;
  activeEvent: VolunteerEvent | null;
  onNavigate: (page: Page) => void;
}

const getShortName = (fullName?: string | null): string => {
    if (!fullName) return 'Voluntário';
    const nameParts = fullName.trim().split(/\s+/);
    return nameParts[0] || 'Voluntário';
};

const statItems = [
    { key: 'upcoming', title: 'Próximos Eventos', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24" stroke="currentColor" strokeWidth="2" ><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0h18" /></svg>, color: 'blue' },
    { key: 'attended', title: 'Presenças Confirmadas', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24" stroke="currentColor" strokeWidth="2" ><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>, color: 'green' },
    { key: 'totalScheduled', title: 'Total de Escalas', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24" stroke="currentColor" strokeWidth="2" ><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 5.25h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5" /></svg>, color: 'purple' },
    { key: 'eventsToday', title: 'Eventos Hoje', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24" stroke="currentColor" strokeWidth="2" ><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>, color: 'yellow' },
];

const StatList: React.FC<{loading: boolean, stats: any}> = ({ loading, stats }) => (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-x sm:divide-y-0 divide-slate-200">
            {statItems.map((item, index) => (
                <VolunteerStatCard
                    key={index}
                    loading={loading}
                    title={item.title}
                    value={loading ? 0 : stats[item.key as keyof typeof stats]}
                    icon={item.icon}
                    color={item.color as 'blue' | 'green' | 'yellow' | 'purple'}
                />
            ))}
        </div>
    </div>
);

const departmentIcons: { [key: string]: React.ReactElement } = {
    'Mídia': <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.776 48.776 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" /></svg>,
    'Recepção': <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m-7.5-2.226a3 3 0 0 0-4.682 2.72 9.094 9.094 0 0 0 3.741.479m7.5-2.226V18a2.25 2.25 0 0 1-2.25 2.25H12a2.25 2.25 0 0 1-2.25-2.25v-.226m3.75-10.5a3.375 3.375 0 0 0-6.75 0v1.5a3.375 3.375 0 0 0 6.75 0v-1.5ZM10.5 8.25a3.375 3.375 0 0 0-6.75 0v1.5a3.375 3.375 0 0 0 6.75 0v-1.5Z" /></svg>,
    'Conexão': <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" /></svg>,
    'Kids': <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 0 1-6.364 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm4.5 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Z" /></svg>,
    'Louvor': <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 0 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z" /></svg>,
};

const getDepartmentIcon = (deptName: string | undefined) => {
    if (!deptName) return departmentIcons['Conexão']; // Default
    const lowerDeptName = deptName.toLowerCase();
    for (const key in departmentIcons) {
        if (lowerDeptName.includes(key.toLowerCase())) {
            return departmentIcons[key];
        }
    }
    return departmentIcons['Conexão']; // Default
};


const VolunteerDashboard: React.FC<VolunteerDashboardProps> = ({ session, onDataChange, activeEvent, onNavigate }) => {
    const [volunteerProfile, setVolunteerProfile] = useState<DetailedVolunteer | null>(null);
    const [todayEvents, setTodayEvents] = useState<DashboardEvent[]>([]);
    const [upcomingEvents, setUpcomingEvents] = useState<DashboardEvent[]>([]);
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [pendingSwaps, setPendingSwaps] = useState<Set<number>>(new Set());
    const [stats, setStats] = useState({ upcoming: 0, attended: 0, totalScheduled: 0, eventsToday: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isLiveEventModalOpen, setIsLiveEventModalOpen] = useState(false);
    const [isQrModalOpen, setIsQrModalOpen] = useState(false);
    const [qrCodeData, setQrCodeData] = useState<object | null>(null);
    const [qrCodeEvent, setQrCodeEvent] = useState<DashboardEvent | null>(null);
    
    const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
    const [swapRequestEvent, setSwapRequestEvent] = useState<DashboardEvent | null>(null);
    const [isSubmittingSwap, setIsSubmittingSwap] = useState(false);
    const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

    const fetchDashboardData = useCallback(async () => {
        if (!session?.user) return;
        setLoading(true);
        setError(null);
        try {
            // 1. Get Volunteer Profile
            const { data: volProfile, error: volError } = await supabase
                .from('volunteers')
                .select('*, departments:departaments')
                .eq('user_id', session.user.id)
                .single();

            if (volError) throw volError;
            setVolunteerProfile(volProfile as DetailedVolunteer);
            const volunteerId = volProfile.id;

            // 2. Get all scheduled events for this volunteer
            const { data: allEventsData, error: allEventsError } = await supabase
                .from('events')
                .select('id, name, date, start_time, end_time, status, event_departments(departments(id, name, leader)), event_volunteers!inner(volunteer_id, present, department_id)')
                .eq('event_volunteers.volunteer_id', volunteerId);

            if (allEventsError) throw allEventsError;
            const allEvents = (allEventsData as unknown as DashboardEvent[]) || [];

            // 3. Process events and stats
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayStr = today.toISOString().split('T')[0];

            const currentTodayEvents = allEvents.filter(event => event.date === todayStr);
            const currentUpcomingEvents = allEvents.filter(event => event.date > todayStr);

            const attendedCount = allEvents.filter(event => {
                const volRecord = event.event_volunteers?.find(v => v.volunteer_id === volunteerId);
                return volRecord?.present === true;
            }).length;
            
            setTodayEvents(currentTodayEvents.sort((a,b) => a.start_time.localeCompare(b.start_time)));
            setUpcomingEvents(currentUpcomingEvents.sort((a,b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time)));
            
            setStats({
                upcoming: currentUpcomingEvents.length,
                attended: attendedCount,
                totalScheduled: allEvents.length,
                eventsToday: currentTodayEvents.length,
            });

            // 4. Fetch Invitations
            const { data: invData, error: invError } = await supabase.from('invitations').select('*, departments(name, leader)').eq('volunteer_id', volunteerId).eq('status', 'pendente');
            if (invError) throw invError;
            setInvitations(invData as Invitation[]);
            
            // 5. Fetch Pending Swap Requests
            const { data: swapData, error: swapError } = await supabase
                .from('shift_swap_requests')
                .select('event_id')
                .eq('requesting_volunteer_id', volunteerId)
                .eq('status', 'pendente');
            
            if (swapError) throw swapError;
            setPendingSwaps(new Set(swapData.map(s => s.event_id)));

        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    }, [session]);


    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    const handleInvitationResponse = async (invitationId: number, response: 'aceito' | 'recusado') => {
        try {
            const { error } = await supabase.functions.invoke('respond-to-invitation', { body: { invitationId, response } });
            if (error) throw error;
            fetchDashboardData();
            onDataChange();
        } catch (err) {
            alert(`Erro ao responder convite: ${getErrorMessage(err)}`);
        }
    };

    const handleLiveEventNavigate = () => {
        if (activeEvent) setIsLiveEventModalOpen(true);
    };

    const handleGenerateQrCode = (event: DashboardEvent) => {
        if (!volunteerProfile) return;
        const volunteerParticipation = event.event_volunteers?.find(v => v.volunteer_id === volunteerProfile.id);
        if (!volunteerParticipation) return;

        setQrCodeData({ vId: volunteerProfile.id, eId: event.id, dId: volunteerParticipation.department_id });
        setQrCodeEvent(event);
        setIsQrModalOpen(true);
    };
    
    const showNotification = useCallback((message: string, type: 'success' | 'error') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 5000);
    }, []);
    
    const handleRequestSwap = (event: DashboardEvent) => {
        setSwapRequestEvent(event);
        setIsSwapModalOpen(true);
    };

    const handleSubmitSwapRequest = async (reason: string) => {
        if (!swapRequestEvent) return;
        setIsSubmittingSwap(true);
        try {
            const { error } = await supabase.functions.invoke('request-shift-swap', {
                body: { eventId: swapRequestEvent.id, reason },
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
    
    const EventCard: React.FC<{ event: DashboardEvent; isUpcoming?: boolean }> = ({ event, isUpcoming = false }) => {
        const volunteerRecord = useMemo(() => {
            return event.event_volunteers?.find(v => v.volunteer_id === volunteerProfile?.id);
        }, [event.event_volunteers, volunteerProfile]);
        
        const departmentInfo = useMemo(() => {
            if (!volunteerRecord || !event.event_departments) return null;
            return event.event_departments.find(ed => ed.departments?.id === volunteerRecord.department_id)?.departments;
        }, [volunteerRecord, event.event_departments]);

        const isPresent = volunteerRecord?.present === true;

        const { isLive, hasEnded } = useMemo(() => {
            const now = new Date();
            const eventStart = new Date(`${event.date}T${event.start_time}`);
            const eventEnd = new Date(`${event.date}T${event.end_time}`);
            return {
                isLive: activeEvent && activeEvent.id === event.id,
                hasEnded: now > eventEnd,
            };
        }, [event, activeEvent]);

        const isSwapPending = pendingSwaps.has(event.id);
        
        const cardClasses = isLive
            ? 'bg-blue-50 border-blue-200'
            : isPresent
            ? 'bg-green-50 border-green-200'
            : 'bg-slate-50 border-slate-200';

        const renderActionButton = () => {
            if (isPresent) {
                return (
                    <div className="px-3 py-1.5 bg-green-100 text-green-700 font-semibold rounded-lg text-sm flex items-center gap-2 w-full sm:w-auto justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Presença Confirmada
                    </div>
                );
            }

            if (isLive) {
                return (
                    <button onClick={() => handleGenerateQrCode(event)} className="px-3 py-1.5 bg-blue-600 border border-transparent text-white font-semibold rounded-lg text-sm hover:bg-blue-700 w-full sm:w-auto">
                        Gerar QR Code
                    </button>
                );
            }

            if (hasEnded) {
                return (
                     <div className="px-3 py-1.5 bg-red-100 text-red-700 font-semibold rounded-lg text-sm flex items-center gap-2 w-full sm:w-auto justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Faltou
                    </div>
                );
            }

            // Future event (should not be rendered here, handled by isUpcoming)
            return (
                <button disabled className="px-3 py-1.5 bg-white border border-slate-300 text-slate-500 font-semibold rounded-lg text-sm cursor-not-allowed w-full sm:w-auto" title="Disponível quando o evento começar">
                    Gerar QR Code
                </button>
            );
        };

        return (
             <div className={`p-4 rounded-lg border flex flex-col sm:flex-row justify-between items-start gap-3 ${cardClasses}`}>
                <div className="min-w-0 space-y-1.5 flex-grow">
                    <p className="font-bold text-slate-800 truncate">{event.name}</p>
                    <p className="text-sm text-slate-500">
                        {new Date(event.date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' })} • {event.start_time.substring(0,5)} - {event.end_time.substring(0,5)}
                    </p>
                    {departmentInfo && (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                            <div className="flex items-center gap-1.5">
                                {getDepartmentIcon(departmentInfo.name)}
                                <span className="font-medium">{departmentInfo.name}</span>
                            </div>
                            {departmentInfo.leader && (
                                <div className="flex items-center gap-1.5">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
                                    <span className="font-medium">Líder: {departmentInfo.leader}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                 <div className="flex flex-col sm:items-end gap-2 w-full sm:w-auto flex-shrink-0">
                    {!isUpcoming && renderActionButton()}
                    
                    {isUpcoming && event.status === 'Confirmado' && (
                        isSwapPending ? (
                            <div className="px-3 py-1.5 bg-yellow-100 text-yellow-700 font-semibold rounded-lg text-sm flex items-center gap-2 w-full sm:w-auto justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                Troca Pendente
                            </div>
                        ) : (
                            <button onClick={() => handleRequestSwap(event)} className="px-3 py-1.5 bg-orange-100 border border-orange-200 text-orange-700 font-semibold rounded-lg text-sm hover:bg-orange-200 w-full sm:w-auto">
                                Preciso Trocar
                            </button>
                        )
                    )}
                </div>
            </div>
        );
    };

    const InvitationCard: React.FC<{ invitation: Invitation }> = ({ invitation }) => (
        <div className="bg-white p-4 rounded-lg border border-slate-200">
            <p className="text-sm text-slate-600">
                Você foi convidado por <span className="font-semibold">{invitation.departments?.leader}</span> para se juntar ao departamento <span className="font-semibold text-blue-600">{invitation.departments?.name}</span>.
            </p>
            <div className="mt-3 flex justify-end gap-2">
                <button onClick={() => handleInvitationResponse(invitation.id, 'recusado')} className="px-3 py-1 bg-red-100 text-red-700 font-semibold rounded-lg text-sm">Recusar</button>
                <button onClick={() => handleInvitationResponse(invitation.id, 'aceito')} className="px-3 py-1 bg-green-100 text-green-700 font-semibold rounded-lg text-sm">Aceitar</button>
            </div>
        </div>
    );

    const departmentNames = useMemo(() => {
        if (loading || !volunteerProfile) return [];
        return parseArrayFromString(volunteerProfile.departments);
    }, [loading, volunteerProfile]);
    
    return (
        <div className="space-y-8">
            {notification && (
                <div className={`fixed top-20 right-4 z-[9999] p-4 rounded-lg shadow-lg text-white ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
                    {notification.message}
                </div>
            )}
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Olá, {getShortName(session?.user?.user_metadata?.name)}!</h1>
                    <p className="text-slate-500 mt-1">Bem-vindo(a) ao seu painel.</p>
                    {departmentNames.length > 0 && (
                        <p className="text-slate-500 mt-1 font-semibold">
                            {departmentNames.join(' • ')}
                        </p>
                    )}
                </div>
                {activeEvent && <LiveEventTimer event={activeEvent} onShowDetails={handleLiveEventNavigate} />}
            </div>

            {error && <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">{error}</div>}

            <StatList loading={loading} stats={stats} />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                    {invitations.length > 0 && (
                        <div>
                            <h2 className="text-xl font-bold text-slate-800 mb-3">Convites Pendentes</h2>
                            <div className="space-y-3">
                                {invitations.map(inv => <InvitationCard key={inv.id} invitation={inv} />)}
                            </div>
                        </div>
                    )}
                    
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 mb-3">Eventos de Hoje</h2>
                        <div className="space-y-3">
                        {loading ? <p>Carregando...</p> : todayEvents.length > 0 ? (
                            todayEvents.map(event => <EventCard key={event.id} event={event} />)
                        ) : (
                            <p className="text-slate-500 bg-slate-50 p-4 rounded-lg">Você não está escalado para nenhum evento hoje.</p>
                        )}
                        </div>
                    </div>
                </div>
                
                <div className="space-y-6">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 mb-3">Próximos Eventos</h2>
                        <div className="space-y-3">
                        {loading ? <p>Carregando...</p> : upcomingEvents.length > 0 ? (
                            upcomingEvents.map(event => <EventCard key={event.id} event={event} isUpcoming={true} />)
                        ) : (
                            <p className="text-slate-500 bg-slate-50 p-4 rounded-lg">Você não está escalado para nenhum evento futuro.</p>
                        )}
                        </div>
                    </div>
                </div>
            </div>

            <LiveEventDetailsModal event={activeEvent} volunteerProfile={volunteerProfile} isOpen={isLiveEventModalOpen} onClose={() => setIsLiveEventModalOpen(false)} />
            <QRCodeDisplayModal 
                isOpen={isQrModalOpen}
                onClose={() => setIsQrModalOpen(false)}
                data={qrCodeData}
                title={`QR Code para ${qrCodeEvent?.name}`}
                volunteerName={volunteerProfile?.name}
                description="Apresente este código ao líder para confirmar sua presença."
            />
            <RequestSwapModal
                isOpen={isSwapModalOpen}
                onClose={() => setIsSwapModalOpen(false)}
                event={swapRequestEvent}
                onSubmit={handleSubmitSwapRequest}
                isSubmitting={isSubmittingSwap}
            />
        </div>
    );
};

export default VolunteerDashboard;