import React from 'react';
import { Page } from '../types';
import { SupabaseClient, Session } from '@supabase/supabase-js';

interface NavItemProps {
  icon: React.ReactElement<any>;
  label: string;
  page: Page;
  activePage: Page;
  onNavigate: (page: Page) => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, page, activePage, onNavigate }) => (
  <button
    onClick={() => onNavigate(page)}
    className={`flex items-center space-x-3 px-4 py-2 rounded-lg transition-colors w-full text-left ${
      activePage === page
        ? 'bg-blue-600 text-white font-semibold'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`}
  >
    {React.cloneElement(icon, { className: 'h-5 w-5' })}
    <span>{label}</span>
  </button>
);


interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  onNewVolunteer: () => void;
  onNewSchedule: () => void;
  supabase: SupabaseClient | null;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  userRole: string | null;
  session: Session | null;
}

const Sidebar: React.FC<SidebarProps> = ({ activePage, onNavigate, onNewVolunteer, onNewSchedule, supabase, isOpen, setIsOpen, userRole, session }) => {
    const handleLogout = async () => {
        if (supabase) {
            await supabase.auth.signOut();
        }
    };

    const getInitials = (name?: string | null): string => {
        if (!name) return '??';
        const nameParts = name.trim().split(' ');
        if (nameParts.length === 1 && nameParts[0]) {
            return nameParts[0].substring(0, 2).toUpperCase();
        }
        const firstInitial = nameParts[0]?.[0] || '';
        const lastInitial = nameParts.length > 1 ? nameParts[nameParts.length - 1]?.[0] || '' : '';
        return (firstInitial + lastInitial).toUpperCase();
    };

    const user = session?.user;
    const userName = user?.user_metadata?.name || user?.email || 'Usuário';
    const userEmail = user?.email || 'N/A';
    const initials = getInitials(userName);

  return (
    <>
      <aside className={`fixed lg:static inset-y-0 left-0 w-64 bg-white flex flex-col p-6 border-r border-slate-200 z-30 transition-transform duration-300 ease-in-out transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="flex items-center justify-between mb-10">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-600 text-white rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">Voluntários</h1>
                <p className="text-sm text-slate-500">Sistema da Igreja</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="lg:hidden p-1 text-slate-500 hover:text-slate-800" aria-label="Fechar menu">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>

        <nav className="flex-1 flex flex-col space-y-4">
          <div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Navegação</h2>
            <div className="space-y-1">
              <NavItem
                icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>}
                label="Dashboard"
                page="dashboard"
                activePage={activePage}
                onNavigate={onNavigate}
              />
              <NavItem
                icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656-.126-1.283-.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
                label="Voluntários"
                page="volunteers"
                activePage={activePage}
                onNavigate={onNavigate}
              />
              <NavItem
                icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>}
                label="Ministérios"
                page="ministries"
                activePage={activePage}
                onNavigate={onNavigate}
              />
              <NavItem
                icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                label="Eventos"
                page="schedules"
                activePage={activePage}
                onNavigate={onNavigate}
              />
              {userRole === 'admin' && (
                <NavItem
                  icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 20.944a11.955 11.955 0 019-2.606 11.955 11.955 0 019 2.606c.342-1.156.342-2.327 0-3.482z" /></svg>}
                  label="Admin"
                  page="admin"
                  activePage={activePage}
                  onNavigate={onNavigate}
                />
              )}
            </div>
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Ações Rápidas</h2>
            <div className="space-y-1">
               <button onClick={onNewVolunteer} className="flex items-center space-x-3 px-4 py-2 rounded-lg transition-colors w-full text-left text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                  <span>Novo Voluntário</span>
               </button>
               <button onClick={onNewSchedule} className="flex items-center space-x-3 px-4 py-2 rounded-lg transition-colors w-full text-left text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <span>Novo Evento</span>
               </button>
            </div>
          </div>
        </nav>

        <div className="mt-auto">
          <div className="w-full h-px bg-slate-200 mb-4"></div>
           <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 overflow-hidden">
                  <div className="h-10 w-10 flex-shrink-0 flex items-center justify-center bg-blue-100 rounded-full text-blue-600 font-bold">
                    {initials}
                  </div>
                  <div className="flex-1 overflow-hidden">
                      <p className="font-semibold text-slate-800 text-sm truncate" title={userEmail}>{userName}</p>
                      {userRole && (
                          <span className={`text-xs font-semibold rounded-full capitalize px-2 py-0.5 inline-block mt-1 ${userRole === 'admin' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-700'}`}>
                              {userRole === 'admin' ? 'Admin' : 'Líder'}
                          </span>
                      )}
                  </div>
              </div>
              <button 
                  onClick={handleLogout} 
                  className="text-slate-500 hover:text-red-600 transition-colors p-1 flex-shrink-0" 
                  aria-label="Sair" 
                  title="Sair"
              >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
              </button>
          </div>
        </div>
      </aside>
      {isOpen && <div onClick={() => setIsOpen(false)} className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-20" aria-hidden="true"></div>}
    </>
  );
};

export default Sidebar;