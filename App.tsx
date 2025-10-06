





import React, { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import VolunteersPage from './components/VolunteersPage';
import DepartmentsPage from './components/DepartmentsPage';
import EventsPage from './components/SchedulesPage';
import AdminPage from './components/AdminPage';
import ApiConfigPage from './components/ApiConfigPage';
import LoginPage from './components/LoginPage';
import { AcceptInvitationPage } from './components/AcceptInvitationPage';
import ResetPasswordPage from './components/ResetPasswordPage';
import DisabledUserPage from './components/DisabledUserPage';
import VolunteerDashboard from './components/VolunteerDashboard';
import VolunteerProfile from './components/VolunteerProfile';
import NotificationsPage from './components/NotificationsPage';
import NotificationToast, { Notification as ToastNotification } from './components/NotificationToast';
import { Page, AuthView, Event as VolunteerEvent, DashboardEvent, DashboardVolunteer, DetailedVolunteer, Stat, EnrichedUser } from './types';
import { getSupabaseClient } from './lib/supabaseClient';
import { SupabaseClient, Session } from '@supabase/supabase-js';
import { getErrorMessage } from './lib/utils';

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
    eventNames: string[];
}

interface DashboardData {
    stats?: {
        activeVolunteers: Stat;
        departments: Stat;
        schedulesToday: Stat;
        schedulesTomorrow: Stat;
    };
    todaySchedules?: DashboardEvent[];
    upcomingSchedules?: DashboardEvent[];
    activeVolunteers?: DashboardVolunteer[];
    chartData?: ChartDataPoint[];
    activeLeaders?: EnrichedUser[];
    // For Volunteer view
    schedules?: VolunteerEvent[];
    volunteerProfile?: DetailedVolunteer;
}

const getInitialAuthView = (): AuthView => {
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
        return 'reset-password';
    }
    if (hash.includes('type=invite')) {
        return 'accept-invite';
    }
    return 'login';
};

const getPageFromHash = (): Page => {
    const hash = window.location.hash.slice(2); // Remove #/
    const validPages: Page[] = ['dashboard', 'volunteers', 'departments', 'events', 'admin', 'my-profile', 'notifications'];
    if (validPages.includes(hash as Page)) {
        return hash as Page;
    }
    return 'dashboard'; // Default page
};


// ATENÇÃO: Substitua esta chave pela sua VAPID Public Key gerada.
// Esta chave é segura para ser exposta no lado do cliente.
const VAPID_PUBLIC_KEY = 'BKUlwcNry90zG0LMcB2srpjR2r344L6gkxOA5C_Ce-rsPJceN5pirwg3tmKXeetiJLElbJo7DDwLj_ZzBSD5c-A';

