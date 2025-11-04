import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { TimelineTemplate, TimelineItem, DashboardEvent, Event as VolunteerEvent } from '../types';
import { supabase } from '../lib/supabaseClient';
import { getErrorMessage } from '../lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Props
interface EventTimelineViewerModalProps {
    isOpen: boolean;
    onClose: () => void;
    event: DashboardEvent | VolunteerEvent | null;
}

// Calculated Item Type
type CalculatedItem = TimelineItem & { startTime: string; endTime: string };

// Helper function to calculate times
const calculateTimes = (items: TimelineItem[], startTimeStr: string, dateStr: string): CalculatedItem[] => {
    if (!startTimeStr || !dateStr) return [];
    let currentTime = new Date(`${dateStr}T${startTimeStr}`);
    if (isNaN(currentTime.getTime())) {
        console.error("Invalid start time or date for timeline calculation");
        return [];
    }
    return [...items].sort((a,b) => a.ordem - b.ordem).map(item => {
        const itemStartTime = new Date(currentTime);
        currentTime.setMinutes(currentTime.getMinutes() + (item.duracao_minutos || 0));
        const itemEndTime = new Date(currentTime);
        return {
            ...item,
            startTime: itemStartTime.toTimeString().substring(0, 5),
            endTime: itemEndTime.toTimeString().substring(0, 5)
        };
    });
};

