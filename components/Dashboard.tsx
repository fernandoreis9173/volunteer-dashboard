
import React, { useState, useEffect } from 'react';
import StatCard from './StatCard';
import TodayShiftsList from './TodayShiftsList';
import UpcomingShiftsList from './UpcomingShiftsList';
import ActiveVolunteersList from './ActiveVolunteersList';
import { SupabaseClient } from '@supabase/supabase-js';
import type { DashboardEvent, DashboardVolunteer } from '../types';

interface DashboardProps {
  supabase: SupabaseClient | null;
}

const Dashboard: React.FC<DashboardProps> = ({ supabase }) => {
  const [stats, setStats] = useState({
    activeVolunteers: '0',
    departments: '0',
    schedulesToday: '0',
    schedulesTomorrow: '0',
  });
  const [todaySchedules, setTodaySchedules] = useState<DashboardEvent[]>([]);
  const [upcomingSchedules, setUpcomingSchedules] = useState<DashboardEvent[]>([]);
  const [activeVolunteers, setActiveVolunteers] = useState<DashboardVolunteer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!supabase) {
        setLoading(false);
        return;
      }
      setLoading(true);
      
      const today = new Date().toISOString().slice(0, 10);
      const tomorrowDate = new Date();
      tomorrowDate.setDate(new Date().getDate() + 1);
      const tomorrow = tomorrowDate.toISOString().slice(0, 10);
      
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(new Date().getDate() + 7);
      const nextSevenDays = sevenDaysFromNow.toISOString().slice(0, 10);


      try {
        const [
            volunteersCountRes,
            departmentsCountRes,
            schedulesTodayCountRes,
            schedulesTomorrowCountRes,
            todaySchedulesRes,
            upcomingSchedulesRes,
            activeVolunteersRes,
        ] = await Promise.all([
            // PERF: Optimized count queries to only fetch 'id' instead of '*'.
            supabase.from('volunteers').select('id', { count: 'exact', head: true }).eq('status', 'Ativo'),
            supabase.from('departments').select('id', { count: 'exact', head: true }).eq('status', 'Ativo'),
            supabase.from('events').select('id', { count: 'exact', head: true }).eq('date', today).eq('status', 'Confirmado'),
            supabase.from('events').select('id', { count: 'exact', head: true }).eq('date', tomorrow).eq('status', 'Confirmado'),
            supabase.from('events').select('id, name, date, start_time, end_time, status, event_departments(department_id, departments(id, name)), event_volunteers(volunteer_id, volunteers(id, name))').eq('date', today).eq('status', 'Confirmado'),
            supabase.from('events').select('id, name, date, start_time, end_time, status, event_departments(department_id, departments(id, name)), event_volunteers(volunteer_id, volunteers(id, name))').gte('date', tomorrow).lte('date', nextSevenDays).eq('status', 'Confirmado').order('date').limit(5),
            supabase.from('volunteers').select('id, name, email, initials, departments:departaments').eq('status', 'Ativo').order('created_at', { ascending: false }).limit(5),
        ]);

        setStats({
            activeVolunteers: String(volunteersCountRes.count ?? 0),
            departments: String(departmentsCountRes.count ?? 0),
            schedulesToday: String(schedulesTodayCountRes.count ?? 0),
            schedulesTomorrow: String(schedulesTomorrowCountRes.count ?? 0),
        });

        if (todaySchedulesRes.data) setTodaySchedules(todaySchedulesRes.data as unknown as DashboardEvent[]);
        if (upcomingSchedulesRes.data) setUpcomingSchedules(upcomingSchedulesRes.data as unknown as DashboardEvent[]);
        if (activeVolunteersRes.data) setActiveVolunteers(activeVolunteersRes.data as DashboardVolunteer[]);

      } catch (error) {
          console.error("Error fetching dashboard data:", error);
      } finally {
          setLoading(false);
      }
    };

    fetchDashboardData();
  }, [supabase]);

  if (loading) {
      return (
          <div className="flex items-center justify-center h-full">
              <p className="text-slate-500">Carregando dashboard...</p>
          </div>
      );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 mt-1">Visão geral do sistema de voluntários</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Voluntários Ativos" value={stats.activeVolunteers} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283-.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>} color="blue" />
        <StatCard title="Departamentos" value={stats.departments} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 4h5m-5 4h5m-5-8h5" /></svg>} color="teal" />
        <StatCard title="Eventos Hoje" value={stats.schedulesToday} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 00-2-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>} color="orange" />
        <StatCard title="Eventos Amanhã" value={stats.schedulesTomorrow} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
            <TodayShiftsList schedules={todaySchedules} loading={loading} />
        </div>
        <div>
            <ActiveVolunteersList volunteers={activeVolunteers} loading={loading} />
        </div>
      </div>
      
      <div>
        <UpcomingShiftsList schedules={upcomingSchedules} loading={loading} />
      </div>

    </div>
  );
};

export default Dashboard;