function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

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
  const [notifications, setNotifications] = useState<ToastNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pushPermissionStatus, setPushPermissionStatus] = useState<string | null>(null);

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
        
        // Fetch unread notifications count for all logged-in users
        const { count: unreadNotificationsCount } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', session.user.id)
            .eq('is_read', false);
        setUnreadCount(unreadNotificationsCount ?? 0);

        if (userRole === 'volunteer') {
            const { data: volunteerData, error: volunteerError } = await supabase
                .from('volunteers')
                .select('id, name, phone, initials, status, departments:departaments, skills, availability')
                .eq('user_id', session.user.id)
                .single();

            if (volunteerError || !volunteerData) {
                console.error("Error fetching volunteer profile by user_id:", getErrorMessage(volunteerError));
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
                console.error("Error fetching admin/leader profile:", getErrorMessage(profileError));
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

            const [statsRes, todaySchedulesRes, upcomingSchedulesRes, activeVolunteersRes, chartEventsRes, usersRes] = await Promise.all([
                Promise.all([
                    supabase.from('volunteers').select('id', { count: 'exact', head: true }).eq('status', 'Ativo'),
                    supabase.from('departments').select('id', { count: 'exact', head: true }).eq('status', 'Ativo'),
                    supabase.from('events').select('id', { count: 'exact', head: true }).eq('date', today).eq('status', 'Confirmado'),
                    supabase.from('events').select('id', { count: 'exact', head: true }).eq('date', tomorrow).eq('status', 'Confirmado'),
                ]),
                supabase.from('events').select('id, name, date, start_time, end_time, status, event_departments(departments(name)), event_volunteers(volunteers(name))').eq('date', today).eq('status', 'Confirmado').order('start_time').limit(10),
                supabase.from('events').select('id, name, date, start_time, end_time, status, event_departments(departments(name)), event_volunteers(volunteers(name))').gte('date', tomorrow).lte('date', nextSevenDays).eq('status', 'Confirmado').order('date').limit(10),
                supabase.from('volunteers').select('id, name, email, initials, departments:departaments').eq('status', 'Ativo').order('created_at', { ascending: false }).limit(5),
                supabase.from('events').select('date, name, event_volunteers(volunteer_id), event_departments(department_id)').gte('date', oneYearAgoISO.slice(0, 10)).limit(10000),
                supabase.functions.invoke('list-users'),
            ]);
            
            // Process chart data
            const dailyCounts: { [key: string]: { scheduledVolunteers: number; involvedDepartments: number, eventNames: string[] } } = {};
            
            (chartEventsRes.data || []).forEach(event => {
                const date = event.date;
                if (date) {
                    if (!dailyCounts[date]) {
                        dailyCounts[date] = { scheduledVolunteers: 0, involvedDepartments: 0, eventNames: [] };
                    }
                    // The nested select returns an array of objects, so .length is the count.
                    dailyCounts[date].scheduledVolunteers += (event.event_volunteers || []).length;
                    dailyCounts[date].involvedDepartments += (event.event_departments || []).length;
                    if(event.name) {
                        dailyCounts[date].eventNames.push(event.name);
                    }
                }
            });
        
            const chartData: ChartDataPoint[] = Object.entries(dailyCounts).map(([date, counts]) => ({
                date,
                ...counts,
            })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            // FIX: Cast the user object to EnrichedUser to inform TypeScript of its shape, resolving the property access error.
            const activeLeaders = (usersRes.data?.users || []).filter((user: any) => {
                const enrichedUser = user as EnrichedUser;
                const role = enrichedUser.user_metadata?.role;
                return (role === 'leader' || role === 'lider') && enrichedUser.app_status === 'Ativo';
            });


            setDashboardData({
                stats: {
                    activeVolunteers: { value: String(statsRes[0].count ?? 0), change: 9.5 },
                    departments: { value: String(statsRes[1].count ?? 0), change: 3.5 },
                    schedulesToday: { value: String(statsRes[2].count ?? 0), change: -1.6 },
                    schedulesTomorrow: { value: String(statsRes[3].count ?? 0), change: 2.5 },
                },
                todaySchedules: (todaySchedulesRes.data as unknown as DashboardEvent[]) || [],
                upcomingSchedules: (upcomingSchedulesRes.data as unknown as DashboardEvent[]) || [],
                activeVolunteers: (activeVolunteersRes.data as DashboardVolunteer[]) || [],
                chartData,
                activeLeaders,
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
        } else if (!session && newSession) { // Handle the invite link case where user id is the same but session appears
            setSession(newSession);
        }
    });

    return () => subscription.unsubscribe();
  }, []);
  
  // Effect for fetching ALL application data when session changes, and controlling the initialization state.
  useEffect(() => {
    // Block 1: Wait for initial Supabase client check.
    if (!initialAuthCheckCompleted) {
        return; 
    }

    const isAcceptFlow = window.location.hash.includes('type=invite') || window.location.hash.includes('type=recovery');

    // Block 2: Handle the invitation flow specifically.
    // The key is to keep showing the loading screen (`isInitializing`=true) until the session
    // is established by Supabase after processing the URL hash.
    if (isAcceptFlow) {
        if (session) {
            // Session is ready, we can stop loading and render the AcceptInvitationPage.
            setIsInitializing(false);
        }
        // If session is NOT ready, we do nothing and return. `isInitializing` remains true.
        return;
    }

    // Block 3: Handle logged-in users who are NOT in the invite flow.
    if (session) {
        // If their profile is still pending, they shouldn't be here.
        // Stop loading and let the render logic show the "Conta Pendente" page.
        if (session.user.user_metadata?.status === 'Pendente') {
            setIsInitializing(false);
        } else {
            // This is a normal, active user. Fetch data then stop loading.
            fetchApplicationData().finally(() => {
                setIsInitializing(false);
            });
        }
        return;
    }
    
    // Block 4: Handle logged-out users.
    // If we reach here, there's no session and it's not an invite flow.
    setUserProfile(null);
    setDashboardData(null);
    setIsUserDisabled(false);
    setIsInitializing(false);

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

        if (userRole === 'volunteer' && currentPage !== 'dashboard' && currentPage !== 'my-profile' && currentPage !== 'notifications') {
            window.location.hash = '#/dashboard';
            return;
        }
        
        const normalizedRole = userRole === 'lider' ? 'leader' : userRole;
        if (normalizedRole === 'admin' && currentPage === 'notifications') {
            window.location.hash = '#/dashboard';
            return;
        }
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

    // Effect for real-time notifications
  useEffect(() => {
    if (!supabase || !session || !userProfile) {
        return;
    }

    const handleNewNotification = (message: string, type: 'info' | 'success' | 'warning' = 'info') => {
        const newNotification: ToastNotification = {
            id: Date.now(),
            message,
            type,
        };
        setNotifications(prev => [...prev, newNotification]);
    };

    const channel = supabase.channel('global-notifications');
    
    channel.on('broadcast', { event: 'new_schedule' }, ({ payload }) => {
        if (userProfile.volunteer_id && payload.volunteerIds?.includes(userProfile.volunteer_id)) {
            handleNewNotification(`Você foi escalado para o evento "${payload.eventName}" no departamento de ${payload.departmentName}.`, 'success');
            fetchApplicationData();
        }
    });

    channel.on('broadcast', { event: 'event_update' }, ({ payload }) => {
        let shouldNotify = false;

        // For Volunteers: check if they are scheduled
        const isScheduledVolunteer = userProfile.volunteer_id && dashboardData?.schedules?.some(s => s.id === payload.eventId);
        if (isScheduledVolunteer) {
            shouldNotify = true;
        }

        // For Leaders: check if their department is involved
        const userRole = userProfile?.role;
        const isAffectedLeader = (userRole === 'leader' || userRole === 'lider') && 
                                 userProfile.department_id && 
                                 payload.departmentIds?.includes(userProfile.department_id);
        if (isAffectedLeader) {
            shouldNotify = true;
        }

        if (shouldNotify) {
            handleNewNotification(`Atualização no evento "${payload.eventName}": ${payload.updateMessage}`, 'info');
            fetchApplicationData();
        }
    });

    channel.on('broadcast', { event: 'new_event_for_department' }, ({ payload }) => {
        const volunteerDepts = dashboardData?.volunteerProfile?.departments as string[] | undefined;
        if (volunteerDepts && volunteerDepts.includes(payload.departmentName)) {
            handleNewNotification(`Novo evento para o seu departamento (${payload.departmentName}): "${payload.eventName}"!`, 'info');
        }
    });

    channel.on('broadcast', { event: 'new_event_for_leader' }, ({ payload }) => {
        const userRole = userProfile?.role;
        if (userRole === 'leader' || userRole === 'lider') {
            handleNewNotification(`Novo evento criado: "${payload.eventName}". Verifique se é necessário escalar seu departamento.`, 'info');
        }
    });

    channel.subscribe();

    return () => {
        supabase.removeChannel(channel);
    };

  }, [supabase, session, userProfile, dashboardData, fetchApplicationData]);
  
  // --- Push Notification Logic ---

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
        setPushPermissionStatus(Notification.permission);
    } else {
        setPushPermissionStatus('unsupported');
    }
  }, []);

  const subscribeUserToPush = useCallback(async () => {
    if (!supabase || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log("Push messaging is not supported");
        return;
    }

    try {
        const swRegistration = await navigator.serviceWorker.ready;
        const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        
        let existingSubscription = await swRegistration.pushManager.getSubscription();
        if (existingSubscription) {
            console.log('User is already subscribed.');
            // Optionally, re-send to backend to ensure it's synced
            await supabase.functions.invoke('save-push-subscription', {
                body: { subscription: existingSubscription },
            });
            return;
        }

        const subscription = await swRegistration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey
        });

        const { error } = await supabase.functions.invoke('save-push-subscription', {
            body: { subscription },
        });

        if (error) throw error;
        
        console.log('User is subscribed.');

    } catch (err) {
        console.error('Failed to subscribe the user: ', err);
// FIX: Removed obsolete check for a placeholder VAPID key. The key is hardcoded, so this condition was always false and caused a TypeScript error.
    }
  }, [supabase]);


  useEffect(() => {
    if (pushPermissionStatus === 'granted' && session) {
        subscribeUserToPush();
    }
  }, [pushPermissionStatus, session, subscribeUserToPush]);

  const handleRequestPushPermission = async () => {
    if (pushPermissionStatus !== 'default') return;
    const permission = await Notification.requestPermission();
    setPushPermissionStatus(permission);
  };


  const removeNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };
  
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
    if (normalizedRole === 'volunteer' && activePage !== 'dashboard' && activePage !== 'my-profile' && activePage !== 'notifications') return null;
    if (normalizedRole === 'leader' && activePage === 'admin') return null;
    if (normalizedRole === 'admin' && activePage === 'notifications') return null;
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
      case 'notifications':
        return <NotificationsPage supabase={supabase} session={session} onDataChange={fetchApplicationData} onNavigate={handleNavigate} />;
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

  // Handle users who are logged in but haven't completed the invitation flow.
  if (session && session.user.user_metadata?.status === 'Pendente') {
    const isAcceptFlow = window.location.hash.includes('type=invite') || window.location.hash.includes('type=recovery');
    if (!isAcceptFlow) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 text-center p-4">
          <div className="w-full max-w-lg p-8 space-y-6 bg-white rounded-2xl shadow-lg">
             <div className="flex justify-center mb-4">
                  <div className="p-3 bg-amber-500 text-white rounded-xl">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
              </div>
            <h1 className="text-3xl font-bold text-slate-800">Conta Pendente</h1>
            <p className="text-slate-600">Sua conta ainda não foi ativada. Por favor, use o link de convite enviado para o seu e-mail para completar o cadastro.</p>
            <div className="pt-4">
              <button onClick={() => supabase?.auth.signOut()} className="w-full inline-flex justify-center rounded-lg border border-transparent px-4 py-2 bg-slate-600 text-base font-semibold text-white shadow-sm hover:bg-slate-700">
                  Sair
              </button>
            </div>
          </div>
        </div>
      );
    }
  }
  
  if (!supabase) {
    return <ApiConfigPage />;
  }
  
  if (authView === 'reset-password') {
      return <ResetPasswordPage supabase={supabase} setAuthView={setAuthView} />;
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
        unreadCount={unreadCount}
        pushPermissionStatus={pushPermissionStatus}
        onRequestPushPermission={handleRequestPushPermission}
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
      <div aria-live="assertive" className="fixed inset-0 flex items-end px-4 py-6 pointer-events-none sm:p-6 sm:items-start z-50">
        <div className="w-full flex flex-col items-center space-y-4 sm:items-end">
          {notifications.map((notification) => (
            <NotificationToast key={notification.id} notification={notification} onClose={removeNotification} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;