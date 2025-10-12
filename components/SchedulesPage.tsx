import React, { useState, useEffect, useCallback, useMemo } from 'react';
import EventCard from './EventCard';
import NewEventForm from './NewScheduleForm';
import ConfirmationModal from './ConfirmationModal';
import { Event } from '../types';
import { supabase } from '../lib/supabaseClient';
import { getErrorMessage } from '../lib/utils';
import Pagination from './Pagination';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface EventsPageProps {
  isFormOpen: boolean;
  setIsFormOpen: (isOpen: boolean) => void;
  userRole: string | null;
  leaderDepartmentId: number | null;
}

const ITEMS_PER_PAGE = 4;

const EventsPage: React.FC<EventsPageProps> = ({ isFormOpen, setIsFormOpen, userRole, leaderDepartmentId }) => {
  const [masterEvents, setMasterEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [eventToDeleteId, setEventToDeleteId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [highlightedEventId, setHighlightedEventId] = useState<number | null>(null);

  // Filters State
  const [dateFilters, setDateFilters] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showOnlyMyDepartmentEvents, setShowOnlyMyDepartmentEvents] = useState(false);

  const isLeader = userRole === 'leader' || userRole === 'lider';
  const isAdmin = userRole === 'admin';

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('events')
        .select('*, event_departments(department_id, departments(id, name, leader)), event_volunteers(volunteer_id, department_id, volunteers(id, name, email, initials, departments:departaments))')
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

      if (fetchError) throw fetchError;
      setMasterEvents((data as Event[]) || []);
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      console.error('Error fetching events:', errorMessage);
      setError(`Falha ao carregar eventos: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    const highlightId = sessionStorage.getItem('highlightEventId');
    if (highlightId) {
        setHighlightedEventId(parseInt(highlightId, 10));
        sessionStorage.removeItem('highlightEventId');
    }
  }, [fetchEvents]);

  const filteredEvents = useMemo(() => {
    let events = [...masterEvents];

    if (!dateFilters.start && !dateFilters.end) {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        events = events.filter(event => {
            const eventDate = new Date(event.date + 'T00:00:00');
            return eventDate >= firstDay && eventDate <= lastDay;
        });
    } else {
        if (dateFilters.start) events = events.filter(event => event.date >= dateFilters.start);
        if (dateFilters.end) events = events.filter(event => event.date <= dateFilters.end);
    }
    
    if (statusFilter !== 'all') {
        events = events.filter(event => event.status === statusFilter);
    }
    
    if (isLeader && showOnlyMyDepartmentEvents && leaderDepartmentId) {
        events = events.filter(event => 
            event.event_departments.some(ed => Number(ed.department_id) === Number(leaderDepartmentId))
        );
    }

    if (searchQuery) {
        const lowercasedQuery = searchQuery.toLowerCase();
        events = events.filter(e => e.name.toLowerCase().includes(lowercasedQuery));
    }

    return events;
  }, [masterEvents, dateFilters, statusFilter, showOnlyMyDepartmentEvents, isLeader, leaderDepartmentId, searchQuery]);

  const paginatedEvents = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredEvents.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [currentPage, filteredEvents]);

  const totalPages = Math.ceil(filteredEvents.length / ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, dateFilters, statusFilter, showOnlyMyDepartmentEvents]);

  const showForm = () => {
    setSaveError(null);
    setIsFormOpen(true);
  };
  const hideForm = () => {
    setIsFormOpen(false);
    setEditingEvent(null);
  };
  
  const handleDateFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDateFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleClearFilters = () => {
    setDateFilters({ start: '', end: '' });
    setStatusFilter('all');
    setSearchQuery('');
    if (isLeader) {
      setShowOnlyMyDepartmentEvents(false);
    }
    setCurrentPage(1);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const today = new Date().toLocaleDateString('pt-BR');
    let lastHeaderPage = 0;

    const pageHeader = (docInstance: jsPDF) => {
        const currentPage = docInstance.internal.getNumberOfPages();
        if (currentPage === lastHeaderPage) {
            return; // Prevent duplicate headers on the same page
        }
        lastHeaderPage = currentPage;
        
        docInstance.setFontSize(10);
        docInstance.setTextColor(150);
        docInstance.text('Volunteers - Sistema da Igreja', 14, 10);
        docInstance.text(`Gerado em: ${today}`, docInstance.internal.pageSize.width - 14, 10, { align: 'right' });
        docInstance.setDrawColor(226, 232, 240); // slate-200
        docInstance.line(14, 13, docInstance.internal.pageSize.width - 14, 13);
    };

    pageHeader(doc);

    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40);
    doc.text('Relatório dos Eventos', doc.internal.pageSize.width / 2, 25, { align: 'center' });

    let y = 35;

    const isFilteredByMyDept = isLeader && showOnlyMyDepartmentEvents;
    if (isFilteredByMyDept && leaderDepartmentId) {
        let departmentName = '';
        let leaderName = '';
        let totalVolunteersForDept = 0;

        for (const event of filteredEvents) {
            const deptInfo = event.event_departments.find(ed => ed.department_id === leaderDepartmentId)?.departments;
            if (deptInfo) {
                departmentName = deptInfo.name;
                leaderName = deptInfo.leader || 'N/A';
                break;
            }
        }
        
        filteredEvents.forEach(event => {
            totalVolunteersForDept += event.event_volunteers.filter(ev => ev.department_id === leaderDepartmentId).length;
        });

        if (departmentName) {
            doc.setFontSize(11);
            doc.setTextColor(82, 82, 91); // slate-600

            doc.setFont('helvetica', 'bold');
            doc.text('Departamento:', 14, y);
            doc.setFont('helvetica', 'normal');
            doc.text(`${departmentName} (Líder: ${leaderName})`, 43, y);
            y += 6;
            
            doc.setFont('helvetica', 'bold');
            doc.text('Total de Voluntários Escalados:', 14, y);
            doc.setFont('helvetica', 'normal');
            doc.text(String(totalVolunteersForDept), 75, y);
            y += 10;

            doc.setDrawColor(226, 232, 240);
            doc.line(14, y - 5, doc.internal.pageSize.width - 14, y - 5);
        }
    } else if (isAdmin) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40);
        doc.text('Resumo por Departamento', 14, y);
        y += 8;

        const departmentSummary = new Map<number, { name: string; leader: string; volunteerCount: number; }>();

        filteredEvents.forEach(event => {
            event.event_departments.forEach(ed => {
                if (ed.departments && !departmentSummary.has(ed.department_id)) {
                    departmentSummary.set(ed.department_id, {
                        name: ed.departments.name,
                        leader: ed.departments.leader || 'N/A',
                        volunteerCount: 0
                    });
                }
            });
        });

        filteredEvents.forEach(event => {
            event.event_volunteers.forEach(ev => {
                const summary = departmentSummary.get(ev.department_id);
                if (summary) {
                    summary.volunteerCount += 1;
                }
            });
        });

        const summaryBody = Array.from(departmentSummary.values()).map(summary => [
            summary.name,
            summary.leader,
            summary.volunteerCount.toString()
        ]);
        
        if (summaryBody.length > 0) {
            autoTable(doc, {
                startY: y,
                head: [["Departamento", "Líder", "Total de Voluntários Escalados"]],
                body: summaryBody,
                theme: 'striped',
                headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' }, // Blue color for summary
                styles: { font: "helvetica", fontSize: 10, cellPadding: 2 },
                margin: { left: 14, right: 14 },
                didDrawPage: () => pageHeader(doc)
            });
            // @ts-ignore
            y = (doc as any).lastAutoTable.finalY + 15;
        } else {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(150);
            doc.text('Nenhum dado departamental para resumir.', 14, y);
            y += 10;
        }
        
        doc.setDrawColor(226, 232, 240);
        doc.line(14, y - 5, doc.internal.pageSize.width - 14, y - 5);
    }


    filteredEvents.forEach((event) => {
        const MIN_BLOCK_HEIGHT = 45; 
        if (y + MIN_BLOCK_HEIGHT > 280) {
            doc.addPage();
            pageHeader(doc);
            y = 25;
        }

        const eventColor = event.color || '#e2e8f0'; 
        doc.setFillColor(eventColor);
        const lineHeight16 = doc.getTextDimensions('T', { fontSize: 16 }).h;
        doc.rect(14, y - lineHeight16 + 2, 3, lineHeight16, 'F');

        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40);
        doc.text(event.name, 20, y);
        y += 8;

        const eventDate = new Date(event.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const eventTime = `${event.start_time.substring(0, 5)} - ${event.end_time.substring(0, 5)}`;
        const details = `Data: ${eventDate} | Horário: ${eventTime} | Status: ${event.status}`;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100);
        doc.text(details, 20, y);
        y += 6;

        let totalVolunteersInEvent = 0;
        if (isFilteredByMyDept && leaderDepartmentId) {
            totalVolunteersInEvent = event.event_volunteers.filter(ev => ev.department_id === leaderDepartmentId).length;
        } else {
            totalVolunteersInEvent = event.event_volunteers.length;
        }
        
        doc.setFont('helvetica', 'bold');
        doc.text(`Total de Voluntários: ${totalVolunteersInEvent}`, 20, y);
        y += 8;

        const tableBody: any[][] = [];
        let departmentsToProcess = event.event_departments;
        if (isFilteredByMyDept && leaderDepartmentId) {
             departmentsToProcess = event.event_departments.filter(ed => ed.department_id === leaderDepartmentId);
        }
        
        if (departmentsToProcess.length > 0) {
            departmentsToProcess.forEach(eventDept => {
                const deptInfo = eventDept.departments;
                if (!deptInfo) return;
                const leaderName = deptInfo.leader || 'N/A';
                const volunteersForDept = event.event_volunteers
                    .filter(ev => ev.department_id === deptInfo.id)
                    .map(ev => ev.volunteers?.name)
                    .filter(Boolean)
                    .join('\n');
                
                tableBody.push([deptInfo.name, leaderName, volunteersForDept || 'Nenhum voluntário']);
            });

            autoTable(doc, {
                startY: y,
                head: [["Departamento", "Líder", "Voluntários Escalados"]],
                body: tableBody,
                theme: 'striped',
                headStyles: { fillColor: [45, 88, 108], textColor: 255, fontStyle: 'bold' },
                styles: { font: "helvetica", fontSize: 10, cellPadding: 2, halign: 'left' },
                columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 50 }, 2: { cellWidth: 'auto' } },
                alternateRowStyles: { fillColor: [248, 249, 250] },
                margin: { left: 14, right: 14 },
                didDrawPage: () => pageHeader(doc)
            });
            // @ts-ignore
            y = (doc as any).lastAutoTable.finalY + 15;
        } else {
             doc.setFontSize(10);
             doc.setFont('helvetica', 'italic');
             doc.setTextColor(150);
             doc.text('Nenhum departamento escalado para este evento.', 20, y);
             y += 15;
        }
    });

    doc.output('dataurlnewwindow');
  };

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event);
    showForm();
  };

  const handleDeleteRequest = (id: number) => {
    setEventToDeleteId(id);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!eventToDeleteId) return;
    const { error: deleteError } = await supabase.from('events').delete().eq('id', eventToDeleteId);
    if (deleteError) {
      alert(`Falha ao excluir evento: ${getErrorMessage(deleteError)}`);
    } else {
      await fetchEvents();
    }
    setIsDeleteModalOpen(false);
    setEventToDeleteId(null);
  };

  const handleSaveEvent = async (eventData: any) => {
    setIsSaving(true);
    setSaveError(null);
    try {
        const isSchedulingMode = isLeader && eventData.id;
        if (isSchedulingMode) {
            const { error: deleteError } = await supabase.from('event_volunteers').delete().eq('event_id', eventData.id).eq('department_id', leaderDepartmentId);
            if (deleteError) throw deleteError;

            if (eventData.volunteer_ids && eventData.volunteer_ids.length > 0) {
                const volunteersToInsert = eventData.volunteer_ids.map((vol_id: number) => ({
                    event_id: eventData.id, volunteer_id: vol_id, department_id: leaderDepartmentId,
                }));
                const { error: insertError } = await supabase.from('event_volunteers').insert(volunteersToInsert);
                if (insertError) throw insertError;
            }
        } else {
            const { id, ...upsertData } = eventData;
            const { error } = await supabase.from('events').upsert(upsertData).select().single();
            if (error) throw error;
        }
        await fetchEvents();
        hideForm();
    } catch (err) {
        setSaveError(getErrorMessage(err));
    } finally {
        setIsSaving(false);
    }
  };
  
  const handleAddDepartment = async (event: Event) => {
    if (!leaderDepartmentId || !event.id) return;
    if (event.event_departments.some(ed => ed.department_id === leaderDepartmentId)) return;
    const { error } = await supabase.from('event_departments').insert({ event_id: event.id, department_id: leaderDepartmentId });
    if (error) {
      alert(`Falha ao adicionar departamento: ${getErrorMessage(error)}`);
    } else {
      await fetchEvents();
    }
  };

  const renderContent = () => {
    if (loading) return <p className="text-center text-slate-500 mt-10">Carregando eventos...</p>;
    if (error) return <p className="text-center text-red-500 mt-10">{error}</p>;
    return (
      <div className="space-y-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div className="relative lg:col-span-2">
                    <label htmlFor="search" className="sr-only">Buscar</label>
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg></div>
                    <input type="text" id="search" placeholder="Buscar por nome..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-blue-500 text-slate-900 bg-white" />
                </div>
                <div className="relative">
                    <label htmlFor="start" className="block text-sm font-medium text-slate-700 mb-1">Data Início</label>
                    <input type="date" name="start" id="start" value={dateFilters.start} onChange={handleDateFilterChange} className="w-full pl-3 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-blue-500 text-slate-900 bg-white" />
                    {dateFilters.start && <button onClick={() => setDateFilters(p => ({...p, start: ''}))} className="absolute right-2 top-8 p-1 text-slate-400 hover:text-slate-600"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>}
                </div>
                <div className="relative">
                    <label htmlFor="end" className="block text-sm font-medium text-slate-700 mb-1">Data Fim</label>
                    <input type="date" name="end" id="end" value={dateFilters.end} onChange={handleDateFilterChange} min={dateFilters.start} className="w-full pl-3 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-blue-500 text-slate-900 bg-white" />
                    {dateFilters.end && <button onClick={() => setDateFilters(p => ({...p, end: ''}))} className="absolute right-2 top-8 p-1 text-slate-400 hover:text-slate-600"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>}
                </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-4">
                <div className="relative">
                    <label htmlFor="status" className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                    <select id="status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="appearance-none w-full md:w-auto pl-3 pr-8 py-2 border border-slate-300 rounded-lg focus:ring-blue-500 text-slate-900 bg-white">
                        <option value="all">Todos</option><option value="Confirmado">Confirmado</option><option value="Pendente">Pendente</option><option value="Cancelado">Cancelado</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 top-6 flex items-center px-2 pointer-events-none"><svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg></div>
                </div>
                {isLeader && (
                    <div className="flex items-center pt-6">
                        <input type="checkbox" id="myDept" checked={showOnlyMyDepartmentEvents} onChange={(e) => setShowOnlyMyDepartmentEvents(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        <label htmlFor="myDept" className="ml-2 text-sm text-slate-700">Apenas meu departamento</label>
                    </div>
                )}
                <button onClick={handleClearFilters} className="mt-6 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 rounded-lg">Limpar Filtros</button>
            </div>
        </div>
        {paginatedEvents.length > 0 ? (
          <>
            <div className="space-y-4">
                {paginatedEvents.map(event => (
                    <EventCard key={event.id} event={event} userRole={userRole} leaderDepartmentId={leaderDepartmentId} onEdit={handleEditEvent} onDelete={handleDeleteRequest} onAddDepartment={handleAddDepartment} isHighlighted={event.id === highlightedEventId} isFilteredByMyDepartment={showOnlyMyDepartmentEvents} />
                ))}
            </div>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </>
        ) : (
            <div className="text-center py-12 text-slate-500"><h3 className="text-lg font-medium text-slate-800">Nenhum evento encontrado</h3><p className="mt-1 text-sm">Tente ajustar seus filtros ou crie um novo evento.</p></div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Eventos</h1>
          <p className="text-slate-500 mt-1">Gerencie os eventos e escale os voluntários</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
            {(isAdmin || isLeader) && (
                <button onClick={handleExportPDF} className="bg-white border border-slate-300 text-slate-700 font-semibold px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors shadow-sm flex items-center justify-center space-x-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    <span>Visualizar Relatório</span>
                </button>
            )}
            {isAdmin && (
            <button onClick={() => { setEditingEvent(null); showForm(); }} className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm flex items-center justify-center space-x-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <span>Novo Evento</span>
            </button>
            )}
        </div>
      </div>

      {isFormOpen ? (
        <NewEventForm initialData={editingEvent} onCancel={hideForm} onSave={handleSaveEvent} isSaving={isSaving} saveError={saveError} userRole={userRole} leaderDepartmentId={leaderDepartmentId} />
      ) : (
        renderContent()
      )}

      <ConfirmationModal isOpen={isDeleteModalOpen} onClose={() => {setIsDeleteModalOpen(false); setEventToDeleteId(null);}} onConfirm={handleConfirmDelete} title="Confirmar Exclusão" message="Tem certeza que deseja excluir este evento? Esta ação e todos os dados de escala associados serão perdidos permanentemente." />
    </div>
  );
};

export default EventsPage;