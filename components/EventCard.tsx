import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Event } from '../types';
import { convertUTCToLocal } from '../lib/utils';

// New Countdown Timer Component
const EventCountdownTimer: React.FC<{ date: string; startTime: string; endTime: string }> = ({ date, startTime, endTime }) => {
    const calculateTimeLeft = useCallback(() => {
        const { dateTime: startDateTime } = convertUTCToLocal(date, startTime);
        const { dateTime: endDateTime } = convertUTCToLocal(date, endTime);
        if (!startDateTime || !endDateTime) return { timeLeft: { hours: 0, minutes: 0, seconds: 0 }, isOver: true };

        if (endDateTime < startDateTime) {
            endDateTime.setDate(endDateTime.getDate() + 1);
        }
        
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
    }, [date, startTime, endTime]);

    const [countdown, setCountdown] = useState(calculateTimeLeft());

    useEffect(() => {
        const timer = setInterval(() => {
            setCountdown(calculateTimeLeft());
        }, 1000);

        return () => clearInterval(timer);
    }, [calculateTimeLeft]);

    if (countdown.isOver) {
        return (
            <div className="flex items-center space-x-2">
                 <span className="flex h-3 w-3 relative">
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-slate-400"></span>
                </span>
                <span className="font-mono text-sm font-semibold text-slate-600">
                   Evento encerrado
                </span>
            </div>
        )
    }

    const pad = (num: number) => String(num).padStart(2, '0');

    return (
        <div className="flex items-center space-x-2">
            <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            <span className="font-mono text-sm font-semibold text-red-700">
               Termina em: {pad(countdown.timeLeft.hours)}:{pad(countdown.timeLeft.minutes)}:{pad(countdown.timeLeft.seconds)}
            </span>
        </div>
    );
};


interface EventCardProps {
    event: Event;
    userRole: string | null;
    leaderDepartmentId: number | null;
    onEdit: (event: Event) => void;
    onDelete: (id: number) => void;
    onAddDepartment: (event: Event) => void;
    onMarkAttendance: (event: Event) => void; // New prop
    onGenerateQrCode?: (event: Event) => void; // Added optional prop for volunteers
    onRequestSwap?: (event: Event) => void; // Added optional prop for volunteers
    onViewTimeline?: (event: Event) => void;
    volunteerId?: number | null;
    isToday?: boolean;
    isHighlighted?: boolean;
    isFilteredByMyDepartment?: boolean;
}

