import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { TimelineTemplate, TimelineItem } from '../types';
import { supabase } from '../lib/supabaseClient';
import { getErrorMessage } from '../lib/utils';

interface TimelineViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    templateId: string;
    eventStartTime: string;
    eventDate: string;
}

type CalculatedItem = TimelineItem & { startTime: string; endTime: string };

const calculateTimes = (items: TimelineItem[], startTimeStr: string, dateStr: string): CalculatedItem[] => {
    if (!startTimeStr || !dateStr) return [];
    let currentTime = new Date(`${dateStr}T${startTimeStr}`);
    
    if (isNaN(currentTime.getTime())) {
        console.error("Invalid start time or date for timeline calculation");
        return [];
    }
    
    return items.map(item => {
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
                            <div className="flex flex-wrap gap-2">
                                {item.links.map((link, idx) => (
                                    <a href={link.url} key={idx} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.536a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                        </svg>
                                        {link.title}
                                    </a>
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

const TimelineViewModal: React.FC<TimelineViewModalProps> = ({ isOpen, onClose, templateId, eventStartTime, eventDate }) => {
    const [template, setTemplate] = useState<TimelineTemplate | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen || !templateId) return;
        const fetchTemplate = async () => {
            setLoading(true);
            setError(null);
            try {
                const { data, error } = await supabase
                    .from('cronograma_modelos')
                    .select('*, cronograma_itens(*)')
                    .eq('id', templateId)
                    .single();
                if (error) throw error;
                setTemplate(data);
            } catch (err) {
                setError(getErrorMessage(err));
            } finally {
                setLoading(false);
            }
        };
        fetchTemplate();
    }, [isOpen, templateId]);

    const calculatedItems = calculateTimes(
        (template?.cronograma_itens || []).sort((a,b) => a.ordem - b.ordem),
        eventStartTime,
        eventDate
    );

    const modalContent = (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 m-4 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-2xl font-bold text-slate-900">{template?.nome_modelo || 'Cronograma'}</h3>
                    <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full text-2xl leading-none">&times;</button>
                </div>
                {loading ? <p>Carregando...</p> : error ? <p className="text-red-500">{error}</p> : (
                    <div className="overflow-y-auto flex-grow pr-2">
                       <TimelineView items={calculatedItems} />
                    </div>
                )}
            </div>
        </div>
    );

    if (!isOpen) return null;

    return ReactDOM.createPortal(modalContent, document.body);
};

export default TimelineViewModal;