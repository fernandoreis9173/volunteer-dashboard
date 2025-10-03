

import React from 'react';
import { DetailedVolunteer } from '../types';

const Tag: React.FC<{ children: React.ReactNode; color: 'yellow' | 'blue' }> = ({ children, color }) => {
  const baseClasses = "px-3 py-1 text-xs font-semibold rounded-full";
  const colorClasses = {
    yellow: "bg-yellow-100 text-yellow-800",
    blue: "bg-blue-100 text-blue-800",
  };
  return <span className={`${baseClasses} ${colorClasses[color]}`}>{children}</span>
};

interface VolunteerCardProps {
    volunteer: DetailedVolunteer;
    onEdit: (volunteer: DetailedVolunteer) => void;
    onDelete: (volunteerId: number) => void;
}

const formatPhoneNumber = (value: string) => {
    if (!value) return '';

    const phoneNumber = value.replace(/\D/g, '').slice(0, 11);
    const { length } = phoneNumber;

    if (length <= 2) {
        return `(${phoneNumber}`;
    }
    if (length <= 6) {
        return `(${phoneNumber.slice(0, 2)}) ${phoneNumber.slice(2)}`;
    }
    if (length <= 10) {
        return `(${phoneNumber.slice(0, 2)}) ${phoneNumber.slice(2, 6)}-${phoneNumber.slice(6)}`;
    }
    return `(${phoneNumber.slice(0, 2)}) ${phoneNumber.slice(2, 7)}-${phoneNumber.slice(7)}`;
};

const VolunteerCard: React.FC<VolunteerCardProps> = ({ volunteer, onEdit, onDelete }) => {
  const getAvailabilityText = () => {
    let availabilityData: any = volunteer.availability;

    if (!availabilityData || availabilityData.length === 0) {
      return 'Nenhuma registrada';
    }

    if (typeof availabilityData === 'string' && availabilityData.startsWith('[') && availabilityData.endsWith(']')) {
      try {
        availabilityData = JSON.parse(availabilityData);
      } catch (e) {
        return String(volunteer.availability);
      }
    }

    if (Array.isArray(availabilityData)) {
      const count = availabilityData.length;
      if (count === 0) {
          return 'Nenhuma registrada';
      }
      if (count === 1) {
          return '1 dia disponível';
      }
      return `${count} dias disponíveis`;
    }
    
    return String(volunteer.availability);
  };

  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-full bg-blue-500 flex-shrink-0 flex items-center justify-center text-white font-bold text-lg">
            {volunteer.initials}
          </div>
          <div>
            <p className="font-bold text-slate-800">{volunteer.name}</p>
            <div className={`flex items-center space-x-1.5 text-sm font-semibold mt-1 ${volunteer.status === 'Ativo' ? 'text-green-600' : 'text-slate-500'}`}>
              {volunteer.status === 'Ativo' ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <span>{volunteer.status}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-1 text-slate-400">
          <button onClick={() => onEdit(volunteer)} className="p-1.5 rounded-md hover:bg-slate-100 hover:text-slate-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
            </svg>
          </button>
          <button onClick={() => onDelete(volunteer.id!)} className="p-1.5 rounded-md hover:bg-red-50 hover:text-red-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.134-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.067-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          </button>
        </div>
      </div>
      
      <div className="text-sm text-slate-600 space-y-2">
         <div className="flex items-center space-x-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
          </svg>
          <span>{volunteer.email}</span>
        </div>
        {volunteer.phone && (
          <div className="flex items-center space-x-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
              </svg>
              <span>{formatPhoneNumber(volunteer.phone)}</span>
          </div>
        )}
      </div>
  
      {(volunteer.departments || []).length > 0 && (
        <div>
          <p className="text-sm font-semibold text-slate-500 mb-2">Departamentos:</p>
          <div className="flex flex-wrap gap-2">
            {(volunteer.departments || []).map(m => <Tag key={m} color="yellow">{m}</Tag>)}
          </div>
        </div>
      )}
      
      {(volunteer.skills || []).length > 0 && (
          <div>
          <p className="text-sm font-semibold text-slate-500 mb-2">Habilidades:</p>
          <div className="flex flex-wrap gap-2">
              {(volunteer.skills || []).map(s => <Tag key={s} color="blue">{s}</Tag>)}
          </div>
          </div>
      )}
  
      <div>
        <p className="text-sm font-semibold text-slate-500 mb-2">Disponibilidade:</p>
        <div className="flex items-center space-x-2 text-sm text-slate-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0h18" />
          </svg>
          <span>
            {getAvailabilityText()}
          </span>
        </div>
      </div>
  
    </div>
  );
}

export default React.memo(VolunteerCard);