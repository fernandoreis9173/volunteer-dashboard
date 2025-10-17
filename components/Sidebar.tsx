import React, { useState, useRef, useEffect } from 'react';
import type { Page } from '../types';
import { supabase } from '../lib/supabaseClient';
// FIX: Use 'type' import for Session to resolve potential module resolution issues with Supabase v2.
import { type Session } from '@supabase/supabase-js';

interface NavItemProps {
  icon: React.ReactElement<any>;
  label: string;
  page: Page;
  activePage: Page;
  onNavigate: (page: Page) => void;
  badgeCount?: number;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, page, activePage, onNavigate, badgeCount }) => (
  <button
    onClick={() => onNavigate(page)}
    className={`flex items-center justify-between space-x-3 px-4 py-2 rounded-lg transition-colors w-full text-left ${
      activePage === page
        ? 'bg-blue-600 text-white font-semibold'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`}
  >
    <div className="flex items-center space-x-3">
        {React.cloneElement(icon, { className: 'h-5 w-5' })}
        <span>{label}</span>
    </div>
    {badgeCount > 0 && (
        <span className="bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {badgeCount}
        </span>
    )}
  </button>
);


interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  onNewVolunteer: () => void;
  onNewEvent: () => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  userRole: string | null;
  session: Session | null;
  unreadCount: number;
  pushPermissionStatus: string | null;
  onSubscribeToPush: () => void;
  canInstallPwa: boolean;
  onInstallPrompt: () => void;
}

interface NavItemData {
  page: Page;
  label: string;
  icon: React.ReactElement;
  roles: string[]; // Roles that can see this item
}

