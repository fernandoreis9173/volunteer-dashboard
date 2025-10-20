

import React from 'react';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';
import type { Stat } from '../types';

// Dummy data for the small trend chart
const chartData = [
  { value: 65 }, { value: 68 }, { value: 64 }, { value: 70 },
  { value: 90 }, { value: 85 }, { value: 88 }, { value: 82 },
  { value: 80 }, { value: 78 }, { value: 75 }, { value: 70 },
];

interface ActiveVolunteersListProps {
  stats: {
    activeVolunteers: Stat;
    departments: Stat;
    schedulesToday: Stat;
    upcomingSchedules?: Stat;
  } | undefined;
  userRole: string | null | undefined;
}

const StatItem: React.FC<{ value: string; label: string }> = ({ value, label }) => (
  <div className="text-center px-2">
    <p className="text-2xl font-bold text-slate-800">{value}</p>
    <p className="text-xs text-slate-500">{label}</p>
  </div>
);


const ActiveVolunteersList: React.FC<ActiveVolunteersListProps> = ({ stats, userRole }) => {
  const isLeader = userRole === 'leader' || userRole === 'lider';
  const loading = !stats;
  const activeCount = loading ? '...' : stats?.activeVolunteers?.value ?? '0';
  const departmentsCount = loading ? '...' : stats?.departments?.value ?? '0';
  const todayCount = loading ? '...' : stats?.schedulesToday?.value ?? '0';
  const upcomingCount = loading ? '...' : stats?.upcomingSchedules?.value ?? '0';

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-slate-800">{isLeader ? 'Voluntários do Departamento' : 'Voluntários Ativos'}</h2>
      </div>

      {loading ? (
          <div className="animate-pulse">
            <div className="h-10 bg-slate-200 rounded w-1/2 mb-4"></div>
            <div className="h-24 bg-slate-200 rounded -mx-6"></div>
            <div className="mt-4 pt-4 border-t border-slate-200 flex justify-around items-center">
                <div className="h-10 bg-slate-200 rounded w-1/4"></div>
                <div className="h-10 bg-slate-200 rounded w-1/4"></div>
                <div className="h-10 bg-slate-200 rounded w-1/4"></div>
            </div>
          </div>
      ) : (
        <>
            <div className="flex items-center space-x-2 mb-4">
                <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                <p className="text-4xl font-bold text-slate-800">{activeCount}</p>
                <p className="text-slate-500 pt-2">{isLeader ? 'ativos no seu departamento' : 'ativos no sistema'}</p>
            </div>
            
            <div className="flex-grow h-24 -mx-6">
                <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
                    <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2.5} fill="url(#chartGradient)" />
                </AreaChart>
                </ResponsiveContainer>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-200 flex justify-around items-center">
                {userRole === 'admin' && (
                  <>
                    <StatItem value={departmentsCount} label="Departamentos" />
                    <div className="h-10 w-px bg-slate-200"></div>
                  </>
                )}
                <StatItem value={todayCount} label="Eventos Hoje" />
                <div className="h-10 w-px bg-slate-200"></div>
                <StatItem value={upcomingCount} label="Próximos Eventos" />
            </div>
        </>
      )}
    </div>
  );
};

export default ActiveVolunteersList;