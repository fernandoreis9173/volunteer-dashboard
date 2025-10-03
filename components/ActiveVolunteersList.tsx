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
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283-.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <h2 className="text-xl font-bold text-slate-800">Voluntários Ativos</h2>
      </div>
      <div className="space-y-5">
        {loading ? (
            <p className="text-slate-500">Carregando voluntários...</p>
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
