import React, { useMemo, useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Event } from '../types';

interface DashboardCalendarProps {
    events: Event[];
}

const DashboardCalendar: React.FC<DashboardCalendarProps> = ({ events }) => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const [selectedDate, setSelectedDate] = useState<number | null>(null);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    const { days, monthName } = useMemo(() => {
        const firstDay = new Date(currentYear, currentMonth, 1);
        const lastDay = new Date(currentYear, currentMonth + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();

        const daysArray = [];

        // Dias vazios antes do primeiro dia do mês
        for (let i = 0; i < startingDayOfWeek; i++) {
            daysArray.push({ date: null, events: [] });
        }

        // Dias do mês
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayEvents = events.filter(e => e.date === dateStr);
            daysArray.push({ date: day, events: dayEvents });
        }

        const monthName = new Date(currentYear, currentMonth).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

        return { days: daysArray, monthName };
    }, [events, currentMonth, currentYear]);

    const selectedDayEvents = useMemo(() => {
        if (!selectedDate) return [];
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(selectedDate).padStart(2, '0')}`;
        return events.filter(e => e.date === dateStr).sort((a, b) => a.start_time.localeCompare(b.start_time));
    }, [selectedDate, events, currentMonth, currentYear]);

    const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

    const handleDateClick = (date: number | null) => {
        if (date) {
            setSelectedDate(date);
            setSelectedEvent(null); // Reset selected event when changing date
        }
    };

    const selectedDateFormatted = useMemo(() => {
        if (!selectedDate) return '';
        const date = new Date(currentYear, currentMonth, selectedDate);
        return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
    }, [selectedDate, currentMonth, currentYear]);

    // Close panel when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
                setSelectedDate(null);
                setSelectedEvent(null);
            }
        };

        if (selectedDate) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [selectedDate]);

    const panelContent = (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[9998]"
                onClick={() => setSelectedDate(null)}
            />

            <div
                ref={panelRef}
                className="fixed top-0 right-0 h-full w-full md:w-[480px] bg-white shadow-2xl z-[9999] flex flex-col animate-slide-in-right transition-transform duration-300"
            >
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between z-10">
                    <div className="flex items-center gap-3">
                        {selectedEvent && (
                            <button
                                onClick={() => setSelectedEvent(null)}
                                className="p-1.5 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                        )}
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800">
                                {selectedEvent ? 'Detalhes' : 'Eventos'}
                            </h2>
                            <p className="text-sm text-slate-500 capitalize">{selectedDateFormatted}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            setSelectedDate(null);
                            setSelectedEvent(null);
                        }}
                        className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-100 rounded-full"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Conteúdo */}
                <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                    {selectedEvent ? (
                        // Visualização Detalhada do Evento
                        <div className="space-y-6">
                            <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
                                <h3 className="text-xl font-bold text-blue-900 mb-2">{selectedEvent.name}</h3>
                                <div className="flex flex-wrap gap-4 text-sm text-blue-700">
                                    <div className="flex items-center gap-1.5">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        {selectedEvent.start_time.substring(0, 5)} - {selectedEvent.end_time.substring(0, 5)}
                                    </div>
                                    {selectedEvent.local && (
                                        <div className="flex items-center gap-1.5">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                            {selectedEvent.local}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Departamentos e Voluntários Agrupados */}
                            <div>
                                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Escala por Departamento</h4>
                                <div className="space-y-6">
                                    {selectedEvent.event_departments?.map((dept, idx) => {
                                        // Filtrar voluntários deste departamento
                                        const deptVolunteers = selectedEvent.event_volunteers?.filter(
                                            vol => vol.department_id === dept.department_id
                                        ) || [];

                                        // Verificar se o evento já terminou
                                        const eventEndDateTime = new Date(`${selectedEvent.date}T${selectedEvent.end_time}`);
                                        const isEventEnded = new Date() > eventEndDateTime;

                                        return (
                                            <div key={idx} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                                {/* Cabeçalho do Departamento */}
                                                <div className="bg-slate-50 p-3 border-b border-slate-200 flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                                                        <span className="font-bold text-slate-800">{dept.departments?.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-xs bg-white px-2 py-1 rounded-md border border-slate-200 shadow-sm">
                                                        <span className="text-slate-400 font-medium">Líder:</span>
                                                        <span className="text-slate-700 font-semibold">
                                                            {dept.departments?.leader || 'Não definido'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Lista de Voluntários */}
                                                <div className="p-2">
                                                    {deptVolunteers.length > 0 ? (
                                                        <div className="space-y-1">
                                                            {deptVolunteers.map((vol, vIdx) => {
                                                                let statusLabel = '';
                                                                let statusClass = '';
                                                                let initialsBgClass = 'bg-blue-500'; // Default for not marked or not present yet

                                                                if (vol.present === true) {
                                                                    statusLabel = 'Presente';
                                                                    statusClass = 'bg-green-100 text-green-700';
                                                                    initialsBgClass = 'bg-green-500';
                                                                } else if (vol.present === false && isEventEnded) {
                                                                    statusLabel = 'Faltou';
                                                                    statusClass = 'bg-red-100 text-red-700';
                                                                    initialsBgClass = 'bg-red-500';
                                                                } else {
                                                                    statusLabel = 'Não marcado';
                                                                    statusClass = 'bg-slate-100 text-slate-500';
                                                                    initialsBgClass = 'bg-blue-500';
                                                                }

                                                                return (
                                                                    <div key={vIdx} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg transition-colors">
                                                                        {vol.volunteers?.avatar_url ? (
                                                                            <img
                                                                                src={vol.volunteers.avatar_url}
                                                                                alt={vol.volunteers.name}
                                                                                className="w-8 h-8 rounded-full flex-shrink-0 object-cover border border-slate-200"
                                                                            />
                                                                        ) : (
                                                                            <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white ${initialsBgClass}`}>
                                                                                {vol.volunteers?.initials || '?'}
                                                                            </div>
                                                                        )}
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="text-sm font-medium text-slate-800 truncate">{vol.volunteers?.name}</p>
                                                                        </div>
                                                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusClass}`}>
                                                                            {statusLabel}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-slate-400 italic text-center py-3">
                                                            Nenhum voluntário escalado neste departamento.
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {(!selectedEvent.event_departments || selectedEvent.event_departments.length === 0) && (
                                        <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                                            <p className="text-slate-500">Nenhum departamento vinculado a este evento.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        // Lista de Eventos do Dia
                        selectedDayEvents.length > 0 ? (
                            <div className="space-y-4">
                                {selectedDayEvents.map(event => (
                                    <div
                                        key={event.id}
                                        onClick={() => setSelectedEvent(event)}
                                        className="bg-white rounded-xl p-4 border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group"
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className="flex-shrink-0 w-14 h-14 bg-blue-500 group-hover:bg-blue-600 transition-colors rounded-xl flex flex-col items-center justify-center text-white">
                                                <span className="text-xl font-bold">
                                                    {event.start_time.substring(0, 2)}
                                                </span>
                                                <span className="text-xs opacity-80">
                                                    {event.start_time.substring(3, 5)}
                                                </span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-bold text-slate-800 text-base mb-1 group-hover:text-blue-600 transition-colors">{event.name}</h3>
                                                <p className="text-sm text-slate-600 flex items-center gap-1">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    {event.start_time.substring(0, 5)} - {event.end_time.substring(0, 5)}
                                                </p>
                                            </div>
                                            <div className="text-slate-300 group-hover:text-blue-400">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                </svg>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 mx-auto text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <p className="text-slate-500 font-medium text-lg">Nenhum evento neste dia</p>
                            </div>
                        )
                    )}
                </div>
            </div>
        </>
    );

    return (
        <>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-slate-800 capitalize">{monthName}</h3>
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                        <span className="text-xs text-slate-600">Eventos</span>
                    </div>
                </div>

                {/* Header dos dias da semana */}
                <div className="grid grid-cols-7 gap-1 mb-1">
                    {weekDays.map((day, index) => (
                        <div key={index} className="text-center text-xs font-semibold text-slate-500 uppercase">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Grid de dias */}
                <div className="grid grid-cols-7 gap-1">
                    {days.map((day, index) => {
                        const isToday = day.date === today.getDate();
                        const isSelected = day.date === selectedDate;
                        const hasEvents = day.events.length > 0;

                        return (
                            <div
                                key={index}
                                onClick={() => handleDateClick(day.date)}
                                className={`
                                    aspect-square flex flex-col items-center justify-center rounded-lg text-xs
                                    ${!day.date ? 'invisible' : ''}
                                    ${isSelected ? 'bg-blue-600 text-white font-bold ring-2 ring-blue-300' : ''}
                                    ${!isSelected && isToday ? 'bg-blue-100 text-blue-700 font-bold' : ''}
                                    ${!isSelected && !isToday && hasEvents ? 'bg-blue-50 font-semibold' : ''}
                                    ${!isSelected && !isToday && !hasEvents ? 'hover:bg-slate-50' : ''}
                                    ${day.date ? 'cursor-pointer' : ''}
                                    transition-all relative
                                `}
                                title={hasEvents ? `${day.events.length} evento(s)` : ''}
                            >
                                {day.date}
                                {hasEvents && !isSelected && (
                                    <div className="absolute bottom-0.5 flex gap-0.5">
                                        {day.events.slice(0, 3).map((_, i) => (
                                            <div key={i} className="w-1 h-1 rounded-full bg-blue-500"></div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {selectedDate && ReactDOM.createPortal(panelContent, document.body)}

            <style>{`
            @keyframes slide-in-right {
                from {
                    transform: translateX(100%);
                }
                to {
                    transform: translateX(0);
                }
            }
            .animate-slide-in-right {
                animation: slide-in-right 0.3s ease-out;
            }
            @keyframes slide-up {
                from {
                    transform: translateY(100%);
                }
                to {
                    transform: translateY(0);
                }
            }
            .animate-slide-up {
                animation: slide-up 0.3s ease-out;
            }
        `}</style>
        </>
    );
};

export default DashboardCalendar;
