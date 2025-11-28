import React, { useState, useEffect, useCallback, useMemo } from 'react';
import StatsRow from './StatsRow';
import UpcomingShiftsList from './UpcomingShiftsList';
import DepartmentRankingWidget from './DepartmentRankingWidget';
import type { DashboardEvent, ChartDataPoint, Event, Page, DashboardData, DetailedVolunteer } from '../types';
import EventDetailsModal from './EventDetailsModal';
import { AnalysisChart } from './TrafficChart';
import ActivityFeed from './ActivityFeed';
import { supabase } from '../lib/supabaseClient';
import { getErrorMessage } from '../lib/utils';
import { useInvalidateQueries, useLeaderDashboardData } from '../hooks/useQueries';
import QRScannerModal from './QRScannerModal';
import AttendanceFlashCards from './AttendanceFlashCards';
import EventTimelineViewerModal from './EventTimelineViewerModal';
import PullToRefresh from './PullToRefresh';

interface UserProfileState {
    role: string | null;
    department_id: number | null;
    volunteer_id: number | null;
    status: string | null;
}

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

interface LeaderDashboardProps {
    userProfile: UserProfileState;
    activeEvent: Event | null;
    onNavigate: (page: Page) => void;
}

const LeaderDashboard: React.FC<LeaderDashboardProps> = ({ userProfile, activeEvent, onNavigate }) => {
    const [selectedEvent, setSelectedEvent] = useState<DashboardEvent | null>(null);
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [scanningEvent, setScanningEvent] = useState<DashboardEvent | null>(null);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [scanResult, setScanResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [viewingTimelineFor, setViewingTimelineFor] = useState<DashboardEvent | null>(null);

    const { invalidateEvents, invalidateAll } = useInvalidateQueries();

    // Use the new optimized hook for instant loading
    const { data: dashboardData, isLoading } = useLeaderDashboardData(userProfile?.department_id || null);

    // Default empty data structure while loading
    const defaultData = {
        departmentName: '',
        departmentVolunteers: [],
        stats: undefined,
        todaySchedules: [],
        upcomingSchedules: [],
        chartData: [],
        activeLeaders: [],
        allEvents: []
    };

    const {
        departmentName,
        departmentVolunteers,
        stats,
        todaySchedules,
        upcomingSchedules,
        chartData,
        activeLeaders,
        allEvents: allDepartmentEvents
    } = dashboardData || defaultData;

    const showNotification = useCallback((message: string, type: 'success' | 'error') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 5000);
    }, []);

    const handleMarkAttendance = (event: DashboardEvent) => {
        setScanningEvent(event);
        setIsScannerOpen(true);
    };

    const handleAutoConfirmAttendance = useCallback(async (decodedText: string) => {
        if (scanResult) return;

        try {
            const data = JSON.parse(decodedText);
            if (!data.vId || !data.eId || !data.dId) throw new Error("QR Code incompleto.");
            if (data.eId !== scanningEvent?.id) throw new Error("Evento incorreto.");
            if (data.dId !== userProfile.department_id) throw new Error("Este voluntário não pertence ao seu departamento para este evento.");

            const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !sessionData.session) throw new Error("Sessão inválida.");

            const { error: invokeError } = await supabase.functions.invoke('mark-attendance', {
                headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
                body: { volunteerId: data.vId, eventId: data.eId, departmentId: data.dId },
            });

            if (invokeError) throw invokeError;

            const volunteerName = scanningEvent?.event_volunteers?.find(v => v.volunteer_id === data.vId)?.volunteers?.name || 'Voluntário';
            setScanResult({ type: 'success', message: `${volunteerName}` });
            invalidateEvents();
            setTimeout(() => setScanResult(null), 2500);

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
            setScanResult({ type: 'error', message: errorMsg });
            setTimeout(() => setScanResult(null), 4000);
        }
    }, [scanningEvent, scanResult, userProfile, invalidateEvents]);

    const handleViewDetails = (event: DashboardEvent) => {
        setSelectedEvent(event);
    };

    const isLeader = userProfile?.role === 'leader' || userProfile?.role === 'lider';
    const isAdmin = userProfile?.role === 'admin';

    return (
        <PullToRefresh onRefresh={invalidateAll}>
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">
                            Dashboard {departmentName && <span className="text-blue-600">- {departmentName}</span>}
                        </h1>
                        <p className="text-slate-500 mt-1">Visão geral do sistema de voluntários.</p>
                    </div>
                    {activeEvent && (
                        <LiveEventTimer event={activeEvent} onNavigate={onNavigate} />
                    )}
                </div>

                <StatsRow stats={stats} userRole={userProfile?.role} />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <AnalysisChart data={chartData} />
                    </div>
                    <div className="lg:col-span-1">
                        <DepartmentRankingWidget departmentId={userProfile?.department_id} />
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <UpcomingShiftsList
                            todaySchedules={todaySchedules}
                            upcomingSchedules={upcomingSchedules}
                            onViewDetails={handleViewDetails}
                            userRole={userProfile?.role ?? null}
                            leaderDepartmentId={userProfile?.department_id}
                            onMarkAttendance={handleMarkAttendance}
                            onViewTimeline={setViewingTimelineFor}
                        />
                    </div>
                    <div className="lg:col-span-1 space-y-6">
                        {isLeader && userProfile && (
                            <AttendanceFlashCards
                                schedules={todaySchedules}
                                userProfile={userProfile}
                                departmentVolunteers={departmentVolunteers}
                            />
                        )}
                        {isAdmin && <ActivityFeed leaders={activeLeaders} />}
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
        </PullToRefresh>
    );

};

export default LeaderDashboard;