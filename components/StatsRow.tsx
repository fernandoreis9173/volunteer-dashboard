import React from 'react';
import type { Stat } from '../types';
import StatCard from './StatCard';

interface StatsRowProps {
  stats: {
    activeVolunteers: Stat;
    departments: Stat;
    schedulesToday: Stat;
    upcomingSchedules?: Stat;
    presencesToday?: Stat;
    annualAttendance?: Stat;
  } | undefined;
  userRole: string | null | undefined;
}

const StatsRow: React.FC<StatsRowProps> = ({ stats, userRole }) => {
  const loading = !stats;

  const allStatItems = [
    { 
        title: 'Voluntários Ativos', 
        data: stats?.activeVolunteers,
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24" strokeWidth={1.5} stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m-7.5-2.226a3 3 0 00-4.682 2.72 9.094 9.094 0 003.741.479m7.5-2.226V18a2.25 2.25 0 01-2.25 2.25H12a2.25 2.25 0 01-2.25-2.25v-.226m3.75-10.5a3.375 3.375 0 00-6.75 0v1.5a3.375 3.375 0 006.75 0v-1.5z" />
            </svg>
        ),
        color: 'blue' as const,
    },
    { 
        title: 'Departamentos', 
        data: stats?.departments,
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24" strokeWidth={1.5} stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 5.25h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 3v18h13.5V3H5.25z" />
            </svg>
        ),
        color: 'teal' as const,
    },
    { 
        title: 'Eventos Hoje', 
        data: stats?.schedulesToday,
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24" strokeWidth={1.5} stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0h18" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 12h.008v.008H9.75V12zm3 0h.008v.008H12.75V12zm3 0h.008v.008H15.75V12zm-6 3h.008v.008H9.75v-.008zm3 0h.008v.008H12.75v-.008zm3 0h.008v.008H15.75v-.008z" />
            </svg>
        ),
        color: 'purple' as const,
    },
    { 
        title: 'Próximos Eventos', 
        data: stats?.upcomingSchedules,
        icon: (
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24" strokeWidth={1.5} stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
        color: 'orange' as const,
    },
    { 
        title: 'Total de Frequência Anual', 
        data: stats?.annualAttendance,
        icon: (
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24" strokeWidth={1.5} stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
        ),
        color: 'green' as const,
    },
  ];

  const statItems = allStatItems.filter(item => {
    // Cartão exclusivo para admin
    if (item.title === 'Departamentos') {
        return userRole === 'admin';
    }
    // Cartão exclusivo para líder
    if (item.title === 'Total de Frequência Anual') {
        return userRole === 'leader' || userRole === 'lider';
    }
    // Cartões compartilhados
    return true;
  });

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-x sm:divide-y-0 divide-slate-200">
        {statItems.map((item, index) => (
          <StatCard 
            key={index}
            title={item.title}
            value={item.data?.value ?? '0'}
            icon={item.icon}
            color={item.color}
            loading={loading}
          />
        ))}
      </div>
    </div>
  );
};

export default StatsRow;