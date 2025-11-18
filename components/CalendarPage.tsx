import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { type EventResizeDoneArg } from '@fullcalendar/interaction';
import { EventInput, EventClickArg, DayHeaderContentArg, EventContentArg, DatesSetArg, type EventDropArg } from '@fullcalendar/core';
import ptBrBaseLocale from '@fullcalendar/core/locales/pt-br';

import NewEventForm from './NewScheduleForm';
import { Event, NotificationRecord, Department } from '../types';
import { supabase } from '../lib/supabaseClient';
import { getErrorMessage, convertUTCToLocal } from '../lib/utils';

// --- Status Filter Component & Options ---
const statusOptions = [
    { value: 'Confirmado', label: 'Confirmado', color: 'bg-green-500', checkboxClass: 'text-green-600' },
    { value: 'Pendente', label: 'Pendente', color: 'bg-yellow-500', checkboxClass: 'text-yellow-600' },
    { value: 'Cancelado', label: 'Cancelado', color: 'bg-red-500', checkboxClass: 'text-red-600' }
];

interface StatusFilterProps {
    statusFilters: string[];
    onStatusFilterChange: (status: string) => void;
    isMobile?: boolean;
}

const StatusFilter: React.FC<StatusFilterProps> = ({ statusFilters, onStatusFilterChange, isMobile = false }) => {
    return (
        <div className={`flex gap-4 ${isMobile ? 'flex-col items-start' : 'flex-row items-center'}`}>
            {statusOptions.map(option => (
                <label key={option.value} htmlFor={`filter-${option.value}-${isMobile}`} className="flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        id={`filter-${option.value}-${isMobile}`}
                        checked={statusFilters.includes(option.value)}
                        onChange={() => onStatusFilterChange(option.value)}
                        className={`h-4 w-4 rounded border-slate-300 focus:ring-2 focus:ring-offset-1 ${option.checkboxClass} ${option.checkboxClass.replace('text-', 'focus:ring-')}`}
                    />
                    <span className={`ml-2 h-2.5 w-2.5 rounded-full ${option.color}`}></span>
                    <span className="ml-1.5 text-sm font-medium text-slate-700">{option.label}</span>
                </label>
            ))}
        </div>
    );
};

// --- Color & Style Logic ---

