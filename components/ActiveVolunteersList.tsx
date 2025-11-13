import React from 'react';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';
import type { Stat, DetailedVolunteer } from '../types';

// Dummy data for the small trend chart
const chartData = [
  { value: 65 }, { value: 68 }, { value: 64 }, { value: 70 },
  { value: 90 }, { value: 85 }, { value: 88 }, { value: 82 },
  { value: 80 }, { value: 78 }, { value: 75 }, { value: 70 },
];

interface ActiveVolunteersListProps {
  volunteers?: DetailedVolunteer[];
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


const ActiveVolunteersList: React.FC<ActiveVolunteersListProps> = ({ volunteers, stats, userRole }) => {
  const isLeader = userRole === 'leader' || userRole === 'lider';
  const loading = !stats || (isLeader && !volunteers);
  const activeCount = loading ? '...' : (isLeader && volunteers) ? String(volunteers.length) : stats?.activeVolunteers?.value ?? '0';
  const departmentsCount = loading ? '...' : stats?.departments?.value ?? '0';
  const todayCount = loading ? '...' : stats?.schedulesToday?.value ?? '0';
  const upcomingCount = loading ? '...' : stats?.upcomingSchedules?.value ?? '0';

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm flex flex-col h-full">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        /* For Firefox */
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 transparent;
        }
      `}</style>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-3">
            <h2 className="text-2xl font-bold text-slate-800">Voluntários Ativos</h2>
        </div>
      </div>

      {loading ? (
          <div className="animate-pulse flex-grow flex flex-col">
            <div className="h-10 bg-slate-200 rounded w-1/2 mb-4"></div>
            <div className="flex-grow space-y-3">
                <div className="h-12 bg-slate-200 rounded"></div>
                <div className="h-12 bg-slate-200 rounded"></div>
                <div className="h-12 bg-slate-200 rounded"></div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-200 flex justify-around items-center">
                <div className="h-10 bg-slate-200 rounded w-1/4"></div>
                <div className="h-10 bg-slate-200 rounded w-1/4"></div>
            </div>
          </div>
      ) : (
        <>
            <div className="flex items-center space-x-2">
                <p className="text-4xl font-bold text-slate-800">{activeCount}</p>
                <p className="text-slate-500 pt-2 text-base">{isLeader ? 'no seu departamento' : 'ativos no sistema'}</p>
            </div>
            
            {isLeader && volunteers ? (
                <div className="h-48 overflow-y-auto -mx-2 pr-2 space-y-3 mt-4 custom-scrollbar">
                    {volunteers.map(v => (
                    <div key={v.id} className="flex items-center space-x-4 p-2 rounded-lg hover:bg-slate-50">
                        <div className="flex items-center space-x-3 flex-shrink-0">
                            <span className="flex h-3 w-3 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                            </span>
                            <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm">
                                {v.initials}
                            </div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-800 text-sm truncate">{v.name}</p>
                            <p className="text-xs text-slate-500 truncate" title={(v.departments || []).map(d => d.name).join(', ')}>
                                {(v.departments || []).map(d => d.name).join(', ')}
                            </p>
                        </div>
                    </div>
                    ))}
                </div>
            ) : (
                <div className="h-24 -mx-6">
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
            )}

            {isLeader && <div className="flex-grow"></div>}

            <div className="mt-auto pt-4 border-t border-slate-200 flex justify-around items-center">
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