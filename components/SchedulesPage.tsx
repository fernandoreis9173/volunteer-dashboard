
import React, { useState, useEffect, useCallback } from 'react';
import NewEventForm from './NewScheduleForm';
import ConfirmationModal from './ConfirmationModal';
import EventCard from './EventCard';
import { Event } from '../types';
import { SupabaseClient } from '@supabase/supabase-js';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
}

const EventsPage: React.FC<EventsPageProps> = ({ supabase, isFormOpen, setIsFormOpen, userRole, leaderDepartmentId }) => {
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [eventToDeleteId, setEventToDeleteId] = useState<number | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const isLeader = userRole === 'leader' || userRole === 'lider';
  const [showOnlyMyDepartmentEvents, setShowOnlyMyDepartmentEvents] = useState(false);

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
      console.error('Error fetching events data:', error);
      setError(`Não foi possível carregar os dados dos eventos: ${error.message}`);
      setAllEvents([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, debouncedSearchQuery, selectedStatus, dateRange, isLeader, showOnlyMyDepartmentEvents, leaderDepartmentId]);
  
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
      await fetchEvents();
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

        } else if (isLeader && upsertData.id && leaderDepartmentId) {
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
  
  const handleAddDepartmentToEvent = async (event: Event) => {
    if (!supabase || !leaderDepartmentId || !event.id) return;

    const { error: insertError } = await supabase.from('event_departments').insert({
        event_id: event.id,
        department_id: leaderDepartmentId,
    });

    if (insertError) {
        alert(`Falha ao adicionar departamento ao evento: ${insertError.message}`);
        return;
    }
    
    await fetchEvents();
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
             <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                <button
                    onClick={handleExportPDF}
                    disabled={allEvents.length === 0 || loading}
                    className="bg-slate-700 text-white font-semibold px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-slate-800 transition-colors shadow-sm w-full md:w-auto justify-center disabled:bg-slate-400 disabled:cursor-not-allowed"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm2 10a1 1 0 10-2 0v3a1 1 0 102 0v-3zm2-3a1 1 0 011 1v5a1 1 0 11-2 0v-5a1 1 0 011-1zm4-1a1 1 0 10-2 0v7a1 1 0 102 0V8z" clipRule="evenodd" /></svg>
                    <span>Exportar Relatório (PDF)</span>
                </button>
                <button onClick={() => showForm()} className="bg-green-500 text-white font-semibold px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-green-600 transition-colors shadow-sm w-full md:w-auto justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
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
