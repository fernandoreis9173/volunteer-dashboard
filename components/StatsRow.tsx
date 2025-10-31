import React from 'react';
import type { Stat } from '../types';
import StatCard from './StatCard';
import { CalendarIcon } from '@/assets/icons';

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
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor">
              <path d="M46.67-412q-23.34-40.67-35-82Q0-535.33 0-576q0-110.67 76.67-187.33Q153.33-840 264-840q63 0 119.67 26.17Q440.33-787.67 480-742q39.67-45.67 96.33-71.83Q633-840 696-840q110.67 0 187.33 76.67Q960-686.67 960-576q0 40.67-11.67 81.67-11.66 41-35 81.66-10.33-14.33-23.66-25-13.34-10.66-29.34-17.66 16.34-31 24.67-61 8.33-30 8.33-59.67 0-82.67-57.33-140t-140-57.33q-63.67 0-113.83 36.5Q532-700.33 480-638q-52-62.67-102.17-99-50.16-36.33-113.83-36.33-82.67 0-140 57.33T66.67-576q0 29.67 8.33 59.67t24.67 61q-16 7-29.34 18Q57-426.33 46.67-412ZM0-80v-56.33q0-40.67 42.83-65.5 42.84-24.84 110.5-24.84 13 0 24.34.5 11.33.5 22.33 2.5-10 18-15 37.34-5 19.33-5 41.33v65H0Zm240 0v-65q0-65 66.5-105T480-290q108 0 174 40t66 105v65H240Zm540 0v-65q0-22-4.5-41.33-4.5-19.34-14.17-37.34 11-2 22.17-2.5 11.17-.5 23.17-.5 68.66 0 111 24.84Q960-177 960-136.33V-80H780ZM480-223.33q-72.33 0-120.67 21-48.33 21-51 52.33v3.33H652v-4q-3-30.66-50.83-51.66-47.84-21-121.17-21ZM153.33-260q-30.33 0-51.83-21.5T80-333.33q0-30.67 21.5-52 21.5-21.34 51.83-21.34 30.67 0 52 21.34 21.34 21.33 21.34 52 0 30.33-21.34 51.83-21.33 21.5-52 21.5Zm653.34 0q-30.34 0-51.84-21.5-21.5-21.5-21.5-51.83 0-30.67 21.5-52 21.5-21.34 51.84-21.34 30.66 0 52 21.34Q880-364 880-333.33q0 30.33-21.33 51.83-21.34 21.5-52 21.5ZM480-320q-50 0-85-35t-35-85q0-51 35-85.5t85-34.5q51 0 85.5 34.5T600-440q0 50-34.5 85T480-320Zm0-173.33q-22.33 0-37.83 15.16-15.5 15.17-15.5 38.17 0 22.33 15.5 37.83t37.83 15.5q23 0 38.17-15.5 15.16-15.5 15.16-37.83 0-23-15.16-38.17Q503-493.33 480-493.33Zm0 53.33Zm.33 293.33Z"/>
            </svg>
        ),
        color: 'blue' as const,
    },
    { 
        title: 'Departamentos', 
        data: stats?.departments,
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor">
              <path d="M106.67-120q-27.5 0-47.09-19.58Q40-159.17 40-186.67v-546.66h66.67v546.66h720V-120h-720ZM240-253.33q-27.5 0-47.08-19.59-19.59-19.58-19.59-47.08v-493.33q0-27.5 19.59-47.09Q212.5-880 240-880h226.67l80 80h306.66q27.5 0 47.09 19.58Q920-760.83 920-733.33V-320q0 27.5-19.58 47.08-19.59 19.59-47.09 19.59H240Zm0-66.67h613.33v-413.33H519l-80-80H240V-320Zm0 0v-493.33V-320Z"/>
            </svg>
        ),
        color: 'teal' as const,
    },
    { 
        title: 'Eventos Hoje', 
        data: stats?.schedulesToday,
        icon: <img src={CalendarIcon} alt="Eventos Hoje" />,
        color: 'purple' as const,
    },
    { 
        title: 'Próximos Eventos', 
        data: stats?.upcomingSchedules,
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor">
              <path d="M472-321.33 518.67-368 393.33-493.26v-180.07h-66.66v206.66L472-321.33Zm252.67 178.66v-74.66q77.33-36.34 123-107 45.66-70.67 45.66-156 0-85.34-45.66-156.34-45.67-71-123-106.66V-818q105.66 40.67 170.5 132.52Q960-593.62 960-480.64q0 112.97-64.5 205.14-64.5 92.17-170.83 132.83Zm-364.67 22q-75 0-140.5-28.5t-114-77q-48.5-48.5-77-114T0-480.67q0-75 28.5-140.5t77-114q48.5-48.5 114-77t140.5-28.5q75 0 140.5 28.5t114 77q48.5 48.5 77 114t28.5 140.5q0 75-28.5 140.5t-77 114q-48.5 48.5-114 77T360-120.67Zm0-66.66q121.67 0 207.5-85.38 85.83-85.39 85.83-207.96 0-121.66-85.83-207.5Q481.67-774 360-774q-122.57 0-207.95 85.83-85.38 85.84-85.38 207.5 0 122.57 85.38 207.96 85.38 85.38 207.95 85.38Zm0-293.34Z"/>
            </svg>
        ),
        color: 'orange' as const,
    },
    { 
        title: 'Total de Frequência Anual', 
        data: stats?.annualAttendance,
        icon: (
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
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