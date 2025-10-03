
import React, { useState, useEffect, useMemo } from 'react';
import { Event } from '../types';
import { SupabaseClient } from '@supabase/supabase-js';

interface NewEventFormProps {
    supabase: SupabaseClient | null;
    initialData?: Event | null;
    onCancel: () => void;
    onSave: (event: any) => void;
    isSaving: boolean;
    saveError: string | null;
    userRole: string | null;
    leaderDepartmentId: number | null;
}

type VolunteerOption = { id: number; name: string; email: string; initials: string; departments: string[] };
type ProcessedVolunteerOption = VolunteerOption & { isScheduledElsewhere: boolean };

interface VolunteerItemProps {
    volunteer: ProcessedVolunteerOption;
    onAction: () => void;
    actionType: 'add' | 'remove';
}

const VolunteerItem: React.FC<VolunteerItemProps> = ({ volunteer, onAction, actionType }) => {
    if (actionType === 'remove') {
        return (
            <div className="p-2 rounded-lg flex items-center justify-between bg-white border border-slate-200 shadow-sm">
                <div className="flex items-center space-x-3 overflow-hidden">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex-shrink-0 flex items-center justify-center text-white font-bold text-sm">
                        {volunteer.initials}
                    </div>
                    <p className="font-semibold text-slate-800 text-sm truncate">{volunteer.name}</p>
                </div>
                <button
                    type="button"
                    onClick={onAction}
                    className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full transition-colors text-red-600 bg-red-100 hover:bg-red-200"
                    aria-label={`Remover ${volunteer.name}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                </button>
            </div>
        );
    }
    
    const isAlreadyScheduled = volunteer.isScheduledElsewhere;

    return (
        <div className={`p-2 rounded-lg flex items-center justify-between transition-colors ${isAlreadyScheduled ? 'bg-slate-100' : 'bg-white hover:bg-slate-50'} border border-slate-200`}>
            <div className="flex items-center space-x-3 overflow-hidden">
                <div className={`w-8 h-8 rounded-full bg-blue-500 flex-shrink-0 flex items-center justify-center text-white font-bold text-xs ${isAlreadyScheduled ? 'opacity-50' : ''}`}>
                    {volunteer.initials}
                </div>
                <div className="flex-1 overflow-hidden">
                    <p className={`font-semibold text-slate-800 text-sm truncate ${isAlreadyScheduled ? 'text-slate-500' : ''}`}>{volunteer.name}</p>
                    <div className="flex items-center text-xs space-x-2">
                        <p className="text-slate-500 truncate" title={volunteer.departments?.join(', ')}>
                            {volunteer.departments?.join(', ')}
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
                disabled={isAlreadyScheduled}
                className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full transition-colors text-green-600 bg-green-100 hover:bg-green-200 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
                aria-label={`Adicionar ${volunteer.name}`}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
            </button>
        </div>
    );
};


const NewEventForm: React.FC<NewEventFormProps> = ({ supabase, initialData, onCancel, onSave, isSaving, saveError, userRole, leaderDepartmentId }) => {
    const [formData, setFormData] = useState({ name: '', date: '', start_time: '', end_time: '', local: '', status: 'Pendente', observations: '' });
    const [selectedVolunteers, setSelectedVolunteers] = useState<ProcessedVolunteerOption[]>([]);
    const [allVolunteers, setAllVolunteers] = useState<ProcessedVolunteerOption[]>([]);
    const [volunteerSearch, setVolunteerSearch] = useState('');
    const [leaderDepartmentName, setLeaderDepartmentName] = useState('');
    
    const isEditing = !!initialData;
    const isSchedulingMode = isEditing && (userRole === 'leader' || userRole === 'lider' || userRole === 'líder');
    const isSchedulingAllowed = isSchedulingMode && formData.status === 'Confirmado';
    const isAdminMode = userRole === 'admin';

    useEffect(() => {
        const fetchData = async () => {
            if (!supabase || !isSchedulingMode || !initialData || !leaderDepartmentId) return;

            const { data: leaderDept, error: ldError } = await supabase.from('departments').select('name').eq('id', leaderDepartmentId).single();
            if (ldError) {
                console.error("Error fetching leader's department name", ldError);
                return;
            }
            
            setLeaderDepartmentName(leaderDept.name);
            
            const { data: vols, error: vError } = await supabase.from('volunteers').select('id, name, email, initials, departments:departaments').eq('status', 'Ativo').contains('departaments', [leaderDept.name]).order('name');
            if (vError) {
                console.error("Error fetching volunteers for leader", vError);
                return;
            }

            const scheduledElsewhereIds = new Set(
                initialData.event_volunteers
                    .filter(ev => ev.department_id !== leaderDepartmentId)
                    .map(ev => ev.volunteer_id)
            );

            const processedVols = (vols as VolunteerOption[] || []).map(vol => ({
                ...vol,
                departments: vol.departments || [],
                isScheduledElsewhere: scheduledElsewhereIds.has(vol.id)
            }));
            
            setAllVolunteers(processedVols);
        };
        fetchData();
    }, [supabase, isSchedulingMode, initialData, leaderDepartmentId]);

    useEffect(() => {
        if (initialData) {
            setFormData({ name: initialData.name, date: initialData.date, start_time: initialData.start_time, end_time: initialData.end_time, local: initialData.local || '', status: initialData.status, observations: initialData.observations || '' });
            if (initialData.event_volunteers && isSchedulingMode) {
                const scheduledElsewhereIds = new Set(
                    initialData.event_volunteers
                        .filter(ev => ev.department_id !== leaderDepartmentId)
                        .map(ev => ev.volunteer_id)
                );
                const volunteersFromData = initialData.event_volunteers
                    .filter(sv => sv.department_id === leaderDepartmentId)
                    .map(sv => sv.volunteers)
                    .filter((v): v is { id: number; name: string; email: string; initials: string; departments: string[]; } => v !== undefined && v !== null)
                    .map(v => ({
                        ...v,
                        departments: v.departments || [],
                        isScheduledElsewhere: scheduledElsewhereIds.has(v.id)
                    }));
                setSelectedVolunteers(volunteersFromData);
            } else {
                setSelectedVolunteers([]);
            }
        } else {
            setFormData({ name: '', date: '', start_time: '', end_time: '', local: '', status: 'Pendente', observations: '' });
            setSelectedVolunteers([]);
        }
    }, [initialData, isSchedulingMode, leaderDepartmentId]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
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
        const payload: any = { ...formData };
        if (isEditing) {
            payload.id = initialData?.id;
        }

        if (isSchedulingMode) {
            payload.volunteer_ids = selectedVolunteers.map(v => v.id);
        }
        onSave(payload);
    };

    let title = isEditing ? "Editar Evento" : "Novo Evento";
    if (isSchedulingMode) title = `Escalar Voluntários - ${initialData?.name}`;

    return (
    <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold text-slate-800 mb-6">{title}</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Título do Evento *</label>
                    <input type="text" name="name" value={formData.name} onChange={handleInputChange} required readOnly={isSchedulingMode} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg read-only:bg-slate-100 read-only:cursor-not-allowed" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                    <select name="status" value={formData.status} onChange={handleInputChange} disabled={!isAdminMode} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg disabled:bg-slate-100 disabled:cursor-not-allowed">
                        <option value="Pendente">Pendente</option>
                        <option value="Confirmado">Confirmado</option>
                        <option value="Cancelado">Cancelado</option>
                    </select>
                </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Data *</label><input type="date" name="date" value={formData.date} onChange={handleInputChange} required readOnly={isSchedulingMode} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg read-only:bg-slate-100 read-only:cursor-not-allowed" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Início *</label><input type="time" name="start_time" value={formData.start_time} onChange={handleInputChange} required readOnly={isSchedulingMode} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg read-only:bg-slate-100 read-only:cursor-not-allowed" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Fim *</label><input type="time" name="end_time" value={formData.end_time} onChange={handleInputChange} required readOnly={isSchedulingMode} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg read-only:bg-slate-100 read-only:cursor-not-allowed" /></div>
            </div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Local</label><input type="text" name="local" value={formData.local} onChange={handleInputChange} readOnly={isSchedulingMode} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg read-only:bg-slate-100 read-only:cursor-not-allowed" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Observações</label><textarea name="observations" value={formData.observations} onChange={handleInputChange} rows={3} readOnly={isSchedulingMode} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg read-only:bg-slate-100 read-only:cursor-not-allowed"></textarea></div>

            {isSchedulingMode && !isSchedulingAllowed && (
                 <div className="pt-5 border-t border-slate-200">
                    <div className="text-center bg-yellow-50 text-yellow-800 p-4 rounded-lg border border-yellow-200">
                        <p className="font-semibold">A escala de voluntários não está disponível.</p>
                        <p className="text-sm mt-1">
                            {formData.status === 'Pendente' && 'Este evento ainda está pendente de confirmação. A escala só pode ser feita após a confirmação pelo administrador.'}
                            {formData.status === 'Cancelado' && 'Este evento foi cancelado e não pode mais ter voluntários escalados.'}
                        </p>
                    </div>
                 </div>
            )}

            {isSchedulingAllowed && (
                <div className="pt-5 border-t border-slate-200">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Voluntários do Departamento "{leaderDepartmentName}"
                    </label>
                    {allVolunteers.length > 0 ? (
                        <div className="space-y-4">
                            <input
                                type="text"
                                placeholder="Buscar voluntários disponíveis..."
                                value={volunteerSearch}
                                onChange={(e) => setVolunteerSearch(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                            />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{maxHeight: '400px', overflow: 'hidden'}}>
                                <div className="bg-slate-50 rounded-lg p-3 flex flex-col">
                                   <h4 className="font-semibold text-slate-800 mb-2 text-center pb-2 border-b border-slate-200">
                                        Disponíveis ({filteredAvailableVolunteers.length})
                                    </h4>
                                    <div className="overflow-y-auto space-y-2 flex-grow pr-1">
                                        {filteredAvailableVolunteers.length > 0 ? filteredAvailableVolunteers.map(v => (
                                            <VolunteerItem key={v.id} volunteer={v} onAction={() => addVolunteer(v)} actionType="add" />
                                        )) : <p className="text-sm text-slate-500 text-center pt-4">Nenhum voluntário encontrado.</p>}
                                    </div>
                                </div>
                                <div className="bg-slate-50 rounded-lg p-3 flex flex-col">
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


            <div className="pt-5 border-t border-slate-200 mt-6 flex justify-end items-center gap-3">
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
    </div>
    );
};

export default NewEventForm;
