
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
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>{formattedDate}</span>
        </div>
        <div className="flex items-center space-x-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
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
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <h2 className="text-xl font-bold text-slate-800">Próximos Eventos</h2>
      </div>
      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center items-center py-10">
            <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
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
