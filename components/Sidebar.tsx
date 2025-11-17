import React, { useState, useRef, useEffect } from 'react';
import type { Page } from '../types';
import { supabase } from '../lib/supabaseClient';
// FIX: Use 'type' import for Session to resolve potential module resolution issues with Supabase v2.
import { type Session } from '@supabase/supabase-js';
import { DashboardIcon, VolunteerIcon, DepartamentsIcon, EventosIcon, AdminIcon, FrequenciaIcon, CalendarIcon, NewVolunteersIcon, AddEventsIcon, NotificationIcon, HistoryIcon, InstallAppIcon, LogoNovaIcon, ProfileIcon, LogoutIcon, RankingIcon, CronogramasIcon } from '../assets/icons';

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
        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
    }`}
  >
    <div className="flex items-center space-x-3">
        {React.cloneElement(icon, { className: `h-5 w-5 ${icon.type === 'img' ? (activePage === page ? 'filter invert brightness-0' : 'brightness-0 dark:filter dark:invert') : ''}` })}
        <span>{label}</span>
    </div>
    {badgeCount > 0 && (
        <span className="bg-red-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">
            {badgeCount > 9 ? '9+' : badgeCount}
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
  theme: 'light' | 'dark';
  toggleTheme: () => void;
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
    { page: 'ranking', label: 'Ranking', icon: <img src={RankingIcon} alt="Ranking" />, roles: ['admin', 'leader', 'volunteer'] },
    { page: 'departments', label: 'Departamentos', icon: <img src={DepartamentsIcon} alt="Departamentos" />, roles: ['admin'] },
    { page: 'events', label: 'Eventos', icon: <img src={EventosIcon} alt="Eventos (Lista)" />, roles: ['admin', 'leader'] },
    { page: 'calendar', label: 'Calendário', icon: <img src={CalendarIcon} alt="Calendário" />, roles: ['admin', 'leader'] },
    { page: 'timelines', label: 'Cronogramas', icon: <img src={CronogramasIcon} alt="Calendário" />, roles: ['admin'] },
    { page: 'frequency', label: 'Frequência', icon: <img src={FrequenciaIcon} alt="Frequência" />, roles: ['admin'] },
    { page: 'admin', label: 'Admin', icon: <img src={AdminIcon} alt="Admin" />, roles: ['admin'] },
];

const Sidebar: React.FC<SidebarProps> = ({ activePage, onNavigate, onNewVolunteer, onNewEvent, isOpen, setIsOpen, userRole, session, unreadCount, pushPermissionStatus, onSubscribeToPush, canInstallPwa, onInstallPrompt, theme, toggleTheme }) => {
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
        // FIX: Explicitly set the scope to 'local' to avoid a 403 Forbidden error.
        // The client was incorrectly attempting a 'global' sign-out, which is not permitted
        // by the user's session, leading to an AuthSessionMissingError.
        const { error } = await supabase.auth.signOut({ scope: 'local' });
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
      <aside className={`fixed lg:sticky lg:top-0 lg:h-screen inset-y-0 left-0 w-64 bg-white dark:bg-slate-900 flex flex-col p-6 border-r border-slate-200 dark:border-slate-800 z-30 transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
                <img src={LogoNovaIcon} alt="Logo Volunteers" className="h-8 w-8 object-contain" style={{ filter: 'none' }} />
              <div>
                <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Volunteers</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">Amar e servir</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="lg:hidden p-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200">
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
                    <button onClick={onNewVolunteer} className="flex items-center space-x-3 px-4 py-2 rounded-lg w-full text-left text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                        <img src={NewVolunteersIcon} alt="Novo Voluntário" className="h-5 w-5 brightness-0 dark:invert" />
                        <span>Novo Voluntário</span>
                    </button>
                 )}
                 {userRole === 'admin' && (
                  <button onClick={onNewEvent} className="flex items-center space-x-3 px-4 py-2 rounded-lg w-full text-left text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                    <img src={AddEventsIcon} alt="Novo Evento" className="h-5 w-5 brightness-0 dark:invert" />
                    <span>Novo Evento</span>
                  </button>
                 )}
                 {pushPermissionStatus === 'default' && (
                    <button onClick={onSubscribeToPush} className="flex items-center space-x-3 px-4 py-2 rounded-lg w-full text-left text-amber-800 bg-amber-100 hover:bg-amber-200 font-semibold text-sm">
                        <img src={NotificationIcon} alt="Ativar Notificações" className="h-5 w-5 brightness-0" />
                        <span>Ativar Notificações</span>
                    </button>
                 )}
              </div>
            </div>
          )}
        </nav>
        <div className="mt-auto pt-6 border-t border-slate-200 dark:border-slate-700">
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
            
            {normalizedRole === 'volunteer' && (
                <div className="mb-2">
                    <button
                        onClick={toggleTheme}
                        className="flex items-center justify-between w-full px-4 py-2.5 rounded-lg text-left text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        aria-label={`Mudar para tema ${theme === 'light' ? 'escuro' : 'claro'}`}
                    >
                        <div className="flex items-center space-x-3">
                            {theme === 'light' ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                            )}
                            <span>{theme === 'light' ? 'Dark' : 'Light'}</span>
                        </div>
                    </button>
                </div>
            )}
            
            <div ref={userMenuRef} className="relative">
                <button onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} className="flex items-center space-x-3 w-full p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                    <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm">
                        {initials}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                        <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{userName}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{roleDisplayName}</p>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg>
                </button>
                {isUserMenuOpen && (
                    <div className="absolute bottom-full left-0 right-0 mb-2 w-full bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1">
                        <button onClick={() => { onNavigate('my-profile'); setIsUserMenuOpen(false); }} className="w-full text-left flex items-center space-x-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">
                            <img src={ProfileIcon} alt="Meu Perfil" className="h-5 w-5 brightness-0 dark:invert" />
                            <span>Meu Perfil</span>
                        </button>
                        <button onClick={handleLogout} className="w-full text-left flex items-center space-x-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                            <img src={LogoutIcon} alt="Sair" className="h-5 w-5" style={{ filter: 'brightness(0) saturate(100%) invert(24%) sepia(92%) saturate(5058%) hue-rotate(356deg) brightness(97%) contrast(104%)' }} />
                            <span>Sair</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
      </aside>
      {isOpen && <div onClick={() => setIsOpen(false)} className="fixed inset-0 bg-black bg-opacity-30 z-20 lg:hidden"></div>}
    </>
  );
};

export default Sidebar;