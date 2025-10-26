import React, { useState, useMemo, useEffect } from 'react';
// FIX: Moved ChartDataPoint to types.ts and updated import path.
import type { ChartDataPoint } from '../types';
import { ResponsiveContainer, AreaChart, XAxis, YAxis, Tooltip, Area, CartesianGrid } from 'recharts';

interface AnalysisChartProps {
  data: ChartDataPoint[];
}

type Timeframe = 'monthly' | 'weekly' | 'yearly';

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const pointData = payload[0].payload;
      const fullDate = pointData.fullDate;
      const timeframe = pointData.timeframe;
      
      let formattedLabel = label;
      if (timeframe === 'yearly') {
        const [year, month] = fullDate.split('-');
        formattedLabel = new Date(Number(year), Number(month) - 1, 2).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      } else if (fullDate) {
        formattedLabel = new Date(fullDate + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
      }

      const scheduledData = payload.find(p => p.dataKey === 'scheduledVolunteers');
      const departmentsData = payload.find(p => p.dataKey === 'involvedDepartments');
      const eventNames = pointData.eventNames;
      const eventCount = pointData.eventCount;

      return (
        <div className="bg-white p-3 shadow-lg rounded-lg border border-slate-200 w-64">
          <p className="font-bold text-slate-700 mb-2">{formattedLabel}</p>
          <div className="space-y-1">
            {scheduledData && (
                 <p className="text-sm text-blue-600 flex items-center">
                    <span className="w-2 h-2 rounded-full bg-blue-500 mr-2"></span>
                    {`Voluntários nos Eventos: ${scheduledData.value}`}
                </p>
            )}
            {departmentsData && (
                <p className="text-sm text-purple-600 flex items-center">
                    <span className="w-2 h-2 rounded-full bg-purple-500 mr-2"></span>
                    {`Departamentos nos Eventos: ${departmentsData.value}`}
                </p>
            )}
          </div>
           {(eventNames?.length > 0 || eventCount > 0) && (
            <div className="mt-2 pt-2 border-t border-slate-200">
                <h4 className="font-semibold text-slate-600 text-sm mb-1">
                    {timeframe === 'yearly' ? 'Total de Eventos' : 'Eventos no Dia'}
                </h4>
                {timeframe === 'yearly' ? (
                    <p className="text-sm text-slate-500">{eventCount} eventos</p>
                ) : (
                    <ul className="text-sm text-slate-500 list-disc list-inside space-y-0.5 max-h-24 overflow-y-auto">
                        {eventNames.slice(0, 3).map((name: string, index: number) => (
                            <li key={index} className="truncate" title={name}>{name}</li>
                        ))}
                        {eventNames.length > 3 && (
                            <li className="font-semibold text-slate-400">e mais {eventNames.length - 3}...</li>
                        )}
                    </ul>
                )}
            </div>
        )}
        </div>
      );
    }
    return null;
};

// Custom hook to detect screen size
const useIsMobile = (breakpoint = 768) => {
    const [isMobile, setIsMobile] = useState(window.innerWidth < breakpoint);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < breakpoint);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [breakpoint]);

    return isMobile;
};
  
