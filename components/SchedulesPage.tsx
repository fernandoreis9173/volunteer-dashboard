import React, { useState, useEffect, useCallback } from 'react';
import NewEventForm from './NewScheduleForm';
import ConfirmationModal from './ConfirmationModal';
import EventCard from './EventCard';
import { Event } from '../types';
import { SupabaseClient } from '@supabase/supabase-js';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getErrorMessage } from '../lib/utils';

// Debounce hook
function useDebounce(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}


interface EventsPageProps {
  supabase: SupabaseClient | null;
  isFormOpen: boolean;
  setIsFormOpen: (isOpen: boolean) => void;
  userRole: string | null;
  leaderDepartmentId: number | null;
  onDataChange: () => void;
}

const EventsPage: React.FC<EventsPageProps> = ({ supabase, isFormOpen, setIsFormOpen, userRole, leaderDepartmentId, onDataChange }) => {
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [eventToDeleteId, setEventToDeleteId] = useState<number | null>(null);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const eventRefs = React.useRef<Record<number, HTMLDivElement | null>>({});


  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const isLeader = userRole === 'leader' || userRole === 'lider';
  const [showOnlyMyDepartmentEvents, setShowOnlyMyDepartmentEvents] = useState(false);

  useEffect(() => {
    const idToHighlight = sessionStorage.getItem('highlightEventId');
    if (idToHighlight) {
        const eventId = parseInt(idToHighlight, 10);
        if (!isNaN(eventId)) {
            setHighlightId(eventId);
        }
        sessionStorage.removeItem('highlightEventId');
    }
  }, []);

  const fetchEvents = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      setError("Cliente Supabase não inicializado.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      let queryBuilder = supabase
        .from('events')
        .select(`
          id, name, date, start_time, end_time, status, local, observations, created_at,
          event_departments (
            department_id,
            departments ( id, name, leader )
          ),
          event_volunteers (
            volunteer_id,
            department_id,
            volunteers ( id, name, email, initials, departments:departaments )
          )
        `)
        .order('date', { ascending: false })
        .order('start_time', { ascending: true });

        // Apply server-side filters
        if (debouncedSearchQuery) {
            queryBuilder = queryBuilder.ilike('name', `%${debouncedSearchQuery}%`);
        }
        if (selectedStatus !== 'all') {
            queryBuilder = queryBuilder.eq('status', selectedStatus);
        }
        if (dateRange.start) {
            queryBuilder = queryBuilder.gte('date', dateRange.start);
        }
        if (dateRange.end) {
            queryBuilder = queryBuilder.lte('date', dateRange.end);
        }
        if (isLeader && showOnlyMyDepartmentEvents && leaderDepartmentId) {
            queryBuilder = queryBuilder.eq('event_departments.department_id', leaderDepartmentId);
        }


      const { data, error: fetchError } = await queryBuilder;
      if (fetchError) throw fetchError;
      
      setAllEvents((data as unknown as Event[]) || []);

    } catch (error: any) {
      const errorMessage = getErrorMessage(error);
      console.error('Error fetching events data:', error);
      setError(`Não foi possível carregar os dados dos eventos: ${errorMessage}`);
      setAllEvents([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, debouncedSearchQuery, selectedStatus, dateRange, isLeader, showOnlyMyDepartmentEvents, leaderDepartmentId]);
  
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);
  
  useEffect(() => {
    if (highlightId && allEvents.length > 0 && eventRefs.current[highlightId]) {
        setTimeout(() => {
            eventRefs.current[highlightId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
        
        const timer = setTimeout(() => setHighlightId(null), 3000);
        return () => clearTimeout(timer);
    }
  }, [highlightId, allEvents]);

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
      alert(`Falha ao excluir evento: ${getErrorMessage(deleteError)}`);
    } else {
      setAllEvents(prevEvents => prevEvents.filter(event => event.id !== eventToDeleteId));
      onDataChange();
    }
    setIsDeleteModalOpen(false);
    setEventToDeleteId(null);
  };

  const refetchEvent = async (eventId: number): Promise<Event | null> => {
      if (!supabase) return null;
      const { data, error } = await supabase.from('events').select(`*, event_departments (department_id, departments (id, name, leader)), event_volunteers (volunteer_id, department_id, volunteers (*))`).eq('id', eventId).single();
      if (error) {
          console.error("Failed to refetch event", getErrorMessage(error));
          return null;
      }
      return data as unknown as Event;
  };

  const handleSaveEvent = async (eventPayload: any) => {
    if (!supabase) { setSaveError("Conexão não estabelecida."); return; }
    setIsSaving(true);
    setSaveError(null);

    const { volunteer_ids, ...upsertData } = eventPayload;
    let broadcastPayload: any = null;
    let notificationPayloads: any[] = [];

    try {
        let eventIdToUpdate: number | undefined = upsertData.id;

        if (userRole === 'admin') {
            if (!upsertData.date || !upsertData.start_time || !upsertData.end_time) throw new Error("Data e horários são obrigatórios.");
            if (upsertData.start_time >= upsertData.end_time) throw new Error("O horário de início deve ser anterior ao horário de fim.");
            
            let originalEvent: Event | undefined;
            if (upsertData.id) {
                originalEvent = allEvents.find(e => e.id === upsertData.id);
            }
            
            // Conflict check
            let conflictQuery = supabase.from('events').select('id, name, start_time, end_time').eq('date', upsertData.date);
            if (upsertData.id) conflictQuery = conflictQuery.neq('id', upsertData.id);
            const { data: potentialConflicts, error: fetchConflictError } = await conflictQuery;
            if (fetchConflictError) throw fetchConflictError;

            const conflict = potentialConflicts?.find(event => (upsertData.start_time < event.end_time) && (upsertData.end_time > event.start_time));
            if (conflict) throw new Error(`Conflito de horário com o evento "${conflict.name}" (${conflict.start_time} - ${conflict.end_time}).`);
            
            const { data: savedEvent, error: eventError } = await supabase.from('events').upsert(upsertData).select('id, name').single();
            if (eventError) throw eventError;

            eventIdToUpdate = savedEvent.id;

            if (originalEvent) { // This is an UPDATE
                let updateMessage = '';
                if(originalEvent.status !== upsertData.status) updateMessage += `Status alterado para ${upsertData.status}. `;
                if(originalEvent.date !== upsertData.date) updateMessage += `Data alterada para ${new Date(upsertData.date + 'T00:00:00').toLocaleDateString('pt-BR')}. `;
                if(originalEvent.start_time !== upsertData.start_time || originalEvent.end_time !== upsertData.end_time) updateMessage += `Horário alterado para ${upsertData.start_time}-${upsertData.end_time}. `;
                
                if (updateMessage.trim()) {
                    const departmentIdsInvolved = originalEvent.event_departments.map(ed => ed.department_id);
                    broadcastPayload = { type: 'event_update', eventId: eventIdToUpdate, eventName: savedEvent.name, updateMessage, departmentIds: departmentIdsInvolved };

                    // Get volunteers already scheduled
                    // FIX: Using an inner join `!inner` with a singular alias `volunteer` helps TypeScript correctly infer the shape of the joined data as an object instead of an array, which resolves the type error.
                    const { data: scheduledVolunteers } = await supabase.from('event_volunteers').select('volunteer:volunteers!inner(user_id)').eq('event_id', eventIdToUpdate);
                    const volunteerUserIds = (scheduledVolunteers || []).map(v => (v as { volunteer: { user_id: string | null } }).volunteer?.user_id).filter(Boolean) as string[];
                    
                    // Get leaders of involved departments
                    let leaderUserIds: string[] = [];
                    if (departmentIdsInvolved.length > 0) {
                        const { data: leaders } = await supabase
                            .from('profiles')
                            .select('id') // this is the user_id
                            .in('department_id', departmentIdsInvolved)
                            .or('role.eq.leader,role.eq.lider');
                        leaderUserIds = (leaders || []).map(l => l.id);
                    }

                    // Combine and deduplicate user IDs
                    const allUserIdsToNotify = new Set([...volunteerUserIds, ...leaderUserIds]);
                    
                    notificationPayloads = Array.from(allUserIdsToNotify).map(userId => ({
                        user_id: userId,
                        message: `Atualização no evento "${savedEvent.name}": ${updateMessage.trim()}`,
                        type: 'event_update',
                        related_event_id: eventIdToUpdate,
                    }));
                }
            } else { // This is a NEW event, notify all leaders.
                const { data: leaders, error: leadersError } = await supabase
                    .from('profiles')
                    .select('id') // This is the user_id
                    .or('role.eq.leader,role.eq.lider');

                if (leadersError) {
                    console.error("Could not fetch leaders to notify about new event:", getErrorMessage(leadersError));
                } else if (leaders && leaders.length > 0) {
                    const leaderNotifications = leaders.map(leader => ({
                        user_id: leader.id,
                        message: `O novo evento "${savedEvent.name}" foi criado. Verifique se o seu departamento é necessário.`,
                        type: 'new_event_for_leader',
                        related_event_id: savedEvent.id,
                    }));
                    notificationPayloads.push(...leaderNotifications);

                    const channel = supabase.channel('global-notifications');
                    await channel.send({
                        type: 'broadcast',
                        event: 'new_event_for_leader',
                        payload: { eventName: savedEvent.name, eventId: savedEvent.id },
                    });
                    supabase.removeChannel(channel);
                }
            }

        } else if (isLeader && upsertData.id && leaderDepartmentId) {
            const eventId = upsertData.id;
            const { error: statusError } = await supabase.from('events').update({ status: upsertData.status }).eq('id', eventId);
            if (statusError) throw statusError;

            await supabase.from('event_volunteers').delete().eq('event_id', eventId).eq('department_id', leaderDepartmentId);
            
            if (volunteer_ids?.length > 0) {
                const newRelations = volunteer_ids.map((volId: number) => ({ event_id: eventId, volunteer_id: volId, department_id: leaderDepartmentId }));
                const { error: insertVolError } = await supabase.from('event_volunteers').insert(newRelations);
                if (insertVolError) throw insertVolError;

                const { data: deptData } = await supabase.from('departments').select('name').eq('id', leaderDepartmentId).single();
                const departmentName = deptData?.name || 'seu departamento';
                const eventNameForBroadcast = allEvents.find(e => e.id === eventId)?.name || 'um evento';
                
                const { data: volunteerDetails, error: volunteerDetailsError } = await supabase
                    .from('volunteers')
                    .select('id, user_id, name')
                    .in('id', volunteer_ids);

                if (volunteerDetailsError) throw volunteerDetailsError;

                const notifiableVolunteers: { id: number; user_id: string; name: string; }[] = [];
                const unnotifiableVolunteers: { id: number; user_id: string | null; name: string; }[] = [];

                (volunteerDetails || []).forEach(vol => {
                    if (vol.user_id) {
                        notifiableVolunteers.push(vol as { id: number; user_id: string; name: string; });
                    } else {
                        unnotifiableVolunteers.push(vol);
                    }
                });

                if (unnotifiableVolunteers.length > 0) {
                    const unnotifiedNames = unnotifiableVolunteers.map(v => v.name).join(', ');
                    setTimeout(() => {
                        alert(`A escala foi salva com sucesso. No entanto, os seguintes voluntários não puderam ser notificados pois ainda não ativaram suas contas: ${unnotifiedNames}. Eles verão a escala ao acessar o sistema.`);
                    }, 100);
                }

                const notifiableVolunteerIds = notifiableVolunteers.map(v => v.id);

                if (notifiableVolunteerIds.length > 0) {
                    broadcastPayload = { 
                        type: 'new_schedule', 
                        eventId: eventId, 
                        eventName: eventNameForBroadcast, 
                        volunteerIds: notifiableVolunteerIds,
                        departmentName 
                    };
                    
                    notificationPayloads = notifiableVolunteers.map(vol => ({
                        user_id: vol.user_id,
                        message: `Você foi escalado para o evento "${eventNameForBroadcast}" no departamento de ${departmentName}.`,
                        type: 'new_schedule',
                        related_event_id: eventId,
                    }));
                }
            }
        } else {
             throw new Error("Ação não permitida ou dados insuficientes.");
        }
        
        if (eventIdToUpdate) {
            const updatedEvent = await refetchEvent(eventIdToUpdate);
            if (updatedEvent) {
                setAllEvents(prevEvents => {
                    const existing = prevEvents.find(e => e.id === eventIdToUpdate);
                    if (existing) {
                        return prevEvents.map(e => e.id === eventIdToUpdate ? updatedEvent : e);
                    } else {
                        return [updatedEvent, ...prevEvents].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime() || a.start_time.localeCompare(b.start_time));
                    }
                });
            } else {
                await fetchEvents(); 
            }
        } else {
            await fetchEvents();
        }

        hideForm();
        onDataChange();
        
        if (notificationPayloads.length > 0) {
            const { error: notificationError } = await supabase.functions.invoke('create-notifications', {
                body: { notifications: notificationPayloads },
            });

            if (notificationError) {
                console.error("Erro ao criar notificações via Edge Function:", getErrorMessage(notificationError));
                alert("A escala foi salva, mas ocorreu um erro ao enviar as notificações. Os usuários verão a escala ao acessar o sistema.");
            }
        }

        if (broadcastPayload) {
            const channel = supabase.channel('global-notifications');
            await channel.send({
                type: 'broadcast',
                event: broadcastPayload.type,
                payload: broadcastPayload,
            });
            supabase.removeChannel(channel);
        }

    } catch (error: any) {
        setSaveError(`Falha ao salvar: ${getErrorMessage(error)}`);
    } finally {
        setIsSaving(false);
    }
  };
  
  const handleAddDepartmentToEvent = async (event: Event) => {
    if (!supabase || !leaderDepartmentId || !event.id) return;

    const { error: insertError } = await supabase.from('event_departments').insert({
        event_id: event.id,
        department_id: leaderDepartmentId,
    });

    if (insertError) {
        alert(`Falha ao adicionar departamento ao evento: ${getErrorMessage(insertError)}`);
        return;
    }
    
    const updatedEvent = await refetchEvent(event.id);
    if (updatedEvent) {
        setAllEvents(allEvents.map(e => e.id === event.id ? updatedEvent : e));
        
        const { data: deptData } = await supabase.from('departments').select('name').eq('id', leaderDepartmentId).single();
        const departmentName = deptData?.name;
        if (departmentName) {
            const channel = supabase.channel('global-notifications');
            await channel.send({
                type: 'broadcast',
                event: 'new_event_for_department',
                payload: {
                    eventName: updatedEvent.name,
                    departmentName: departmentName
                }
            });
             supabase.removeChannel(channel);
        }
    } else {
        await fetchEvents(); 
    }
    onDataChange();
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedStatus('all');
    setDateRange({ start: '', end: '' });
    setShowOnlyMyDepartmentEvents(false);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.height;
    let y = 40;

    doc.setFontSize(18);
    doc.text("Relatório de Eventos", 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);

    const dateText = (dateRange.start || dateRange.end)
        ? `Período: ${dateRange.start ? new Date(dateRange.start + 'T00:00:00').toLocaleDateString('pt-BR') : '...'} a ${dateRange.end ? new Date(dateRange.end + 'T00:00:00').toLocaleDateString('pt-BR') : '...'}`
        : "Todos os Eventos";
    doc.text(dateText, 14, 30);
    
    allEvents.forEach((event) => {
        if (y > pageHeight - 60) {
            doc.addPage();
            y = 20;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(event.name, 14, y);
        y += 7;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(50);
        const eventDate = new Date(event.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        doc.text(`Data: ${eventDate} | Horário: ${event.start_time} - ${event.end_time} | Status: ${event.status}`, 14, y);
        y += 5;

        const tableData = event.event_departments.map(ed => {
            const department = ed.departments;
            if (!department) return [];
            const volunteersInDept = event.event_volunteers
                .filter(ev => ev.department_id === department.id && ev.volunteers)
                .map(ev => ev.volunteers!.name)
                .join('\n');
            return [department.name, department.leader || 'N/A', volunteersInDept || 'Nenhum voluntário'];
        });

        if (tableData.length > 0 && tableData.some(row => row.length > 0)) {
            autoTable(doc, {
                startY: y,
                head: [['Departamento', 'Líder', 'Voluntários Escalados']],
                body: tableData.filter(row => row.length > 0) as any,
                theme: 'striped',
                headStyles: { fillColor: [22, 78, 99] },
            });
            y = (doc as any).lastAutoTable.finalY + 15;
        } else {
            doc.setTextColor(100);
            doc.text("Nenhum departamento ou voluntário para este evento.", 14, y);
            y += 10;
        }
    });

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width / 2, pageHeight - 10, { align: 'center' });
        doc.text(`Relatório gerado em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, doc.internal.pageSize.width - 14, pageHeight - 10, { align: 'right' });
    }

    doc.save(`relatorio_eventos_${new Date().toISOString().slice(0, 10)}.pdf`);
  };
  
  const hasActiveFilters = searchQuery !== '' || selectedStatus !== 'all' || dateRange.start !== '' || dateRange.end !== '' || (isLeader && showOnlyMyDepartmentEvents);


  const renderContent = () => {
    if (loading) return <p className="text-center text-slate-500 mt-10">Carregando eventos...</p>;
    if (error && !allEvents.length) return <p className="text-center text-red-500 mt-10">{error}</p>;
    if (allEvents.length === 0) return (
      <div className="text-center py-12 text-slate-500">
        <h3 className="text-lg font-medium text-slate-800">Nenhum evento encontrado</h3>
        <p className="mt-1 text-sm">Tente ajustar seus filtros ou adicione um novo evento.</p>
      </div>
    );
    
    return (
        <div className="space-y-6">
            {error && <p className="text-center text-yellow-600 bg-yellow-50 p-3 rounded-lg">{error}</p>}
            {allEvents.map(event => (
                <div key={event.id} ref={el => { if(event.id) eventRefs.current[event.id] = el; }}>
                    <EventCard 
                        event={event} 
                        userRole={userRole === 'lider' ? 'leader' : userRole} 
                        leaderDepartmentId={leaderDepartmentId} 
                        onEdit={showForm} 
                        onDelete={handleDeleteRequest}
                        onAddDepartment={handleAddDepartmentToEvent}
                        isHighlighted={highlightId === event.id}
                    />
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
        {userRole === 'admin' && (
             <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                <button
                    onClick={handleExportPDF}
                    disabled={allEvents.length === 0 || loading}
                    className="bg-slate-700 text-white font-semibold px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-slate-800 transition-colors shadow-sm w-full md:w-auto justify-center disabled:bg-slate-400 disabled:cursor-not-allowed"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                    <span>Exportar Relatório (PDF)</span>
                </button>
                <button onClick={() => showForm()} className="bg-green-500 text-white font-semibold px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-green-600 transition-colors shadow-sm w-full md:w-auto justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                    <span>Novo Evento</span>
                </button>
            </div>
        )}
      </div>
      
      {isFormOpen ? (
        <NewEventForm supabase={supabase} initialData={editingEvent} onCancel={hideForm} onSave={handleSaveEvent} isSaving={isSaving} saveError={saveError} userRole={userRole} leaderDepartmentId={leaderDepartmentId} />
      ) : (
        <>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-1">
                    <label htmlFor="search-event" className="block text-xs font-medium text-slate-600 mb-1">Buscar por Nome</label>
                    <input 
                        id="search-event" 
                        type="text" 
                        placeholder="Ex: Culto de Domingo" 
                        value={searchQuery} 
                        onChange={e => setSearchQuery(e.target.value)} 
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                    <label htmlFor="status-filter" className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                    <select id="status-filter" value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                        <option value="all">Todos</option>
                        <option value="Confirmado">Confirmado</option>
                        <option value="Pendente">Pendente</option>
                        <option value="Cancelado">Cancelado</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="start-date" className="block text-xs font-medium text-slate-600 mb-1">Data Início</label>
                    <input id="start-date" type="date" value={dateRange.start} onChange={e => setDateRange(prev => ({...prev, start: e.target.value}))} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                    <label htmlFor="end-date" className="block text-xs font-medium text-slate-600 mb-1">Data Fim</label>
                    <input id="end-date" type="date" value={dateRange.end} onChange={e => setDateRange(prev => ({...prev, end: e.target.value}))} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div className="flex items-end">
                    {hasActiveFilters && (
                        <button onClick={handleClearFilters} className="w-full px-4 py-2 bg-slate-100 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-200 border border-slate-300">
                            Limpar Filtros
                        </button>
                    )}
                </div>
            </div>
             {isLeader && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                    <div className="flex items-center">
                        <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                            <input 
                                type="checkbox" 
                                name="toggle" 
                                id="toggle-my-events" 
                                checked={showOnlyMyDepartmentEvents}
                                onChange={(e) => setShowOnlyMyDepartmentEvents(e.target.checked)}
                                className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                            />
                            <label htmlFor="toggle-my-events" className="toggle-label block overflow-hidden h-6 rounded-full bg-slate-300 cursor-pointer"></label>
                        </div>
                        <label htmlFor="toggle-my-events" className="text-sm text-slate-600 cursor-pointer">Mostrar apenas os eventos do meu departamento</label>
                    </div>
                     <style>{`
                        .toggle-checkbox:checked {
                            right: 0;
                            border-color: #2563eb;
                        }
                        .toggle-checkbox:checked + .toggle-label {
                            background-color: #2563eb;
                        }
                    `}</style>
                </div>
            )}
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