

import React from 'react';
import type { DashboardVolunteer } from '../types';

interface ActiveVolunteersListProps {
  volunteers: DashboardVolunteer[];
  loading: boolean;
}

const VolunteerItem: React.FC<{ volunteer: DashboardVolunteer }> = ({ volunteer }) => (
  <div className="flex items-center space-x-4">
    <div className={`w-10 h-10 rounded-full bg-blue-500 flex-shrink-0 flex items-center justify-center text-white font-bold`}>
      {volunteer.initials}
    </div>
    <div>
      <p className="font-semibold text-slate-800">{volunteer.name}</p>
      <p className="text-sm text-slate-500">{volunteer.email}</p>
      {(volunteer.departments || []).length > 0 && (
        <p className="text-sm text-blue-600">{(volunteer.departments || []).join(', ')}</p>
      )}
    </div>
  </div>
);

const ActiveVolunteersList: React.FC<ActiveVolunteersListProps> = ({ volunteers, loading }) => {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm h-full">
      <div className="flex items-center space-x-2 mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m-7.5-2.226a3 3 0 0 0-4.682 2.72 9.094 9.094 0 0 0 3.741.479m7.5-2.226V18a2.25 2.25 0 0 1-2.25 2.25H12a2.25 2.25 0 0 1-2.25-2.25V18.226m3.75-10.5a3.375 3.375 0 0 0-6.75 0v1.5a3.375 3.375 0 0 0 6.75 0v-1.5ZM10.5 8.25a3.375 3.375 0 0 0-6.75 0v1.5a3.375 3.375 0 0 0 6.75 0v-1.5Z" />
        </svg>
        <h2 className="text-xl font-bold text-slate-800">Voluntários Ativos</h2>
      </div>
      <div className="space-y-5">
        {loading ? (
            Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex items-center space-x-4 animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex-shrink-0"></div>
                    <div className="flex-1 space-y-2 py-1">
                        <div className="h-3 bg-slate-200 rounded w-3/4"></div>
                        <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                    </div>
                </div>
            ))
        ) : volunteers.length > 0 ? (
            volunteers.map((volunteer) => (
                <VolunteerItem key={volunteer.id} volunteer={volunteer} />
            ))
        ) : (
            <p className="text-slate-500">Nenhum voluntário ativo encontrado.</p>
        )}
      </div>
    </div>
  );
};

export default ActiveVolunteersList;