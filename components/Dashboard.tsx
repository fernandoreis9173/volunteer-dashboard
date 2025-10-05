

import React, { useState } from 'react';
import StatsRow from './StatsRow';
import UpcomingShiftsList from './UpcomingShiftsList';
import ActiveVolunteersList from './ActiveVolunteersList';
import type { DashboardEvent, DashboardVolunteer, Stat, EnrichedUser } from '../types';
import type { ChartDataPoint } from '../App';
import EventDetailsModal from './EventDetailsModal';
import AnalysisChart from './TrafficChart';
import ActivityFeed from './ActivityFeed';


interface DashboardProps {
  initialData: {
    stats?: {
        activeVolunteers: Stat;
        departments: Stat;
        schedulesToday: Stat;
        schedulesTomorrow: Stat;
    };
    todaySchedules?: DashboardEvent[];
    upcomingSchedules?: DashboardEvent[];
    activeVolunteers?: DashboardVolunteer[];
    chartData?: ChartDataPoint[];
    activeLeaders?: EnrichedUser[];
  } | null;
}

const Dashboard: React.FC<DashboardProps> = ({ initialData }) => {
  const [selectedEvent, setSelectedEvent] = useState<DashboardEvent | null>(null);
  
  const stats = initialData?.stats;
  const todaySchedules = initialData?.todaySchedules ?? [];
  const upcomingSchedules = initialData?.upcomingSchedules ?? [];
  const chartData = initialData?.chartData ?? [];
  const activeLeaders = initialData?.activeLeaders ?? [];
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

      <StatsRow stats={stats} loading={loading} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
        <div className="lg:col-span-2">
            <AnalysisChart data={chartData} />
        </div>
        <div className="lg:col-span-1">
            <ActiveVolunteersList stats={stats} loading={loading} />
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
         <div className="lg:col-span-2">
            <UpcomingShiftsList 
                todaySchedules={todaySchedules}
                upcomingSchedules={upcomingSchedules}
                loading={loading} 
                onViewDetails={handleViewDetails} 
            />
         </div>
         <div className="lg:col-span-1">
            <ActivityFeed leaders={activeLeaders} loading={loading} />
         </div>
      </div>


      <EventDetailsModal 
        isOpen={!!selectedEvent}
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
};

export default Dashboard;