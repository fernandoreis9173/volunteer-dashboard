

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

export interface ChartDataPoint {
    date: string;
    scheduledVolunteers: number;
    involvedDepartments: number;
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
    chartData?: ChartDataPoint[];
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

const getPageFromHash = (): Page => {
    const hash = window.location.hash.slice(2); // Remove #/
    const validPages: Page[] = ['dashboard', 'volunteers', 'departments', 'events', 'admin', 'my-profile'];
    if (validPages.includes(hash as Page)) {
        return hash as Page;
    }
    return 'dashboard'; // Default page
};


const App: React.FC = () => {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const sessionUserId = useRef<string | null>(null);
  const [activePage, setActivePage] = useState<Page>(getPageFromHash());
  const [isInitializing, setIsInitializing] = useState(true);
  const [initialAuthCheckCompleted, setInitialAuthCheckCompleted] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isVolunteerFormOpen, setIsVolunteerFormOpen] = useState(false);
  const [isEventFormOpen, setIsEventFormOpen] = useState(false);
  const [authView, setAuthView] = useState<AuthView>(getInitialAuthView());
  const [isUserDisabled, setIsUserDisabled] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfileState | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);

  const fetchApplicationData = useCallback(async () => {
    if (session && supabase) {
        const userStatus = session.user.user_metadata?.status;
        if (userStatus === 'Inativo') {
            setIsUserDisabled(true);
            setUserProfile(null);
            setDashboardData(null);
            return; 
        }
        setIsUserDisabled(false);

        const userRole = session.user.user_metadata?.role;
        if (!userRole) {
            console.error("User role not found in metadata.");
            setUserProfile(null);
            setDashboardData(null);
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

            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            const oneYearAgoISO = oneYearAgo.toISOString();

            const [statsRes, todaySchedulesRes, upcomingSchedulesRes, activeVolunteersRes, chartEventsRes] = await Promise.all([
                Promise.all([
                    supabase.from('volunteers').select('id', { count: 'exact', head: true }).eq('status', 'Ativo'),
                    supabase.from('departments').select('id', { count: 'exact', head: true }).eq('status', 'Ativo'),
                    supabase.from('events').select('id', { count: 'exact', head: true }).eq('date', today).eq('status', 'Confirmado'),
                    supabase.from('events').select('id', { count: 'exact', head: true }).eq('date', tomorrow).eq('status', 'Confirmado'),
                ]),
                supabase.from('events').select('id, name, date, start_time, end_time, status, event_departments(departments(name)), event_volunteers(volunteers(name))').eq('date', today).eq('status', 'Confirmado').order('start_time').limit(10),
                supabase.from('events').select('id, name, date, start_time, end_time, status, event_departments(departments(name)), event_volunteers(volunteers(name))').gte('date', tomorrow).lte('date', nextSevenDays).eq('status', 'Confirmado').order('date').limit(5),
                supabase.from('volunteers').select('id, name, email, initials, departments:departaments').eq('status', 'Ativo').order('created_at', { ascending: false }).limit(5),
                supabase.from('events').select('date, event_volunteers(volunteer_id), event_departments(department_id)').gte('date', oneYearAgoISO.slice(0, 10)).limit(10000),
            ]);
            
            // Process chart data
            const dailyCounts: { [key: string]: { scheduledVolunteers: number; involvedDepartments: number } } = {};
            
            (chartEventsRes.data || []).forEach(event => {
                const date = event.date;
                if (date) {
                    if (!dailyCounts[date]) {
                        dailyCounts[date] = { scheduledVolunteers: 0, involvedDepartments: 0 };
                    }
                    // The nested select returns an array of objects, so .length is the count.
                    dailyCounts[date].scheduledVolunteers += (event.event_volunteers || []).length;
                    dailyCounts[date].involvedDepartments += (event.event_departments || []).length;
                }
            });
        
            const chartData: ChartDataPoint[] = Object.entries(dailyCounts).map(([date, counts]) => ({
                date,
                ...counts,
            })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());


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
                chartData,
            });
        }
    } else {
        setUserProfile(null);
        setDashboardData(null);
        setIsUserDisabled(false);
    }
  }, [session, supabase]);

  // Effect for initial session check and subscription
  useEffect(() => {
    const client = getSupabaseClient();
    setSupabase(client);
    if (!client) {
        setIsInitializing(false);
        setInitialAuthCheckCompleted(true);
        return;
    }
    
    client.auth.getSession().then(({ data: { session: initialSession } }) => {
        setSession(initialSession);
        sessionUserId.current = initialSession?.user?.id ?? null;
        setInitialAuthCheckCompleted(true);
    });

    const { data: { subscription } } = client.auth.onAuthStateChange((_event, newSession) => {
        const newUserId = newSession?.user?.id ?? null;
        if (newUserId !== sessionUserId.current) {
            setIsInitializing(true); // Re-initialize on user change
            setSession(newSession);
            sessionUserId.current = newUserId;
        }
    });

    return () => subscription.unsubscribe();
  }, []);
  
  // Effect for fetching ALL application data when session changes, and controlling the initialization state.
  useEffect(() => {
    if (!initialAuthCheckCompleted) {
        return;
    }
      
    if (session) {
        fetchApplicationData().finally(() => {
            setIsInitializing(false);
        });
    } else {
        // No session, so we're ready to show the login page.
        setUserProfile(null);
        setDashboardData(null);
        setIsUserDisabled(false);
        setIsInitializing(false);
    }
  }, [session, fetchApplicationData, initialAuthCheckCompleted]);

  // Effect for hash-based routing (navigation)
  useEffect(() => {
    const handleHashChange = () => {
        setActivePage(getPageFromHash());
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => {
        window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  // Effect for handling redirects based on auth state and current page
  useEffect(() => {
    if (isInitializing || !session) {
        // Don't perform redirects until everything is loaded and user is logged in
        return;
    }

    const currentHash = window.location.hash;
    if (!currentHash || !currentHash.startsWith('#/')) {
        window.location.hash = '#/dashboard';
        return;
    }

    if (userProfile) {
        const userRole = userProfile.role;
        const currentPage = getPageFromHash();

        if (userRole === 'volunteer' && currentPage !== 'dashboard' && currentPage !== 'my-profile') {
            window.location.hash = '#/dashboard';
            return;
        }
        
        const normalizedRole = userRole === 'lider' ? 'leader' : userRole;
        if (normalizedRole === 'leader' && currentPage === 'admin') {
            window.location.hash = '#/dashboard';
            return;
        }

        if (normalizedRole !== 'volunteer' && currentPage === 'my-profile') {
             window.location.hash = '#/dashboard';
             return;
        }
    }
  }, [isInitializing, session, userProfile, activePage]);
  
  const handleNavigate = (page: Page) => {
    if (`#/${page}` !== window.location.hash) {
      window.location.hash = `#/${page}`;
    }
    setIsVolunteerFormOpen(false);
    setIsEventFormOpen(false);
    setIsSidebarOpen(false);
  };

  const handleNewVolunteer = () => {
    window.location.hash = '#/volunteers';
    setIsEventFormOpen(false);
    setIsVolunteerFormOpen(true);
    setIsSidebarOpen(false);
  };

  const handleNewEvent = () => {
    window.location.hash = '#/events';
    setIsVolunteerFormOpen(false);
    setIsEventFormOpen(true);
    setIsSidebarOpen(false);
  };

  const renderPage = () => {
    if (!userProfile) {
        return null; // Don't render pages until profile is loaded
    }
    
    // Authorization checks to prevent rendering a page while a redirect is pending
    const userRole = userProfile.role;
    const normalizedRole = userRole === 'lider' ? 'leader' : userRole;
    if (normalizedRole === 'volunteer' && activePage !== 'dashboard' && activePage !== 'my-profile') return null;
    if (normalizedRole === 'leader' && activePage === 'admin') return null;
    if (normalizedRole !== 'volunteer' && activePage === 'my-profile') return null;

    switch (activePage) {
      case 'volunteers':
        return <VolunteersPage supabase={supabase} isFormOpen={isVolunteerFormOpen} setIsFormOpen={setIsVolunteerFormOpen} userRole={userProfile.role} onDataChange={fetchApplicationData} />;
      case 'departments':
        return <DepartmentsPage supabase={supabase} userRole={userRole} onDataChange={fetchApplicationData} />;
      case 'events':
        return <EventsPage supabase={supabase} isFormOpen={isEventFormOpen} setIsFormOpen={setIsEventFormOpen} userRole={userRole} leaderDepartmentId={userProfile?.department_id ?? null} onDataChange={fetchApplicationData} />;
      case 'admin':
        return <AdminPage supabase={supabase} onDataChange={fetchApplicationData} />;
       case 'my-profile':
        return <VolunteerProfile supabase={supabase} volunteerData={dashboardData?.volunteerProfile} onUpdate={fetchApplicationData} />;
      case 'dashboard':
      default:
        if (userRole === 'volunteer') {
            return <VolunteerDashboard initialData={dashboardData} />;
        }
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
  
  if (!userProfile) {
    // This case handles a logged-in user whose profile failed to load.
    // It prevents rendering a broken UI and avoids getting stuck on the loading screen.
    return (
       <div className="flex items-center justify-center min-h-screen bg-slate-100 text-center p-4">
        <div>
            <p className="text-lg text-red-600 font-semibold">Erro Crítico</p>
            <p className="text-slate-500 mt-2">Não foi possível carregar os dados do seu perfil. Por favor, tente novamente.</p>
            <button onClick={() => supabase?.auth.signOut()} className="mt-4 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg">
                Sair
            </button>
        </div>
      </div>
    );
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