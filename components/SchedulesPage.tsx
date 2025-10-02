import React, { useState, useEffect, useMemo, useCallback } from 'react';
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

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [allDepartments, setAllDepartments] = useState<{ id: number; name: string; }[]>([]);

  const fetchEvents = useCallback(async () => {
      if (!supabase) { setLoading(false); setError("Cliente Supabase não inicializado."); return; }
      setLoading(true);
      setError(null);

      let query = supabase.from('events').select(`
        *,
        event_departments ( department_id, departments ( id, name ) ),
        event_volunteers ( volunteer_id, department_id, volunteers ( id, name, initials ), departments ( id, name ) )
      `).order('date', { ascending: false }).order('start_time', { ascending: true });
      
      const { data, error: fetchError } = await query;

      if (fetchError) {
        console.error('Error fetching events:', fetchError);
        setError("Não foi possível carregar os eventos.");
        setEvents([]);
      } else {
        setEvents(data as Event[] || []);
      }
      setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const initialize = async () => {
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
        
        const { data, error } = await supabase.from('departments').select('id, name').order('name');
        if (error) console.error("Error fetching departments for filter", error);
        else setAllDepartments(data || []);
        
        fetchEvents();
    };
    initialize();
  }, [supabase, userRole, fetchEvents]);
  
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
      setEvents(events.filter(e => e.id !== eventToDeleteId));
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

  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = query === '' || event.name.toLowerCase().includes(query);
      const matchesDept = selectedDepartment === 'all' || event.event_departments.some(ed => String(ed.department_id) === selectedDepartment);
      return matchesSearch && matchesDept;
    });
  }, [events, searchQuery, selectedDepartment]);

  const renderContent = () => {
    if (loading) return <p className="text-center text-slate-500 mt-10">Carregando eventos...</p>;
    if (error) return <p className="text-center text-red-500 mt-10">{error}</p>;
    if (filteredEvents.length === 0) return <p className="text-center text-slate-500 mt-10">Nenhum evento encontrado.</p>;
    
    return (
        <div className="space-y-6">
            {filteredEvents.map(event => (
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
        <div className="bg-white p-4 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4">
            <input type="text" placeholder="Buscar por nome do evento..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="md:col-span-2 w-full px-3 py-2 bg-white border border-slate-300 rounded-lg" />
            <select value={selectedDepartment} onChange={(e) => setSelectedDepartment(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg">
                <option value="all">Todos os Departamentos</option>
                {allDepartments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
        </div>
        {renderContent()}
        </>
      )}

      <ConfirmationModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={handleConfirmDelete} title="Confirmar Exclusão" message="Tem certeza que deseja excluir este evento? Esta ação não pode ser desfeita."/>
    </div>
  );
};

export default EventsPage;