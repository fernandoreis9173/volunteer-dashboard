import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import StatsRow from './StatsRow';
import UpcomingShiftsList from './UpcomingShiftsList';
import ActiveVolunteersList from './ActiveVolunteersList';
// FIX: Moved ChartDataPoint to types.ts and updated import path.
import type { DashboardEvent, Stat, EnrichedUser, ChartDataPoint, Event, Page, DashboardData, DetailedVolunteer } from '../types';
import EventDetailsModal from './EventDetailsModal';
// FIX: Changed import to be a named import to match the export from TrafficChart.tsx
import { AnalysisChart } from './TrafficChart';
import ActivityFeed from './ActivityFeed';
import { supabase } from '../lib/supabaseClient';
import { getErrorMessage } from '../lib/utils';
import { useEvents, useDepartments, useInvalidateQueries } from '../hooks/useQueries';
import QRScannerModal from './QRScannerModal';
import AttendanceFlashCards from './AttendanceFlashCards';
import EventTimelineViewerModal from './EventTimelineViewerModal';

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
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

// FIX: Reverted UserProfileState to use a single `department_id` to enforce business rules.
interface UserProfileState {
    role: string | null;
    department_id: number | null;
    volunteer_id: number | null;
    status: string | null;
}

interface LeaderDashboardProps {
    userProfile: UserProfileState;
    activeEvent: Event | null;
    onNavigate: (page: Page) => void;
}

