import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { supabase } from '../lib/supabaseClient';
import { getErrorMessage } from '../lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { RankedVolunteer } from './RankingPage';

interface VolunteerStatsModalProps {
    isOpen: boolean;
    onClose: () => void;
    volunteer: RankedVolunteer | null;
}

interface DetailedHistoryItem {
    present: boolean | null;
    date: string;
    event_name: string;
    department_name: string;
}

// --- Formatting Helpers ---
const formatDateMultiLine = (dateString: string): string[] => {
    if (!dateString || dateString === 'N/A') {
        return ['N/A', '', '', ''];
    }
    const date = new Date(dateString + 'T00:00:00');
    const day = date.toLocaleDateString('pt-BR', { day: '2-digit' });
    const month = date.toLocaleDateString('pt-BR', { month: 'short' });
    const year = date.getFullYear();
    return [`${day} de`, month, 'de', String(year)];
};

const formatFullDateSingleLine = (dateString: string): string => {
    if (!dateString || dateString === 'N/A') return 'N/A';
    try {
        const date = new Date(dateString + 'T00:00:00');
        return new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        }).format(date);
    } catch {
        return 'Data Inválida';
    }
};


// --- Sub-components ---

const HeaderStatCard: React.FC<{
    label: string;
    value: string;
    icon: React.ReactElement;
    isDate?: boolean;
}> = ({ label, value, icon, isDate = false }) => {
    
    let mobileContent, desktopContent;

    if (isDate) {
        const [line1, line2, line3, line4] = formatDateMultiLine(value);
        const fullDate = formatFullDateSingleLine(value);
        
        mobileContent = (
            <div className="font-bold text-white leading-tight">
                <span className="text-3xl">{line1}</span>
                <br />
                <span className="text-xl">{line2}</span>
                <br />
                <span className="text-sm">{line3} {line4}</span>
            </div>
        );
        desktopContent = (
            <p className="text-2xl font-bold text-white leading-tight">{fullDate}</p>
        );
    } else {
        mobileContent = <p className="text-3xl font-bold text-white leading-tight">{value}</p>;
        desktopContent = <p className="text-3xl font-bold text-white leading-tight">{value}</p>;
    }

    return (
        <div className="flex items-center gap-4 flex-1 px-2">
            <div className="flex-shrink-0 w-10 h-10 bg-blue-700 text-white rounded-lg flex items-center justify-center">
                {icon}
            </div>
            <div className="text-left">
                <p className="text-sm font-semibold text-blue-200">{label}</p>
                <div className="md:hidden">{mobileContent}</div>
                <div className="hidden md:block">{desktopContent}</div>
            </div>
        </div>
    );
};


const CustomLegend = () => (
    <div className="flex justify-center items-center gap-4 mt-4 text-sm">
        <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-green-500"></div>
            <span className="text-slate-600">Presente</span>
        </div>
        <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-red-500"></div>
            <span className="text-slate-600">Faltou</span>
        </div>
    </div>
);


