import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import EventCard from './EventCard';
import NewEventForm from './NewScheduleForm';
import ConfirmationModal from './ConfirmationModal';
import CustomDatePicker from './CustomDatePicker'; // Import the new component
import QRScannerModal from './QRScannerModal'; // Import the QR scanner modal
import { Event, NotificationRecord } from '../types';
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
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanningEvent, setScanningEvent] = useState<Event | null>(null);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);


  // Filters State
  const [dateFilters, setDateFilters] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showOnlyMyDepartmentEvents, setShowOnlyMyDepartmentEvents] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);


  const isLeader = userRole === 'leader' || userRole === 'lider';
  const isAdmin = userRole === 'admin';

  const showForm = useCallback(() => {
    setSaveError(null);
    setIsFormOpen(true);
  }, [setIsFormOpen]);

  const hideForm = useCallback(() => {
    setIsFormOpen(false);
    setEditingEvent(null);
  }, [setIsFormOpen]);
  
  const handleEditEvent = useCallback((event: Event) => {
    setEditingEvent(event);
    showForm();
  }, [showForm]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('events')
        .select('*, event_departments(department_id, departments(id, name, leader)), event_volunteers(volunteer_id, department_id, present, volunteers(id, user_id, name, email, initials, departments:departaments))')
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
  
  const showNotification = useCallback((message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  const handleScanSuccess = useCallback((decodedText: string) => {
    setIsScannerOpen(false);
    
    const processScan = async () => {
        try {
            const data = JSON.parse(decodedText);
            if (!data.vId || !data.eId || !data.dId) {
                throw new Error("QR Code inválido: Faltando dados essenciais.");
            }
            if (data.eId !== scanningEvent?.id) {
                throw new Error("Este QR Code é para um evento diferente.");
            }
            if (data.dId !== leaderDepartmentId) {
                throw new Error("Este voluntário não pertence ao seu departamento para este evento.");
            }

            const { error: invokeError } = await supabase.functions.invoke('mark-attendance', {
                body: { volunteerId: data.vId, eventId: data.eId, departmentId: data.dId },
            });

            if (invokeError) throw invokeError;
            
            const volunteerName = scanningEvent?.event_volunteers.find(v => v.volunteer_id === data.vId)?.volunteers?.name || 'Voluntário';
            showNotification(`Presença de ${volunteerName} confirmada com sucesso!`, 'success');
            
            setMasterEvents(prevEvents => prevEvents.map(event => {
                if (event.id === scanningEvent.id) {
                    const updatedVolunteers = event.event_volunteers.map(v => {
                        if (v.volunteer_id === data.vId && v.department_id === data.dId) {
                            return { ...v, present: true };
                        }
                        return v;
                    });
                    return { ...event, event_volunteers: updatedVolunteers };
                }
                return event;
            }));

        } catch (err: any) {
            if (err.context && typeof err.context.json === 'function') {
                try {
                    const errorJson = await err.context.json();
                    if (errorJson && errorJson.error) {
                        showNotification(errorJson.error, 'error');
                    } else {
                        showNotification(getErrorMessage(err), 'error');
                    }
                } catch (parseError) {
                    showNotification(getErrorMessage(err), 'error');
                }
            } else {
                showNotification(getErrorMessage(err), 'error');
            }
        } finally {
            setScanningEvent(null);
        }
    };

    processScan();
  }, [scanningEvent, leaderDepartmentId, showNotification]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
            setIsStatusDropdownOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  useEffect(() => {
    fetchEvents();
    const highlightId = sessionStorage.getItem('highlightEventId');
    if (highlightId) {
        setHighlightedEventId(parseInt(highlightId, 10));
        sessionStorage.removeItem('highlightEventId');
    }
  }, [fetchEvents]);

  useEffect(() => {
    const editId = sessionStorage.getItem('editEventId');
    if (editId && masterEvents.length > 0) {
        sessionStorage.removeItem('editEventId');
        const eventToEdit = masterEvents.find(e => e.id === parseInt(editId, 10));
        if (eventToEdit) {
            handleEditEvent(eventToEdit);
        }
    }
  }, [masterEvents, handleEditEvent]);

  const filteredEvents = useMemo(() => {
    let events = [...masterEvents];

    if (!dateFilters.start && !dateFilters.end) {
        const now = new Date();
        const firstDayOfYear = new Date(now.getFullYear(), 0, 1);
        const lastDayOfYear = new Date(now.getFullYear(), 11, 31);
        events = events.filter(event => {
            const eventDate = new Date(event.date + 'T00:00:00');
            return eventDate >= firstDayOfYear && eventDate <= lastDayOfYear;
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
  
  const handleStartDateChange = (value: string) => {
    setDateFilters(prev => ({ ...prev, start: value }));
  };

  const handleEndDateChange = (value: string) => {
      setDateFilters(prev => ({ ...prev, end: value }));
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
        // FIX: Cast `docInstance.internal` to `any` to access `getNumberOfPages` which may not be in the type definition.
        const currentPage = (docInstance.internal as any).getNumberOfPages();
        if (currentPage === lastHeaderPage) {
            return; // Prevent duplicate headers on the same page
        }
        lastHeaderPage = currentPage;
        
        docInstance.setFontSize(10);
        docInstance.setTextColor(150);
        docInstance.text('Volunteers - Amar e servir', 14, 10);
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
        let totalPresentForDept = 0;

        for (const event of filteredEvents) {
            const deptInfo = event.event_departments.find(ed => ed.department_id === leaderDepartmentId)?.departments;
            if (deptInfo) {
                departmentName = deptInfo.name;
                leaderName = deptInfo.leader || 'N/A';
                break;
            }
        }
        
        filteredEvents.forEach(event => {
            const volunteersInEventForDept = event.event_volunteers.filter(ev => ev.department_id === leaderDepartmentId);
            totalVolunteersForDept += volunteersInEventForDept.length;
            totalPresentForDept += volunteersInEventForDept.filter(ev => ev.present === true).length;
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
            y += 6;

            doc.setFont('helvetica', 'bold');
            doc.text('Total de Presenças Confirmadas:', 14, y);
            doc.setFont('helvetica', 'normal');
            doc.text(`${totalPresentForDept} de ${totalVolunteersForDept}`, 75, y);
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

        const departmentSummary = new Map<number, { name: string; leader: string; volunteerCount: number; presentCount: number }>();

        filteredEvents.forEach(event => {
            event.event_departments.forEach(ed => {
                if (ed.departments && !departmentSummary.has(ed.department_id)) {
                    departmentSummary.set(ed.department_id, {
                        name: ed.departments.name,
                        leader: ed.departments.leader || 'N/A',
                        volunteerCount: 0,
                        presentCount: 0,
                    });
                }
            });
        });

        filteredEvents.forEach(event => {
            event.event_volunteers.forEach(ev => {
                const summary = departmentSummary.get(ev.department_id);
                if (summary) {
                    summary.volunteerCount += 1;
                    if (ev.present === true) {
                        summary.presentCount += 1;
                    }
                }
            });
        });

        const summaryBody = Array.from(departmentSummary.values()).map(summary => [
            summary.name,
            summary.leader,
            `${summary.presentCount}/${summary.volunteerCount}`,
        ]);
        
        if (summaryBody.length > 0) {
            autoTable(doc, {
                startY: y,
                head: [["Departamento", "Líder", "Presença Total"]],
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
        let totalPresentInEvent = 0;
        if (isFilteredByMyDept && leaderDepartmentId) {
             const volunteersForMyDept = event.event_volunteers.filter(ev => ev.department_id === leaderDepartmentId);
            totalVolunteersInEvent = volunteersForMyDept.length;
            totalPresentInEvent = volunteersForMyDept.filter(ev => ev.present === true).length;
        } else {
            totalVolunteersInEvent = event.event_volunteers.length;
            totalPresentInEvent = event.event_volunteers.filter(ev => ev.present === true).length;
        }
        
        doc.setFont('helvetica', 'bold');
        doc.text(`Total de Voluntários: ${totalVolunteersInEvent}`, 20, y);
        y += 6;
        doc.text(`Presenças Confirmadas: ${totalPresentInEvent} de ${totalVolunteersInEvent}`, 20, y);
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
                    .filter(ev => ev.department_id === deptInfo.id);

                const presentCount = volunteersForDept.filter(v => v.present).length;
                const totalCount = volunteersForDept.length;
                const presenceSummary = `${presentCount}/${totalCount}`;
                
                const volunteersList = volunteersForDept.map(ev => {
                    const name = ev.volunteers?.name || 'Voluntário';
                    if (ev.present === true) return `${name} (Presente)`;
                    if (ev.present === false) return `${name} (Faltou)`;
                    return `${name} (Não marcado)`;
                }).join('\n');
                
                tableBody.push([deptInfo.name, leaderName, presenceSummary, volunteersList || 'Nenhum voluntário']);
            });

            autoTable(doc, {
                startY: y,
                head: [["Departamento", "Líder", "Presença", "Voluntários Escalados"]],
                body: tableBody,
                theme: 'striped',
                headStyles: { fillColor: [45, 88, 108], textColor: 255, fontStyle: 'bold' },
                styles: { font: "helvetica", fontSize: 10, cellPadding: 2, halign: 'left' },
                columnStyles: { 
                    0: { cellWidth: 40 }, 
                    1: { cellWidth: 40 }, 
                    2: { cellWidth: 20, halign: 'center' }, 
                    3: { cellWidth: 'auto' } 
                },
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

    doc.save('relatorio-eventos.pdf');
  };

  
   const handleMarkAttendance = (event: Event) => {
    setScanningEvent(event);
    setIsScannerOpen(true);
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

    const createAndSendNotifications = async (notifications: Omit<NotificationRecord, 'id' | 'created_at' | 'is_read'>[]) => {
        if (notifications.length === 0) return;
        try {
            const { error: invokeError } = await supabase.functions.invoke('create-notifications', {
                body: { notifications },
            });
            if (invokeError) throw invokeError;
        } catch (err) {
            console.error("Falha ao enviar notificações:", getErrorMessage(err));
        }
    };

    const handleSaveEvent = async (eventData: any) => {
        setIsSaving(true);
        setSaveError(null);
        try {
            const isSchedulingMode = isLeader && eventData.id;
            if (isSchedulingMode) {
                const eventId = eventData.id;
                const eventName = eventData.name;
                const newVolunteerIds = new Set(eventData.volunteer_ids || []);

                const { data: currentVolunteersData, error: currentVolError } = await supabase
                    .from('event_volunteers')
                    .select('volunteer_id, volunteers(user_id, name)')
                    .eq('event_id', eventId)
                    .eq('department_id', leaderDepartmentId);

                if (currentVolError) throw currentVolError;
                
                const currentVolunteers = currentVolunteersData || [];
                const currentVolunteerIds = new Set(currentVolunteers.map(v => v.volunteer_id));

                const addedVolunteerIds = [...newVolunteerIds].filter(id => !currentVolunteerIds.has(id));
                const removedVolunteers = currentVolunteers.filter(v => !newVolunteerIds.has(v.volunteer_id));

                const { error: deleteError } = await supabase.from('event_volunteers').delete().eq('event_id', eventId).eq('department_id', leaderDepartmentId);
                if (deleteError) throw deleteError;

                if (eventData.volunteer_ids && eventData.volunteer_ids.length > 0) {
                    const volunteersToInsert = eventData.volunteer_ids.map((vol_id: number) => ({
                        event_id: eventId, volunteer_id: vol_id, department_id: leaderDepartmentId,
                    }));
                    const { error: insertError } = await supabase.from('event_volunteers').insert(volunteersToInsert);
                    if (insertError) throw insertError;
                }

                const notifications: Omit<NotificationRecord, 'id' | 'created_at' | 'is_read'>[] = [];

                if (addedVolunteerIds.length > 0) {
                    const { data: addedUsers, error: usersError } = await supabase
                        .from('volunteers')
                        .select('user_id')
                        .in('id', addedVolunteerIds);
                    
                    if (usersError) {
                        console.error("Could not fetch added volunteers for notification:", usersError);
                    } else if (addedUsers) {
                        addedUsers.filter(u => u.user_id).forEach(u => {
                            notifications.push({
                                user_id: u.user_id!,
                                message: `Você foi escalado(a) para o evento "${eventName}".`,
                                type: 'new_schedule' as const,
                                related_event_id: eventId,
                            });
                        });
                    }
                }

                removedVolunteers.forEach(v => {
                    const volunteer = Array.isArray(v.volunteers) ? v.volunteers[0] : v.volunteers;
                    if (volunteer?.user_id) {
                        notifications.push({
                            user_id: volunteer.user_id,
                            message: `Você foi removido(a) da escala do evento "${eventName}".`,
                            type: 'event_update' as const,
                            related_event_id: eventId,
                        });
                    }
                });
                
                if (notifications.length > 0) {
                    await createAndSendNotifications(notifications);
                }

            } else { // Admin creating or editing an event
                const { volunteer_ids, ...eventPayload } = eventData;

                let conflictQuery = supabase
                    .from('events')
                    .select('id, name, start_time, end_time')
                    .eq('date', eventPayload.date)
                    .lt('start_time', eventPayload.end_time)
                    .gt('end_time', eventPayload.start_time);
                
                if (eventPayload.id) {
                    conflictQuery = conflictQuery.neq('id', eventPayload.id);
                }
                const { data: conflictingEvents, error: conflictError } = await conflictQuery;
                if (conflictError) throw new Error(`Erro ao verificar conflitos: ${getErrorMessage(conflictError)}`);
                if (conflictingEvents && conflictingEvents.length > 0) {
                    const conflict = conflictingEvents[0];
                    const conflictMessage = `Conflito de horário com o evento "${conflict.name}" (${conflict.start_time.substring(0,5)} - ${conflict.end_time.substring(0,5)}).`;
                    throw new Error(conflictMessage);
                }
                
                let savedEvent;
                const isCreating = !eventPayload.id;

                if (isCreating) {
                    const { id, ...insertPayload } = eventPayload;
                    const { data: newEvent, error } = await supabase.from('events').insert(insertPayload).select().single();
                    if (error) throw error;
                    if (!newEvent) throw new Error("Falha ao criar o evento.");
                    savedEvent = newEvent;
    
                    // Notify leaders via Edge Function
                    const { error: leaderNotifyError } = await supabase.functions.invoke('create-notifications', {
                        body: {
                            notifyType: 'event_created',
                            event: savedEvent,
                        },
                    });
                    if (leaderNotifyError) {
                        console.error("Falha ao acionar notificações para líderes na criação do evento:", getErrorMessage(leaderNotifyError));
                    }
                } else { // Is Updating
                    const eventId = eventPayload.id;
                    const { id, ...updatePayload } = eventPayload;
                    const { data: updatedEvent, error } = await supabase.from('events').update(updatePayload).eq('id', eventId).select().single();
                    if (error) throw error;
                    if (!updatedEvent) throw new Error("Falha ao atualizar o evento.");
                    savedEvent = updatedEvent;
    
                    // Notify leaders and volunteers via Edge Function
                    const { error: notifyError } = await supabase.functions.invoke('create-notifications', {
                        body: { 
                            notifyType: 'event_updated',
                            event: savedEvent,
                        },
                    });
                    if (notifyError) {
                        console.error("Falha ao acionar notificações na atualização do evento:", getErrorMessage(notifyError));
                    }
                }
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
            const { data: dept, error: deptError } = await supabase
                .from('departments')
                .select('name')
                .eq('id', leaderDepartmentId)
                .single();

            if (deptError || !dept) {
                console.error("Não foi possível encontrar o nome do departamento para notificação", deptError);
                return;
            }

            const { data: volunteers, error: volError } = await supabase
                .from('volunteers')
                .select('user_id')
                .contains('departaments', [dept.name]);
            
            if (volError) {
                console.error("Não foi possível buscar voluntários para notificação do departamento:", volError);
            } else if (volunteers) {
                const notifications = volunteers
                    .filter(v => v.user_id)
                    .map(v => ({
                        user_id: v.user_id!,
                        message: `Um novo evento, "${event.name}", foi adicionado para o seu departamento.`,
                        type: 'new_event_for_department' as const,
                        related_event_id: event.id,
                    }));
                await createAndSendNotifications(notifications);
            }
        }
    };

    const renderContent = () => {
        if (loading) return <p className="text-center text-slate-500 mt-10">Carregando eventos...</p>;
        if (error) return <p className="text-center text-red-500 mt-10">{error}</p>;

        const statusFilterOptions = [
            { value: 'all', label: 'Todos os Status' },
            { value: 'Confirmado', label: 'Confirmado' },
            { value: 'Pendente', label: 'Pendente' },
            { value: 'Cancelado', label: 'Cancelado' },
        ];
        const selectedStatusLabel = statusFilterOptions.find(o => o.value === statusFilter)?.label;


        return (
            <div className="space-y-6">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <input type="text" placeholder="Buscar por nome do evento..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"/>
                        <CustomDatePicker name="start" value={dateFilters.start} onChange={(value: string) => setDateFilters(prev => ({ ...prev, start: value }))} />
                        <CustomDatePicker name="end" value={dateFilters.end} onChange={(value: string) => setDateFilters(prev => ({ ...prev, end: value }))} />
                        <div className="relative" ref={statusDropdownRef}>
                            <button
                                type="button"
                                onClick={() => setIsStatusDropdownOpen(prev => !prev)}
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg flex justify-between items-center cursor-pointer text-left h-full"
                                aria-haspopup="listbox"
                                aria-expanded={isStatusDropdownOpen}
                            >
                                <span className="text-slate-900">{selectedStatusLabel}</span>
                                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-slate-400 transition-transform flex-shrink-0 ${isStatusDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
</svg>
                            </button>
                            {isStatusDropdownOpen && (
                                <div className="absolute z-20 w-full top-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg">
                                    <ul className="py-1" role="listbox">
                                        {statusFilterOptions.map(option => (
                                            <li
                                                key={option.value}
                                                onClick={() => {
                                                    setStatusFilter(option.value);
                                                    setIsStatusDropdownOpen(false);
                                                }}
                                                className={`px-4 py-2 hover:bg-slate-100 cursor-pointer text-sm ${statusFilter === option.value ? 'font-semibold text-blue-600' : 'text-slate-700'}`}
                                                role="option"
                                                aria-selected={statusFilter === option.value}
                                            >
                                                {option.label}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4">
                        {isLeader && (
                        <div className="flex items-center">
                            <input type="checkbox" id="my-dept-filter" checked={showOnlyMyDepartmentEvents} onChange={(e) => setShowOnlyMyDepartmentEvents(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"/>
                            <label htmlFor="my-dept-filter" className="ml-2 block text-sm text-slate-900">Mostrar apenas meu departamento</label>
                        </div>
                        )}
                        <button onClick={handleClearFilters} className="text-sm text-blue-600 font-semibold hover:underline">Limpar Filtros</button>
                    </div>
                </div>

                {paginatedEvents.length > 0 ? (
                <>
                    <div className="space-y-6">
                        {paginatedEvents.map((event) => (
                        <EventCard 
                            key={event.id} 
                            event={event} 
                            userRole={userRole}
                            leaderDepartmentId={leaderDepartmentId}
                            onEdit={handleEditEvent}
                            onDelete={handleDeleteRequest}
                            onAddDepartment={handleAddDepartment}
                            onMarkAttendance={handleMarkAttendance}
                            isHighlighted={event.id === highlightedEventId}
                            isFilteredByMyDepartment={showOnlyMyDepartmentEvents}
                        />
                        ))}
                    </div>
                    <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    />
                </>
                ) : (
                <div className="text-center py-12 text-slate-500">
                    <h3 className="text-lg font-medium text-slate-800">Nenhum evento encontrado</h3>
                    <p className="mt-1 text-sm">Tente ajustar seus filtros ou adicione um novo evento.</p>
                </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6">
             {notification && (
                <div className={`fixed top-20 right-4 z-[9999] p-4 rounded-lg shadow-lg text-white ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
                    {notification.message}
                </div>
            )}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                <h1 className="text-3xl font-bold text-slate-800">Eventos</h1>
                <p className="text-slate-500 mt-1">Gerencie os eventos e escalas</p>
                </div>
                <div className="flex items-center gap-2">
                   <button 
    onClick={handleExportPDF}
    className="bg-white border border-slate-300 text-slate-700 font-semibold px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-slate-50 transition-colors shadow-sm"
>
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        className="h-5 w-5" 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
    >
        <path 
            strokeWidth={1.5} 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            d="M9 12.75l3 3m0 0l3-3m-3 3v-7.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
        />
    </svg>
    <span>Exportar PDF</span>
</button>
                    {isAdmin && (
                      <button 
    onClick={() => { setEditingEvent(null); showForm(); }}
    className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 transition-colors shadow-sm"
>
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        className="h-5 w-5" 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
    >
        <path 
            strokeWidth={1.5} 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" 
        />
    </svg>
    <span>Novo Evento</span>
</button>
                    )}
                </div>
            </div>

            {isFormOpen ? (
                <NewEventForm 
                initialData={editingEvent}
                onCancel={hideForm}
                onSave={handleSaveEvent}
                isSaving={isSaving}
                saveError={saveError}
                userRole={userRole}
                leaderDepartmentId={leaderDepartmentId}
                />
            ) : (
                renderContent()
            )}

            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => {setIsDeleteModalOpen(false); setEventToDeleteId(null);}}
                onConfirm={handleConfirmDelete}
                title="Confirmar Exclusão"
                message="Tem certeza de que deseja excluir este evento? Todos os dados de escala associados serão perdidos."
            />
            {isScannerOpen && (
                <QRScannerModal
                    isOpen={isScannerOpen}
                    onClose={() => {setIsScannerOpen(false); setScanningEvent(null);}}
                    onScanSuccess={handleScanSuccess}
                    scanningEventName={scanningEvent?.name}
                />
            )}
        </div>
    );
}

export default EventsPage;