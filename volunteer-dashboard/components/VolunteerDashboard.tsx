
import React, { useState, useEffect, useCallback } from 'react';
import { Event as VolunteerEvent, DetailedVolunteer, Invitation, DashboardEvent, Page } from '../types';
import { supabase } from '../lib/supabaseClient';
import { type Session } from '@supabase/supabase-js';
import { getErrorMessage } from '../lib/utils';
import VolunteerStatCard from './VolunteerStatCard';
import LiveEventDetailsModal from './LiveEventDetailsModal';
import QRCodeDisplayModal from './QRCodeDisplayModal';

interface LiveEventTimerProps {
  event: VolunteerEvent;
  onNavigate: (page: Page) => void;
}

const LiveEventTimer: React.FC<LiveEventTimerProps> = ({ event, onNavigate }) => {
    const handleClick = () => {
        if (event.id) {
            sessionStorage.setItem('highlightEventId', String(event.id));
        }
        onNavigate('events');
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
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24" stroke="currentColor" strokeWidth={2}>
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

const VolunteerDashboard: React.FC<VolunteerDashboardProps> = ({ session, onDataChange, activeEvent, onNavigate }) => {
    const [volunteerProfile, setVolunteerProfile] = useState<DetailedVolunteer | null>(null);
    const [upcomingEvents, setUpcomingEvents] = useState<DashboardEvent[]>([]);
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [stats, setStats] = useState({ upcoming: 0, attended: 0, totalScheduled: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isLiveEventModalOpen, setIsLiveEventModalOpen] = useState(false);
    const [isQrModalOpen, setIsQrModalOpen] = useState(false);
    const [qrCodeData, setQrCodeData] = useState<object | null>(null);
    const [qrCodeEvent, setQrCodeEvent] = useState<DashboardEvent | null>(null);

    const fetchDashboardData = useCallback(async () => {
        if (!session?.user) return;
        setLoading(true);
        setError(null);
        try {
            const { data: volProfile, error: volError } = await supabase.from('volunteers').select('*').eq('user_id', session.user.id).single();
            if (volError) throw volError;
            setVolunteerProfile(volProfile as DetailedVolunteer);
            const volunteerId = volProfile.id;

            const today = new Date().toISOString().split('T')[0];

            const { data: eventsData, error: eventsError } = await supabase.from('events').select('id, name, date, start_time, end_time, status, event_departments(departments(id, name)), event_volunteers!inner(volunteer_id, present, department_id, volunteers(name))').eq('event_volunteers.volunteer_id', volunteerId).gte('date', today).order('date', { ascending: true }).limit(5);
            if (eventsError) throw eventsError;
            setUpcomingEvents(eventsData as unknown as DashboardEvent[]);

            const { data: invData, error: invError } = await supabase.from('invitations').select('*, departments(name, leader)').eq('volunteer_id', volunteerId).eq('status', 'pendente');
            if (invError) throw invError;
            setInvitations(invData as Invitation[]);

            const { count: attendedCount, error: attendedError } = await supabase.from('event_volunteers').select('*', { count: 'exact', head: true }).eq('volunteer_id', volunteerId).eq('present', true);
            if (attendedError) throw attendedError;
            const { count: totalCount, error: totalError } = await supabase.from('event_volunteers').select('*', { count: 'exact', head: true }).eq('volunteer_id', volunteerId);
            if (totalError) throw totalError;

            setStats({
                upcoming: eventsData.length,
                attended: attendedCount ?? 0,
                totalScheduled: totalCount ?? 0
            });
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

    const UpcomingEventCard: React.FC<{ event: DashboardEvent }> = ({ event }) => (
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="min-w-0">
                <p className="font-bold text-slate-800 truncate">{event.name}</p>
                <p className="text-sm text-slate-500">{new Date(event.date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' })} • {event.start_time.substring(0,5)} - {event.end_time.substring(0,5)}</p>
            </div>
            <button onClick={() => handleGenerateQrCode(event)} className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg text-sm hover:bg-slate-50 w-full sm:w-auto">
                Gerar QR Code
            </button>
        </div>
    );

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

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Olá, {getShortName(session?.user?.user_metadata?.name)}!</h1>
                    <p className="text-slate-500 mt-1">Bem-vindo(a) ao seu painel.</p>
                </div>
                {activeEvent && <LiveEventTimer event={activeEvent} onNavigate={handleLiveEventNavigate} />}
            </div>

            {error && <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">{error}</div>}

            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 animate-pulse">
                    <div className="h-24 bg-slate-200 rounded-xl"></div>
                    <div className="h-24 bg-slate-200 rounded-xl"></div>
                    <div className="h-24 bg-slate-200 rounded-xl"></div>
                </div>
            ) : (
                <div className="flex overflow-x-auto space-x-4 pb-4 -mx-6 px-6">
                    <VolunteerStatCard title="Próximos Eventos" value={stats.upcoming} icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0h18" /></svg>} color="blue" />
                    <VolunteerStatCard title="Presenças Confirmadas" value={stats.attended} icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>} color="green" />
                    <VolunteerStatCard title="Total de Escalas" value={stats.totalScheduled} icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 5.25h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5" /></svg>} color="purple" />
                </div>
            )}
            
            {invitations.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-xl font-bold text-slate-800">Convites Pendentes</h2>
                    {invitations.map(inv => <InvitationCard key={inv.id} invitation={inv} />)}
                </div>
            )}

            <div className="space-y-3">
                <h2 className="text-xl font-bold text-slate-800">Seus Próximos Eventos</h2>
                {loading ? <p>Carregando...</p> : upcomingEvents.length > 0 ? (
                    upcomingEvents.map(event => <UpcomingEventCard key={event.id} event={event} />)
                ) : (
                    <p className="text-slate-500 bg-slate-50 p-4 rounded-lg">Você não está escalado para nenhum evento futuro.</p>
                )}
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
        </div>
    );
};

export default VolunteerDashboard;
