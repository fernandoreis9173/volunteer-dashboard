import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import LeaderDashboard from './components/Dashboard';
import VolunteersPage from './components/VolunteersPage';
import DepartmentsPage from './components/DepartmentsPage';
// FIX: Corrected import name from SchedulesPage to EventsPage to match the component.
import SchedulesPage from './components/SchedulesPage';
import CalendarPage from './components/CalendarPage';
import AdminPage from './components/AdminPage';
import AdminDashboard from './components/AdminDashboard';
import FrequencyPage from './components/FrequencyPage';
import LoginPage from './components/LoginPage';
import { AcceptInvitationPage } from './components/AcceptInvitationPage';
import ResetPasswordPage from './components/ResetPasswordPage';
import DisabledUserPage from './components/DisabledUserPage';
import VolunteerDashboard from './components/VolunteerDashboard';
import AttendanceHistoryPage from './components/AttendanceHistoryPage';
import VolunteerProfile from './components/VolunteerProfile';
import UserProfilePage from './components/UserProfilePage';
import NotificationsPage from './components/NotificationsPage';
import NotificationToast, { Notification as ToastNotification } from './components/NotificationToast';
import PushNotificationModal from './components/PushNotificationModal';
import IOSInstallPromptModal from './components/IOSInstallPromptModal';
import PermissionDeniedPage from './components/PermissionDeniedPage';
import ApiConfigPage from './components/ApiConfigPage'; // Import the config page
// FIX: To avoid a name collision with the DOM's `Event` type, the app's event type is aliased to `AppEvent`.
// FIX: Import EnrichedUser type to correctly type users from `list-users` function.
import { Page, AuthView, type NotificationRecord, type Event as AppEvent, type DetailedVolunteer, type EnrichedUser } from './types';
import { supabase } from './lib/supabaseClient';
// FIX: Restored Supabase v2 types to ensure type safety.
import { type Session, type User } from '@supabase/supabase-js';
import { getErrorMessage } from './lib/utils';

// CORREÇÃO 1: Usar import.meta.env para variáveis de ambiente no Vite.
// Check for required environment variables for the frontend
const areApiKeysConfigured = 
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_ANON_KEY &&
    import.meta.env.VITE_VAPID_PUBLIC_KEY;

// FIX: Reverted UserProfileState to use `department_id` (singular) to enforce the business rule of one leader per department.
interface UserProfileState {
  role: string | null;
  department_id: number | null;
  volunteer_id: number | null;
  status: string | null;
}

const pagePermissions: Record<Page, string[]> = {
    'dashboard': ['admin', 'leader', 'volunteer'],
    'history': ['volunteer'],
    'notifications': ['leader', 'volunteer'],
    'my-profile': ['admin', 'leader', 'volunteer'],
    'volunteers': ['admin', 'leader'],
    'departments': ['admin'],
    'events': ['admin', 'leader'],
    'calendar': ['admin', 'leader'],
    'frequency': ['admin'],
    'admin': ['admin'],
};

const getInitialAuthView = (): AuthView => {
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) return 'reset-password';
    if (hash.includes('type=invite')) return 'accept-invite';
    return 'login';
};

