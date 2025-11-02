import React, { useState, useEffect, useRef } from 'react';

interface CustomTimePickerProps {
    value: string;
    onChange: (value: string) => void;
}

const pad = (num: number) => String(num).padStart(2, '0');

const hours = Array.from({ length: 24 }, (_, i) => pad(i));
const minutes = Array.from({ length: 12 }, (_, i) => pad(i * 5));

const CustomTimePicker: React.FC<CustomTimePickerProps> = ({ value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedHour, setSelectedHour] = useState('09');
    const [selectedMinute, setSelectedMinute] = useState('00');
    const pickerRef = useRef<HTMLDivElement>(null);
    const hourRef = useRef<HTMLDivElement>(null);
    const minuteRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (value) {
            const [h, m] = value.split(':');
            if (h && hours.includes(h)) {
                setSelectedHour(h);
            }
            if (m) {
                // Snap to nearest 5 minutes
                const nearestMinuteValue = Math.round(parseInt(m, 10) / 5) * 5;
                const nearestMinuteString = pad(nearestMinuteValue === 60 ? 55 : nearestMinuteValue);
                setSelectedMinute(nearestMinuteString);
            }
        } else {
             setSelectedHour('09');
             setSelectedMinute('00');
        }
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    useEffect(() => {
        if (isOpen) {
            // Use requestAnimationFrame to ensure elements are rendered before scrolling
            requestAnimationFrame(() => {
                const hourIndex = hours.indexOf(selectedHour);
                if (hourRef.current && hourIndex !== -1) {
                    const itemHeight = hourRef.current.querySelector('div')?.clientHeight || 40;
                    hourRef.current.scrollTop = (hourIndex * itemHeight) - (itemHeight * 1.5);
                }
                const minuteIndex = minutes.indexOf(selectedMinute);
                if (minuteRef.current && minuteIndex !== -1) {
                     const itemHeight = minuteRef.current.querySelector('div')?.clientHeight || 40;
                    minuteRef.current.scrollTop = (minuteIndex * itemHeight) - (itemHeight * 1.5);
                }
            });
        }
    }, [isOpen]);

    const handleConfirm = () => {
        onChange(`${selectedHour}:${selectedMinute}`);
        setIsOpen(false);
    };
    
    const handleToggle = () => {
        if (!isOpen) {
            // When opening, reset internal state to match prop
            if (value) {
                const [h, m] = value.split(':');
                if (h && hours.includes(h)) {
                    setSelectedHour(h);
                }
                 if (m) {
                    const nearestMinuteValue = Math.round(parseInt(m, 10) / 5) * 5;
                    const nearestMinuteString = pad(nearestMinuteValue === 60 ? 55 : nearestMinuteValue);
                    setSelectedMinute(nearestMinuteString);
                }
            } else {
                setSelectedHour('09');
                setSelectedMinute('00');
            }
        }
        setIsOpen(!isOpen);
    };

    const pickerContent = (
        <div className="absolute top-full mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-20 p-2">
            <div className="flex justify-center items-center h-40">
                <div ref={hourRef} className="h-full overflow-y-auto no-scrollbar flex-1">
                    {hours.map(h => (
                        <div
                            key={h}
                            onClick={() => setSelectedHour(h)}
                            className={`flex items-center justify-center h-10 cursor-pointer rounded-md text-lg transition-colors ${
                                selectedHour === h
                                    ? 'bg-blue-600 text-white font-bold'
                                    : 'text-slate-700 hover:bg-slate-100'
                            }`}
                        >
                            {h}
                        </div>
                    ))}
                </div>
                <div className="text-2xl font-bold text-slate-400 mx-1 select-none">:</div>
                <div ref={minuteRef} className="h-full overflow-y-auto no-scrollbar flex-1">
                    {minutes.map(m => (
                        <div
                            key={m}
                            onClick={() => setSelectedMinute(m)}
                            className={`flex items-center justify-center h-10 cursor-pointer rounded-md text-lg transition-colors ${
                                selectedMinute === m
                                    ? 'bg-blue-600 text-white font-bold'
                                    : 'text-slate-700 hover:bg-slate-100'
                            }`}
                        >
                            {m}
                        </div>
                    ))}
                </div>
            </div>
            <button
                type="button"
                onClick={handleConfirm}
                className="w-full mt-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
            >
                Confirmar
            </button>
        </div>
    );

    return (
        <div className="relative w-full" ref={pickerRef}>
             <style>{`.no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
            <div
                onClick={handleToggle}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-sm flex justify-between items-center cursor-pointer"
            >
                <span className={value ? 'text-slate-900' : 'text-slate-400'}>
                    {value ? value.substring(0,5) : 'hh:mm'}
                </span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
            </div>
            {isOpen && pickerContent}
        </div>
    );
};

export default CustomTimePicker;