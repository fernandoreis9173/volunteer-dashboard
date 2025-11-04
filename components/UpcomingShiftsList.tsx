import React, { useState, useMemo } from 'react';
import type { DashboardEvent } from '../types';
import { convertUTCToLocal } from '../lib/utils';

interface UpcomingShiftsListProps {
  todaySchedules: DashboardEvent[] | undefined;
  upcomingSchedules: DashboardEvent[] | undefined;
  onViewDetails: (event: DashboardEvent) => void;
  userRole: string | null;
  onMarkAttendance: (event: DashboardEvent) => void;
  onViewTimeline: (event: DashboardEvent) => void;
}

type EventFilter = 'today' | 'upcoming';

const ScheduleCard: React.FC<{ schedule: DashboardEvent; onViewDetails: (event: DashboardEvent) => void; userRole: string | null; onMarkAttendance: (event: DashboardEvent) => void; onViewTimeline: (event: DashboardEvent) => void; isToday: boolean; }> = ({ schedule, onViewDetails, userRole, onMarkAttendance, onViewTimeline, isToday }) => {
  const { fullDate: formattedDate, time: startTime, dateTime: startDateTime } = convertUTCToLocal(schedule.date, schedule.start_time);
  const { time: endTime, dateTime: endDateTime } = convertUTCToLocal(schedule.date, schedule.end_time);
  
  // FIX: Handle events that cross midnight in UTC timezone.
  if (startDateTime && endDateTime && endDateTime < startDateTime) {
      endDateTime.setDate(endDateTime.getDate() + 1);
  }

  const volunteerNames = schedule.event_volunteers?.map(v => v.volunteers?.name).filter(Boolean) as string[] ?? [];
  const departmentNames = schedule.event_departments?.map(d => d.departments?.name).filter(Boolean) as string[] ?? [];

  const MAX_DISPLAY = 2;

  const visibleVolunteers = volunteerNames.slice(0, MAX_DISPLAY).join(', ');
  const remainingVolunteers = volunteerNames.length - MAX_DISPLAY;

  const visibleDepartments = departmentNames.slice(0, MAX_DISPLAY).join(', ');
  const remainingDepartments = departmentNames.length - MAX_DISPLAY;

  const isLeader = userRole === 'leader' || userRole === 'lider';
  
  const cardContainerClasses = isToday ? 'w-full' : 'w-80 flex-shrink-0';
  
  const now = new Date();
  const isFinished = endDateTime ? now > endDateTime : false;

  return (
    <div className={`bg-white p-5 rounded-xl border border-slate-200 relative flex flex-col h-full ${cardContainerClasses}`}>
      <span className={`absolute top-4 right-4 text-xs font-semibold px-3 py-1 rounded-full capitalize ${schedule.status === 'Confirmado' ? 'bg-green-100 text-green-800' : schedule.status === 'Cancelado' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{schedule.status}</span>
      
      <div>
        <h3 className="font-bold text-slate-800 mb-2 pr-24">{schedule.name}</h3>
        <div className="space-y-2 text-sm text-slate-500">
          <div className="flex items-center space-x-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1v12z" />
            </svg>
            <span>{formattedDate}</span>
          </div>
          <div className="flex items-center space-x-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <span>{startTime} - {endTime}</span>
          </div>
           {schedule.local && (
            <div className="flex items-center space-x-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                </svg>
                <span>{schedule.local}</span>
            </div>
          )}
        </div>
      </div>
      
      {schedule.observations && (
        <div className="mt-3 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <p className="font-semibold text-slate-500 mb-1 uppercase tracking-wider">Observações</p>
            <p className="whitespace-pre-wrap">{schedule.observations}</p>
        </div>
      )}

      {(schedule.cronograma_principal_id || schedule.cronograma_kids_id) && (
        <div className="mt-3">
            <button
                onClick={() => onViewTimeline(schedule)}
                className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                aria-label="Ver cronograma"
                title="Ver Cronograma"
            >
                Ver cronograma
            </button>
        </div>
      )}

      <div className="flex-grow"></div>

      <div>
        <div className="w-full h-px bg-slate-200 my-4"></div>
        <div className="flex justify-between items-end gap-4">
          <div className="text-sm text-slate-600 space-y-2 min-w-0">
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
          <div className="flex items-center space-x-1 flex-shrink-0">
            {isLeader && isToday && !isFinished && (
                <button
                    onClick={() => onMarkAttendance(schedule)}
                    className="p-1.5 text-slate-400 hover:text-teal-600 rounded-md hover:bg-teal-50 transition-colors"
                    aria-label="Marcar presença"
                    title="Marcar Presença"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8V6a2 2 0 0 1 2-2h2" /><path strokeLinecap="round" strokeLinejoin="round" d="M3 16v2a2 2 0 0 0 2 2h2" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 8V6a2 2 0 0 0-2-2h-2" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 16v2a2 2 0 0 1-2 2h-2" />
                    </svg>
                </button>
            )}
            <button 
                onClick={() => onViewDetails(schedule)} 
                className="p-1.5 text-slate-400 hover:text-blue-600 rounded-md hover:bg-blue-50 transition-colors"
                aria-label="Ver detalhes do evento"
                title="Ver detalhes"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            </button>
          </div>
        </div>
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


const UpcomingShiftsList: React.FC<UpcomingShiftsListProps> = ({ todaySchedules, upcomingSchedules, onViewDetails, userRole, onMarkAttendance, onViewTimeline }) => {
  const [activeFilter, setActiveFilter] = useState<EventFilter>('today');
  
  const loading = useMemo(() => {
    if (activeFilter === 'today') return todaySchedules === undefined;
    if (activeFilter === 'upcoming') return upcomingSchedules === undefined;
    return true;
  }, [activeFilter, todaySchedules, upcomingSchedules]);

  const displayedSchedules = useMemo(() => {
    if (activeFilter === 'today') return todaySchedules || [];
    return upcomingSchedules || [];
  }, [activeFilter, todaySchedules, upcomingSchedules]);

  const isToday = activeFilter === 'today';

  const listContainerClasses = isToday
    ? "grid grid-cols-1 md:grid-cols-2 gap-4 flex-grow"
    : "flex overflow-x-auto space-x-4 pb-4 no-scrollbar";

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm h-full flex flex-col">
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center space-x-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0h18" />
            </svg>
            <h2 className="text-xl font-bold text-slate-800">Próximos Eventos</h2>
        </div>
        <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl self-start sm:self-center">
            <FilterButton label="Hoje" value="today" activeValue={activeFilter} onClick={setActiveFilter} />
            <FilterButton label="Próximos" value="upcoming" activeValue={activeFilter} onClick={setActiveFilter} />
        </div>
      </div>
      <div className={listContainerClasses}>
        {loading && activeFilter === 'upcoming' ? null : loading ? (
            Array.from({ length: 2 }).map((_, index) => (
                <div key={index} className={`p-5 rounded-xl border border-slate-200 animate-pulse ${!isToday ? 'w-80 flex-shrink-0' : 'w-full'}`}>
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
            <ScheduleCard 
              key={schedule.id} 
              schedule={schedule} 
              onViewDetails={onViewDetails} 
              userRole={userRole}
              onMarkAttendance={onMarkAttendance}
              onViewTimeline={onViewTimeline}
              isToday={isToday}
            />
          ))
        ) : (
          <div className="col-span-1 md:col-span-2 w-full flex items-center justify-center h-48">
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