// FIX: Changed to a named export to resolve module resolution error in Dashboard.tsx
export const AnalysisChart: React.FC<AnalysisChartProps> = ({ data }) => {
  const [timeframe, setTimeframe] = useState<Timeframe>('monthly');
  const isMobile = useIsMobile();

  const { chartData, subtitle } = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    const getLocalYYYYMMDD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    if (timeframe === 'weekly') {
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);
        
        const weekData = [];
        for (let i = 0; i < 7; i++) {
            const day = new Date(sevenDaysAgo);
            day.setDate(sevenDaysAgo.getDate() + i);
            const dateStr = getLocalYYYYMMDD(day);
            const existingData = data.find(d => d.date === dateStr);
            weekData.push({
                name: day.toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 3),
                fullDate: dateStr,
                timeframe: 'weekly',
                scheduledVolunteers: existingData?.scheduledVolunteers || 0,
                involvedDepartments: existingData?.involvedDepartments || 0,
                eventNames: existingData?.eventNames || [],
            });
        }
        return { 
            chartData: weekData,
            subtitle: `Análise da última semana`
         };
    }

    if (timeframe === 'monthly') {
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 29);
        thirtyDaysAgo.setHours(0, 0, 0, 0);
        
        const monthData = [];
        for (let i = 0; i < 30; i++) {
            const day = new Date(thirtyDaysAgo);
            day.setDate(thirtyDaysAgo.getDate() + i);
            const dateStr = getLocalYYYYMMDD(day);
            const existingData = data.find(d => d.date === dateStr);
            monthData.push({
                name: String(day.getDate()),
                fullDate: dateStr,
                timeframe: 'monthly',
                scheduledVolunteers: existingData?.scheduledVolunteers || 0,
                involvedDepartments: existingData?.involvedDepartments || 0,
                eventNames: existingData?.eventNames || [],
            });
        }
        return { 
            chartData: monthData,
            subtitle: `Análise do último mês`
         };
    }

    // Default: 'yearly'
    const currentYear = today.getFullYear();

    const aggregatedData = new Map<number, { scheduledVolunteers: number; involvedDepartments: number; eventCount: number }>();
    data.forEach(d => {
        const recordDate = new Date(d.date + "T00:00:00");
        if (recordDate.getFullYear() === currentYear) {
            const monthIndex = recordDate.getMonth();
            const currentCounts = aggregatedData.get(monthIndex) || { scheduledVolunteers: 0, involvedDepartments: 0, eventCount: 0 };
            aggregatedData.set(monthIndex, {
                scheduledVolunteers: currentCounts.scheduledVolunteers + d.scheduledVolunteers,
                involvedDepartments: currentCounts.involvedDepartments + (d.involvedDepartments || 0),
                eventCount: currentCounts.eventCount + (d.eventNames?.length || 0),
            });
        }
    });

    const yearChartData = [];
    for (let i = 0; i < 12; i++) {
        const monthDate = new Date(currentYear, i, 2);
        const monthKey = `${currentYear}-${String(i + 1).padStart(2, '0')}`;
        const monthNameRaw = monthDate.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
        const monthName = monthNameRaw.charAt(0).toUpperCase() + monthNameRaw.slice(1);
        
        yearChartData.push({
            name: monthName,
            fullDate: monthKey,
            scheduledVolunteers: aggregatedData.get(i)?.scheduledVolunteers || 0,
            involvedDepartments: aggregatedData.get(i)?.involvedDepartments || 0,
            eventCount: aggregatedData.get(i)?.eventCount || 0,
            timeframe: 'yearly',
        });
    }

    return {
        chartData: yearChartData,
        subtitle: `Análise do ano de ${currentYear}`
    };
  }, [data, timeframe]);
  
  const FilterButton = ({ label, value, activeValue, onClick }: { label: string; value: Timeframe; activeValue: Timeframe; onClick: (value: Timeframe) => void }) => (
    <button
        onClick={() => onClick(value)}
        className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
            activeValue === value ? 'bg-white text-slate-900 shadow-sm' : 'bg-transparent text-slate-500 hover:text-slate-900'
        }`}
    >
        {label}
    </button>
  );

  // Dynamically set interval based on screen size
  const xAxisInterval = isMobile ? 'preserveStartEnd' : 0;

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-full">
        <div className="flex flex-col sm:flex-row justify-between items-start mb-6">
            <div>
                <h2 className="text-2xl font-bold text-slate-800">Análise Eventos</h2>
                <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
            </div>
            <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl mt-4 sm:mt-0">
                <FilterButton label="Mensal" value="monthly" activeValue={timeframe} onClick={setTimeframe} />
                <FilterButton label="Semanal" value="weekly" activeValue={timeframe} onClick={setTimeframe} />
                <FilterButton label="Anual" value="yearly" activeValue={timeframe} onClick={setTimeframe} />
            </div>
        </div>

        <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                    data={chartData}
                    margin={{ top: 10, right: 20, left: -20, bottom: 5 }}
                >
                    <defs>
                        <linearGradient id="colorScheduledVolunteers" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorInvolvedDepartments" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} interval={xAxisInterval} />
                    <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3' }} />
                    <Area type="monotone" dataKey="scheduledVolunteers" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorScheduledVolunteers)" name="Voluntários Escalados" />
                    <Area type="monotone" dataKey="involvedDepartments" stroke="#8b5cf6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorInvolvedDepartments)" name="Departamentos Envolvidos" />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    </div>
  );
};