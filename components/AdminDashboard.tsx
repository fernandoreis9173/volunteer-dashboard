import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { EnrichedUser, DashboardData, DashboardEvent, ChartDataPoint, Page, Event } from '../types';
import { getErrorMessage } from '../lib/utils';
import StatsRow from './StatsRow';
import UpcomingShiftsList from './UpcomingShiftsList';
import { AnalysisChart } from './TrafficChart';
import ActivityFeed from './ActivityFeed';
import EventDetailsModal from './EventDetailsModal';
import ActiveVolunteersList from './ActiveVolunteersList';
import QRCodeDisplayModal from './QRCodeDisplayModal';

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
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </button>
            </div>
        </div>
    );
};


interface AdminDashboardProps {
  onDataChange: () => void;
  activeEvent: Event | null;
  onNavigate: (page: Page) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onDataChange, activeEvent, onNavigate }) => {
    const [selectedEvent, setSelectedEvent] = useState<DashboardEvent | null>(null);
    const [dashboardData, setDashboardData] = useState<Partial<DashboardData>>({});
    const [dashboardError, setDashboardError] = useState<string | null>(null);
    const [isQrDisplayOpen, setIsQrDisplayOpen] = useState(false);

    const fetchDashboardData = useCallback(async () => {
        setDashboardData({}); 
        setDashboardError(null);

        // --- STAGE 1: Fetch fast stats and today's data first ---
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayStr = today.toISOString().split('T')[0];
            
            const next7DaysInitial = new Date(today);
            next7DaysInitial.setDate(today.getDate() + 7);
            const next7DaysStrInitial = next7DaysInitial.toISOString().split('T')[0];

            const [
                activeVolunteersCountRes,
                departmentsCountRes,
                todaySchedulesRes,
                upcomingSchedulesCountRes,
            ] = await Promise.all([
                supabase.from('volunteers').select('*', { count: 'exact', head: true }).eq('status', 'Ativo'),
                supabase.from('departments').select('*', { count: 'exact', head: true }).eq('status', 'Ativo'),
                supabase.from('events').select('id, name, date, start_time, end_time, status, local, observations, event_departments(departments(id, name)), event_volunteers(department_id, volunteer_id, present, volunteers(name))').eq('date', todayStr).order('start_time'),
                supabase.from('events').select('id', { count: 'exact', head: true }).gt('date', todayStr).lte('date', next7DaysStrInitial),
            ]);

            const todaySchedules = (todaySchedulesRes.data as unknown as DashboardEvent[]) || [];
            const initialStats: DashboardData['stats'] = {
                activeVolunteers: { value: String(activeVolunteersCountRes.count ?? 0), change: 0 },
                departments: { value: String(departmentsCountRes.count ?? 0), change: 0 },
                schedulesToday: { value: String(todaySchedules.length), change: 0 },
                upcomingSchedules: { value: String(upcomingSchedulesCountRes.count ?? 0), change: 0 },
            };
    
            setDashboardData(prev => ({
                ...prev,
                stats: initialStats,
                todaySchedules: todaySchedules,
            }));
            
        } catch (err) {
            const errorMessage = getErrorMessage(err);
            setDashboardError(`Falha ao carregar dados essenciais: ${errorMessage}`);
        }

        // --- STAGE 2: Fetch remaining heavier content in the background ---
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayStr = today.toISOString().split('T')[0];
            const next7Days = new Date(today);
            next7Days.setDate(today.getDate() + 7);
            const next7DaysStr = next7Days.toISOString().split('T')[0];

            const last30Days = new Date(today);
            last30Days.setDate(today.getDate() - 29);
            const last30DaysStr = last30Days.toISOString().split('T')[0];
    
            const [
                upcomingSchedulesRes,
                activeLeadersRes,
                chartEventsRes
            ] = await Promise.all([
                supabase.from('events').select('id, name, date, start_time, end_time, status, local, observations, event_departments(departments(id, name)), event_volunteers(department_id, volunteer_id, present, volunteers(name))').gt('date', todayStr).lte('date', next7DaysStr).order('date').order('start_time').limit(10),
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
    
            setDashboardData(prev => ({
                ...prev,
                upcomingSchedules: (upcomingSchedulesRes.data as unknown as DashboardEvent[]) || [],
                activeLeaders: activeLeadersRes.data?.users || [],
                chartData: chartData,
            }));
        } catch (err) {
            console.error("Failed to fetch secondary dashboard data:", getErrorMessage(err));
        }
    }, []);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);


    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Dashboard</h1>
                    <p className="text-slate-500 mt-1">Visão geral do sistema de voluntários.</p>
                </div>
                 <div className="flex flex-col md:flex-row md:items-center gap-4 w-full md:w-auto">
                    {activeEvent && <LiveEventTimer event={activeEvent} onNavigate={onNavigate} />}
                    {activeEvent && (
                        <button 
                            onClick={() => setIsQrDisplayOpen(true)}
                            className="p-4 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition-colors flex flex-row items-center justify-center gap-3 w-full md:w-auto md:px-6"
                            aria-label="Gerar QR Code para Presença"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24" strokeWidth="1.5" stroke="currentColor" className="h-7 w-7 md:h-6 md:w-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-1.036.84-1.875 1.875-1.875h4.5c1.036 0 1.875.84 1.875 1.875v4.5c0 1.036-.84 1.875-1.875 1.875h-4.5A1.875 1.875 0 0 1 3.75 9.375v-4.5zM3.75 14.625c0-1.036.84-1.875 1.875-1.875h4.5c1.036 0 1.875.84 1.875 1.875v4.5c0 1.036-.84 1.875-1.875 1.875h-4.5a1.875 1.875 0 0 1-1.875-1.875v-4.5zM13.5 4.875c0-1.036.84-1.875 1.875-1.875h4.5c1.036 0 1.875.84 1.875 1.875v4.5c0 1.036-.84 1.875-1.875 1.875h-4.5a1.875 1.875 0 0 1-1.875-1.875v-4.5z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 12.75h.008v.008h-.008v-.008zM17.25 16.5h.008v.008h-.008v-.008zM17.25 20.25h.008v.008h-.008v-.008zM13.5 20.25h.008v.008h-.008v-.008zM13.5 16.5h.008v.008h-.008v-.008zM13.5 12.75h.008v.008h-.008v-.008z" />
                            </svg>
                            <span className="text-lg md:text-base font-semibold">QR Presença</span>
                        </button>
                    )}
                </div>
            </div>
            
            {dashboardError && <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">{dashboardError}</div>}
            <StatsRow stats={dashboardData.stats} userRole="admin" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
                <div className="lg:col-span-2">
                    {dashboardData.chartData ? <AnalysisChart data={dashboardData.chartData} /> : <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-full animate-pulse"><div className="h-8 bg-slate-200 rounded w-1/2 mb-6"></div><div className="h-[300px] bg-slate-200 rounded"></div></div>}
                </div>
                <div className="lg:col-span-1">
                    <ActiveVolunteersList stats={dashboardData.stats} userRole={'admin'} />
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
                <div className="lg:col-span-2">
                    <UpcomingShiftsList
                        todaySchedules={dashboardData.todaySchedules}
                        upcomingSchedules={dashboardData.upcomingSchedules}
                        onViewDetails={setSelectedEvent}
                        userRole={'admin'}
                        onMarkAttendance={() => {}} // No-op for admin
                    />
                </div>
                <div className="lg:col-span-1">
                    <ActivityFeed leaders={dashboardData.activeLeaders} />
                </div>
            </div>
            <EventDetailsModal isOpen={!!selectedEvent} event={selectedEvent} onClose={() => setSelectedEvent(null)} />
            <QRCodeDisplayModal
                isOpen={isQrDisplayOpen}
                onClose={() => setIsQrDisplayOpen(false)}
                data={activeEvent ? { eventId: activeEvent.id } : null}
                title={`QR Code de Presença`}
                description={`Peça para os voluntários escanearem este código para confirmar a presença no evento "${activeEvent?.name}".`}
            />
        </div>
    );
};

export default AdminDashboard;