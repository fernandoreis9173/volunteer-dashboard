import React, { useState, useEffect, useMemo } from 'react';
import { Schedule, ScheduleVolunteer } from '../types';
import { SupabaseClient } from '@supabase/supabase-js';

interface NewScheduleFormProps {
    supabase: SupabaseClient | null;
    initialData?: Schedule | null;
    onCancel: () => void;
    onSave: (schedule: any) => void;
    isSaving: boolean;
    saveError: string | null;
}

type VolunteerOption = { id: number; name: string; email: string; initials: string; };

const NewScheduleForm: React.FC<NewScheduleFormProps> = ({ supabase, initialData, onCancel, onSave, isSaving, saveError }) => {
    const [formData, setFormData] = useState({
        event_name: '',
        ministry_id: '',
        date: '',
        start_time: '',
        end_time: '',
        local: '',
        status: 'pendente',
        observations: '',
    });
    const [selectedVolunteers, setSelectedVolunteers] = useState<VolunteerOption[]>([]);
    const [allVolunteers, setAllVolunteers] = useState<VolunteerOption[]>([]);
    const [allMinistries, setAllMinistries] = useState<{ id: number; name: string; }[]>([]);
    const [volunteerSearch, setVolunteerSearch] = useState('');
    const isEditing = !!initialData;

    useEffect(() => {
        const fetchData = async () => {
            if (!supabase) return;
            const { data: volunteersData, error: vError } = await supabase.from('volunteers').select('id, name, email, initials').eq('status', 'Ativo').order('name');
            if (vError) console.error("Error fetching volunteers", vError);
            else setAllVolunteers(volunteersData || []);

            const { data: ministriesData, error: mError } = await supabase.from('ministries').select('id, name').eq('status', 'Ativo').order('name');
            if (mError) console.error("Error fetching ministries", mError);
            else setAllMinistries(ministriesData || []);
        };
        fetchData();

        if (initialData) {
            setFormData({
                event_name: initialData.event_name,
                ministry_id: String(initialData.ministry_id),
                date: initialData.date,
                start_time: initialData.start_time,
                end_time: initialData.end_time,
                local: initialData.local || '',
                status: initialData.status,
                observations: initialData.observations || '',
            });
            if (initialData.schedule_volunteers) {
                const volunteersFromData = initialData.schedule_volunteers
                    .map(sv => sv.volunteers)
                    .filter((v): v is VolunteerOption => v !== undefined);
                setSelectedVolunteers(volunteersFromData);
            }
        } else {
            // Reset for new schedule
             setFormData({
                event_name: '', ministry_id: '', date: '', start_time: '',
                end_time: '', local: '', status: 'pendente', observations: '',
            });
            setSelectedVolunteers([]);
        }
    }, [supabase, initialData]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
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
        const { ministry_id, ...rest } = formData;

        if (!ministry_id || !rest.date || !rest.event_name || !rest.start_time || !rest.end_time) {
            alert('Por favor, preencha todos os campos obrigatórios.');
            return;
        }

        if (selectedVolunteers.length === 0) {
            alert('Selecione pelo menos um voluntário.');
            return;
        }

        const scheduleData = {
            id: initialData?.id,
            ...rest,
            ministry_id: parseInt(ministry_id),
            volunteer_ids: selectedVolunteers.map(v => v.id)
        };
        onSave(scheduleData);
    };

    return (
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border-slate-200">
            <div className="flex items-center space-x-3 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <h2 className="text-xl font-bold text-slate-800">{isEditing ? 'Editar Evento' : 'Novo Evento'}</h2>
            </div>

            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start space-x-3 text-sm mb-6">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <div className="flex-1">
                  <p className="font-bold text-yellow-800">Regra de Proteção Ativa</p>
                  <p className="text-yellow-700">O sistema verificará automaticamente se algum voluntário já está escalado em outro ministério na mesma data antes de salvar.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                        <label htmlFor="event_name" className="block text-sm font-medium text-slate-700 mb-1">Título do Evento/Atividade *</label>
                        <input type="text" name="event_name" id="event_name" value={formData.event_name} onChange={handleInputChange} required className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-sm text-slate-900" />
                    </div>
                    <div>
                        <label htmlFor="ministry_id" className="block text-sm font-medium text-slate-700 mb-1">Ministério *</label>
                        <select name="ministry_id" id="ministry_id" value={formData.ministry_id} onChange={handleInputChange} required className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-sm text-slate-900">
                        <option value="" disabled>Selecione um ministério</option>
                        {allMinistries.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                    </div>
                </div>

                 <div>
                    <label htmlFor="volunteer_search" className="block text-sm font-medium text-slate-700 mb-1">Voluntários * <span className="text-slate-400 font-normal">(Selecione múltiplos voluntários)</span></label>
                    <div className="relative">
                        <input 
                          type="text" 
                          id="volunteer_search"
                          placeholder="Buscar voluntários para adicionar..."
                          value={volunteerSearch}
                          onChange={(e) => setVolunteerSearch(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-sm text-slate-900" 
                        />
                        {filteredVolunteers.length > 0 && (
                            <ul className="absolute z-10 w-full bg-white border border-slate-300 rounded-lg shadow-lg mt-1 max-h-60 overflow-auto">
                                {filteredVolunteers.map(v => (
                                    <li key={v.id} onClick={() => addVolunteer(v)} className="px-3 py-2 hover:bg-slate-100 cursor-pointer flex items-center space-x-3">
                                        <div className="w-8 h-8 rounded-full bg-blue-500 flex-shrink-0 flex items-center justify-center text-white font-bold text-xs">
                                            {v.initials}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-800 text-sm">{v.name}</p>
                                            <p className="text-xs text-slate-500">{v.email}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <div className="mt-3">
                        {selectedVolunteers.length > 0 ? (
                            <>
                                <div className="flex items-center space-x-2 mb-2">
                                     <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656-.126-1.283-.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                    <h3 className="text-sm font-semibold text-slate-600">Voluntários Selecionados ({selectedVolunteers.length})</h3>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    {selectedVolunteers.map(v => (
                                        <div key={v.id} className="inline-flex items-center p-2 bg-blue-50 rounded-lg border border-blue-200">
                                            <div className="flex items-center space-x-2 overflow-hidden">
                                                <div className="w-7 h-7 rounded-full bg-blue-500 flex-shrink-0 flex items-center justify-center text-white font-bold text-xs">
                                                    {v.initials}
                                                </div>
                                                <p className="font-semibold text-slate-800 text-sm truncate">{v.name}</p>
                                            </div>
                                            <button type="button" onClick={() => removeVolunteer(v.id)} className="text-slate-400 hover:text-red-600 p-1 ml-2 rounded-full flex-shrink-0">
                                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="text-center text-slate-500 py-4 border-2 border-dashed border-slate-200 rounded-lg">
                                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656-.126-1.283-.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                <p className="mt-1 text-sm font-semibold">Nenhum voluntário selecionado</p>
                                <p className="text-xs">Use o campo acima para buscar e adicionar voluntários</p>
                            </div>
                        )}
                    </div>
                 </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div>
                        <label htmlFor="date" className="block text-sm font-medium text-slate-700 mb-1">Data *</label>
                        <input type="date" name="date" id="date" value={formData.date} onChange={handleInputChange} required className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-sm text-slate-900" />
                    </div>
                    <div>
                        <label htmlFor="start_time" className="block text-sm font-medium text-slate-700 mb-1">Início *</label>
                        <input type="time" name="start_time" id="start_time" value={formData.start_time} onChange={handleInputChange} required className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-sm text-slate-900" />
                    </div>
                    <div>
                        <label htmlFor="end_time" className="block text-sm font-medium text-slate-700 mb-1">Fim *</label>
                        <input type="time" name="end_time" id="end_time" value={formData.end_time} onChange={handleInputChange} required className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-sm text-slate-900" />
                    </div>
                </div>

                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                        <label htmlFor="local" className="block text-sm font-medium text-slate-700 mb-1">Local</label>
                        <input type="text" name="local" id="local" value={formData.local} onChange={handleInputChange} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-sm text-slate-900" />
                    </div>
                    <div>
                        <label htmlFor="status" className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                         <select name="status" id="status" value={formData.status} onChange={handleInputChange} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-sm text-slate-900">
                            <option value="pendente">Pendente</option>
                            <option value="confirmado">Confirmado</option>
                            <option value="cancelado">Cancelado</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label htmlFor="observations" className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
                    <textarea name="observations" id="observations" value={formData.observations} onChange={handleInputChange} rows={3} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-sm text-slate-900"></textarea>
                </div>
                
                 <div className="pt-5 border-t border-slate-200 mt-6 flex flex-wrap justify-end items-center gap-3">
                    {saveError && <p className="text-sm text-red-500 mr-auto">{saveError}</p>}
                    <button type="button" onClick={onCancel} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50">Cancelar</button>
                    <button type="submit" disabled={isSaving || selectedVolunteers.length === 0} className="px-4 py-2 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 disabled:bg-green-300 flex items-center space-x-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M7.5 2.5a.5.5 0 00-1 0V3H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2h-.5V2.5a.5.5 0 00-1 0V3H9V2.5a.5.5 0 00-1 0V3H7.5V2.5zM8 8a1 1 0 11-2 0 1 1 0 012 0zm3 0a1 1 0 11-2 0 1 1 0 012 0zm3 0a1 1 0 11-2 0 1 1 0 012 0zm-6 3a1 1 0 11-2 0 1 1 0 012 0zm3 0a1 1 0 11-2 0 1 1 0 012 0zm3 0a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" /></svg>
                        <span>
                            {isSaving ? 'Salvando...' : (isEditing ? 'Atualizar Evento' : `Escalar ${selectedVolunteers.length} Voluntário${selectedVolunteers.length !== 1 ? 's' : ''}`)}
                        </span>
                    </button>
                </div>
            </form>
        </div>
    );
};

export default NewScheduleForm;