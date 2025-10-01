import React, { useState, useEffect, useMemo } from 'react';
import NewScheduleForm from './NewScheduleForm';
import ConfirmationModal from './ConfirmationModal';
import { Schedule } from '../types';
import { SupabaseClient } from '@supabase/supabase-js';

interface SchedulesPageProps {
  supabase: SupabaseClient | null;
  isFormOpen: boolean;
  setIsFormOpen: (isOpen: boolean) => void;
}

const SchedulesPage: React.FC<SchedulesPageProps> = ({ supabase, isFormOpen, setIsFormOpen }) => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [scheduleToDeleteId, setScheduleToDeleteId] = useState<number | null>(null);

  // State for filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMinistry, setSelectedMinistry] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [allMinistries, setAllMinistries] = useState<{ id: number; name: string; }[]>([]);


  const fetchSchedules = async () => {
    if (!supabase) {
      setLoading(false);
      setError("Supabase client not initialized.");
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('schedules')
      .select('*, ministries(id, name), schedule_volunteers(volunteer_id, volunteers(id, name, email, initials))')
      .order('date', { ascending: true })
      .order('start_time', { ascending: true });

    if (fetchError) {
      console.error('Error fetching schedules:', fetchError);
      setError("Não foi possível carregar os eventos.");
      setSchedules([]);
    } else {
      setSchedules(data as Schedule[] || []);
    }
    setLoading(false);
  };
  
  useEffect(() => {
    fetchSchedules();

    const fetchMinistries = async () => {
        if (!supabase) return;
        const { data, error } = await supabase.from('ministries').select('id, name').order('name');
        if (error) {
            console.error("Error fetching ministries for filter", error);
        } else {
            setAllMinistries(data || []);
        }
    };
    fetchMinistries();

  }, [supabase]);

  const showForm = (schedule: Schedule | null = null) => {
    setEditingSchedule(schedule);
    setSaveError(null);
    setIsFormOpen(true);
  };
  const hideForm = () => {
    setIsFormOpen(false);
    setEditingSchedule(null);
  };
  
  const handleDeleteRequest = (id: number) => {
    setScheduleToDeleteId(id);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!scheduleToDeleteId || !supabase) return;
    
    const { error: deleteJoinError } = await supabase
      .from('schedule_volunteers')
      .delete()
      .eq('schedule_id', scheduleToDeleteId);

    if (deleteJoinError) {
        alert(`Falha ao remover voluntários do evento: ${deleteJoinError.message}`);
        setIsDeleteModalOpen(false);
        setScheduleToDeleteId(null);
        return;
    }

    const { error: deleteError } = await supabase.from('schedules').delete().eq('id', scheduleToDeleteId);

    if (deleteError) {
      alert(`Falha ao excluir evento: ${deleteError.message}`);
    } else {
      setSchedules(schedules.filter(s => s.id !== scheduleToDeleteId));
    }
    setIsDeleteModalOpen(false);
    setScheduleToDeleteId(null);
  };

  const handleSaveSchedule = async (scheduleData: any) => {
    if (!supabase) {
      setSaveError("Conexão com o banco de dados não estabelecida.");
      return;
    }
    setIsSaving(true);
    setSaveError(null);

    const { id, volunteer_ids, ...dbData } = scheduleData;
    
    const { data: conflictingSchedules, error: checkError } = await supabase
      .from('schedules')
      .select('id, schedule_volunteers!inner(volunteer_id, volunteers(name))')
      .eq('date', dbData.date)
      .in('schedule_volunteers.volunteer_id', volunteer_ids)
      .neq('id', id || 0);

    if (checkError) {
      setSaveError(`Erro ao verificar evento: ${checkError.message}`);
      setIsSaving(false);
      return;
    }
    
    if (conflictingSchedules && conflictingSchedules.length > 0) {
        // FIX: Replaced the potentially unsafe flatMap chain with a safer reduce method to handle cases where `schedule_volunteers` might not be an array, preventing runtime errors.
        const conflictingNames = conflictingSchedules
          .reduce((allNames: string[], schedule: any) => {
            if (Array.isArray(schedule.schedule_volunteers)) {
              schedule.schedule_volunteers.forEach((sv: any) => {
                if (sv.volunteers?.name) {
                  allNames.push(sv.volunteers.name);
                }
              });
            }
            return allNames;
          }, []);

        const uniqueConflictingNames = [...new Set(conflictingNames)];

        if (uniqueConflictingNames.length > 0) {
            setSaveError(`Conflito! Voluntário(s) já escalado(s) neste dia: ${uniqueConflictingNames.join(', ')}.`);
            setIsSaving(false);
            return;
        }
    }

    if (id) { 
      const { error: updateError } = await supabase.from('schedules').update(dbData).eq('id', id);
      if (updateError) {
        setSaveError(`Falha ao atualizar o evento: ${updateError.message}`);
        setIsSaving(false);
        return;
      }

      await supabase.from('schedule_volunteers').delete().eq('schedule_id', id);

      const relations = volunteer_ids.map((volId: number) => ({ schedule_id: id, volunteer_id: volId }));
      const { error: insertRelationsError } = await supabase.from('schedule_volunteers').insert(relations);

      if (insertRelationsError) {
        setSaveError(`Falha ao associar voluntários: ${insertRelationsError.message}`);
      }
    } else { 
      const { data: newSchedule, error: insertError } = await supabase.from('schedules').insert(dbData).select().single();

      if (insertError || !newSchedule) {
        setSaveError(`Falha ao criar o evento: ${insertError?.message}`);
        setIsSaving(false);
        return;
      }
      
      const relations = volunteer_ids.map((volId: number) => ({ schedule_id: newSchedule.id, volunteer_id: volId }));
      const { error: insertRelationsError } = await supabase.from('schedule_volunteers').insert(relations);
      
      if (insertRelationsError) {
        setSaveError(`Falha ao associar voluntários: ${insertRelationsError.message}`);
      }
    }

    if (!saveError) {
      await fetchSchedules();
      hideForm();
    }
    setIsSaving(false);
  };

  const filteredSchedules = useMemo(() => {
    return schedules.filter(schedule => {
      const query = searchQuery.toLowerCase();
      
      const matchesSearch = query === '' ||
        schedule.event_name.toLowerCase().includes(query) ||
        (schedule.ministries?.name || '').toLowerCase().includes(query) ||
        (Array.isArray(schedule.schedule_volunteers) && schedule.schedule_volunteers.some(sv => sv.volunteers?.name.toLowerCase().includes(query)));

      const matchesMinistry = selectedMinistry === 'all' || 
        String(schedule.ministry_id) === selectedMinistry;

      const matchesStatus = selectedStatus === 'all' ||
        schedule.status === selectedStatus;

      return matchesSearch && matchesMinistry && matchesStatus;
    });
  }, [schedules, searchQuery, selectedMinistry, selectedStatus]);


  const groupedSchedules = useMemo(() => {
    return filteredSchedules.reduce((acc: Record<string, Schedule[]>, schedule) => {
      const date = new Date(schedule.date + 'T00:00:00').toLocaleDateString('pt-BR', {
        weekday: 'long', year: 'numeric', month: 'long', day: '2-digit'
      });
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(schedule);
      return acc;
    }, {} as Record<string, Schedule[]>);
  }, [filteredSchedules]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedMinistry('all');
    setSelectedStatus('all');
  };

  const hasActiveFilters = searchQuery !== '' || selectedMinistry !== 'all' || selectedStatus !== 'all';

  const renderContent = () => {
    if (loading) return <p className="text-center text-slate-500 mt-10">Carregando eventos...</p>;
    if (error) return <p className="text-center text-red-500 mt-10">{error}</p>;
    if (schedules.length === 0 && !isFormOpen) {
        return <p className="text-center text-slate-500 mt-10">Nenhum evento encontrado. Clique em "Novo Evento" para começar.</p>
    }
    if (filteredSchedules.length === 0 && hasActiveFilters) {
        return (
            <div className="text-center py-12 text-slate-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1"><path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <h3 className="mt-2 text-lg font-medium text-slate-800">Nenhum evento encontrado</h3>
                <p className="mt-1 text-sm">Tente ajustar seus filtros ou termos de busca.</p>
                <button onClick={handleClearFilters} className="mt-4 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors">Limpar Filtros</button>
            </div>
        );
    }
    return (
        <div className="space-y-8">
            {Object.entries(groupedSchedules).map(([date, schedulesOnDate]) => (
                <div key={date}>
                    <h2 className="font-bold text-slate-700 text-lg mb-3 capitalize">{date}</h2>
                    <div className="space-y-3">
                        {schedulesOnDate.map(schedule => (
                            <div key={schedule.id} className="bg-white p-4 rounded-lg border border-slate-200 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                                <div className="flex-1">
                                    <p className="font-semibold text-slate-800">
                                        {schedule.event_name} • <span className="text-blue-600">{schedule.ministries?.name}</span>
                                    </p>
                                    {/* FIX: Cast `schedule.schedule_volunteers` to `any[]` after the Array.isArray check to resolve the TypeScript error "Property 'map' does not exist on type 'unknown'". This ensures the code compiles correctly while maintaining runtime safety. */}
                                    <p className="text-sm text-slate-600">{Array.isArray(schedule.schedule_volunteers) && (schedule.schedule_volunteers as any[]).map(sv => sv.volunteers?.name).filter(Boolean).join(', ')}</p>
                                    <div className="flex items-center space-x-2 text-xs text-slate-500 mt-1">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        <span>{schedule.start_time} - {schedule.end_time}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 self-end sm:self-center">
                                  <span className={`text-xs font-semibold px-3 py-1 rounded-full capitalize ${schedule.status === 'confirmado' ? 'bg-green-100 text-green-800' : schedule.status === 'cancelado' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{schedule.status}</span>
                                  <button onClick={() => showForm(schedule)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" /></svg></button>
                                  <button onClick={() => handleDeleteRequest(schedule.id!)} className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Eventos</h1>
          <p className="text-slate-500 mt-1">Organize os voluntários nos eventos</p>
        </div>
        <button 
          onClick={() => showForm()}
          className="bg-green-500 text-white font-semibold px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-green-600 transition-colors shadow-sm w-full md:w-auto justify-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
          <span>Novo Evento</span>
        </button>
      </div>
      
      {!isFormOpen && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div className="relative md:col-span-3">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <input 
                        type="text" 
                        placeholder="Buscar por evento, ministério ou voluntário..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg shadow-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-slate-900 placeholder:text-slate-500"
                    />
                </div>
                <div>
                    <label htmlFor="ministry_filter" className="sr-only">Filtrar por Ministério</label>
                    <select id="ministry_filter" value={selectedMinistry} onChange={(e) => setSelectedMinistry(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-slate-900">
                        <option value="all">Todos os Ministérios</option>
                        {allMinistries.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="status_filter" className="sr-only">Filtrar por Status</label>
                    <select id="status_filter" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-slate-900">
                        <option value="all">Todos os Status</option>
                        <option value="pendente">Pendente</option>
                        <option value="confirmado">Confirmado</option>
                        <option value="cancelado">Cancelado</option>
                    </select>
                </div>
                {hasActiveFilters && (
                    <button onClick={handleClearFilters} className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 transition-colors">
                        Limpar Filtros
                    </button>
                )}
            </div>
        </div>
      )}

      <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3 text-sm">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        <div className="flex-1">
          <p className="font-bold text-red-700">REGRA RÍGIDA: Um voluntário só pode servir em UM ministério por dia</p>
          <p className="text-red-600">Exemplo: Se escalado na Comunicação no domingo, não pode ser escalado em outro ministério no mesmo domingo.</p>
        </div>
      </div>


      {isFormOpen ? (
        <NewScheduleForm 
          supabase={supabase}
          initialData={editingSchedule}
          onCancel={hideForm} 
          onSave={handleSaveSchedule}
          isSaving={isSaving}
          saveError={saveError}
        />
      ) : (
        renderContent()
      )}

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este evento? Esta ação não pode ser desfeita."
      />
    </div>
  );
};

export default SchedulesPage;