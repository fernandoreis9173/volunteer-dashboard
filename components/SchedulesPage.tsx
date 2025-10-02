import React, { useState, useEffect, useCallback } from 'react';
import NewEventForm from './NewScheduleForm';
import ConfirmationModal from './ConfirmationModal';
import EventCard from './EventCard';
import { Event } from '../types';
import { SupabaseClient } from '@supabase/supabase-js';

interface EventsPageProps {
  supabase: SupabaseClient | null;
  isFormOpen: boolean;
  setIsFormOpen: (isOpen: boolean) => void;
  userRole: string | null;
}

const EventsPage: React.FC<EventsPageProps> = ({ supabase, isFormOpen, setIsFormOpen, userRole }) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [eventToDeleteId, setEventToDeleteId] = useState<number | null>(null);
  const [leaderDepartmentId, setLeaderDepartmentId] = useState<number | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500); // 500ms delay before triggering search

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);


  const fetchEvents = useCallback(async () => {
      if (!supabase) { setLoading(false); setError("Cliente Supabase não inicializado."); return; }
      setLoading(true);
      setError(null);

      let query = supabase.from('events').select(`
        *,
        event_departments ( department_id, departments ( id, name, leader ) ),
        event_volunteers ( volunteer_id, department_id, volunteers ( id, name, initials ), departments ( id, name ) )
      `);
      
      // Apply server-side filters based on state
      if (debouncedSearchQuery) {
        query = query.ilike('name', `%${debouncedSearchQuery}%`);
      }
      if (selectedStatus !== 'all') {
        query = query.eq('status', selectedStatus);
      }

      // If user has set a date range, use it.
      if (dateRange.start) {
        query = query.gte('date', dateRange.start);
      }
      if (dateRange.end) {
        query = query.lte('date', dateRange.end);
      }

      // If no date range is set by the user, default to the current month.
      if (!dateRange.start && !dateRange.end) {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        const formatDate = (date: Date) => {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        };
        
        query = query.gte('date', formatDate(firstDay)).lte('date', formatDate(lastDay));
      }
      
      query = query.order('date', { ascending: false }).order('start_time', { ascending: true });
      
      const { data, error: fetchError } = await query;

      if (fetchError) {
        console.error('Error fetching events:', fetchError);
        setError("Não foi possível carregar os eventos.");
        setEvents([]);
      } else {
        setEvents(data as Event[] || []);
      }
      setLoading(false);
  }, [supabase, debouncedSearchQuery, selectedStatus, dateRange]);


  useEffect(() => {
    const initializeLeader = async () => {
        if (!supabase) return;
        
        if (userRole === 'leader' || userRole === 'lider') {
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.email) {
                const { data: department, error: deptError } = await supabase
                    .from('departments')
                    .select('id')
                    .eq('leader_contact', user.email)
                    .single();
                if (deptError) console.error("Could not fetch leader's department", deptError);
                else setLeaderDepartmentId(department?.id || null);
            }
        }
    };
    initializeLeader();
  }, [supabase, userRole]);
  
  // Re-fetch events whenever filters change
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);
  
  const showForm = (event: Event | null = null) => {
    setEditingEvent(event);
    setSaveError(null);
    setIsFormOpen(true);
  };
  const hideForm = () => {
    setIsFormOpen(false);
    setEditingEvent(null);
  };
  
  const handleDeleteRequest = (id: number) => {
    setEventToDeleteId(id);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!eventToDeleteId || !supabase) return;
    
    const { error: deleteError } = await supabase.from('events').delete().eq('id', eventToDeleteId);

    if (deleteError) {
      alert(`Falha ao excluir evento: ${deleteError.message}`);
    } else {
      await fetchEvents(); // Refetch to show the updated list
    }
    setIsDeleteModalOpen(false);
    setEventToDeleteId(null);
  };

  const handleSaveEvent = async (eventPayload: any) => {
    if (!supabase) { setSaveError("Conexão não estabelecida."); return; }
    setIsSaving(true);
    setSaveError(null);

    const { volunteer_ids, ...upsertData } = eventPayload;

    try {
        if (userRole === 'admin') {
            if (!upsertData.date || !upsertData.start_time || !upsertData.end_time) {
                throw new Error("Data e horários são obrigatórios.");
            }
            if (upsertData.start_time >= upsertData.end_time) {
                throw new Error("O horário de início deve ser anterior ao horário de fim.");
            }

            let conflictQuery = supabase
                .from('events')
                .select('id, name, start_time, end_time')
                .eq('date', upsertData.date);

            if (upsertData.id) {
                conflictQuery = conflictQuery.neq('id', upsertData.id);
            }

            const { data: potentialConflicts, error: fetchConflictError } = await conflictQuery;
            if (fetchConflictError) throw fetchConflictError;

            const newStartTime = upsertData.start_time;
            const newEndTime = upsertData.end_time;

            const conflict = potentialConflicts?.find(event => {
                const existingStartTime = event.start_time;
                const existingEndTime = event.end_time;
                return (newStartTime < existingEndTime) && (newEndTime > existingStartTime);
            });

            if (conflict) {
                throw new Error(`Conflito de horário com o evento "${conflict.name}" (${conflict.start_time} - ${conflict.end_time}).`);
            }
            
            const { error: eventError } = await supabase.from('events').upsert(upsertData);
            if (eventError) throw eventError;

        } else if ((userRole === 'leader' || userRole === 'lider') && upsertData.id && leaderDepartmentId) {
            const { error: statusError } = await supabase
                .from('events')
                .update({ status: upsertData.status })
                .eq('id', upsertData.id);
            if (statusError) throw statusError;

            const { error: deleteVolError } = await supabase.from('event_volunteers').delete().eq('event_id', upsertData.id).eq('department_id', leaderDepartmentId);
            if (deleteVolError) throw deleteVolError;

            if (volunteer_ids && Array.isArray(volunteer_ids) && volunteer_ids.length > 0) {
                const newRelations = volunteer_ids.map((volId: number) => ({ event_id: upsertData.id, volunteer_id: volId, department_id: leaderDepartmentId }));
                const { error: insertVolError } = await supabase.from('event_volunteers').insert(newRelations);
                if (insertVolError) throw insertVolError;
            }
        } else {
             throw new Error("Ação não permitida ou dados insuficientes.");
        }
    } catch (error: any) {
        setSaveError(`Falha ao salvar: ${error.message}`);
        setIsSaving(false);
        return;
    }
    
    await fetchEvents();
    hideForm();
    setIsSaving(false);
  };
  
  const handleAddDepartmentToEvent = async (eventId: number) => {
      if (!supabase || !leaderDepartmentId) return;

      const { error } = await supabase.from('event_departments').insert({
          event_id: eventId,
          department_id: leaderDepartmentId,
      });

      if (error) {
          alert(`Falha ao adicionar departamento ao evento: ${error.message}`);
      } else {
          fetchEvents();
      }
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedStatus('all');
    setDateRange({ start: '', end: '' });
  };

  const hasActiveFilters = searchQuery !== '' || selectedStatus !== 'all' || dateRange.start !== '' || dateRange.end !== '';

  const renderContent = () => {
    if (loading) return <p className="text-center text-slate-500 mt-10">Carregando eventos...</p>;
    if (error) return <p className="text-center text-red-500 mt-10">{error}</p>;
    if (events.length === 0) return (
      <div className="text-center py-12 text-slate-500">
        <h3 className="text-lg font-medium text-slate-800">Nenhum evento encontrado</h3>
        <p className="mt-1 text-sm">Tente ajustar seus filtros ou adicione um novo evento.</p>
      </div>
    );
    
    return (
        <div className="space-y-6">
            {events.map(event => (
                <EventCard 
                    key={event.id} 
                    event={event} 
                    userRole={userRole} 
                    leaderDepartmentId={leaderDepartmentId} 
                    onEdit={showForm} 
                    onDelete={handleDeleteRequest}
                    onAddDepartment={handleAddDepartmentToEvent}
                />
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
        {userRole === 'admin' && (
            <button onClick={() => showForm()} className="bg-green-500 text-white font-semibold px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-green-600 transition-colors shadow-sm w-full md:w-auto justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
            <span>Novo Evento</span>
            </button>
        )}
      </div>
      
      {isFormOpen ? (
        <NewEventForm supabase={supabase} initialData={editingEvent} onCancel={hideForm} onSave={handleSaveEvent} isSaving={isSaving} saveError={saveError} userRole={userRole} leaderDepartmentId={leaderDepartmentId} />
      ) : (
        <>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex flex-wrap items-end gap-4">
                <div className="flex-grow min-w-[200px] lg:flex-grow-0 lg:w-1/3">
                    <label htmlFor="search-event" className="block text-sm font-medium text-slate-700 mb-1">Buscar por Nome</label>
                    <input 
                        id="search-event" 
                        type="text" 
                        placeholder="Ex: Culto de Domingo" 
                        value={searchQuery} 
                        onChange={e => setSearchQuery(e.target.value)} 
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div className="flex-grow min-w-[150px] lg:flex-grow-0 lg:w-auto">
                    <label htmlFor="status-filter" className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                    <select id="status-filter" value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                        <option value="all">Todos</option>
                        <option value="Confirmado">Confirmado</option>
                        <option value="Pendente">Pendente</option>
                        <option value="Cancelado">Cancelado</option>
                    </select>
                </div>
                <div className="flex-grow min-w-[150px] lg:flex-grow-0 lg:w-auto">
                    <label htmlFor="start-date" className="block text-sm font-medium text-slate-700 mb-1">Data Início</label>
                    <input id="start-date" type="date" value={dateRange.start} onChange={e => setDateRange(prev => ({...prev, start: e.target.value}))} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div className="flex-grow min-w-[150px] lg:flex-grow-0 lg:w-auto">
                    <label htmlFor="end-date" className="block text-sm font-medium text-slate-700 mb-1">Data Fim</label>
                    <input id="end-date" type="date" value={dateRange.end} onChange={e => setDateRange(prev => ({...prev, end: e.target.value}))} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                {hasActiveFilters && (
                    <div className="flex-grow lg:flex-grow-0">
                        <button onClick={handleClearFilters} className="w-full px-3 py-2 bg-slate-100 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-200 border border-slate-300">
                            Limpar Filtros
                        </button>
                    </div>
                )}
            </div>
        </div>

        {renderContent()}
        </>
      )}

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este evento? Esta ação não pode ser desfeita e removerá todas as escalas de voluntários associadas."
      />
    </div>
  );
};

export default EventsPage;