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
  const [statusCheckError, setStatusCheckError] = useState<string | null>(null);

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

    if (error && error.code === 'PGRST116') {
      console.warn('Leader profile not found for user, creating one to sync auth and public tables.');
      
      const name = user.user_metadata?.name || user.email;
      const nameParts = name.trim().split(' ');
      const initials = ((nameParts[0]?.[0] || '') + (nameParts.length > 1 ? nameParts[nameParts.length - 1]?.[0] || '' : '')).toUpperCase();

      const { error: insertError } = await client
          .from('leaders')
          .insert({
              user_id: user.id,
              name: name,
              email: user.email,
              status: 'Ativo',
              initials: initials,
              phone: '',
              ministries: [],
              skills: [],
              availability: [],
          });

      if (insertError) {
          console.error("Failed to auto-create leader profile on login:", insertError);
      }
      setIsUserDisabled(false);
      return;
    } else if (error) {
        console.error("Error fetching leader profile:", error);
        setIsUserDisabled(false);
        throw error;
    }

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

    const { data: { subscription } } = client.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setStatusCheckError(null);
      
      if (newSession) {
        setUserRole(getRoleFromMetadata(newSession.user.user_metadata));

        const statusCheckPromise = checkAndSetUserStatus(newSession, client);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('A verificação de status demorou muito.')), 8000)
        );

        Promise.race([statusCheckPromise, timeoutPromise])
          .catch(error => {
            const friendlyError = "Não foi possível verificar o status da sua conta. A conexão com o servidor falhou ou demorou muito. Por favor, recarregue a página e tente novamente.";
            console.error("Falha ao verificar o status do usuário ou timeout:", error.message);
            setStatusCheckError(friendlyError);
          })
          .finally(() => {
            setLoading(false);
          });
      } else {
        setUserRole(null);
        setIsUserDisabled(false);
        setLoading(false);
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

  if (statusCheckError) {
    return (
       <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-200">
            <div className="w-full max-w-lg p-8 space-y-6 bg-white rounded-2xl shadow-lg text-center">
                <div className="flex justify-center mb-4">
                  <div className="p-3 bg-red-500 text-white rounded-xl">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                </div>
                <h1 className="text-3xl font-bold text-slate-800">Erro de Conexão</h1>
                <p className="text-slate-600">
                    {statusCheckError}
                </p>
                <div className="pt-4">
                    <button
                        onClick={() => window.location.reload()}
                        className="w-full inline-flex justify-center rounded-lg border border-transparent px-4 py-2 bg-blue-600 text-base font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                        Recarregar Página
                    </button>
                </div>
            </div>
        </div>
    );
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