import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { Event as VolunteerEvent, DetailedVolunteer } from '../types';

// Countdown Timer Component - copied and adapted from EventCard.tsx
const CountdownTimer: React.FC<{ date: string; endTime: string }> = ({ date, endTime }) => {
    const calculateTimeLeft = useCallback(() => {
        const endDateTime = new Date(`${date}T${endTime}`);
        const now = new Date();
        const difference = endDateTime.getTime() - now.getTime();

        let timeLeft = { hours: 0, minutes: 0, seconds: 0 };

        if (difference > 0) {
            timeLeft = {
                hours: Math.floor(difference / (1000 * 60 * 60)),
                minutes: Math.floor((difference / 1000 / 60) % 60),
                seconds: Math.floor((difference / 1000) % 60),
            };
        }

        return { timeLeft, isOver: difference <= 0 };
    }, [date, endTime]);

    const [countdown, setCountdown] = useState(calculateTimeLeft());

    useEffect(() => {
        const timer = setInterval(() => {
            setCountdown(calculateTimeLeft());
        }, 1000);

        return () => clearInterval(timer);
    }, [calculateTimeLeft]);

    if (countdown.isOver) {
        return (
            <div className="flex items-center space-x-2 text-base">
                 <span className="flex h-3 w-3 relative">
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-slate-400"></span>
                </span>
                <span className="font-mono font-semibold text-slate-600">
                   Evento encerrado
                </span>
            </div>
        )
    }

    const pad = (num: number) => String(num).padStart(2, '0');

    return (
        <div className="flex items-center space-x-2 text-base">
            <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            <span className="font-mono font-semibold text-red-700">
               Termina em: {pad(countdown.timeLeft.hours)}:{pad(countdown.timeLeft.minutes)}:{pad(countdown.timeLeft.seconds)}
            </span>
        </div>
    );
};


const parseArrayData = (data: string[] | string | null | undefined): string[] => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === 'string') {
        if (data.startsWith('[') && data.endsWith(']')) {
            try {
                const parsed = JSON.parse(data);
                if (Array.isArray(parsed)) return parsed;
            } catch (e) { /* ignore */ }
        }
        if (data.startsWith('{') && data.endsWith('}')) {
             return data.substring(1, data.length - 1).split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        }
        if (data.trim()) {
            return data.split(',').map(s => s.trim());
        }
    }
    return [];
};


interface LiveEventDetailsModalProps {
  event: VolunteerEvent | null;
  volunteerProfile: DetailedVolunteer | null;
  isOpen: boolean;
  onClose: () => void;
}

const LiveEventDetailsModal: React.FC<LiveEventDetailsModalProps> = ({ event, volunteerProfile, isOpen, onClose }) => {
  if (!isOpen || !event || !volunteerProfile) {
    return null;
  }
  
  const relevantDepartments = useMemo(() => {
    // Find the department IDs this specific volunteer is scheduled for in this event.
    const volunteerScheduledDepartmentIds = new Set<number>();
    if (event.event_volunteers && volunteerProfile?.id) {
        for (const ev of event.event_volunteers) {
            if (ev.volunteer_id === volunteerProfile.id) {
                volunteerScheduledDepartmentIds.add(ev.department_id);
            }
        }
    }
    // Filter all departments for the event down to just the ones the volunteer is in.
    return (event.event_departments || []).filter(ed => 
        volunteerScheduledDepartmentIds.has(ed.department_id)
    );
  }, [event.event_departments, event.event_volunteers, volunteerProfile?.id]);

  const getStatusInfo = () => {
    switch (event.status) {
      case 'Confirmado': return { bg: 'bg-green-100', text: 'text-green-800' };
      case 'Cancelado': return { bg: 'bg-red-100', text: 'text-red-800' };
      default: return { bg: 'bg-yellow-100', text: 'text-yellow-800' };
    }
  };
  const statusClasses = getStatusInfo();

  const modalContent = (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 z-40 flex items-center justify-center p-4 transition-opacity duration-300"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 m-4 transform transition-all duration-300 scale-95 opacity-0 animate-fade-in-scale"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start">
            <div>
                <span className={`text-xs font-semibold px-3 py-1 rounded-full capitalize ${statusClasses.bg} ${statusClasses.text}`}>{event.status}</span>
                <h2 className="text-2xl font-bold text-slate-800 mt-2">{event.name}</h2>
            </div>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>

        <div className="mt-4 flex items-center justify-between gap-4 text-sm text-slate-600">
             <div className="flex items-center space-x-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                <span className="font-medium">{event.start_time} - {event.end_time}</span>
            </div>
            <CountdownTimer date={event.date} endTime={event.end_time} />
        </div>
        
        <div className="mt-6 pt-6 border-t border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-slate-800 mb-3">Sua Escala</h3>
            {relevantDepartments.length > 0 ? (
                <div className="space-y-4">
                    {relevantDepartments.map(ed => {
                        const volunteersInDept = (event.event_volunteers || []).filter(ev => ev.department_id === ed.department_id);
                        return (
                            <div key={ed.department_id} className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <p className="font-bold text-blue-800">{ed.departments.name}</p>
                                {volunteersInDept.length > 0 ? (
                                    <ul className="mt-2 space-y-2">
                                        {volunteersInDept.map(ev => {
                                            const isCurrentUser = ev.volunteer_id === volunteerProfile.id;
                                            return (
                                                <li key={ev.volunteer_id} className={`flex items-center justify-between p-2 rounded-md text-sm ${isCurrentUser ? 'bg-blue-100' : ''}`}>
                                                    <span className={`font-semibold ${isCurrentUser ? 'text-blue-900' : 'text-slate-700'}`}>{ev.volunteers?.name} {isCurrentUser && "(Você)"}</span>
                                                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${ev.present ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-600'}`}>
                                                        {ev.present ? 'Presente' : 'Não Marcado'}
                                                    </span>
                                                </li>
                                            )
                                        })}
                                    </ul>
                                ) : (
                                    <p className="text-sm text-blue-700 mt-1 italic">Nenhum voluntário escalado neste departamento.</p>
                                )}
                            </div>
                        )
                    })}
                </div>
            ) : <p className="text-sm text-slate-500">Você não está escalado em nenhum departamento para este evento.</p>}
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

  return ReactDOM.createPortal(modalContent, document.body);
};

export default LiveEventDetailsModal;