// Sub-component to render a single timeline view
const TimelineView: React.FC<{ items: CalculatedItem[] }> = ({ items }) => {
    if (items.length === 0) {
        return <p className="text-center text-slate-500 py-8">Nenhum item neste cronograma.</p>;
    }
    return (
        <div className="space-y-3">
            {items.map(item => (
                <div key={item.id || item.ordem} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex justify-between items-start">
                        <p className="font-bold text-slate-800 flex-1 pr-4">{item.titulo_item}</p>
                        <p className="text-sm font-mono font-semibold text-blue-600 flex-shrink-0">{item.startTime} - {item.endTime}</p>
                    </div>
                    {item.detalhes && <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{item.detalhes}</p>}
                    {item.links && item.links.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-200">
                            <div className="space-y-3">
                                {item.links.map((link, idx) => (
                                    <div key={idx} className="p-2 bg-white rounded-md border border-slate-200">
                                        <p className="text-sm font-semibold text-slate-700 break-words">{link.title}</p>
                                        <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1 mt-1">
                                            Acessar link
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                            </svg>
                                        </a>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <p className="text-right text-xs text-slate-500 mt-2">Duração: {item.duracao_minutos} min</p>
                </div>
            ))}
        </div>
    );
};

// Main Modal Component
const EventTimelineViewerModal: React.FC<EventTimelineViewerModalProps> = ({ isOpen, onClose, event }) => {
    const [principalTemplate, setPrincipalTemplate] = useState<TimelineTemplate | null>(null);
    const [kidsTemplate, setKidsTemplate] = useState<TimelineTemplate | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'principal' | 'kids'>('principal');

    useEffect(() => {
        if (!isOpen || !event) return;

        const fetchTemplates = async () => {
            setLoading(true);
            setError(null);
            setPrincipalTemplate(null);
            setKidsTemplate(null);

            try {
                const principalId = event.cronograma_principal_id;
                const kidsId = event.cronograma_kids_id;

                const templateIds = [principalId, kidsId].filter(Boolean);
                if (templateIds.length === 0) {
                    setLoading(false);
                    return;
                }

                const { data, error } = await supabase
                    .from('cronograma_modelos')
                    .select('*, cronograma_itens(*)')
                    .in('id', templateIds);
                
                if (error) throw error;

                const pTemplate = data.find(t => t.id === principalId) || null;
                const kTemplate = data.find(t => t.id === kidsId) || null;
                
                setPrincipalTemplate(pTemplate);
                setKidsTemplate(kTemplate);

                // Set initial active tab
                if (pTemplate) {
                    setActiveTab('principal');
                } else if (kTemplate) {
                    setActiveTab('kids');
                }

            } catch (err) {
                setError(getErrorMessage(err));
            } finally {
                setLoading(false);
            }
        };
        fetchTemplates();
    }, [isOpen, event]);

    const calculatedPrincipalItems = useMemo(() => {
        if (!principalTemplate || !event) return [];
        return calculateTimes(principalTemplate.cronograma_itens, event.start_time, event.date);
    }, [principalTemplate, event]);

    const calculatedKidsItems = useMemo(() => {
        if (!kidsTemplate || !event) return [];
        return calculateTimes(kidsTemplate.cronograma_itens, event.start_time, event.date);
    }, [kidsTemplate, event]);
    
    const handleDownloadPDF = () => {
        if (!event) return;
    
        const hasPrincipal = principalTemplate && calculatedPrincipalItems.length > 0;
        const hasKids = kidsTemplate && calculatedKidsItems.length > 0;
    
        if (!hasPrincipal && !hasKids) {
            alert("Nenhum cronograma para exportar.");
            return;
        }
    
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 14;
        let y = 20;
    
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor('#334155'); // slate-700
        doc.text(`Cronograma: ${event.name}`, pageWidth / 2, y, { align: 'center' });
        y += 15;
        
        const addTimelineToDoc = (title: string, items: CalculatedItem[]) => {
            const pageBreakCheck = (neededHeight: number) => {
                if (y + neededHeight > pageHeight - margin) {
                    doc.addPage();
                    y = margin;
                }
            };
    
            pageBreakCheck(20);
    
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor('#1e293b'); // slate-800
            doc.text(title, margin, y);
            y += 8;
    
            items.forEach(item => {
                let cardHeight = 18; // Base height for padding and title
                const cardContentWidth = pageWidth - (margin * 2) - 16; // Card padding
    
                doc.setFontSize(10);
                if (item.detalhes) {
                    const detailLines = doc.splitTextToSize(item.detalhes, cardContentWidth);
                    cardHeight += (detailLines.length * 5) + 4;
                }
    
                if (item.links && item.links.length > 0) {
                    cardHeight += 4;
                    item.links.forEach(link => {
                        doc.setFont('helvetica', 'bold');
                        const titleLines = doc.splitTextToSize(link.title, cardContentWidth);
                        cardHeight += (titleLines.length * 5) + 8; // Title + "Acessar link" + spacing
                    });
                }
                
                pageBreakCheck(cardHeight);
    
                // Draw card background
                doc.setFillColor('#f8fafc'); // slate-50
                doc.setDrawColor('#e2e8f0'); // slate-200
                doc.roundedRect(margin, y, pageWidth - (margin * 2), cardHeight, 3, 3, 'FD');
    
                let textY = y + 8;
    
                // Draw header (time, title, duration)
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor('#2563EB'); // blue-600
                doc.text(`${item.startTime} - ${item.endTime}`, margin + 8, textY);
    
                doc.setFontSize(12);
                doc.setTextColor('#1e293b');
                const titleLines = doc.splitTextToSize(item.titulo_item, cardContentWidth - 60);
                doc.text(titleLines, margin + 8, textY + 6);
                
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor('#64748b'); // slate-500
                doc.text(`${item.duracao_minutos} min`, pageWidth - margin - 8, textY, { align: 'right' });
    
                textY += (titleLines.length * 5) + 8;
    
                // Draw Details
                if (item.detalhes) {
                    doc.setFontSize(10);
                    doc.setTextColor('#475569'); // slate-600
                    const detailLines = doc.splitTextToSize(item.detalhes, cardContentWidth);
                    doc.text(detailLines, margin + 8, textY);
                    textY += (detailLines.length * 5) + 4;
                }
    
                // Draw Links
                if (item.links && item.links.length > 0) {
                    doc.setDrawColor('#e2e8f0');
                    doc.line(margin + 8, textY, pageWidth - margin - 8, textY);
                    textY += 6;
    
                    item.links.forEach(link => {
                        doc.setFontSize(10);
                        doc.setFont('helvetica', 'bold');
                        doc.setTextColor('#334155');
                        const linkTitleLines = doc.splitTextToSize(link.title, cardContentWidth);
                        doc.text(linkTitleLines, margin + 8, textY);
                        textY += (linkTitleLines.length * 5);
                        
                        doc.setFont('helvetica', 'normal');
                        doc.setTextColor('#2563EB');
                        doc.textWithLink('Acessar link', margin + 8, textY + 1, { url: link.url });
                        textY += 8;
                    });
                }
    
                y += cardHeight + 5;
            });
            y += 10;
        };
    
        if (hasPrincipal) addTimelineToDoc(principalTemplate!.nome_modelo, calculatedPrincipalItems);
        if (hasKids) addTimelineToDoc(kidsTemplate!.nome_modelo, calculatedKidsItems);
    
        const safeFileName = `Cronograma_${event.name.replace(/[^a-z0-9]/gi, '_')}.pdf`;
        doc.save(safeFileName);
    };

    const TabButton: React.FC<{label: string; isActive: boolean; onClick: () => void}> = ({label, isActive, onClick}) => (
        <button onClick={onClick} className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${isActive ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'}`}>
            {label}
        </button>
    );

    const modalContent = (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 m-4 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-start mb-2">
                    <h3 className="text-2xl font-bold text-slate-900">Cronograma do Evento</h3>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={handleDownloadPDF}
                            className="p-1.5 text-slate-500 hover:text-blue-600 rounded-md hover:bg-blue-50 transition-colors"
                            title="Baixar PDF"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                        </button>
                        <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
              </button>
                    </div>
                </div>
                {loading ? <p className="text-center py-8">Carregando cronogramas...</p> : error ? <p className="text-center py-8 text-red-500">{error}</p> : (
                    <>
                        {(principalTemplate || kidsTemplate) ? (
                            <div className="border-b border-slate-200 -mx-6 px-6 mb-4">
                                <div className="flex items-center gap-4">
                                    {principalTemplate && <TabButton label={principalTemplate.nome_modelo} isActive={activeTab === 'principal'} onClick={() => setActiveTab('principal')} />}
                                    {kidsTemplate && <TabButton label={kidsTemplate.nome_modelo} isActive={activeTab === 'kids'} onClick={() => setActiveTab('kids')} />}
                                </div>
                            </div>
                        ) : null}
                        
                        <div className="overflow-y-auto flex-grow pr-2">
                            {activeTab === 'principal' && principalTemplate && <TimelineView items={calculatedPrincipalItems} />}
                            {activeTab === 'kids' && kidsTemplate && <TimelineView items={calculatedKidsItems} />}
                             {!principalTemplate && !kidsTemplate && (
                                <p className="text-center text-slate-500 py-8">Nenhum cronograma associado a este evento.</p>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
    
    if (!isOpen) return null;
    return ReactDOM.createPortal(modalContent, document.body);
};

export default EventTimelineViewerModal;