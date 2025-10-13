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
import { Page, AuthView } from './types';
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

// CORREÇÃO 2: Incluir explicitamente 'lider' na lista de permissões
// para garantir que líderes logados tenham acesso.
const pagePermissions: Record<Page, string[]> = {
    'dashboard': ['admin', 'leader', 'lider', 'volunteer'],
    'notifications': ['leader', 'lider', 'volunteer'],
    'my-profile': ['admin', 'leader', 'lider', 'volunteer'],
    'volunteers': ['admin', 'leader', 'lider'],
    'departments': ['admin'],
    'events': ['admin', 'leader', 'lider'],
    'calendar': ['admin', 'leader', 'lider'],
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
    const lastUserId = useRef<string | null>(null);
    
    // CORREÇÃO 1: Usar import.meta.env para acessar a chave VAPID.
    const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY!;

    const hasPermission = useMemo(() => {
        if (!userProfile?.role) {
            return false;
        }
        // Normalize o papel para inglês (leader) ou mantenha (lider) se a permissão foi definida com ambos.
        // Já que pagePermissions agora inclui 'lider', basta checar o role original.
        const allowedRolesForPage = pagePermissions[activePage];
        // Checa se o papel do usuário (ex: 'lider' ou 'admin') está na lista de permissões da página.
        return allowedRolesForPage && allowedRolesForPage.includes(userProfile.role);
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

    useEffect(() => {
        // Initialize push notification permission status
        if ('Notification' in window && 'PushManager' in window) {
            setPushPermissionStatus(Notification.permission);
        }
    }, []);

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
            // CORREÇÃO: Já que pagePermissions inclui 'lider', a checagem aqui pode ser mais simples ou manter a redundância.
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
    // Esta checagem agora inclui o role 'lider' graças à atualização no pagePermissions.
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
