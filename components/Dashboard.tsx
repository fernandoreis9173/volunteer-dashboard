import React, { useState, useEffect } from 'react';
import StatCard from './StatCard';
import UpcomingShiftsList from './UpcomingShiftsList';
import ActiveVolunteersList from './ActiveVolunteersList';
import { SupabaseClient } from '@supabase/supabase-js';

interface DashboardProps {
  supabase: SupabaseClient | null;
}

const Dashboard: React.FC<DashboardProps> = ({ supabase }) => {
  const [stats, setStats] = useState({
    activeVolunteers: '0',
    ministries: '0',
  });

  useEffect(() => {
    const fetchStats = async () => {
      if (!supabase) return;

      // Fetch active volunteers count
      const { count: volunteersCount, error: volunteersError } = await supabase
        .from('volunteers')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Ativo');

      // Fetch unique ministries count from volunteers
      const { data: ministriesData, error: ministriesError } = await supabase
        .from('volunteers')
        .select('ministries');

      if (volunteersError) console.error('Error fetching volunteers count', volunteersError);
      if (ministriesError) console.error('Error fetching ministries', ministriesError);
      
      const uniqueMinistries = new Set<string>();
      if (ministriesData) {
        ministriesData.forEach(item => {
          item.ministries.forEach(ministry => uniqueMinistries.add(ministry));
        });
      }

      setStats({
        activeVolunteers: (volunteersCount ?? 0).toString(),
        ministries: uniqueMinistries.size.toString(),
      });
    };

    fetchStats();
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
          icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
          color="blue"
        />
        <StatCard 
          title="Ministérios"
          value={stats.ministries}
          icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>}
          color="orange"
        />
        <StatCard 
          title="Escalas Hoje"
          value="0"
          icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          color="green"
        />
        <StatCard 
          title="Escalas Amanhã"
          value="0"
          icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <UpcomingShiftsList supabase={supabase} />
        </div>
        <div>
          <ActiveVolunteersList supabase={supabase} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;