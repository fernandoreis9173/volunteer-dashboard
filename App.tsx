

import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import VolunteersPage from './components/VolunteersPage';
import DepartmentsPage from './components/DepartmentsPage';
import EventsPage from './components/SchedulesPage';
import AdminPage from './components/AdminPage';
import ApiConfigPage from './components/ApiConfigPage';
import LoginPage from './components/LoginPage';
// FIX: Changed to a named import because the module does not have a default export.
import { AcceptInvitationPage } from './components/AcceptInvitationPage';
import DisabledUserPage from './components/DisabledUserPage';
import VolunteerDashboard from './components/VolunteerDashboard';
import { Page, AuthView } from './types';
import { getSupabaseClient } from './lib/supabaseClient';
import { SupabaseClient, Session } from '@supabase/supabase-js';

// This state now directly reflects the data we trust from the 'profiles' table.
interface UserProfileState {
  role: string | null;
  department_id: number | null;
  volunteer_id: number | null;
}

const App: React.FC = () => {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [activePage, setActivePage] = useState<Page>('dashboard');
  const [loading, setLoading] = useState(true); // This now only tracks the initial session check
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isVolunteerFormOpen, setIsVolunteerFormOpen] = useState(false);
  const [isEventFormOpen, setIsEventFormOpen] = useState(false);
  const [authView, setAuthView] = useState<AuthView>('login');
  const [isUserDisabled, setIsUserDisabled] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfileState | null>(null);

  // Initial setup and session check effect
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

    // Immediately get the session and stop loading, profile is fetched in a separate effect
    client.auth.getSession().then(({ data: { session: currentSession } }) => {
        setSession(currentSession);
        setLoading(false);
    });

    const { data: { subscription } } = client.auth.onAuthStateChange((event, newSession) => {
        // Only reset the profile if the user has actually changed (e.g., login/logout)
        // A simple token refresh will have the same user ID.
        if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') {
            setUserProfile(null);
            setIsUserDisabled(false);
        }
        setSession(newSession);

        if(!newSession) {
            setLoading(false);
        }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Effect to fetch user profile AFTER session is known
  useEffect(() => {
      const fetchProfile = async () => {
          if (session && supabase) {
              try {
                  const userStatus = session.user.user_metadata?.status;
                  if (userStatus === 'Inativo') {
                      setIsUserDisabled(true);
                      setUserProfile(null);
                      return; 
                  }
                  setIsUserDisabled(false);

                  const { data: profileData, error: profileError } = await supabase
                      .from('profiles')
                      .select('role, department_id') 
                      .eq('id', session.user.id)
                      .single();

                  if (profileError) {
                      console.error("Error fetching user profile:", profileError);
                      setUserProfile(null);
                      return;
                  }

                  if (profileData) {
                      const profile: UserProfileState = {
                          role: profileData.role,
                          department_id: profileData.department_id,
                          volunteer_id: null,
                      };

                      if (profile.role === 'volunteer' && session.user.email) {
                          const { data: volunteerData, error: volError } = await supabase
                              .from('volunteers')
                              .select('id')
                              .eq('email', session.user.email)
                              .single();
                          
                          if (volError) {
                              console.error("Could not find volunteer record for user.", volError);
                          } else if (volunteerData) {
                              profile.volunteer_id = volunteerData.id;
                          }
                      }
                      
                      setUserProfile(profile);
                      if (profile.role === 'volunteer') {
                          setActivePage('dashboard');
                      }
                  } else {
                      setUserProfile(null);
                  }
              } catch (error) {
                  console.error("An unexpected error occurred while fetching profile:", error);
                  setUserProfile(null);
              }
          }
      };
      
      fetchProfile();
  }, [session, supabase]);
  
  const handleNavigate = (page: Page) => {
    setActivePage(page);
    setIsVolunteerFormOpen(false);
    setIsEventFormOpen(false);
    setIsSidebarOpen(false);
  };

  const handleNewVolunteer = () => {
    setActivePage('volunteers');
    setIsEventFormOpen(false);
    setIsVolunteerFormOpen(true);
    setIsSidebarOpen(false);
  };

  const handleNewEvent = () => {
    setActivePage('events');
    setIsVolunteerFormOpen(false);
    setIsEventFormOpen(true);
    setIsSidebarOpen(false);
  };

  const renderPage = () => {
    const userRole = userProfile?.role;
    
    // Volunteer-specific view
    if (userRole === 'volunteer') {
      return <VolunteerDashboard supabase={supabase} volunteerId={userProfile?.volunteer_id ?? null} />;
    }

    // Admin and Leader views
    switch (activePage) {
      case 'volunteers':
        return <VolunteersPage supabase={supabase} isFormOpen={isVolunteerFormOpen} setIsFormOpen={setIsVolunteerFormOpen} />;
      case 'departments':
        return <DepartmentsPage supabase={supabase} userRole={userRole} />;
      case 'events':
        const roleForEvents = userRole === 'lider' ? 'leader' : userRole;
        return <EventsPage supabase={supabase} isFormOpen={isEventFormOpen} setIsFormOpen={setIsEventFormOpen} userRole={roleForEvents} leaderDepartmentId={userProfile?.department_id ?? null} />;
      case 'admin':
        if (userRole !== 'admin') {
            setActivePage('dashboard');
            return <Dashboard supabase={supabase} />;
        }
        return <AdminPage supabase={supabase} />;
      case 'dashboard':
      default:
        // Show a loading state here if the profile is still being fetched after login
        if (session && !userProfile) {
            return (
                 <div className="flex items-center justify-center h-full">
                    <p className="text-slate-500">Carregando perfil do usuário...</p>
                </div>
            )
        }
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
    return <DisabledUserPage supabase={supabase} userRole={userProfile?.role} />;
  }

  return (
    <div className="flex h-screen bg-slate-100 font-sans overflow-hidden">
      <Sidebar 
        activePage={activePage} 
        onNavigate={handleNavigate} 
        onNewVolunteer={handleNewVolunteer}
        onNewEvent={handleNewEvent}
        supabase={supabase}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        userRole={userProfile?.role}
        session={session}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="p-4 md:p-8">
            <button 
              onClick={() => setIsSidebarOpen(true)} 
              className="lg:hidden mb-4 p-2 rounded-md bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 shadow-sm flex items-center space-x-2"
              aria-label="Abrir menu"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
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