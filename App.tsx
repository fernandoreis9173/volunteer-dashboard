import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import VolunteersPage from './components/VolunteersPage';
import MinistriesPage from './components/MinistriesPage';
import SchedulesPage from './components/SchedulesPage';
import AdminPage from './components/AdminPage';
import ApiConfigPage from './components/ApiConfigPage';
import LoginPage from './components/LoginPage';
import AcceptInvitationPage from './components/AcceptInvitationPage';
import DisabledUserPage from './components/DisabledUserPage';
import { Page, AuthView } from './types';
import { getSupabaseClient } from './lib/supabaseClient';
import { SupabaseClient, Session } from '@supabase/supabase-js';

const App: React.FC = () => {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [activePage, setActivePage] = useState<Page>('dashboard');
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isVolunteerFormOpen, setIsVolunteerFormOpen] = useState(false);
  const [isScheduleFormOpen, setIsScheduleFormOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [authView, setAuthView] = useState<AuthView>('login');
  const [isUserDisabled, setIsUserDisabled] = useState(false);

  const getRoleFromMetadata = (metadata: any): string | null => {
    if (!metadata) return null;
    const role = metadata.role || metadata.papel;
    if (role === 'líder') return 'leader';
    return role;
  }

  const checkAndSetUserStatus = async (currentSession: Session | null, client: SupabaseClient) => {
    if (!currentSession) {
      setIsUserDisabled(false);
      return;
    }
    // Logged in users are leaders/admins, so we check the `leaders` table for their status.
    const { data: leaderProfile } = await client
      .from('leaders')
      .select('status')
      .eq('email', currentSession.user.email)
      .single();

    if (leaderProfile && leaderProfile.status === 'Inativo') {
      setIsUserDisabled(true);
    } else {
      setIsUserDisabled(false);
    }
  };

  useEffect(() => {
    const client = getSupabaseClient();
    setSupabase(client);

    if (!client) {
        setLoading(false);
        return;
    }
    
    const hash = window.location.hash;
    if (hash.includes('type=recovery') || hash.includes('type=invite')) {
        setAuthView('accept-invite');
    }

    client.auth.getSession()
      .then(async ({ data: { session: initialSession } }) => {
        setSession(initialSession);
        if (initialSession) {
            setUserRole(getRoleFromMetadata(initialSession.user.user_metadata));
            await checkAndSetUserStatus(initialSession, client);
        }
      })
      .catch(err => {
          console.error("Error getting session:", err);
      })
      .finally(() => {
          setLoading(false);
      });

    const { data: { subscription } } = client.auth.onAuthStateChange(async (_event, newSession) => {
        setSession(newSession);
        if (newSession) {
            setUserRole(getRoleFromMetadata(newSession.user.user_metadata));
            await checkAndSetUserStatus(newSession, client);
        } else {
            setUserRole(null);
            setIsUserDisabled(false);
            setAuthView('login');
        }
    });

    return () => {
        subscription.unsubscribe();
    };
  }, []);
  
  const handleNavigate = (page: Page) => {
    setActivePage(page);
    setIsVolunteerFormOpen(false);
    setIsScheduleFormOpen(false);
    setIsSidebarOpen(false);
  };

  const handleNewVolunteer = () => {
    setActivePage('volunteers');
    setIsScheduleFormOpen(false);
    setIsVolunteerFormOpen(true);
    setIsSidebarOpen(false);
  };

  const handleNewSchedule = () => {
    setActivePage('schedules');
    setIsVolunteerFormOpen(false);
    setIsScheduleFormOpen(true);
    setIsSidebarOpen(false);
  };

  const renderPage = () => {
    switch (activePage) {
      case 'volunteers':
        return <VolunteersPage supabase={supabase} isFormOpen={isVolunteerFormOpen} setIsFormOpen={setIsVolunteerFormOpen} />;
      case 'ministries':
        return <MinistriesPage supabase={supabase} />;
      case 'schedules':
        return <SchedulesPage supabase={supabase} isFormOpen={isScheduleFormOpen} setIsFormOpen={setIsScheduleFormOpen} />;
      case 'admin':
        if (userRole !== 'admin') {
            setActivePage('dashboard');
            return <Dashboard supabase={supabase} />;
        }
        return <AdminPage supabase={supabase} />;
      case 'dashboard':
      default:
        return <Dashboard supabase={supabase} />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-100">
        <p className="text-lg text-slate-500">Carregando...</p>
      </div>
    );
  }
  
  if (!supabase) {
    return <ApiConfigPage />;
  }
  
  if (authView === 'accept-invite') {
      return <AcceptInvitationPage supabase={supabase} setAuthView={setAuthView} />;
  }

  if (!session) {
      return <LoginPage supabase={supabase} setAuthView={setAuthView} />;
  }

  if (isUserDisabled) {
    return <DisabledUserPage supabase={supabase} />;
  }

  return (
    <div className="flex h-screen bg-slate-100 font-sans overflow-hidden">
      <Sidebar 
        activePage={activePage} 
        onNavigate={handleNavigate} 
        onNewVolunteer={handleNewVolunteer}
        onNewSchedule={handleNewSchedule}
        supabase={supabase}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        userRole={userRole}
        session={session}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="p-4 md:p-8">
            <button 
              onClick={() => setIsSidebarOpen(true)} 
              className="lg:hidden mb-4 p-2 rounded-md bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 shadow-sm flex items-center space-x-2"
              aria-label="Abrir menu"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <span>Menu</span>
            </button>
            {renderPage()}
        </div>
      </main>
    </div>
  );
};

export default App;