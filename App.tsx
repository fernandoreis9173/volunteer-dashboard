import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import VolunteersPage from './components/VolunteersPage';
import DepartmentsPage from './components/DepartmentsPage';
// FIX: Corrected import name from SchedulesPage to EventsPage to match the component.
import EventsPage from './components/SchedulesPage';
import CalendarPage from './components/CalendarPage';
import AdminPage from './components/AdminPage';
import FrequencyPage from './components/FrequencyPage';
import LoginPage from './components/LoginPage';
import { AcceptInvitationPage } from './components/AcceptInvitationPage';
import ResetPasswordPage from './components/ResetPasswordPage';
import DisabledUserPage from './components/DisabledUserPage';
import VolunteerDashboard from './components/VolunteerDashboard';
import VolunteerProfile from './components/VolunteerProfile';
import UserProfilePage from './components/UserProfilePage';
import NotificationsPage from './components/NotificationsPage';
import NotificationToast, { Notification as ToastNotification } from './components/NotificationToast';
import PushNotificationModal from './components/PushNotificationModal';
import PermissionDeniedPage from './components/PermissionDeniedPage';
import ApiConfigPage from './components/ApiConfigPage'; // Import the config page
// FIX: To avoid a name collision with the DOM's `Event` type, the app's event type is aliased to `AppEvent`.
import { Page, AuthView, type NotificationRecord, type Event as AppEvent } from './types';
import { supabase } from './lib/supabaseClient';
import { type Session } from '@supabase/supabase-js';
import { getErrorMessage } from './lib/utils';

// CORREÇÃO 1: Usar import.meta.env para variáveis de ambiente no Vite.
// Check for required environment variables for the frontend
const areApiKeysConfigured = 
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_ANON_KEY &&
    import.meta.env.VITE_VAPID_PUBLIC_KEY;

interface UserProfileState {
  role: string | null;
  department_id: number | null;
  volunteer_id: number | null;
  status: string | null;
}

const pagePermissions: Record<Page, string[]> = {
    'dashboard': ['admin', 'leader', 'volunteer'],
    'notifications': ['leader', 'volunteer'],
    'my-profile': ['admin', 'leader', 'volunteer'],
    'volunteers': ['admin', 'leader'],
    'departments': ['admin'],
    'events': ['admin', 'leader'],
    'calendar': ['admin', 'leader'],
    'admin': ['admin'],
    'frequency': ['admin'],
};

const getInitialAuthView = (): AuthView => {
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) return 'reset-password';
    if (hash.includes('type=invite')) return 'accept-invite';
    return 'login';
};

