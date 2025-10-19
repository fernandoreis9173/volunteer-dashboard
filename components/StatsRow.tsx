import React from 'react';
import type { Stat } from '../types';
import StatCard from './StatCard';
import { VolunteerIcon, CalendarIcon, FrequenciaIcon, DepartamentsIcon, NextEventIcon } from '@/assets/icons';

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
            <img src={VolunteerIcon} alt="Voluntários Ativos" style={{ filter: 'brightness(0)' }} />
        ),
        color: 'blue' as const,
    },
    { 
        title: 'Departamentos', 
        data: stats?.departments,
        icon: (
            <img src={DepartamentsIcon} alt="Departamentos" style={{ filter: 'brightness(0)' }} />
        ),
        color: 'teal' as const,
    },
    { 
        title: 'Eventos Hoje', 
        data: stats?.schedulesToday,
        icon: (
            <img src={CalendarIcon} alt="Eventos Hoje" style={{ filter: 'brightness(0)' }} />
        ),
        color: 'purple' as const,
    },
    { 
        title: 'Próximos Eventos', 
        data: stats?.upcomingSchedules,
        icon: (
             <img src={NextEventIcon} alt="Próximos Eventos" style={{ filter: 'brightness(0)' }} />
        ),
        color: 'orange' as const,
    },
    { 
        title: 'Total de Frequência Anual', 
        data: stats?.annualAttendance,
        icon: (
             <img src={FrequenciaIcon} alt="Total de Frequência Anual" style={{ filter: 'brightness(0)' }} />
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