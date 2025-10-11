import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
// FIX: Removed DateClickArg from import as it's not exported from @fullcalendar/core in some configurations. An inline type will be used instead.
import { EventInput, EventClickArg, EventDropArg, DayHeaderContentArg, EventContentArg, DatesSetArg } from '@fullcalendar/core';
import ptBrLocale from '@fullcalendar/core/locales/pt-br';

import NewEventForm from './NewScheduleForm';
import { Event } from '../types';
import { supabase } from '../lib/supabaseClient';
import { getErrorMessage } from '../lib/utils';

// --- Color & Style Logic ---

const PREDEFINED_COLORS: { [key: string]: { bg: string, text: string, border: string } } = {
    '#3b82f6': { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' }, // Blue
    '#22c55e': { bg: '#dcfce7', text: '#166534', border: '#86efac' }, // Green
    '#f59e0b': { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' }, // Amber
    '#ef4444': { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' }, // Red
    'purple': { bg: '#f5f3ff', text: '#5b21b6', border: '#ddd6fe' },
    'orange': { bg: '#fff7ed', text: '#9a3412', border: '#fed7aa' },
    'yellow': { bg: '#fefce8', text: '#854d0e', border: '#fef08a' }
};

const PASTEL_COLORS = Object.values(PREDEFINED_COLORS);
const departmentColorMap = new Map<number, {bg: string, text: string, border: string}>();
let lastColorIndex = 0;

const getDepartmentColor = (departmentId?: number) => {
    if (!departmentId) return { bg: '#f1f5f9', text: '#334155', border: '#e2e8f0' };
    if (!departmentColorMap.has(departmentId)) {
        departmentColorMap.set(departmentId, PASTEL_COLORS[lastColorIndex % PASTEL_COLORS.length]);
        lastColorIndex++;
    }
    return departmentColorMap.get(departmentId)!;
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
    selectedDate: Date; 
    onMenuClick: () => void; 
    currentView: MobileView;
    onViewChange: (view: MobileView) => void;
}> = ({ selectedDate, onMenuClick, currentView, onViewChange }) => {
    const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const formattedDate = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' }).format(selectedDate).replace(/\./g, '');
    const parts = formattedDate.split(' de ');
    const displayDate = `${parts[0]} De ${parts[1].charAt(0).toUpperCase() + parts[1].slice(1)}`;

    const viewLabels: Record<MobileView, string> = {
        timeGridDay: 'Dia',
        timeGridWeek: 'Semana',
        dayGridMonth: 'Mês'
    };

    const handleViewSelect = (view: MobileView) => {
        onViewChange(view);
        setIsViewDropdownOpen(false);
    };

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
        <div className="px-6 py-4 bg-white">
            <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                    {currentView !== 'dayGridMonth' && <h2 className="text-2xl font-bold text-slate-900 capitalize">{displayDate}</h2>}
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative" ref={dropdownRef}>
                        <button onClick={() => setIsViewDropdownOpen(!isViewDropdownOpen)} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-lg text-slate-700 font-semibold text-sm transition-colors hover:bg-slate-200" aria-haspopup="true" aria-expanded={isViewDropdownOpen}>
                            <span>{viewLabels[currentView]}</span>
                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform ${isViewDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                        </button>
                        {isViewDropdownOpen && (
                            <div className="absolute right-0 mt-2 w-32 bg-white rounded-lg shadow-lg border border-slate-200 z-10" role="menu">
                                <ul className="py-1">
                                    {Object.keys(viewLabels).map((view) => (
                                        <li key={view}>
                                            <button onClick={() => handleViewSelect(view as MobileView)} className={`w-full text-left px-4 py-2 text-sm transition-colors ${currentView === view ? 'font-semibold text-blue-600 bg-blue-50' : 'text-slate-700 hover:bg-slate-100'}`} role="menuitem">
                                                {viewLabels[view as MobileView]}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                    <button onClick={onMenuClick} className="p-2 text-slate-600 hover:text-slate-900" aria-label="Open menu">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
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
        <div className="px-6 py-3 bg-white border-b border-t border-slate-100">
            <div className="flex justify-between items-center">
                {weekDates.map(date => {
                    const isSelected = isSameDay(date, selectedDate);
                    const dayName = date.toLocaleDateString('pt-BR', { weekday: 'narrow' });
                    return (
                        <button key={date.toISOString()} onClick={() => onDateSelect(date)} className="flex flex-col items-center space-y-2 w-10 focus:outline-none text-center">
                            <span className="text-sm font-medium text-slate-400 uppercase">{dayName}</span>
                            <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold transition-colors ${isSelected ? 'bg-blue-600 text-white' : 'bg-transparent text-slate-800'}`}>
                                {date.getDate()}
                            </span>
                        </button>
                    )
                })}
            </div>
        </div>
    );
};


const renderDayHeaderContentDesktop = (arg: DayHeaderContentArg) => {
    const dayNumber = new Intl.DateTimeFormat('pt-BR', { day: 'numeric' }).format(arg.date);
    const dayName = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(arg.date).replace('.', '');
    return <div className="day-header-container"><div className="day-name">{dayName}</div><div className="day-number">{String(dayNumber).padStart(2, '0')}</div></div>;
};

const renderMobileWeekDayHeader = (arg: DayHeaderContentArg) => {
    const isToday = arg.isToday;
    return (
        <div className="flex flex-col items-center py-1">
            <span className="text-xs uppercase text-slate-500">{arg.text.split(' ')[0]}</span>
            <span className={`mt-1 text-base font-bold ${isToday ? 'bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center' : 'text-slate-800'}`}>
                {arg.date.getDate()}
            </span>
        </div>
    );
};

const MonthNavigator: React.FC<{ currentDate: Date; onDateChange: (newDate: Date) => void }> = ({ currentDate, onDateChange }) => {
    const getMonthDate = (offset: number) => {
        const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1);
        return newDate;
    };
    
    const prevMonth = getMonthDate(-1);
    const nextMonth = getMonthDate(1);
    const formatMonth = (date: Date) => date.toLocaleDateString('pt-BR', { month: 'long' });

    return (
        <div className="flex justify-between items-center px-6 py-4 bg-white">
            <button onClick={() => onDateChange(prevMonth)} className="text-lg font-semibold text-slate-400 capitalize hover:text-slate-600 transition-colors">
                {formatMonth(prevMonth)}
            </button>
            <h2 className="text-xl font-bold text-blue-600 capitalize">
                {formatMonth(currentDate)}
            </h2>
            <button onClick={() => onDateChange(nextMonth)} className="text-lg font-semibold text-slate-400 capitalize hover:text-slate-600 transition-colors">
                {formatMonth(nextMonth)}
            </button>
        </div>
    );
};

const MobileMonthEventList: React.FC<{ events: Event[], selectedDate: Date, onEventClick: (event: Event) => void }> = ({ events, selectedDate, onEventClick }) => {
    const filteredEvents = useMemo(() => {
        const selectedDateStr = selectedDate.toISOString().split('T')[0];
        return events.filter(e => e.date === selectedDateStr).sort((a, b) => a.start_time.localeCompare(b.start_time));
    }, [events, selectedDate]);

    const EventItemCard: React.FC<{event: Event}> = ({ event }) => {
        const colorKey = event.color || (event.event_departments[0]?.departments?.name.toLowerCase().includes('almoço') ? 'green' : undefined);
        const colors = colorKey && PREDEFINED_COLORS[colorKey] ? PREDEFINED_COLORS[colorKey] : getDepartmentColor(event.event_departments[0]?.department_id);
        const initials = event.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase() || 'E';

        return (
            <div onClick={() => onEventClick(event)} className="bg-white p-4 rounded-xl shadow-sm flex items-start space-x-4 cursor-pointer border border-slate-100">
                 <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg flex-shrink-0">
                    {initials}
                </div>
                <div className="flex-grow">
                    <p className="font-semibold text-slate-800">{event.name}</p>
                    <p className="text-sm text-slate-500">{event.event_departments[0]?.departments?.name || 'Geral'}</p>
                    <div className="mt-2 px-3 py-1 text-sm font-semibold rounded-full inline-block" style={{backgroundColor: colors.bg, color: colors.text}}>
                        {event.start_time} - {event.end_time}
                    </div>
                </div>
            </div>
        )
    };

    return (
        <div className="p-6 bg-slate-50 flex-grow">
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

// --- Main Component ---

interface CalendarPageProps {
  userRole: string | null;
  leaderDepartmentId: number | null;
  onDataChange: () => void;
  setIsSidebarOpen: (isOpen: boolean) => void;
}

const CalendarPage: React.FC<CalendarPageProps> = ({ userRole, leaderDepartmentId, onDataChange, setIsSidebarOpen }) => {
    const [allEvents, setAllEvents] = useState<Event[]>([]);
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
    const isAdmin = userRole === 'admin';

    const fetchAllEvents = useCallback(async (setLoadingState = true) => {
        if (setLoadingState) setLoading(true);
        setError(null);
        try {
            const { data, error: fetchError } = await supabase.from('events').select(`*, event_departments(department_id, departments(id, name)), event_volunteers(*)`);
            if (fetchError) throw fetchError;
            setAllEvents((data as unknown as Event[]) || []);
        } catch (err) { setError(getErrorMessage(err)); } 
        finally { if (setLoadingState) setLoading(false); }
    }, []);

    useEffect(() => { fetchAllEvents(); }, [fetchAllEvents]);

    const handleDatesSet = (arg: DatesSetArg) => {
        const view = arg.view;
        const midDate = new Date(view.currentStart.getTime() + (view.currentEnd.getTime() - view.currentStart.getTime()) / 2);
        
        if (mobileView === 'dayGridMonth') {
            if (midDate.getMonth() !== monthViewDate.getMonth() || midDate.getFullYear() !== monthViewDate.getFullYear()) {
                setMonthViewDate(midDate);
            }
        } else {
            const needsUpdate = selectedDate < view.currentStart || selectedDate >= view.currentEnd;
            if (needsUpdate) {
                setSelectedDate(view.currentStart);
            }
        }
    };
    
    const handleDateScrollerSelect = (date: Date) => {
        setSelectedDate(date);
        calendarRef.current?.getApi().gotoDate(date);
    };

    const calendarEvents = useMemo((): EventInput[] => allEvents.map(event => {
        const colorKey = event.color || (event.event_departments[0]?.departments?.name.toLowerCase().includes('almoço') ? 'green' : undefined);
        const colors = colorKey && PREDEFINED_COLORS[colorKey] ? PREDEFINED_COLORS[colorKey] : getDepartmentColor(event.event_departments[0]?.department_id);
        return {
            id: String(event.id),
            title: event.name,
            start: `${event.date}T${event.start_time}`,
            end: `${event.date}T${event.end_time}`,
            backgroundColor: colors.bg,
            borderColor: colors.border,
            textColor: colors.text,
            classNames: ['custom-event'],
            extendedProps: { ...event, color: colorKey, dotColor: colors.border }
        };
    }), [allEvents]);

    // FIX: Replaced non-exported DateClickArg with an inline type for the used properties.
    const handleDateClick = (arg: { date: Date, dateStr: string }) => {
        if (mobileView === 'dayGridMonth') {
            setSelectedDate(arg.date);
            return;
        }
        if (!isAdmin) return;
        setEditingEvent({ name: '', date: arg.dateStr.split('T')[0], start_time: arg.date.toTimeString().substring(0, 5), end_time: new Date(arg.date.getTime() + 60*60*1000).toTimeString().substring(0, 5), status: 'Pendente' } as Event);
        setIsFormOpen(true);
    };

    // FIX: Created a new handler for the custom mobile event list which passes an `Event` object,
    // resolving a type mismatch with FullCalendar's `eventClick` handler which passes `EventClickArg`.
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
        const newDate = event.start.toISOString().split('T')[0];
        const newStartTime = event.start.toTimeString().substring(0, 8);
        const newEndTime = event.end ? event.end.toTimeString().substring(0, 8) : newStartTime;
        try {
            const { data: conflicts } = await supabase.from('events').select('id, name').eq('date', newDate).neq('id', eventId).or(`start_time.lt.${newEndTime},end_time.gt.${newStartTime}`);
            if (conflicts && conflicts.length > 0) { throw new Error(`Conflito de horário com "${conflicts[0].name}".`); }
        } catch (err) { alert('Erro ao verificar conflitos: ' + getErrorMessage(err)); info.revert(); return; }
        const { error: updateError } = await supabase.from('events').update({ date: newDate, start_time: newStartTime, end_time: newEndTime }).eq('id', eventId);
        if (updateError) { alert('Falha ao atualizar o evento. ' + getErrorMessage(updateError)); info.revert(); } else { await fetchAllEvents(false); onDataChange(); }
    };
    
    const handleSaveEvent = async (eventPayload: any) => {
        setIsSaving(true); setSaveError(null);
        try {
            const { volunteer_ids, ...upsertData } = eventPayload;
            let conflictQuery = supabase.from('events').select('id, name').eq('date', upsertData.date).or(`start_time.lt.${upsertData.end_time},end_time.gt.${upsertData.start_time}`);
            if (upsertData.id) conflictQuery = conflictQuery.neq('id', upsertData.id);
            const { data: conflicts } = await conflictQuery;
            if (conflicts && conflicts.length > 0) { throw new Error(`Conflito de horário com o evento "${conflicts[0].name}".`); }
            const { error: eventError } = await supabase.from('events').upsert(upsertData).select('id').single();
            if (eventError) throw eventError;
            setIsFormOpen(false); setEditingEvent(null); onDataChange(); await fetchAllEvents(false);
        } catch (err) { setSaveError(getErrorMessage(err)); } finally { setIsSaving(false); }
    };

    const handleAddNewEvent = () => {
        const date = selectedDate.toISOString().split('T')[0];
        setEditingEvent({ name: '', date: date, start_time: '09:00', end_time: '10:00', status: 'Pendente' } as Event);
        setIsFormOpen(true);
    };
    
    const handleMonthNavigatorChange = (newDate: Date) => {
        setMonthViewDate(newDate);
        setSelectedDate(newDate);
        calendarRef.current?.getApi().gotoDate(newDate);
    };

    const calendarStyles = `
        /* General */ .fc { font-family: inherit; --fc-border-color: #f1f5f9; --fc-today-bg-color: transparent; } .fc .fc-view-harness { background: transparent; border: none; } .fc .fc-view { border: none; }
        /* Toolbar */ .fc .fc-toolbar.fc-header-toolbar { padding: 0 0 1.5rem 0; margin-bottom: 1.5rem; border-bottom: 1px solid #e2e8f0; } .fc .fc-toolbar-title { font-size: 2rem; font-weight: 800; color: #1e293b; text-transform: capitalize; } .fc .fc-button { background-color: #fff !important; border: 1px solid #e2e8f0 !important; color: #334155 !important; font-weight: 600 !important; border-radius: 0.5rem !important; box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05) !important; } .fc .fc-button-group { display: inline-flex; border-radius: 0.5rem; overflow: hidden; border: 1px solid #e2e8f0; } .fc .fc-button-group > .fc-button { border-radius: 0 !important; border: none !important; } .fc .fc-button-group > .fc-button:not(:first-child) { border-left: 1px solid #e2e8f0 !important; } .fc .fc-button-group > .fc-button.fc-button-active { background-color: #f1f5f9 !important; color: #1e293b !important; }
        /* Desktop Day Headers */ .fc .fc-col-header-cell { border: none; padding-bottom: 1rem; } .fc .fc-col-header-cell-cushion { padding: 0 !important; } .day-header-container { text-align: center; } .day-header-container .day-name { font-size: 0.8rem; font-weight: 600; color: #9ca3af; text-transform: uppercase; } .day-header-container .day-number { font-size: 2.25rem; font-weight: 700; color: #475569; line-height: 1; margin-top: 0.5rem; } .fc .fc-day-today .day-header-container .day-name { color: #1e293b; } .fc .fc-day-today .day-header-container .day-number { background-color: #1e293b; color: #fff; border-radius: 9999px; width: 48px; height: 48px; line-height: 48px; margin: 0.5rem auto 0; }
        /* Desktop Time Grid */ .fc-theme-standard .fc-scrollgrid { border: none; } .fc .fc-timegrid-slot-lane { border-color: #f1f5f9; } .fc .fc-timegrid-axis-frame { justify-content: flex-start; padding: 0 1rem 0 0; } .fc .fc-timegrid-slot-label-cushion { font-size: 0.8rem; color: #9ca3af; } .fc .fc-timegrid-now-indicator-line { border-color: #ef4444; }
        /* Event styles */ .custom-event { border-width: 1px !important; border-radius: 0.5rem !important; font-weight: 500; cursor: pointer; }
        /* Month View */ .fc-daygrid-day-frame { min-height: 120px; } .fc-daygrid-event { white-space: normal !important; }
        
        /* Mobile-specific overrides */
        .mobile-calendar-view .fc-scrollgrid { border: none; }
        .mobile-calendar-view.week-view .fc .fc-col-header { display: none; }
        .mobile-calendar-view.week-view .fc-day-today { background-color: transparent !important; }
        .mobile-calendar-view.day-view .fc .fc-col-header { display: none; }
        .mobile-calendar-view.day-view .fc-day-header { padding: 0.5rem 0; text-align: center; font-weight: 600; color: #1e293b; text-transform: capitalize; font-size: 1rem; }
        .mobile-calendar-view.week-view .fc-col-header-cell-cushion { padding-top: 0.5rem !important; padding-bottom: 0.5rem !important; }
        .mobile-calendar-view .fc-timegrid-slots { padding-bottom: 2rem; }
        .mobile-calendar-view .fc .fc-timegrid-slot-lane { border-bottom: 1px solid #f1f5f9; }
        .mobile-calendar-view .fc .fc-timegrid-slot-label { border: none; text-align: left; padding-left: 0.75rem; }
        .mobile-calendar-view .fc .fc-timegrid-slot-label-cushion { font-size: 0.875rem; color: #94a3b8; position: relative; top: -0.7em; }
        .mobile-calendar-view.day-view .fc-timegrid-event-harness { margin: 0 0.5rem 0 4rem !important; right: 0 !important; }
        .mobile-calendar-view.week-view .fc-timegrid-event-harness { margin: 1px 2px 0 2px !important; }
        .mobile-calendar-view.week-view .custom-event { font-size: 0.7rem; padding: 2px 4px !important; border-radius: 4px !important; line-height: 1.2; }

        /* New Month View Styles */
        .mobile-calendar-view.month-view .fc-daygrid-day-top { display: flex; justify-content: center; }
        .mobile-calendar-view.month-view .fc-daygrid-day-frame { display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding-top: 8px; min-height: 50px; }
        .mobile-calendar-view.month-view .fc-daygrid-body { width: 100% !important; }
        .mobile-calendar-view.month-view .fc-daygrid-day-number { font-size: 0.875rem; font-weight: 600; color: #334155; width: 28px; height: 28px; line-height: 28px; border-radius: 9999px; text-align: center; }
        .mobile-calendar-view.month-view .fc-day-today > .fc-daygrid-day-frame { background-color: #eff6ff; border-radius: 0.75rem; }
        .mobile-calendar-view.month-view .fc-day-today .fc-daygrid-day-number { background-color: #2563eb; color: white; }
        .mobile-calendar-view.month-view .fc-day.fc-day-selected > .fc-daygrid-day-frame { background-color: #dbeafe; border-radius: 0.75rem; }
        .mobile-calendar-view.month-view .fc-daygrid-day-dots { display: flex; justify-content: center; gap: 3px; margin-top: 4px; height: 4px; }
        .mobile-calendar-view.month-view .fc-daygrid-day-dot { width: 4px; height: 4px; border-radius: 50%; }
        .mobile-calendar-view.month-view .fc-day-other .fc-daygrid-day-top { opacity: 0.4; }
        .mobile-calendar-view.month-view .fc-col-header-cell-cushion { text-transform: uppercase; font-size: 0.8rem; color: #64748b; font-weight: 600; }
        .mobile-calendar-view.month-view .fc-theme-standard .fc-scrollgrid { border-left: none; border-right: none; }
        .mobile-calendar-view.month-view .fc-daygrid-day, .mobile-calendar-view.month-view .fc-col-header-cell { border-color: #f8fafc; }
    `;

    if (isMobile) {
        return (
            <div className="bg-white h-full flex flex-col">
                <style>{calendarStyles}</style>
                <MobileHeader selectedDate={selectedDate} onMenuClick={() => setIsSidebarOpen(true)} currentView={mobileView} onViewChange={setMobileView} />
                
                {mobileView === 'dayGridMonth' ? (
                    <div className="flex flex-col flex-grow min-h-0">
                         <MonthNavigator currentDate={monthViewDate} onDateChange={handleMonthNavigatorChange} />
                         <div className={`px-2 pb-2 mobile-calendar-view month-view`}>
                            <FullCalendar
                                key={`month-${monthViewDate.toISOString()}`}
                                ref={calendarRef}
                                plugins={[dayGridPlugin, interactionPlugin]}
                                initialView="dayGridMonth"
                                initialDate={monthViewDate}
                                locale={ptBrLocale}
                                headerToolbar={false}
                                events={calendarEvents}
                                eventDisplay="list-item"
                                eventContent={() => null}
                                dateClick={handleDateClick}
                                dayCellDidMount={(arg) => {
                                    const eventsOnDay = calendarEvents.filter(e => isSameDay(new Date(e.start as string), arg.date));
                                    if(eventsOnDay.length > 0) {
                                        const dotsContainer = document.createElement('div');
                                        dotsContainer.className = 'fc-daygrid-day-dots';
                                        const uniqueColors = [...new Set(eventsOnDay.map(e => e.extendedProps?.dotColor).filter(Boolean))];
                                        uniqueColors.slice(0, 3).forEach(color => {
                                            const dot = document.createElement('div');
                                            dot.className = 'fc-daygrid-day-dot';
                                            dot.style.backgroundColor = color as string;
                                            dotsContainer.appendChild(dot);
                                        });
                                        arg.el.querySelector('.fc-daygrid-day-frame')?.appendChild(dotsContainer);
                                    }
                                    if (isSameDay(arg.date, selectedDate)) {
                                        arg.el.classList.add('fc-day-selected');
                                    }
                                }}
                                datesSet={handleDatesSet}
                                height="auto"
                            />
                         </div>
                         <MobileMonthEventList events={allEvents} selectedDate={selectedDate} onEventClick={handleMobileEventClick} />
                    </div>
                ) : (
                    <>
                        {mobileView === 'timeGridWeek' && <DateScroller selectedDate={selectedDate} onDateSelect={handleDateScrollerSelect} />}
                        <main className={`flex-grow bg-white rounded-t-2xl -mt-2 relative mobile-calendar-view ${mobileView === 'timeGridWeek' ? 'overflow-y-auto' : 'overflow-hidden'} ${mobileView === 'timeGridDay' ? 'day-view' : 'week-view'}`}>
                            {loading ? <div className="p-4 text-center text-slate-500">Carregando...</div> : error ? <div className="p-4 text-center text-red-500">{error}</div> :
                                <FullCalendar key={mobileView} ref={calendarRef} plugins={[timeGridPlugin, interactionPlugin]} initialDate={selectedDate} initialView={mobileView} locale={ptBrLocale} headerToolbar={false} events={calendarEvents} eventClick={handleEventClick} editable={isAdmin} eventDrop={handleEventDrop} datesSet={handleDatesSet} height={mobileView === 'timeGridWeek' ? 'auto' : '100%'} allDaySlot={false} nowIndicator={false} slotMinTime="06:00:00" slotMaxTime="24:00:00" slotLabelContent={(arg) => <span className="mobile-slot-label">{String(arg.date.getHours()).padStart(2, '0')}</span>} dayHeaderContent={mobileView === 'timeGridWeek' ? renderMobileWeekDayHeader : (arg) => <div className="fc-day-header">{arg.date.toLocaleDateString('pt-BR', { weekday: 'long' })}</div>} />
                            }
                        </main>
                    </>
                )}
                
                {isAdmin && (
                    <button onClick={handleAddNewEvent} className="fixed bottom-6 right-6 z-30 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500" aria-label="Adicionar Novo Evento">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                    </button>
                )}
                {isFormOpen && <div className="fixed inset-0 bg-black/60 z-40 flex items-start sm:items-center justify-center p-4 overflow-y-auto" onClick={() => setIsFormOpen(false)}><div className="w-full max-w-3xl my-8" onClick={e => e.stopPropagation()}><NewEventForm initialData={editingEvent} onCancel={() => { setIsFormOpen(false); setEditingEvent(null); }} onSave={handleSaveEvent} isSaving={isSaving} saveError={saveError} userRole={userRole} leaderDepartmentId={leaderDepartmentId} /></div></div>}
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full relative p-4 sm:p-6 bg-slate-50">
            <style>{calendarStyles}</style>
            <button onClick={() => setIsSidebarOpen(true)} className="absolute top-4 left-4 z-20 p-2 bg-white rounded-full shadow-md border border-slate-200 text-slate-500 hover:text-slate-800 lg:hidden" aria-label="Show sidebar">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" /></svg>
            </button>
            <div className="flex-grow">
                {loading ? <div className="text-center p-10">Carregando...</div> : error ? <div className="text-center p-10 text-red-500">{error}</div> :
                    <FullCalendar plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]} initialView="timeGridWeek" locale={ptBrLocale} headerToolbar={{ left: 'title', center: 'dayGridMonth,timeGridWeek,timeGridDay', right: `${isAdmin ? 'newEventButton ' : ''}today prev,next` }} customButtons={isAdmin ? { newEventButton: { text: 'Novo Evento', click: () => { setEditingEvent({ name: '', date: new Date().toISOString().split('T')[0], start_time: new Date().toTimeString().substring(0, 5), end_time: new Date(new Date().getTime() + 60*60*1000).toTimeString().substring(0, 5), status: 'Pendente' } as Event); setIsFormOpen(true); } } } : {}} buttonText={{ today: 'Hoje', month: 'Mês', week: 'Semana', day: 'Dia' }} titleFormat={{ month: 'long', year: 'numeric' }} dayHeaderContent={renderDayHeaderContentDesktop} events={calendarEvents} eventContent={(info) => <div className="p-1.5 overflow-hidden h-full"><div className="font-semibold text-sm">{info.event.title}</div><div className="text-xs opacity-80">{info.timeText}</div></div>} eventClick={handleEventClick} dateClick={handleDateClick} editable={isAdmin} eventDrop={handleEventDrop} height="100%" allDaySlot={false} nowIndicator={true} slotMinTime="06:00:00" slotMaxTime="24:00:00" slotLabelFormat={{ hour: 'numeric', hour12: false, meridiem: false }} />
                }
            </div>
            {isFormOpen && <div className="fixed inset-0 bg-black/60 z-40 flex items-start sm:items-center justify-center p-4 overflow-y-auto" onClick={() => setIsFormOpen(false)}><div className="w-full max-w-3xl my-8" onClick={e => e.stopPropagation()}><NewEventForm initialData={editingEvent} onCancel={() => { setIsFormOpen(false); setEditingEvent(null); }} onSave={handleSaveEvent} isSaving={isSaving} saveError={saveError} userRole={userRole} leaderDepartmentId={leaderDepartmentId} /></div></div>}
        </div>
    );
};

export default CalendarPage;