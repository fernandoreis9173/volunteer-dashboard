import React, { useState, useEffect, useCallback } from 'react';
import { Event as VolunteerEvent, DetailedVolunteer } from '../types';
import { supabase } from '../lib/supabaseClient';
import { type Session } from '@supabase/supabase-js';
import { getErrorMessage } from '../lib/utils';

interface VolunteerDashboardProps {
  session: Session | null;
}

const parseArrayData = (data: string[] | string | null | undefined): string[] => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === 'string') {
        if (data.startsWith('[') && data.endsWith(']')) {
            try {
                const parsed = JSON.parse(data);
                if (Array.isArray(parsed)) return parsed;
            } catch (e) { /* ignore */ }
        }
        if (data.startsWith('{') && data.endsWith('}')) {
             return data.substring(1, data.length - 1).split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        }
        if (data.trim()) {
            return data.split(',').map(s => s.trim());
        }
    }
    return [];
};


const ScheduleCard: React.FC<{ schedule: VolunteerEvent; isNext?: boolean }> = ({ schedule, isNext = false }) => {
    const departmentNames = (schedule.event_departments || []).map(ed => ed.departments?.name).filter(Boolean).join(', ');
  
    return (
      <div className={`p-5 rounded-xl border ${isNext ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'}`}>
        {isNext && <p className="text-sm font-bold text-blue-600 mb-2">SEU PRÓXIMO COMPROMISSO</p>}
        <h3 className={`font-bold  mb-2 ${isNext ? 'text-xl text-blue-900' : 'text-slate-800'}`}>{schedule.name}</h3>
        <div className="space-y-2 text-sm text-slate-500">
          <p><strong>Departamento:</strong> <span className="text-blue-600 font-medium">{departmentNames}</span></p>
          <p><strong>Data:</strong> {new Date(schedule.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
          <p><strong>Horário:</strong> {schedule.start_time} - {schedule.end_time}</p>
          {schedule.local && <p><strong>Local:</strong> {schedule.local}</p>}
        </div>
      </div>
    );
};

const VolunteerDashboard: React.FC<VolunteerDashboardProps> = ({ session }) => {
  const [schedules, setSchedules] = useState<VolunteerEvent[]>([]);
  const [volunteerProfile, setVolunteerProfile] = useState<DetailedVolunteer | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchVolunteerData = useCallback(async () => {
    if (!session) return;
    setLoading(true);

    try {
        const { data: volunteerData, error: volunteerError } = await supabase
            .from('volunteers')
            .select('id, name, phone, initials, status, departments:departaments, skills, availability')
            .eq('user_id', session.user.id)
            .single();

        if (volunteerError || !volunteerData) {
            throw volunteerError || new Error("Volunteer profile not found.");
        }
        
        setVolunteerProfile(volunteerData as DetailedVolunteer);

        const today = new Date().toISOString().slice(0, 10);
        const { data: scheduleQueryData, error: scheduleError } = await supabase
          .from('event_volunteers')
          .select('events(*, event_departments(departments(name)))')
          .eq('volunteer_id', volunteerData.id)
          .gte('events.date', today)
          .order('date', { referencedTable: 'events', ascending: true });
        
        if (scheduleError) throw scheduleError;

        const fetchedSchedules = (scheduleQueryData || []).flatMap(item => item.events || []).filter((event): event is VolunteerEvent => event !== null);
        setSchedules(fetchedSchedules);

    } catch (error) {
        console.error("Error fetching volunteer dashboard data:", getErrorMessage(error));
        setSchedules([]);
        setVolunteerProfile(null);
    } finally {
        setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchVolunteerData();
  }, [fetchVolunteerData]);

  const nextEvent = schedules.length > 0 ? schedules[0] : null;
  const otherEvents = schedules.length > 1 ? schedules.slice(1) : [];
  const volunteerName = volunteerProfile?.name || 'Voluntário';
  const volunteerDepartments = parseArrayData(volunteerProfile?.departments);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Bem-vindo, {volunteerName}!</h1>
        <p className="text-slate-500 mt-1">Aqui estão suas próximas escalas e informações.</p>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm">
        <h2 className="text-xl font-bold text-slate-800 mb-4">Minhas Informações</h2>
        <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm font-semibold text-slate-500">Meus Departamentos:</span>
            {loading ? <span className="text-sm text-slate-500">Carregando...</span> : volunteerDepartments.length > 0 ? (
                volunteerDepartments.map(dept => (
                    <span key={dept} className="px-3 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">{dept}</span>
                ))
            ) : (
                <p className="text-sm text-slate-500">Nenhum departamento associado.</p>
            )}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-slate-800 mb-4">Minhas Próximas Escalas</h2>
         {loading ? (
            <p className="text-slate-500">Carregando escalas...</p>
        ) : schedules.length > 0 ? (
            <div className="space-y-4">
                {nextEvent && <ScheduleCard schedule={nextEvent} isNext={true} />}
                {otherEvents.length > 0 && (
                    <div className="pt-4 mt-4 border-t border-slate-200 space-y-4">
                        {otherEvents.map((schedule) => (
                            <ScheduleCard key={schedule.id} schedule={schedule} />
                        ))}
                    </div>
                )}
            </div>
        ) : (
            <div className="text-center py-12 text-slate-500 bg-white rounded-2xl shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="mt-2 text-lg font-medium text-slate-800">Nenhuma escala futura</h3>
                <p className="mt-1 text-sm">Você não está escalado para nenhum evento futuro.</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default VolunteerDashboard;