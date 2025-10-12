import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import UserProfilePage from './components/UserProfilePage';
import NotificationsPage from './components/NotificationsPage';
import NotificationToast, { Notification as ToastNotification } from './components/NotificationToast';
import PushNotificationModal from './components/PushNotificationModal';
import PermissionDeniedPage from './components/PermissionDeniedPage';
import { Page, AuthView } from './types';
import { supabase } from './lib/supabaseClient';
import { type Session } from '@supabase/supabase-js';
import { getErrorMessage } from './lib/utils';

interface UserProfileState {
  role: string | null;
  department_id: number | null;
  volunteer_id: number | null;
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
};

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

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [activePage, setActivePage] = useState<Page>(getPageFromHash());
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isVolunteerFormOpen, setIsVolunteerFormOpen] = useState(false);
  const [isEventFormOpen, setIsEventFormOpen] = useState(false);
  const [authView, setAuthView] = useState<AuthView>(getInitialAuthView());
  const [isRegistering, setIsRegistering] = useState(getInitialAuthView() === 'accept-invite');
  const [isUserDisabled, setIsUserDisabled] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfileState | null>(null);
  const [notifications, setNotifications] = useState<ToastNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pushPermissionStatus, setPushPermissionStatus] = useState<string | null>(null);
  const [isPushPromptOpen, setIsPushPromptOpen] = useState(false);

  const hasPermission = useMemo(() => {
    if (!userProfile?.role) {
        // If there's no profile/role, permission cannot be granted.
        return false;
    }
    const normalizedRole = userProfile.role === 'lider' ? 'leader' : userProfile.role;
    const allowedRolesForPage = pagePermissions[activePage];
    return allowedRolesForPage && allowedRolesForPage.includes(normalizedRole);
  }, [userProfile, activePage]);

  const fetchCoreData = useCallback(async (currentSession: Session) => {
    try {
        // 1. Check for disabled status
        const userStatus = currentSession.user.user_metadata?.status;
        if (userStatus === 'Inativo') {
            setIsUserDisabled(true);
            setUserProfile(null);
            return;
        }
        setIsUserDisabled(false);

        // 2. Fetch user profile (role, department_id, etc.)
        const userRole = currentSession.user.user_metadata?.role;
        if (!userRole) {
            console.error("User role not found in metadata.");
            setUserProfile(null);
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
            };
        }
        setUserProfile(profile);

        // 3. Fetch global data (like unread notifications count)
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
  
  const handleRegistrationComplete = useCallback(() => {
    setIsRegistering(false);
    // After registration is complete, we can allow session updates and fetch the new session.
    supabase.auth.getSession().then(({ data }) => {
        setSession(data.session);
    });
    // Navigate to the dashboard. App.tsx will see the new session and render the dashboard.
    window.location.hash = '#/dashboard';
  }, []);

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
  
  const refetchUserData = useCallback(() => {
    if (session) {
        setIsLoading(true);
        fetchCoreData(session);
    }
  }, [session, fetchCoreData]);

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (isRegistering) {
                // During registration, temporarily ignore session changes to prevent the
                // form from unmounting before it can show the success message.
                // The `onRegistrationComplete` callback will handle the final state update.
                return;
            }

            setSession(session);
            if (!session) {
                setIsLoading(false);
            }
        });

        const handleHashChange = () => {
            const newAuthView = getInitialAuthView();
            if (newAuthView === 'accept-invite') {
                setIsRegistering(true);
            }
            setActivePage(getPageFromHash());
            setAuthView(newAuthView);
        };

        window.addEventListener('hashchange', handleHashChange, false);
        return () => {
            subscription.unsubscribe();
            window.removeEventListener('hashchange', handleHashChange, false);
        };
    }, [isRegistering]); // Re-subscribe if isRegistering changes
    
    useEffect(() => {
        // This effect runs whenever the session changes to fetch the user profile.
        if (session) {
            setIsLoading(true); // Re-enter loading state to fetch profile for new session
            fetchCoreData(session);
        } else {
            // Clear user-specific data on logout
            setUserProfile(null);
            setIsUserDisabled(false);
        }
    }, [session, fetchCoreData]);

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
                    return <VolunteerDashboard session={session} />;
            }
        }

        // Admin and Leader pages
        switch (activePage) {
            case 'volunteers':
                return <VolunteersPage isFormOpen={isVolunteerFormOpen} setIsFormOpen={setIsVolunteerFormOpen} userRole={userProfile.role} />;
            case 'departments':
                return <DepartmentsPage userRole={userProfile.role} leaderDepartmentId={userProfile.department_id} />;
            case 'events':
                 return <EventsPage isFormOpen={isEventFormOpen} setIsFormOpen={setIsEventFormOpen} userRole={userProfile.role} leaderDepartmentId={userProfile.department_id} />;
            case 'calendar':
                return <CalendarPage userRole={userProfile.role} leaderDepartmentId={userProfile.department_id} onDataChange={refetchNotificationCount} setIsSidebarOpen={setIsSidebarOpen} />;
            case 'admin':
                return userProfile.role === 'admin' ? <AdminPage onDataChange={refetchNotificationCount} /> : <Dashboard />;
            case 'notifications':
                return <NotificationsPage session={session} onDataChange={refetchNotificationCount} onNavigate={handleNavigate} />;
            case 'my-profile':
                return <UserProfilePage session={session} onUpdate={refetchUserData} />;
            case 'dashboard':
            default:
                return <Dashboard />;
        }
    };
    
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

    if (isUserDisabled) {
        return <DisabledUserPage userRole={userProfile?.role ?? null} />;
    }

    // Full-screen permission check, runs after all data is loaded.
    if (!hasPermission) {
        return <PermissionDeniedPage onNavigate={handleNavigate} />;
    }
    
    return (
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
            />
            <div className="flex-1 flex flex-col min-w-0">
                {activePage !== 'calendar' && <Header onMenuClick={() => setIsSidebarOpen(true)} />}
                <main className={`flex-1 bg-slate-50 ${activePage === 'calendar' ? 'p-0 lg:p-6' : 'p-6'}`}>
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