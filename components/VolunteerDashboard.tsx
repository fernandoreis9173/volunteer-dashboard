

import React from 'react';
import { Event } from '../types';

interface VolunteerDashboardProps {
  initialData: {
    schedules?: Event[];
  } | null;
}

const VolunteerDashboard: React.FC<VolunteerDashboardProps> = ({ initialData }) => {
  const schedules = initialData?.schedules ?? [];
  const loading = !initialData;
  const error = null; // Error handling would be managed by the parent component now

  const ScheduleCard: React.FC<{ schedule: Event }> = ({ schedule }) => {
    const departmentNames = (schedule.event_departments || []).map(ed => ed.departments?.name).filter(Boolean).join(', ');
  
    return (
      <div className="bg-white p-5 rounded-xl border border-slate-200">
        <h3 className="font-bold text-slate-800 mb-2">{schedule.name}</h3>
        <div className="space-y-2 text-sm text-slate-500">
          <p><strong>Departamento:</strong> <span className="text-blue-600 font-medium">{departmentNames}</span></p>
          <p><strong>Data:</strong> {new Date(schedule.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
          <p><strong>Horário:</strong> {schedule.start_time} - {schedule.end_time}</p>
          {schedule.local && <p><strong>Local:</strong> {schedule.local}</p>}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Meu Dashboard</h1>
        <p className="text-slate-500 mt-1">Bem-vindo! Aqui estão suas próximas escalas e notificações.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm h-full">
                <h2 className="text-xl font-bold text-slate-800 mb-4">Minhas Próximas Escalas</h2>
                {loading ? (
                    <p className="text-slate-500">Carregando escalas...</p>
                ) : error ? (
                    <p className="text-red-500">{error}</p>
                ) : schedules.length > 0 ? (
                    <div className="space-y-4">
                    {schedules.map((schedule) => (
                        <ScheduleCard key={schedule.id} schedule={schedule} />
                    ))}
                    </div>
                ) : (
                    <p className="text-slate-500">Você não está escalado para nenhum evento futuro.</p>
                )}
            </div>
        </div>

        <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm h-full">
                 <h2 className="text-xl font-bold text-slate-800 mb-4">Notificações</h2>
                 <div className="text-center text-slate-400 py-8">
                    <p className="text-sm">Nenhuma notificação nova.</p>
                    <p className="text-xs mt-1">(Funcionalidades como convites de departamento e trocas de escala aparecerão aqui.)</p>
                 </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default VolunteerDashboard;
