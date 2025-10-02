import React, { useState } from 'react';
import { Event } from '../types';

interface EventCardProps {
    event: Event;
    userRole: string | null;
    leaderDepartmentId: number | null;
    onEdit: (event: Event) => void;
    onDelete: (id: number) => void;
    onAddDepartment: (eventId: number) => void;
}

const EventCard: React.FC<EventCardProps> = ({ event, userRole, leaderDepartmentId, onEdit, onDelete, onAddDepartment }) => {
    const [expanded, setExpanded] = useState(false);
    
    const isLeader = userRole === 'leader' || userRole === 'lider';
    const isAdmin = userRole === 'admin';
    const isDepartmentInvolved = !!leaderDepartmentId && event.event_departments.some(ed => ed.department_id === leaderDepartmentId);
    const hasLeaderScheduled = isDepartmentInvolved && event.event_volunteers.some(ev => ev.department_id === leaderDepartmentId);

    return (
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
                <div>
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full capitalize mb-2 inline-block ${event.status === 'Confirmado' ? 'bg-green-100 text-green-800' : event.status === 'Cancelado' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{event.status}</span>
                    <h3 className="font-bold text-slate-800 text-lg">{event.name}</h3>
                    <div className="flex items-center space-x-4 text-sm text-slate-500 mt-1">
                        <span><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline -mt-1 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>{new Date(event.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                        <span><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline -mt-1 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{event.start_time} - {event.end_time}</span>
                    </div>
                </div>
                 <div className="flex items-center gap-2 self-start sm:self-center flex-shrink-0">
                    {isLeader && !isDepartmentInvolved && (
                        <button onClick={() => onAddDepartment(event.id!)} className="px-3 py-1.5 bg-indigo-500 text-white text-sm font-semibold rounded-lg hover:bg-indigo-600 shadow-sm">
                            Adicionar meu Departamento
                        </button>
                    )}
                    {isLeader && isDepartmentInvolved && !hasLeaderScheduled && (
                        <button onClick={() => onEdit(event)} className="px-3 py-1.5 bg-blue-500 text-white text-sm font-semibold rounded-lg hover:bg-blue-600 shadow-sm">
                            Escalar Voluntários
                        </button>
                    )}
                    <button onClick={() => setExpanded(!expanded)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100">
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {(isAdmin || isDepartmentInvolved) && (
                        <button onClick={() => onEdit(event)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" /></svg></button>
                    )}
                    {isAdmin && (
                        <button onClick={() => onDelete(event.id!)} className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                    )}
                </div>
            </div>
            {expanded && (
            <div className="mt-4 pt-4 border-t border-slate-200">
                <h4 className="text-sm font-bold text-slate-600 uppercase mb-3">Departamentos e Voluntários</h4>
                <div className="space-y-4">
                    {event.event_departments.length > 0 ? event.event_departments.map(({ departments }) => {
                        if (!departments) return null;
                        const volunteersForDept = event.event_volunteers.filter(ev => ev.department_id === departments.id);
                        const hasScheduled = volunteersForDept.length > 0;
                        const isLeadersDept = isLeader && departments.id === leaderDepartmentId;

                        return (
                        <div key={departments.id} className={`p-4 rounded-lg ${isLeadersDept ? 'bg-blue-50' : 'bg-slate-50/70'}`}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center space-x-3">
                                        <p className={`font-bold text-lg ${isLeadersDept ? 'text-blue-800' : 'text-slate-800'}`}>{departments.name}</p>
                                        {isLeadersDept && (
                                            <span className="text-xs font-semibold px-2 py-1 rounded-md bg-blue-600 text-white">Seu Departamento</span>
                                        )}
                                    </div>
                                    {departments.leader && (
                                        <p className="text-xs text-slate-500 font-medium mt-1">Líder: {departments.leader}</p>
                                    )}
                                </div>
                                <span className={`flex items-center space-x-1.5 text-sm font-semibold ${hasScheduled ? 'text-green-600' : 'text-amber-600'}`}>
                                    {hasScheduled ? <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9 5a1 1 0 112 0v6a1 1 0 11-2 0V5zm1 11a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>}
                                    <span>{hasScheduled ? `Escalado (${volunteersForDept.length})` : 'Pendente'}</span>
                                </span>
                            </div>
                            {hasScheduled && (
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {volunteersForDept.map(v => {
                                        if (!v.volunteers) return null;
                                        const volunteerName = v.volunteers.name || '';
                                        return (
                                            <div key={v.volunteer_id} className="flex items-center space-x-2 pl-1 pr-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                                <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-xs bg-slate-500">
                                                    {v.volunteers.initials}
                                                </div>
                                                <span>{volunteerName}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                        )
                    }) : <p className="text-sm text-slate-500">Nenhum departamento adicionado a este evento ainda.</p>}
                </div>
            </div>
            )}
        </div>
    );
}

export default EventCard;