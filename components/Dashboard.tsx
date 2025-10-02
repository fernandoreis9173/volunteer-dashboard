import React, { useState, useEffect } from 'react';
import StatCard from './StatCard';
import TodayShiftsList from './TodayShiftsList';
import UpcomingShiftsList from './UpcomingShiftsList';
import ActiveVolunteersList from './ActiveVolunteersList';
import { SupabaseClient } from '@supabase/supabase-js';
import type { Event, DetailedVolunteer } from '../types';

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
  const [showTodaySchedules, setShowTodaySchedules] = useState(false);
  const [showUpcomingSchedules, setShowUpcomingSchedules] = useState(false);
  const [todaySchedules, setTodaySchedules] = useState<Event[]>([]);
  const [upcomingSchedules, setUpcomingSchedules] = useState<Event[]>([]);
  const [activeVolunteers, setActiveVolunteers] = useState<DetailedVolunteer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!supabase) {
        setLoading(false);
        return;
      }
      setLoading(true);
      
      const todayDate = new Date();
      const today = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;

      const tomorrowDate = new Date();
      tomorrowDate.setDate(todayDate.getDate() + 1);
      const tomorrow = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, '0')}-${String(tomorrowDate.getDate()).padStart(2, '0')}`;

      const [
          volunteersCountRes,
          ministriesCountRes,
          schedulesTodayCountRes,
          schedulesTomorrowCountRes,
          upcomingSchedulesCountRes,
          todaySchedulesRes,
          upcomingSchedulesRes,
          activeVolunteersRes
      ] = await Promise.all([
          supabase.from('volunteers').select('*', { count: 'exact', head: true }).eq('status', 'Ativo'),
          supabase.from('departments').select('*', { count: 'exact', head: true }).eq('status', 'Ativo'),
          supabase.from('events').select('*', { count: 'exact', head: true }).eq('date', today),
          supabase.from('events').select('*', { count: 'exact', head: true }).eq('date', tomorrow),
          supabase.from('events').select('*', { count: 'exact', head: true }).gte('date', tomorrow),
          supabase.from('events').select('*, event_departments(departments(id, name)), event_volunteers(volunteer_id, volunteers(name))').eq('date', today).order('start_time', { ascending: true }),
          supabase.from('events').select('*, event_departments(departments(id, name)), event_volunteers(volunteer_id, volunteers(name))').gte('date', tomorrow).order('date', { ascending: true }).order('start_time', { ascending: true }).limit(3),
          supabase.from('volunteers').select('*').eq('status', 'Ativo').limit(6)
      ]);

      if (volunteersCountRes.error) console.error('Error fetching volunteers count', volunteersCountRes.error);
      if (ministriesCountRes.error) console.error('Error fetching departments count', ministriesCountRes.error);
      if (schedulesTodayCountRes.error) console.error('Error fetching events for today', schedulesTodayCountRes.error);
      if (schedulesTomorrowCountRes.error) console.error('Error fetching events for tomorrow', schedulesTomorrowCountRes.error);
      if (upcomingSchedulesCountRes.error) console.error('Error fetching upcoming events', upcomingSchedulesCountRes.error);
      if (todaySchedulesRes.error) console.error("Error fetching today's events", todaySchedulesRes.error);
      if (upcomingSchedulesRes.error) console.error('Error fetching upcoming events', upcomingSchedulesRes.error);
      if (activeVolunteersRes.error) console.error('Error fetching active volunteers', activeVolunteersRes.error);
      
      setShowTodaySchedules((schedulesTodayCountRes.count ?? 0) > 0);
      setShowUpcomingSchedules((upcomingSchedulesCountRes.count ?? 0) > 0);

      setStats({
        activeVolunteers: (volunteersCountRes.count ?? 0).toString(),
        departments: (ministriesCountRes.count ?? 0).toString(),
        schedulesToday: (schedulesTodayCountRes.count ?? 0).toString(),
        schedulesTomorrow: (schedulesTomorrowCountRes.count ?? 0).toString(),
      });
      
      setTodaySchedules(todaySchedulesRes.data as Event[] || []);
      setUpcomingSchedules(upcomingSchedulesRes.data as Event[] || []);
      setActiveVolunteers(activeVolunteersRes.data as DetailedVolunteer[] || []);
      setLoading(false);
    };

    fetchDashboardData();
  }, [supabase]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 mt-1">Visão geral do sistema de voluntários</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Voluntários Ativos"
          value={stats.activeVolunteers}
          icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283-.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
          color="blue"
        />
        <StatCard 
          title="Departamentos"
          value={stats.departments}
          icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>}
          color="orange"
        />
        <StatCard 
          title="Eventos Hoje"
          value={stats.schedulesToday}
          icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          color="green"
        />
        <StatCard 
          title="Eventos Amanhã"
          value={stats.schedulesTomorrow}
          icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {showTodaySchedules && (
          <div className={!showUpcomingSchedules ? 'lg:col-span-2' : ''}>
            <TodayShiftsList schedules={todaySchedules} loading={loading} />
          </div>
        )}
        {showUpcomingSchedules && (
          <div className={!showTodaySchedules ? 'lg:col-span-2' : ''}>
            <UpcomingShiftsList schedules={upcomingSchedules} loading={loading} />
          </div>
        )}
        <div className={!showTodaySchedules && !showUpcomingSchedules ? 'lg:col-span-3' : ''}>
            <ActiveVolunteersList volunteers={activeVolunteers} loading={loading} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;