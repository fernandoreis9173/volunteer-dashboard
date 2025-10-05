import React from 'react';
import { Page } from '../types';
import { SupabaseClient, Session } from '@supabase/supabase-js';

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
  supabase: SupabaseClient | null;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  userRole: string | null;
  session: Session | null;
  unreadCount: number;
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
    { page: 'my-profile', label: 'Meu Perfil', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>, roles: ['volunteer'] },
    { page: 'volunteers', label: 'Voluntários', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m-7.5-2.226a3 3 0 0 0-4.682 2.72 9.094 9.094 0 0 0 3.741.479m7.5-2.226V18a2.25 2.25 0 0 1-2.25 2.25H12a2.25 2.25 0 0 1-2.25-2.25V18.226m3.75-10.5a3.375 3.375 0 0 0-6.75 0v1.5a3.375 3.375 0 0 0 6.75 0v-1.5ZM10.5 8.25a3.375 3.375 0 0 0-6.75 0v1.5a3.375 3.375 0 0 0 6.75 0v-1.5Z" /></svg>, roles: ['admin', 'leader'] },
    { page: 'departments', label: 'Departamentos', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18h16.5M5.25 6H18.75m-13.5 0V21m13.5-15V21m-10.5-9.75h.008v.008H8.25v-.008ZM8.25 15h.008v.008H8.25V15Zm3.75-9.75h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm3.75-9.75h.008v.008H15.75v-.008ZM15.75 15h.008v.008H15.75V15Z" /></svg>, roles: ['admin', 'leader'] },
    { page: 'events', label: 'Eventos', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0h18" /></svg>, roles: ['admin', 'leader'] },
    { page: 'admin', label: 'Admin', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>, roles: ['admin'] },
];

const Sidebar: React.FC<SidebarProps> = ({ activePage, onNavigate, onNewVolunteer, onNewEvent, supabase, isOpen, setIsOpen, userRole, session, unreadCount }) => {
    const handleLogout = async () => {
        if (supabase) {
            const { error } = await supabase.auth.signOut();
            if (error) {
                console.error('Error during sign out:', error);
            }
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
    
    const canPerformQuickActions = normalizedRole === 'admin' || normalizedRole === 'leader';

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
      <aside className={`fixed lg:static inset-y-0 left-0 w-64 bg-white flex flex-col p-6 border-r border-slate-200 z-30 transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="flex items-center justify-between mb-10">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-600 text-white rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">Voluntários</h1>
                <p className="text-sm text-slate-500">Sistema da Igreja</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="lg:hidden p-1 text-slate-500 hover:text-slate-800">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
        </div>

        <nav className="flex-1 flex flex-col space-y-4">
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
                 <button onClick={onNewVolunteer} className="flex items-center space-x-3 px-4 py-2 rounded-lg w-full text-left text-slate-600 hover:bg-slate-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
                    </svg>
                    <span>Novo Voluntário</span>
                </button>
                 {userRole === 'admin' && (
                  <button onClick={onNewEvent} className="flex items-center space-x-3 px-4 py-2 rounded-lg w-full text-left text-slate-600 hover:bg-slate-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    <span>Novo Evento</span>
                  </button>
                 )}
              </div>
            </div>
          )}
        </nav>

        <div className="mt-auto">
          <div className="w-full h-px bg-slate-200 mb-4"></div>
           <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 overflow-hidden">
                  <div className="h-10 w-10 flex-shrink-0 flex items-center justify-center bg-blue-100 rounded-full text-blue-600 font-bold">{initials}</div>
                  <div className="flex-1 overflow-hidden">
                      <p className="font-semibold text-slate-800 text-sm truncate" title={userName}>{userName}</p>
                      {roleDisplayName && <span className={`text-xs font-semibold rounded-full capitalize px-2 py-0.5 mt-1 ${normalizedRole === 'admin' ? 'bg-indigo-100 text-indigo-800' : normalizedRole === 'leader' ? 'bg-slate-100 text-slate-700' : 'bg-green-100 text-green-800'}`}>{roleDisplayName}</span>}
                  </div>
              </div>
              <button onClick={handleLogout} className="text-slate-500 hover:text-red-600 p-1 flex-shrink-0" title="Sair">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
                </svg>
              </button>
          </div>
        </div>
      </aside>
      {isOpen && <div onClick={() => setIsOpen(false)} className="lg:hidden fixed inset-0 bg-black/50 z-20"></div>}
    </>
  );
};

export default Sidebar;