import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Event as VolunteerEvent, DetailedVolunteer, Invitation, DashboardEvent, Page } from '../types';
import { supabase } from '../lib/supabaseClient';
import { type Session } from '@supabase/supabase-js';
import { getErrorMessage } from '../lib/utils';
import VolunteerStatCard from './VolunteerStatCard';
import LiveEventDetailsModal from './LiveEventDetailsModal';
import QRCodeDisplayModal from './QRCodeDisplayModal'; // Import the QR Code modal

interface LiveEventTimerProps {
  event: VolunteerEvent;
  onNavigate: (page: Page) => void;
}

const LiveEventTimer: React.FC<LiveEventTimerProps> = ({ event, onNavigate }) => {
    const handleClick = () => {
        // For volunteers, onNavigate will trigger a modal instead of a page change.
        // We still set sessionStorage in case behavior changes or for consistency.
        if (event.id) {
            sessionStorage.setItem('highlightEventId', String(event.id));
        }
        onNavigate('events'); // The parent component will intercept this.
    };

    return (
        <div
            className="block md:inline-block bg-red-50 border border-red-200 rounded-lg p-4"
            aria-label="Um evento está ao vivo"
        >
            <div className="flex justify-between md:justify-start items-center gap-4">
                {/* Left side: Live Indicator, Text, and Event Name */}
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
                
                {/* Right side: Action Button */}
                <button
                    onClick={handleClick}
                    className="p-2 text-red-600 hover:text-red-800 bg-red-100 hover:bg-red-200 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-400 flex-shrink-0"
                    aria-label="Ver detalhes do evento"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
    if (nameParts.length > 1) {
        return `${nameParts[0]} ${nameParts[1]}`;
    }
    return nameParts[0];
};

const parseArrayData = (data: string[] | string | null | undefined): string[] => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === 'string') {
        if (data.startsWith('[') && data.endsWith(']')) {
            try {
                const parsed = JSON.parse(data);
                if (Array.isArray(parsed)) return parsed;
            } catch (e) { /* ignore */ }
        }
        if (data.startsWith('{') && data.endsWith('}')) {
             return data.substring(1, data.length - 1).split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        }
        if (data.trim()) {
            return data.split(',').map(s => s.trim());
        }
    }
    return [];
};

