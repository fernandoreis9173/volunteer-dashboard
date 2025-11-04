import React, { useState, useRef, useEffect } from 'react';
import type { Page } from '../types';
import { supabase } from '../lib/supabaseClient';
// FIX: Use 'type' import for Session to resolve potential module resolution issues with Supabase v2.
import { type Session } from '@supabase/supabase-js';
import { DashboardIcon, VolunteerIcon, DepartamentsIcon, EventosIcon, AdminIcon, FrequenciaIcon, CalendarIcon, NewVolunteersIcon, AddEventsIcon, NotificationIcon, HistoryIcon, InstallAppIcon, LogoNovaIcon, ProfileIcon, LogoutIcon } from '@/assets/icons';

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
        {React.cloneElement(icon, { className: `h-5 w-5${icon.type === 'img' ? ` filter ${activePage === page ? 'invert brightness-0' : 'brightness-0'}` : ''}` })}
        <span style={{ color: activePage === page ? '#FFFFFF' : '#000000' }}>{label}</span>
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
    { page: 'dashboard', label: 'Dashboard', icon: <img src={DashboardIcon} alt="Dashboard" />, roles: ['admin', 'leader', 'volunteer'] },
    { page: 'notifications', label: 'Notificações', icon: <img src={NotificationIcon} alt="Notificações" />, roles: ['leader', 'volunteer'] },  
    { page: 'history', label: 'Histórico', icon: <img src={HistoryIcon} alt="Histórico" />, roles: ['volunteer'] },
    { page: 'volunteers', label: 'Voluntários', icon: <img src={VolunteerIcon} alt="Voluntários" />, roles: ['admin', 'leader'] },
    { page: 'departments', label: 'Departamentos', icon: <img src={DepartamentsIcon} alt="Departamentos" />, roles: ['admin'] },
    { page: 'events', label: 'Eventos', icon: <img src={EventosIcon} alt="Eventos (Lista)" />, roles: ['admin', 'leader'] },
    { page: 'calendar', label: 'Calendário', icon: <img src={CalendarIcon} alt="Calendário" />, roles: ['admin', 'leader'] },
    { page: 'timelines', label: 'Cronogramas', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" /></svg>, roles: ['admin'] },
    { page: 'frequency', label: 'Frequência', icon: <img src={FrequenciaIcon} alt="Frequência" />, roles: ['admin'] },
    { page: 'admin', label: 'Admin', icon: <img src={AdminIcon} alt="Admin" />, roles: ['admin'] },
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
              {/* <div className="p-2 bg-blue-600 text-white rounded-lg"> */}
                {/* <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24 " stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                </svg> */}
                {/* Removido o filtro que deixava o SVG todo branco */}
                <img src={LogoNovaIcon} alt="Logo Volunteers" className="h-8 w-8 object-contain" style={{ filter: 'none' }} />
              {/* </div> */}
              <div>
                <h1 className="text-xl font-bold text-slate-800">Volunteers</h1>
                <p className="text-sm text-slate-500">Amar e servir</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="lg:hidden p-1 text-slate-500 hover:text-slate-800">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24 " stroke="currentColor" strokeWidth={1.5}>
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
                        <img src={NewVolunteersIcon} alt="Novo Voluntário" className="h-5 w-5 brightness-0" />
                        <span style={{ color: '#000000' }}>Novo Voluntário</span>
                    </button>
                 )}
                 {userRole === 'admin' && (
                  <button onClick={onNewEvent} className="flex items-center space-x-3 px-4 py-2 rounded-lg w-full text-left text-slate-600 hover:bg-slate-100">
                    <img src={AddEventsIcon} alt="Novo Evento" className="h-5 w-5 brightness-0" />
                    <span style={{ color: '#000000' }}>Novo Evento</span>
                  </button>
                 )}
                 {pushPermissionStatus === 'default' && (
                    <button onClick={onSubscribeToPush} className="flex items-center space-x-3 px-4 py-2 rounded-lg w-full text-left text-amber-800 bg-amber-100 hover:bg-amber-200 font-semibold text-sm">
                        <img src={NotificationIcon} alt="Ativar Notificações" className="h-5 w-5 brightness-0" />
                        <span style={{ color: 'rgba(0, 0, 0, 1)' }}>Ativar Notificações</span>
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
    <img 
        src={InstallAppIcon} 
        alt="Instalar App" 
        className="h-5 w-5" 
        style={{ filter: 'brightness(0) saturate(100%) invert(16%) sepia(69%) saturate(5312%) hue-rotate(226deg) brightness(95%) contrast(100%)' }} 
    />
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
                         <img src={ProfileIcon} alt="Meu Perfil" className="h-5 w-5" style={{ filter: 'brightness(0) saturate(100%) invert(40%) sepia(10%) saturate(600%) hue-rotate(170deg) brightness(95%) contrast(90%)' }} />
                         <span style={{ color: '#000000' }}>Meu Perfil</span>
                    </button>
                    <button onClick={handleLogout} className="w-full text-left flex items-center space-x-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                        <img src={LogoutIcon} alt="Sair" className="h-5 w-5" style={{ filter: 'brightness(0) saturate(100%) invert(24%) sepia(92%) saturate(5058%) hue-rotate(356deg) brightness(97%) contrast(104%)' }} />
                        <span style={{ color: '#000000' }}>Sair</span>
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