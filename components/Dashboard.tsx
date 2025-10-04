import React, { useState } from 'react';
import StatCard from './StatCard';
import TodayShiftsList from './TodayShiftsList';
import UpcomingShiftsList from './UpcomingShiftsList';
import ActiveVolunteersList from './ActiveVolunteersList';
import type { DashboardEvent, DashboardVolunteer } from '../types';
import type { ChartDataPoint } from '../App';
import EventDetailsModal from './EventDetailsModal';
import AnalysisChart from './TrafficChart';


interface DashboardProps {
  initialData: {
    stats?: {
        activeVolunteers: string;
        departments: string;
        schedulesToday: string;
        schedulesTomorrow: string;
    };
    todaySchedules?: DashboardEvent[];
    upcomingSchedules?: DashboardEvent[];
    activeVolunteers?: DashboardVolunteer[];
    chartData?: ChartDataPoint[];
  } | null;
}

const Dashboard: React.FC<DashboardProps> = ({ initialData }) => {
  const [selectedEvent, setSelectedEvent] = useState<DashboardEvent | null>(null);
  
  const stats = initialData?.stats;
  const todaySchedules = initialData?.todaySchedules ?? [];
  const upcomingSchedules = initialData?.upcomingSchedules ?? [];
  const activeVolunteers = initialData?.activeVolunteers ?? [];
  const chartData = initialData?.chartData ?? [];
  const loading = !initialData;

  const handleViewDetails = (event: DashboardEvent) => {
    setSelectedEvent(event);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 mt-1">Visão geral do sistema de voluntários</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Voluntários Ativos" value={loading ? '...' : stats?.activeVolunteers ?? '0'} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m-7.5-2.226a3 3 0 0 0-4.682 2.72 9.094 9.094 0 0 0 3.741.479m7.5-2.226V18a2.25 2.25 0 0 1-2.25 2.25H12a2.25 2.25 0 0 1-2.25-2.25V18.226m3.75-10.5a3.375 3.375 0 0 0-6.75 0v1.5a3.375 3.375 0 0 0 6.75 0v-1.5ZM10.5 8.25a3.375 3.375 0 0 0-6.75 0v1.5a3.375 3.375 0 0 0 6.75 0v-1.5Z" /></svg>} color="blue" />
        <StatCard title="Departamentos" value={loading ? '...' : stats?.departments ?? '0'} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18h16.5M5.25 6H18.75m-13.5 0V21m13.5-15V21m-10.5-9.75h.008v.008H8.25v-.008ZM8.25 15h.008v.008H8.25V15Zm3.75-9.75h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm3.75-9.75h.008v.008H15.75v-.008ZM15.75 15h.008v.008H15.75V15Z" /></svg>} color="teal" />
        <StatCard title="Eventos Hoje" value={loading ? '...' : stats?.schedulesToday ?? '0'} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0h18" /></svg>} color="orange" />
        <StatCard title="Eventos Amanhã" value={loading ? '...' : stats?.schedulesTomorrow ?? '0'} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.898 20.562 16.25 21.75l-.648-1.188a2.25 2.25 0 0 1-1.423-1.423L13.125 18l1.188-.648a2.25 2.25 0 0 1 1.423-1.423L16.25 15l.648 1.188a2.25 2.25 0 0 1 1.423 1.423L19.5 18l-1.188.648a2.25 2.25 0 0 1-1.423 1.423Z" /></svg>} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
        <div className="lg:col-span-2">
            <AnalysisChart data={chartData} />
        </div>
        <div className="lg:col-span-1">
            <ActiveVolunteersList volunteers={activeVolunteers} loading={loading} />
        </div>
      </div>

      {(todaySchedules.length > 0 || upcomingSchedules.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {todaySchedules.length > 0 && (
                <TodayShiftsList schedules={todaySchedules} loading={loading} onViewDetails={handleViewDetails} />
            )}
            {upcomingSchedules.length > 0 && (
                <UpcomingShiftsList schedules={upcomingSchedules} loading={loading} onViewDetails={handleViewDetails} />
            )}
        </div>
      )}

      <EventDetailsModal 
        isOpen={!!selectedEvent}
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
};

export default Dashboard;