const ScheduleCard: React.FC<{ 
    schedule: VolunteerEvent & { department_id_for_volunteer?: number, is_present_for_volunteer?: boolean | null }; 
    onGenerateQr: () => void;
    onShowQr: () => void;
    isQrGenerated: boolean;
    isToday: boolean;
}> = ({ schedule, onGenerateQr, onShowQr, isQrGenerated, isToday }) => {
    const departmentNames = (schedule.event_departments || []).map(ed => ed.departments?.name).filter(Boolean).join(', ');
    const isPresent = schedule.is_present_for_volunteer;
  
    return (
      <div className="w-80 lg:w-full flex-shrink-0 p-4 rounded-xl border bg-white border-slate-200">
        <h3 className="font-bold text-slate-800 mb-2">{schedule.name}</h3>
        <div className="space-y-2 text-sm text-slate-500">
          <p><strong>Departamento:</strong> <span className="text-blue-600 font-medium">{departmentNames}</span></p>
          <p><strong>Data:</strong> {new Date(schedule.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
          <p><strong>Horário:</strong> {schedule.start_time} - {schedule.end_time}</p>
          {schedule.local && <p><strong>Local:</strong> {schedule.local}</p>}
        </div>
        {isToday && (
            <div className="mt-4 pt-4 border-t border-slate-200">
                 {isPresent ? (
                    <div className="w-full bg-green-100 text-green-800 font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Presença Confirmada
                    </div>
                 ) : isQrGenerated ? (
                     <button 
                        onClick={onShowQr}
                        className="w-full bg-slate-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                           <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /><path d="M3 8V6a2 2 0 0 1 2-2h2" /><path d="M3 16v2a2 2 0 0 0 2 2h2" /><path d="M21 8V6a2 2 0 0 0-2-2h-2" /><path d="M21 16v2a2 2 0 0 1-2 2h-2" />
                        </svg>
                        Ver QRCODE
                    </button>
                ) : (
                    <button 
                        onClick={onGenerateQr}
                        className="w-full bg-teal-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-teal-600 transition-colors flex items-center justify-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /><path d="M3 8V6a2 2 0 0 1 2-2h2" /><path d="M3 16v2a2 2 0 0 0 2 2h2" /><path d="M21 8V6a2 2 0 0 0-2-2h-2" /><path d="M21 16v2a2 2 0 0 1-2 2h-2" /></svg>
                        Gerar QR Presença
                    </button>
                )}
            </div>
        )}
      </div>
    );
};

const VolunteerDashboard: React.FC<VolunteerDashboardProps> = ({ session, onDataChange, activeEvent, onNavigate }) => {
  const [todaySchedules, setTodaySchedules] = useState<(VolunteerEvent & { department_id_for_volunteer?: number; is_present_for_volunteer?: boolean | null; })[]>([]);
  const [upcomingSchedules, setUpcomingSchedules] = useState<VolunteerEvent[]>([]);
  const [volunteerProfile, setVolunteerProfile] = useState<DetailedVolunteer | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [invitationError, setInvitationError] = useState<string | null>(null);
  const [isLiveEventModalOpen, setIsLiveEventModalOpen] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<object | null>(null);
  const [qrCodeTitle, setQrCodeTitle] = useState('');
  const [attendanceStats, setAttendanceStats] = useState<{ totalSchedules: number; totalPresences: number } | null>(null);
  
  const upcomingSchedulesRef = useRef<HTMLDivElement>(null);
  const [showUpcomingOverflow, setShowUpcomingOverflow] = useState({ horizontal: false, vertical: false });

  // Initialize state from sessionStorage to persist across refreshes.
  const [generatedQrCodes, setGeneratedQrCodes] = useState<Record<number, object>>(() => {
    try {
        const item = sessionStorage.getItem('volunteerAppGeneratedQRCodes');
        return item ? JSON.parse(item) : {};
    } catch (error) {
        console.error('Error reading generated QR codes from sessionStorage:', error);
        return {};
    }
  });

  // Effect to save the QR code state to sessionStorage whenever it changes.
  useEffect(() => {
    try {
        sessionStorage.setItem('volunteerAppGeneratedQRCodes', JSON.stringify(generatedQrCodes));
    } catch (error) {
        console.error('Error saving generated QR codes to sessionStorage:', error);
    }
  }, [generatedQrCodes]);

  const checkUpcomingOverflow = useCallback(() => {
    const el = upcomingSchedulesRef.current;
    if (el) {
        const isMobile = window.innerWidth < 1024; // Corresponds to lg breakpoint
        if (isMobile) {
            const hasHorizontalOverflow = el.scrollWidth > el.clientWidth;
            // Check if scrolled nearly to the end with a small buffer
            const isScrolledToEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 10;
            setShowUpcomingOverflow({
                horizontal: hasHorizontalOverflow && !isScrolledToEnd,
                vertical: false,
            });
        } else { // Desktop
            const hasVerticalOverflow = el.scrollHeight > el.clientHeight;
            const isScrolledToBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 10;
            setShowUpcomingOverflow({
                horizontal: false,
                vertical: hasVerticalOverflow && !isScrolledToBottom,
            });
        }
    }
  }, []);

  useEffect(() => {
    // Timeout to allow layout to settle after data has been rendered
    const timer = setTimeout(() => {
        checkUpcomingOverflow();
    }, 150);

    window.addEventListener('resize', checkUpcomingOverflow);
    return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', checkUpcomingOverflow);
    };
  }, [loading, upcomingSchedules, checkUpcomingOverflow]);

  const fetchVolunteerData = useCallback(async () => {
    if (!session) return;
    setLoading(true);

    try {
        const { data: volunteerData, error: volunteerError } = await supabase
            .from('volunteers')
            .select('id, name, phone, initials, status, departments:departaments, skills, availability')
            .eq('user_id', session.user.id)
            .single();

        if (volunteerError || !volunteerData) {
            throw volunteerError || new Error("Volunteer profile not found.");
        }
        
        setVolunteerProfile(volunteerData as DetailedVolunteer);
        
        const d = new Date();
        const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        
        const [
            todayQuery, 
            upcomingQuery, 
            invitationQuery,
            schedulesCountRes,
            presencesCountRes
        ] = await Promise.all([
             supabase
              .from('events')
              .select('*, event_departments(departments(name)), event_volunteers!inner(department_id, present)')
              .eq('date', today)
              .eq('event_volunteers.volunteer_id', volunteerData.id)
              .order('start_time', { ascending: true }),
            supabase
              .from('events')
              .select('*, event_departments(departments(name)), event_volunteers!inner(department_id)')
              .gt('date', today)
              .eq('event_volunteers.volunteer_id', volunteerData.id)
              .order('date', { ascending: true })
              .order('start_time', { ascending: true }),
            supabase
              .from('invitations')
              .select('*, departments(name, leader)')
              .eq('volunteer_id', volunteerData.id)
              .eq('status', 'pendente'),
            supabase
              .from('event_volunteers')
              .select('*', { count: 'exact', head: true })
              .eq('volunteer_id', volunteerData.id),
            supabase
              .from('event_volunteers')
              .select('*', { count: 'exact', head: true })
              .eq('volunteer_id', volunteerData.id)
              .eq('present', true)
        ]);

        if (schedulesCountRes.error || presencesCountRes.error) {
            console.error("Error fetching attendance stats", schedulesCountRes.error || presencesCountRes.error);
        } else {
            setAttendanceStats({
                totalSchedules: schedulesCountRes.count ?? 0,
                totalPresences: presencesCountRes.count ?? 0,
            });
        }
        
        const { data: todayData, error: todayError } = todayQuery;
        if (todayError) throw todayError;
        const fetchedTodaySchedules = (todayData || []).map(event => {
            const volunteerEntry = event.event_volunteers[0];
            return {
                ...event,
                department_id_for_volunteer: volunteerEntry?.department_id,
                is_present_for_volunteer: volunteerEntry?.present,
            };
        }).filter(item => item.id);
        setTodaySchedules(fetchedTodaySchedules as (VolunteerEvent & { department_id_for_volunteer?: number, is_present_for_volunteer?: boolean | null })[]);

        const { data: upcomingData, error: upcomingError } = upcomingQuery;
        if (upcomingError) throw upcomingError;
        const fetchedUpcomingSchedules = (upcomingData || []).filter((event): event is VolunteerEvent => !!event.id);
        setUpcomingSchedules(fetchedUpcomingSchedules);
        
        const { data: invitationData, error: invitationError } = invitationQuery;
        if(invitationError) throw invitationError;
        setInvitations((invitationData as Invitation[]) || []);

    } catch (error) {
        console.error("Error fetching volunteer dashboard data:", getErrorMessage(error));
        setTodaySchedules([]);
        setUpcomingSchedules([]);
        setVolunteerProfile(null);
        setInvitations([]);
        setAttendanceStats(null);
    } finally {
        setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchVolunteerData();
  }, [fetchVolunteerData]);

  useEffect(() => {
    if (!session?.user?.id || !volunteerProfile?.id) {
        return;
    }

    const channel = supabase
        .channel(`realtime-attendance:${volunteerProfile.id}`)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'event_volunteers',
                filter: `volunteer_id=eq.${volunteerProfile.id}`,
            },
            (payload) => {
                const updatedRecord = payload.new as { event_id: number; present: boolean };
                
                if (updatedRecord.present === true) {
                    setTodaySchedules(prevSchedules => 
                        prevSchedules.map(schedule => {
                            if (schedule.id === updatedRecord.event_id) {
                                // Close QR code modal if it's open for this event
                                if (qrCodeData && (qrCodeData as any).eId === updatedRecord.event_id) {
                                    setQrCodeData(null);
                                }
                                return {
                                    ...schedule,
                                    is_present_for_volunteer: true,
                                };
                            }
                            return schedule;
                        })
                    );
                }
            }
        )
        .subscribe();
    
    return () => {
        supabase.removeChannel(channel);
    };
  }, [session, volunteerProfile, qrCodeData]);
  
  const handleGenerateQr = (schedule: VolunteerEvent & { department_id_for_volunteer?: number }) => {
    if (volunteerProfile && schedule.id && schedule.department_id_for_volunteer) {
        const newQrData = {
            vId: volunteerProfile.id,
            eId: schedule.id,
            dId: schedule.department_id_for_volunteer,
        };
        setGeneratedQrCodes(prev => ({ ...prev, [schedule.id!]: newQrData }));
        setQrCodeData(newQrData);
        setQrCodeTitle(schedule.name);
    }
  };

  const handleShowQr = (schedule: VolunteerEvent & { department_id_for_volunteer?: number }) => {
      if (schedule.id && generatedQrCodes[schedule.id]) {
          setQrCodeData(generatedQrCodes[schedule.id]);
          setQrCodeTitle(schedule.name);
      }
  };


  useEffect(() => {
    const eventIdToShow = sessionStorage.getItem('showEventDetailsForId');
    if (eventIdToShow) {
        sessionStorage.removeItem('showEventDetailsForId');
        // This was for opening the generic modal, which is now replaced for live events.
        // We can keep this logic if we want to navigate from notifications to a modal for NON-live events.
        // For now, the main functionality is the live event modal.
    }
  }, []); // Run only once on mount

  const handleInvitationResponse = async (invitationId: number, response: 'aceito' | 'recusado') => {
    setInvitationError(null);
    try {
      const { error } = await supabase.functions.invoke('respond-to-invitation', {
        body: { invitationId, response }
      });
      if (error) throw error;
      setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
      if (response === 'aceito') {
        onDataChange(); // Refetch profile to update department list
      }
    } catch (err) {
      setInvitationError(`Falha ao responder ao convite: ${getErrorMessage(err)}`);
    }
  };

  const handleLiveEventClick = useCallback((_page: Page) => {
    if (!activeEvent) return;
    setIsLiveEventModalOpen(true);
  }, [activeEvent]);

  const volunteerName = getShortName(volunteerProfile?.name);
  const volunteerDepartments = parseArrayData(volunteerProfile?.departments);
  const attendanceRate = attendanceStats && attendanceStats.totalSchedules > 0
    ? Math.round((attendanceStats.totalPresences / attendanceStats.totalSchedules) * 100)
    : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
        <div>
            <h1 className="text-3xl font-bold text-slate-800">Bem-vindo, {volunteerName}!</h1>
            <p className="text-slate-500 mt-1">Aqui estão suas próximas escalas e informações.</p>
        </div>
        {activeEvent && <LiveEventTimer event={activeEvent} onNavigate={handleLiveEventClick} />}
      </div>

       <div>
            <h2 className="text-xl font-bold text-slate-800">Minhas Estatísticas</h2>
             <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
            <div className="mt-4 flex space-x-4 overflow-x-auto pb-4 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-6 sm:space-x-0 no-scrollbar">
                <VolunteerStatCard
                    title="Total de Escalas"
                    value={loading || !attendanceStats ? '...' : attendanceStats.totalSchedules}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0h18" /></svg>}
                    color="blue"
                />
                 <VolunteerStatCard
                    title="Presenças Confirmadas"
                    value={loading || !attendanceStats ? '...' : attendanceStats.totalPresences}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>}
                    color="green"
                />
                 <VolunteerStatCard
                    title="Taxa de Presença"
                    value={loading || !attendanceStats ? '...' : `${attendanceRate}%`}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" /></svg>}
                    color="purple"
                />
                <VolunteerStatCard
                  title="Meus Departamentos"
                  value={loading ? '...' : volunteerDepartments.length}
                  icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18h16.5M5.25 6H18.75m-13.5 0V21m13.5-15V21m-10.5-9.75h.008v.008H8.25v-.008ZM8.25 15h.008v.008H8.25V15Zm3.75-9.75h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm3.75-9.75h.008v.008H15.75v-.008ZM15.75 15h.008v.008H15.75V15Z" /></svg>}
                  color="yellow"
                />
                <VolunteerStatCard
                  title="Eventos Hoje"
                  value={loading ? '...' : todaySchedules.length}
                  icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>}
                  color="purple"
                />
                <VolunteerStatCard
                  title="Próximas Escalas"
                  value={loading ? '...' : upcomingSchedules.length}
                  icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0h18" /></svg>}
                  color="blue"
                />
            </div>
        </div>

      {volunteerProfile?.status === 'Inativo' && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
            <div className="flex">
                <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 3.01-1.742 3.01H4.42c-1.53 0-2.493-1.676-1.743-3.01l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                </div>
                <div className="ml-3">
                    <h3 className="text-sm font-bold text-yellow-800">Seu Perfil está Inativo</h3>
                    <div className="mt-2 text-sm text-yellow-700">
                        <p>Você não poderá ser escalado para novos eventos enquanto seu perfil estiver inativo. Se acredita que isso é um erro, por favor, entre em contato com a administração.</p>
                    </div>
                </div>
            </div>
        </div>
      )}

       {invitations.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-slate-800 mb-4">Convites Recebidos</h2>
          {invitationError && <p className="text-red-500 text-sm mb-2">{invitationError}</p>}
          <div className="space-y-3">
            {invitations.map(inv => (
              <div key={inv.id} className="bg-white p-4 rounded-lg border border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="w-full sm:w-auto text-left">
                  <p className="text-slate-800">
                    Você foi convidado(a) para o departamento <span className="font-bold">{inv.departments?.name}</span>.
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Líder: {inv.departments?.leader}</p>
                </div>
                <div className="w-full sm:w-auto flex items-center gap-4">
                  <button onClick={() => handleInvitationResponse(inv.id, 'aceito')} className="flex-1 text-center px-5 py-3 bg-green-500 text-white text-base font-bold rounded-lg hover:bg-green-600">Aceitar</button>
                  <button onClick={() => handleInvitationResponse(inv.id, 'recusado')} className="flex-1 text-center px-5 py-3 bg-red-500 text-white text-base font-bold rounded-lg hover:bg-red-600">Recusar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
              <h2 className="text-xl font-bold text-slate-800 mb-4">Escalas de Hoje</h2>
              <div className="bg-white p-4 rounded-2xl shadow-sm relative">
                  {loading ? (
                      <div className="h-48 flex items-center justify-center">
                          <p className="text-slate-500">Carregando...</p>
                      </div>
                  ) : todaySchedules.length > 0 ? (
                      <div className="flex space-x-4 overflow-x-auto pb-2 no-scrollbar lg:block lg:space-x-0 lg:space-y-4 lg:overflow-visible lg:pb-0">
                          {todaySchedules.map(schedule => (
                              <ScheduleCard
                                key={schedule.id}
                                schedule={schedule}
                                onGenerateQr={() => handleGenerateQr(schedule)}
                                onShowQr={() => handleShowQr(schedule)}
                                isQrGenerated={!!generatedQrCodes[schedule.id!]}
                                isToday={true}
                              />
                          ))}
                      </div>
                  ) : (
                      <div className="text-center h-48 flex flex-col items-center justify-center text-slate-500 p-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1"><path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                        <p className="mt-2 font-semibold">Nenhuma escala para hoje.</p>
                      </div>
                  )}
              </div>
          </div>
          
          <div>
              <h2 className="text-xl font-bold text-slate-800 mb-4">Próximas Escalas</h2>
              <div className="bg-white p-4 rounded-2xl shadow-sm relative">
                  {loading ? (
                      <div className="h-48 flex items-center justify-center">
                          <p className="text-slate-500">Carregando...</p>
                      </div>
                  ) : upcomingSchedules.length > 0 ? (
                      <div 
                        ref={upcomingSchedulesRef}
                        onScroll={checkUpcomingOverflow}
                        className="flex space-x-4 overflow-x-auto pb-2 no-scrollbar lg:block lg:space-x-0 lg:space-y-4 lg:overflow-y-auto lg:max-h-[480px] lg:pr-2"
                      >
                          {upcomingSchedules.map(schedule => (
                               <ScheduleCard
                                key={schedule.id}
                                schedule={schedule}
                                onGenerateQr={() => {}}
                                onShowQr={() => {}}
                                isQrGenerated={false}
                                isToday={false}
                              />
                          ))}
                      </div>
                  ) : (
                       <div className="text-center h-48 flex flex-col items-center justify-center text-slate-500 p-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <p className="mt-2 font-semibold">Nenhuma escala futura encontrada.</p>
                      </div>
                  )}
                  {showUpcomingOverflow.horizontal && (
                        <div className="absolute top-1/2 right-0 -translate-y-1/2 h-full w-16 bg-gradient-to-l from-white pointer-events-none lg:hidden flex items-center justify-end pr-2">
                            <div className="bg-blue-500 text-white rounded-full p-1 animate-pulse shadow-md">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                            </div>
                        </div>
                    )}
                    {showUpcomingOverflow.vertical && (
                        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white pointer-events-none hidden lg:flex items-end justify-center pb-2">
                            <div className="bg-blue-500 text-white rounded-full p-1 animate-pulse shadow-md">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </div>
                        </div>
                    )}
              </div>
          </div>
      </div>

      {activeEvent && volunteerProfile && (
        <LiveEventDetailsModal
          isOpen={isLiveEventModalOpen}
          onClose={() => setIsLiveEventModalOpen(false)}
          event={activeEvent}
          volunteerProfile={volunteerProfile}
        />
      )}

       <QRCodeDisplayModal
        isOpen={!!qrCodeData}
        onClose={() => setQrCodeData(null)}
        data={qrCodeData}
        title={`Presença para: ${qrCodeTitle}`}
        volunteerName={volunteerProfile?.name}
      />
    </div>
  );
};

export default VolunteerDashboard;