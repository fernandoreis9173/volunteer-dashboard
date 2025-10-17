import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Event } from '../types';
import { supabase } from '../lib/supabaseClient';
import { getErrorMessage } from '../lib/utils';
import CustomDatePicker from './CustomDatePicker';
import Pagination from './Pagination';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const ITEMS_PER_PAGE = 5;

const VolunteerStatusBadge: React.FC<{ present: boolean | null }> = ({ present }) => {
    if (present === true) {
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800">Presente</span>;
    }
    if (present === false) {
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-800">Faltou</span>;
    }
    return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Não marcado</span>;
};


const FrequencyPage: React.FC = () => {
    const [masterEvents, setMasterEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [dateFilters, setDateFilters] = useState<{ start: string; end: string }>({ start: '', end: '' });
    const [attendanceFilter, setAttendanceFilter] = useState<string>('all');
    
    const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set());
    const [currentPage, setCurrentPage] = useState(1);
    
    const fetchEvents = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error: fetchError } = await supabase
                .from('events')
                .select('*, event_departments(department_id, departments(id, name, leader)), event_volunteers(volunteer_id, department_id, present, volunteers(id, name))')
                .order('date', { ascending: false })
                .order('start_time', { ascending: false });
    
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
    }, [fetchEvents]);

    const filteredEvents = useMemo(() => {
        let events = [...masterEvents];
        
        // This page is now only for confirmed events, simplifying the view.
        events = events.filter(event => event.status === 'Confirmado');
        
        if (dateFilters.start) events = events.filter(event => event.date >= dateFilters.start);
        if (dateFilters.end) events = events.filter(event => event.date <= dateFilters.end);
        
        return events;
    }, [masterEvents, dateFilters]);

    const paginatedEvents = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredEvents.slice(startIndex, startIndex + ITEMS_PER_PAGE);
      }, [currentPage, filteredEvents]);
    
      const totalPages = Math.ceil(filteredEvents.length / ITEMS_PER_PAGE);

    useEffect(() => {
        setCurrentPage(1);
    }, [dateFilters, attendanceFilter]);
    
    const handleSetToday = () => {
        const today = new Date().toISOString().split('T')[0];
        setDateFilters({ start: today, end: today });
    };

    const handleClearFilters = () => {
        setDateFilters({ start: '', end: '' });
        setAttendanceFilter('all');
    };

    const toggleEventExpansion = (eventId: number) => {
        setExpandedEvents(prev => {
            const newSet = new Set(prev);
            if (newSet.has(eventId)) {
                newSet.delete(eventId);
            } else {
                newSet.add(eventId);
            }
            return newSet;
        });
    };
    
    const handleExportPDF = () => {
        const doc = new jsPDF();
        const today = new Date().toLocaleDateString('pt-BR');
        let y = 35;
        let lastHeaderPage = 0;

        const pageHeader = (docInstance: jsPDF) => {
            const currentPage = (docInstance.internal as any).getNumberOfPages();
            if (currentPage === lastHeaderPage) return;
            lastHeaderPage = currentPage;

            docInstance.setFontSize(10);
            docInstance.setTextColor(150);
            docInstance.text('Relatório de Frequência', 14, 10);
            docInstance.text(`Gerado em: ${today}`, docInstance.internal.pageSize.width - 14, 10, { align: 'right' });
            docInstance.setDrawColor(226, 232, 240);
            docInstance.line(14, 13, docInstance.internal.pageSize.width - 14, 13);
        };

        pageHeader(doc);

        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40);
        doc.text('Relatório de Frequência', doc.internal.pageSize.width / 2, 25, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100);
        let filterText = 'Filtros aplicados: ';
        if (dateFilters.start && dateFilters.end) {
            filterText += `Período de ${new Date(dateFilters.start+'T00:00:00').toLocaleDateString('pt-BR')} a ${new Date(dateFilters.end+'T00:00:00').toLocaleDateString('pt-BR')}. `;
        } else if (dateFilters.start) {
            filterText += `A partir de ${new Date(dateFilters.start+'T00:00:00').toLocaleDateString('pt-BR')}. `;
        } else if (dateFilters.end) {
            filterText += `Até ${new Date(dateFilters.end+'T00:00:00').toLocaleDateString('pt-BR')}. `;
        }

        if (attendanceFilter !== 'all') {
            const statusLabel = attendanceFilter === 'present' ? 'Presentes' : 'Ausentes';
            filterText += `Status: ${statusLabel}.`;
        }
        
        if (filterText !== 'Filtros aplicados: ') {
            doc.text(filterText, 14, y);
            y += 8;
        }

        // --- Resumo Geral ---
        let totalPresent = 0;
        let totalAbsent = 0;
        let totalScheduled = 0;

        filteredEvents.forEach(event => {
            const hasEventEnded = new Date() > new Date(`${event.date}T${event.end_time}`);
            totalScheduled += event.event_volunteers.length;
            event.event_volunteers.forEach(v => {
                if (v.present === true) {
                    totalPresent++;
                } else if (v.present === false || v.present === null) {
                    if (hasEventEnded) {
                        totalAbsent++;
                    }
                }
            });
        });

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40);
        doc.text('Resumo do Período', 14, y);
        y += 8;
        
        autoTable(doc, {
            startY: y,
            body: [
                ['Total de Voluntários Escalados:', String(totalScheduled)],
                ['Total de Presenças Confirmadas:', String(totalPresent)],
                ['Total de Ausências (Faltas):', String(totalAbsent)],
            ],
            theme: 'plain',
            styles: { font: "helvetica", fontSize: 10, cellPadding: 1.5 },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 70 },
                1: { fontStyle: 'normal' }
            },
            margin: { left: 14, right: 14 },
            didDrawPage: () => pageHeader(doc)
        });
        y = (doc as any).lastAutoTable.finalY + 10;
        
        doc.setDrawColor(226, 232, 240);
        doc.line(14, y - 5, doc.internal.pageSize.width - 14, y - 5);
        y += 5;


        filteredEvents.forEach((event) => {
            const hasEventEnded = new Date() > new Date(`${event.date}T${event.end_time}`);
            const totalVolunteers = event.event_volunteers.length;
            const presentVolunteers = event.event_volunteers.filter(v => v.present === true).length;
            
            const eventBlockHeight = 25;
            if (y + eventBlockHeight > 280) {
                doc.addPage();
                pageHeader(doc);
                y = 25;
            }

            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(40);
            doc.text(event.name, 14, y);
            y += 8;

            const eventDate = new Date(event.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100);
            doc.text(`Data: ${eventDate} | Presença Total: ${presentVolunteers}/${totalVolunteers}`, 14, y);
            y += 8;

            const tableBody: any[][] = [];
            event.event_departments.forEach(eventDept => {
                if (!eventDept.departments) return;

                let volunteersForDept = event.event_volunteers.filter(ev => ev.department_id === eventDept.departments.id);

                if (attendanceFilter !== 'all') {
                    if (attendanceFilter === 'present') {
                        volunteersForDept = volunteersForDept.filter(v => v.present === true);
                    } else if (attendanceFilter === 'absent') {
                         volunteersForDept = volunteersForDept.filter(v => hasEventEnded && (v.present === false || v.present === null));
                    }
                }
                
                if (volunteersForDept.length > 0) {
                     volunteersForDept.forEach(v => {
                        let statusText;
                        if (v.present === true) {
                            statusText = 'Presente';
                        } else { // v.present is false or null
                            if (hasEventEnded) {
                                statusText = 'Faltou';
                            } else {
                                statusText = 'Não Marcado';
                            }
                        }

                        tableBody.push([
                            eventDept.departments.name,
                            v.volunteers?.name || 'Voluntário desconhecido',
                            statusText
                        ]);
                    });
                }
            });
            
            if (tableBody.length > 0) {
                autoTable(doc, {
                    startY: y,
                    head: [["Departamento", "Voluntário", "Status"]],
                    body: tableBody,
                    theme: 'striped',
                    headStyles: { fillColor: [37, 99, 235] },
                    styles: { fontSize: 10 },
                    margin: { left: 14, right: 14 },
                    didDrawPage: () => pageHeader(doc)
                });
                y = (doc as any).lastAutoTable.finalY + 15;
            } else {
                 doc.setFontSize(10);
                 doc.setFont('helvetica', 'italic');
                 doc.setTextColor(150);
                 doc.text('Nenhum voluntário para exibir com os filtros atuais.', 14, y);
                 y += 15;
            }
        });

        doc.save('relatorio-frequencia.pdf');
    };

    const renderContent = () => {
        if (loading) return <p className="text-center text-slate-500 mt-10">Carregando dados de frequência...</p>;
        if (error) return <p className="text-center text-red-500 mt-10">{error}</p>;
        if (filteredEvents.length === 0) {
            return (
                <div className="text-center py-12 text-slate-500 bg-white rounded-xl border border-slate-200">
                    <h3 className="text-lg font-medium text-slate-800">Nenhum evento encontrado</h3>
                    <p className="mt-1 text-sm">Tente ajustar seus filtros para encontrar resultados.</p>
                </div>
            );
        }

        return (
            <div className="space-y-4">
                {paginatedEvents.map(event => {
                    const isExpanded = expandedEvents.has(event.id!);
                    const hasEventEnded = new Date() > new Date(`${event.date}T${event.end_time}`);
                    const totalVolunteers = event.event_volunteers.length;
                    const presentVolunteers = event.event_volunteers.filter(v => v.present === true).length;
                    
                    return (
                        <div key={event.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50" onClick={() => toggleEventExpansion(event.id!)}>
                                <div className="min-w-0">
                                    <p className="font-bold text-slate-800 text-lg truncate">{event.name}</p>
                                    <p className="text-sm text-slate-500">
                                        {new Date(event.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                                    </p>
                                </div>
                                <div className="flex items-center gap-4 ml-4 flex-shrink-0">
                                     <div className="text-right">
                                        <p className="font-semibold text-slate-700">Presença</p>
                                        <p className="text-lg font-bold text-blue-600">{presentVolunteers}/{totalVolunteers}</p>
                                    </div>
                                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
                                </div>
                            </div>
                            {isExpanded && (
                                <div className="bg-slate-50/70 border-t border-slate-200 px-4 py-4 space-y-4">
                                    {event.event_departments.length > 0 ? event.event_departments.map(({ departments }) => {
                                        if (!departments) return null;
                                        
                                        let volunteersForDept = event.event_volunteers.filter(ev => ev.department_id === departments.id);
                                        const totalInDept = volunteersForDept.length;
                                        const presentInDept = volunteersForDept.filter(v => v.present === true).length;
                                        
                                        if (attendanceFilter !== 'all') {
                                            if (attendanceFilter === 'present') {
                                                volunteersForDept = volunteersForDept.filter(v => v.present === true);
                                            } else if (attendanceFilter === 'absent') {
                                                 volunteersForDept = volunteersForDept.filter(v => hasEventEnded && (v.present === false || v.present === null));
                                            }
                                        }

                                        if (volunteersForDept.length === 0) return null;

                                        return (
                                            <div key={departments.id} className="bg-white p-4 rounded-lg border border-slate-200">
                                                <div className="flex justify-between items-center mb-3">
                                                    <p className="font-semibold text-blue-800">{departments.name}</p>
                                                    <p className="text-sm font-bold text-slate-600">Presença: {presentInDept}/{totalInDept}</p>
                                                </div>
                                                <ul className="space-y-2">
                                                    {volunteersForDept.map(v => (
                                                        <li key={v.volunteer_id} className="flex justify-between items-center text-sm p-2 rounded bg-slate-50">
                                                            <span className="text-slate-700">{v.volunteers?.name || 'Voluntário desconhecido'}</span>
                                                            <VolunteerStatusBadge present={v.present === true ? true : (hasEventEnded ? false : null)} />
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        );
                                    }) : <p className="text-sm text-slate-500 text-center">Nenhum departamento escalado para este evento.</p>}
                                </div>
                            )}
                        </div>
                    );
                })}

                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                />
            </div>
        )
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Relatório de Frequência</h1>
                    <p className="text-slate-500 mt-1">Monitore a presença dos voluntários nos eventos confirmados.</p>
                </div>
                <button 
                    onClick={handleExportPDF}
                    className="bg-white border border-slate-300 text-slate-700 font-semibold px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-slate-50 transition-colors shadow-sm w-full md:w-auto justify-center"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <span>Exportar PDF</span>
                </button>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    <CustomDatePicker name="start" value={dateFilters.start} onChange={(val) => setDateFilters(p => ({...p, start: val}))} />
                    <CustomDatePicker name="end" value={dateFilters.end} onChange={(val) => setDateFilters(p => ({...p, end: val}))} />
                    <select value={attendanceFilter} onChange={(e) => setAttendanceFilter(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg">
                        <option value="all">Toda a Frequência</option>
                        <option value="present">Confirmados (Presente)</option>
                        <option value="absent">Não Confirmados (Faltou)</option>
                    </select>
                    <button onClick={handleSetToday} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
                        Hoje
                    </button>
                </div>
                <button onClick={handleClearFilters} className="text-sm text-blue-600 font-semibold hover:underline">Limpar Filtros</button>
            </div>

            {renderContent()}
        </div>
    );
};

export default FrequencyPage;