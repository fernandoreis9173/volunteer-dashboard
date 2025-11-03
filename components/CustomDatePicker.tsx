import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CalendarIcon } from '@/assets/icons';

interface CustomDatePickerProps {
    value: string;
    onChange: (value: string) => void;
    name: string;
}

const CustomDatePicker: React.FC<CustomDatePickerProps> = ({ value, onChange, name }) => {
    const [isOpen, setIsOpen] = useState(false);
    const initialDate = value ? new Date(value + 'T00:00:00') : new Date();
    const [displayDate, setDisplayDate] = useState(initialDate);
    const datePickerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) {
           const newDate = value ? new Date(value + 'T00:00:00') : new Date();
           setDisplayDate(newDate);
        }
    }, [value, isOpen]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const daysOfWeek = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

    const calendarGrid = useMemo(() => {
        const year = displayDate.getFullYear();
        const month = displayDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        
        const daysInMonth = [];
        const startDayOfWeek = firstDayOfMonth.getDay();
        for (let i = 0; i < startDayOfWeek; i++) {
            const date = new Date(firstDayOfMonth);
            date.setDate(date.getDate() - (startDayOfWeek - i));
            daysInMonth.push({ date, isCurrentMonth: false });
        }
        
        for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
            daysInMonth.push({ date: new Date(year, month, i), isCurrentMonth: true });
        }
        
        const endDayOfWeek = lastDayOfMonth.getDay();
        const remainingDays = 6 - endDayOfWeek;
        for (let i = 1; i <= remainingDays; i++) {
            const date = new Date(lastDayOfMonth);
            date.setDate(date.getDate() + i);
            daysInMonth.push({ date, isCurrentMonth: false });
        }
        
        while (daysInMonth.length < 42) {
             const lastDay = daysInMonth[daysInMonth.length - 1].date;
             const nextDay = new Date(lastDay);
             nextDay.setDate(nextDay.getDate() + 1);
             daysInMonth.push({ date: nextDay, isCurrentMonth: false });
        }

        return daysInMonth;
    }, [displayDate]);

    const handleDateSelect = (date: Date) => {
        const dateString = date.toISOString().split('T')[0];
        onChange(dateString);
        setIsOpen(false);
    };

    const handleClear = () => {
        onChange('');
        setIsOpen(false);
    };

    const handleToday = () => {
        const today = new Date();
        setDisplayDate(today);
        handleDateSelect(today);
    };

    const changeMonth = (amount: number) => {
        setDisplayDate(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(newDate.getMonth() + amount);
            return newDate;
        });
    };
    
    const formattedInputValue = value ? new Date(value + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric'}) : '';

    return (
        <div className="relative w-full" ref={datePickerRef}>
            <div className="relative">
                 <input
                    type="text"
                    name={name}
                    value={formattedInputValue}
                    readOnly
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg cursor-pointer text-slate-700 placeholder-slate-400"
                    placeholder="dd/mm/aaaa"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <img src={CalendarIcon} alt="Calendar" className="h-5 w-5 text-slate-400" style={{ filter: 'brightness(0) saturate(100%)' }} />
                </div>
            </div>

            {isOpen && (
                <div className="absolute top-full mt-2 w-full sm:w-80 bg-white border border-slate-200 rounded-lg shadow-lg z-20 p-4">
                    <div className="flex justify-between items-center mb-4">
                        <button type="button" onClick={() => changeMonth(-1)} className="p-1 text-slate-500 hover:text-blue-600 rounded-full hover:bg-slate-100">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24 " stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <p className="font-semibold text-slate-800 capitalize">
                            {displayDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                        </p>
                        <button type="button" onClick={() => changeMonth(1)} className="p-1 text-slate-500 hover:text-blue-600 rounded-full hover:bg-slate-100">
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24 " stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-500 mb-2">
                        {daysOfWeek.map(day => <div key={day}>{day}</div>)}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                        {calendarGrid.map(({ date, isCurrentMonth }, index) => {
                             const isSelected = value && new Date(value + 'T00:00:00').toDateString() === date.toDateString();
                             const isToday = new Date().toDateString() === date.toDateString();
                             
                             let buttonClass = "w-9 h-9 flex items-center justify-center rounded-full text-sm transition-colors ";
                             if (!isCurrentMonth) {
                                buttonClass += "text-slate-300 cursor-default";
                             } else if (isSelected) {
                                buttonClass += "bg-blue-600 text-white font-bold";
                             } else if (isToday) {
                                buttonClass += "text-blue-600 font-bold border-2 border-blue-600";
                             } else {
                                buttonClass += "text-slate-700 hover:bg-slate-100";
                             }

                            return (
                                <button
                                    key={index}
                                    type="button"
                                    onClick={() => isCurrentMonth && handleDateSelect(date)}
                                    disabled={!isCurrentMonth}
                                    className={buttonClass}
                                >
                                    {date.getDate()}
                                </button>
                            )
                        })}
                    </div>
                    <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-200">
                        <button type="button" onClick={handleClear} className="text-sm font-semibold text-blue-600 hover:underline">Limpar</button>
                        <button type="button" onClick={handleToday} className="text-sm font-semibold text-blue-600 hover:underline">Hoje</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomDatePicker;