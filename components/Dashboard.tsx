
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
  
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingToday, setLoadingToday] = useState(true);
  const [loadingUpcoming, setLoadingUpcoming] = useState(true);
  const [loadingVolunteers, setLoadingVolunteers] = useState(true);


  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!supabase) {
        setLoadingStats(false);
        setLoadingToday(false);
        setLoadingUpcoming(false);
        setLoadingVolunteers(false);
        return;
      }
      
      const getLocalYYYYMMDD = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const todayDate = new Date();
      const today = getLocalYYYYMMDD(todayDate);
      
      const tomorrowDate = new Date();
      tomorrowDate.setDate(todayDate.getDate() + 1);
      const tomorrow = getLocalYYYYMMDD(tomorrowDate);
      
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(todayDate.getDate() + 7);
      const nextSevenDays = getLocalYYYYMMDD(sevenDaysFromNow);

      // Fetch Stats
      Promise.all([
          supabase.from('volunteers').select('id', { count: 'exact', head: true }).eq('status', 'Ativo'),
          supabase.from('departments').select('id', { count: 'exact', head: true }).eq('status', 'Ativo'),
          supabase.from('events').select('id', { count: 'exact', head: true }).eq('date', today).eq('status', 'Confirmado'),
          supabase.from('events').select('id', { count: 'exact', head: true }).eq('date', tomorrow).eq('status', 'Confirmado'),
      ]).then(([volunteersCountRes, departmentsCountRes, schedulesTodayCountRes, schedulesTomorrowCountRes]) => {
          setStats({
              activeVolunteers: String(volunteersCountRes.count ?? 0),
              departments: String(departmentsCountRes.count ?? 0),
              schedulesToday: String(schedulesTodayCountRes.count ?? 0),
              schedulesTomorrow: String(schedulesTomorrowCountRes.count ?? 0),
          });
      }).catch(error => console.error("Error fetching stats:", error))
        .finally(() => setLoadingStats(false));

      // Fetch Today's Schedules
      supabase.from('events').select('id, name, date, start_time, end_time, status, event_departments(department_id, departments(id, name)), event_volunteers(volunteer_id, volunteers(id, name))').eq('date', today).eq('status', 'Confirmado').order('start_time', { ascending: true }).limit(10)
        .then(({ data, error }) => {
            if (data) setTodaySchedules(data as unknown as DashboardEvent[]);
            if (error) console.error("Error fetching today's schedules:", error);
        }).finally(() => setLoadingToday(false));

      // Fetch Upcoming Schedules
      supabase.from('events').select('id, name, date, start_time, end_time, status, event_departments(department_id, departments(id, name)), event_volunteers(volunteer_id, volunteers(id, name))').gte('date', tomorrow).lte('date', nextSevenDays).eq('status', 'Confirmado').order('date').limit(5)
        .then(({ data, error }) => {
            if (data) setUpcomingSchedules(data as unknown as DashboardEvent[]);
            if (error) console.error("Error fetching upcoming schedules:", error);
        }).finally(() => setLoadingUpcoming(false));

      // Fetch Active Volunteers
      supabase.from('volunteers').select('id, name, email, initials, departments:departaments').eq('status', 'Ativo').order('created_at', { ascending: false }).limit(5)
        .then(({ data, error }) => {
            if (data) setActiveVolunteers(data as DashboardVolunteer[]);
            if (error) console.error("Error fetching active volunteers:", error);
        }).finally(() => setLoadingVolunteers(false));

    };

    fetchDashboardData();
  }, [supabase]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 mt-1">Visão geral do sistema de voluntários</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Voluntários Ativos" value={loadingStats ? '...' : stats.activeVolunteers} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283-.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>} color="blue" />
        <StatCard title="Departamentos" value={loadingStats ? '...' : stats.departments} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 4h5m-5 4h5m-5-8h5" /></svg>} color="teal" />
        <StatCard title="Eventos Hoje" value={loadingStats ? '...' : stats.schedulesToday} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 00-2-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>} color="orange" />
        <StatCard title="Eventos Amanhã" value={loadingStats ? '...' : stats.schedulesTomorrow} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>} color="purple" />
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 min-w-0">
          <TodayShiftsList schedules={todaySchedules} loading={loadingToday} />
        </div>
        <div className="flex-1 min-w-0">
          <UpcomingShiftsList schedules={upcomingSchedules} loading={loadingUpcoming} />
        </div>
        <div className="flex-1 min-w-0">
          <ActiveVolunteersList volunteers={activeVolunteers} loading={loadingVolunteers} />
        </div>
      </div>

    </div>
  );
};

export default Dashboard;
