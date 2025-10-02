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

type VolunteerOption = { id: number; name: string; email: string; initials: string; };
type ProcessedVolunteerOption = VolunteerOption & { isScheduledElsewhere: boolean };

const NewEventForm: React.FC<NewEventFormProps> = ({ supabase, initialData, onCancel, onSave, isSaving, saveError, userRole, leaderDepartmentId }) => {
    const [formData, setFormData] = useState({ name: '', date: '', start_time: '', end_time: '', local: '', status: 'Pendente', observations: '' });
    const [selectedVolunteers, setSelectedVolunteers] = useState<VolunteerOption[]>([]);
    const [allVolunteers, setAllVolunteers] = useState<ProcessedVolunteerOption[]>([]);
    const [volunteerSearch, setVolunteerSearch] = useState('');
    const [leaderDepartmentName, setLeaderDepartmentName] = useState('');
    
    const isEditing = !!initialData;
    const isSchedulingMode = isEditing && (userRole === 'leader' || userRole === 'lider' || userRole === 'líder');
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
            
            const { data: vols, error: vError } = await supabase.from('volunteers').select('id, name, email, initials').eq('status', 'Ativo').contains('ministries', [leaderDept.name]).order('name');
            if (vError) {
                console.error("Error fetching volunteers for leader", vError);
                return;
            }

            const scheduledElsewhereIds = new Set(
                initialData.event_volunteers
                    .filter(ev => ev.department_id !== leaderDepartmentId)
                    .map(ev => ev.volunteer_id)
            );

            const processedVols = (vols || []).map(vol => ({
                ...vol,
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
                const volunteersFromData = initialData.event_volunteers
                    .filter(sv => sv.department_id === leaderDepartmentId)
                    .map(sv => sv.volunteers)
                    .filter((v): v is VolunteerOption => v !== undefined && v !== null);
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
    
    const addVolunteer = (volunteer: VolunteerOption) => {
        if (!selectedVolunteers.some(v => v.id === volunteer.id)) {
            setSelectedVolunteers([...selectedVolunteers, volunteer]);
        }
        setVolunteerSearch('');
    };
    const removeVolunteer = (volunteerId: number) => {
        setSelectedVolunteers(selectedVolunteers.filter(v => v.id !== volunteerId));
    };

    const filteredVolunteers = useMemo(() => {
        if (!volunteerSearch) return [];
        return allVolunteers.filter(v => 
            v.name.toLowerCase().includes(volunteerSearch.toLowerCase()) && 
            !selectedVolunteers.some(sv => sv.id === v.id)
        );
    }, [volunteerSearch, allVolunteers, selectedVolunteers]);

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
                    <select name="status" value={formData.status} onChange={handleInputChange} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg">
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

            {isSchedulingMode && (
                <div className="pt-5 border-t border-slate-200">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Voluntários do Departamento "{leaderDepartmentName}"
                    </label>
                    {allVolunteers.length > 0 ? (
                        <>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Buscar voluntários para adicionar..."
                                    value={volunteerSearch}
                                    onChange={(e) => setVolunteerSearch(e.target.value)}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                                />
                                {filteredVolunteers.length > 0 && (
                                    <ul className="absolute z-10 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-60 overflow-auto">
                                        {filteredVolunteers.map(v => (
                                            <li key={v.id} 
                                                onMouseDown={() => !v.isScheduledElsewhere && addVolunteer(v)} 
                                                className={`px-3 py-2 flex items-center space-x-3 ${v.isScheduledElsewhere ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-100'}`}
                                            >
                                                <div className="w-8 h-8 rounded-full bg-blue-500 flex-shrink-0 flex items-center justify-center text-white font-bold text-xs">{v.initials}</div>
                                                <div>
                                                    <p className="font-semibold text-slate-800 text-sm">{v.name}</p>
                                                    <p className="text-xs text-slate-500">{v.email}</p>
                                                </div>
                                                {v.isScheduledElsewhere && (
                                                    <span className="ml-auto text-xs font-semibold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
                                                        Já escalado
                                                    </span>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-2 mt-3">
                                {selectedVolunteers.length > 0 ? selectedVolunteers.map(v => (
                                    <div key={v.id} className="flex items-center gap-2 bg-blue-100 text-blue-800 text-sm font-medium pl-2 pr-1 py-1 rounded-full">
                                        <div className="w-5 h-5 rounded-full bg-blue-500 flex-shrink-0 flex items-center justify-center text-white font-bold text-xs">{v.initials}</div>
                                        <span>{v.name}</span>
                                        <button type="button" onClick={() => removeVolunteer(v.id)} className="text-blue-500 hover:text-blue-800 rounded-full hover:bg-black/10 p-0.5">
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                        </button>
                                    </div>
                                )) : <p className="text-sm text-slate-500 px-2">Nenhum voluntário selecionado.</p>}
                            </div>
                        </>
                    ) : (
                        <p className="text-sm text-slate-500 bg-slate-50 p-3 rounded-lg">Não há voluntários ativos neste departamento para escalar.</p>
                    )}
                </div>
            )}


            <div className="pt-5 border-t border-slate-200 mt-6 flex justify-end items-center gap-3">
                {saveError && <p className="text-sm text-red-500 mr-auto">{saveError}</p>}
                <button type="button" onClick={onCancel} className="px-4 py-2 bg-white border border-slate-300 font-semibold rounded-lg">Cancelar</button>
                <button type="submit" disabled={isSaving} className="px-4 py-2 bg-green-500 text-white font-semibold rounded-lg disabled:bg-green-300">
                    {isSaving ? 'Salvando...' : `Salvar ${isSchedulingMode ? 'Escala' : 'Evento'}`}
                </button>
            </div>
        </form>
    </div>
    );
};

export default NewEventForm;