// src/App.tsx (ou onde quer que seja o seu componente principal de layout)

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import VolunteersPage from './components/VolunteersPage';
import DepartmentsPage from './components/DepartmentsPage';
// FIX: Corrected import name from SchedulesPage to EventsPage to match the component.
import EventsPage from './components/SchedulesPage'; // Mantenha o nome original se o arquivo se chama SchedulesPage
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

// ---- MUDANÇA 1: Importar o cliente frontend correto ----
// Certifique-se que o caminho está correto para o seu projeto.
// Se você renomeou para supabaseFrontend.ts, use esse nome.
import { supabaseFrontend } from './lib/supabaseFrontend'; 

import { type Session } from '@supabase/supabase-js';
import { getErrorMessage } from './lib/utils';

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

const VAPID_PUBLIC_KEY = 'BLENBc_aqRf1ndkS5ssPQTsZEkMeoOZvtKVYfe2fubKnz_Sh4CdrlzZwn--W37YrloW4841Xg-97v_xoX-xQmQk'; // Lembre-se de configurá-la também como variável de ambiente se for sensível.

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

  // ---- MUDANÇA 2: Ajuste na lógica de permissão ----
  // A permissão agora depende de userProfile e activePage estarem prontos.
  const hasPermission = useMemo(() => {
    // Se ainda estamos carregando ou o perfil não foi carregado, não podemos determinar a permissão.
    if (isLoading || !userProfile) return false;
    
    // Se o usuário estiver desativado, ele não tem permissão para ver páginas normais.
    if (isUserDisabled) return false;
    
    if (!userProfile.role) { // Caso raro, mas pode acontecer se o perfil estiver incompleto.
        console.warn("User role not found in profile state, assuming no permission.");
        return false;
    }

    // Normaliza o role para garantir compatibilidade (ex: 'lider' para 'leader')
    const normalizedRole = userProfile.role === 'lider' ? 'leader' : userProfile.role;
    const allowedRolesForPage = pagePermissions[activePage];

    // Verifica se a página existe nas permissões e se o papel do usuário está na lista permitida.
    return allowedRolesForPage ? allowedRolesForPage.includes(normalizedRole) : false;
  }, [userProfile, activePage, isLoading, isUserDisabled]); // Adicionado isLoading e isUserDisabled às dependências

  // ---- MUDANÇA 3: Usar supabaseFrontend para todas as chamadas Supabase ----
  const fetchCoreData = useCallback(async (currentSession: Session) => {
    try {
        const userStatus = currentSession.user.user_metadata?.status;
        const userRole = currentSession.user.user_metadata?.role;

        if (userStatus === 'Inativo') {
            setIsUserDisabled(true);
            setUserProfile({ role: userRole, department_id: null, volunteer_id: null, status: 'Inativo' });
            // setIsLoading(false); // Removido - O efeito principal de sessão cuidará do isLoading.
            return;
        }
        setIsUserDisabled(false); // Garante que se o status mudar para Ativo, isso seja resetado.

        if (!userRole) {
            console.error("User role not found in metadata.");
            setUserProfile(null);
            return;
        }
        
        if (userStatus === 'Pendente') {
             setUserProfile({ role: userRole, status: 'Pendente', department_id: null, volunteer_id: null });
             return;
        }

        let profile: UserProfileState | null = null;
        if (userRole === 'volunteer') {
            // Usando supabaseFrontend para acessar dados do Supabase
            const { data: volunteerData, error: volunteerError } = await supabaseFrontend
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
            // Usando supabaseFrontend para acessar dados do Supabase
            const { data: profileData, error: profileError } = await supabaseFrontend
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
        // Usando supabaseFrontend
        const { count } = await supabaseFrontend
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', currentSession.user.id)
            .eq('is_read', false);
        setUnreadCount(count ?? 0);

    } catch (err) {
        console.error("Error fetching core user data:", getErrorMessage(err));
        setUserProfile(null); // Clear profile on error
        setIsUserDisabled(false); // Reset disabled status if there's an error fetching profile
    } finally {
        // Signal that all initial data loading is complete, REGARDLESS of success or failure in fetching profile.
        // The UI will then render based on the final state (e.g., show login, disabled page, or permission denied).
        setIsLoading(false);
    }
  }, []); // fetchCoreData não depende de `session` diretamente, mas é chamado com ela.

  // Refetched user data when session exists and user ID changes
  const refetchUserData = useCallback(() => {
    if (session) {
        setIsLoading(true); // Start loading when refetching
        fetchCoreData(session);
    } else {
        // If session is null, we are logged out, so not loading and profile should be null.
        setIsLoading(false);
        setUserProfile(null);
        setIsUserDisabled(false);
    }
  }, [session, fetchCoreData]);
  
  const handleRegistrationComplete = useCallback(() => {
    // After registration, user status is 'Ativo'. We just need to refetch the profile data.
    refetchUserData();
    // Redirect to dashboard after successful registration and profile update.
    window.location.hash = '#/dashboard';
  }, [refetchUserData]);

  const refetchNotificationCount = useCallback(async () => {
    if (session) {
      // Usando supabaseFrontend
      const { count } = await supabaseFrontend
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
        // Listen for authentication state changes (login, logout, token refresh)
        const { data: { subscription } } = supabaseFrontend.auth.onAuthStateChange((_event, newSession) => {
            setSession(newSession);
            // If session becomes null (logout), we should stop loading and reset profile.
            if (!newSession) {
                setIsLoading(false); // Stop loading as the user is logged out
                setUserProfile(null);
                setIsUserDisabled(false); // Reset disabled status
                lastUserId.current = null; // Reset last user ID
            }
            // Note: fetchCoreData is called in another effect based on session changes.
        });

        // Handle navigation via URL hash changes
        const handleHashChange = () => {
            setActivePage(getPageFromHash());
            setAuthView(getInitialAuthView());
        };

        window.addEventListener('hashchange', handleHashChange, false);
        
        // Cleanup subscription and event listener
        return () => {
            subscription.unsubscribe();
            window.removeEventListener('hashchange', handleHashChange, false);
        };
    }, []);
    
    useEffect(() => {
        // This effect runs whenever the session state changes.
        // It triggers refetching core data only if the user ID is different,
        // to avoid unnecessary reloads on token refreshes.
        if (session) {
            if (session.user.id !== lastUserId.current) {
                lastUserId.current = session.user.id;
                setIsLoading(true); // Indicate loading state when fetching user-specific data
                fetchCoreData(session);
            } else {
                 // If the session user ID hasn't changed but session object itself did (e.g. token refresh),
                 // we might still want to refetch notifications or other counts if they are session-dependent.
                 // For simplicity, we'll assume fetchCoreData covers most, and refetchNotificationCount can be called here if needed.
                 // console.log("Session updated, but user ID same. Potentially a token refresh.");
                 // refetchNotificationCount(); // Uncomment if you need to refresh counts on token refresh
            }
        } else {
            // User has logged out. Ensure loading is false and profile is cleared.
            // This is also handled by the onAuthStateChange listener, but good for redundancy.
            setIsLoading(false);
            setUserProfile(null);
            setIsUserDisabled(false);
            lastUserId.current = null;
        }
    }, [session, fetchCoreData]); // Added fetchCoreData to dependencies for clarity

    useEffect(() => {
        // Prompt for push notifications after login if permission is 'default' and user is eligible
        if (!isLoading && userProfile) {
            const isEligibleForPush = userProfile.role === 'leader' || userProfile.role === 'lider' || userProfile.role === 'volunteer';
            if (isEligibleForPush && pushPermissionStatus === 'default' && !sessionStorage.getItem('pushPromptedThisSession')) {
                // Delay slightly to ensure UI is stable before showing modal
                setTimeout(() => {
                    setIsPushPromptOpen(true);
                    sessionStorage.setItem('pushPromptedThisSession', 'true'); // Mark as prompted for this session
                }, 1000);
            }
        }
    }, [isLoading, userProfile, pushPermissionStatus]); // Dependencies for this effect

    const subscribeToPushNotifications = async () => {
        // Use supabaseFrontend for invoking functions
        if ('serviceWorker' in navigator && 'PushManager' in window && session) {
            try {
                const registration = await navigator.serviceWorker.ready;
                const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
                });

                // Use supabaseFrontend to invoke functions
                const { error } = await supabaseFrontend.functions.invoke('save-push-subscription', {
                    body: { subscription },
                });

                if (error) throw error;

                setPushPermissionStatus('granted');
                setNotifications(prev => [...prev, { id: Date.now(), message: 'Notificações ativadas!', type: 'success' }]);

            } catch (err: any) {
                console.error('Failed to subscribe to push notifications:', getErrorMessage(err));
                setPushPermissionStatus('denied');
                setNotifications(prev => [...prev, { id: Date.now(), message: 'Falha ao ativar notificações.', type: 'warning' }]);
            }
        }
        setIsPushPromptOpen(false);
    };

    const handleNavigate = useCallback((page: Page) => {
        setActivePage(page);
        window.location.hash = `#/${page}`;
        setIsSidebarOpen(false);
    }, []); // Dependencies are empty as it doesn't use external state
    
    const handleNewVolunteer = useCallback(() => {
        handleNavigate('volunteers');
        setIsVolunteerFormOpen(true);
    }, [handleNavigate]); // Depends on handleNavigate

    const handleNewEvent = useCallback(() => {
        handleNavigate('events');
        setIsEventFormOpen(true);
    }, [handleNavigate]); // Depends on handleNavigate

    const removeNotification = useCallback((id: number) => {
        setNotifications(notifications => notifications.filter(n => n.id !== id));
    }, []); // Dependencies are empty

    const renderPage = useCallback(() => {
        // Render loading state first, then auth, then permission checks, then content.
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
            // Ensure userProfile is available and status is 'Pendente'
            return <AcceptInvitationPage setAuthView={setAuthView} onRegistrationComplete={handleRegistrationComplete} />;
        }

        if (isUserDisabled) {
            return <DisabledUserPage userRole={userProfile?.role ?? null} />;
        }

        // Full-screen permission check, runs after all data is loaded and user status is confirmed as not 'Pendente'.
        if (!hasPermission) {
            return <PermissionDeniedPage onNavigate={handleNavigate} />;
        }
        
        // If all checks pass, render the main page content.
        // Conditional rendering based on role for different page layouts.
        if (userProfile?.role === 'volunteer') {
             switch (activePage) {
                case 'my-profile':
                    // Pass session for profile data, onUpdate for refetching.
                    return <VolunteerProfile session={session} onUpdate={refetchUserData} />;
                case 'notifications':
                    // Pass session, onDataChange for refetching count, onNavigate for internal routing.
                    return <NotificationsPage session={session} onDataChange={refetchNotificationCount} onNavigate={handleNavigate} />;
                case 'dashboard':
                default:
                    return <VolunteerDashboard session={session} />;
            }
        }

        // Admin and Leader pages
        switch (activePage) {
            case 'volunteers':
                // Pass form states, user role, and department ID for filtering.
                return <VolunteersPage isFormOpen={isVolunteerFormOpen} setIsFormOpen={setIsVolunteerFormOpen} userRole={userProfile?.role ?? 'unknown'} leaderDepartmentId={userProfile?.department_id ?? null} />;
            case 'departments':
                // Pass user role and department ID.
                return <DepartmentsPage userRole={userProfile?.role ?? 'unknown'} leaderDepartmentId={userProfile?.department_id ?? null} />;
            case 'events':
                 // Pass form states, user role, and department ID for filtering.
                 return <EventsPage isFormOpen={isEventFormOpen} setIsFormOpen={setIsEventFormOpen} userRole={userProfile?.role ?? 'unknown'} leaderDepartmentId={userProfile?.department_id ?? null} />;
            case 'calendar':
                // Pass role, department ID, and functions for data changes/sidebar control.
                return <CalendarPage userRole={userProfile?.role ?? 'unknown'} leaderDepartmentId={userProfile?.department_id ?? null} onDataChange={refetchNotificationCount} setIsSidebarOpen={setIsSidebarOpen} />;
            case 'admin':
                // Only show AdminPage if user is admin, otherwise redirect to Dashboard.
                return userProfile?.role === 'admin' ? <AdminPage onDataChange={refetchNotificationCount} /> : <Dashboard />;
            case 'notifications':
                // Same as volunteer notifications.
                return <NotificationsPage session={session} onDataChange={refetchNotificationCount} onNavigate={handleNavigate} />;
            case 'my-profile':
                // Pass session and update function.
                return <UserProfilePage session={session} onUpdate={refetchUserData} />;
            case 'dashboard':
            default:
                return <Dashboard />;
        }
    }, [isLoading, session, authView, userProfile, isUserDisabled, hasPermission, activePage, isSidebarOpen, isVolunteerFormOpen, isEventFormOpen, notifications, unreadCount, pushPermissionStatus, isPushPromptOpen, lastUserId, fetchCoreData, refetchUserData, handleRegistrationComplete, refetchNotificationCount, subscribeToPushNotifications, handleNavigate, handleNewVolunteer, handleNewEvent, removeNotification]); // All state and callbacks that affect render

    // --- Renderização Principal ---
    // Se isLoading for true, renderPage() já retorna o spinner.
    // Renderiza os toasts e o modal de push notification fora do fluxo principal de renderização de página.
    return (
        <>
            {/* Renderiza a página principal, autenticação, permissão negada, etc. */}
            {renderPage()}
            
            {/* Toasts e Modals são renderizados aqui, para estarem sempre presentes se necessário. */}
            {/* Renderiza os toasts de notificação se houver algum */}
            <div className="fixed top-4 right-4 z-[9999] space-y-2">
                {notifications.map(n => (
                    <NotificationToast key={n.id} notification={n} onClose={removeNotification} />
                ))}
            </div>
            
            {/* Modal de prompt de notificação push */}
            {isPushPromptOpen && ( // Renderiza o modal apenas se o estado for true
                <PushNotificationModal
                    isOpen={isPushPromptOpen}
                    onClose={() => setIsPushPromptOpen(false)}
                    onConfirm={subscribeToPushNotifications}
                />
            )}
        </>
    );
};

export default App;