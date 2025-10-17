import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import StatsRow from './StatsRow';
import UpcomingShiftsList from './UpcomingShiftsList';
import ActiveVolunteersList from './ActiveVolunteersList';
// FIX: Moved ChartDataPoint to types.ts and updated import path.
import type { DashboardEvent, Stat, EnrichedUser, ChartDataPoint, Event, Page } from '../types';
import EventDetailsModal from './EventDetailsModal';
import AnalysisChart from './TrafficChart';
import ActivityFeed from './ActivityFeed';
import { supabase } from '../lib/supabaseClient';
import { getErrorMessage } from '../lib/utils';
import QRScannerModal from './QRScannerModal';
import QRCodeDisplayModal from './QRCodeDisplayModal';

interface LiveEventTimerProps {
  event: Event;
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

interface DashboardData {
    stats?: {
        activeVolunteers: Stat;
        departments: Stat;
        schedulesToday: Stat;
        schedulesTomorrow: Stat;
    };
    todaySchedules?: DashboardEvent[];
    upcomingSchedules?: DashboardEvent[];
    chartData?: ChartDataPoint[];
    activeLeaders?: EnrichedUser[];
}

interface DashboardProps {
    activeEvent: Event | null;
    onNavigate: (page: Page) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ activeEvent, onNavigate }) => {
  const [selectedEvent, setSelectedEvent] = useState<DashboardEvent | null>(null);
  const [dashboardData, setDashboardData] = useState<Partial<DashboardData>>({});
  const [error, setError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<{ role: string | null; department_id: number | null } | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanningEvent, setScanningEvent] = useState<DashboardEvent | null>(null);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [isQrDisplayOpen, setIsQrDisplayOpen] = useState(false);
  const [scannedQrData, setScannedQrData] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const { data: profileData, error } = await supabase
                    .from('profiles')
                    .select('role, department_id')
                    .eq('id', session.user.id)
                    .single();

                if (error) {
                    console.error("Error fetching user profile in Dashboard", getErrorMessage(error));
                    setUserProfile(null);
                } else {
                    setUserProfile(profileData as { role: string | null; department_id: number | null });
                }
            } else {
                setUserProfile(null);
            }
        } catch (err) {
             console.error("Exception fetching user profile in Dashboard", getErrorMessage(err));
             setUserProfile(null);
        }
    };
    fetchProfile();
  }, []);

  const fetchDashboardData = useCallback(async () => {
    // Clear previous data on refetch
    setDashboardData({}); 
    setError(null);

    // --- STAGE 1: Fetch fast stats and today's data first ---
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        const todayStr = today.toISOString().split('T')[0];
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        const [
            activeVolunteersCountRes,
            departmentsCountRes,
            schedulesTomorrowCountRes,
            todaySchedulesRes
        ] = await Promise.all([
            supabase.from('volunteers').select('*', { count: 'exact', head: true }).eq('status', 'Ativo'),
            supabase.from('departments').select('*', { count: 'exact', head: true }).eq('status', 'Ativo'),
            supabase.from('events').select('*', { count: 'exact', head: true }).eq('date', tomorrowStr),
            supabase.from('events').select('id, name, date, start_time, end_time, status, event_departments(departments(name)), event_volunteers(volunteer_id, present, volunteers(name))').eq('date', todayStr).order('start_time')
        ]);

        // FIX: Cast to unknown first to resolve type mismatch from Supabase client's inference.
        const todaySchedules = (todaySchedulesRes.data as unknown as DashboardEvent[]) || [];

        const initialStats = {
            activeVolunteers: { value: String(activeVolunteersCountRes.count ?? 0), change: 0 },
            departments: { value: String(departmentsCountRes.count ?? 0), change: 0 },
            schedulesToday: { value: String(todaySchedules.length), change: 0 },
            schedulesTomorrow: { value: String(schedulesTomorrowCountRes.count ?? 0), change: 0 },
        };

        // Update state with initial data, UI will re-render showing stats and today's events
        setDashboardData(prev => ({
            ...prev,
            stats: initialStats,
            todaySchedules: todaySchedules,
        }));
    } catch (err) {
        const errorMessage = getErrorMessage(err);
        console.error("Failed to fetch initial dashboard data:", errorMessage);
        setError(`Falha ao carregar dados essenciais: ${errorMessage}`);
    }

    // --- STAGE 2: Fetch remaining heavier content in the background ---
    try {
        const today = new Date(); // Recalculate just in case of long-running Stage 1
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split('T')[0];
        const next7Days = new Date(today);
        next7Days.setDate(today.getDate() + 7);
        const last30Days = new Date(today);
        last30Days.setDate(today.getDate() - 29);
        
        const next7DaysStr = next7Days.toISOString().split('T')[0];
        const last30DaysStr = last30Days.toISOString().split('T')[0];

        const [
            upcomingSchedulesRes,
            activeLeadersRes,
            chartEventsRes
        ] = await Promise.all([
            supabase.from('events').select('id, name, date, start_time, end_time, status, event_departments(departments(name)), event_volunteers(volunteer_id, present, volunteers(name))').gt('date', todayStr).lte('date', next7DaysStr).order('date').order('start_time').limit(10),
            supabase.functions.invoke('list-users', { body: { context: 'dashboard' } }),
            supabase.from('events').select('date, name, event_volunteers(count), event_departments(department_id)').gte('date', last30DaysStr).lte('date', todayStr)
        ]);
        
        // Process chart data
        const chartDataMap = new Map<string, { scheduledVolunteers: number; involvedDepartments: Set<number>; eventNames: string[] }>();
        if (chartEventsRes.data) {
            for (const event of chartEventsRes.data) {
                const date = event.date;
                if (!chartDataMap.has(date)) {
                    chartDataMap.set(date, { scheduledVolunteers: 0, involvedDepartments: new Set(), eventNames: [] });
                }
                const entry = chartDataMap.get(date)!;
                entry.scheduledVolunteers += (event.event_volunteers[0] as any)?.count ?? 0;
                (event.event_departments as any[]).forEach((ed: any) => entry.involvedDepartments.add(ed.department_id));
                entry.eventNames.push(event.name);
            }
        }

        const chartData: ChartDataPoint[] = [];
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
        
        // Update state with the rest of the data
        setDashboardData(prev => ({
            ...prev,
            // FIX: Cast to unknown first to resolve type mismatch from Supabase client's inference.
            upcomingSchedules: (upcomingSchedulesRes.data as unknown as DashboardEvent[]) || [],
            activeLeaders: activeLeadersRes.data?.users || [],
            chartData: chartData,
        }));
    } catch (err) {
         console.error("Failed to fetch secondary dashboard data:", getErrorMessage(err));
         // Optionally set a partial error message
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);
  
  const showNotification = useCallback((message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  const handleMarkAttendance = (event: DashboardEvent) => {
    setScanningEvent(event);
    setIsScannerOpen(true);
  };

  const handleScanSuccess = useCallback((decodedText: string) => {
    setIsScannerOpen(false);
    setScannedQrData(decodedText);
    setIsQrDisplayOpen(true);
  }, []);

  const handleConfirmAttendance = useCallback(async () => {
    if (!scannedQrData || !scanningEvent || !userProfile?.department_id) {
        showNotification("Dados insuficientes para confirmar presença.", 'error');
        return;
    }
    
    try {
        const data = JSON.parse(scannedQrData);
        if (!data.vId || !data.eId || !data.dId) {
            throw new Error("QR Code inválido: Faltando dados essenciais.");
        }
        if (data.eId !== scanningEvent?.id) {
            throw new Error("Este QR Code é para um evento diferente.");
        }
        if (data.dId !== userProfile.department_id) {
            throw new Error("Este voluntário não pertence ao seu departamento para este evento.");
        }

        const { error: invokeError } = await supabase.functions.invoke('mark-attendance', {
            body: { volunteerId: data.vId, eventId: data.eId, departmentId: data.dId },
        });

        if (invokeError) throw invokeError;
        
        const volunteerName = scanningEvent?.event_volunteers?.find(v => v.volunteer_id === data.vId)?.volunteers?.name || 'Voluntário';
        showNotification(`Presença de ${volunteerName} confirmada com sucesso!`, 'success');
        
        setDashboardData(prev => {
            if (!prev.todaySchedules) return prev;
            const newTodaySchedules = prev.todaySchedules.map(event => {
                if (event.id === scanningEvent.id) {
                    const updatedVolunteers = event.event_volunteers?.map(v => {
                        if (v.volunteer_id === data.vId) {
                            return { ...v, present: true };
                        }
                        return v;
                    });
                    return { ...event, event_volunteers: updatedVolunteers };
                }
                return event;
            });
            return { ...prev, todaySchedules: newTodaySchedules };
        });

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
    } finally {
        setScannedQrData(null);
        setIsQrDisplayOpen(false);
        setScanningEvent(null);
    }
  }, [scannedQrData, scanningEvent, userProfile, showNotification]);

  const scannedVolunteerName = useMemo(() => {
    if (!scannedQrData || !scanningEvent) return 'Voluntário';
    try {
        const data = JSON.parse(scannedQrData);
        return scanningEvent.event_volunteers?.find(v => v.volunteer_id === data.vId)?.volunteers?.name || 'Voluntário Desconhecido';
    } catch {
        return 'Dados Inválidos';
    }
  }, [scannedQrData, scanningEvent]);


  const handleViewDetails = (event: DashboardEvent) => {
    setSelectedEvent(event);
  };

  return (
    <div className="space-y-8">
       {notification && (
            <div className={`fixed top-20 right-4 z-[9999] p-4 rounded-lg shadow-lg text-white ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
                {notification.message}
            </div>
        )}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-slate-500 mt-1">Visão geral do sistema de voluntários</p>
        </div>

        {activeEvent && <LiveEventTimer event={activeEvent} onNavigate={onNavigate} />}
      </div>

      {error && <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">{error}</div>}

      <StatsRow stats={dashboardData.stats} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
        <div className="lg:col-span-2">
            {dashboardData.chartData ? (
                <AnalysisChart data={dashboardData.chartData} />
            ) : (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-full animate-pulse">
                    <div className="h-8 bg-slate-200 rounded w-1/2 mb-6"></div>
                    <div className="h-[300px] bg-slate-200 rounded"></div>
                </div>
            )}
        </div>
        <div className="lg:col-span-1">
            <ActiveVolunteersList stats={dashboardData.stats} />
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
         <div className="lg:col-span-2">
            <UpcomingShiftsList 
                todaySchedules={dashboardData.todaySchedules}
                upcomingSchedules={dashboardData.upcomingSchedules}
                onViewDetails={handleViewDetails}
                userRole={userProfile?.role ?? null}
                onMarkAttendance={handleMarkAttendance}
            />
         </div>
         <div className="lg:col-span-1">
            <ActivityFeed leaders={dashboardData.activeLeaders} />
         </div>
      </div>

      <EventDetailsModal 
        isOpen={!!selectedEvent}
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
       {isScannerOpen && (
            <QRScannerModal
                isOpen={isScannerOpen}
                onClose={() => {setIsScannerOpen(false); setScanningEvent(null);}}
                onScanSuccess={handleScanSuccess}
                scanningEventName={scanningEvent?.name}
            />
        )}
        {isQrDisplayOpen && (
            <QRCodeDisplayModal
                isOpen={isQrDisplayOpen}
                onClose={() => {
                    setIsQrDisplayOpen(false);
                    setScannedQrData(null);
                }}
                data={scannedQrData ? JSON.parse(scannedQrData) : null}
                title={`Confirmar Presença`}
                volunteerName={scannedVolunteerName}
                description="Verifique os dados do voluntário e confirme a presença."
                onConfirm={handleConfirmAttendance}
            />
        )}
    </div>
  );
};

export default Dashboard;