const allNavItems: NavItemData[] = [
    { page: 'dashboard', label: 'Dashboard', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 8.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 8.25 20.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6A2.25 2.25 0 0 1 15.75 3.75h2.25A2.25 2.25 0 0 1 20.25 6v2.25a2.25 2.25 0 0 1-2.25 2.25H15.75A2.25 2.25 0 0 1 13.5 8.25V6ZM13.5 15.75A2.25 2.25 0 0 1 15.75 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18.25 20.25H15.75A2.25 2.25 0 0 1 13.5 18v-2.25Z" /></svg>, roles: ['admin', 'leader', 'volunteer'] },
    { page: 'notifications', label: 'Notificações', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" /></svg>, roles: ['leader', 'volunteer'] },
    { page: 'volunteers', label: 'Volunteers', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m-7.5-2.226a3 3 0 0 0-4.682 2.72 9.094 9.094 0 0 0 3.741.479m7.5-2.226V18a2.25 2.25 0 0 1-2.25 2.25H12a2.25 2.25 0 0 1-2.25-2.25V18.226m3.75-10.5a3.375 3.375 0 0 0-6.75 0v1.5a3.375 3.375 0 0 0 6.75 0v-1.5ZM10.5 8.25a3.375 3.375 0 0 0-6.75 0v1.5a3.375 3.375 0 0 0 6.75 0v-1.5Z" /></svg>, roles: ['admin', 'leader'] },
    { page: 'departments', label: 'Departamentos', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18h16.5M5.25 6H18.75m-13.5 0V21m13.5-15V21m-10.5-9.75h.008v.008H8.25v-.008ZM8.25 15h.008v.008H8.25V15Zm3.75-9.75h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm3.75-9.75h.008v.008H15.75v-.008ZM15.75 15h.008v.008H15.75V15Z" /></svg>, roles: ['admin'] },
    { page: 'events', label: 'Eventos (Lista)', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h7.5M8.25 12h7.5m-7.5 5.25h7.5M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>, roles: ['admin', 'leader'] },
    { page: 'frequency', label: 'Frequência', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75h6.75m-6.75 3.75h6.75m-6.75 3.75h6.75m-9-9.75h.008v.008H5.25v-.008ZM5.25 15h.008v.008H5.25v-.008Zm0 3.75h.008v.008H5.25v-.008Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v16.5c0 .621.504 1.125 1.125 1.125h14.25c.621 0 1.125-.504 1.125-1.125V3.75M4.125 3.75h15.75c.207 0 .375-.168.375-.375V2.625c0-.207-.168-.375-.375-.375H3.75C3.543 2.25 3.375 2.418 3.375 2.625v.75c0 .207.168.375.375.375Z" /></svg>, roles: ['admin'] },
    { page: 'calendar', label: 'Calendário', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0h18" /></svg>, roles: ['admin', 'leader'] },
    { page: 'admin', label: 'Admin', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>, roles: ['admin'] },
];

const Sidebar: React.FC<SidebarProps> = ({ activePage, onNavigate, onNewVolunteer, onNewEvent, isOpen, setIsOpen, userRole, session, unreadCount, pushPermissionStatus, onSubscribeToPush, canInstallPwa, onInstallPrompt }) => {
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const userMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setIsUserMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('Error during sign out:', error);
        }
    };

    const getInitials = (name?: string | null): string => {
        if (!name) return '??';
        const parts = name.trim().split(' ');
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[0][0] + (parts[parts.length - 1][0] || '')).toUpperCase();
    };

    const user = session?.user;
    const userName = user?.user_metadata?.name || user?.email || 'Usuário';
    const initials = getInitials(userName);
    
    const normalizedRole = userRole === 'lider' ? 'leader' : userRole;

    const visibleNavItems = allNavItems.filter(item => {
        if (!normalizedRole) return false;
        return item.roles.includes(normalizedRole);
    });
    
    const canPerformQuickActions = normalizedRole === 'admin' || normalizedRole === 'leader' || pushPermissionStatus === 'default';

    const getRoleDisplayName = () => {
        switch(normalizedRole) {
            case 'admin': return 'Admin';
            case 'leader': return 'Líder';
            case 'volunteer': return 'Voluntário';
            default: return '';
        }
    };
    const roleDisplayName = getRoleDisplayName();

  return (
    <>
      <aside className={`fixed lg:sticky lg:top-0 lg:h-screen inset-y-0 left-0 w-64 bg-white flex flex-col p-6 border-r border-slate-200 z-30 transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-600 text-white rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">Volunteers</h1>
                <p className="text-sm text-slate-500">Sistema da Igreja</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="lg:hidden p-1 text-slate-500 hover:text-slate-800">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
        </div>
        
        <nav className="flex-1 flex flex-col space-y-4 overflow-y-auto pr-1">
          <div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Navegação</h2>
            <div className="space-y-1">
              {visibleNavItems.map(item => (
                <NavItem 
                    key={`${item.page}-${item.label}`} 
                    {...item} 
                    activePage={activePage} 
                    onNavigate={onNavigate} 
                    badgeCount={item.page === 'notifications' ? unreadCount : 0}
                />
              ))}
            </div>
          </div>
          {canPerformQuickActions && (
            <div>
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Ações Rápidas</h2>
              <div className="space-y-1">
                 {(normalizedRole === 'admin' || normalizedRole === 'leader') && (
                    <button onClick={onNewVolunteer} className="flex items-center space-x-3 px-4 py-2 rounded-lg w-full text-left text-slate-600 hover:bg-slate-100">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
                        </svg>
                        <span>Novo Voluntário</span>
                    </button>
                 )}
                 {userRole === 'admin' && (
                  <button onClick={onNewEvent} className="flex items-center space-x-3 px-4 py-2 rounded-lg w-full text-left text-slate-600 hover:bg-slate-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    <span>Novo Evento</span>
                  </button>
                 )}
                 {pushPermissionStatus === 'default' && (
                    <button onClick={onSubscribeToPush} className="flex items-center space-x-3 px-4 py-2 rounded-lg w-full text-left text-amber-800 bg-amber-100 hover:bg-amber-200 font-semibold">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                        </svg>
                        <span>Ativar Notificações</span>
                    </button>
                 )}
              </div>
            </div>
          )}
        </nav>
        <div ref={userMenuRef} className="mt-auto pt-6 border-t border-slate-200 relative">
            {canInstallPwa && (
                <div className="mb-4">
                    <button
                        onClick={onInstallPrompt}
                        className="flex items-center space-x-3 px-4 py-2.5 rounded-lg w-full text-left text-blue-800 bg-blue-100 hover:bg-blue-200 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
                        aria-label="Adicionar aplicativo à tela inicial"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        <span>Instalar App</span>
                    </button>
                </div>
            )}
            <button onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} className="flex items-center space-x-3 w-full p-2 rounded-lg hover:bg-slate-100">
                <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm">
                    {initials}
                </div>
                <div className="flex-1 text-left min-w-0">
                    <p className="font-semibold text-slate-800 text-sm truncate">{userName}</p>
                    <p className="text-xs text-slate-500">{roleDisplayName}</p>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg>
            </button>
            {isUserMenuOpen && (
                <div className="absolute bottom-full left-0 right-0 mb-2 w-full bg-white rounded-lg shadow-lg border border-slate-200 py-1">
                    <button onClick={() => { onNavigate('my-profile'); setIsUserMenuOpen(false); }} className="w-full text-left flex items-center space-x-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>
                         <span>Meu Perfil</span>
                    </button>
                    <button onClick={handleLogout} className="w-full text-left flex items-center space-x-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" /></svg>
                        <span>Sair</span>
                    </button>
                </div>
            )}
        </div>
      </aside>
      {isOpen && <div onClick={() => setIsOpen(false)} className="fixed inset-0 bg-black bg-opacity-30 z-20 lg:hidden"></div>}
    </>
  );
};

export default Sidebar;