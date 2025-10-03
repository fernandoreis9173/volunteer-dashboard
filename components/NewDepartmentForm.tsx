
import React, { useState, useEffect, useMemo } from 'react';
import { Department } from '../types';
import { SupabaseClient, User } from '@supabase/supabase-js';

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
                <svg className="h-3.5 w-3.5" stroke="currentColor" fill="none" viewBox="0 0 8 8">
                    <path strokeLinecap="round" strokeWidth="1.5" d="M1 1l6 6m0-6L1 7" />
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
    supabase: SupabaseClient | null;
    initialData?: Department | null;
    onCancel: () => void;
    onSave: (department: Omit<Department, 'created_at'>, new_leader_id?: string) => void;
    isSaving: boolean;
    saveError: string | null;
    leaders: User[];
}

const getInitials = (name?: string): string => {
    if (!name) return '??';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + (parts[parts.length - 1][0] || '')).toUpperCase();
};

const NewDepartmentForm: React.FC<NewDepartmentFormProps> = ({ supabase, initialData, onCancel, onSave, isSaving, saveError, leaders }) => {
    const [formData, setFormData] = useState({ 
        name: '', 
        description: '', 
        leader: '', 
        leader_contact: '' 
    });
    const [skills, setSkills] = useState<string[]>([]);
    const [meetingDays, setMeetingDays] = useState({
        domingo: false, segunda: false, terca: false,
        quarta: false, quinta: false, sexta: false, sabado: false,
    });
    const [isActive, setIsActive] = useState(true);
    const isEditing = !!initialData;
    const [leaderSearch, setLeaderSearch] = useState('');
    const [isLeaderDropdownOpen, setIsLeaderDropdownOpen] = useState(false);
    const [allDepartments, setAllDepartments] = useState<Department[]>([]);
    const [leaderConflictError, setLeaderConflictError] = useState<string | null>(null);
    const [selectedLeader, setSelectedLeader] = useState<User | null>(null);

    useEffect(() => {
        const fetchAllDepartments = async () => {
            if (!supabase) return;
            const { data: departmentsData, error: departmentsError } = await supabase.from('departments').select('*');
            if (departmentsError) {
                console.error('Error fetching departments for conflict check:', departmentsError);
            } else {
                setAllDepartments(departmentsData || []);
            }
        };
        fetchAllDepartments();
    }, [supabase]);

    useEffect(() => {
        const meetingDayKeys = {
            domingo: false, segunda: false, terca: false,
            quarta: false, quinta: false, sexta: false, sabado: false,
        };

        if (initialData) {
            setFormData({ 
                name: initialData.name, 
                description: initialData.description, 
                leader: initialData.leader,
                leader_contact: initialData.leader_contact || '',
            });
            setLeaderSearch(initialData.leader);
            const initialLeader = leaders.find(l => l.email === initialData.leader_contact);
            setSelectedLeader(initialLeader || null);
            setSkills(initialData.skills_required || []);
            setIsActive(initialData.status === 'Ativo');

            const newMeetingDaysState = { ...meetingDayKeys };
            if (Array.isArray(initialData.meeting_days)) {
                initialData.meeting_days.forEach(day => {
                    if (day === 'domingo_manha' || day === 'domingo_noite') {
                        newMeetingDaysState.domingo = true;
                    } else if (day in newMeetingDaysState) {
                        newMeetingDaysState[day as keyof typeof newMeetingDaysState] = true;
                    }
                });
            }
            setMeetingDays(newMeetingDaysState);
        } else {
            setFormData({ name: '', description: '', leader: '', leader_contact: '' });
            setLeaderSearch('');
            setSelectedLeader(null);
            setSkills([]);
            setMeetingDays(meetingDayKeys);
            setIsActive(true);
        }
    }, [initialData, leaders]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleLeaderSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value;
        setLeaderSearch(query);
        setIsLeaderDropdownOpen(true);
        setSelectedLeader(null);
        setFormData(prev => ({...prev, leader: '', leader_contact: ''}));
    };
    
    const handleClearLeader = () => {
        setFormData(prev => ({ ...prev, leader: '', leader_contact: '' }));
        setLeaderSearch('');
        setSelectedLeader(null);
        setLeaderConflictError(null);
    };

    const handleLeaderSelect = (leader: User) => {
        const leaderName = leader.user_metadata?.name || '';
        const leaderEmail = leader.email || '';

        const conflictingDepartment = allDepartments.find(
            dept => dept.leader_contact === leaderEmail && dept.id !== initialData?.id
        );
        
        if (conflictingDepartment) {
            setLeaderConflictError(`Este líder já está atribuído ao departamento "${conflictingDepartment.name}".`);
        } else {
            setLeaderConflictError(null);
        }

        setSelectedLeader(leader);
        setFormData(prev => ({ ...prev, leader: leaderName, leader_contact: leaderEmail }));
        setIsLeaderDropdownOpen(false);
    };

    const filteredLeaders = useMemo(() => {
        if (!leaderSearch || selectedLeader) {
            return [];
        }
        const query = leaderSearch.toLowerCase();
        return leaders.filter(leader =>
            (leader.user_metadata?.name?.toLowerCase().includes(query)) ||
            (leader.email?.toLowerCase().includes(query))
        );
    }, [leaderSearch, leaders, selectedLeader]);
    
    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = e.target;
        setMeetingDays(prev => ({...prev, [name]: checked}));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (leaderConflictError) {
            alert(leaderConflictError);
            return;
        }
        
        if (formData.leader && !selectedLeader) {
            alert('Você digitou o nome de um líder, mas não o selecionou da lista. Por favor, busque e selecione um usuário válido para poder salvar.');
            return;
        }

        if (!formData.name) {
            alert('Por favor, preencha o Nome do Departamento.');
            return;
        }

        const selectedMeetingDays = Object.entries(meetingDays)
            .filter(([, isSelected]) => isSelected)
            .map(([day]) => day);

        const departmentData: Omit<Department, 'created_at'> = {
            id: initialData?.id,
            name: formData.name,
            description: formData.description,
            leader: formData.leader,
            leader_contact: formData.leader_contact,
            skills_required: skills,
            meeting_days: selectedMeetingDays,
            status: isActive ? 'Ativo' : 'Inativo',
        };
        
        // Pass the leader's ID along with the department data to be handled by the parent.
        onSave(departmentData, selectedLeader?.id);
    };

    return (
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
             <style>{`
                input[type="checkbox"]:checked {
                    background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e");
                }
            `}</style>
            <div className="flex items-center space-x-3 mb-8">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 4h5m-5 4h5m-5-8h5" />
                </svg>
                <h2 className="text-2xl font-bold text-slate-800">{isEditing ? 'Editar Departamento' : 'Novo Departamento'}</h2>
            </div>
            <form className="space-y-6" onSubmit={handleSubmit}>
                <InputField label="Nome do Departamento" type="text" name="name" value={formData.name} onChange={handleInputChange} required />
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
                    <textarea 
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        rows={3}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                </div>
                 <div>
                    <label htmlFor="leader_search" className="block text-sm font-medium text-slate-700 mb-1">
                        Líder do Departamento <span className="text-red-500">*</span>
                    </label>
                    
                    {selectedLeader ? (
                        <div className="flex items-center justify-between p-2 bg-white border border-slate-300 rounded-lg shadow-sm">
                            <div className="flex items-center space-x-2 overflow-hidden">
                                <div className="w-8 h-8 rounded-full bg-blue-500 flex-shrink-0 flex items-center justify-center text-white font-bold text-xs">
                                    {getInitials(formData.leader)}
                                </div>
                                <div className="overflow-hidden">
                                    <p className="font-semibold text-slate-800 text-sm truncate" title={formData.leader}>{formData.leader}</p>
                                    <p className="text-xs text-slate-500 truncate" title={formData.leader_contact}>{formData.leader_contact}</p>
                                </div>
                            </div>
                            <button 
                                type="button" 
                                onClick={handleClearLeader} 
                                className="ml-2 p-1 text-slate-400 hover:text-red-600 flex-shrink-0"
                                aria-label="Remover líder"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                    ) : (
                        <div className="relative">
                            <input
                                type="text"
                                id="leader_search"
                                value={leaderSearch}
                                onChange={handleLeaderSearchChange}
                                onFocus={() => setIsLeaderDropdownOpen(true)}
                                onBlur={() => setTimeout(() => setIsLeaderDropdownOpen(false), 200)}
                                placeholder="Buscar por nome ou e-mail do líder..."
                                required={!formData.leader}
                                autoComplete="off"
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-slate-900"
                            />
                            {isLeaderDropdownOpen && filteredLeaders.length > 0 && (
                                <ul className="absolute z-10 w-full bg-white border border-slate-300 rounded-lg shadow-lg mt-1 max-h-60 overflow-auto">
                                    {filteredLeaders.map(leader => {
                                        const name = leader.user_metadata?.name || 'Nome desconhecido';
                                        const email = leader.email || 'Email desconhecido';
                                        const initials = getInitials(name);

                                        return (
                                            <li key={leader.id} onMouseDown={() => handleLeaderSelect(leader)} className="px-3 py-2 hover:bg-slate-100 cursor-pointer flex items-center space-x-3">
                                                <div className="w-8 h-8 rounded-full bg-blue-500 flex-shrink-0 flex items-center justify-center text-white font-bold text-xs">
                                                    {initials}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-slate-800 text-sm">{name}</p>
                                                    <p className="text-xs text-slate-500">{email}</p>
                                                </div>
                                            </li>
                                        )
                                    })}
                                </ul>
                            )}
                        </div>
                    )}
                     {leaderConflictError && (
                        <p className="text-sm text-red-600 mt-1">{leaderConflictError}</p>
                    )}
                </div>

                <TagInputField label="Habilidades Necessárias" placeholder="Ex: Comunicação, Ensino..." tags={skills} setTags={setSkills} color="blue" />

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Dias de Reunião</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <CheckboxField label="Domingo" name="domingo" checked={meetingDays.domingo} onChange={handleCheckboxChange} />
                        <CheckboxField label="Segunda" name="segunda" checked={meetingDays.segunda} onChange={handleCheckboxChange} />
                        <CheckboxField label="Terça" name="terca" checked={meetingDays.terca} onChange={handleCheckboxChange} />
                        <CheckboxField label="Quarta" name="quarta" checked={meetingDays.quarta} onChange={handleCheckboxChange} />
                        <CheckboxField label="Quinta" name="quinta" checked={meetingDays.quinta} onChange={handleCheckboxChange} />
                        <CheckboxField label="Sexta" name="sexta" checked={meetingDays.sexta} onChange={handleCheckboxChange} />
                        <CheckboxField label="Sábado" name="sabado" checked={meetingDays.sabado} onChange={handleCheckboxChange} />
                    </div>
                </div>

                <CheckboxField label="Departamento ativo" name="ativo" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                
                <div className="pt-6 border-t border-slate-200 flex flex-wrap justify-end items-center gap-3">
                    {saveError && <p className="text-sm text-red-500 mr-auto">{saveError}</p>}
                    <button type="button" onClick={onCancel} disabled={isSaving} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50">Cancelar</button>
                    <button type="submit" disabled={isSaving || !!leaderConflictError} className="px-4 py-2 bg-teal-500 text-white font-semibold rounded-lg hover:bg-teal-600 flex items-center space-x-2 disabled:bg-teal-300 disabled:cursor-not-allowed">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                           <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V4zm2 0v12h6V4H7zm3 1a.5.5 0 00-.5.5v2.5a.5.5 0 001 0V6a.5.5 0 00-.5-.5z" clipRule="evenodd" />
                        </svg>
                        <span>{isSaving ? 'Salvando...' : 'Salvar Departamento'}</span>
                    </button>
                </div>
            </form>
        </div>
    );
};

export default NewDepartmentForm;
