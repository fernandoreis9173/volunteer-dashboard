
import React, { useState, useEffect } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { Event } from '../types';

interface VolunteerDashboardProps {
  supabase: SupabaseClient | null;
  volunteerId: number | null;
}

const VolunteerDashboard: React.FC<VolunteerDashboardProps> = ({ supabase, volunteerId }) => {
  const [schedules, setSchedules] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSchedules = async () => {
      if (!supabase || !volunteerId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      
      const today = new Date().toISOString().slice(0, 10);

      try {
        const { data, error: fetchError } = await supabase
          .from('event_volunteers')
          .select(`
            events (
              *,
              event_departments (
                departments ( name )
              )
            )
          `)
          .eq('volunteer_id', volunteerId)
          .gte('events.date', today)
          .order('date', { referencedTable: 'events', ascending: true });
          
        if (fetchError) throw fetchError;
        
        // FIX: The Supabase query returns a nested array of events ([{events: [...]}, {events: [...]}])
        // which needs to be flattened into a single list of event objects.
        // `flatMap` correctly extracts and flattens these nested event arrays.
        const formattedData = data
          .flatMap(item => item.events || [])
          .filter((event): event is Event => event !== null);
        setSchedules(formattedData);

      } catch (error: any) {
        console.error('Error fetching volunteer schedules:', error);
        setError("Não foi possível carregar suas escalas.");
      } finally {
        setLoading(false);
      }
    };

    fetchSchedules();
  }, [supabase, volunteerId]);

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
