import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { EnrichedUser, DashboardData, DashboardEvent, ChartDataPoint, Page, Event } from '../types';
import { getErrorMessage } from '../lib/utils';
import { useEvents, useInvalidateQueries } from '../hooks/useQueries';
import StatsRow from './StatsRow';
import UpcomingShiftsList from './UpcomingShiftsList';
import { AnalysisChart } from './TrafficChart';
import ActivityFeed from './ActivityFeed';
import EventDetailsModal from './EventDetailsModal';
import ActiveVolunteersList from './ActiveVolunteersList';
import EventTimelineViewerModal from './EventTimelineViewerModal';
import QRScannerModal from './QRScannerModal';

interface LiveEventTimerProps {
    event: Event;
    onNavigate: (page: Page) => void;
}

const LiveEventTimer: React.FC<LiveEventTimerProps> = ({ event, onNavigate }) => {
    const handleClick = () => {
        if (event.id) {
            sessionStorage.setItem('editEventId', String(event.id));
        }
        onNavigate('events');
    };

    return (
        <div
            className="block md:inline-block bg-red-50 border border-red-200 rounded-lg p-4"
            aria-label="Um evento está ao vivo"
        >
            <div className="flex justify-between md:justify-start items-center gap-4">
                {/* Left side: Live Indicator, Text, and Event Name */}
                <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-3 w-3 relative flex-shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                    <div className="min-w-0">
                        <h3 className="text-base font-semibold text-red-800">Estamos Ao Vivo</h3>
                        <p className="text-sm text-red-700 truncate" title={event.name}>{event.name}</p>
                    </div>
                </div>

                {/* Right side: Action Button */}
                <button
                    onClick={handleClick}
                    className="p-2 text-red-600 hover:text-red-800 bg-red-100 hover:bg-red-200 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-400 flex-shrink-0"
                    aria-label="Ver detalhes do evento"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </button>
            </div>
        </div>
    );
};


interface AdminDashboardProps {
    activeEvent: Event | null;
    onNavigate: (page: Page) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ activeEvent, onNavigate }) => {
    const [selectedEvent, setSelectedEvent] = useState<DashboardEvent | null>(null);
    const [otherDashboardData, setOtherDashboardData] = useState<Partial<DashboardData>>({});
    const [dashboardError, setDashboardError] = useState<string | null>(null);
    const [viewingTimelineFor, setViewingTimelineFor] = useState<DashboardEvent | null>(null);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [scanningEvent, setScanningEvent] = useState<DashboardEvent | null>(null);
    const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
    const [scanResult, setScanResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const { invalidateEvents } = useInvalidateQueries();

    // ... (código existente) ...

    const handleAutoConfirmAttendance = useCallback(async (decodedText: string) => {
        // Se já estiver processando um resultado (ex: mostrando sucesso), ignora novos scans
        if (scanResult) return;

        try {
            const data = JSON.parse(decodedText);

            // Validações básicas
            if (!data.vId || !data.eId || !data.dId) {
                throw new Error("QR Code incompleto.");
            }
            if (data.eId !== scanningEvent?.id) {
                throw new Error("Evento incorreto.");
            }

            // Mostra feedback de carregamento (opcional, ou apenas espera)
            // setScanResult({ type: 'loading', message: 'Processando...' });

            const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !sessionData.session) {
                throw new Error("Sessão inválida.");
            }

            const { error: invokeError } = await supabase.functions.invoke('mark-attendance', {
                headers: {
                    Authorization: `Bearer ${sessionData.session.access_token}`,
                },
                body: { volunteerId: data.vId, eventId: data.eId, departmentId: data.dId },
            });

            if (invokeError) throw invokeError;

            const volunteerName = scanningEvent?.event_volunteers?.find(v => v.volunteer_id === data.vId)?.volunteers?.name || 'Voluntário';

            // Sucesso!
            setScanResult({ type: 'success', message: `${volunteerName}` });
            invalidateEvents();

            // Limpa o resultado após 2.5s para permitir novo scan
            setTimeout(() => {
                setScanResult(null);
            }, 2500);

        } catch (err: any) {
            let errorMsg = "Erro ao confirmar.";
            if (err.context && typeof err.context.json === 'function') {
                try {
                    const errorJson = await err.context.json();
                    if (errorJson && errorJson.error) errorMsg = errorJson.error;
                } catch { }
            } else {
                errorMsg = getErrorMessage(err);
            }

            // Erro!
            setScanResult({ type: 'error', message: errorMsg });

            // Limpa o erro após 4s
            setTimeout(() => {
                setScanResult(null);
            }, 4000);
        }
    }, [scanningEvent, scanResult, invalidateEvents]);

    // ... (resto do código) ...

    return (
        <div className="space-y-8">
            {/* ... (código existente) ... */}

            {isScannerOpen && (
                <QRScannerModal
                    isOpen={isScannerOpen}
                    onClose={() => {
                        setIsScannerOpen(false);
                        setScanningEvent(null);
                        setScanResult(null);
                    }}
                    onScanSuccess={handleAutoConfirmAttendance}
                    scanningEventName={scanningEvent?.name}
                    scanResult={scanResult}
                />
            )}
            <EventTimelineViewerModal
                isOpen={!!viewingTimelineFor}
                onClose={() => setViewingTimelineFor(null)}
                event={viewingTimelineFor}
            />
        </div>
    );
};

export default AdminDashboard;