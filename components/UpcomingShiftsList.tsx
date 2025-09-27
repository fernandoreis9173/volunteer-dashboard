import React, { useState, useEffect } from 'react';
import type { Shift } from '../types';
import { SupabaseClient } from '@supabase/supabase-js';

interface UpcomingShiftsListProps {
  supabase: SupabaseClient | null;
}

const ShiftCard: React.FC<{ shift: Shift }> = ({ shift }) => (
  <div className="bg-white p-5 rounded-xl border border-slate-200 relative">
    <span className="absolute top-4 right-4 text-xs font-semibold bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full">pendente</span>
    <h3 className="font-bold text-slate-800 mb-2">{shift.event}</h3>
    <div className="space-y-2 text-sm text-slate-500">
      <div className="flex items-center space-x-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span>{shift.date}</span>
      </div>
      <div className="flex items-center space-x-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>{shift.time}</span>
      </div>
    </div>
    <div className="w-full h-px bg-slate-200 my-4"></div>
    <p className="text-sm text-slate-600">
      {shift.volunteer} • <span className="text-blue-600 font-medium">{shift.ministry}</span>
    </p>
  </div>
);

const UpcomingShiftsList: React.FC<UpcomingShiftsListProps> = ({ supabase }) => {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchShifts = async () => {
      if (!supabase) {
        setLoading(false);
        return;
      };
      setLoading(true);
      const { data, error } = await supabase.from('shifts').select('*').limit(3);
      if (error) {
        console.error('Error fetching shifts', error);
      } else {
        setShifts(data || []);
      }
      setLoading(false);
    };

    fetchShifts();
  }, [supabase]);
  
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm h-full">
      <div className="flex items-center space-x-2 mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <h2 className="text-xl font-bold text-slate-800">Próximas Escalas</h2>
      </div>
      <div className="space-y-4">
        {loading ? (
          <p className="text-slate-500">Carregando escalas...</p>
        ) : shifts.length > 0 ? (
          shifts.map((shift) => (
            <ShiftCard key={shift.id} shift={shift} />
          ))
        ) : (
          <p className="text-slate-500">Nenhuma escala encontrada.</p>
        )}
      </div>
    </div>
  );
};

export default UpcomingShiftsList;