const VolunteerStatsModal: React.FC<VolunteerStatsModalProps> = ({ isOpen, onClose, volunteer }) => {
    const [loadingDetails, setLoadingDetails] = useState(true);
    const [detailsError, setDetailsError] = useState<string | null>(null);
    const [detailedHistory, setDetailedHistory] = useState<DetailedHistoryItem[]>([]);
    const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen || !volunteer) {
            return;
        }

        const fetchDetails = async () => {
            setLoadingDetails(true);
            setDetailsError(null);
            setSelectedDepartmentFilter(null); // Reset filter on open
            try {
                const { data, error } = await supabase
                    .from('event_volunteers')
                    .select('present, events(date, name), departments(name)')
                    .eq('volunteer_id', volunteer.id)
                    .order('date', { foreignTable: 'events', ascending: false });

                if (error) throw error;

                const history: DetailedHistoryItem[] = data.map((item: any) => ({
                    present: item.present,
                    date: item.events.date,
                    event_name: item.events.name,
                    department_name: item.departments.name,
                }));
                setDetailedHistory(history);

            } catch (err) {
                setDetailsError(getErrorMessage(err));
            } finally {
                setLoadingDetails(false);
            }
        };

        fetchDetails();
    }, [isOpen, volunteer]);

    const stats = useMemo(() => {
        if (!detailedHistory || detailedHistory.length === 0) {
            return {
                firstEventDate: 'N/A',
                lastEventDate: 'N/A',
                topDepartments: [],
                chartData: [],
                recentHistory: [],
            };
        }
        
        const sortedHistory = [...detailedHistory].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const firstEventDate = sortedHistory[0].date;
        const lastEventDate = sortedHistory[sortedHistory.length - 1].date;

        const deptCounts = new Map<string, number>();
        detailedHistory.forEach(item => {
            deptCounts.set(item.department_name, (deptCounts.get(item.department_name) || 0) + 1);
        });
        const topDepartments = [...deptCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
        
        const monthlyStats: { [key: string]: { scheduled: number; present: number } } = {};
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
        twelveMonthsAgo.setDate(1);
        twelveMonthsAgo.setHours(0,0,0,0);

        for (let i = 0; i < 12; i++) {
            const date = new Date(twelveMonthsAgo);
            date.setMonth(date.getMonth() + i);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            monthlyStats[monthKey] = { scheduled: 0, present: 0 };
        }

        detailedHistory.forEach(item => {
            const monthKey = item.date.substring(0, 7);
            if (monthlyStats[monthKey]) {
                monthlyStats[monthKey].scheduled++;
                if (item.present) {
                    monthlyStats[monthKey].present++;
                }
            }
        });

        const chartData = Object.keys(monthlyStats).map(monthKey => {
            const [year, month] = monthKey.split('-');
            const monthName = new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleString('pt-BR', { month: 'short' });
            return {
                month: monthName.replace('.', '').toUpperCase(),
                Presente: monthlyStats[monthKey].present,
                Faltou: monthlyStats[monthKey].scheduled - monthlyStats[monthKey].present,
            };
        });
        
        const recentHistory = detailedHistory
            .filter(item => selectedDepartmentFilter ? item.department_name === selectedDepartmentFilter : true)
            .slice(0, 5);

        return {
            firstEventDate,
            lastEventDate,
            topDepartments,
            chartData,
            recentHistory,
        };
    }, [detailedHistory, selectedDepartmentFilter]);

    const percentage = volunteer && volunteer.totalScheduled > 0 ? Math.round((volunteer.totalPresent / volunteer.totalScheduled) * 100) : 0;

    const renderSkeleton = () => (
        <>
            <header className="p-4 border-b border-slate-200 bg-white flex-shrink-0 animate-pulse">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-slate-200"></div>
                    <div>
                        <div className="h-6 w-40 bg-slate-200 rounded"></div>
                        <div className="h-4 w-32 bg-slate-200 rounded mt-2"></div>
                    </div>
                </div>
            </header>
            <main className="flex-grow p-6 overflow-y-auto space-y-6 animate-pulse">
                <div className="h-24 bg-slate-200 rounded-xl"></div>
                <div className="h-80 bg-slate-200 rounded-lg"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="h-40 bg-slate-200 rounded-lg"></div>
                    <div className="h-40 bg-slate-200 rounded-lg"></div>
                </div>
            </main>
        </>
    );

    const modalContent = (
        <>
            <div className={`fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose}></div>
            <div className={`fixed top-0 right-0 h-full w-full max-w-lg bg-slate-50 shadow-xl z-50 transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>
                {!volunteer || (loadingDetails && !detailedHistory.length) ? renderSkeleton() : (
                    <>
                        <header className="p-4 border-b border-slate-200 bg-white flex-shrink-0">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xl">{volunteer.initials}</div>
                                    <div>
                                        <h2 className="text-xl font-bold text-slate-800">{volunteer.name}</h2>
                                        <p className="text-sm text-slate-500">Estatísticas do Voluntário</p>
                                    </div>
                                </div>
                                <button onClick={onClose} className="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        </header>
                        <main className="flex-grow p-6 overflow-y-auto space-y-6">
                             <div className="bg-blue-600 text-white p-4 rounded-xl">
                                <div className="flex flex-col sm:flex-row justify-around items-start sm:items-center gap-y-4">
                                    <HeaderStatCard
                                        label="Primeiro Evento"
                                        value={stats.firstEventDate}
                                        isDate={true}
                                        icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                                    />
                                    <div className="w-full sm:w-px h-px sm:h-16 bg-blue-500"></div>
                                    <HeaderStatCard
                                        label="Último Evento"
                                        value={stats.lastEventDate}
                                        isDate={true}
                                        icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                                    />
                                    <div className="w-full sm:w-px h-px sm:h-16 bg-blue-500"></div>
                                    <HeaderStatCard
                                        label="% de Presença"
                                        value={`${percentage}%`}
                                        icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                                    />
                                </div>
                            </div>
                            
                            <div className="bg-white p-4 rounded-lg border border-slate-200">
                                <h3 className="font-bold text-slate-800 mb-4 text-center">Frequência Mensal (Último Ano)</h3>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={stats.chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                                            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                                            <Tooltip />
                                            <Bar dataKey="Presente" stackId="a" fill="#22c55e" name="Presente"/>
                                            <Bar dataKey="Faltou" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} name="Faltou"/>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                <CustomLegend />
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white p-4 rounded-lg border border-slate-200">
                                    <h3 className="font-bold text-slate-800 mb-3">Departamentos Mais Atuantes</h3>
                                    <ul className="space-y-2">
                                        {stats.topDepartments.map(([name, count]) => (
                                            <li key={name}>
                                                <button
                                                    onClick={() => setSelectedDepartmentFilter(prev => prev === name ? null : name)}
                                                    className={`w-full flex justify-between items-center text-sm p-2 rounded transition-colors ${selectedDepartmentFilter === name ? 'bg-blue-100 ring-1 ring-blue-300' : 'bg-slate-50 hover:bg-slate-100'}`}
                                                >
                                                    <span className="font-semibold text-slate-700">{name}</span>
                                                    <span className="font-bold text-blue-600">{count}x</span>
                                                </button>
                                            </li>
                                        ))}
                                        {stats.topDepartments.length === 0 && <p className="text-sm text-slate-500 text-center py-4">Nenhuma atuação registrada.</p>}
                                    </ul>
                                </div>

                                <div className="bg-white p-4 rounded-lg border border-slate-200">
                                    <h3 className="font-bold text-slate-800 mb-3">
                                        {selectedDepartmentFilter ? `Histórico em ${selectedDepartmentFilter}` : 'Histórico Recente'}
                                    </h3>
                                    <ul className="space-y-2">
                                        {stats.recentHistory.map((item, index) => (
                                            <li key={index} className="flex items-center justify-between text-sm p-2 bg-slate-50 rounded">
                                                <div className="flex-grow min-w-0">
                                                    <p className="font-semibold text-slate-700 truncate">{item.event_name}</p>
                                                    <p className="text-xs text-slate-500">{new Date(item.date + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                                                </div>
                                                <span className={`ml-2 px-2 py-0.5 text-xs font-semibold rounded-full flex-shrink-0 ${item.present ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    {item.present ? 'Presente' : 'Faltou'}
                                                </span>
                                            </li>
                                        ))}
                                         {stats.recentHistory.length === 0 && <p className="text-sm text-slate-500 text-center py-4">Nenhum histórico recente.</p>}
                                    </ul>
                                </div>
                            </div>
                        </main>
                    </>
                )}
            </div>
        </>
    );

    return ReactDOM.createPortal(modalContent, document.body);
};

export default VolunteerStatsModal;