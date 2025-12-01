import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { EnrichedUser, DashboardData, DashboardEvent, ChartDataPoint, Page, Event } from '../types';
import { getErrorMessage } from '../lib/utils';
import { useEvents, useInvalidateQueries, useAdminDashboardStats } from '../hooks/useQueries';
import StatsRow from './StatsRow';
import UpcomingShiftsList from './UpcomingShiftsList';
import { AnalysisChart } from './TrafficChart';
import AttendanceFlashCards from './AttendanceFlashCards';
import EventDetailsModal from './EventDetailsModal';
import DashboardCalendar from './DashboardCalendar';
import EventTimelineViewerModal from './EventTimelineViewerModal';
import QRScannerModal from './QRScannerModal';
import PullToRefresh from './PullToRefresh';

interface LiveEventTimerProps {
    event: Event;
    onNavigate: (page: Page) => void;
}

const LiveEventTimer: React.FC<LiveEventTimerProps> = ({ event, onNavigate }) => {
    const handleClick = () => {
        if (event.id) {
            sessionStorage.setItem('editEventId', String(event.id));
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
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </button>
            </div>
        </div>
    );
};


interface AdminDashboardProps {
    activeEvent: Event | null;
    onNavigate: (page: Page) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ activeEvent, onNavigate }) => {
    const [selectedEvent, setSelectedEvent] = useState<DashboardEvent | null>(null);
    const [viewingTimelineFor, setViewingTimelineFor] = useState<DashboardEvent | null>(null);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [scanningEvent, setScanningEvent] = useState<DashboardEvent | null>(null);
    const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
    const [scanResult, setScanResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const { invalidateEvents, invalidateAll } = useInvalidateQueries();

    // React Query for Events
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const last30Days = new Date(today);
    last30Days.setDate(today.getDate() - 29);
    const last30DaysStr = last30Days.toISOString().split('T')[0];

    const { data: eventsData = [], isLoading: eventsLoading, error: eventsError } = useEvents({
        startDate: last30DaysStr
    });

    const { data: statsData, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useAdminDashboardStats();

    const dashboardData = useMemo(() => {
        const allEvents = (eventsData as unknown as DashboardEvent[]) || [];
        const activeLeaders = statsData?.activeLeaders || [];
        // @ts-ignore
        const departmentLeadersMap = statsData?.departmentLeadersMap || {};

        // Enrich events with leader names
        const enrichedEvents = allEvents.map(event => ({
            ...event,
            event_departments: event.event_departments?.map(ed => ({
                ...ed,
                departments: ed.departments ? {
                    ...ed.departments,
                    leader: departmentLeadersMap[String(ed.departments.id)] || ed.departments.leader
                } : null
            })) || null
        }));

        const next7Days = new Date(today);
        next7Days.setDate(today.getDate() + 7);
        const next7DaysStr = next7Days.toISOString().split('T')[0];

        const todaySchedules = enrichedEvents.filter(e => e.date === todayStr);
        const upcomingSchedules = enrichedEvents.filter(e => e.date > todayStr && e.date <= next7DaysStr);
        const chartEvents = enrichedEvents.filter(e => e.date <= todayStr);

        // --- Process Chart Data ---
        const chartDataMap = new Map<string, { scheduledVolunteers: number; involvedDepartments: Set<number>; eventNames: string[] }>();
        for (const event of chartEvents) {
            const date = event.date;
            if (!chartDataMap.has(date)) {
                chartDataMap.set(date, { scheduledVolunteers: 0, involvedDepartments: new Set(), eventNames: [] });
            }
            const entry = chartDataMap.get(date)!;
            entry.scheduledVolunteers += (event.event_volunteers || []).length;
            (event.event_departments || []).forEach(ed => {
                if (ed.departments?.id) entry.involvedDepartments.add(ed.departments.id)
            });
            entry.eventNames.push(event.name);
        }

        const chartData: ChartDataPoint[] = Array.from({ length: 30 }, (_, i) => {
            const day = new Date(last30Days);
            day.setDate(last30Days.getDate() + i);
            const dateStr = day.toISOString().split('T')[0];
            const dataForDay = chartDataMap.get(dateStr);
            return {
                date: dateStr,
                scheduledVolunteers: dataForDay?.scheduledVolunteers || 0,
                involvedDepartments: dataForDay?.involvedDepartments.size || 0,
                eventNames: dataForDay?.eventNames || [],
            };
        });

        return {
            stats: {
                activeVolunteers: { value: String(statsData?.activeVolunteers ?? 0), change: 0 },
                departments: { value: String(statsData?.departments ?? 0), change: 0 },
                schedulesToday: { value: String(todaySchedules.length), change: 0 },
                upcomingSchedules: { value: String(upcomingSchedules.length), change: 0 },
            },
            activeLeaders,
            todaySchedules,
            upcomingSchedules: upcomingSchedules.slice(0, 10),
            chartData,
            allEnrichedEvents: enrichedEvents,
        } as DashboardData & { allEnrichedEvents: DashboardEvent[] };

    }, [eventsData, statsData, todayStr, last30DaysStr]);

    const showNotification = useCallback((message: string, type: 'success' | 'error') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 5000);
    }, []);

    const handleMarkAttendance = (event: DashboardEvent | null) => {
        if (!event) {
            showNotification('Nenhum evento ativo para escanear.', 'error');
            return;
        }
        setScanningEvent(event);
        setIsScannerOpen(true);
    };

    const handleAutoConfirmAttendance = useCallback(async (decodedText: string) => {
        // Se já estiver processando um resultado (ex: mostrando sucesso), ignora novos scans
        if (scanResult) {
            return;
        }

        try {
            const data = JSON.parse(decodedText);

            // Validações básicas
            if (!data.vId || !data.eId || !data.dId) {
                throw new Error("QR Code incompleto.");
            }
            if (data.eId !== scanningEvent?.id) {
                throw new Error("Evento incorreto.");
            }

            const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !sessionData.session) {
                throw new Error("Sessão inválida.");
            }

            const { error: invokeError } = await supabase.functions.invoke('mark-attendance', {
                headers: {
                    Authorization: `Bearer ${sessionData.session.access_token}`,
                },
                body: { volunteerId: data.vId, eventId: data.eId, departmentId: data.dId },
            });

            if (invokeError) {
                throw invokeError;
            }

            const volunteerName = scanningEvent?.event_volunteers?.find(v => v.volunteer_id === data.vId)?.volunteers?.name || 'Voluntário';

            // Sucesso!
            setScanResult({ type: 'success', message: `${volunteerName}` });
            invalidateEvents();

            // Limpa o resultado após 2.5s para permitir novo scan
            setTimeout(() => {
                setScanResult(null);
            }, 2500);

        } catch (err: any) {
            console.log('[AdminDashboard] ❌ Erro capturado:', err);
            let errorMsg = "Erro ao confirmar.";
            if (err.context && typeof err.context.json === 'function') {
                try {
                    const errorJson = await err.context.json();
                    console.log('[AdminDashboard] Erro JSON da edge function:', errorJson);
                    if (errorJson && errorJson.error) errorMsg = errorJson.error;
                } catch { }
            } else {
                errorMsg = getErrorMessage(err);
            }

            console.log('[AdminDashboard] 📢 Mensagem de erro final:', errorMsg);

            // Erro!
            setScanResult({ type: 'error', message: errorMsg });

            // Limpa o erro após 4s
            setTimeout(() => {
                setScanResult(null);
            }, 4000);
        }
    }, [scanningEvent, scanResult, invalidateEvents]);

    const handleRefresh = async () => {
        await Promise.all([
            invalidateAll(),
            refetchStats()
        ]);
    };

    return (
        <PullToRefresh onRefresh={handleRefresh}>
            <div className="space-y-8">
                {notification && (
                    <div className={`fixed top-20 right-4 z-[9999] p-4 rounded-lg shadow-lg text-white ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
                        {notification.message}
                    </div>
                )}
                <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Dashboard</h1>
                        <p className="text-slate-500 mt-1">Visão geral do sistema de voluntários.</p>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center gap-4 w-full md:w-auto">
                        {activeEvent && <LiveEventTimer event={activeEvent} onNavigate={onNavigate} />}
                        {
                            activeEvent && (
                                <button
                                    onClick={() => handleMarkAttendance(activeEvent)}
                                    className="p-4 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition-colors flex flex-row items-center justify-center gap-3 w-full md:w-auto md:px-6"
                                    aria-label="Marcar Presença"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="h-7 w-7 md:h-6 md:w-6">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8V6a2 2 0 0 1 2-2h2" /><path strokeLinecap="round" strokeLinejoin="round" d="M3 16v2a2 2 0 0 0 2 2h2" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 8V6a2 2 0 0 0-2-2h-2" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 16v2a2 2 0 0 1-2 2h-2" />
                                    </svg>
                                    <span className="text-lg md:text-base font-semibold">Marcar Presença</span>
                                </button>
                            )
                        }
                    </div>
                </div>

                {statsError && <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">{getErrorMessage(statsError)}</div>}
                <StatsRow stats={dashboardData.stats} userRole="admin" />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
                    <div className="lg:col-span-2">
                        {dashboardData.chartData ? <AnalysisChart data={dashboardData.chartData} /> : <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-full animate-pulse"><div className="h-8 bg-slate-200 rounded w-1/2 mb-6"></div><div className="h-[300px] bg-slate-200 rounded"></div></div>}
                    </div>
                    <div className="lg:col-span-1">
                        <DashboardCalendar events={dashboardData.allEnrichedEvents || []} />
                    </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
                    <div className="lg:col-span-2">
                        <UpcomingShiftsList
                            todaySchedules={dashboardData.todaySchedules}
                            upcomingSchedules={dashboardData.upcomingSchedules}
                            onViewDetails={setSelectedEvent}
                            userRole="admin"
                            leaderDepartmentId={null}
                            onMarkAttendance={handleMarkAttendance}
                            onViewTimeline={setViewingTimelineFor}
                        />
                    </div>
                    <div className="lg:col-span-1">
                        <AttendanceFlashCards
                            schedules={dashboardData.todaySchedules}
                            userProfile={{ role: 'admin', department_id: null, volunteer_id: null, status: 'Ativo' }}
                            departmentVolunteers={[]}
                            showAllDepartments={true}
                        />
                    </div>
                </div>
                <EventDetailsModal isOpen={!!selectedEvent} event={selectedEvent} onClose={() => setSelectedEvent(null)} />
                {
                    isScannerOpen && (
                        <QRScannerModal
                            isOpen={isScannerOpen}
                            onClose={() => { setIsScannerOpen(false); setScanningEvent(null); setScanResult(null); }}
                            onScanSuccess={handleAutoConfirmAttendance}
                            scanningEventName={scanningEvent?.name}
                            scanResult={scanResult}
                        />
                    )
                }
                <EventTimelineViewerModal
                    isOpen={!!viewingTimelineFor}
                    onClose={() => setViewingTimelineFor(null)}
                    event={viewingTimelineFor}
                />
            </div>
        </PullToRefresh>
    );
};

export default AdminDashboard;