const getPageFromHash = (): Page => {
    const hash = window.location.hash.slice(2); 
    const validPages: Page[] = ['dashboard', 'volunteers', 'departments', 'events', 'calendar', 'admin', 'my-profile', 'notifications', 'frequency'];
    if (validPages.includes(hash as Page)) return hash as Page;
    return 'dashboard';
};

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

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [activePage, setActivePage] = useState<Page>(getPageFromHash());
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isVolunteerFormOpen, setIsVolunteerFormOpen] = useState(false);
  const [isEventFormOpen, setIsEventFormOpen] = useState(false);
  const [authView, setAuthView] = useState<AuthView>(getInitialAuthView());
  const [isUserDisabled, setIsUserDisabled] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfileState | null>(null);
  const [notifications, setNotifications] = useState<ToastNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pushPermissionStatus, setPushPermissionStatus] = useState<string | null>(null);
  const [isPushPromptOpen, setIsPushPromptOpen] = useState(false);
  // FIX: Use the `AppEvent` alias for the application's event state.
  const [activeEvent, setActiveEvent] = useState<AppEvent | null>(null);
  // FIX: Use `any` for `installPromptEvent` state to accommodate the non-standard `BeforeInstallPromptEvent` properties like `prompt()`.
  const [installPromptEvent, setInstallPromptEvent] = useState<any | null>(null);
  const lastUserId = useRef<string | null>(null);
  
  // VAPID key is now hardcoded for production
  const VAPID_PUBLIC_KEY = 'BLENBc_aqRf1ndkS5ssPQTsZEkMeoOZvtKVYfe2fubKnz_Sh4CdrlzZwn--W37YrloW4841Xg-97v_xoX-xQmQk';

  const hasPermission = useMemo(() => {
    if (!userProfile?.role) {
        return false;
    }
    const normalizedRole = userProfile.role === 'lider' ? 'leader' : userProfile.role;
    const allowedRolesForPage = pagePermissions[activePage];
    return allowedRolesForPage && allowedRolesForPage.includes(normalizedRole);
  }, [userProfile, activePage]);

  const fetchCoreData = useCallback(async (currentSession: Session) => {
    try {
        const userStatus = currentSession.user.user_metadata?.status;
        const userRole = currentSession.user.user_metadata?.role;

        if (userStatus === 'Inativo') {
            setIsUserDisabled(true);
            setUserProfile({ role: userRole, department_id: null, volunteer_id: null, status: 'Inativo' });
            setIsLoading(false); // Stop loading, render disabled page.
            return;
        }
        setIsUserDisabled(false);

        if (!userRole) {
            console.error("User role not found in metadata.");
            setUserProfile(null);
            return;
        }
        
        // If the user status is pending, we don't need to fetch detailed profiles yet.
        // The registration page will handle the profile creation.
        if (userStatus === 'Pendente') {
             setUserProfile({ role: userRole, status: 'Pendente', department_id: null, volunteer_id: null });
             return;
        }

        let profile: UserProfileState | null = null;
        if (userRole === 'volunteer') {
            const { data: volunteerData, error: volunteerError } = await supabase
                .from('volunteers')
                .select('id')
                .eq('user_id', currentSession.user.id)
                .single();

            if (volunteerError) console.error("Error fetching volunteer profile:", getErrorMessage(volunteerError));
            
            profile = {
                role: userRole,
                department_id: null,
                volunteer_id: volunteerData?.id ?? null,
                status: userStatus,
            };

        } else { // Admin/Leader
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('department_id')
                .eq('id', currentSession.user.id)
                .single();
            
            if (profileError) console.error("Error fetching admin/leader profile:", getErrorMessage(profileError));

            profile = {
                role: userRole,
                department_id: profileData?.department_id ?? null,
                volunteer_id: null,
                status: userStatus,
            };
        }
        setUserProfile(profile);

        // Fetch global data (like unread notifications count) for active users
        const { count } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', currentSession.user.id)
            .eq('is_read', false);
        setUnreadCount(count ?? 0);
    } catch (err) {
        console.error("Error fetching core user data:", getErrorMessage(err));
        setUserProfile(null); // Clear profile on error
    } finally {
        setIsLoading(false); // Signal that all initial data loading is complete.
    }
  }, []);

  const refetchUserData = useCallback(() => {
    if (session) {
        setIsLoading(true);
        fetchCoreData(session);
    }
  }, [session, fetchCoreData]);
  
  const handleRegistrationComplete = useCallback(() => {
    // After registration, user status is 'Ativo'. We just need to refetch the profile data.
    refetchUserData();
    window.location.hash = '#/dashboard';
  }, [refetchUserData]);

  const refetchNotificationCount = useCallback(async () => {
    if (session) {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .eq('is_read', false);
      setUnreadCount(count ?? 0);
    }
  }, [session]);

    // --- PWA Installation Logic ---
    useEffect(() => {
        // FIX: The event parameter `e` is typed as `any` to handle the non-standard `BeforeInstallPromptEvent`, which has `preventDefault` and `prompt` methods. This resolves type errors.
        const handleBeforeInstallPrompt = (e: any) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setInstallPromptEvent(e);
        };

        // FIX: The handler now correctly matches the expected type for `addEventListener`, resolving the overload error.
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            // FIX: The handler now correctly matches the expected type for `removeEventListener`.
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallPrompt = async () => {
        if (!installPromptEvent) {
            alert('O aplicativo já foi instalado ou seu navegador não suporta a instalação. Você pode tentar adicionar manualmente à tela inicial através do menu do navegador.');
            return;
        }
        // @ts-ignore
        installPromptEvent.prompt();
        // @ts-ignore
        const { outcome } = await installPromptEvent.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        // We've used the prompt, and can't use it again, so clear it.
        setInstallPromptEvent(null);
    };

    useEffect(() => {
        // Initialize push notification permission status
        if ('Notification' in window && 'PushManager' in window) {
            setPushPermissionStatus(Notification.permission);
        }
    }, []);

    const checkForActiveEvent = useCallback(async () => {
        if (!session?.user) {
            setActiveEvent(null);
            return;
        }
    
        const now = new Date();
        
        // Timezone-safe method to get local date and time strings
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const today = `${year}-${month}-${day}`;
        
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const currentTime = `${hours}:${minutes}:${seconds}`;
    
        const { data, error } = await supabase
            .from('events')
            .select('*, event_departments(department_id, departments(id, name, leader)), event_volunteers(volunteer_id, department_id, present, volunteers(id, name, initials))')
            .eq('date', today)
            .lte('start_time', currentTime)
            .gt('end_time', currentTime)
            .eq('status', 'Confirmado')
            .limit(1)
            .single();
    
        if (error && error.code !== 'PGRST116') { // PGRST116 is "No rows found", which is fine
            console.error("Error checking for active event:", error);
        }
    
        // FIX: Use the `AppEvent` alias when casting the fetched data.
        setActiveEvent(data as AppEvent | null);
    }, [session]);
    
    useEffect(() => {
        checkForActiveEvent(); // Check immediately on session change/load
        const interval = setInterval(checkForActiveEvent, 60000); // And then check every minute
        return () => clearInterval(interval);
    }, [checkForActiveEvent]);

    const eventForSidebar = useMemo(() => {
        if (!activeEvent || !userProfile) return null;

        const { role, volunteer_id, department_id } = userProfile;

        if (role === 'admin') {
            return activeEvent;
        }

        if (role === 'volunteer' && activeEvent.event_volunteers.some(v => v.volunteer_id === volunteer_id)) {
            return activeEvent;
        }

        if ((role === 'leader' || role === 'lider') && activeEvent.event_departments.some(d => d.department_id === department_id)) {
            return activeEvent;
        }

        return null;
    }, [activeEvent, userProfile]);

    useEffect(() => {
        // This is the primary listener for auth changes (login, logout, token refresh).
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
            setSession(newSession);
             // If session becomes null (logout), we're not loading anymore.
            if (!newSession) {
                setIsLoading(false);
                setUserProfile(null);
            }
        });

        // This handles navigation via URL hash changes.
        const handleHashChange = () => {
            setActivePage(getPageFromHash());
            setAuthView(getInitialAuthView());
        };

        window.addEventListener('hashchange', handleHashChange, false);
        
        return () => {
            subscription.unsubscribe();
            window.removeEventListener('hashchange', handleHashChange, false);
        };
    }, []);
    
    useEffect(() => {
        // This effect runs whenever the session changes to fetch the user profile.
        // We only refetch all data if the user ID has changed, to avoid reloading
        // on token refreshes (e.g., when refocusing the tab).
        if (session) {
            if (session.user.id !== lastUserId.current) {
                lastUserId.current = session.user.id;
                setIsLoading(true);
                fetchCoreData(session);
            }
        } else {
            // User has logged out
            lastUserId.current = null;
        }
    }, [session, fetchCoreData]);

    useEffect(() => {
        // Prompt for push notifications after login if permission is 'default'
        if (!isLoading && userProfile) {
            const isTargetRole = userProfile.role === 'leader' || userProfile.role === 'lider' || userProfile.role === 'volunteer';
            if (isTargetRole && pushPermissionStatus === 'default' && !sessionStorage.getItem('pushPromptedThisSession')) {
                // Delay slightly to ensure UI is stable before showing modal
                setTimeout(() => {
                    setIsPushPromptOpen(true);
                    sessionStorage.setItem('pushPromptedThisSession', 'true');
                }, 1000);
            }
        }
    }, [isLoading, userProfile, pushPermissionStatus]);

    // Real-time notifications subscription
    useEffect(() => {
        if (!session?.user?.id) {
            return;
        }

        const channel = supabase
            .channel(`realtime-notifications:${session.user.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${session.user.id}`,
                },
                (payload) => {
                    const newNotification = payload.new as NotificationRecord;
                    
                    // Add to toast notifications
                    setNotifications(prev => [
                        ...prev,
                        {
                            id: newNotification.id,
                            message: newNotification.message,
                            type: 'info', // All real-time notifications are info style
                        },
                    ]);

                    // Refetch unread count to update the sidebar badge
                    refetchNotificationCount();
                }
            )
            .subscribe();
        
        return () => {
            supabase.removeChannel(channel);
        };

    }, [session, refetchNotificationCount]);

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
    
    const handleNewVolunteer = () => {
        handleNavigate('volunteers');
        setIsVolunteerFormOpen(true);
    };

    const handleNewEvent = () => {
        handleNavigate('events');
        setIsEventFormOpen(true);
    };

    const removeNotification = (id: number) => {
        setNotifications(notifications => notifications.filter(n => n.id !== id));
    };

    const renderPage = () => {
        if (!userProfile?.role) return null;

        if (userProfile.role === 'volunteer') {
             switch (activePage) {
                case 'my-profile':
                    return <VolunteerProfile session={session} onUpdate={refetchNotificationCount} />;
                case 'notifications':
                    return <NotificationsPage session={session} onDataChange={refetchNotificationCount} onNavigate={handleNavigate} />;
                case 'dashboard':
                default:
                    return <VolunteerDashboard session={session} onDataChange={refetchUserData} activeEvent={eventForSidebar} onNavigate={handleNavigate} />;
            }
        }

        // Admin and Leader pages
        switch (activePage) {
            case 'volunteers':
                return <VolunteersPage isFormOpen={isVolunteerFormOpen} setIsFormOpen={setIsVolunteerFormOpen} userRole={userProfile.role} leaderDepartmentId={userProfile.department_id} />;
            case 'departments':
                return <DepartmentsPage userRole={userProfile.role} leaderDepartmentId={userProfile.department_id} />;
            case 'events':
                 return <EventsPage isFormOpen={isEventFormOpen} setIsFormOpen={setIsEventFormOpen} userRole={userProfile.role} leaderDepartmentId={userProfile.department_id} />;
            case 'calendar':
                return <CalendarPage userRole={userProfile.role} leaderDepartmentId={userProfile.department_id} onDataChange={refetchNotificationCount} setIsSidebarOpen={setIsSidebarOpen} />;
            case 'admin':
                return userProfile.role === 'admin' ? <AdminPage onDataChange={refetchNotificationCount} /> : <Dashboard activeEvent={eventForSidebar} onNavigate={handleNavigate} />;
            case 'frequency':
                return userProfile.role === 'admin' ? <FrequencyPage /> : <Dashboard activeEvent={eventForSidebar} onNavigate={handleNavigate} />;
            case 'notifications':
                return <NotificationsPage session={session} onDataChange={refetchNotificationCount} onNavigate={handleNavigate} />;
            case 'my-profile':
                return <UserProfilePage session={session} onUpdate={refetchUserData} />;
            case 'dashboard':
            default:
                return <Dashboard activeEvent={eventForSidebar} onNavigate={handleNavigate} />;
        }
    };

    // If API keys are not configured, show the configuration page.
    if (!areApiKeysConfigured) {
        return <ApiConfigPage />;
    }
    
    if (isLoading) {
        return <div className="flex items-center justify-center h-screen bg-slate-50"><p>Carregando...</p></div>;
    }

    if (!session) {
        switch (authView) {
            case 'accept-invite':
                return <AcceptInvitationPage setAuthView={setAuthView} onRegistrationComplete={handleRegistrationComplete} />;
            case 'reset-password':
                return <ResetPasswordPage setAuthView={setAuthView} />;
            case 'login':
            default:
                return <LoginPage setAuthView={setAuthView} />;
        }
    }

    // If there's a session but the user's status is 'Pendente', force them to the registration page.
    if (userProfile?.status === 'Pendente') {
        return <AcceptInvitationPage setAuthView={setAuthView} onRegistrationComplete={handleRegistrationComplete} />;
    }

    if (isUserDisabled) {
        return <DisabledUserPage userRole={userProfile?.role ?? null} />;
    }

    // Full-screen permission check, runs after all data is loaded and user status is confirmed as not 'Pendente'.
    if (!hasPermission) {
        return <PermissionDeniedPage onNavigate={handleNavigate} />;
    }
    
    return (
        <>
            <div className="flex min-h-screen bg-slate-50">
                <Sidebar
                    activePage={activePage}
                    onNavigate={handleNavigate}
                    onNewVolunteer={handleNewVolunteer}
                    onNewEvent={handleNewEvent}
                    isOpen={isSidebarOpen}
                    setIsOpen={setIsSidebarOpen}
                    userRole={userProfile?.role ?? null}
                    session={session}
                    unreadCount={unreadCount}
                    pushPermissionStatus={pushPermissionStatus}
                    onSubscribeToPush={() => setIsPushPromptOpen(true)}
                    canInstallPwa={!!installPromptEvent}
                    onInstallPrompt={handleInstallPrompt}
                />
                <div className="flex-1 flex flex-col min-w-0">
                    {activePage !== 'calendar' && <Header onMenuClick={() => setIsSidebarOpen(true)} />}
                    <main className={`flex-1 bg-slate-50 ${activePage === 'calendar' ? 'p-0 lg:p-6' : 'p-6'}`}>
                        {renderPage()}
                    </main>
                </div>
                <PushNotificationModal
                    isOpen={isPushPromptOpen}
                    onClose={() => setIsPushPromptOpen(false)}
                    onConfirm={subscribeToPushNotifications}
                />
            </div>
            <div className="fixed top-4 right-4 z-[9999] space-y-2">
                {notifications.map(n => (
                    <NotificationToast key={n.id} notification={n} onClose={removeNotification} />
                ))}
            </div>
        </>
    );
};

export default App;