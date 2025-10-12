import React, { useState, useMemo } from 'react';
import type { DashboardEvent } from '../types';

interface UpcomingShiftsListProps {
  todaySchedules: DashboardEvent[] | undefined;
  upcomingSchedules: DashboardEvent[] | undefined;
  onViewDetails: (event: DashboardEvent) => void;
}

type EventFilter = 'today' | 'upcoming';

const ScheduleCard: React.FC<{ schedule: DashboardEvent; onViewDetails: (event: DashboardEvent) => void; }> = ({ schedule, onViewDetails }) => {
  const formattedDate = new Date(schedule.date + 'T00:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  
  const volunteerNames = schedule.event_volunteers?.map(v => v.volunteers?.name).filter(Boolean) as string[] ?? [];
  const departmentNames = schedule.event_departments?.map(d => d.departments?.name).filter(Boolean) as string[] ?? [];

  const MAX_DISPLAY = 2;

  const visibleVolunteers = volunteerNames.slice(0, MAX_DISPLAY).join(', ');
  const remainingVolunteers = volunteerNames.length - MAX_DISPLAY;

  const visibleDepartments = departmentNames.slice(0, MAX_DISPLAY).join(', ');
  const remainingDepartments = departmentNames.length - MAX_DISPLAY;


  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 relative w-80 flex-shrink-0 flex flex-col">
      <span className={`absolute top-4 right-4 text-xs font-semibold px-3 py-1 rounded-full capitalize ${schedule.status === 'Confirmado' ? 'bg-green-100 text-green-800' : schedule.status === 'Cancelado' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{schedule.status}</span>
       <button 
        onClick={() => onViewDetails(schedule)} 
        className="absolute bottom-4 right-4 p-1.5 text-slate-400 hover:text-blue-600 rounded-md hover:bg-blue-50 transition-colors"
        aria-label="Ver detalhes do evento"
        title="Ver detalhes"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </button>

      <h3 className="font-bold text-slate-800 mb-2 pr-24">{schedule.name}</h3>
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
      <div className="text-sm text-slate-600 space-y-2 pr-10">
        <p>
          <span className="font-semibold text-slate-500">Voluntários:</span>
          {volunteerNames.length > 0 ? (
            <>
              <span className="ml-2 text-slate-700">{visibleVolunteers}</span>
              {remainingVolunteers > 0 && (
                <span className="ml-2 text-blue-600 text-sm font-semibold">
                  e mais {remainingVolunteers}
                </span>
              )}
            </>
          ) : <span className="ml-2 text-slate-500 italic">Nenhum</span>}
        </p>
        <p>
          <span className="font-semibold text-slate-500">Departamentos:</span>
           {departmentNames.length > 0 ? (
             <>
              <span className="ml-2 text-blue-600 font-medium">{visibleDepartments}</span>
              {remainingDepartments > 0 && (
                 <span className="ml-2 text-blue-600 text-sm font-semibold">
                  e mais {remainingDepartments}
                </span>
              )}
            </>
          ) : <span className="ml-2 text-slate-500 italic">Nenhum</span>}
        </p>
      </div>
    </div>
  );
};

const FilterButton: React.FC<{ label: string; value: EventFilter; activeValue: EventFilter; onClick: (value: EventFilter) => void }> = ({ label, value, activeValue, onClick }) => (
    <button
        onClick={() => onClick(value)}
        className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
            activeValue === value ? 'bg-white text-slate-900 shadow-sm' : 'bg-transparent text-slate-500 hover:text-slate-900'
        }`}
    >
        {label}
    </button>
);


const UpcomingShiftsList: React.FC<UpcomingShiftsListProps> = ({ todaySchedules, upcomingSchedules, onViewDetails }) => {
  const [activeFilter, setActiveFilter] = useState<EventFilter>('upcoming');
  
  const loading = useMemo(() => {
    if (activeFilter === 'today') return todaySchedules === undefined;
    if (activeFilter === 'upcoming') return upcomingSchedules === undefined;
    return true;
  }, [activeFilter, todaySchedules, upcomingSchedules]);

  const displayedSchedules = useMemo(() => {
    if (activeFilter === 'today') return todaySchedules || [];
    return upcomingSchedules || [];
  }, [activeFilter, todaySchedules, upcomingSchedules]);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center space-x-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0h18" />
            </svg>
            <h2 className="text-xl font-bold text-slate-800">Próximos Eventos</h2>
        </div>
        <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl self-start sm:self-center">
            <FilterButton label="Hoje" value="today" activeValue={activeFilter} onClick={setActiveFilter} />
            <FilterButton label="Próximos" value="upcoming" activeValue={activeFilter} onClick={setActiveFilter} />
        </div>
      </div>
      <div className="flex space-x-4 overflow-x-auto pb-4">
        {loading ? (
            Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="bg-slate-50 p-5 rounded-xl border border-slate-200 animate-pulse w-80 flex-shrink-0">
                    <div className="h-4 bg-slate-200 rounded w-3/4 mb-4"></div>
                    <div className="space-y-2">
                        <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                        <div className="h-3 bg-slate-200 rounded w-1/3"></div>
                    </div>
                    <div className="w-full h-px bg-slate-200 my-4"></div>
                    <div className="h-3 bg-slate-200 rounded w-full"></div>
                </div>
            ))
        ) : displayedSchedules.length > 0 ? (
          displayedSchedules.map((schedule) => (
            <ScheduleCard key={schedule.id} schedule={schedule} onViewDetails={onViewDetails} />
          ))
        ) : (
          <div className="w-full flex items-center justify-center h-48">
            <p className="text-slate-500">
                {activeFilter === 'today' ? 'Nenhum evento para hoje.' : 'Nenhum evento encontrado para os próximos dias.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UpcomingShiftsList;