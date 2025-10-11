import React, { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import VolunteersPage from './components/VolunteersPage';
import DepartmentsPage from './components/DepartmentsPage';
import EventsPage from './components/SchedulesPage';
import CalendarPage from './components/CalendarPage';
import AdminPage from './components/AdminPage';
import LoginPage from './components/LoginPage';
import { AcceptInvitationPage } from './components/AcceptInvitationPage';
import ResetPasswordPage from './components/ResetPasswordPage';
import DisabledUserPage from './components/DisabledUserPage';
import VolunteerDashboard from './components/VolunteerDashboard';
import VolunteerProfile from './components/VolunteerProfile';
import NotificationsPage from './components/NotificationsPage';
import NotificationToast, { Notification as ToastNotification } from './components/NotificationToast';
import PushNotificationModal from './components/PushNotificationModal';
import { Page, AuthView, Event as VolunteerEvent, DashboardEvent, DashboardVolunteer, DetailedVolunteer, Stat, EnrichedUser } from './types';
import { supabase } from './lib/supabaseClient';
import { type Session } from '@supabase/supabase-js';
import { getErrorMessage } from './lib/utils';

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
    schedules?: VolunteerEvent[];
    volunteerProfile?: DetailedVolunteer;
}

const getInitialAuthView = (): AuthView => {
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) return 'reset-password';
    if (hash.includes('type=invite')) return 'accept-invite';
    return 'login';
};

const getPageFromHash = (): Page => {
    const hash = window.location.hash.slice(2); 
    const validPages: Page[] = ['dashboard', 'volunteers', 'departments', 'events', 'calendar', 'admin', 'my-profile', 'notifications'];
    if (validPages.includes(hash as Page)) return hash as Page;
    return 'dashboard';
};

const VAPID_PUBLIC_KEY = 'BLENBc_aqRf1ndkS5ssPQTsZEkMeoOZvtKVYfe2fubKnz_Sh4CdrlzZwn--W37YrloW4841Xg-97v_xoX-xQmQk';

const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
};

const pageTitles: Record<Page, string> = {
  dashboard: 'Dashboard',
  volunteers: 'Volunteers',
  departments: 'Departamentos',
  events: 'Eventos',
  calendar: 'Calendário',
  admin: 'Admin',
  'my-profile': 'Meu Perfil',
  notifications: 'Notificações'
};


