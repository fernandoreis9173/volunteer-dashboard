import React, { useState, useEffect, useMemo } from 'react';
import { Department } from '../types';
import { supabase } from '../lib/supabaseClient';
// FIX: Use 'type' import for User to resolve potential module resolution issues with Supabase v2.
import { type User } from '@supabase/supabase-js';
import { getErrorMessage } from '../lib/utils';

interface InputFieldProps {
    label: string;
    type: string;
    name: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    placeholder?: string;
    required?: boolean;
    className?: string;
}

const InputField: React.FC<InputFieldProps> = ({ label, type, name, value, onChange, placeholder, required, className }) => (
    <div className={className}>
        <label className="block text-sm font-medium text-slate-700 mb-1">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        <input 
            type={type} 
            name={name}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            required={required}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-slate-900"
        />
    </div>
);

interface CheckboxFieldProps {
    label: string;
    name: string;
    checked: boolean;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const CheckboxField: React.FC<CheckboxFieldProps> = ({ label, name, checked, onChange }) => (
    <div className="flex items-center">
        <input 
            type="checkbox" 
            name={name}
            id={name}
            checked={checked}
            onChange={onChange}
            className="appearance-none h-4 w-4 bg-white border border-slate-400 rounded checked:bg-blue-600 checked:border-transparent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        />
        <label htmlFor={name} className="ml-2 block text-sm text-slate-700">{label}</label>
    </div>
);


const RemovableTag: React.FC<{ text: string; color: 'blue' | 'yellow'; onRemove: () => void; }> = ({ text, color, onRemove }) => {
    const getInitials = (name: string): string => {
        if (!name) return '??';
        const parts = name.trim().split(' ').filter(p => p);
        if (parts.length === 0) return '??';
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[0][0] + (parts[parts.length - 1][0] || '')).toUpperCase();
    };

    const initials = getInitials(text);

    const colorClasses = {
        blue: {
            container: 'bg-blue-100 text-blue-800 border-blue-200',
            avatar: 'bg-blue-500 text-white',
            buttonHover: 'hover:bg-blue-200'
        },
        yellow: {
            container: 'bg-yellow-100 text-yellow-800 border-yellow-200',
            avatar: 'bg-yellow-500 text-white',
            buttonHover: 'hover:bg-yellow-200'
        },
    };
    const classes = colorClasses[color];

