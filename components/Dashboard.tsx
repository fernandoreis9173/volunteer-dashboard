

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

      // FIX: Refactored promise chains to use async/await with try/catch/finally
      // to resolve errors with '.finally()' not being available on PromiseLike types.
      // The async IIFEs (Immediately Invoked Function Expressions) allow all data fetches
      // to run in parallel while correctly handling loading states.
      
      // Fetch Stats
      (async () => {
        try {
            const [volunteersCountRes, departmentsCountRes, schedulesTodayCountRes, schedulesTomorrowCountRes] = await Promise.all([
                supabase.from('volunteers').select('id', { count: 'exact', head: true }).eq('status', 'Ativo'),
                supabase.from('departments').select('id', { count: 'exact', head: true }).eq('status', 'Ativo'),
                supabase.from('events').select('id', { count: 'exact', head: true }).eq('date', today).eq('status', 'Confirmado'),
                supabase.from('events').select('id', { count: 'exact', head: true }).eq('date', tomorrow).eq('status', 'Confirmado'),
            ]);
            setStats({
                activeVolunteers: String(volunteersCountRes.count ?? 0),
                departments: String(departmentsCountRes.count ?? 0),
                schedulesToday: String(schedulesTodayCountRes.count ?? 0),
                schedulesTomorrow: String(schedulesTomorrowCountRes.count ?? 0),
            });
        } catch (error) {
            console.error("Error fetching stats:", error);
        } finally {
            setLoadingStats(false);
        }
      })();


      // Fetch Today's Schedules
      (async () => {
        try {
            const { data, error } = await supabase.from('events').select('id, name, date, start_time, end_time, status, event_departments(department_id, departments(id, name)), event_volunteers(volunteer_id, volunteers(id, name))').eq('date', today).eq('status', 'Confirmado').order('start_time', { ascending: true }).limit(10);
            if (error) throw error;
            if (data) setTodaySchedules(data as unknown as DashboardEvent[]);
        } catch (error) {
            console.error("Error fetching today's schedules:", error);
        } finally {
            setLoadingToday(false);
        }
      })();


      // Fetch Upcoming Schedules
      (async () => {
        try {
            const { data, error } = await supabase.from('events').select('id, name, date, start_time, end_time, status, event_departments(department_id, departments(id, name)), event_volunteers(volunteer_id, volunteers(id, name))').gte('date', tomorrow).lte('date', nextSevenDays).eq('status', 'Confirmado').order('date').limit(5);
            if (error) throw error;
            if (data) setUpcomingSchedules(data as unknown as DashboardEvent[]);
        } catch (error) {
            console.error("Error fetching upcoming schedules:", error);
        } finally {
            setLoadingUpcoming(false);
        }
      })();
      

      // Fetch Active Volunteers
      (async () => {
        try {
            const { data, error } = await supabase.from('volunteers').select('id, name, email, initials, departments:departaments').eq('status', 'Ativo').order('created_at', { ascending: false }).limit(5);
            if (error) throw error;
            if (data) setActiveVolunteers(data as DashboardVolunteer[]);
        } catch (error) {
            console.error("Error fetching active volunteers:", error);
        } finally {
            setLoadingVolunteers(false);
        }
      })();

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
        <StatCard title="Voluntários Ativos" value={loadingStats ? '...' : stats.activeVolunteers} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m-7.5-2.226a3 3 0 0 0-4.682 2.72 9.094 9.094 0 0 0 3.741.479m7.5-2.226V18a2.25 2.25 0 0 1-2.25 2.25H12a2.25 2.25 0 0 1-2.25-2.25V18.226m3.75-10.5a3.375 3.375 0 0 0-6.75 0v1.5a3.375 3.375 0 0 0 6.75 0v-1.5ZM10.5 8.25a3.375 3.375 0 0 0-6.75 0v1.5a3.375 3.375 0 0 0 6.75 0v-1.5Z" /></svg>} color="blue" />
        <StatCard title="Departamentos" value={loadingStats ? '...' : stats.departments} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18h16.5M5.25 6H18.75m-13.5 0V21m13.5-15V21m-10.5-9.75h.008v.008H8.25v-.008ZM8.25 15h.008v.008H8.25V15Zm3.75-9.75h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm3.75-9.75h.008v.008H15.75v-.008ZM15.75 15h.008v.008H15.75V15Z" /></svg>} color="teal" />
        <StatCard title="Eventos Hoje" value={loadingStats ? '...' : stats.schedulesToday} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0h18" /></svg>} color="orange" />
        <StatCard title="Eventos Amanhã" value={loadingStats ? '...' : stats.schedulesTomorrow} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.898 20.562 16.25 21.75l-.648-1.188a2.25 2.25 0 0 1-1.423-1.423L13.125 18l1.188-.648a2.25 2.25 0 0 1 1.423-1.423L16.25 15l.648 1.188a2.25 2.25 0 0 1 1.423 1.423L19.5 18l-1.188.648a2.25 2.25 0 0 1-1.423 1.423Z" /></svg>} color="purple" />
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