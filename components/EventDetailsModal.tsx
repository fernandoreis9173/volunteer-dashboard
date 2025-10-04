import React from 'react';
import type { DashboardEvent } from '../types';

interface EventDetailsModalProps {
  event: DashboardEvent | null;
  isOpen: boolean;
  onClose: () => void;
}

const EventDetailsModal: React.FC<EventDetailsModalProps> = ({ event, isOpen, onClose }) => {
  if (!isOpen || !event) {
    return null;
  }

  const formattedDate = new Date(event.date + 'T00:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const volunteerNames = Array.isArray(event.event_volunteers)
    ? event.event_volunteers.map(sv => sv.volunteers?.name).filter(Boolean)
    : [];
  const departmentNames = Array.isArray(event.event_departments)
    ? event.event_departments.map(ed => ed.departments?.name).filter(Boolean)
    : [];
  
  const getStatusInfo = () => {
    switch (event.status) {
      case 'Confirmado': return { bg: 'bg-green-100', text: 'text-green-800' };
      case 'Cancelado': return { bg: 'bg-red-100', text: 'text-red-800' };
      default: return { bg: 'bg-yellow-100', text: 'text-yellow-800' };
    }
  };
  const statusClasses = getStatusInfo();

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 z-40 flex items-center justify-center p-4 transition-opacity duration-300"
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
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0h18" /></svg>
                <span className="font-medium">{formattedDate}</span>
            </div>
             <div className="flex items-center space-x-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                <span className="font-medium">{event.start_time} - {event.end_time}</span>
            </div>
        </div>
        
        <div className="mt-6 pt-6 border-t border-slate-200 space-y-4">
            <div>
                <h3 className="text-lg font-bold text-slate-800 mb-3">Departamentos Envolvidos ({departmentNames.length})</h3>
                {departmentNames.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {departmentNames.map(name => (
                            <span key={name} className="px-3 py-1 text-sm font-semibold rounded-full bg-yellow-100 text-yellow-800">{name}</span>
                        ))}
                    </div>
                ) : <p className="text-sm text-slate-500">Nenhum departamento para este evento.</p>}
            </div>
             <div>
                <h3 className="text-lg font-bold text-slate-800 mb-3">Voluntários Escalados ({volunteerNames.length})</h3>
                {volunteerNames.length > 0 ? (
                    <div className="max-h-60 overflow-y-auto pr-2">
                        <ul className="list-disc list-inside text-slate-700 space-y-1">
                            {volunteerNames.map(name => (
                                <li key={name}>{name}</li>
                            ))}
                        </ul>
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
  );
};

export default EventDetailsModal;
