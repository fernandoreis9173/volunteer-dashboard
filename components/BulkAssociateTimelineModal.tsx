import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { supabase } from '../lib/supabaseClient';
import { getErrorMessage } from '../lib/utils';
import { TimelineTemplate, Event as AppEvent } from '../types';

interface BulkAssociateTimelineModalProps {
    isOpen: boolean;
    onClose: () => void;
    templates: TimelineTemplate[];
}

const BulkAssociateTimelineModal: React.FC<BulkAssociateTimelineModalProps> = ({ isOpen, onClose, templates }) => {
    const [events, setEvents] = useState<AppEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEventIds, setSelectedEventIds] = useState<Set<number>>(new Set());
    const [selectedPrincipalId, setSelectedPrincipalId] = useState<string>('');
    const [selectedKidsId, setSelectedKidsId] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchUpcomingEvents = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const today = new Date().toISOString().split('T')[0];

            const { data: upcomingEvents, error: fetchError } = await supabase
                .from('events')
                .select('id, name, date, start_time, cronograma_principal_id, cronograma_kids_id')
                .gte('date', today)
                .order('date', { ascending: true })
                .order('start_time', { ascending: true });

            if (fetchError) throw fetchError;

            setEvents((upcomingEvents as AppEvent[]) || []);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            fetchUpcomingEvents();
            setSelectedEventIds(new Set());
            setSearchTerm('');
            setSelectedPrincipalId('');
            setSelectedKidsId('');
            setError(null);
        }
    }, [isOpen, fetchUpcomingEvents]);

    const filteredEvents = useMemo(() => {
        if (!searchTerm) return events;
        return events.filter(event => event.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [events, searchTerm]);

    const handleSelectEvent = (eventId: number) => {
        const event = events.find(e => e.id === eventId);
        if (!event) return;

        const hasConflict =
            (selectedPrincipalId && event.cronograma_principal_id) ||
            (selectedKidsId && event.cronograma_kids_id);

        if (hasConflict) {
            setError(`O evento "${event.name}" já tem um cronograma associado e não pode ser selecionado.`);
            return;
        }

        setError(null);
        setSelectedEventIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(eventId)) {
                newSet.delete(eventId);
            } else {
                newSet.add(eventId);
            }
            return newSet;
        });
    };

    const handleSelectAll = () => {
        if (selectedEventIds.size === filteredEvents.length) {
            setSelectedEventIds(new Set());
        } else {
            const eventsWithoutConflict = filteredEvents.filter(event => {
                const hasConflict =
                    (selectedPrincipalId && event.cronograma_principal_id) ||
                    (selectedKidsId && event.cronograma_kids_id);
                return !hasConflict;
            });
            setSelectedEventIds(new Set(eventsWithoutConflict.map(e => e.id!)));
        }
    };

    const handleRemoveTimeline = async (eventId: number, type: 'principal' | 'kids', e: React.MouseEvent) => {
        e.stopPropagation();

        try {
            const updatePayload: { cronograma_principal_id?: null; cronograma_kids_id?: null } = {};
            if (type === 'principal') {
                updatePayload.cronograma_principal_id = null;
            } else {
                updatePayload.cronograma_kids_id = null;
            }

            const { error: updateError } = await supabase
                .from('events')
                .update(updatePayload)
                .eq('id', eventId);

            if (updateError) throw updateError;

            await fetchUpcomingEvents();
        } catch (err) {
            setError(getErrorMessage(err));
        }
    };

    const handleSave = async () => {
        if (selectedEventIds.size === 0) {
            setError("Selecione pelo menos um evento.");
            return;
        }
        if (!selectedPrincipalId && !selectedKidsId) {
            setError("Selecione pelo menos um cronograma (Principal ou Kids).");
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            const eventIds = Array.from(selectedEventIds);
            const updatePayload: { cronograma_principal_id?: string | null; cronograma_kids_id?: string | null } = {};
            if (selectedPrincipalId) updatePayload.cronograma_principal_id = selectedPrincipalId;
            if (selectedKidsId) updatePayload.cronograma_kids_id = selectedKidsId;

            const { data: oldEventsData, error: fetchError } = await supabase
                .from('events')
                .select('id, name, cronograma_principal_id, cronograma_kids_id')
                .in('id', eventIds);

            if (fetchError) throw fetchError;

            const eventsWithConflicts: string[] = [];

            (oldEventsData || []).forEach(event => {
                if (selectedPrincipalId && event.cronograma_principal_id) {
                    eventsWithConflicts.push(`${event.name} (já tem Cronograma Principal)`);
                }
                if (selectedKidsId && event.cronograma_kids_id) {
                    eventsWithConflicts.push(`${event.name} (já tem Cronograma Kids)`);
                }
            });

            if (eventsWithConflicts.length > 0) {
                const errorMessage = eventsWithConflicts.length === 1
                    ? `O evento "${eventsWithConflicts[0]}" já tem um cronograma associado.`
                    : `Os seguintes eventos já têm cronogramas associados: ${eventsWithConflicts.join(', ')}`;
                setError(errorMessage);
                setIsSaving(false);
                return;
            }

            const eventsToUpdate = (oldEventsData || []).filter(e =>
                (selectedPrincipalId && e.cronograma_principal_id !== selectedPrincipalId) ||
                (selectedKidsId && e.cronograma_kids_id !== selectedKidsId) ||
                (!selectedPrincipalId && e.cronograma_principal_id) ||
                (!selectedKidsId && e.cronograma_kids_id)
            );
            const eventIdsToUpdate = eventsToUpdate.map(e => e.id);

            if (eventIdsToUpdate.length > 0) {
                const { error: updateError } = await supabase
                    .from('events')
                    .update(updatePayload)
                    .in('id', eventIdsToUpdate);

                if (updateError) throw updateError;

                await supabase.functions.invoke('create-notifications', {
                    body: {
                        notifyType: 'bulk_timeline_associated',
                        events: eventsToUpdate,
                    },
                });
            }

            onClose();
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    const modalContent = (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl p-6 m-4 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-slate-900 mb-1">Associar Cronogramas a Eventos</h3>
                <p className="text-sm text-slate-500 mb-4">Selecione os cronogramas e os eventos futuros para associá-los em massa.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Cronograma Principal</label>
                        <select value={selectedPrincipalId} onChange={e => setSelectedPrincipalId(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm">
                            <option value="">Nenhum</option>
                            {templates.map(t => <option key={t.id} value={t.id!}>{t.nome_modelo}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Cronograma Kids</label>
                        <select value={selectedKidsId} onChange={e => setSelectedKidsId(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm">
                            <option value="">Nenhum</option>
                            {templates.map(t => <option key={t.id} value={t.id!}>{t.nome_modelo}</option>)}
                        </select>
                    </div>
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Buscar Evento</label>
                    <input type="text" placeholder="Filtrar por nome..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm" />
                </div>

                <div className="flex-grow border border-slate-200 rounded-lg overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between p-3 bg-slate-50 border-b border-slate-200">
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                            <input
                                type="checkbox"
                                checked={filteredEvents.length > 0 && selectedEventIds.size === filteredEvents.length}
                                onChange={handleSelectAll}
                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            Selecionar Todos
                        </label>
                        <span className="text-xs text-slate-500 font-medium">{selectedEventIds.size} de {filteredEvents.length} selecionado(s)</span>
                    </div>
                    <div className="overflow-y-auto flex-grow">
                        {loading ? (
                            <p className="p-4 text-center text-slate-500">Carregando eventos...</p>
                        ) : filteredEvents.length === 0 ? (
                            <p className="p-4 text-center text-slate-500">Nenhum evento futuro encontrado.</p>
                        ) : (
                            <ul className="divide-y divide-slate-200">
                                {filteredEvents.map(event => {
                                    const hasPrincipal = event.cronograma_principal_id;
                                    const hasKids = event.cronograma_kids_id;
                                    const hasConflict =
                                        (selectedPrincipalId && event.cronograma_principal_id) ||
                                        (selectedKidsId && event.cronograma_kids_id);

                                    return (
                                        <li
                                            key={event.id}
                                            onClick={() => handleSelectEvent(event.id!)}
                                            className={`flex items-center gap-3 p-3 ${hasConflict ? 'cursor-not-allowed opacity-60 bg-red-50' : 'cursor-pointer hover:bg-slate-50'}`}
                                        >
                                            <input
                                                type="checkbox"
                                                readOnly
                                                checked={selectedEventIds.has(event.id!)}
                                                disabled={hasConflict}
                                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 flex-shrink-0 disabled:opacity-50"
                                            />
                                            <div className="flex-grow min-w-0">
                                                <p className="font-semibold text-slate-800 truncate">{event.name}</p>
                                                <p className="text-xs text-slate-500">{new Date(event.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                                                {(hasPrincipal || hasKids) && (
                                                    <div className="flex gap-1 mt-1 flex-wrap">
                                                        {hasPrincipal && (
                                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${hasConflict && selectedPrincipalId ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                                                                {hasConflict && selectedPrincipalId ? '🚫 Conflito - Cronograma Principal' : '⚠️ Já tem Cronograma Principal'}
                                                                <button
                                                                    onClick={(e) => handleRemoveTimeline(event.id!, 'principal', e)}
                                                                    className="ml-1 hover:bg-red-200 rounded-full p-0.5 transition-colors"
                                                                    title="Remover Cronograma Principal"
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                                                    </svg>
                                                                </button>
                                                            </span>
                                                        )}
                                                        {hasKids && (
                                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${hasConflict && selectedKidsId ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                                                                {hasConflict && selectedKidsId ? '🚫 Conflito - Cronograma Kids' : '⚠️ Já tem Cronograma Kids'}
                                                                <button
                                                                    onClick={(e) => handleRemoveTimeline(event.id!, 'kids', e)}
                                                                    className="ml-1 hover:bg-red-200 rounded-full p-0.5 transition-colors"
                                                                    title="Remover Cronograma Kids"
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                                                    </svg>
                                                                </button>
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>

                <div className="pt-4 mt-auto flex justify-end items-center gap-3">
                    {error && <p className="text-sm text-red-500 mr-auto">{error}</p>}
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-white border border-slate-300 font-semibold rounded-lg text-sm">Cancelar</button>
                    <button type="button" onClick={handleSave} disabled={isSaving} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg text-sm disabled:bg-blue-400">
                        {isSaving ? 'Salvando...' : 'Salvar Associações'}
                    </button>
                </div>
            </div>
        </div>
    );

    return ReactDOM.createPortal(modalContent, document.body);
};

export default BulkAssociateTimelineModal;