    return (
        <div className={`inline-flex items-center space-x-2 pl-1 pr-2 py-1 rounded-full text-sm font-semibold border ${classes.container}`}>
            <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${classes.avatar}`}>
                {initials}
            </div>
            <span>{text}</span>
            <button
                type="button"
                onClick={onRemove}
                className={`ml-1 flex-shrink-0 p-0.5 rounded-full inline-flex items-center justify-center text-inherit ${classes.buttonHover}`}
                aria-label={`Remove ${text}`}
            >
                <svg className="h-3.5 w-3.5" stroke="currentColor" fill="none" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    );
};


const TagInputField: React.FC<{ 
    label: string; 
    placeholder: string; 
    tags: string[]; 
    setTags: React.Dispatch<React.SetStateAction<string[]>>;
    color: 'blue' | 'yellow';
}> = ({ label, placeholder, tags, setTags, color }) => {
    const [inputValue, setInputValue] = useState('');

    const handleAddTag = () => {
        const trimmedInput = inputValue.trim();
        if (trimmedInput && !tags.includes(trimmedInput)) {
            setTags([...tags, trimmedInput]);
            setInputValue('');
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        setTags(tags.filter(tag => tag !== tagToRemove));
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddTag();
        }
    };

    return (
    <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
        <div className="flex">
            <input 
                type="text" 
                placeholder={placeholder}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-grow w-full px-3 py-2 bg-white border border-slate-300 rounded-l-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-400 text-slate-900"
            />
            <button 
                type="button"
                onClick={handleAddTag}
                className="px-4 py-2 bg-white text-slate-700 font-bold rounded-r-lg hover:bg-slate-100 border-t border-r border-b border-slate-300"
            >
                +
            </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
            {tags.map((tag) => (
                <RemovableTag key={tag} text={tag} color={color} onRemove={() => handleRemoveTag(tag)} />
            ))}
        </div>
    </div>
    );
};


interface NewDepartmentFormProps {
    initialData?: Department | null;
    onCancel: () => void;
    onSave: (department: Omit<Department, 'created_at' | 'leaders'> & { leaders: any[] }, leader_ids: string[]) => void;
    isSaving: boolean;
    saveError: string | null;
    leaders: User[];
    leaderAssignments: Map<string, number>;
}

const NewDepartmentForm: React.FC<NewDepartmentFormProps> = ({ initialData, onCancel, onSave, isSaving, saveError, leaders, leaderAssignments }) => {
    const [formData, setFormData] = useState({ name: '', description: '' });
    const [skills, setSkills] = useState<string[]>([]);
    const [meetingDays, setMeetingDays] = useState({
        domingo: false, segunda: false, terca: false,
        quarta: false, quinta: false, sexta: false, sabado: false,
    });
    const [isActive, setIsActive] = useState(true);
    const isEditing = !!initialData;
    const [leaderSearch, setLeaderSearch] = useState('');
    const [isLeaderDropdownOpen, setIsLeaderDropdownOpen] = useState(false);
    const [selectedLeaders, setSelectedLeaders] = useState<User[]>([]);

    useEffect(() => {
        const meetingDayKeys = {
            domingo: false, segunda: false, terca: false,
            quarta: false, quinta: false, sexta: false, sabado: false,
        };

        if (initialData) {
            setFormData({
                name: initialData.name,
                description: initialData.description,
            });
            setSkills(initialData.skills_required || []);
            setIsActive(initialData.status === 'Ativo');

            const newMeetingDaysState = { ...meetingDayKeys };
            const days = Array.isArray(initialData.meeting_days) ? initialData.meeting_days : [];
            days.forEach(day => {
                if (day in newMeetingDaysState) {
                    newMeetingDaysState[day as keyof typeof newMeetingDaysState] = true;
                }
            });
            setMeetingDays(newMeetingDaysState);
            
            const initialLeaderIds = new Set(initialData.leaders.map(l => l.id));
            setSelectedLeaders(leaders.filter(l => initialLeaderIds.has(l.id)));
        } else {
            // Reset for new
            setFormData({ name: '', description: '' });
            setSkills([]);
            setMeetingDays(meetingDayKeys);
            setIsActive(true);
            setSelectedLeaders([]);
        }
    }, [initialData, leaders]);
    
    const availableLeaders = useMemo(() => {
        const selectedIds = new Set(selectedLeaders.map(l => l.id));
        const currentDeptId = initialData?.id;
    
        return leaders
            .filter(l => (l.user_metadata?.role === 'leader' || l.user_metadata?.role === 'lider' || l.user_metadata?.role === 'admin'))
            .filter(l => {
                // Exclude if already selected in the current form session
                if (selectedIds.has(l.id)) {
                    return false;
                }
    
                // Get the department this leader is currently assigned to
                const assignedDeptId = leaderAssignments.get(l.id);
    
                // If they are not assigned anywhere, they are available.
                if (assignedDeptId === undefined) {
                    return true;
                }
                
                // If they are assigned, they are only available if they are assigned to the CURRENT department we are editing.
                // This case handles the scenario where a leader is already in the department, and we want to keep them selected.
                if (isEditing && currentDeptId !== undefined && assignedDeptId === currentDeptId) {
                    return true;
                }
                
                // Otherwise, they are assigned to a DIFFERENT department and are not available.
                return false;
            });
    }, [leaders, selectedLeaders, leaderAssignments, initialData?.id, isEditing]);

    const filteredLeaders = useMemo(() => {
        if (!leaderSearch) return availableLeaders;
        const lowercasedQuery = leaderSearch.toLowerCase();
        return availableLeaders.filter(l => l.user_metadata?.name?.toLowerCase().includes(lowercasedQuery));
    }, [leaderSearch, availableLeaders]);
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = e.target;
        setMeetingDays(prev => ({ ...prev, [name]: checked }));
    };

    const handleLeaderSelect = (leader: User) => {
        setSelectedLeaders(prev => [...prev, leader]);
        setIsLeaderDropdownOpen(false);
        setLeaderSearch('');
    };
    
    const handleLeaderRemove = (leaderId: string) => {
        setSelectedLeaders(prev => prev.filter(l => l.id !== leaderId));
    };


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.name) {
            alert('Por favor, preencha o Nome do Departamento.');
            return;
        }

        const selectedMeetingDays = Object.entries(meetingDays)
            .filter(([, isSelected]) => isSelected)
            .map(([day]) => day);

        const departmentData = {
            id: initialData?.id,
            name: formData.name,
            description: formData.description,
            leaders: selectedLeaders.map(l => ({ id: l.id, name: l.user_metadata?.name || '' })),
            // FIX: Added 'as const' to ensure TypeScript infers the correct literal type ('Ativo' | 'Inativo')
            // instead of a generic string, resolving the type error when calling onSave.
            status: isActive ? 'Ativo' as const : 'Inativo' as const,
            skills_required: skills,
            meeting_days: selectedMeetingDays,
        };
        const leaderIds = selectedLeaders.map(l => l.id);
        onSave(departmentData, leaderIds);
    };

    return (
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
             <style>{`
                input[type="checkbox"]:checked {
                    background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e");
                }
            `}</style>
            <h2 className="text-2xl font-bold text-slate-800 mb-6">{isEditing ? 'Editar Departamento' : 'Novo Departamento'}</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
                <InputField label="Nome do Departamento" type="text" name="name" value={formData.name} onChange={handleInputChange} required />
                
                <div className="relative">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Líderes do Departamento</label>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Buscar e adicionar líderes..."
                            value={leaderSearch}
                            onChange={(e) => {
                                setLeaderSearch(e.target.value);
                                setIsLeaderDropdownOpen(true);
                            }}
                            onFocus={() => setIsLeaderDropdownOpen(true)}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                        />
                        {isLeaderDropdownOpen && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                                <ul className="py-1">
                                    {filteredLeaders.map(leader => (
                                        <li key={leader.id} onClick={() => handleLeaderSelect(leader)} className="px-4 py-2 hover:bg-slate-100 cursor-pointer text-slate-700">
                                            {leader.user_metadata?.name}
                                        </li>
                                    ))}
                                    {filteredLeaders.length === 0 && <li className="px-4 py-2 text-sm text-slate-500">Nenhum líder disponível.</li>}
                                </ul>
                            </div>
                        )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 min-h-[40px]">
                        {selectedLeaders.map(leader => (
                            <RemovableTag 
                                key={leader.id}
                                text={leader.user_metadata?.name || ''}
                                color="yellow"
                                onRemove={() => handleLeaderRemove(leader.id)}
                            />
                        ))}
                    </div>
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
                    <textarea name="description" value={formData.description} onChange={handleInputChange} rows={3} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"></textarea>
                </div>
                
                <TagInputField 
                    label="Habilidades Recomendadas" 
                    placeholder="Ex: Comunicação, Liderança..." 
                    tags={skills}
                    setTags={setSkills}
                    color="blue"
                />

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Dias de Reunião</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <CheckboxField label="Domingo" name="domingo" checked={meetingDays.domingo} onChange={handleCheckboxChange} />
                        <CheckboxField label="Segunda-feira" name="segunda" checked={meetingDays.segunda} onChange={handleCheckboxChange} />
                        <CheckboxField label="Terça-feira" name="terca" checked={meetingDays.terca} onChange={handleCheckboxChange} />
                        <CheckboxField label="Quarta-feira" name="quarta" checked={meetingDays.quarta} onChange={handleCheckboxChange} />
                        <CheckboxField label="Quinta-feira" name="quinta" checked={meetingDays.quinta} onChange={handleCheckboxChange} />
                        <CheckboxField label="Sexta-feira" name="sexta" checked={meetingDays.sexta} onChange={handleCheckboxChange} />
                        <CheckboxField label="Sábado" name="sabado" checked={meetingDays.sabado} onChange={handleCheckboxChange} />
                    </div>
                </div>
                
                <CheckboxField label="Departamento ativo" name="ativo" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                
                <div className="pt-6 border-t border-slate-200 flex justify-end items-center gap-3">
                    {saveError && <p className="text-sm text-red-500 mr-auto">{saveError}</p>}
                    <button type="button" onClick={onCancel} className="px-4 py-2 bg-white border border-slate-300 font-semibold rounded-lg">Cancelar</button>
                    <button type="submit" disabled={isSaving} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg disabled:bg-blue-400">
                        {isSaving ? 'Salvando...' : 'Salvar Departamento'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default NewDepartmentForm;