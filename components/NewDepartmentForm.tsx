
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Event, Department, TimelineTemplate } from '../types';
import { supabase } from '../lib/supabaseClient';
import ConfirmationModal from './ConfirmationModal';
import CustomDatePicker from './CustomDatePicker';
import CustomTimePicker from './CustomTimePicker';
import SmartSearch, { type SearchItem } from './SmartSearch';
import { convertUTCToLocal, getErrorMessage } from '../lib/utils';

interface NewEventFormProps {
    initialData?: Event | null;
    onCancel: () => void;
    onSave: (event: any) => void;
    isSaving: boolean;
    saveError: string | null;
    userRole: string | null;
    leaderDepartmentId: number | null;
    allDepartments: Department[];
}

type VolunteerOption = { id: number; name: string; email: string; initials: string; departments: string[]; status?: string };
type ProcessedVolunteerOption = VolunteerOption & { isScheduledElsewhere: boolean };

interface VolunteerItemProps {
    volunteer: ProcessedVolunteerOption;
    onAction: () => void;
    actionType: 'add' | 'remove';
}

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

const colorOptions = [
    { name: 'Azul', value: '#3b82f6', bg: 'bg-blue-500' },
    { name: 'Verde', value: '#22c55e', bg: 'bg-green-500' },
    { name: 'Branco', value: '#E2E8F0', bg: 'bg-white' },
    { name: 'Vermelho', value: '#ef4444', bg: 'bg-red-500' },
];

