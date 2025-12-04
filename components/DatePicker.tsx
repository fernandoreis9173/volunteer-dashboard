import React, { useState, useRef, useEffect } from 'react';

interface DatePickerProps {
    label: string;
    name: string;
    value: string;
    onChange: (date: string) => void;
    placeholder?: string;
    required?: boolean;
    className?: string;
}

const DatePicker: React.FC<DatePickerProps> = ({ label, name, value, onChange, placeholder, required, className }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [displayValue, setDisplayValue] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Parse value to display format
    useEffect(() => {
        if (value) {
            const [year, month, day] = value.split('-');
            setDisplayValue(`${day}/${month}/${year}`);
        } else {
            setDisplayValue('');
        }
    }, [value]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let input = e.target.value.replace(/\D/g, '');

        if (input.length >= 2) {
            input = input.slice(0, 2) + '/' + input.slice(2);
        }
        if (input.length >= 5) {
            input = input.slice(0, 5) + '/' + input.slice(5, 9);
        }

        setDisplayValue(input);

        // Convert to YYYY-MM-DD format if complete
        if (input.length === 10) {
            const [day, month, year] = input.split('/');
            if (day && month && year && year.length === 4) {
                const date = `${year}-${month}-${day}`;
                onChange(date);
            }
        } else if (input.length === 0) {
            onChange('');
        }
    };

    const handleNativeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
        setIsOpen(false);
    };

    return (
        <div className={className} ref={dropdownRef}>
            <label htmlFor={name} className="block text-sm font-medium text-slate-700 ml-1 mb-1">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
                <input
                    type="text"
                    id={name}
                    name={name}
                    value={displayValue}
                    onChange={handleInputChange}
                    onClick={() => setIsOpen(!isOpen)}
                    placeholder={placeholder || 'DD/MM/AAAA'}
                    required={required}
                    maxLength={10}
                    className="appearance-none block w-full px-4 py-3 pr-10 border border-slate-200 rounded-full placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                </div>

                {isOpen && (
                    <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-2xl shadow-lg p-4">
                        <p className="text-xs text-slate-500 mb-2">Selecione uma data:</p>
                        <input
                            type="date"
                            value={value}
                            onChange={handleNativeChange}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default DatePicker;
