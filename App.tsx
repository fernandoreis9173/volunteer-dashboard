
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import VolunteerProfile from './components/VolunteerProfile';
import { Page, AuthView, Event as VolunteerEvent, DashboardEvent, DashboardVolunteer, DetailedVolunteer } from './types';
import { getSupabaseClient } from './lib/supabaseClient';
import { SupabaseClient, Session } from '@supabase/supabase-js';

// This state now directly reflects the data we trust from the 'profiles' table.
interface UserProfileState {
  role: string | null;
  department_id: number | null;
  volunteer_id: number | null;
}

interface DashboardData {
    stats?: {
        activeVolunteers: string;
        departments: string;
        schedulesToday: string;
        schedulesTomorrow: string;
    };
    todaySchedules?: DashboardEvent[];
    upcomingSchedules?: DashboardEvent[];
    activeVolunteers?: DashboardVolunteer[];
    // For Volunteer view
    schedules?: VolunteerEvent[];
    volunteerProfile?: DetailedVolunteer;
}

const getInitialAuthView = (): AuthView => {
    const hash = window.location.hash;
    if (hash.includes('type=recovery') || hash.includes('type=invite')) {
        return 'accept-invite';
    }
    return 'login';
};

const App: React.FC = () => {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const sessionUserId = useRef<string | null>(null);
  const [activePage, setActivePage] = useState<Page>('dashboard');
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isVolunteerFormOpen, setIsVolunteerFormOpen] = useState(false);
  const [isEventFormOpen, setIsEventFormOpen] = useState(false);
  const [authView, setAuthView] = useState<AuthView>(getInitialAuthView());
  const [isUserDisabled, setIsUserDisabled] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfileState | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);

  // Effect for initial session check and subscription
  useEffect(() => {
    const client = getSupabaseClient();
    setSupabase(client);
    if (!client) {
        setIsInitializing(false);
        return;
    }

    const { data: { subscription } } = client.auth.onAuthStateChange((_event, newSession) => {
        const newUserId = newSession?.user?.id ?? null;
        if (newUserId !== sessionUserId.current) {
            setSession(newSession);
            sessionUserId.current = newUserId;
        }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchApplicationData = useCallback(async () => {
    if (session && supabase) {
        setIsInitializing(true);

        const userStatus = session.user.user_metadata?.status;
        if (userStatus === 'Inativo') {
            setIsUserDisabled(true);
            setUserProfile(null);
            setDashboardData(null);
            setIsInitializing(false);
            return; 
        }
        setIsUserDisabled(false);

        const userRole = session.user.user_metadata?.role;
        if (!userRole) {
            console.error("User role not found in metadata.");
            setUserProfile(null);
            setDashboardData(null);
            setIsInitializing(false);
            return;
        }

        if (userRole === 'volunteer') {
            const { data: volunteerData, error: volunteerError } = await supabase
                .from('volunteers')
                .select('id, name, phone, initials, status, departments:departaments, skills, availability')
                .eq('user_id', session.user.id)
                .single();

            if (volunteerError || !volunteerData) {
                console.error("Error fetching volunteer profile by user_id:", volunteerError);
                setUserProfile({ role: userRole, department_id: null, volunteer_id: null });
                setDashboardData({ schedules: [] });
            } else {
                const profile: UserProfileState = {
                    role: userRole,
                    department_id: null,
                    volunteer_id: volunteerData.id,
                };
                setUserProfile(profile);
                
                const today = new Date().toISOString().slice(0, 10);
                const { data: scheduleQueryData } = await supabase
                  .from('event_volunteers')
                  .select('events(*, event_departments(departments(name)))')
                  .eq('volunteer_id', profile.volunteer_id)
                  .gte('events.date', today)
                  .order('date', { referencedTable: 'events', ascending: true });

                const schedules = (scheduleQueryData || []).flatMap(item => item.events || []).filter((event): event is VolunteerEvent => event !== null);
                setDashboardData({ schedules, volunteerProfile: volunteerData as DetailedVolunteer });
            }
            // Ensure volunteer starts on dashboard, not another page from a previous session
            if (activePage !== 'my-profile') {
                setActivePage('dashboard');
            }

        } else { // Admin or Leader
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('role, department_id')
                .eq('id', session.user.id)
                .single();

            if (profileError || !profileData) {
                console.error("Error fetching admin/leader profile:", profileError);
                setUserProfile(null);
                setDashboardData(null);
                setIsInitializing(false);
                return;
            }

            const profile: UserProfileState = {
                role: profileData.role,
                department_id: profileData.department_id,
                volunteer_id: null,
            };
            setUserProfile(profile);

            const getLocalYYYYMMDD = (d: Date) => new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
            const todayDate = new Date();
            const today = getLocalYYYYMMDD(todayDate);
            const tomorrowDate = new Date();
            tomorrowDate.setDate(todayDate.getDate() + 1);
            const tomorrow = getLocalYYYYMMDD(tomorrowDate);
            const sevenDaysFromNow = new Date();
            sevenDaysFromNow.setDate(todayDate.getDate() + 7);
            const nextSevenDays = getLocalYYYYMMDD(sevenDaysFromNow);

            const [statsRes, todaySchedulesRes, upcomingSchedulesRes, activeVolunteersRes] = await Promise.all([
                Promise.all([
                    supabase.from('volunteers').select('id', { count: 'exact', head: true }).eq('status', 'Ativo'),
                    supabase.from('departments').select('id', { count: 'exact', head: true }).eq('status', 'Ativo'),
                    supabase.from('events').select('id', { count: 'exact', head: true }).eq('date', today).eq('status', 'Confirmado'),
                    supabase.from('events').select('id', { count: 'exact', head: true }).eq('date', tomorrow).eq('status', 'Confirmado'),
                ]),
                supabase.from('events').select('id, name, date, start_time, end_time, status, event_departments(departments(name)), event_volunteers(volunteers(name))').eq('date', today).eq('status', 'Confirmado').order('start_time').limit(10),
                supabase.from('events').select('id, name, date, start_time, end_time, status, event_departments(departments(name)), event_volunteers(volunteers(name))').gte('date', tomorrow).lte('date', nextSevenDays).eq('status', 'Confirmado').order('date').limit(5),
                supabase.from('volunteers').select('id, name, email, initials, departments:departaments').eq('status', 'Ativo').order('created_at', { ascending: false }).limit(5)
            ]);

            setDashboardData({
                stats: {
                    activeVolunteers: String(statsRes[0].count ?? 0),
                    departments: String(statsRes[1].count ?? 0),
                    schedulesToday: String(statsRes[2].count ?? 0),
                    schedulesTomorrow: String(statsRes[3].count ?? 0),
                },
                todaySchedules: (todaySchedulesRes.data as unknown as DashboardEvent[]) || [],
                upcomingSchedules: (upcomingSchedulesRes.data as unknown as DashboardEvent[]) || [],
                activeVolunteers: (activeVolunteersRes.data as DashboardVolunteer[]) || [],
            });
        }
        setIsInitializing(false);

    } else {
        setUserProfile(null);
        setDashboardData(null);
        setIsUserDisabled(false);
        setIsInitializing(false);
    }
}, [session, supabase, activePage]);

  // Effect for fetching ALL application data when session changes
  useEffect(() => {
    fetchApplicationData();
}, [session, supabase]); // Removed activePage from deps to avoid re-fetches on nav
  
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
    
    if (userRole === 'volunteer') {
      if (activePage === 'my-profile') {
        return <VolunteerProfile supabase={supabase} volunteerData={dashboardData?.volunteerProfile} onUpdate={fetchApplicationData} />;
      }
      return <VolunteerDashboard initialData={dashboardData} />;
    }

    switch (activePage) {
      case 'volunteers':
        return <VolunteersPage supabase={supabase} isFormOpen={isVolunteerFormOpen} setIsFormOpen={setIsVolunteerFormOpen} />;
      case 'departments':
        return <DepartmentsPage supabase={supabase} userRole={userRole} />;
      case 'events':
        return <EventsPage supabase={supabase} isFormOpen={isEventFormOpen} setIsFormOpen={setIsEventFormOpen} userRole={userRole} leaderDepartmentId={userProfile?.department_id ?? null} />;
      case 'admin':
        if (userRole !== 'admin') {
            setActivePage('dashboard');
            return <Dashboard initialData={dashboardData} />;
        }
        return <AdminPage supabase={supabase} />;
      case 'dashboard':
      default:
        return <Dashboard initialData={dashboardData} />;
    }
  };

  if (isInitializing) {
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