const EventCard: React.FC<EventCardProps> = ({ 
    event, 
    userRole, 
    leaderDepartmentId, 
    onEdit, 
    onDelete, 
    onAddDepartment, 
    onMarkAttendance,
    onGenerateQrCode,
    onRequestSwap,
    onViewTimeline,
    isHighlighted = false, 
    isFilteredByMyDepartment = false 
}) => {
    const [expanded, setExpanded] = useState(false);
    const [expandedDepartments, setExpandedDepartments] = useState<Set<number>>(new Set());
    const [now, setNow] = useState(new Date());
    
    const isLeader = userRole === 'leader' || userRole === 'lider';
    const isAdmin = userRole === 'admin';
    const isDepartmentInvolved = isLeader && leaderDepartmentId ? event.event_departments.some(ed => ed.department_id === leaderDepartmentId) : false;
    
    // Refresh 'now' every 10 seconds to ensure buttons update automatically when event starts/ends
    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 10000); 
        return () => clearInterval(interval);
    }, []);

    const { dateTime: startDateTime, fullDate: localFullDate, time: localStartTime } = convertUTCToLocal(event.date, event.start_time);
    const { dateTime: endDateTime, time: localEndTime } = convertUTCToLocal(event.date, event.end_time);

    // FIX: Handle events that cross midnight in UTC timezone.
    if (startDateTime && endDateTime && endDateTime < startDateTime) {
        endDateTime.setDate(endDateTime.getDate() + 1);
    }

    const hasEventStarted = startDateTime ? now >= startDateTime : false;
    const isToday = startDateTime ? startDateTime.toLocaleDateString() === now.toLocaleDateString() : false;
    const isLive = startDateTime && endDateTime ? now >= startDateTime && now < endDateTime : false;
    const isFinished = endDateTime ? now > endDateTime : false;

    const canLeaderSchedule = isLeader && event.status === 'Confirmado' && !hasEventStarted;
    const isVolunteer = !isLeader && !isAdmin && onGenerateQrCode; // Helper to identify volunteer view
    const isWaitingToStart = isToday && !isLive && !isFinished;

    const departmentsToDisplay = useMemo(() => {
        if (isLeader && isFilteredByMyDepartment && leaderDepartmentId) {
            return event.event_departments.filter(ed => ed.department_id === leaderDepartmentId);
        }
        return event.event_departments;
    }, [event.event_departments, isLeader, isFilteredByMyDepartment, leaderDepartmentId]);

    const toggleDepartmentExpansion = (departmentId: number) => {
        setExpandedDepartments(prev => {
            const newSet = new Set(prev);
            if (newSet.has(departmentId)) {
                newSet.delete(departmentId);
            } else {
                newSet.add(departmentId);
            }
            return newSet;
        });
    };

    return (
        <div 
            className={`p-5 rounded-xl shadow-sm border transition-all duration-300 border-l-4 relative ${isHighlighted ? 'ring-2 ring-offset-2 ring-blue-500' : ''} ${isDepartmentInvolved ? 'bg-blue-50/70 border-blue-200' : 'bg-white border-slate-200'}`}
            style={{ borderLeftColor: event.color || '#e2e8f0' }}
        >
            {/* --- Top Right Controls --- */}
            <div className="absolute top-4 right-4 flex items-center gap-1">
                <button onClick={() => setExpanded(!expanded)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
                </button>
                {isAdmin && (
                    <>
                    <button onClick={() => onEdit(event)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg></button>
                    <button onClick={() => onDelete(event.id!)} className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.134-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.067-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg></button>
                    </>
                )}
            </div>

            {/* --- Main Info --- */}
            <div className="pr-16 sm:pr-24">
                {isLive ? (
                    <div className="mb-2">
                        <EventCountdownTimer date={event.date} startTime={event.start_time} endTime={event.end_time} />
                    </div>
                ) : (
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full capitalize mb-2 inline-block ${event.status === 'Confirmado' ? 'bg-green-100 text-green-800' : event.status === 'Cancelado' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{event.status}</span>
                )}
                <h3 className="font-bold text-slate-800 text-lg">{event.name}</h3>
                <div className="flex flex-col sm:flex-row sm:items-center gap-x-4 gap-y-1 text-sm text-slate-500 mt-1">
                    <span className="flex items-center gap-1.5"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0h18" /></svg>{localFullDate}</span>
                    <span className="flex items-center gap-1.5"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>{localStartTime} - {localEndTime}</span>
                </div>
            </div>

            {/* --- Action Buttons --- */}
            <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {isFinished ? (
                    <div className="flex items-center space-x-2 text-sm text-slate-500 font-medium bg-slate-100 px-4 py-2 rounded-lg w-full sm:w-auto justify-center sm:justify-start">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Encerrado</span>
                    </div>
                ) : (
                    <>
                        {/* Leader Actions */}
                        {isLeader && isToday && isDepartmentInvolved && (
                            hasEventStarted ? (
                                <button onClick={() => onMarkAttendance(event)} className="text-center px-4 py-2 text-sm bg-teal-500 text-white font-semibold rounded-lg hover:bg-teal-600 shadow-sm transition-colors">
                                    Marcar Presença
                                </button>
                            ) : (
                                <div className="text-center px-4 py-2 text-sm bg-slate-100 text-slate-500 font-semibold rounded-lg border border-slate-200 cursor-not-allowed flex items-center justify-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                                    Aguardando Início
                                </div>
                            )
                        )}
                        {isLeader && canLeaderSchedule && isDepartmentInvolved && (
                             <button onClick={() => onEdit(event)} className="text-center px-4 py-2 text-sm bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 shadow-sm">
                                Escalar Voluntários
                            </button>
                        )}
                         {isLeader && canLeaderSchedule && !isDepartmentInvolved && (
                            <button onClick={() => onAddDepartment(event)} className="text-center px-4 py-2 text-sm bg-indigo-500 text-white font-semibold rounded-lg hover:bg-indigo-600 shadow-sm">
                                Adicionar meu Departamento
                            </button>
                        )}

                        {/* Volunteer Actions */}
                        {isVolunteer && onGenerateQrCode && onRequestSwap && (
                            <div className="flex flex-col sm:flex-row gap-3 w-full">
                                {isLive ? (
                                    <button
                                        onClick={() => onGenerateQrCode(event)}
                                        className="flex-1 text-center px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 shadow-sm"
                                    >
                                        Gerar QR Code
                                    </button>
                                ) : isWaitingToStart ? (
                                    <button
                                        disabled
                                        className="flex-1 text-center px-4 py-2 text-sm bg-slate-100 text-slate-400 font-semibold rounded-lg cursor-not-allowed border border-slate-200"
                                    >
                                        Check-in às {localStartTime}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => onRequestSwap(event)}
                                        className="flex-1 text-center px-4 py-2 text-sm bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 shadow-sm"
                                    >
                                        Preciso Trocar
                                    </button>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {expanded && (
            <div className="mt-4 pt-4 border-t border-slate-200">
                <h4 className="text-sm font-bold text-slate-600 uppercase mb-3">Departamentos e Voluntários</h4>
                <div className="space-y-4">
                    {departmentsToDisplay.length > 0 ? departmentsToDisplay.map(({ departments }) => {
                        if (!departments) return null;
                        const volunteersForDept = (event.event_volunteers || []).filter(ev => ev.department_id === departments.id);
                        const presentCount = volunteersForDept.filter(v => v.present).length;
                        const hasScheduled = volunteersForDept.length > 0;
                        const isLeadersDept = isLeader && leaderDepartmentId === departments.id;

                        const MAX_VISIBLE_VOLUNTEERS = 3;
                        const isLongList = volunteersForDept.length > MAX_VISIBLE_VOLUNTEERS;
                        const isDeptExpanded = expandedDepartments.has(departments.id);
                        const visibleVolunteers = isLongList && !isDeptExpanded
                            ? volunteersForDept.slice(0, MAX_VISIBLE_VOLUNTEERS)
                            : volunteersForDept;

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
                                    {hasScheduled ? <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0 1 18 0Z" /></svg>}
                                    <span>{hasScheduled ? `Presentes: ${presentCount}/${volunteersForDept.length}` : 'Pendente'}</span>
                                </span>
                            </div>
                            {hasScheduled && (
                                <div className="mt-3">
                                    <div className="flex flex-wrap gap-2">
                                        {visibleVolunteers.map(v => {
                                            if (!v.volunteers) return null;
                                            const volunteerName = v.volunteers.name || '';
                                            return (
                                                <div key={v.volunteer_id} className={`flex items-center space-x-2 pl-1 pr-3 py-1 rounded-full text-sm font-semibold border ${v.present ? 'bg-green-100 text-green-800 border-green-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                                    <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-xs ${v.present ? 'bg-green-500' : 'bg-slate-500'}`}>
                                                        {v.volunteers.initials}
                                                    </div>
                                                    <span>{volunteerName}</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                    {isLongList && (
                                        <button 
                                            onClick={() => toggleDepartmentExpansion(departments.id)}
                                            className="text-sm font-semibold text-blue-600 hover:text-blue-800 mt-2"
                                        >
                                            {isDeptExpanded
                                                ? 'Ver menos'
                                                : `+ ${volunteersForDept.length - MAX_VISIBLE_VOLUNTEERS} voluntário(s)`
                                            }
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                        )
                    }) : <p className="text-sm text-slate-500">Nenhum departamento para exibir com os filtros atuais.</p>}
                </div>
            </div>
            )}
        </div>
    );
}

export default React.memo(EventCard);