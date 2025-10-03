

import React from 'react';
import type { DashboardEvent } from '../types';

interface UpcomingShiftsListProps {
  schedules: DashboardEvent[];
  loading: boolean;
}

const ScheduleCard: React.FC<{ schedule: DashboardEvent }> = ({ schedule }) => {
  const formattedDate = new Date(schedule.date + 'T00:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  
  const volunteerNames = Array.isArray(schedule.event_volunteers)
    ? schedule.event_volunteers.map(sv => sv.volunteers?.name).filter(Boolean).join(', ')
    : '';
  const departmentNames = Array.isArray(schedule.event_departments)
    ? schedule.event_departments.map(ed => ed.departments?.name).filter(Boolean).join(', ')
    : '';


  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 relative">
      <span className={`absolute top-4 right-4 text-xs font-semibold px-3 py-1 rounded-full capitalize ${schedule.status === 'Confirmado' ? 'bg-green-100 text-green-800' : schedule.status === 'Cancelado' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{schedule.status}</span>
      <h3 className="font-bold text-slate-800 mb-2">{schedule.name}</h3>
      <div className="space-y-2 text-sm text-slate-500">
        <div className="flex items-center space-x-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0h18" />
          </svg>
          <span>{formattedDate}</span>
        </div>
        <div className="flex items-center space-x-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <span>{schedule.start_time} - {schedule.end_time}</span>
        </div>
      </div>
      <div className="w-full h-px bg-slate-200 my-4"></div>
      <p className="text-sm text-slate-600">
        {volunteerNames || 'Nenhum voluntário escalado'} • <span className="text-blue-600 font-medium">{departmentNames || 'Nenhum departamento'}</span>
      </p>
    </div>
  );
};

const UpcomingShiftsList: React.FC<UpcomingShiftsListProps> = ({ schedules, loading }) => {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm h-full">
      <div className="flex items-center space-x-2 mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0h18" />
        </svg>
        <h2 className="text-xl font-bold text-slate-800">Próximos Eventos</h2>
      </div>
      <div className="space-y-4">
        {loading ? (
            Array.from({ length: 2 }).map((_, index) => (
                <div key={index} className="bg-slate-50 p-5 rounded-xl border border-slate-200 animate-pulse">
                    <div className="h-4 bg-slate-200 rounded w-3/4 mb-4"></div>
                    <div className="space-y-2">
                        <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                        <div className="h-3 bg-slate-200 rounded w-1/3"></div>
                    </div>
                    <div className="w-full h-px bg-slate-200 my-4"></div>
                    <div className="h-3 bg-slate-200 rounded w-full"></div>
                </div>
            ))
        ) : schedules.length > 0 ? (
          schedules.map((schedule) => (
            <ScheduleCard key={schedule.id} schedule={schedule} />
          ))
        ) : (
          <p className="text-slate-500">Nenhum evento futuro encontrado.</p>
        )}
      </div>
    </div>
  );
};

export default UpcomingShiftsList;