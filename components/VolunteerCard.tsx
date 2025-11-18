import React, { useMemo, useState, useRef, useEffect } from 'react';
import { DetailedVolunteer, Department } from '../types';

const Tag: React.FC<{ children: React.ReactNode; color: 'yellow' | 'blue' }> = ({ children, color }) => {
  const baseClasses = "px-3 py-1 text-xs font-semibold rounded-full border";
  const colorClasses = {
    yellow: "bg-yellow-100 text-yellow-800 border-yellow-200",
    blue: "bg-blue-100 text-blue-800 border-blue-200",
  };
  return <span className={`${baseClasses} ${colorClasses[color]}`}>{children}</span>
};

interface VolunteerCardProps {
    volunteer: DetailedVolunteer;
    onEdit: (volunteer: DetailedVolunteer) => void;
    onInvite: (volunteer: DetailedVolunteer) => void;
    onRemoveFromDepartment: (volunteer: DetailedVolunteer) => void;
    onRequestAction: (volunteer: DetailedVolunteer, type: 'disable' | 'enable') => void;
    onPromote: (volunteer: DetailedVolunteer) => void; // Nova prop
    userRole: string | null;
    leaderDepartmentName: string | null;
    isInvitePending: boolean;
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

const VolunteerCard: React.FC<VolunteerCardProps> = ({ volunteer, onEdit, onInvite, onRemoveFromDepartment, onRequestAction, onPromote, userRole, leaderDepartmentName, isInvitePending }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
              setIsMenuOpen(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
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

  const isLeader = userRole === 'leader' || userRole === 'lider';
  const isAdmin = userRole === 'admin';
  
  const isAlreadyInDepartment = useMemo(() => {
    if (!isLeader || !leaderDepartmentName || !Array.isArray(volunteer.departments)) return false;
    return volunteer.departments.some(d => d.name === leaderDepartmentName);
  }, [volunteer.departments, isLeader, leaderDepartmentName]);

  return (
    <div className={`p-5 rounded-xl shadow-sm border flex flex-col space-y-4 transition-colors ${isAlreadyInDepartment ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-full bg-blue-500 flex-shrink-0 flex items-center justify-center text-white font-bold text-lg">
            {volunteer.initials}
          </div>
          <div>
            <p className="font-bold text-slate-800">{volunteer.name}</p>
            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${volunteer.status === 'Ativo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{volunteer.status}</span>
          </div>
        </div>
        <div className="flex items-center space-x-1 text-slate-400">
          {isAdmin && (
            <div className="relative" ref={menuRef}>
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-1.5 rounded-md hover:bg-slate-100 hover:text-slate-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
              </button>
              {isMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border border-slate-200">
                  <ul className="py-1">
                    <li><button onClick={() => { onPromote(volunteer); setIsMenuOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Promover a Líder</button></li>
                    {volunteer.status === 'Inativo' ? (
                      <li><button onClick={() => { onRequestAction(volunteer, 'enable'); setIsMenuOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-green-50">Reativar Voluntário</button></li>
                    ) : (
                      <li><button onClick={() => { onRequestAction(volunteer, 'disable'); setIsMenuOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">Desativar Voluntário</button></li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      <div className="text-sm text-slate-600 space-y-2">
         <div className="flex items-center space-x-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
          </svg>
          <span>{volunteer.email}</span>
        </div>
        {volunteer.phone && (
          <div className="flex items-center space-x-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
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
            {volunteer.departments.map(dept => (
              <Tag key={dept.id} color={dept.name === leaderDepartmentName ? 'blue' : 'yellow'}>
                {dept.name}
              </Tag>
            ))}
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
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0h18" />
          </svg>
          <span>
            {getAvailabilityText()}
          </span>
        </div>
      </div>
      
      {isLeader && (
        <div className="pt-4 border-t border-slate-200">
          {isAlreadyInDepartment ? (
            <button
              onClick={() => onRemoveFromDepartment(volunteer)}
              className="w-full text-center px-4 py-2 text-sm font-semibold rounded-lg transition-colors bg-red-100 text-red-700 hover:bg-red-200"
            >
              Remover do Departamento
            </button>
          ) : isInvitePending ? (
            <button
              disabled
              className="w-full text-center px-4 py-2 text-sm font-semibold rounded-lg transition-colors bg-yellow-100 text-yellow-700 cursor-not-allowed"
            >
              Pendente
            </button>
          ) : volunteer.status === 'Inativo' ? (
            <button
              disabled
              className="w-full text-center px-4 py-2 text-sm font-semibold rounded-lg transition-colors bg-slate-100 text-slate-400 cursor-not-allowed"
            >
              Voluntário Inativo
            </button>
          ) : (
            <button
              onClick={() => onInvite(volunteer)}
              className="w-full text-center px-4 py-2 text-sm font-semibold rounded-lg transition-colors bg-blue-100 text-blue-700 hover:bg-blue-200"
            >
              Convidar
            </button>
          )}
        </div>
      )}
  
    </div>
  );
}

export default React.memo(VolunteerCard);