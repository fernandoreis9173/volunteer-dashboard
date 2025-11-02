import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DetailedVolunteer, DashboardEvent, Page, Event as VolunteerEvent, Invitation } from '../types';
import { supabase } from '../lib/supabaseClient';
// FIX: Restored Supabase v2 types for type safety.
import { type Session, type User } from '@supabase/supabase-js';
import { getErrorMessage, convertUTCToLocal } from '../lib/utils';
import LiveEventDetailsModal from './LiveEventDetailsModal';
import QRCodeDisplayModal from './QRCodeDisplayModal';
import RequestSwapModal from './RequestSwapModal';
import QRScannerModal from './QRScannerModal';
import VolunteerStatCard from './VolunteerStatCard';

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
  onDataChange: () => void;
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
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24" stroke="currentColor" strokeWidth="1.5">
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


const VolunteerDashboard: React.FC<VolunteerDashboardProps> = ({ session, onDataChange, activeEvent, onNavigate, leaders }) => {
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
    const [isScannerOpen, setIsScannerOpen] = useState(false);

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
            const { data: volProfile, error: volProfileError } = await supabase
                .from('volunteers')
                .select('id, name, departments:volunteer_departments(departments(id, name))')
                .eq('user_id', userId)
                .single();
    
            if (volProfileError) throw volProfileError;
            if (!volProfile) throw new Error("Perfil de voluntário não encontrado.");
            
            const volunteerId = volProfile.id;

            const [scheduleRes, rawInvitationsRes, pendingSwapsRes] = await Promise.all([
                supabase.rpc('get_my_schedule'),
                supabase.from('invitations').select('id, created_at, leader_id, departments(id, name)').eq('volunteer_id', volunteerId).eq('status', 'pendente'),
                supabase.from('shift_swap_requests').select('event_id').eq('requesting_volunteer_id', volunteerId).eq('status', 'pendente')
            ]);
    
            if (scheduleRes.error) throw scheduleRes.error;
            if (rawInvitationsRes.error) throw rawInvitationsRes.error;
            if (pendingSwapsRes.error) throw pendingSwapsRes.error;

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

            setPendingSwaps(new Set(pendingSwapsRes.data?.map(s => s.event_id) || []));
            
            const transformedDepartments = (volProfile.departments || []).map((d: any) => d.departments).filter(Boolean);
            const completeProfile = { ...volProfile, departments: transformedDepartments };
            setVolunteerProfile(completeProfile as unknown as DetailedVolunteer);
    
            const eventsMap = new Map<number, DashboardEvent>();
            for (const item of (scheduleRes.data || [])) {
                if (!eventsMap.has(item.id)) {
                    eventsMap.set(item.id, { id: item.id, name: item.name, date: item.date, start_time: item.start_time, end_time: item.end_time, status: item.status, local: item.local, observations: item.observations, event_departments: [], event_volunteers: [] });
                }
                const event = eventsMap.get(item.id)!;
                if (!event.event_departments?.some(d => d.departments.id === item.department_id)) {
                    event.event_departments?.push({ departments: { id: item.department_id, name: item.department_name, leader: item.leader_name } });
                }
                event.event_volunteers?.push({ department_id: item.department_id, volunteer_id: volunteerId, present: item.present, volunteers: { name: volProfile.name } });
            }
            const allMyEvents = Array.from(eventsMap.values());
    
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayStr = today.toISOString().split('T')[0];
    
            setTodayEvents(allMyEvents.filter(e => e.date === todayStr));
            setUpcomingEvents(allMyEvents.filter(e => e.date > todayStr));
            
            const attended = allMyEvents.filter(e => e.event_volunteers?.some(ev => ev.present === true)).length;
    
            setStats({
                upcoming: allMyEvents.filter(e => e.date > todayStr).length,
                attended: attended,
                totalScheduled: allMyEvents.length,
                eventsToday: allMyEvents.filter(e => e.date === todayStr).length,
            });
    
        } catch (err) {
            const errorMessage = getErrorMessage(err);
            if (errorMessage.includes("function get_my_schedule does not exist")) {
                setError("A configuração do banco de dados está incompleta. Por favor, peça a um administrador para aplicar os scripts SQL de correção.");
            } else {
                setError(errorMessage);
            }
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
            onDataChange(); 
        } catch (err) {
            showNotification(`Erro ao responder ao convite: ${getErrorMessage(err)}`, 'error');
        }
    };
    
    const departmentNames = useMemo(() => {
        if (loading || !volunteerProfile || !Array.isArray(volunteerProfile.departments)) return [];
        return volunteerProfile.departments.map(d => d.name).filter(Boolean);
    }, [loading, volunteerProfile]);

    const handleScanSuccess = useCallback(async (decodedText: string) => {
        setIsScannerOpen(false);
        if (!volunteerProfile || !activeEvent) {
            showNotification('Não foi possível confirmar a presença. Perfil ou evento ativo não encontrado.', 'error');
            return;
        }

        try {
            const data = JSON.parse(decodedText);
            if (!data.eventId) {
                throw new Error("QR Code inválido. 'eventId' não encontrado.");
            }
            if (data.eventId !== activeEvent.id) {
                throw new Error("Este QR Code é para um evento diferente.");
            }

            const volunteerScheduleInfo = activeEvent.event_volunteers.find(
                v => v.volunteer_id === volunteerProfile.id
            );

            if (!volunteerScheduleInfo) {
                throw new Error("Você não está escalado para este evento.");
            }

            const departmentId = volunteerScheduleInfo.department_id;

            const { error: invokeError } = await supabase.functions.invoke('mark-attendance', {
                body: { 
                    volunteerId: volunteerProfile.id, 
                    eventId: activeEvent.id, 
                    departmentId: departmentId,
                },
            });

            if (invokeError) throw invokeError;
            
            showNotification(`Sua presença em "${activeEvent.name}" foi confirmada!`, 'success');
            
            fetchDashboardData();

        } catch (err: any) {
             if (err.context && typeof err.context.json === 'function') {
                try {
                    const errorJson = await err.context.json();
                    if (errorJson && errorJson.error) {
                        showNotification(errorJson.error, 'error');
                    } else {
                        showNotification(getErrorMessage(err), 'error');
                    }
                } catch (parseError) {
                    showNotification(getErrorMessage(err), 'error');
                }
            } else {
                showNotification(getErrorMessage(err), 'error');
            }
        }
    }, [activeEvent, volunteerProfile, fetchDashboardData, showNotification]);

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
                    <h1 className="text-3xl font-bold text-slate-800">Olá, {userName}!</h1>
                    <p className="text-slate-500 mt-1">Bem-vindo(a) ao seu painel de voluntário.</p>
                </div>
                {activeEvent && <LiveEventTimer event={activeEvent} onShowDetails={handleLiveEventNavigate} />}
            </div>

            {error && <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">{error}</div>}

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-x sm:divide-y-0 divide-slate-200">
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
                    <h2 className="text-xl font-bold text-slate-800">Convites Pendentes</h2>
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
                            onScanEventQrCode={() => setIsScannerOpen(true)}
                            pendingSwaps={pendingSwaps}
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
                            onScanEventQrCode={() => setIsScannerOpen(true)}
                            pendingSwaps={pendingSwaps}
                            isToday={false}
                            loading={loading}
                        />
                    )}
                     {!loading && todayEvents.length === 0 && upcomingEvents.length === 0 && (
                        <div className="bg-white p-6 rounded-2xl shadow-sm text-center">
                            <h3 className="text-lg font-medium text-slate-800">Nenhuma escala encontrada</h3>
                            <p className="mt-1 text-sm text-slate-500">Você não está escalado para nenhum evento futuro no momento.</p>
                        </div>
                    )}
                </div>
                
                <div className="lg:col-span-1">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h2 className="text-xl font-bold text-slate-800 mb-4">Meus Departamentos</h2>
                        {loading ? (
                             <div className="space-y-3 animate-pulse">
                                <div className="h-12 bg-slate-200 rounded-lg"></div>
                                <div className="h-12 bg-slate-200 rounded-lg"></div>
                            </div>
                        ) : departmentNames.length > 0 ? (
                            <ul className="space-y-3">
                                {departmentNames.map(name => (
                                    <li key={name} className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg">
                                        {getDepartmentIcon(name)}
                                        <span className="font-semibold text-slate-700">{name}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-slate-500">Você ainda não faz parte de nenhum departamento.</p>
                        )}
                    </div>
                </div>
            </div>

            <LiveEventDetailsModal
                isOpen={isLiveEventModalOpen}
                event={activeEvent}
                volunteerProfile={volunteerProfile}
                onClose={() => setIsLiveEventModalOpen(false)}
            />
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
            {isScannerOpen && (
                <QRScannerModal
                    isOpen={isScannerOpen}
                    onClose={() => setIsScannerOpen(false)}
                    onScanSuccess={handleScanSuccess}
                    scanningEventName={activeEvent?.name}
                />
            )}
        </div>
    );
};


const InvitationCard: React.FC<{ invitation: Invitation; onRespond: (id: number, response: 'aceito' | 'recusado') => void }> = ({ invitation, onRespond }) => {
    return (
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1">
                    <p className="font-semibold text-blue-800">Você foi convidado!</p>
                    <p className="text-sm text-blue-700 mt-1">
                        {invitation.profiles?.name || 'Um líder'} convidou você para o departamento <strong>{invitation.departments?.name || 'desconhecido'}</strong>.
                    </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                    <button onClick={() => onRespond(invitation.id, 'recusado')} className="px-4 py-2 text-sm font-semibold text-red-700 bg-red-100 rounded-lg hover:bg-red-200">Recusar</button>
                    <button onClick={() => onRespond(invitation.id, 'aceito')} className="px-4 py-2 text-sm font-semibold text-white bg-green-500 rounded-lg hover:bg-green-600">Aceitar</button>
                </div>
            </div>
        </div>
    );
};

// --- Reusable Components for this page ---

const EventList: React.FC<{
    title: string;
    events: DashboardEvent[];
    volunteerId: number | null | undefined;
    onGenerateQrCode: (event: DashboardEvent) => void;
    onRequestSwap: (event: DashboardEvent) => void;
    onScanEventQrCode: () => void;
    pendingSwaps: Set<number>;
    isToday: boolean;
    loading: boolean;
}> = ({ title, events, volunteerId, onGenerateQrCode, onRequestSwap, onScanEventQrCode, pendingSwaps, isToday, loading }) => {
    
    if (loading) {
        return (
            <div className="bg-white p-6 rounded-2xl shadow-sm animate-pulse">
                <div className="h-6 bg-slate-200 rounded w-1/2 mb-4"></div>
                <div className="space-y-4">
                    <div className="h-24 bg-slate-200 rounded-lg"></div>
                    <div className="h-24 bg-slate-200 rounded-lg"></div>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold text-slate-800 mb-4">{title}</h2>
            <div className="space-y-4">
                {events.map(event => (
                    <EventCard 
                        key={event.id}
                        event={event}
                        isToday={isToday}
                        volunteerId={volunteerId}
                        onGenerateQrCode={onGenerateQrCode}
                        onRequestSwap={onRequestSwap}
                        onScanEventQrCode={onScanEventQrCode}
                        pendingSwaps={pendingSwaps}
                    />
                ))}
            </div>
        </div>
    );
};

const EventCard: React.FC<{
    event: DashboardEvent;
    isToday: boolean;
    volunteerId: number | null | undefined;
    onGenerateQrCode: (event: DashboardEvent) => void;
    onRequestSwap: (event: DashboardEvent) => void;
    onScanEventQrCode: () => void;
    pendingSwaps: Set<number>;
}> = ({ event, isToday, volunteerId, onGenerateQrCode, onRequestSwap, onScanEventQrCode, pendingSwaps }) => {
    
    const { dateTime: startDateTime, time: startTime } = convertUTCToLocal(event.date, event.start_time);
    const { dateTime: endDateTime, time: endTime } = convertUTCToLocal(event.date, event.end_time);
    const isSwapPending = pendingSwaps.has(event.id);

    const now = new Date();
    const isFinished = endDateTime ? now > endDateTime : false;
    const isLive = startDateTime && endDateTime ? now >= startDateTime && now < endDateTime : false;

    const myDepartmentsInEvent = useMemo(() => {
        const myDeptIds = new Set<number>();
        (event.event_volunteers || []).forEach(ev => {
            if (ev.volunteer_id === volunteerId) {
                myDeptIds.add(ev.department_id);
            }
        });
        return (event.event_departments || [])
            .filter(ed => myDeptIds.has(ed.departments.id))
            .map(ed => ed.departments.name)
            .join(', ');
    }, [event, volunteerId]);

    const myAttendance = useMemo(() => {
        const myAttendanceRecord = (event.event_volunteers || []).find(ev => ev.volunteer_id === volunteerId);
        return myAttendanceRecord?.present;
    }, [event, volunteerId]);

    return (
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70">
            <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 truncate" title={event.name}>{event.name}</p>
                    <div className="mt-2 space-y-1.5 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                           <span>{startTime} - {endTime}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {getDepartmentIcon(myDepartmentsInEvent)}
                           <span className="font-medium">{myDepartmentsInEvent}</span>
                        </div>
                    </div>
                </div>
                <div className="flex-shrink-0 ml-4">
                    {myAttendance === true ? (
                        <span className="inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">Presente</span>
                    ) : myAttendance === false ? (
                        <span className="inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700">Faltou</span>
                    ) : (
                        <span className="inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-700">Não Marcado</span>
                    )}
                </div>
            </div>
             {isToday && (
                <div className="mt-4 pt-4 border-t border-slate-200 flex flex-col sm:flex-row gap-3">
                    {isFinished ? (
                        <div className="flex-1 text-center px-4 py-2 text-sm font-semibold rounded-lg bg-slate-100 text-slate-500">
                            Encerrado
                        </div>
                    ) : isLive ? (
                        <>
                            <button
                                onClick={() => onGenerateQrCode(event)}
                                className="flex-1 text-center px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 shadow-sm"
                            >
                                Gerar QR Code
                            </button>
                            <button
                                onClick={() => onScanEventQrCode()}
                                className="flex-1 text-center px-4 py-2 text-sm bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50"
                            >
                                Ler QR do Evento
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => onRequestSwap(event)}
                            disabled={isSwapPending}
                            className="flex-1 text-center px-4 py-2 text-sm bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 shadow-sm disabled:bg-orange-300 disabled:cursor-not-allowed"
                        >
                            {isSwapPending ? 'Troca Pendente' : 'Solicitar Troca'}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

export default VolunteerDashboard;
