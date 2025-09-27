
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
    if (!value) return value;
    const phoneNumber = value.replace(/[^\d]/g, '');
    const phoneNumberLength = phoneNumber.length;
    if (phoneNumberLength < 3) return `(${phoneNumber}`;
    if (phoneNumberLength < 8) {
      return `(${phoneNumber.slice(0, 2)}) ${phoneNumber.slice(2)}`;
    }
    return `(${phoneNumber.slice(0, 2)}) ${phoneNumber.slice(2, 7)}-${phoneNumber.slice(7, 11)}`;
};

const VolunteerCard: React.FC<VolunteerCardProps> = ({ volunteer, onEdit, onDelete }) => {
  const getAvailabilityText = () => {
    // FIX: The availability property is typed as string[], but based on the following logic,
    // it can sometimes be a string from the database. Casting to `any` allows the runtime
    // checks to handle both cases and prevents a TypeScript error.
    let availabilityData: any = volunteer.availability;

    if (!availabilityData || availabilityData.length === 0) {
      return 'Nenhuma registrada';
    }

    // Check if it's a string that looks like a JSON array and parse it
    if (typeof availabilityData === 'string' && availabilityData.startsWith('[') && availabilityData.endsWith(']')) {
      try {
        availabilityData = JSON.parse(availabilityData);
      } catch (e) {
        // If parsing fails, it's just a string. Return it as is.
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
    
    // Fallback for non-array, non-JSON-array-string data.
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
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                </svg>
              )}
              <span>{volunteer.status}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-3 text-slate-400">
          <button onClick={() => onEdit(volunteer)} className="hover:text-slate-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" />
            </svg>
          </button>
          <button onClick={() => onDelete(volunteer.id!)} className="hover:text-red-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
      
      <div className="text-sm text-slate-600 space-y-2">
         <div className="flex items-center space-x-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span>{volunteer.email}</span>
        </div>
        {volunteer.phone && (
          <div className="flex items-center space-x-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span>{formatPhoneNumber(volunteer.phone)}</span>
          </div>
        )}
      </div>
  
      {volunteer.ministries.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-slate-500 mb-2">Ministérios:</p>
          <div className="flex flex-wrap gap-2">
            {volunteer.ministries.map(m => <Tag key={m} color="yellow">{m}</Tag>)}
          </div>
        </div>
      )}
      
      {volunteer.skills.length > 0 && (
          <div>
          <p className="text-sm font-semibold text-slate-500 mb-2">Habilidades:</p>
          <div className="flex flex-wrap gap-2">
              {volunteer.skills.map(s => <Tag key={s} color="blue">{s}</Tag>)}
          </div>
          </div>
      )}
  
      <div>
        <p className="text-sm font-semibold text-slate-500 mb-2">Disponibilidade:</p>
        <div className="flex items-center space-x-2 text-sm text-slate-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>
            {getAvailabilityText()}
          </span>
        </div>
      </div>
  
    </div>
  );
}
export default VolunteerCard;