const VolunteerItem: React.FC<VolunteerItemProps> = ({ volunteer, onAction, actionType }) => {
    const isInactive = volunteer.status === 'Inativo';

    if (actionType === 'remove') {
        return (
            <div className={`p-2 rounded-lg flex items-center justify-between bg-white border border-slate-200 shadow-sm ${isInactive ? 'opacity-75 bg-red-50 border-red-100' : ''}`}>
                <div className="flex items-center space-x-3 overflow-hidden">
                    <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-sm ${isInactive ? 'bg-slate-400' : 'bg-blue-600'}`}>
                        {volunteer.initials}
                    </div>
                    <div className="flex flex-col min-w-0">
                        <p className="font-semibold text-slate-800 text-sm truncate">{volunteer.name}</p>
                        {isInactive && <span className="text-xs font-bold text-red-600">Inativo</span>}
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onAction}
                    className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full transition-colors text-red-600 bg-red-100 hover:bg-red-200"
                    aria-label={`Remover ${volunteer.name}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} ><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        );
    }
    
    const isAlreadyScheduled = volunteer.isScheduledElsewhere;
    const isDisabled = isAlreadyScheduled || isInactive;

    return (
        <div className={`p-2 rounded-lg flex items-center justify-between transition-colors ${isDisabled ? 'bg-slate-100' : 'bg-white hover:bg-slate-50'} border border-slate-200`}>
            <div className="flex items-center space-x-3 overflow-hidden">
                <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-xs ${isDisabled ? 'bg-slate-400 opacity-50' : 'bg-blue-500'}`}>
                    {volunteer.initials}
                </div>
                <div className="flex-1 overflow-hidden">
                    <div className="flex items-center gap-2">
                        <p className={`font-semibold text-slate-800 text-sm truncate ${isDisabled ? 'text-slate-500' : ''}`}>{volunteer.name}</p>
                        {isInactive && <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded-full uppercase tracking-wide">Inativo</span>}
                    </div>
                    <div className="flex items-center text-xs space-x-2">
                        <p className="text-slate-500 truncate" title={(volunteer.departments || []).join(', ')}>
                            {(volunteer.departments || []).join(', ')}
                        </p>
                        {isAlreadyScheduled && (
                            <span className="font-semibold text-orange-600 flex-shrink-0">Já escalado</span>
                        )}
                    </div>
                </div>
            </div>
            <button
                type="button"
                onClick={onAction}
                disabled={isDisabled}
                className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full transition-colors text-green-600 bg-green-100 hover:bg-green-200 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
                aria-label={`Adicionar ${volunteer.name}`}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} ><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            </button>
        </div>
    );
};


const NewEventForm: React.FC<NewEventFormProps> = ({ initialData, onCancel, onSave, isSaving, saveError: initialSaveError, userRole, leaderDepartmentId, allDepartments }) => {
    const [formData, setFormData] = useState({ name: '', date: '', start_time: '', end_time: '', local: '', status: 'Pendente', observations: '', color: '', cronograma_principal_id: '', cronograma_kids_id: '' });
    const [selectedVolunteers, setSelectedVolunteers] = useState<ProcessedVolunteerOption[]>([]);
    const [allVolunteers, setAllVolunteers] = useState<ProcessedVolunteerOption[]>([]);
    const [volunteerSearch, setVolunteerSearch] = useState('');
    const [isStatusChangeModalOpen, setIsStatusChangeModalOpen] = useState(false);
    const [pendingStatus, setPendingStatus] = useState<string | null>(null);
    const [isCustomStatusDropdownOpen, setIsCustomStatusDropdownOpen] = useState(false);
    const statusDropdownRef = useRef<HTMLDivElement>(null);
    const [selectedDepartments, setSelectedDepartments] = useState<Department[]>([]);
    const [saveError, setSaveError] = useState<string | null>(initialSaveError);
    // FIX: The state for timeline templates only needs `id` and `nome_modelo` for the dropdown.
    // The type has been adjusted to match the data fetched from Supabase, resolving the type error.
    const [timelineTemplates, setTimelineTemplates] = useState<{ id?: string, nome_modelo: string }[]>([]);


    const isEditing = !!initialData;
    const isSchedulingMode = isEditing && (userRole === 'leader' || userRole === 'lider' || userRole === 'líder');
    const isAdminMode = userRole === 'admin';

    const { dateTime: eventStartDateTime } = useMemo(() => {
        if (!initialData) return { dateTime: null };
        return convertUTCToLocal(initialData.date, initialData.start_time);
    }, [initialData]);

    const hasEventStarted = useMemo(() => {
        if (!eventStartDateTime) return false;
        return new Date() > eventStartDateTime;
    }, [eventStartDateTime]);
    
    const isDepartmentInvolved = isSchedulingMode && initialData && leaderDepartmentId 
        ? (initialData.event_departments || []).some(ed => ed.department_id === leaderDepartmentId)
        : false;
    
    const isSchedulingAllowed = isSchedulingMode && formData.status === 'Confirmado' && isDepartmentInvolved && !hasEventStarted;
    
    useEffect(() => {
        const fetchTimelineTemplates = async () => {
            if (isAdminMode) {
                const { data, error } = await supabase
                    .from('cronograma_modelos')
                    .select('id, nome_modelo')
                    .order('nome_modelo');
                if (error) {
                    console.error("Failed to fetch timeline templates:", getErrorMessage(error));
                } else {
                    setTimelineTemplates(data || []);
                }
            }
        };
        fetchTimelineTemplates();
    }, [isAdminMode]);

    useEffect(() => {
        setSaveError(initialSaveError);
    }, [initialSaveError]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
                setIsCustomStatusDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            if (!isSchedulingAllowed || !leaderDepartmentId) {
                setAllVolunteers([]);
                return;
            };

            const { data: dept } = await supabase.from('departments').select('name').eq('id', leaderDepartmentId).single();
            if (!dept) return;
            
            const { data: vols, error: vError } = await supabase
                .from('volunteer_departments')
                .select('volunteers(id, name, email, initials, status)')
                .eq('department_id', leaderDepartmentId);

            if (vError) {
                console.error("Error fetching volunteers for leader", vError);
                return;
            }
            const activeVolunteers = (vols || []).map(v => v.volunteers).filter(Boolean);

            const scheduledElsewhereIds = new Set(
                (initialData?.event_volunteers || [])
                    .filter(ev => ev.department_id !== leaderDepartmentId)
                    .map(ev => ev.volunteer_id)
            );

            const processedVols = (activeVolunteers as any[] || []).map(vol => ({
                ...vol,
                departments: [dept.name], // Simplified for this context
                isScheduledElsewhere: scheduledElsewhereIds.has(vol.id)
            }));
            
            setAllVolunteers(processedVols);
        };
        fetchData();
    }, [isSchedulingAllowed, initialData, leaderDepartmentId]);

    useEffect(() => {
        if (initialData) {
            const { dateTime: localStart } = convertUTCToLocal(initialData.date, initialData.start_time);
            const { dateTime: localEnd } = convertUTCToLocal(initialData.date, initialData.end_time);
    
            let localDate = initialData.date;
            let localStartTime = initialData.start_time;
            let localEndTime = initialData.end_time;
    
            if (localStart && localEnd) {
                // toISOString().split('T')[0] can be off by a day due to timezone.
                // A more reliable way to get YYYY-MM-DD in local time.
                const year = localStart.getFullYear();
                const month = String(localStart.getMonth() + 1).padStart(2, '0');
                const day = String(localStart.getDate()).padStart(2, '0');
                localDate = `${year}-${month}-${day}`;
                
                localStartTime = localStart.toTimeString().substring(0, 5);
                localEndTime = localEnd.toTimeString().substring(0, 5);
            }
    
            setFormData({
                name: initialData.name,
                date: localDate,
                start_time: localStartTime,
                end_time: localEndTime,
                local: initialData.local || '',
                status: initialData.status,
                observations: initialData.observations || '',
                color: initialData.color || '',
                cronograma_principal_id: initialData.cronograma_principal_id || '',
                cronograma_kids_id: initialData.cronograma_kids_id || '',
            });

            if (isSchedulingMode && leaderDepartmentId) {
                const scheduledElsewhereIds = new Set(
                    (initialData.event_volunteers || [])
                        .filter(ev => ev.department_id !== leaderDepartmentId)
                        .map(ev => ev.volunteer_id)
                );
                const volunteersFromData = (initialData.event_volunteers || [])
                    .filter(sv => sv.department_id === leaderDepartmentId)
                    .map(sv => sv.volunteers)
                    .filter((v): v is { id: number; name: string; email: string; initials: string; departments: string[]; status?: string } => v !== undefined && v !== null);
                
                setSelectedVolunteers(volunteersFromData.map(v => ({
                    ...v,
                    departments: v.departments || [],
                    isScheduledElsewhere: scheduledElsewhereIds.has(v.id)
                })));
            } else {
                setSelectedVolunteers([]);
            }

            if (isAdminMode && allDepartments) {
                const initialSelectedDepts = (initialData.event_departments || [])
                    .map(ed => allDepartments.find(d => d.id === ed.department_id))
                    .filter((d): d is Department => d !== undefined);
                setSelectedDepartments(initialSelectedDepts);
            }
        } else {
            setFormData({ name: '', date: '', start_time: '', end_time: '', local: '', status: 'Pendente', observations: '', color: '', cronograma_principal_id: '', cronograma_kids_id: '' });
            setSelectedVolunteers([]);
            setSelectedDepartments([]);
        }
    }, [initialData, isSchedulingMode, leaderDepartmentId, isAdminMode, allDepartments]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleTimeChange = (name: 'start_time' | 'end_time', value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleStatusSelect = (value: string) => {
        if (isEditing && value === 'Confirmado' && formData.status !== 'Confirmado') {
            setPendingStatus(value);
            setIsStatusChangeModalOpen(true);
        } else {
            setFormData(prev => ({ ...prev, status: value }));
        }
        setIsCustomStatusDropdownOpen(false);
    };

    const handleDateChange = (dateString: string) => {
        setFormData(prev => ({ ...prev, date: dateString }));
    };

    const handleColorChange = (colorValue: string) => {
        setFormData(prev => ({ ...prev, color: prev.color === colorValue ? '' : colorValue }));
    };
    
    const handleConfirmStatusChange = () => {
        if (pendingStatus) {
            setFormData(prev => ({ ...prev, status: pendingStatus }));
        }
        setIsStatusChangeModalOpen(false);
        setPendingStatus(null);
    };

    const handleCancelStatusChange = () => {
        setIsStatusChangeModalOpen(false);
        setPendingStatus(null);
    };

    const handleSelectDepartment = (item: SearchItem) => {
        const department = allDepartments.find(d => d.id === item.id);
        if (department && !selectedDepartments.some(d => d.id === department.id)) {
            setSelectedDepartments([...selectedDepartments, department]);
        }
    };

    const handleAddAllDepartments = () => {
        setSelectedDepartments(allDepartments);
    };

    const handleRemoveDepartment = (departmentId: number | string) => {
        setSelectedDepartments(selectedDepartments.filter(d => d.id !== departmentId));
    };

    const addVolunteer = (volunteer: ProcessedVolunteerOption) => {
        if (!selectedVolunteers.some(v => v.id === volunteer.id)) {
            setSelectedVolunteers([...selectedVolunteers, volunteer]);
        }
        setVolunteerSearch('');
    };
    const removeVolunteer = (volunteerId: number) => {
        setSelectedVolunteers(selectedVolunteers.filter(v => v.id !== volunteerId));
    };

    const unselectedVolunteers = useMemo(() => {
        const selectedIds = new Set(selectedVolunteers.map(v => v.id));
        return allVolunteers.filter(v => !selectedIds.has(v.id));
    }, [allVolunteers, selectedVolunteers]);

    const filteredAvailableVolunteers = useMemo(() => {
        if (!volunteerSearch) return unselectedVolunteers;
        const query = volunteerSearch.toLowerCase();
        return unselectedVolunteers.filter(v =>
            v.name.toLowerCase().includes(query) ||
            (v.email && v.email.toLowerCase().includes(query))
        );
    }, [volunteerSearch, unselectedVolunteers]);


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSaveError(null);
        
        if (!formData.name || !formData.date || !formData.start_time || !formData.end_time) {
            setSaveError('Por favor, preencha todos os campos obrigatórios (Título, Data, Início, Fim).');
            return;
        }
    
        const payload: any = { 
            ...formData,
            cronograma_principal_id: formData.cronograma_principal_id || null,
            cronograma_kids_id: formData.cronograma_kids_id || null,
        };

        if (isEditing) {
            payload.id = initialData?.id;
        }

        if (isSchedulingMode) {
            payload.volunteer_ids = selectedVolunteers.map(v => v.id);
            payload.scheduling_department_id = leaderDepartmentId;
        }

        if (isAdminMode) {
            payload.department_ids = selectedDepartments.map(d => d.id);
        }
        onSave(payload);
    };

    let title = isEditing ? "Editar Evento" : "Novo Evento";
    if (isSchedulingMode) title = `Escalar Voluntários - ${initialData?.name}`;
    
    const statusOptionsForForm = [
        { value: 'Pendente', label: 'Pendente' },
        { value: 'Confirmado', label: 'Confirmado' },
        { value: 'Cancelado', label: 'Cancelado' },
    ];
    const selectedStatusLabel = statusOptionsForForm.find(o => o.value === formData.status)?.label;

    return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold text-slate-800 mb-4">{title}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
            {isSchedulingMode ? (
                 <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2 text-sm text-slate-700">
                    <p><strong>Data:</strong> {new Date(formData.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                    <p><strong>Horário:</strong> {formData.start_time.substring(0,5)} - {formData.end_time.substring(0,5)}</p>
                    {formData.local && <p><strong>Local:</strong> {formData.local}</p>}
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Título do Evento *</label>
                            <input type="text" name="name" value={formData.name} onChange={handleInputChange} required className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                            <div className="relative" ref={statusDropdownRef}>
                                <button
                                    type="button"
                                    onClick={() => isAdminMode && setIsCustomStatusDropdownOpen(prev => !prev)}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg flex justify-between items-center cursor-pointer text-left disabled:bg-slate-100 disabled:cursor-not-allowed"
                                    aria-haspopup="listbox"
                                    aria-expanded={isCustomStatusDropdownOpen}
                                    disabled={!isAdminMode}
                                >
                                    <span className="text-slate-900">{selectedStatusLabel}</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-slate-400 transition-transform ${isCustomStatusDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                                </button>
                                {isCustomStatusDropdownOpen && isAdminMode && (
                                    <div className="absolute z-20 w-full top-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg">
                                        <ul className="py-1" role="listbox">
                                            {statusOptionsForForm.map(option => (
                                                <li
                                                    key={option.value}
                                                    onClick={() => handleStatusSelect(option.value)}
                                                    className={`px-4 py-2 hover:bg-slate-100 cursor-pointer text-sm ${formData.status === option.value ? 'font-semibold text-blue-600' : 'text-slate-700'}`}
                                                    role="option"
                                                    aria-selected={formData.status === option.value}
                                                >
                                                    {option.label}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Data *</label>
                            <CustomDatePicker name="date" value={formData.date} onChange={handleDateChange} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Início *</label>
                            <CustomTimePicker 
                                value={formData.start_time}
                                onChange={(time) => handleTimeChange('start_time', time)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Fim *</label>
                            <CustomTimePicker 
                                value={formData.end_time}
                                onChange={(time) => handleTimeChange('end_time', time)}
                            />
                        </div>
                    </div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Local</label><input type="text" name="local" value={formData.local} onChange={handleInputChange} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg" /></div>
                    {isAdminMode && (
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-sm font-medium text-slate-700">Departamentos Envolvidos</label>
                                <button
                                    type="button"
                                    onClick={handleAddAllDepartments}
                                    className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                                >
                                    Adicionar Todos
                                </button>
                            </div>
                            <SmartSearch
                                items={allDepartments.filter(d => d.id != null) as SearchItem[]}
                                selectedItems={selectedDepartments.filter(d => d.id != null) as SearchItem[]}
                                onSelectItem={handleSelectDepartment}
                                placeholder="Buscar e adicionar departamentos..."
                            />
                            <div className="mt-2 flex flex-wrap gap-2 min-h-[40px]">
                                {selectedDepartments.map(department => (
                                    <RemovableTag 
                                        key={department.id}
                                        text={department.name}
                                        color="yellow"
                                        onRemove={() => handleRemoveDepartment(department.id!)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                    {isAdminMode && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Cor do Evento</label>
                            <div className="flex items-center space-x-3">
                                {colorOptions.map(option => {
                                    const isSelected = formData.color === option.value;
                                    const isWhite = option.name === 'Branco';

                                    return (
                                        <button
                                            type="button"
                                            key={option.value}
                                            onClick={() => handleColorChange(option.value)}
                                            className={`w-8 h-8 rounded-full ${option.bg} transition-all duration-150 transform hover:scale-110 focus:outline-none border-2 ${
                                                isSelected ? 'border-blue-600' : (isWhite ? 'border-slate-300' : 'border-transparent')
                                            }`}
                                            aria-label={option.name}
                                        >
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Observações</label><textarea name="observations" value={formData.observations} onChange={handleInputChange} rows={3} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"></textarea></div>
                
                    {isAdminMode && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Cronograma Principal</label>
                                <select name="cronograma_principal_id" value={formData.cronograma_principal_id || ''} onChange={handleInputChange} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-sm">
                                    <option value="">Nenhum</option>
                                    {timelineTemplates.map(template => (
                                        <option key={template.id} value={template.id}>{template.nome_modelo}</option>
                                    ))}
                                </select>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Cronograma Kids</label>
                                <select name="cronograma_kids_id" value={formData.cronograma_kids_id || ''} onChange={handleInputChange} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-sm">
                                    <option value="">Nenhum</option>
                                    {timelineTemplates.map(template => (
                                        <option key={template.id} value={template.id}>{template.nome_modelo}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}
                </>
            )}

            {isSchedulingMode && !isSchedulingAllowed && (
                 <div className="pt-4 border-t border-slate-200">
                    <div className="text-center bg-yellow-50 text-yellow-800 p-4 rounded-lg border border-yellow-200">
                        <p className="font-semibold">A escala de voluntários não está disponível.</p>
                        <p className="text-sm mt-1">
                            {formData.status !== 'Confirmado' && 'Este evento ainda está pendente de confirmação. A escala só pode ser feita após a confirmação pelo administrador.'}
                            {!isDepartmentInvolved && 'Seu departamento não foi adicionado a este evento ainda.'}
                            {hasEventStarted && 'Este evento já começou ou terminou e não pode mais ser alterado.'}
                        </p>
                    </div>
                 </div>
            )}

            {isSchedulingAllowed && (
                <div className="pt-4 border-t border-slate-200">
                    {allVolunteers.length > 0 ? (
                        <div className="space-y-4">
                            <input
                                type="text"
                                placeholder="Buscar voluntários disponíveis..."
                                value={volunteerSearch}
                                onChange={(e) => setVolunteerSearch(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                            />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-slate-50 rounded-lg p-3 flex flex-col h-72">
                                   <h4 className="font-semibold text-slate-800 mb-2 text-center pb-2 border-b border-slate-200">
                                        Disponíveis ({filteredAvailableVolunteers.length})
                                    </h4>
                                    <div className="overflow-y-auto space-y-2 flex-grow pr-1">
                                        {filteredAvailableVolunteers.length > 0 ? filteredAvailableVolunteers.map(v => (
                                            <VolunteerItem key={v.id} volunteer={v} onAction={() => addVolunteer(v)} actionType="add" />
                                        )) : <p className="text-sm text-slate-500 text-center pt-4">Nenhum voluntário encontrado.</p>}
                                    </div>
                                </div>
                                <div className="bg-slate-50 rounded-lg p-3 flex flex-col h-72">
                                    <h4 className="font-semibold text-slate-800 mb-2 text-center pb-2 border-b border-slate-200">
                                        Selecionados ({selectedVolunteers.length})
                                    </h4>
                                    <div className="overflow-y-auto space-y-2 flex-grow pr-1">
                                        {selectedVolunteers.length > 0 ? [...selectedVolunteers].sort((a, b) => a.name.localeCompare(b.name)).map(v => (
                                            <VolunteerItem key={v.id} volunteer={v} onAction={() => removeVolunteer(v.id)} actionType="remove" />
                                        )) : <p className="text-sm text-slate-500 text-center pt-4">Nenhum voluntário selecionado.</p>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-slate-500 bg-slate-50 p-3 rounded-lg">Não há voluntários ativos neste departamento para escalar.</p>
                    )}
                </div>
            )}


            <div className="pt-4 border-t border-slate-200 mt-4 flex justify-end items-center gap-3">
                {saveError && <p className="text-sm text-red-500 mr-auto">{saveError}</p>}
                <button type="button" onClick={onCancel} className="px-4 py-2 bg-white border border-slate-300 font-semibold rounded-lg">Cancelar</button>
                <button 
                    type="submit" 
                    disabled={isSaving || (isSchedulingMode && !isSchedulingAllowed)} 
                    className="px-4 py-2 bg-green-500 text-white font-semibold rounded-lg disabled:bg-green-300 disabled:cursor-not-allowed"
                >
                    {isSaving ? 'Salvando...' : `Salvar ${isSchedulingMode ? 'Escala' : 'Evento'}`}
                </button>
            </div>
        </form>

        <ConfirmationModal
            isOpen={isStatusChangeModalOpen}
            onClose={handleCancelStatusChange}
            onConfirm={handleConfirmStatusChange}
            title="Confirmar Alteração de Status"
            message='Tem certeza que deseja alterar o status do evento para "Confirmado"? Esta ação pode afetar a escalação de voluntários.'
        />
    </div>
    );
};

export default NewEventForm;
