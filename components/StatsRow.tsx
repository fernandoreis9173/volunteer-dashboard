import React from 'react';
import type { Stat } from '../types';

interface StatsRowProps {
  stats: {
    activeVolunteers: Stat;
    departments: Stat;
    schedulesToday: Stat;
    schedulesTomorrow: Stat;
  } | undefined;
  loading: boolean;
}

// FIX: Updated the type of the 'icon' prop to React.ReactElement<any> to allow adding a className via cloneElement.
const StatAvatar: React.FC<{ icon: React.ReactElement<any>; color: 'blue' | 'teal' | 'purple' | 'orange' }> = ({ icon, color }) => {
    const colorClasses = {
        blue: 'bg-blue-100 text-blue-600',
        teal: 'bg-teal-100 text-teal-600',
        purple: 'bg-purple-100 text-purple-600',
        orange: 'bg-orange-100 text-orange-600',
    };
    return (
        <div className={`w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-full ${colorClasses[color]}`}>
            {React.cloneElement(icon, { className: 'h-6 w-6' })}
        </div>
    );
};


const StatsRow: React.FC<StatsRowProps> = ({ stats, loading }) => {
  const statItems = [
    { 
        title: 'Voluntários Ativos', 
        data: loading ? undefined : stats?.activeVolunteers,
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m-7.5-2.226a3 3 0 0 0-4.682 2.72 9.094 9.094 0 0 0 3.741.479m7.5-2.226V18a2.25 2.25 0 0 1-2.25 2.25H12a2.25 2.25 0 0 1-2.25-2.25V18.226m3.75-10.5a3.375 3.375 0 0 0-6.75 0v1.5a3.375 3.375 0 0 0 6.75 0v-1.5ZM10.5 8.25a3.375 3.375 0 0 0-6.75 0v1.5a3.375 3.375 0 0 0 6.75 0v-1.5Z" />
            </svg>
        ),
        color: 'blue' as const,
    },
    { 
        title: 'Departamentos', 
        data: loading ? undefined : stats?.departments,
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18h16.5M5.25 6H18.75m-13.5 0V21m13.5-15V21m-10.5-9.75h.008v.008H8.25v-.008ZM8.25 15h.008v.008H8.25V15Zm3.75-9.75h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm3.75-9.75h.008v.008H15.75v-.008ZM15.75 15h.008v.008H15.75V15Z" />
            </svg>
        ),
        color: 'teal' as const,
    },
    { 
        title: 'Eventos Hoje', 
        data: loading ? undefined : stats?.schedulesToday,
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0h18" />
            </svg>
        ),
        color: 'purple' as const,
    },
    { 
        title: 'Eventos Amanhã', 
        data: loading ? undefined : stats?.schedulesTomorrow,
        icon: (
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0h18" />
            </svg>
        ),
        color: 'orange' as const,
    },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-x sm:divide-y-0 divide-slate-200">
        {statItems.map((item, index) => (
          <div key={index} className="px-4 py-5 sm:p-6 flex items-center space-x-4">
            <StatAvatar icon={item.icon} color={item.color} />
            <div>
              <p className="text-sm text-slate-500">{item.title}</p>
              <p className="text-3xl font-bold text-slate-800 mt-1">
                  {loading ? '...' : item.data?.value ?? '0'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StatsRow;
