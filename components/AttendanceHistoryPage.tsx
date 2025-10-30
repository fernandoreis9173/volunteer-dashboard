import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { type Session } from '@supabase/supabase-js';
import { getErrorMessage } from '../lib/utils';
import jsPDF from 'jspdf';

// Define types for this component
interface PastEvent {
    id: number;
    name: string;
    date: string;
    present: boolean | null;
    end_time: string;
    departmentName: string;
}

type FilterPeriod = '30d' | '90d' | 'all';

const EventHistoryCard: React.FC<{ event: PastEvent, onGeneratePDF: (event: PastEvent) => void }> = ({ event, onGeneratePDF }) => {
    const isAbsent = event.present === false || event.present === null;

    return (
        <div className="bg-white p-4 rounded-lg shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-slate-100 hover:shadow-md transition-shadow">
            <div className="min-w-0 flex-grow">
                <p className="font-semibold text-slate-800" title={event.name}>{event.name}</p>
                <p className="text-sm text-slate-500 mt-1">
                    {new Date(event.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto mt-3 sm:mt-0">
                <span className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full w-24 justify-center ${
                    isAbsent 
                    ? 'bg-red-100 text-red-700' 
                    : 'bg-green-100 text-green-700'
                }`}>
                    {isAbsent ? 'Faltou' : 'Presente'}
                </span>
                <button
                    onClick={() => onGeneratePDF(event)}
                    className="p-2 text-slate-500 hover:text-blue-600 rounded-md hover:bg-blue-50 transition-colors"
                    title="Baixar comprovante"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                </button>
            </div>
        </div>
    );
};


const AttendanceHistoryPage: React.FC<{ session: Session | null }> = ({ session }) => {
    const [allPastEvents, setAllPastEvents] = useState<PastEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeFilter, setActiveFilter] = useState<FilterPeriod>('all');

    const generateAttendanceCertificate = (event: PastEvent) => {
        if (!session?.user) {
            alert("Não foi possível identificar o usuário. Tente fazer login novamente.");
            return;
        }
    
        const volunteerName = session.user.user_metadata?.name || 'Voluntário(a)';
        const volunteerEmail = session.user.email || 'N/A';
        const isAbsent = event.present === false || event.present === null;
    
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
    
        // --- Design Elements ---
        const primaryColor = '#2563EB';
        const textColor = '#334155'; 
        const lightTextColor = '#64748b';
        const successColor = '#16a34a';
        const errorColor = '#dc2626';
        const pageBgColor = '#f8fafc';
    
        // Page background
        doc.setFillColor(pageBgColor);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
    
        // Decorative border
        doc.setDrawColor(primaryColor);
        doc.setLineWidth(1.5);
        doc.rect(10, 10, pageWidth - 20, pageHeight - 20);
    
        // Title
        doc.setFontSize(26);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(textColor);
        doc.text('Comprovante de Participação', pageWidth / 2, 35, { align: 'center' });
    
        // Body Text
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(textColor);
        
        const line1 = isAbsent ? 'Declaramos para os devidos fins que:' : 'Certificamos que:';
        doc.text(line1, 20, 65);
    
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(volunteerName, 20, 75);
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(lightTextColor);
        doc.text(`Email: ${volunteerEmail}`, 20, 81);
    
        doc.setFontSize(12);
        doc.setTextColor(textColor);
        const statusY = 91;
        if (isAbsent) {
            doc.text('foi escalado(a) mas', 20, statusY);
            const textWidth = doc.getTextWidth('foi escalado(a) mas ');
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(errorColor);
            doc.text('NÃO COMPARECEU', 20 + textWidth, statusY);
            const statusWidth = doc.getTextWidth('NÃO COMPARECEU ');
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(textColor);
            doc.text('ao evento detalhado abaixo.', 20 + textWidth + statusWidth, statusY);
        } else {
            doc.text('cumpriu suas atividades voluntárias e', 20, statusY);
            const textWidth = doc.getTextWidth('cumpriu suas atividades voluntárias e ');
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(successColor);
            doc.text('ESTEVE PRESENTE', 20 + textWidth, statusY);
            const statusWidth = doc.getTextWidth('ESTEVE PRESENTE ');
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(textColor);
            doc.text('no evento detalhado abaixo.', 20 + textWidth + statusWidth, statusY);
        }
    
        // Event Details Box
        const boxX = 20;
        const boxY = 110;
        const boxWidth = pageWidth - 40;
        const boxHeight = 45;
        doc.setFillColor('#FFFFFF');
        doc.setDrawColor('#e2e8f0'); // slate-200
        doc.setLineWidth(0.3);
        doc.roundedRect(boxX, boxY, boxWidth, boxHeight, 3, 3, 'FD');
        
        doc.setFontSize(11);
        doc.setTextColor(lightTextColor);
    
        doc.text('EVENTO:', boxX + 10, boxY + 12);
        doc.text('DATA:', boxX + 10, boxY + 22);
        doc.text('DEPARTAMENTO:', boxX + 10, boxY + 32);
    
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(textColor);
    
        const eventDate = new Date(event.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
        doc.text(event.name, boxX + 50, boxY + 12);
        doc.text(eventDate, boxX + 50, boxY + 22);
        doc.text(event.departmentName, boxX + 50, boxY + 32);
    
        // Footer
        const issueDate = `Emitido em: ${new Date().toLocaleDateString('pt-BR', { dateStyle: 'full' })}`;
        doc.setFontSize(10);
        doc.setTextColor(lightTextColor);
        doc.text(issueDate, pageWidth / 2, pageHeight - 40, { align: 'center' });
    
        doc.setDrawColor(textColor);
        doc.line(pageWidth / 2 - 40, pageHeight - 30, pageWidth / 2 + 40, pageHeight - 30);
        doc.setFontSize(11);
        doc.setTextColor(textColor);
        doc.text('Administração do Ministério', pageWidth / 2, pageHeight - 24, { align: 'center' });
        
        const safeEventName = event.name.replace(/[^a-zA-Z0-9]/g, '_');
        const safeVolunteerName = volunteerName.replace(/[^a-zA-Z0-9]/g, '_');
        doc.save(`Comprovante_${safeEventName}_${safeVolunteerName}.pdf`);
    };

    useEffect(() => {
        const fetchHistory = async () => {
            if (!session?.user) return;
            setLoading(true);
            setError(null);
            try {
                // 1. Get volunteer ID
                const { data: volProfile, error: volError } = await supabase
                    .from('volunteers')
                    .select('id')
                    .eq('user_id', session.user.id)
                    .single();

                if (volError) throw volError;
                const volunteerId = volProfile.id;

                // 2. Get past events for this volunteer including department name
                const todayStr = new Date().toISOString().split('T')[0];
                const { data: eventsData, error: eventsError } = await supabase
                    .from('event_volunteers')
                    .select('present, events(id, name, date, end_time), departments(name)')
                    .eq('volunteer_id', volunteerId)
                    .lte('events.date', todayStr)
                    .order('date', { foreignTable: 'events', ascending: false });

                if (eventsError) throw eventsError;
                
                const formattedEvents: PastEvent[] = (eventsData || [])
                    .filter((item: any) => item.events) // Ensure nested event is not null
                    .map((item: any) => ({
                        id: item.events.id,
                        name: item.events.name,
                        date: item.events.date,
                        present: item.present,
                        end_time: item.events.end_time,
                        departmentName: item.departments?.name || 'N/A'
                    }))
                    .filter(e => { // Ensure we only count events that have truly ended
                        const now = new Date();
                        const eventEnd = new Date(`${e.date}T${e.end_time}`);
                        return now > eventEnd;
                    });

                setAllPastEvents(formattedEvents);
            } catch (err) {
                setError(getErrorMessage(err));
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [session]);

    const { filteredEvents, stats } = useMemo(() => {
        if (allPastEvents.length === 0) {
            return { filteredEvents: [], stats: { present: 0, absent: 0, total: 0 } };
        }

        const now = new Date();
        let eventsToFilter = allPastEvents;

        if (activeFilter !== 'all') {
            const daysToSubtract = activeFilter === '30d' ? 30 : 90;
            const filterDate = new Date();
            filterDate.setDate(now.getDate() - daysToSubtract);
            eventsToFilter = allPastEvents.filter(e => new Date(e.date) >= filterDate);
        }

        let presentCount = 0;
        let absentCount = 0;
        
        eventsToFilter.forEach(event => {
            if (event.present === true) {
                presentCount++;
            } else {
                absentCount++;
            }
        });

        const newStats = {
            present: presentCount,
            absent: absentCount,
            total: eventsToFilter.length
        };

        return { filteredEvents: eventsToFilter, stats: newStats };
    }, [allPastEvents, activeFilter]);
    
    const FilterButton: React.FC<{ label: string; value: FilterPeriod }> = ({ label, value }) => (
        <button
            onClick={() => setActiveFilter(value)}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                activeFilter === value ? 'bg-primary text-white shadow-sm' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
            }`}
        >
            {label}
        </button>
    );

    
    if (loading) {
        return <div className="text-center p-8">Carregando histórico...</div>;
    }
    
    if (error) {
        return <p className="text-red-500 text-center p-8">Erro ao carregar histórico: {error}</p>;
    }

    const presentPercentage = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;
    const radius = 60;
    const strokeWidth = 16;
    const circumference = 2 * Math.PI * radius;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-slate-800">Histórico de Presença</h1>
                <p className="text-slate-500 mt-1">Veja seu desempenho e participação nos eventos passados.</p>
            </div>

            <div className="flex items-center gap-2">
                <FilterButton label="Últimos 30 dias" value="30d" />
                <FilterButton label="Últimos 90 dias" value="90d" />
                <FilterButton label="Todo o período" value="all" />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                {/* Summary Card */}
                <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center">
                    <h2 className="text-xl font-semibold text-slate-800 mb-6">Resumo de Participação</h2>
                    
                    <div className="relative w-48 h-48">
                        <svg className="w-full h-full" viewBox="0 0 150 150">
                            {/* Green background circle, represents 100% presence */}
                            <circle
                                cx="75"
                                cy="75"
                                r={radius}
                                fill="transparent"
                                stroke={stats.total > 0 ? "#22c55e" : "#e2e8f0"}
                                strokeWidth={strokeWidth}
                            />
                            {/* Red overlay for absences */}
                            {stats.absent > 0 && (
                                <circle
                                    cx="75"
                                    cy="75"
                                    r={radius}
                                    fill="transparent"
                                    stroke="#ef4444"
                                    strokeWidth={strokeWidth}
                                    strokeDasharray={circumference}
                                    strokeDashoffset={circumference * (presentPercentage / 100)}
                                    transform="rotate(-90 75 75)"
                                    strokeLinecap="round"
                                    style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
                                />
                            )}
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                            <span className="text-3xl font-bold text-slate-800">{presentPercentage}%</span>
                            <span className="text-sm font-semibold text-slate-500">Presença</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-center gap-6 mt-6">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                            <span className="text-sm text-slate-600">Presente ({stats.present})</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                            <span className="text-sm text-slate-600">Faltou ({stats.absent})</span>
                        </div>
                    </div>
                    
                    <div className="text-center mt-6 pt-6 border-t border-slate-200 w-full">
                        <p className="text-4xl font-bold text-slate-800">{stats.present}<span className="text-2xl text-slate-400">/{stats.total}</span></p>
                        <p className="text-sm font-medium text-slate-500 mt-1">Eventos Presente</p>
                    </div>
                </div>

                {/* Events List */}
                <div className="lg:col-span-2 space-y-4">
                    <h2 className="text-xl font-semibold text-slate-800">Meus Eventos Anteriores ({filteredEvents.length})</h2>
                    {filteredEvents.length > 0 ? (
                        <div className="space-y-3">
                            {filteredEvents.map(event => <EventHistoryCard key={event.id} event={event} onGeneratePDF={generateAttendanceCertificate} />)}
                        </div>
                    ) : (
                        <div className="text-center py-12 px-6 bg-white rounded-lg shadow-sm border border-slate-200">
                            <p className="text-slate-500">Nenhum evento encontrado para o período selecionado.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AttendanceHistoryPage;