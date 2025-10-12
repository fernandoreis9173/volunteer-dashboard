import React, { useState, useEffect, useCallback } from 'react';
import StatsRow from './StatsRow';
import UpcomingShiftsList from './UpcomingShiftsList';
import ActiveVolunteersList from './ActiveVolunteersList';
// FIX: Moved ChartDataPoint to types.ts and updated import path.
import type { DashboardEvent, Stat, EnrichedUser, ChartDataPoint } from '../types';
import EventDetailsModal from './EventDetailsModal';
import AnalysisChart from './TrafficChart';
import ActivityFeed from './ActivityFeed';
import { supabase } from '../lib/supabaseClient';
import { getErrorMessage } from '../lib/utils';

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

const Dashboard: React.FC = () => {
  const [selectedEvent, setSelectedEvent] = useState<DashboardEvent | null>(null);
  const [dashboardData, setDashboardData] = useState<Partial<DashboardData>>({});
  const [error, setError] = useState<string | null>(null);


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
            supabase.from('events').select('id, name, date, start_time, end_time, status, event_departments(departments(name)), event_volunteers(volunteers(name))').eq('date', todayStr).order('start_time')
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
            supabase.from('events').select('id, name, date, start_time, end_time, status, event_departments(departments(name)), event_volunteers(volunteers(name))').gt('date', todayStr).lte('date', next7DaysStr).order('date').order('start_time').limit(10),
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

  const handleViewDetails = (event: DashboardEvent) => {
    setSelectedEvent(event);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 mt-1">Visão geral do sistema de voluntários</p>
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
    </div>
  );
};

export default Dashboard;