const LeaderDashboard: React.FC<LeaderDashboardProps> = ({ userProfile, activeEvent, onNavigate }) => {
    const [selectedEvent, setSelectedEvent] = useState<DashboardEvent | null>(null);
    const [departmentVolunteers, setDepartmentVolunteers] = useState<DetailedVolunteer[]>([]);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [scanningEvent, setScanningEvent] = useState<DashboardEvent | null>(null);
    const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
    const [viewingTimelineFor, setViewingTimelineFor] = useState<DashboardEvent | null>(null);
    const [departmentName, setDepartmentName] = useState<string>('');

    const { invalidateEvents } = useInvalidateQueries();

    // React Query for Events
    const currentYear = new Date().getFullYear();
    const startOfYear = `${currentYear}-01-01`;

    const { data: eventsData = [], isLoading: eventsLoading, error: eventsError } = useEvents({
        departmentId: userProfile?.department_id || undefined,
        startDate: startOfYear
    });

    const allDepartmentEvents = useMemo(() => {
        return (eventsData as unknown as DashboardEvent[]).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [eventsData]);

    // Fetch Volunteers and Department Name manually for now (could be optimized later)
    const fetchVolunteersAndDept = useCallback(async () => {
        if (!userProfile?.department_id) return;
        const leaderDepartmentId = userProfile.department_id;

        try {
            const [volunteerDepartmentsRes, departmentRes] = await Promise.all([
                supabase.from('volunteer_departments')
                    .select('*, volunteers!inner(*, volunteer_departments(departments(id, name)))')
                    .eq('department_id', leaderDepartmentId)
                    .eq('volunteers.status', 'Ativo'),
                supabase
                    .from('departments')
                    .select('name')
                    .eq('id', leaderDepartmentId)
                    .single()
            ]);

            if (volunteerDepartmentsRes.error) throw volunteerDepartmentsRes.error;
            if (departmentRes.error) throw departmentRes.error;

            if (departmentRes.data) {
                setDepartmentName(departmentRes.data.name);
            }

            const leaderVolunteers = (volunteerDepartmentsRes.data || []).map((vd: any) => vd.volunteers).filter(Boolean);
            const transformedVols = (leaderVolunteers || []).map((v: any) => ({ ...v, departments: v.volunteer_departments.map((vd: any) => vd.departments).filter(Boolean) }));
            setDepartmentVolunteers(transformedVols);

        } catch (err) {
            console.error("Failed to fetch volunteers/dept:", getErrorMessage(err));
        }
    }, [userProfile?.department_id]);

    useEffect(() => {
        fetchVolunteersAndDept();
    }, [fetchVolunteersAndDept]);

    const error = eventsError ? getErrorMessage(eventsError) : null;

    const dashboardData = useMemo(() => {
        if (!userProfile?.department_id) {
            // FIX: Return `stats` as `undefined` and include an empty `activeLeaders` array to satisfy the `DashboardData` type and fix downstream prop errors.
            return { stats: undefined, todaySchedules: [], upcomingSchedules: [], chartData: [], activeLeaders: [] };
        }

        const today = new Date();
        // Use local date for YYYY-MM-DD format to match DB dates which are typically stored without time or imply local date
        const todayStr = today.toLocaleDateString('en-CA'); // YYYY-MM-DD

        const next7Days = new Date(today);
        next7Days.setDate(today.getDate() + 7);
        const next7DaysStr = next7Days.toLocaleDateString('en-CA');

        const last30Days = new Date(today);
        last30Days.setDate(today.getDate() - 29);
        const last30DaysStr = last30Days.toLocaleDateString('en-CA');

        const currentYear = today.getFullYear();
        const startOfYear = `${currentYear}-01-01`;

        const todaySchedules = allDepartmentEvents.filter(e => e.date === todayStr);
        const upcomingSchedules = allDepartmentEvents.filter(e => e.date > todayStr && e.date <= next7DaysStr).slice(0, 10);
        const chartEvents = allDepartmentEvents.filter(e => e.date >= last30DaysStr && e.date <= todayStr);
        const annualEvents = allDepartmentEvents.filter(e => e.date >= startOfYear);

        // Get IDs of volunteers who BELONG to this department
        const departmentVolunteerIds = new Set(departmentVolunteers.map(v => v.id));

        // Count presences of volunteers who belong to this department, regardless of which department they were assigned to in the event
        const annualAttendanceCount = annualEvents.reduce((count, event) => {
            return count + (event.event_volunteers || []).filter(v => departmentVolunteerIds.has(v.volunteer_id) && v.present).length;
        }, 0);

        const newStats: DashboardData['stats'] = {
            activeVolunteers: { value: String(departmentVolunteers.length), change: 0 },
            departments: { value: '1', change: 0 },
            schedulesToday: { value: String(todaySchedules.length), change: 0 },
            upcomingSchedules: { value: String(allDepartmentEvents.filter(e => e.date > todayStr && e.date <= next7DaysStr).length), change: 0 },
            annualAttendance: { value: String(annualAttendanceCount), change: 0 },
        };

        const chartDataMap = new Map<string, { scheduledVolunteers: number; involvedDepartments: Set<number>; eventNames: string[] }>();
        for (const event of chartEvents) {
            const date = event.date;
            if (!chartDataMap.has(date)) {
                chartDataMap.set(date, { scheduledVolunteers: 0, involvedDepartments: new Set(), eventNames: [] });
            }
            const entry = chartDataMap.get(date)!;
            const scheduledInDept = (event.event_volunteers || []).filter(v => Number(v.department_id) === Number(userProfile.department_id)).length;
            entry.scheduledVolunteers += scheduledInDept;
            if (userProfile.department_id) {
                entry.involvedDepartments.add(userProfile.department_id);
            }
            entry.eventNames.push(event.name);
        }

        const newChartData: ChartDataPoint[] = [];
        for (let i = 0; i < 30; i++) {
            const day = new Date(last30Days);
            day.setDate(last30Days.getDate() + i);
            const dateStr = day.toISOString().split('T')[0];
            const dataForDay = chartDataMap.get(dateStr);
            newChartData.push({
                date: dateStr,
                scheduledVolunteers: dataForDay?.scheduledVolunteers || 0,
                involvedDepartments: dataForDay?.involvedDepartments.size || 0,
                eventNames: dataForDay?.eventNames || [],
            });
        }

        return {
            stats: newStats,
            todaySchedules,
            upcomingSchedules,
            chartData: newChartData,
            // FIX: Added an empty `activeLeaders` array. Although this component doesn't use it,
            // this ensures a consistent return type for `dashboardData` and resolves the type error for the `ActivityFeed` component.
            activeLeaders: [],
        };
    }, [allDepartmentEvents, departmentVolunteers, userProfile.department_id]);

    const [scanResult, setScanResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const showNotification = useCallback((message: string, type: 'success' | 'error') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 5000);
    }, []);

    const handleMarkAttendance = (event: DashboardEvent) => {
        setScanningEvent(event);
        setIsScannerOpen(true);
    };

    const handleAutoConfirmAttendance = useCallback(async (decodedText: string) => {
        // Se já estiver processando um resultado, ignora novos scans
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
            if (data.dId !== userProfile.department_id) {
                throw new Error("Este voluntário não pertence ao seu departamento para este evento.");
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

            if (invokeError) throw invokeError;

            const volunteerName = scanningEvent?.event_volunteers?.find(v => v.volunteer_id === data.vId)?.volunteers?.name || 'Voluntário';

            // Sucesso!
            setScanResult({ type: 'success', message: `${volunteerName}` });
            invalidateEvents();

            // Limpa o resultado após 2.5s para permitir novo scan
            setTimeout(() => {
                setScanResult(null);
            }, 2500);

        } catch (err: any) {
            let errorMsg = "Erro ao confirmar.";
            if (err.context && typeof err.context.json === 'function') {
                try {
                    const errorJson = await err.context.json();
                    if (errorJson && errorJson.error) errorMsg = errorJson.error;
                } catch { }
            } else {
                errorMsg = getErrorMessage(err);
            }

            // Erro!
            setScanResult({ type: 'error', message: errorMsg });

            // Limpa o erro após 4s
            setTimeout(() => {
                setScanResult(null);
            }, 4000);
        }
    }, [scanningEvent, scanResult, userProfile, invalidateEvents]);

    const handleViewDetails = (event: DashboardEvent) => {
        setSelectedEvent(event);
    };

    const isLeader = userProfile?.role === 'leader' || userProfile?.role === 'lider';
    const isAdmin = userProfile?.role === 'admin';

    return (
        <div className="space-y-8">
            {notification && (
                <div className={`fixed top-20 right-4 z-[9999] p-4 rounded-lg shadow-lg text-white ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
                    {notification.message}
                </div>
            )}
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Dashboard {departmentName && <span className="text-blue-600">- {departmentName}</span>}</h1>
                    <p className="text-slate-500 mt-1">Visão geral do sistema de voluntários.</p>
                </div>

                {activeEvent && <LiveEventTimer event={activeEvent} onNavigate={onNavigate} />}
            </div>

            {error && <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">{error}</div>}

            <StatsRow stats={dashboardData.stats} userRole={userProfile?.role} />

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
                    <ActiveVolunteersList volunteers={departmentVolunteers} stats={dashboardData.stats} userRole={userProfile?.role} />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
                <div className="lg:col-span-2">
                    <UpcomingShiftsList
                        todaySchedules={dashboardData.todaySchedules}
                        upcomingSchedules={dashboardData.upcomingSchedules}
                        onViewDetails={handleViewDetails}
                        userRole={userProfile?.role ?? null}
                        leaderDepartmentId={userProfile?.department_id}
                        onMarkAttendance={handleMarkAttendance}
                        onViewTimeline={setViewingTimelineFor}
                    />
                </div>
                <div className="lg:col-span-1 space-y-8">
                    {isLeader && userProfile && (
                        <AttendanceFlashCards
                            schedules={dashboardData.todaySchedules}
                            userProfile={userProfile}
                            departmentVolunteers={departmentVolunteers}
                        />
                    )}
                    {isAdmin && <ActivityFeed leaders={dashboardData.activeLeaders} />}
                </div>
            </div>

            <EventDetailsModal
                isOpen={!!selectedEvent}
                event={selectedEvent}
                onClose={() => setSelectedEvent(null)}
                userRole={userProfile?.role}
                leaderDepartmentId={userProfile?.department_id}
            />
            {isScannerOpen && (
                <QRScannerModal
                    isOpen={isScannerOpen}
                    onClose={() => { setIsScannerOpen(false); setScanningEvent(null); setScanResult(null); }}
                    onScanSuccess={handleAutoConfirmAttendance}
                    scanningEventName={scanningEvent?.name}
                    scanResult={scanResult}
                />
            )}
            <EventTimelineViewerModal
                isOpen={!!viewingTimelineFor}
                onClose={() => setViewingTimelineFor(null)}
                event={viewingTimelineFor}
            />
        </div>
    );
};

export default LeaderDashboard;