const PREDEFINED_COLORS: { [key: string]: { bg: string, text: string, border: string } } = {
    '#3b82f6': { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' }, // Blue
    '#22c55e': { bg: '#dcfce7', text: '#166534', border: '#86efac' }, // Green
    '#f59e0b': { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' }, // Amber (was transparent border)
    '#ef4444': { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' }, // Red
    'purple': { bg: '#f5f3ff', text: '#5b21b6', border: '#ddd6fe' },
    'orange': { bg: '#fff7ed', text: '#9a3412', border: '#fed7aa' },
    'yellow': { bg: '#fefce8', text: '#854d0e', border: '#fef08a' }
};

const PASTEL_COLORS = Object.values(PREDEFINED_COLORS);
const departmentColorMap = new Map<number, {bg: string, text: string, border: string}>();
let lastColorIndex = 0;

const getDepartmentColor = (departmentId?: number) => {
    if (!departmentId) return PREDEFINED_COLORS['orange']; // Default to orange
    if (!departmentColorMap.has(departmentId)) {
        departmentColorMap.set(departmentId, PASTEL_COLORS[lastColorIndex % PASTEL_COLORS.length]);
        lastColorIndex++;
    }
    return departmentColorMap.get(departmentId)!;
};

// --- Custom Header Renderers ---
const dayNamesShort = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const renderDayHeaderContent = (arg: DayHeaderContentArg) => {
    const dayName = dayNamesShort[arg.date.getDay()];
    const dayNumber = new Intl.DateTimeFormat('pt-BR', { day: 'numeric' }).format(arg.date);
    return (
        <div className="day-header-container">
            <div className="day-name">{dayName}</div>
            <div className="day-number">{String(dayNumber).padStart(2, '0')}</div>
        </div>
    );
};


// --- Mobile-Specific Components & Hooks ---
const isSameDay = (d1: Date, d2: Date) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();

const useIsMobile = (breakpoint = 1024) => { // Using lg breakpoint
    const [isMobile, setIsMobile] = useState(window.innerWidth < breakpoint);
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < breakpoint);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [breakpoint]);
    return isMobile;
};

type MobileView = 'timeGridDay' | 'timeGridWeek' | 'dayGridMonth';

const MobileHeader: React.FC<{ 
    title: string;
    onMenuClick: () => void; 
    currentView: MobileView;
    onViewChange: (view: MobileView) => void;
    onPrev: () => void;
    onNext: () => void;
    onToday: () => void;
    statusFilters: string[];
    onStatusFilterChange: (status: string) => void;
}> = ({ title, onMenuClick, currentView, onViewChange, onPrev, onNext, onToday, statusFilters, onStatusFilterChange }) => {
    const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
    const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
    const viewDropdownRef = useRef<HTMLDivElement>(null);
    const filterDropdownRef = useRef<HTMLDivElement>(null);

    const viewOptions: {key: MobileView, label: string, shortcut: string}[] = [
        { key: 'dayGridMonth', label: 'Mês', shortcut: 'M' },
        { key: 'timeGridWeek', label: 'Semana', shortcut: 'W' },
        { key: 'timeGridDay', label: 'Dia', shortcut: 'D' }
    ];
    const currentViewLabel = viewOptions.find(v => v.key === currentView)?.label || 'Dia';

    const handleViewSelect = (view: MobileView) => {
        onViewChange(view);
        setIsViewDropdownOpen(false);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (viewDropdownRef.current && !viewDropdownRef.current.contains(event.target as Node)) {
                setIsViewDropdownOpen(false);
            }
            if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
                setIsFilterDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="px-4 py-3 bg-white border-b border-slate-200">
            {/* Top row for navigation */}
            <div className="flex justify-between items-center gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <button onClick={onPrev} className="p-2 text-slate-500 hover:text-slate-800 flex-shrink-0" aria-label="Anterior">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.25 19.5 7.75 12l7.5-7.5" /></svg>
                    </button>
                    <h2 className="text-base font-bold text-slate-800 capitalize text-center truncate">{title}</h2>
                    <button onClick={onNext} className="p-2 text-slate-500 hover:text-slate-800 flex-shrink-0" aria-label="Próximo">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m8.75 4.5 7.5 7.5-7.5 7.5" /></svg>
                    </button>
                </div>
                <button onClick={onMenuClick} className="p-2 text-slate-600 hover:text-slate-900 flex-shrink-0" aria-label="Open menu">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>
            </div>
            
            {/* Bottom row for controls and filters */}
            <div className="mt-4 flex justify-between items-center">
                <div className="flex items-center gap-1 sm:gap-2">
                    <button onClick={onToday} className="bg-white border border-slate-300 text-slate-700 font-semibold px-3 py-1.5 rounded-lg hover:bg-slate-50 text-sm">
                        Hoje
                    </button>
                    <div className="relative" ref={viewDropdownRef}>
                        <button
                            onClick={() => setIsViewDropdownOpen(!isViewDropdownOpen)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors"
                            aria-haspopup="true"
                            aria-expanded={isViewDropdownOpen}
                        >
                            <span>{currentViewLabel}</span>
                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-slate-500 transition-transform ${isViewDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                        </button>
                        {isViewDropdownOpen && (
                            <div className="absolute left-0 mt-2 w-36 bg-white rounded-lg shadow-lg border border-slate-200 z-10" role="menu">
                                <ul className="py-1">
                                    {viewOptions.map((viewOption) => (
                                        <li key={viewOption.key}>
                                            <button onClick={() => handleViewSelect(viewOption.key)} className={`w-full text-left px-4 py-2 text-sm flex justify-between items-center transition-colors ${currentView === viewOption.key ? 'font-semibold text-blue-600 bg-blue-50' : 'text-slate-700 hover:bg-slate-100'}`} role="menuitem">
                                                <span>{viewOption.label}</span>
                                                <span className="text-xs text-slate-400">{viewOption.shortcut}</span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
                
                <div className="relative" ref={filterDropdownRef}>
                    <button
                        onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                        className="p-2 text-slate-600 hover:text-slate-900"
                        aria-label="Filtrar eventos"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 12.414V17a1 1 0 01-1.447.894l-2-1A1 1 0 018 16v-3.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
                        </svg>
                    </button>
                    {isFilterDropdownOpen && (
                        <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-slate-200 z-10 p-4">
                            <h4 className="text-sm font-bold text-slate-800 mb-3">Filtrar por Status</h4>
                            <StatusFilter statusFilters={statusFilters} onStatusFilterChange={onStatusFilterChange} isMobile={true} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const DateScroller: React.FC<{ selectedDate: Date; onDateSelect: (date: Date) => void; }> = ({ selectedDate, onDateSelect }) => {
    const weekDates = useMemo(() => {
        const startOfWeek = new Date(selectedDate);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        return Array.from({ length: 7 }, (_, i) => {
            const date = new Date(startOfWeek);
            date.setDate(date.getDate() + i);
            return date;
        });
    }, [selectedDate]);

    return (
        <div className="px-4 py-3 bg-white border-b border-t border-slate-100">
            <div className="flex justify-between items-center">
                {weekDates.map(date => {
                    const isSelected = isSameDay(date, selectedDate);
                    const isToday = isSameDay(date, new Date());
                    const dayName = date.toLocaleString('pt-BR', { weekday: 'narrow' });
                    return (
                        <button key={date.toISOString()} onClick={() => onDateSelect(date)} className="flex flex-col items-center space-y-2 w-10 focus:outline-none text-center">
                            <span className="text-sm font-medium text-slate-400 uppercase">{dayName}</span>
                            <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold transition-colors ${isSelected ? 'bg-blue-600 text-white' : isToday ? 'bg-blue-100 text-blue-600' : 'bg-transparent text-slate-800'}`}>
                                {date.getDate()}
                            </span>
                        </button>
                    )
                })}
            </div>
        </div>
    );
};

const renderMobileWeekDayHeader = (arg: DayHeaderContentArg) => {
    const isToday = isSameDay(arg.date, new Date());
    const dayName = arg.date.toLocaleDateString('pt-BR', { weekday: 'narrow' });
    return (
        <div className="flex flex-col items-center py-2">
            <span className="text-sm uppercase font-medium text-slate-500">{dayName}</span>
            <span className={`mt-1.5 text-base font-bold w-8 h-8 flex items-center justify-center rounded-full ${isToday ? 'bg-blue-600 text-white' : 'text-slate-800'}`}>
                {arg.date.getDate()}
            </span>
        </div>
    );
};

const MobileMonthEventList: React.FC<{ events: Event[], selectedDate: Date, onEventClick: (event: Event) => void }> = ({ events, selectedDate, onEventClick }) => {
    const filteredEvents = useMemo(() => {
        const selectedDateStr = selectedDate.toISOString().split('T')[0];
        return events.filter(e => e.date === selectedDateStr).sort((a, b) => a.start_time.localeCompare(b.start_time));
    }, [events, selectedDate]);

    const EventItemCard: React.FC<{event: Event}> = ({ event }) => {
        const colorKey = event.color || ((event.event_departments || [])[0]?.departments?.name.toLowerCase().includes('almoço') ? 'green' : undefined);
        const colors = colorKey && PREDEFINED_COLORS[colorKey] ? PREDEFINED_COLORS[colorKey] : getDepartmentColor((event.event_departments || [])[0]?.department_id);
        const initials = event.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase() || 'E';

        return (
            <div onClick={() => onEventClick(event)} className="bg-white p-4 rounded-xl shadow-sm flex items-start space-x-4 cursor-pointer border border-slate-100">
                 <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg flex-shrink-0">
                    {initials}
                </div>
                <div className="flex-grow">
                    <p className="font-semibold text-slate-800">{event.name}</p>
                    <p className="text-sm text-slate-500">{(event.event_departments || [])[0]?.departments?.name || 'Geral'}</p>
                    <div className="mt-2 px-3 py-1 text-sm font-semibold rounded-full inline-block" style={{backgroundColor: colors.bg, color: colors.text}}>
                        {event.start_time} - {event.end_time}
                    </div>
                </div>
            </div>
        )
    };

    return (
        <div className="p-4 bg-slate-50">
            <h3 className="font-bold text-slate-800 mb-4 text-lg capitalize">
                {selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h3>
            {filteredEvents.length > 0 ? (
                <div className="space-y-3">
                    {filteredEvents.map(event => <EventItemCard key={event.id} event={event} />)}
                </div>
            ) : (
                <div className="text-center py-8">
                    <p className="text-slate-500">Nenhum evento para este dia.</p>
                </div>
            )}
        </div>
    );
};

// --- Desktop Custom Header ---

const CalendarHeader: React.FC<{
    title: string;
    currentView: string;
    onPrev: () => void;
    onNext: () => void;
    onToday: () => void;
    onViewChange: (view: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay') => void;
    onNewEvent: () => void;
    isAdmin: boolean;
    statusFilters: string[];
    onStatusFilterChange: (status: string) => void;
}> = ({ title, currentView, onPrev, onNext, onToday, onViewChange, onNewEvent, isAdmin, statusFilters, onStatusFilterChange }) => {
    const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const viewOptions = [
        { key: 'dayGridMonth', label: 'Mês', shortcut: 'M' },
        { key: 'timeGridWeek', label: 'Semana', shortcut: 'W' },
        { key: 'timeGridDay', label: 'Dia', shortcut: 'D' }
    ];
    const currentViewLabel = viewOptions.find(v => v.key === currentView)?.label || 'View';

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsViewDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
             <div className="flex items-center gap-4">
                <button onClick={onToday} className="bg-white border border-slate-300 text-slate-700 font-semibold px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
                    Hoje
                </button>
                <div className="flex items-center">
                    <button onClick={onPrev} className="p-2 text-slate-500 hover:text-slate-800 rounded-md hover:bg-slate-100 transition-colors flex-shrink-0" aria-label="Anterior">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.25 19.5 7.75 12l7.5-7.5" /></svg>
                    </button>
                    <button onClick={onNext} className="p-2 text-slate-500 hover:text-slate-800 rounded-md hover:bg-slate-100 transition-colors flex-shrink-0" aria-label="Próximo">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m8.75 4.5 7.5 7.5-7.5 7.5" /></svg>
                    </button>
                </div>
                 <h2 className="text-3xl font-bold text-slate-800 capitalize">{title}</h2>
            </div>
            <div className="flex items-center flex-wrap justify-center gap-x-6 gap-y-2">
                 <StatusFilter statusFilters={statusFilters} onStatusFilterChange={onStatusFilterChange} />
                 <div className="h-6 w-px bg-slate-200 hidden lg:block"></div>
                 <div className="relative" ref={dropdownRef}>
                    <button 
                        onClick={() => setIsViewDropdownOpen(prev => !prev)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 font-semibold hover:bg-slate-50 transition-colors shadow-sm"
                        aria-haspopup="true"
                        aria-expanded={isViewDropdownOpen}
                    >
                        <span>{currentViewLabel}</span>
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-slate-500 transition-transform ${isViewDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {isViewDropdownOpen && (
                        <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-lg border border-slate-200 z-10">
                            <ul className="py-1">
                                {viewOptions.map(view => (
                                    <li key={view.key}>
                                        <button
                                            onClick={() => {
                                                onViewChange(view.key as any);
                                                setIsViewDropdownOpen(false);
                                            }}
                                            className="w-full text-left flex justify-between items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                                        >
                                            <span>{view.label}</span>
                                            <span className="text-xs text-slate-400">{view.shortcut}</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
                {isAdmin && (
                    <button onClick={onNewEvent} className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 transition-colors shadow-sm">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                       <span>Novo Evento</span>
                    </button>
                )}
            </div>
        </div>
    );
};


// --- Main Component ---

interface CalendarPageProps {
  userRole: string | null;
  leaderDepartmentId: number | null;
  onDataChange: () => void;
  setIsSidebarOpen: (isOpen: boolean) => void;
}

const CalendarPage: React.FC<CalendarPageProps> = ({ userRole, leaderDepartmentId, onDataChange, setIsSidebarOpen }) => {
    const [allEvents, setAllEvents] = useState<Event[]>([]);
    const [allDepartments, setAllDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<Event | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [monthViewDate, setMonthViewDate] = useState(new Date());
    const isMobile = useIsMobile();
    const calendarRef = useRef<FullCalendar>(null);
    const [mobileView, setMobileView] = useState<MobileView>('dayGridMonth');
    const [desktopView, setDesktopView] = useState('dayGridMonth');
    const [calendarTitle, setCalendarTitle] = useState('');
    const [statusFilters, setStatusFilters] = useState<string[]>(['Confirmado', 'Pendente']);
    const isAdmin = userRole === 'admin';
    const isLeader = userRole === 'leader' || userRole === 'lider';

    const ptBrLocale = useMemo(() => ({
        ...ptBrBaseLocale,
        week: { dow: 0, doy: 4, },
    }), []);
    
    const handleStatusFilterChange = (status: string) => {
        setStatusFilters(prev =>
            prev.includes(status)
                ? prev.filter(s => s !== status)
                : [...prev, status]
        );
    };

    const renderPillEventContent = (eventInfo: EventContentArg) => {
        if (isMobile && mobileView === 'dayGridMonth') {
            return <div className="fc-daygrid-day-dot" style={{ backgroundColor: eventInfo.borderColor }}></div>;
        }

        if (!isMobile && (eventInfo.view.type === 'timeGridWeek' || eventInfo.view.type === 'timeGridDay')) {
            const eventData = eventInfo.event.extendedProps as Event;
            const volunteersByDept = new Map<number, any[]>();
            
            (eventData.event_volunteers || []).forEach(ev => {
                if (ev.volunteers && ev.department_id) {
                    if (!volunteersByDept.has(ev.department_id)) {
                        volunteersByDept.set(ev.department_id, []);
                    }
                    volunteersByDept.get(ev.department_id)!.push(ev.volunteers);
                }
            });

            return (
                <div className="fc-event-main-frame w-full h-full p-1.5 text-xs flex flex-col items-start overflow-y-auto">
                    <div>
                        <p className="font-bold" style={{color: eventInfo.event.textColor}}>{eventInfo.timeText}</p>
                        <p className="font-semibold whitespace-normal mt-1" style={{color: eventInfo.event.textColor}}>{eventInfo.event.title}</p>
                    </div>
                    
                    {((eventData.event_departments || []).length > 0) && (
                        <div className="mt-2 pt-2 border-t w-full space-y-2" style={{borderColor: eventInfo.event.textColor + '40'}}>
                            {(eventData.event_departments || []).map(({ departments }) => {
                                if (!departments) return null;
                                const volunteers = volunteersByDept.get(departments.id) || [];
                                return (
                                    <div key={departments.id}>
                                        <p className="font-bold mb-1" style={{color: eventInfo.event.textColor}}>{departments.name}</p>
                                        {volunteers.length > 0 ? (
                                            <ul className="space-y-1 pl-1">
                                                {volunteers.map(v => (
                                                    <li key={v.id} className="flex items-center space-x-1.5">
                                                        <div className="w-5 h-5 rounded-full bg-black/20 text-white flex-shrink-0 flex items-center justify-center text-[10px] font-bold" style={{color: eventInfo.backgroundColor, backgroundColor: eventInfo.event.textColor}}>
                                                            {v.initials || '??'}
                                                        </div>
                                                        <span style={{color: eventInfo.event.textColor}}>{v.name}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="text-xs italic pl-1" style={{color: eventInfo.event.textColor + '90'}}>Nenhum voluntário</p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            );
        }

        if (!isMobile && eventInfo.view.type === 'dayGridMonth') {
            const startTime = eventInfo.event.extendedProps.start_time?.substring(0, 5);
            const timeString = startTime ? `${startTime}` : '';
            return (
                <div className="fc-event-main-frame w-full px-1.5 py-0.5 text-xs overflow-hidden">
                    <div className="flex items-start gap-1.5">
                        <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: eventInfo.borderColor }}></div>
                        <div className="font-semibold whitespace-normal">
                            {timeString && <span className="font-bold mr-1">{timeString}</span>}
                            {eventInfo.event.title}
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="fc-event-main-frame flex items-center gap-1.5 overflow-hidden w-full px-1.5 py-0.5 text-xs">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: eventInfo.borderColor }}></div>
                <div className="font-semibold truncate">
                    {eventInfo.timeText && <span className="font-bold mr-1">{eventInfo.timeText}</span>}
                    {eventInfo.event.title}
                </div>
            </div>
        );
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
        setEditingEvent(null);
    };
    const fetchAllDepartments = useCallback(async () => {
        const { data, error } = await supabase.from('departments').select('id, name');
        if (error) {
            console.error("Failed to fetch all departments for form:", getErrorMessage(error));
        } else {
            setAllDepartments((data as Department[]) || []);
        }
    }, []);

    const fetchAllEvents = useCallback(async (setLoadingState = true) => {
        if (setLoadingState) setLoading(true);
        setError(null);
        try {
            // Use the secure RPC function to fetch events for the current user (admin or leader).
            // This bypasses potential RLS issues.
            const { data, error: rpcError } = await supabase.rpc('get_events_for_user');
            
            if (rpcError) throw rpcError;
            
            // The RPC function returns data already filtered and enriched.
            setAllEvents((data as unknown as Event[]) || []);

        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            if (setLoadingState) setLoading(false);
        }
    }, []);

    useEffect(() => { 
        fetchAllEvents();
        fetchAllDepartments();
    }, [fetchAllEvents, fetchAllDepartments]);
    
    const handleDatesSet = (arg: DatesSetArg) => {
        const view = arg.view;
        let title = view.title;
        if (isMobile) {
            const monthMap: { [key: string]: string } = { 'janeiro': 'jan.', 'fevereiro': 'fev.', 'março': 'mar.', 'abril': 'abr.', 'maio': 'mai.', 'junho': 'jun.', 'julho': 'jul.', 'agosto': 'ago.', 'setembro': 'set.', 'outubro': 'out.', 'novembro': 'nov.', 'dezembro': 'dez.' };
            const lowerCaseTitle = title.toLowerCase();
            for (const month in monthMap) {
                if (lowerCaseTitle.includes(month)) {
                    title = title.replace(new RegExp(month, 'i'), monthMap[month]);
                    break;
                }
            }
        }
        setCalendarTitle(title);
        if (isMobile) {
            const midDate = new Date(view.currentStart.getTime() + (view.currentEnd.getTime() - view.currentStart.getTime()) / 2);
            if (mobileView === 'dayGridMonth') {
                if (midDate.getMonth() !== monthViewDate.getMonth() || midDate.getFullYear() !== monthViewDate.getFullYear()) setMonthViewDate(midDate);
            } else {
                if (selectedDate < view.currentStart || selectedDate >= view.currentEnd) setSelectedDate(view.currentStart);
            }
        } else {
            setDesktopView(view.type);
        }
    };

    const handleDateScrollerSelect = (date: Date) => {
        setSelectedDate(date);
        calendarRef.current?.getApi().gotoDate(date);
    };

    const calendarEvents = useMemo((): EventInput[] => {
        return allEvents
            .filter(event => statusFilters.includes(event.status))
            .map(event => {
                const colorKey = event.color || ((event.event_departments || [])[0]?.departments?.name.toLowerCase().includes('almoço') ? 'green' : undefined);
                const colors = colorKey && PREDEFINED_COLORS[colorKey] ? PREDEFINED_COLORS[colorKey] : getDepartmentColor((event.event_departments || [])[0]?.department_id);
                
                // FIX: Create local Date objects by removing the 'Z' suffix. This ensures FullCalendar interprets event times in the browser's local timezone.
                const startDate = new Date(`${event.date}T${event.start_time}`);
                const endDate = new Date(`${event.date}T${event.end_time}`);
    
                if (endDate < startDate) {
                    endDate.setDate(endDate.getDate() + 1);
                }

                return {
                    id: String(event.id),
                    title: event.name,
                    start: startDate, // Pass local Date object
                    end: endDate,     // Pass local Date object
                    backgroundColor: colors.bg,
                    borderColor: colors.border,
                    textColor: colors.text,
                    classNames: ['custom-event'],
                    extendedProps: { ...event, color: colorKey, dotColor: colors.border }
                };
            });
    }, [allEvents, statusFilters]);

    const handleDateClick = (arg: { date: Date, dateStr: string }) => {
        if (mobileView === 'dayGridMonth') {
            setSelectedDate(arg.date);
            return;
        }
        if (!isAdmin) return;
        setEditingEvent({ name: '', date: arg.dateStr.split('T')[0], start_time: arg.date.toTimeString().substring(0, 5), end_time: new Date(arg.date.getTime() + 60*60*1000).toTimeString().substring(0, 5), status: 'Pendente' } as Event);
        setIsFormOpen(true);
    };

    const handleMobileEventClick = (eventData: Event) => {
        if (eventData) {
            setEditingEvent(eventData);
            setIsFormOpen(true);
        }
    };

    const handleEventClick = (info: EventClickArg) => {
        const eventData = allEvents.find(e => e.id === parseInt(info.event.id, 10));
        if (eventData) {
            setEditingEvent(eventData);
            setIsFormOpen(true);
        }
    };

    const handleEventDrop = async (info: EventDropArg) => {
        if (!isAdmin) { info.revert(); return; }
        const { event } = info;
        if (!event.start) { info.revert(); return; }
        const eventId = parseInt(event.id, 10);
    
        const newStartDate = event.start;
        const originalDuration = info.oldEvent.end!.getTime() - info.oldEvent.start!.getTime();
        const newEndDate = event.end ? event.end : new Date(newStartDate.getTime() + originalDuration);
    
        // --- NEW: Client-side conflict check ---
        const conflictingEvent = allEvents.find(existingEvent => {
            if (existingEvent.id === eventId) return false;
            
            const { dateTime: existingStartLocal, isValid: startIsValid } = convertUTCToLocal(existingEvent.date, existingEvent.start_time);
            let { dateTime: existingEndLocal, isValid: endIsValid } = convertUTCToLocal(existingEvent.date, existingEvent.end_time);
    
            if (!startIsValid || !endIsValid || !existingStartLocal || !existingEndLocal) {
                console.warn(`Skipping conflict check for event ID ${existingEvent.id} due to invalid date/time.`);
                return false;
            }
    
            if (existingEndLocal < existingStartLocal) {
                existingEndLocal.setDate(existingEndLocal.getDate() + 1);
            }
    
            // The overlap condition: (StartA < EndB) and (EndA > StartB)
            return (newStartDate < existingEndLocal && newEndDate > existingStartLocal);
        });
    
        if (conflictingEvent) {
            const { time: conflictStartTime } = convertUTCToLocal(conflictingEvent.date, conflictingEvent.start_time);
            const { time: conflictEndTime } = convertUTCToLocal(conflictingEvent.date, conflictingEvent.end_time);
            alert(`Conflito de horário com "${conflictingEvent.name}" (${conflictStartTime} - ${conflictEndTime}).`);
            info.revert();
            return;
        }
    
        // --- If no conflict, proceed with saving ---
        const formatDateLocal = (d: Date) => d.toISOString().split('T')[0];
        const formatTimeLocal = (d: Date) => d.toTimeString().substring(0, 8); // HH:mm:ss
    
        const newDate = formatDateLocal(newStartDate);
        const newStartTime = formatTimeLocal(newStartDate);
        const newEndTime = formatTimeLocal(newEndDate);
    
        try {
            const { error: updateError } = await supabase.from('events').update({ date: newDate, start_time: newStartTime, end_time: newEndTime }).eq('id', eventId);
            if (updateError) throw updateError;
    
            await fetchAllEvents(false);
            onDataChange();
    
            const { error: notifyError } = await supabase.functions.invoke('create-notifications', {
                body: {
                    notifyType: 'event_updated',
                    event: { id: eventId, name: event.title, date: newDate, start_time: newStartTime, end_time: newEndTime },
                },
            });
            if (notifyError) console.error("Falha ao notificar sobre reagendamento:", getErrorMessage(notifyError));
    
        } catch (err) {
            alert('Erro ao mover evento: ' + getErrorMessage(err));
            info.revert();
        }
    };
    
    const handleEventResize = async (info: EventResizeDoneArg) => {
        if (!isAdmin) { info.revert(); return; }
        const { event } = info;
        if (!event.start || !event.end) { info.revert(); return; }
        const eventId = parseInt(event.id, 10);
    
        const newStartDate = event.start;
        const newEndDate = event.end;
    
        // --- NEW: Client-side conflict check ---
        const conflictingEvent = allEvents.find(existingEvent => {
            if (existingEvent.id === eventId) return false;
            
            const { dateTime: existingStartLocal, isValid: startIsValid } = convertUTCToLocal(existingEvent.date, existingEvent.start_time);
            let { dateTime: existingEndLocal, isValid: endIsValid } = convertUTCToLocal(existingEvent.date, existingEvent.end_time);
    
            if (!startIsValid || !endIsValid || !existingStartLocal || !existingEndLocal) {
                console.warn(`Skipping conflict check for event ID ${existingEvent.id} due to invalid date/time.`);
                return false;
            }
    
            if (existingEndLocal < existingStartLocal) {
                existingEndLocal.setDate(existingEndLocal.getDate() + 1);
            }
    
            return (newStartDate < existingEndLocal && newEndDate > existingStartLocal);
        });
    
        if (conflictingEvent) {
            const { time: conflictStartTime } = convertUTCToLocal(conflictingEvent.date, conflictingEvent.start_time);
            const { time: conflictEndTime } = convertUTCToLocal(conflictingEvent.date, conflictingEvent.end_time);
            alert(`Conflito de horário com "${conflictingEvent.name}" (${conflictStartTime} - ${conflictEndTime}).`);
            info.revert();
            return;
        }
    
        // --- If no conflict, proceed with saving ---
        const formatTimeLocal = (d: Date) => d.toTimeString().substring(0, 8); // HH:mm:ss
        
        const newStartTime = formatTimeLocal(event.start);
        const newEndTime = formatTimeLocal(event.end);
        
        const eventDate = (event.extendedProps as Event).date;
    
        try {
            const { error: updateError } = await supabase.from('events').update({ start_time: newStartTime, end_time: newEndTime }).eq('id', eventId);
            if (updateError) throw updateError;
            
            await fetchAllEvents(false);
            onDataChange();
    
            const { error: notifyError } = await supabase.functions.invoke('create-notifications', {
                body: {
                    notifyType: 'event_updated',
                    event: { id: eventId, name: event.title, date: eventDate, start_time: newStartTime, end_time: newEndTime },
                },
            });
            if (notifyError) console.error("Falha ao notificar sobre alteração de horário:", getErrorMessage(notifyError));
    
        } catch (err) {
            alert('Erro ao redimensionar evento: ' + getErrorMessage(err));
            info.revert();
        }
    };

    const handleSaveEvent = async (eventPayload: any) => {
        setIsSaving(true);
        setSaveError(null);
        try {
            const { department_ids, volunteer_ids, ...eventDetails } = eventPayload;
            
            // Conflict Check
            let conflictQuery = supabase
                .from('events')
                .select('id, name, start_time, end_time')
                .eq('date', eventDetails.date)
                .lt('start_time', eventDetails.end_time)
                .gt('end_time', eventDetails.start_time);
            
            if (eventDetails.id) {
                conflictQuery = conflictQuery.neq('id', eventDetails.id);
            }
            const { data: conflictingEvents, error: conflictError } = await conflictQuery;
            if (conflictError) throw new Error(`Erro ao verificar conflitos: ${getErrorMessage(conflictError)}`);
            if (conflictingEvents && conflictingEvents.length > 0) {
                const conflict = conflictingEvents[0];
                const conflictMessage = `Conflito de horário com o evento "${conflict.name}" (${conflict.start_time.substring(0,5)} - ${conflict.end_time.substring(0,5)}).`;
                throw new Error(conflictMessage);
            }
    
            let savedEvent: Event;
            const isCreating = !eventDetails.id;
            const oldEventForNotification = isCreating ? null : allEvents.find(e => e.id === eventDetails.id);
    
            if (isCreating) {
                const { id, ...insertPayload } = eventDetails;
                const { data, error } = await supabase.from('events').insert(insertPayload).select().single();
                if (error) throw error;
                savedEvent = data as Event;
            } else {
                const { id, ...updatePayload } = eventDetails;
                const { data, error } = await supabase.from('events').update(updatePayload).eq('id', id).select().single();
                if (error) throw error;
                savedEvent = data as Event;
            }
    
            if (!savedEvent || !savedEvent.id) {
                throw new Error("Falha ao salvar o evento.");
            }
            
            const eventId = savedEvent.id;
            await supabase.from('event_departments').delete().eq('event_id', eventId);
    
            if (department_ids && department_ids.length > 0) {
                const assignments = department_ids.map((deptId: number) => ({ event_id: eventId, department_id: deptId }));
                const { error: insertDeptError } = await supabase.from('event_departments').insert(assignments);
                if (insertDeptError) throw insertDeptError;
            }
    
            const { error: notifyError } = await supabase.functions.invoke('create-notifications', {
                body: { 
                    notifyType: isCreating ? 'event_created' : 'event_updated',
                    event: savedEvent,
                    oldEvent: oldEventForNotification,
                },
            });
            if (notifyError) {
                console.error("Falha ao acionar notificações:", getErrorMessage(notifyError));
            }
    
            handleCloseForm();
            onDataChange();
            await fetchAllEvents(false);
    
        } catch (err) {
            setSaveError(getErrorMessage(err));
        } finally {
            setIsSaving(false);
        }
    };
    

    const handleAddNewEvent = () => {
        const date = selectedDate.toISOString().split('T')[0];
        setEditingEvent({ name: '', date: date, start_time: '09:00', end_time: '10:00', status: 'Pendente' } as Event);
        setIsFormOpen(true);
    };
    
    const handlePrev = () => calendarRef.current?.getApi().prev();
    const handleNext = () => calendarRef.current?.getApi().next();
    const handleToday = () => calendarRef.current?.getApi().today();
    const handleViewChange = (view: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay') => {
        calendarRef.current?.getApi().changeView(view);
    };


    const renderModal = () => {
        if (!isFormOpen) return null;
        return (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto" onClick={handleCloseForm}>
                <div className="w-full max-w-4xl my-8" onClick={e => e.stopPropagation()}>
                    <NewEventForm 
                        initialData={editingEvent} 
                        onCancel={handleCloseForm} 
                        onSave={handleSaveEvent} 
                        isSaving={isSaving} 
                        saveError={saveError || ''}
                        userRole={userRole} 
                        leaderDepartmentId={leaderDepartmentId}
                        allDepartments={allDepartments}
                    />
                </div>
            </div>
        );
    };

    const calendarStyles = `
        .fc { font-family: inherit; --fc-border-color: #f1f5f9; --fc-today-bg-color: transparent; } .fc .fc-view-harness { background: transparent; border: none; } .fc .fc-view { border: none; }
        .fc-dayGridMonth-view .fc-col-header-cell-cushion { text-decoration: none !important; pointer-events: none; color: #334155 !important; font-size: 1.5rem !important; font-weight: 700 !important; text-transform: uppercase; padding: 0.5rem 0 !important; }
        .fc .fc-timeGridWeek-view .fc-col-header-cell, .fc .fc-timeGridDay-view .fc-col-header-cell { border: none; padding-bottom: 1rem; }
        .fc .fc-timeGridWeek-view .fc-col-header-cell-cushion, .fc .fc-timeGridDay-view .fc-col-header-cell-cushion { padding: 0 !important; }
        .day-header-container { text-align: center; } .day-header-container .day-name { font-size: 0.8rem; font-weight: 600; color: #9ca3af; text-transform: uppercase; } .day-header-container .day-number { font-size: 2.25rem; font-weight: 700; color: #475569; line-height: 1; margin-top: 0.5rem; } 
        .fc .fc-day-today .day-header-container .day-name { color: #1e293b; } .fc .fc-day-today .day-header-container .day-number { background-color: #2563eb; color: #fff; border-radius: 9999px; width: 48px; height: 48px; line-height: 48px; margin: 0.5rem auto 0; }
        .fc-theme-standard .fc-scrollgrid { border: none; } .fc .fc-timegrid-slot-lane { border-color: #f1f5f9; } .fc .fc-timegrid-axis-frame { justify-content: flex-start; padding: 0 1rem 0 0; } .fc .fc-timegrid-slot-label-cushion { font-size: 0.8rem; color: #9ca3af; } .fc .fc-timegrid-now-indicator-line { border-color: #ef4444; }
        .custom-event { border-width: 1px !important; border-radius: 0.5rem !important; font-weight: 500; cursor: pointer; }
        .fc-daygrid-event { white-space: normal !important; margin-bottom: 4px !important; }
        .mobile-calendar-view .fc-scrollgrid { border: none; } .mobile-calendar-view .fc .fc-col-header { border-bottom: 1px solid #e2e8f0 !important; } .mobile-calendar-view.week-view .fc-day-today { background-color: transparent !important; }
        .mobile-calendar-view.day-view .fc .fc-col-header, .mobile-calendar-view.week-view .fc .fc-col-header { display: none; }
        .mobile-calendar-view.day-view .fc-day-header { padding: 0.5rem 0; text-align: center; font-weight: 600; color: #1e293b; text-transform: capitalize; font-size: 1rem; }
        .mobile-calendar-view.week-view .fc-col-header-cell-cushion { padding-top: 0 !important; padding-bottom: 0 !important; }
        .mobile-calendar-view .fc-timegrid-body { padding-top: 0.5rem; } .mobile-calendar-view .fc-timegrid-slots { padding-bottom: 2rem; } .mobile-calendar-view .fc .fc-timegrid-slot-lane { border-bottom: 1px solid #f1f5f9; }
        .mobile-calendar-view .fc .fc-timegrid-slot-label { border: none; text-align: left; padding-left: 0.75rem; } .mobile-calendar-view .fc .fc-timegrid-slot-label-cushion { font-size: 0.875rem; color: #94a3b8; position: relative; top: -0.7em; }
        .mobile-calendar-view.day-view .fc-timegrid-event-harness { margin: 0 0.5rem 0 4rem !important; right: 0 !important; } .mobile-calendar-view.week-view .fc-timegrid-event-harness { margin: 1px 2px 0 2px !important; }
        .mobile-calendar-view.month-view .fc-daygrid-day-top { display: flex; justify-content: center; } .mobile-calendar-view.month-view .fc-daygrid-day-frame { display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding-top: 8px; min-height: 50px; }
        .mobile-calendar-view.month-view .fc-daygrid-body { width: 100% !important; } .mobile-calendar-view.month-view .fc-daygrid-day-number { font-size: 0.875rem; font-weight: 600; color: #334155; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 9999px; text-align: center; }
        .mobile-calendar-view.month-view .fc-day-today > .fc-daygrid-day-frame { background-color: transparent; } .mobile-calendar-view.month-view .fc-day.fc-day-selected > .fc-daygrid-day-frame { background-color: transparent; border-radius: 0.75rem; }
        .mobile-calendar-view.month-view .fc-day-today:not(.fc-day-selected) .fc-daygrid-day-number { color: #2563eb; font-weight: 700; } .mobile-calendar-view.month-view .fc-day.fc-day-selected .fc-daygrid-day-number { background-color: #2563eb; color: white; }
        .mobile-calendar-view.month-view .fc-daygrid-day-events { display: flex; justify-content: center; gap: 3px; margin-top: 4px; height: auto; flex-direction: row; flex-wrap: wrap; padding: 0 2px; }
        .mobile-calendar-view.month-view .fc-daygrid-day-dot { width: 5px; height: 5px; border-radius: 50%; } .mobile-calendar-view.month-view .fc-day-other .fc-daygrid-day-top { opacity: 0.4; }
        .mobile-calendar-view.month-view .fc-col-header-cell-cushion { font-size: 0.875rem !important; color: #334155; font-weight: 700; text-transform: uppercase; padding: 0.5rem 0; }
        .mobile-calendar-view.month-view .fc-theme-standard .fc-scrollgrid { border-left: none; border-right: none; } .mobile-calendar-view.month-view .fc-daygrid-day, .mobile-calendar-view.month-view .fc-col-header-cell { border-color: #f8fafc; }
        .mobile-calendar-view.month-view .fc-scrollgrid-section .fc-col-header-cell:first-child, .mobile-calendar-view.month-view .fc-scrollgrid-section .fc-daygrid-day:first-child { border-left-width: 0; }
        .mobile-calendar-view.month-view .fc-scrollgrid-section .fc-col-header-cell:last-child, .mobile-calendar-view.month-view .fc-scrollgrid-section .fc-daygrid-day:last-child { border-right-width: 0; }
    `;

    if (isMobile) {
        return (
            <div className="bg-white flex flex-col h-full">
                <style>{calendarStyles}</style>
                <MobileHeader
                    title={calendarTitle}
                    onMenuClick={() => setIsSidebarOpen(true)}
                    currentView={mobileView}
                    onViewChange={setMobileView}
                    onPrev={handlePrev}
                    onNext={handleNext}
                    onToday={handleToday}
                    statusFilters={statusFilters}
                    onStatusFilterChange={handleStatusFilterChange}
                />
                {mobileView === 'dayGridMonth' ? (
                    <div className="flex flex-col flex-1 overflow-y-auto">
                         <div className="mobile-calendar-view month-view">
                            <FullCalendar
                                key={`month-${monthViewDate.toISOString()}`}
                                ref={calendarRef}
                                plugins={[dayGridPlugin, interactionPlugin]}
                                initialView="dayGridMonth"
                                initialDate={monthViewDate}
                                locale={ptBrLocale}
                                firstDay={0}
                                headerToolbar={false}
                                events={calendarEvents}
                                eventDisplay="block"
                                eventContent={renderPillEventContent}
                                dateClick={handleDateClick}
                                dayCellClassNames={({ date }) => isSameDay(date, selectedDate) ? 'fc-day-selected' : ''}
                                datesSet={handleDatesSet}
                                height="auto"
                                dayHeaderContent={(arg) => {
                                    const headerText = ptBrLocale.dayHeaderFormat ? new Intl.DateTimeFormat('pt-BR', ptBrLocale.dayHeaderFormat as Intl.DateTimeFormatOptions).format(arg.date) : arg.text;
                                    return headerText.replace('.', '');
                                }}
                            />
                        </div>
                        <MobileMonthEventList events={allEvents.filter(e => statusFilters.includes(e.status))} selectedDate={selectedDate} onEventClick={handleMobileEventClick} />
                    </div>
                ) : (
                    <div className="flex flex-col flex-grow h-full">
                        {(mobileView === 'timeGridDay' || mobileView === 'timeGridWeek') && <DateScroller selectedDate={selectedDate} onDateSelect={handleDateScrollerSelect} />}
                        <div className={`mobile-calendar-view flex-grow ${mobileView === 'timeGridDay' ? 'day-view' : 'week-view'}`}>
                            <FullCalendar
                                key={mobileView}
                                ref={calendarRef}
                                plugins={[timeGridPlugin, interactionPlugin]}
                                initialView={mobileView}
                                initialDate={selectedDate}
                                locale={ptBrLocale}
                                firstDay={0}
                                headerToolbar={false}
                                allDaySlot={false}
                                slotMinTime="06:00:00"
                                slotMaxTime="24:00:00"
                                scrollTime={new Date().getHours() + ':00:00'}
                                height="100%"
                                dayHeaderContent={renderMobileWeekDayHeader}
                                events={calendarEvents}
                                eventClick={handleEventClick}
                                editable={isAdmin}
                                droppable={isAdmin}
                                eventDrop={handleEventDrop}
                                eventResizableFromStart={isAdmin}
                                eventResize={handleEventResize}
                                datesSet={handleDatesSet}
                            />
                        </div>
                    </div>
                )}
                {isAdmin && (
                    <button onClick={handleAddNewEvent} className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center z-20">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                    </button>
                )}
                {renderModal()}
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm h-full flex flex-col">
            <style>{calendarStyles}</style>
             <CalendarHeader
                title={calendarTitle}
                currentView={desktopView}
                onPrev={handlePrev}
                onNext={handleNext}
                onToday={handleToday}
                onViewChange={handleViewChange}
                onNewEvent={handleAddNewEvent}
                isAdmin={isAdmin}
                statusFilters={statusFilters}
                onStatusFilterChange={handleStatusFilterChange}
            />
            <div className="flex-grow">
                <FullCalendar
                    ref={calendarRef}
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                    initialView="dayGridMonth"
                    headerToolbar={false}
                    locale={ptBrLocale}
                    firstDay={0}
                    events={calendarEvents}
                    editable={isAdmin}
                    selectable={isAdmin}
                    droppable={isAdmin}
                    eventResizableFromStart={isAdmin}
                    nowIndicator
                    dayHeaderContent={(arg) => {
                        if (arg.view.type === 'timeGridWeek' || arg.view.type === 'timeGridDay') {
                            return renderDayHeaderContent(arg);
                        }
                        const headerText = ptBrLocale.dayHeaderFormat ? new Intl.DateTimeFormat('pt-BR', ptBrLocale.dayHeaderFormat as Intl.DateTimeFormatOptions).format(arg.date) : arg.text;
                        return headerText.replace('.', '');
                    }}
                    eventContent={renderPillEventContent}
                    eventClick={handleEventClick}
                    dateClick={(arg) => handleDateClick({ date: arg.date, dateStr: arg.dateStr })}
                    eventDrop={handleEventDrop}
                    eventResize={handleEventResize}
                    dayMaxEvents={desktopView === 'dayGridMonth' ? 4 : false}
                    height="100%"
                    datesSet={handleDatesSet}
                    slotMinTime="06:00:00"
                    slotMaxTime="24:00:00"
                />
            </div>
            {renderModal()}
        </div>
    );
};

export default CalendarPage;