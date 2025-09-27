import React from 'react';
import { Ministry } from '../types';

const Tag: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="px-3 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-600 border border-slate-200">{children}</span>
);

interface MinistryCardProps {
  ministry: Ministry;
  onEdit: (ministry: Ministry) => void;
  onDelete: (ministryId: number) => void;
}

const MinistryCard: React.FC<MinistryCardProps> = ({ ministry, onEdit, onDelete }) => {
  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-full bg-orange-100 flex-shrink-0 flex items-center justify-center text-orange-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <div>
            <p className="font-bold text-slate-800 text-lg">{ministry.name}</p>
            <div className="mt-1">
                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${ministry.status === 'Ativo' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>{ministry.status}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-3 text-slate-400">
          <button onClick={() => onEdit(ministry)} className="hover:text-slate-600"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" /></svg></button>
          <button onClick={() => onDelete(ministry.id!)} className="hover:text-red-600"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
        </div>
      </div>
      
      {ministry.description && <p className="text-sm text-slate-600">{ministry.description}</p>}

      <div className="space-y-3 pt-2">
        <div className="flex items-center space-x-2 text-sm text-slate-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          <span>Líder: <span className="font-semibold">{ministry.leader}</span></span>
        </div>
        
        {ministry.skills_required.length > 0 && (
          <div className="flex items-start space-x-2 text-sm text-slate-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
            <div className="flex flex-wrap gap-1.5">
                <span className="mr-1">Habilidades:</span>
                {ministry.skills_required.map(skill => <Tag key={skill}>{skill}</Tag>)}
            </div>
          </div>
        )}

        {ministry.meeting_days.length > 0 && (
          <div className="flex items-start space-x-2 text-sm text-slate-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            <div className="flex flex-wrap gap-1.5">
                <span className="mr-1">Reuniões:</span>
                <span>{ministry.meeting_days.join(', ')}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MinistryCard;