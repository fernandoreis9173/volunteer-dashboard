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

    const user = currentSession.user;

    const { data: leaderProfile, error } = await client
      .from('leaders')
      .select('status')
      .eq('email', user.email)
      .single();

    // Handle case where profile does not exist to prevent infinite loading
    // PGRST116: "The result contains 0 rows"
    if (error && error.code === 'PGRST116') {
      console.warn('Leader profile not found for user, creating one to sync auth and public tables.');
      
      const name = user.user_metadata?.name || user.email;
      const nameParts = name.trim().split(' ');
      const initials = ((nameParts[0]?.[0] || '') + (nameParts.length > 1 ? nameParts[nameParts.length - 1]?.[0] || '' : '')).toUpperCase();

      const { error: insertError } = await client
          .from('leaders')
          .insert({
              name: name,
              email: user.email,
              status: 'Ativo', // Default to active
              initials: initials,
              phone: '',
              ministries: [],
              skills: [],
              availability: [],
          });

      if (insertError) {
          console.error("Failed to auto-create leader profile on login:", insertError);
          // Don't disable the user if creation fails, let them proceed.
          // The error will be logged for debugging.
      }
      setIsUserDisabled(false); // New user is active
      return;
    } else if (error) {
        // For other errors, log them but don't crash the app
        console.error("Error fetching leader profile:", error);
        setIsUserDisabled(false); // Default to not disabled to avoid locking user out
        return;
    }

    // If profile exists, check its status
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

    // Handle invite/recovery flows from URL hash before auth listener
    const hash = window.location.hash;
    if (hash.includes('type=recovery') || hash.includes('type=invite')) {
      setAuthView('accept-invite');
    }

    // onAuthStateChange fires immediately with the initial session (or null),
    // making it the most reliable way to handle the initial loading state.
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        setUserRole(getRoleFromMetadata(newSession.user.user_metadata));
        // FIX: Removed `await` to make the status check non-blocking.
        // This prevents the UI from getting stuck on "Carregando..." if the
        // database call hangs due to RLS policies or network issues.
        checkAndSetUserStatus(newSession, client);
      } else {
        setUserRole(null);
        setIsUserDisabled(false);
      }
      // This is the crucial part: once we have the initial auth state, we're done loading.
      setLoading(false);
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