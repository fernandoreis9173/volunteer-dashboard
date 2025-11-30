import React, { useMemo } from 'react';
import ReactDOM from 'react-dom';
import type { DashboardEvent } from '../types';
import { convertUTCToLocal } from '../lib/utils';

interface EventDetailsModalProps {
  event: DashboardEvent | null;
  isOpen: boolean;
  onClose: () => void;
  userRole?: string | null;
  leaderDepartmentId?: number | null;
}

const EventDetailsModal: React.FC<EventDetailsModalProps> = ({ event, isOpen, onClose, userRole, leaderDepartmentId }) => {
  const isLeader = userRole === 'leader' || userRole === 'lider';
  // Updated to show attendance status and toggle list

  // FIX: Moved all hook calls and derived state calculations to the top level,
  // before the early return, to comply with the Rules of Hooks. Added null checks
  // for the `event` prop within each hook to prevent runtime errors when the modal is closed.

  const { formattedDate, startTime, endTime } = useMemo(() => {
    if (!event) return { formattedDate: '', startTime: '', endTime: '' };
    const { fullDate: formattedDate, time: startTime } = convertUTCToLocal(event.date, event.start_time);
    const { time: endTime } = convertUTCToLocal(event.date, event.end_time);
    return { formattedDate, startTime, endTime };
  }, [event]);

  const relevantVolunteers = useMemo(() => {
    if (!event || !Array.isArray(event.event_volunteers)) {
      return [];
    }



    if (isLeader && leaderDepartmentId) {
      return event.event_volunteers.filter(sv => {
        return Number(sv.department_id) === Number(leaderDepartmentId);
      });
    }
    return event.event_volunteers;
  }, [event, isLeader, leaderDepartmentId]);

  const [showAllVolunteers, setShowAllVolunteers] = React.useState(false);

  const volunteerList = useMemo(() => {
    return relevantVolunteers.map(sv => ({
      name: sv.volunteers?.name || 'Voluntário Desconhecido',
      present: sv.present
    })).filter(v => v.name !== 'Voluntário Desconhecido');
  }, [relevantVolunteers]);

  const displayedVolunteers = useMemo(() => {
    return showAllVolunteers ? volunteerList : volunteerList.slice(0, 5);
  }, [volunteerList, showAllVolunteers]);

  const relevantDepartments = useMemo(() => {
    if (!event || !Array.isArray(event.event_departments)) {
      return [];
    }

    if (isLeader && leaderDepartmentId) {
      return event.event_departments.filter(ed => {
        const deptId = ed.departments?.id ?? ed.department_id;
        return Number(deptId) === Number(leaderDepartmentId);
      });
    }
    return event.event_departments;
  }, [event, isLeader, leaderDepartmentId]);

  const departmentNames = useMemo(() => {
    return relevantDepartments.map(ed => ed.departments?.name).filter(Boolean);
  }, [relevantDepartments]);

  const statusClasses = useMemo(() => {
    if (!event) return { bg: 'bg-yellow-100', text: 'text-yellow-800' };
    switch (event.status) {
      case 'Confirmado': return { bg: 'bg-green-100', text: 'text-green-800' };
      case 'Cancelado': return { bg: 'bg-red-100', text: 'text-red-800' };
      default: return { bg: 'bg-yellow-100', text: 'text-yellow-800' };
    }
  }, [event]);


  if (!isOpen || !event) {
    return null;
  }

  const modalMarkup = (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4 transition-opacity duration-300"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 m-4 transform transition-all duration-300 scale-95 opacity-0 animate-fade-in-scale"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-start">
            <div>
              <span className={`text-xs font-semibold px-3 py-1 rounded-full capitalize ${statusClasses.bg} ${statusClasses.text}`}>{event.status}</span>
              <h2 className="text-2xl font-bold text-slate-800 mt-2">{event.name}</h2>
            </div>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-slate-600">
            <div className="flex items-center space-x-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0h18" />
              </svg>
              <span className="font-medium">{formattedDate}</span>
            </div>
            <div className="flex items-center space-x-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <span className="font-medium">{startTime} - {endTime}</span>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-200 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800 mb-3">
                {isLeader ? 'Seu Departamento' : `Departamentos Envolvidos (${departmentNames.length})`}
              </h3>
              {departmentNames.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {departmentNames.map(name => (
                    <span key={name} className="px-3 py-1 text-sm font-semibold rounded-full bg-yellow-100 text-yellow-800">{name}</span>
                  ))}
                </div>
              ) : <p className="text-sm text-slate-500">Nenhum departamento para este evento.</p>}
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 mb-3">Voluntários Escalados ({volunteerList.length})</h3>
              {volunteerList.length > 0 ? (
                <div className="space-y-2">
                  <ul className="space-y-2">
                    {displayedVolunteers.map((vol, index) => (
                      <li key={index} className="flex items-center justify-between text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <span className="flex items-center space-x-2">
                          <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                          <span>{vol.name}</span>
                        </span>
                        {vol.present && (
                          <span className="flex items-center space-x-1 text-xs font-semibold text-green-700 bg-green-100 px-2 py-1 rounded-full">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            <span>Confirmado</span>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {volunteerList.length > 5 && (
                    <button
                      onClick={() => setShowAllVolunteers(!showAllVolunteers)}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline focus:outline-none transition-colors"
                    >
                      {showAllVolunteers ? 'Ver menos' : `Ver mais (${volunteerList.length - 5})`}
                    </button>
                  )}
                </div>
              ) : <p className="text-sm text-slate-500">Nenhum voluntário escalado para este evento.</p>}
            </div>
          </div>
        </div>
        <style>{`
          @keyframes fade-in-scale {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
          }
          .animate-fade-in-scale {
            animation: fade-in-scale 0.2s ease-out forwards;
          }
        `}</style>
      </div>
    </>
  );

  return ReactDOM.createPortal(modalMarkup, document.body);
};

export default EventDetailsModal;