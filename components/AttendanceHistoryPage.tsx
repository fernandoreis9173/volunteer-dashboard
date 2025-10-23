import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { type Session } from '@supabase/supabase-js';
import { getErrorMessage } from '../lib/utils';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';

// Define types for this component
interface PastEvent {
    id: number;
    name: string;
    date: string;
    present: boolean | null;
    end_time: string;
}

type FilterPeriod = '30d' | '90d' | 'all';

const COLORS = {
    present: '#22c55e', // green-500
    absent: '#ef4444',  // red-500
};

// PDF Export Function
const exportPdfCertificate = (volunteerName: string, event: PastEvent) => {
    const doc = new jsPDF();
    const eventDate = new Date(event.date + 'T00:00:00').toLocaleDateString('pt-BR', {
        day: '2-digit', month: 'long', year: 'numeric'
    });

    // Header
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('Comprovante de Participação Voluntária', doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });

    // Body
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Certificamos que ${volunteerName}`, 20, 40);
    doc.text(`participou como voluntário(a) no evento:`, 20, 50);
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(event.name, 20, 65);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Realizado em: ${eventDate}`, 20, 75);

    // Footer
    doc.text(`Este documento foi gerado pelo sistema Volunteers.`, 20, 100);
    doc.text(`Data de emissão: ${new Date().toLocaleDateString('pt-BR')}`, 20, 107);
    
    doc.save(`comprovante-${volunteerName.replace(/\s/g, '_')}-${event.name.replace(/\s/g, '_')}.pdf`);
};


const AttendanceHistoryPage: React.FC<{ session: Session | null }> = ({ session }) => {
    const [allPastEvents, setAllPastEvents] = useState<PastEvent[]>([]);
    const [volunteerName, setVolunteerName] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeFilter, setActiveFilter] = useState<FilterPeriod>('all');

    useEffect(() => {
        const fetchHistory = async () => {
            if (!session?.user) return;
            setLoading(true);
            setError(null);
            try {
                // 1. Get volunteer ID and name
                const { data: volProfile, error: volError } = await supabase
                    .from('volunteers')
                    .select('id, name')
                    .eq('user_id', session.user.id)
                    .single();

                if (volError) throw volError;
                const volunteerId = volProfile.id;
                setVolunteerName(volProfile.name);

                // 2. Get past events for this volunteer
                const todayStr = new Date().toISOString().split('T')[0];
                const { data: eventsData, error: eventsError } = await supabase
                    .from('event_volunteers')
                    .select('present, events(id, name, date, end_time)')
                    .eq('volunteer_id', volunteerId)
                    .lte('events.date', todayStr)
                    .order('date', { foreignTable: 'events', ascending: false });

                if (eventsError) throw eventsError;
                
                const formattedEvents: PastEvent[] = (eventsData || [])
                    // @ts-ignore
                    .filter(item => item.events) // Ensure nested event is not null
                    .map((item: any) => ({
                        id: item.events.id,
                        name: item.events.name,
                        date: item.events.date,
                        present: item.present,
                        end_time: item.events.end_time
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

    const { filteredEvents, stats, chartData } = useMemo(() => {
        if (allPastEvents.length === 0) {
            return { filteredEvents: [], stats: { present: 0, absent: 0, total: 0 }, chartData: [] };
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
            } else { // present is false or null for a past event
                absentCount++;
            }
        });

        const newStats = {
            present: presentCount,
            absent: absentCount,
            total: eventsToFilter.length
        };

        const newChartData = [
            { name: 'Presenças', value: newStats.present },
            { name: 'Faltas', value: newStats.absent },
        ].filter(d => d.value > 0);

        return { filteredEvents: eventsToFilter, stats: newStats, chartData: newChartData };
    }, [allPastEvents, activeFilter]);
    
    const FilterButton: React.FC<{ label: string; value: FilterPeriod }> = ({ label, value }) => (
        <button
            onClick={() => setActiveFilter(value)}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                activeFilter === value ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
        >
            {label}
        </button>
    );

    const EventHistoryCard: React.FC<{event: PastEvent}> = ({ event }) => {
        let status;
        if (event.present === true) {
            status = { text: 'Presente', bg: 'bg-green-100', textColor: 'text-green-800' };
        } else {
            status = { text: 'Faltou', bg: 'bg-red-100', textColor: 'text-red-800' };
        }

        return (
            <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row justify-between items-start gap-4">
                <div>
                    <p className="font-bold text-slate-800">{event.name}</p>
                    <p className="text-sm text-slate-500 mt-1">
                        {new Date(event.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                     <span className={`px-3 py-1 text-xs font-semibold rounded-full ${status.bg} ${status.textColor}`}>
                        {status.text}
                    </span>
                    {event.present === true && (
                        <button 
                            onClick={() => exportPdfCertificate(volunteerName, event)}
                            className="px-3 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full hover:bg-blue-200"
                        >
                            Exportar Comprovante
                        </button>
                    )}
                </div>
            </div>
        );
    };

    if (loading) {
        return <div className="text-center p-8">Carregando histórico...</div>;
    }
    
    if (error) {
        return <p className="text-red-500 text-center p-8">Erro ao carregar histórico: {error}</p>;
    }

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold text-slate-800">Histórico de Presença</h1>
                <p className="text-slate-500 mt-1">Veja seu desempenho e participação nos eventos passados.</p>
            </div>

            <div className="flex items-center gap-3">
                <FilterButton label="Últimos 30 dias" value="30d" />
                <FilterButton label="Últimos 90 dias" value="90d" />
                <FilterButton label="Todo o período" value="all" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-center items-center">
                    <h2 className="text-xl font-bold text-slate-800 mb-4">Resumo de Participação</h2>
                    <div className="w-full h-48">
                         <ResponsiveContainer>
                            <PieChart>
                                <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} fill="#8884d8" labelLine={false} label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                                    if (!percent) return null;
                                    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                                    const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
                                    const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));
                                    return ( <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize="14" fontWeight="bold"> {`${(percent * 100).toFixed(0)}%`} </text> );
                                }}>
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.name === 'Presenças' ? COLORS.present : COLORS.absent} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend iconSize={10} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="text-center mt-4">
                        <p className="text-4xl font-bold text-slate-800">{stats.present}<span className="text-2xl text-slate-400">/{stats.total}</span></p>
                        <p className="text-sm font-semibold text-slate-600">Eventos Presente</p>
                    </div>
                </div>
                <div className="lg:col-span-2 space-y-4">
                     <h2 className="text-xl font-bold text-slate-800">Meus Eventos Anteriores ({filteredEvents.length})</h2>
                     {filteredEvents.length > 0 ? (
                        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                            {filteredEvents.map(event => <EventHistoryCard key={event.id} event={event} />)}
                        </div>
                     ) : (
                        <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg">
                            <p>Nenhum evento encontrado para o período selecionado.</p>
                        </div>
                     )}
                </div>
            </div>
        </div>
    );
};

export default AttendanceHistoryPage;