const App: React.FC = () => {
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
  const [isPushPromptOpen, setIsPushPromptOpen] = useState(false);
  const prevSessionRef = useRef<Session | null>(null);

  const fetchApplicationData = useCallback(async () => {
    if (session) {
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
                setDashboardData({
                    schedules,
                    volunteerProfile: volunteerData as DetailedVolunteer
                });
            }
        } else { // Admin/Leader data fetching
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('department_id')
                .eq('id', session.user.id)
                .single();
            
            if (profileError) {
                console.error("Error fetching leader/admin profile:", getErrorMessage(profileError));
            }

            const profile: UserProfileState = {
                role: userRole,
                department_id: profileData?.department_id ?? session.user.user_metadata?.department_id ?? null,
                volunteer_id: null,
            };
            setUserProfile(profile);

            try {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const tomorrow = new Date(today);
                tomorrow.setDate(today.getDate() + 1);
                const next7Days = new Date(today);
                next7Days.setDate(today.getDate() + 7);
                const last30Days = new Date(today);
                last30Days.setDate(today.getDate() - 29);

                const todayStr = today.toISOString().split('T')[0];
                const tomorrowStr = tomorrow.toISOString().split('T')[0];
                const next7DaysStr = next7Days.toISOString().split('T')[0];
                const last30DaysStr = last30Days.toISOString().split('T')[0];

                const [
                    activeVolunteersCountRes,
                    departmentsCountRes,
                    schedulesTodayCountRes,
                    schedulesTomorrowCountRes,
                    todaySchedulesRes,
                    upcomingSchedulesRes,
                    activeVolunteersRes,
                    activeLeadersRes,
                    chartEventsRes
                ] = await Promise.all([
                    supabase.from('volunteers').select('*', { count: 'exact', head: true }).eq('status', 'Ativo'),
                    supabase.from('departments').select('*', { count: 'exact', head: true }).eq('status', 'Ativo'),
                    supabase.from('events').select('*', { count: 'exact', head: true }).eq('date', todayStr),
                    supabase.from('events').select('*', { count: 'exact', head: true }).eq('date', tomorrowStr),
                    supabase.from('events').select('id, name, date, start_time, end_time, status, event_departments(departments(name)), event_volunteers(volunteers(name))').eq('date', todayStr).order('start_time'),
                    supabase.from('events').select('id, name, date, start_time, end_time, status, event_departments(departments(name)), event_volunteers(volunteers(name))').gte('date', tomorrowStr).lte('date', next7DaysStr).limit(10).order('date').order('start_time'),
                    supabase.from('volunteers').select('id, name, email, initials, departments:departaments').eq('status', 'Ativo').limit(5).order('created_at', { ascending: false }),
                    supabase.functions.invoke('list-users'),
                    supabase.from('events').select('date, name, event_volunteers(count), event_departments(department_id)').gte('date', last30DaysStr).lte('date', todayStr)
                ]);

                // Process Stats
                const stats = {
                    activeVolunteers: { value: String(activeVolunteersCountRes.count ?? 0), change: 0 },
                    departments: { value: String(departmentsCountRes.count ?? 0), change: 0 },
                    schedulesToday: { value: String(schedulesTodayCountRes.count ?? 0), change: 0 },
                    schedulesTomorrow: { value: String(schedulesTomorrowCountRes.count ?? 0), change: 0 },
                };

                // Process Leaders
                const activeLeaders = (activeLeadersRes.data?.users || [])
                    .filter((u: EnrichedUser) => u.app_status === 'Ativo')
                    .sort((a: EnrichedUser, b: EnrichedUser) => new Date(b.last_sign_in_at || 0).getTime() - new Date(a.last_sign_in_at || 0).getTime())
                    .slice(0, 5);
                
                // Process Chart Data
                const chartDataMap = new Map<string, { scheduledVolunteers: number; involvedDepartments: Set<number>; eventNames: string[] }>();
                if (chartEventsRes.data) {
                    for (const event of chartEventsRes.data) {
                        const date = event.date;
                        if (!chartDataMap.has(date)) {
                            chartDataMap.set(date, { scheduledVolunteers: 0, involvedDepartments: new Set(), eventNames: [] });
                        }
                        const entry = chartDataMap.get(date)!;
                        entry.scheduledVolunteers += (event.event_volunteers[0] as any)?.count ?? 0;
                        (event.event_departments as any[]).forEach((ed: any) => entry.involvedDepartments.add(ed.department_id));
                        entry.eventNames.push(event.name);
                    }
                }
        
                const chartData: ChartDataPoint[] = [];
                for (let i = 0; i < 30; i++) {
                    const day = new Date(last30Days);
                    day.setDate(last30Days.getDate() + i);
                    const dateStr = day.toISOString().split('T')[0];
                    const dataForDay = chartDataMap.get(dateStr);
                    chartData.push({
                        date: dateStr,
                        scheduledVolunteers: dataForDay?.scheduledVolunteers || 0,
                        involvedDepartments: dataForDay?.involvedDepartments.size || 0,
                        eventNames: dataForDay?.eventNames || [],
                    });
                }
                
                setDashboardData({
                    stats,
                    todaySchedules: (todaySchedulesRes.data as DashboardEvent[]) || [],
                    upcomingSchedules: (upcomingSchedulesRes.data as DashboardEvent[]) || [],
                    activeVolunteers: (activeVolunteersRes.data as DashboardVolunteer[]) || [],
                    chartData,
                    activeLeaders,
                });

            } catch (error) {
                console.error("Failed to fetch dashboard data:", getErrorMessage(error));
                setDashboardData(null);
            }
        }
    }
  }, [session]);

    useEffect(() => {
        if (session && !isInitializing) {
            fetchApplicationData();
        }
    }, [session, isInitializing, fetchApplicationData]);
    
    useEffect(() => {
        if (!initialAuthCheckCompleted) return;

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (_event === 'SIGNED_IN' && session?.user.id !== sessionUserId.current) {
                sessionUserId.current = session.user.id;
                setIsInitializing(false);
            } else if (_event === 'SIGNED_OUT') {
                setSession(null);
                setUserProfile(null);
                setDashboardData(null);
                setAuthView('login');
                window.location.hash = '';
            }
        });
        
        return () => subscription.unsubscribe();
    }, [initialAuthCheckCompleted]);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            sessionUserId.current = session?.user.id ?? null;
            setIsInitializing(false);
            setInitialAuthCheckCompleted(true);
        });

        const handleHashChange = () => {
            setActivePage(getPageFromHash());
            setAuthView(getInitialAuthView());
        };

        window.addEventListener('hashchange', handleHashChange, false);
        return () => {
            window.removeEventListener('hashchange', handleHashChange, false);
        };
    }, []);

    useEffect(() => {
        // Automatically hide the sidebar when navigating to the calendar page
        if (activePage === 'calendar') {
            setIsSidebarOpen(false);
        }
    }, [activePage]);

    const subscribeToPushNotifications = async () => {
        if ('serviceWorker' in navigator && 'PushManager' in window && session) {
            try {
                const registration = await navigator.serviceWorker.ready;
                const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
                });

                const { error } = await supabase.functions.invoke('save-push-subscription', {
                    body: { subscription },
                });

                if (error) throw error;

                setPushPermissionStatus('granted');
                setNotifications(prev => [...prev, { id: Date.now(), message: 'Notificações ativadas!', type: 'success' }]);

            } catch (err) {
                console.error('Failed to subscribe to push notifications:', getErrorMessage(err));
                setPushPermissionStatus('denied');
                setNotifications(prev => [...prev, { id: Date.now(), message: 'Falha ao ativar notificações.', type: 'warning' }]);
            }
        }
        setIsPushPromptOpen(false);
    };

    const handleNavigate = (page: Page) => {
        setActivePage(page);
        window.location.hash = `#/${page}`;
        setIsSidebarOpen(false);
    };

    const removeNotification = (id: number) => {
        setNotifications(notifications => notifications.filter(n => n.id !== id));
    };

    const renderPage = () => {
        if (userProfile?.role === 'volunteer') {
             switch (activePage) {
                case 'my-profile':
                    return <VolunteerProfile supabase={supabase} volunteerData={dashboardData?.volunteerProfile} onUpdate={fetchApplicationData} />;
                case 'notifications':
                    return <NotificationsPage session={session} onDataChange={fetchApplicationData} onNavigate={handleNavigate} />;
                case 'dashboard':
                default:
                    return <VolunteerDashboard initialData={dashboardData} />;
            }
        }

        // Admin and Leader pages
        switch (activePage) {
            case 'volunteers':
                return <VolunteersPage isFormOpen={isVolunteerFormOpen} setIsFormOpen={setIsVolunteerFormOpen} userRole={userProfile?.role ?? null} onDataChange={fetchApplicationData} />;
            case 'departments':
                return <DepartmentsPage userRole={userProfile?.role ?? null} onDataChange={fetchApplicationData} />;
            case 'events':
                 return <EventsPage isFormOpen={isEventFormOpen} setIsFormOpen={setIsEventFormOpen} userRole={userProfile?.role ?? null} leaderDepartmentId={userProfile?.department_id ?? null} onDataChange={fetchApplicationData} />;
            case 'calendar':
                return <CalendarPage userRole={userProfile?.role ?? null} leaderDepartmentId={userProfile?.department_id ?? null} onDataChange={fetchApplicationData} setIsSidebarOpen={setIsSidebarOpen} />;
            case 'admin':
                return userProfile?.role === 'admin' ? <AdminPage onDataChange={fetchApplicationData} /> : <Dashboard initialData={dashboardData} />;
            case 'notifications':
                return <NotificationsPage session={session} onDataChange={fetchApplicationData} onNavigate={handleNavigate} />;
            case 'dashboard':
            default:
                return <Dashboard initialData={dashboardData} />;
        }
    };
    
    if (isInitializing) {
        return <div className="flex items-center justify-center h-screen bg-slate-50"><p>Carregando...</p></div>;
    }

    if (!session) {
        switch (authView) {
            case 'accept-invite':
                return <AcceptInvitationPage setAuthView={setAuthView} />;
            case 'reset-password':
                return <ResetPasswordPage setAuthView={setAuthView} />;
            case 'login':
            default:
                return <LoginPage setAuthView={setAuthView} />;
        }
    }

    if (isUserDisabled) {
        return <DisabledUserPage userRole={userProfile?.role ?? null} />;
    }

    return (
        <div className="flex h-screen bg-slate-50">
            <Sidebar
                activePage={activePage}
                onNavigate={handleNavigate}
                onNewVolunteer={() => setIsVolunteerFormOpen(true)}
                onNewEvent={() => setIsEventFormOpen(true)}
                isOpen={isSidebarOpen}
                setIsOpen={setIsSidebarOpen}
                userRole={userProfile?.role ?? null}
                session={session}
                unreadCount={unreadCount}
                pushPermissionStatus={pushPermissionStatus}
                onSubscribeToPush={() => setIsPushPromptOpen(true)}
            />
            <div className="flex-1 flex flex-col overflow-hidden">
                {activePage !== 'calendar' && <Header onMenuClick={() => setIsSidebarOpen(true)} />}
                <main className={`flex-1 overflow-x-hidden overflow-y-auto bg-slate-50 ${activePage === 'calendar' ? '' : 'p-6'}`}>
                    {renderPage()}
                </main>
            </div>
            <div className="fixed top-4 right-4 z-50 space-y-2">
                {notifications.map(n => (
                    <NotificationToast key={n.id} notification={n} onClose={removeNotification} />
                ))}
            </div>
            <PushNotificationModal
                isOpen={isPushPromptOpen}
                onClose={() => setIsPushPromptOpen(false)}
                onConfirm={subscribeToPushNotifications}
            />
        </div>
    );
};

export default App;