const getPageFromHash = (): Page => {
    const hash = window.location.hash.slice(2); 
    const validPages: Page[] = ['dashboard', 'volunteers', 'departments', 'events', 'calendar', 'my-profile', 'notifications', 'frequency', 'admin', 'history'];
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
  // FIX: Use 'any' for Session type due to import errors.
  const [session, setSession] = useState<Session | null>(null);
  const [activePage, setActivePage] = useState<Page>(getPageFromHash());
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isVolunteerFormOpen, setIsVolunteerFormOpen] = useState(false);
  const [isEventFormOpen, setIsEventFormOpen] = useState(false);
  const [authView, setAuthView] = useState<AuthView>(getInitialAuthView());
  const [userProfile, setUserProfile] = useState<UserProfileState | null>(null);
  const [notifications, setNotifications] = useState<ToastNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pushPermissionStatus, setPushPermissionStatus] = useState<string | null>(null);
  const [isPushPromptOpen, setIsPushPromptOpen] = useState(false);
  // FIX: Use the `AppEvent` alias for the application's event state.
  const [activeEvent, setActiveEvent] = useState<AppEvent | null>(null);
  // FIX: Use `any` for `installPromptEvent` state to accommodate the non-standard `BeforeInstallPromptEvent` properties like `prompt()`.
  const [installPromptEvent, setInstallPromptEvent] = useState<any | null>(null);
  const [isIOSInstallPromptOpen, setIsIOSInstallPromptOpen] = useState(false);
  // FIX: Use 'any' for User type due to import errors.
  const [leaders, setLeaders] = useState<User[]>([]);
  const lastUserId = useRef<string | null>(null);
  const hasLoginRedirected = useRef(false);
  
  // VAPID key is now hardcoded for production
  const VAPID_PUBLIC_KEY = 'BLENBc_aqRf1ndkS5ssPQTsZEkMeoOZvtKVYfe2fubKnz_Sh4CdrlzZwn--W37YrloW4841Xg-97v_xoX-xQmQk';

  const isIOS = useMemo(() => /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream, []);
  const isStandalone = useMemo(() => ('standalone' in window.navigator && (window.navigator as any).standalone) || window.matchMedia('(display-mode: standalone)').matches, []);
  const isUserDisabled = useMemo(() => userProfile?.status === 'Inativo', [userProfile]);

  const hasPermission = useMemo(() => {
    if (!userProfile?.role) {
        return false;
    }
    const normalizedRole = userProfile.role === 'lider' ? 'leader' : userProfile.role;
    const allowedRolesForPage = pagePermissions[activePage];
    return allowedRolesForPage && allowedRolesForPage.includes(normalizedRole);
  }, [userProfile, activePage]);

  // FIX: Use 'any' for Session type due to import errors.
  const fetchCoreData = useCallback(async (currentSession: Session) => {
    try {
        const userStatus = currentSession.user.user_metadata?.status;
        const userRole = currentSession.user.user_metadata?.role;

        if (userStatus === 'Inativo') {
            // FIX: Initialize with a single null department_id for inactive users.
            setUserProfile({ role: userRole, department_id: null, volunteer_id: null, status: 'Inativo' });
            setIsLoading(false); // Stop loading, render disabled page.
            return;
        }

        if (!userRole) {
            console.error("User role not found in metadata.");
            setUserProfile(null);
            return;
        }
        
        // If the user status is pending, we don't need to fetch detailed profiles yet.
        // The registration page will handle the profile creation.
        if (userStatus === 'Pendente') {
             // FIX: Initialize with a single null department_id for pending users.
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
                // FIX: Initialize with a single null department_id for volunteers.
                department_id: null,
                volunteer_id: volunteerData?.id ?? null,
                status: userStatus,
            };

        } else { // Admin/Leader
             // FIX: Fetch only a single department ID for a leader, enforcing the business rule.
             const { data: leaderDept, error: leaderDeptError } = await supabase
                .from('department_leaders')
                .select('department_id')
                .eq('leader_id', currentSession.user.id)
                .maybeSingle(); // Use maybeSingle to handle admins with no departments.

            if (leaderDeptError) {
                 console.error("Error fetching admin/leader department:", getErrorMessage(leaderDeptError));
            }
            
            profile = {
                role: userRole,
                // FIX: Assign the single department ID to `department_id`.
                department_id: leaderDept?.department_id || null,
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
  
  const handleNavigate = useCallback((page: Page) => {
    setActivePage(page);
    window.location.hash = `#/${page}`;
    setIsSidebarOpen(false);
  }, []);

  const handleRegistrationComplete = useCallback(() => {
    // After registration, user status is 'Ativo'. We just need to refetch the profile data.
    refetchUserData();
    handleNavigate('dashboard');
  }, [refetchUserData, handleNavigate]);

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
        if (installPromptEvent) {
            // @ts-ignore
            installPromptEvent.prompt();
            // @ts-ignore
            const { outcome } = await installPromptEvent.userChoice;
            console.log(`User response to the install prompt: ${outcome}`);
            // We've used the prompt, and can't use it again, so clear it.
            setInstallPromptEvent(null);
        } else if (isIOS && !isStandalone) {
            setIsIOSInstallPromptOpen(true);
        } else {
            alert('O aplicativo já foi instalado ou seu navegador não suporta a instalação. Você pode tentar adicionar manualmente à tela inicial através do menu do navegador.');
        }
    };

    useEffect(() => {
        // Initialize push notification permission status
        if ('Notification' in window && 'PushManager' in window) {
            setPushPermissionStatus(Notification.permission);
        }
    }, []);

    const fetchLeaders = useCallback(async () => {
        if(!session) return;
        try {
            const { data, error: invokeError } = await supabase.functions.invoke('list-users');
            if (invokeError) throw invokeError;
            if (data.users) {
                 // FIX: Use EnrichedUser type which includes the `app_status` property from the `list-users` function.
                 const potentialLeaders = data.users.filter((user: EnrichedUser) => {
                    const role = user.user_metadata?.role;
                    return (role === 'leader' || role === 'lider' || role === 'admin') && user.app_status === 'Ativo';
                });
                setLeaders(potentialLeaders);
            }
        } catch (err) {
            console.error("Error fetching leaders in App:", getErrorMessage(err));
        }
    }, [session]);

    useEffect(() => {
        fetchLeaders();
    }, [fetchLeaders]);

    const checkForActiveEvent = useCallback(async () => {
        if (!session?.user) {
            setActiveEvent(null);
            return;
        }
        
        try {
            // Use the secure RPC function to get the active event.
            // This bypasses faulty RLS policies and is highly performant.
            const { data, error } = await supabase.rpc('get_active_event_for_user');
    
            if (error) throw error;
    
            setActiveEvent(data as AppEvent | null);
    
        } catch (err) {
            const errorMessage = getErrorMessage(err);
            // The RPC function should not return an RLS error, but we keep this for diagnostics.
            if (errorMessage.includes('column "department_id" does not exist')) {
                console.error("RLS/RPC Policy Error:", "A função do banco de dados (RPC) 'get_active_event_for_user' falhou ou uma política de segurança (RLS) interferiu.");
            } else {
                console.error("Error fetching active event via RPC:", errorMessage);
            }
            setActiveEvent(null);
        }
    }, [session]);
    
    useEffect(() => {
        checkForActiveEvent(); // Check immediately on session change/load
        const interval = setInterval(checkForActiveEvent, 60000); // And then check every minute
        return () => clearInterval(interval);
    }, [checkForActiveEvent]);

    const eventForSidebar = useMemo(() => {
        if (!activeEvent || !userProfile) return null;

        // FIX: Use `department_id` (singular) to check if the leader's department is involved.
        const { role, volunteer_id, department_id } = userProfile;

        if (role === 'admin') {
            return activeEvent;
        }

        if (role === 'volunteer' && (activeEvent.event_volunteers || []).some(v => v.volunteer_id === volunteer_id)) {
            return activeEvent;
        }

        if ((role === 'leader' || role === 'lider') && department_id) {
            if ((activeEvent.event_departments || []).some(d => d.department_id === department_id)) {
                return activeEvent;
            }
        }

        return null;
    }, [activeEvent, userProfile]);

    useEffect(() => {
        // This is the primary listener for auth changes (login, logout, token refresh).
        // FIX: Supabase v2 onAuthStateChange returns a subscription object inside a data object.
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
        // Handles initial redirect and post-login actions like notification prompts.
        if (session && userProfile && !hasLoginRedirected.current) {
            hasLoginRedirected.current = true; // Mark as handled to run once per login.

            // Prompt leaders and volunteers to enable push notifications upon login if not yet configured.
            const isLeaderOrVolunteer = userProfile.role === 'leader' || userProfile.role === 'lider' || userProfile.role === 'volunteer';
            if (isLeaderOrVolunteer && pushPermissionStatus === 'default') {
                setTimeout(() => setIsPushPromptOpen(true), 1000); // Delay for UI stability.
            }

            // Redirect to dashboard only if the user didn't land on a specific page via URL hash.
            const currentPageFromHash = getPageFromHash();
            if (currentPageFromHash === 'dashboard') {
                handleNavigate('dashboard');
            }
        }
        
        // Reset the redirect flag when the user logs out.
        if (!session) {
            hasLoginRedirected.current = false;
        }
    }, [session, userProfile, handleNavigate, pushPermissionStatus]);

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

    // Real-time volunteer status subscription
    useEffect(() => {
        // Only run for authenticated volunteers
        if (!session?.user?.id || userProfile?.role !== 'volunteer') {
            return;
        }

        const channel = supabase
            .channel(`realtime-volunteer-status:${session.user.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'volunteers',
                    filter: `user_id=eq.${session.user.id}`,
                },
                (payload) => {
                    const updatedVolunteer = payload.new as DetailedVolunteer;
                    
                    // Only react to a change if the new status is different from the one we have in state.
                    // This prevents race conditions on initial subscription.
                    if (userProfile && updatedVolunteer.status !== userProfile.status) {
                        if (updatedVolunteer.status === 'Inativo') {
                            // Directly update the profile to 'Inativo'. The derived `isUserDisabled` state will trigger the UI change.
                            setUserProfile(prev => prev ? { ...prev, status: 'Inativo' } : null);
                        } else if (updatedVolunteer.status === 'Ativo') {
                            // If status changes back to active, refetch all data to ensure consistency.
                            refetchUserData();
                        }
                    }
                }
            )
            .subscribe();
        
        return () => {
            supabase.removeChannel(channel);
        };
    }, [session, userProfile, refetchUserData]);

    // Real-time leader department assignment subscription
    useEffect(() => {
        if (!session?.user?.id || (userProfile?.role !== 'leader' && userProfile?.role !== 'lider')) {
            return;
        }

        const channel = supabase
            .channel(`realtime-leader-departments:${session.user.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen for INSERT, UPDATE, DELETE
                    schema: 'public',
                    table: 'department_leaders',
                    filter: `leader_id=eq.${session.user.id}`,
                },
                () => {
                    console.log('Detected a change in leader department assignments. Refetching user data...');
                    refetchUserData();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [session, userProfile, refetchUserData]);

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
                case 'history':
                    return <AttendanceHistoryPage session={session} />;
                case 'my-profile':
                    return <VolunteerProfile session={session} onUpdate={refetchNotificationCount} leaders={leaders} />;
                case 'notifications':
                    return <NotificationsPage session={session} onDataChange={refetchNotificationCount} onNavigate={handleNavigate} />;
                case 'dashboard':
                default:
                    return <VolunteerDashboard session={session} onDataChange={refetchUserData} activeEvent={eventForSidebar} onNavigate={handleNavigate} leaders={leaders} />;
            }
        }

        // Admin and Leader pages
        switch (activePage) {
            case 'volunteers':
                // FIX: Pass the single leaderDepartmentId to VolunteersPage.
                return <VolunteersPage isFormOpen={isVolunteerFormOpen} setIsFormOpen={setIsVolunteerFormOpen} userRole={userProfile.role} leaderDepartmentId={userProfile.department_id} activeEvent={eventForSidebar} onDataChange={refetchUserData} />;
            case 'departments':
                // FIX: Pass the single leaderDepartmentId to DepartmentsPage.
                return <DepartmentsPage userRole={userProfile.role} leaderDepartmentId={userProfile.department_id} leaders={leaders} onLeadersChange={fetchLeaders} />;
            case 'events':
                 return <SchedulesPage isFormOpen={isEventFormOpen} setIsFormOpen={setIsEventFormOpen} userRole={userProfile.role} leaderDepartmentId={userProfile.department_id} onDataChange={refetchNotificationCount} />;
            case 'calendar':
                // FIX: Pass the single leaderDepartmentId to CalendarPage.
                return <CalendarPage userRole={userProfile.role} leaderDepartmentId={userProfile.department_id} onDataChange={refetchNotificationCount} setIsSidebarOpen={setIsSidebarOpen} />;
            case 'admin':
                return <AdminPage />;
            case 'frequency':
                return <FrequencyPage leaders={leaders} />;
            case 'notifications':
                return <NotificationsPage session={session} onDataChange={refetchNotificationCount} onNavigate={handleNavigate} />;
            case 'my-profile':
                // FIX: Pass the 'leaders' prop to UserProfilePage to satisfy its prop requirements.
                return <UserProfilePage session={session} onUpdate={refetchUserData} leaders={leaders} />;
            case 'dashboard':
            default:
                if (userProfile.role === 'admin') {
                    return <AdminDashboard onDataChange={refetchNotificationCount} activeEvent={eventForSidebar} onNavigate={handleNavigate} />;
                }
                // FIX: Pass the updated userProfile (with single department_id) to LeaderDashboard.
                return <LeaderDashboard userProfile={userProfile} activeEvent={eventForSidebar} onNavigate={handleNavigate} />;
        }
    };

    // If API keys are not configured, show the configuration page.
    if (!areApiKeysConfigured) {
        return <ApiConfigPage />;
    }
    
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-slate-50" aria-live="polite" aria-busy="true">
                <div 
                    className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"
                    role="status"
                >
                   <span className="sr-only">Carregando...</span>
                </div>
                <p className="mt-4 text-lg font-semibold text-slate-700">Carregando...</p>
            </div>
        );
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
                    canInstallPwa={!!installPromptEvent || (isIOS && !isStandalone)}
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
                <IOSInstallPromptModal
                    isOpen={isIOSInstallPromptOpen}
                    onClose={() => setIsIOSInstallPromptOpen(false)}
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