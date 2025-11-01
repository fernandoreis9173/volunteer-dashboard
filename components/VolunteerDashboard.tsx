import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DetailedVolunteer, DashboardEvent, Page, Event as VolunteerEvent, Invitation } from '../types';
import { supabase } from '../lib/supabaseClient';
// FIX: Restored Supabase v2 types for type safety.
import { type Session, type User } from '@supabase/supabase-js';
import { getErrorMessage } from '../lib/utils';
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

const departmentIcons: { [key: string]: React.ReactElement } = {
    'Mídia': <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.776 48.776 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" /></svg>,
    'Recepção': <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m-7.5-2.226a3 3 0 0 0-4.682 2.72 9.094 9.094 0 0 0 3.741.479m7.5-2.226V18a2.25 2.25 0 0 1-2.25 2.25H12a2.25 2.25 0 0 1-2.25-2.25v-.226m3.75-10.5a3.375 3.375 0 0 0-6.75 0v1.5a3.375 3.375 0 0 0 6.75 0v-1.5ZM10.5 8.25a3.375 3.375 0 0 0-6.75 0v1.5a3.375 3.375 0 0 0 6.75 0v-1.5Z" /></svg>,
    'Conexão': <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M18 5a3 3 0 1 0-6 0 3 3 0 0 0 6 0Zm-6 14a3 3 0 1 0-6 0 3 3 0 0 0 6 0Zm12 0a3 3 0 1 0-6 0 3 3 0 0 0 6 0Zm-6-7a3 3 0 1 0-6 0 3 3 0 0 0 6 0Zm-2.7-5.2-4.6 3.4m4.6 7-4.6-3.4" /></svg>,
    'Kids': <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 0 1-6.364 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm4.5 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Z" /></svg>,
    'Louvor': <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 0 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z" /></svg>,
    'Dança': <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>,
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
        { key: 'upcoming', title: 'Próximos Eventos', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0h18" /></svg>, color: 'blue' as const },
        { key: 'attended', title: 'Presenças Confirmadas', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>, color: 'green' as const },
        { key: 'totalScheduled', title: 'Total de Escalas', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm0 5.25h.007v.008H3.75V12zm0 5.25h.007v.008H3.75v-.008Z" /></svg>, color: 'purple' as const },
        { key: 'eventsToday', title: 'Eventos Hoje', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0h18" /></svg>, color: 'yellow' as const },
    ];
    
    const StatCardsGrid = () => (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {statCardsData.map(item => (
                <div key={item.key} className="bg-white rounded-lg shadow-sm border border-slate-200">
                    <VolunteerStatCard 
                        title={item.title}
                        value={stats[item.key as keyof typeof stats]}
                        icon={item.icon}
                        color={item.color}
                        loading={loading}
                    />
                </div>
            ))}
        </div>
    );
    

    return (
        <>
            {notification && (
                <div className={`fixed top-20 right-4 z-[9999] p-4 rounded-lg shadow-lg text-white ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
                    {notification.message}
                </div>
            )}

            <div className="mb-6">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Olá, {getShortName(session?.user?.user_metadata?.name)}!</h2>
                <p className="text-gray-500">Bem-vindo(a) ao seu painel.</p>
            </div>

            {departmentNames.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap mb-8">
                    {departmentNames.map(deptName => (
                        <span key={deptName} className="bg-blue-100 text-primary text-xs font-medium px-3 py-1 rounded-full">
                            {deptName}
                        </span>
                    ))}
                </div>
            )}
            
            {error ? <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">{error}</div> : <StatCardsGrid />}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="flex flex-col gap-8">
                    {!loading && invitations.length > 0 && (
                        <section>
                            <h3 className="text-xl font-semibold mb-4 text-gray-900">Convites Pendentes</h3>
                            {invitations.map(inv => (
                                <div key={inv.id} className="bg-white p-5 rounded-lg shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div className="flex-1">
                                        <p className="text-gray-800">Você foi convidado para o departamento <a className="font-semibold text-primary" href="#">{inv.departments?.name || ''}</a>.</p>
                                        <p className="text-sm text-gray-500">Convidado por: {inv.profiles?.name || 'Líder'}</p>
                                    </div>
                                    <div className="flex items-center gap-2 w-full sm:w-auto">
                                        <button onClick={() => handleInvitationResponse(inv.id, 'recusado')} className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium bg-red-100 text-red-600 rounded-md hover:bg-red-200">Recusar</button>
                                        <button onClick={() => handleInvitationResponse(inv.id, 'aceito')} className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-md hover:bg-green-700">Aceitar</button>
                                    </div>
                                </div>
                            ))}
                        </section>
                    )}

                    <section>
                        <h3 className="text-xl font-semibold mb-4 text-gray-900">Eventos de Hoje</h3>
                        {loading ? <p>Carregando...</p> : todayEvents.length > 0 ? todayEvents.map(event => {
                             const volunteerRecord = (event.event_volunteers || []).find(v => v.volunteer_id === volunteerProfile?.id);
                             const departmentInfo = volunteerRecord ? event.event_departments?.find(ed => ed.departments?.id === volunteerRecord.department_id)?.departments : null;
                             const isLive = new Date() >= new Date(`${event.date}T${event.start_time}`) && new Date() <= new Date(`${event.date}T${event.end_time}`);

                            return (
                                <div key={event.id} className="bg-blue-50 p-5 rounded-lg shadow-sm">
                                    <h4 className="font-semibold text-lg text-gray-900">{event.name}</h4>
                                    <p className="text-sm text-gray-500 mb-4">{new Date(event.date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' })} • {event.start_time.substring(0,5)} - {event.end_time.substring(0,5)}</p>
                                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                        {departmentInfo && (
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-sm text-gray-600">
                                                <div className="flex items-center gap-1.5">
                                                    {getDepartmentIcon(departmentInfo.name)}
                                                    <span>{departmentInfo.name}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>
                                                    <span>Líder: {departmentInfo.leader}</span>
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2 w-full flex-wrap sm:w-auto">
                                             <button onClick={() => isLive ? setIsScannerOpen(true) : {}} disabled={!isLive} className="flex-2 sm:flex-none px-4 py-2 text-sm font-medium bg-green-500 text-white rounded-md hover:bg-green-600 flex items-center gap-3 disabled:bg-green-300 disabled:cursor-not-allowed">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-1.036.84-1.875 1.875-1.875h4.5c1.036 0 1.875.84 1.875 1.875v4.5c0 1.036-.84 1.875-1.875 1.875h-4.5A1.875 1.875 0 0 1 3.75 9.375v-4.5zM3.75 14.625c0-1.036.84-1.875 1.875-1.875h4.5c1.036 0 1.875.84 1.875 1.875v4.5c0 1.036-.84 1.875-1.875 1.875h-4.5a1.875 1.875 0 0 1-1.875-1.875v-4.5zM13.5 4.875c0-1.036.84-1.875 1.875-1.875h4.5c1.036 0 1.875.84 1.875 1.875v4.5c0 1.036-.84 1.875-1.875 1.875h-4.5a1.875 1.875 0 0 1-1.875-1.875v-4.5z" /><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 12.75h.008v.008h-.008v-.008zM17.25 16.5h.008v.008h-.008v-.008zM17.25 20.25h.008v.008h-.008v-.008zM13.5 20.25h.008v.008h-.008v-.008zM13.5 16.5h.008v.008h-.008v-.008zM13.5 12.75h.008v.008h-.008v-.008z" /></svg>
                                                <span>Presença</span>
                                            </button>
                                            <button onClick={() => isLive ? handleGenerateQrCode(event) : {}} disabled={!isLive} className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium bg-primary text-white rounded-md hover:bg-primary/90 disabled:bg-blue-300 disabled:cursor-not-allowed">Gerar QR Code</button>
                                        </div>
                                    </div>
                                </div>
                            )
                        }) : (
                            <div className="bg-white p-5 rounded-lg shadow-sm text-center text-gray-500">
                                <p>Você não tem eventos para hoje.</p>
                            </div>
                        )}
                    </section>
                </div>
                <div>
                    <h3 className="text-xl font-semibold mb-4 text-gray-900">Próximos Eventos</h3>
                     {loading ? <p>Carregando...</p> : upcomingEvents.length > 0 ? (
                        <div className="space-y-4">
                         {upcomingEvents.map(event => {
                             const volunteerRecord = (event.event_volunteers || []).find(v => v.volunteer_id === volunteerProfile?.id);
                             const departmentInfo = volunteerRecord ? event.event_departments?.find(ed => ed.departments?.id === volunteerRecord.department_id)?.departments : null;
                             const isSwapPending = pendingSwaps.has(event.id);

                            return (
                                <div key={event.id} className="bg-white p-5 rounded-lg shadow-sm">
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                        <div className="flex-1">
                                            <h4 className="font-semibold text-lg text-gray-900">{event.name}</h4>
                                            <p className="text-sm text-gray-500 mb-3">{new Date(event.date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' })} • {event.start_time.substring(0,5)} - {event.end_time.substring(0,5)}</p>
                                             {departmentInfo && (
                                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-x-4 gap-y-2 text-sm text-gray-600">
                                                    <div className="flex items-center gap-1.5">
                                                                                                                  {getDepartmentIcon(departmentInfo.name)}
                                                        <span>{departmentInfo.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0  24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>
                                                        <span>Líder: {departmentInfo.leader}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                         {isSwapPending ? (
                                             <button disabled className="w-full sm:w-auto px-4 py-2 text-sm font-medium bg-yellow-100 text-yellow-600 rounded-md cursor-not-allowed">Troca Pendente</button>
                                         ) : (
                                            <button onClick={() => handleRequestSwap(event)} className="w-full sm:w-auto px-4 py-2 text-sm font-medium bg-orange-100 text-orange-600 rounded-md hover:bg-orange-200">Preciso Trocar</button>
                                         )}
                                    </div>
                                </div>
                            )
                         })}
                         </div>
                     ) : (
                         <div className="bg-white p-5 rounded-lg shadow-sm text-center text-gray-500">
                            <p>Nenhum evento futuro na sua agenda.</p>
                        </div>
                     )}
                </div>
            </div>

            <LiveEventDetailsModal event={activeEvent} volunteerProfile={volunteerProfile} isOpen={isLiveEventModalOpen} onClose={() => setIsLiveEventModalOpen(false)} />
            <QRCodeDisplayModal 
                isOpen={isQrModalOpen}
                onClose={() => setIsQrModalOpen(false)}
                data={qrCodeData}
                title={`QR Code para ${qrCodeEvent?.name}`}
                volunteerName={volunteerProfile?.name}
                description="Apresente este código ao líder do seu departamento."
            />
            <RequestSwapModal
                isOpen={isSwapModalOpen}
                onClose={() => setIsSwapModalOpen(false)}
                event={swapRequestEvent}
                onSubmit={handleSubmitSwapRequest}
                isSubmitting={isSubmittingSwap}
            />
            <QRScannerModal
                isOpen={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onScanSuccess={handleScanSuccess}
                scanningEventName={activeEvent?.name}
            />
        </>
    );
};

export default VolunteerDashboard;