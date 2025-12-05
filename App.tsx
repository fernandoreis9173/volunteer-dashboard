
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
// import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './lib/queryClient';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import LeaderDashboard from './components/LeaderDashboard';
import VolunteersPage from './components/VolunteersPage';
import DepartmentsPage from './components/DepartmentsPage';
// FIX: Corrected import name from SchedulesPage to EventsPage to match the component.
import SchedulesPage from './components/SchedulesPage';
import CalendarPage from './components/CalendarPage';
import AdminPage from './components/AdminPage';
import AdminNotificationsPage from './components/AdminNotificationsPage';
import AdminDashboard from './components/AdminDashboard';
import FrequencyPage from './components/FrequencyPage';
import LoginPage from './components/LoginPage';
import { AcceptInvitationPage } from './components/AcceptInvitationPage';
import ResetPasswordPage from './components/ResetPasswordPage';
import DisabledUserPage from './components/DisabledUserPage';
import VolunteerDashboard from './components/VolunteerDashboard';
import AttendanceHistoryPage from './components/AttendanceHistoryPage';
import VolunteerProfile from './components/VolunteerProfile';
// FIX: UserProfilePage is a default export, not a named export.
import UserProfilePage from './components/UserProfilePage';
import NotificationsPage from './components/NotificationsPage';
import NotificationToast, { Notification as ToastNotification } from './components/NotificationToast';
import PushNotificationModal from './components/PushNotificationModal';
import IOSInstallPromptModal from './components/IOSInstallPromptModal';
import PermissionDeniedPage from './components/PermissionDeniedPage';
import ApiConfigPage from './components/ApiConfigPage'; // Import the config page
import TimelinesPage from './components/TimelinesPage';
import RankingPage from './components/RankingPage'; // Import the new RankingPage
import LgpdConsentPage from './components/LgpdConsentPage'; // Importar a página de consentimento LGPD
import SplashScreen from './components/SplashScreen'; // Import SplashScreen
import WhatsAppSettingsPage from './components/WhatsAppSettingsPage'; // Import WhatsApp Settings Page
import GeneralSettingsPage from './components/GeneralSettingsPage'; // Import General Settings Page
import ChatPage from './components/ChatPage'; // Import Chat Page
// FIX: To avoid a name collision with the DOM's `Event` type, the app's event type is aliased to `AppEvent`.
// FIX: Import EnrichedUser type to correctly type users from `list-users` function.
import { Page, AuthView, type NotificationRecord, type Event as AppEvent, type DetailedVolunteer, type EnrichedUser } from './types';
import { supabase } from './lib/supabaseClient';
// FIX: Restored Supabase v2 types to ensure type safety.
import { type Session, type User } from '@supabase/supabase-js';
import { getErrorMessage, convertUTCToLocal } from './lib/utils';
import { useTodaysEvents, useUnreadNotificationsCount } from './hooks/useQueries';

// FIX: Cast `import.meta` to `any` to access Vite environment variables without TypeScript errors.
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
    lgpd_accepted: boolean | null;
}

const pagePermissions: Record<Page, string[]> = {
    'dashboard': ['admin', 'leader', 'volunteer'],
    'history': ['volunteer'],
    'notifications': ['leader', 'volunteer'],
    'my-profile': ['admin', 'leader', 'volunteer'],
    'volunteers': ['admin', 'leader'],
    'ranking': ['admin', 'leader', 'volunteer'],
    'departments': ['admin'],
    'events': ['admin', 'leader'],
    'timelines': ['admin'],
    'calendar': ['admin', 'leader'],
    'frequency': ['admin'],
    'admin': ['admin'],
    'whatsapp-settings': ['admin'],
    'general-settings': ['admin'],
    'chat': ['admin', 'leader'],
};

const getInitialAuthView = (): AuthView => {
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) return 'reset-password';
    if (hash.includes('type=invite')) return 'accept-invite';
    return 'login';
};

const getPageFromHash = (): Page => {
    const hash = window.location.hash.slice(2);
    const validPages: Page[] = ['dashboard', 'volunteers', 'departments', 'events', 'calendar', 'my-profile', 'notifications', 'frequency', 'admin', 'history', 'timelines', 'ranking', 'whatsapp-settings', 'general-settings', 'chat'];
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

const getInitialTheme = (): 'light' | 'dark' => {
    if (typeof window !== 'undefined' && window.localStorage) {
        const storedPrefs = window.localStorage.getItem('theme');
        if (storedPrefs === 'light' || storedPrefs === 'dark') {
            return storedPrefs;
        }
        const userMedia = window.matchMedia('(prefers-color-scheme: dark)');
        if (userMedia.matches) {
            return 'dark';
        }
    }
    return 'light'; // default
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
    const [theme, setTheme] = useState(getInitialTheme());
    const [adminSubPage, setAdminSubPage] = useState<'users' | 'notifications'>('users');

    // VAPID key is now hardcoded for production
    const VAPID_PUBLIC_KEY = 'BLENBc_aqRf1ndkS5ssPQTsZEkMeoOZvtKVYfe2fubKnz_Sh4CdrlzZwn--W37YrloW4841Xg-97v_xoX-xQmQk';

    // Optimization: Derive userId to stabilize dependencies and prevent re-fetches on token refresh
    const userId = session?.user?.id;

    // Use optimized hook for instant notification count loading
    const { data: unreadCount = 0 } = useUnreadNotificationsCount(userId || '');

    const isIOS = useMemo(() => /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream, []);
    const isStandalone = useMemo(() => ('standalone' in window.navigator && (window.navigator as any).standalone) || window.matchMedia('(display-mode: standalone)').matches, []);
    const isUserDisabled = useMemo(() => userProfile?.status === 'Inativo', [userProfile]);

    // --- NEW: Force reload on Service Worker Update ---
    /*
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                console.log('Service Worker controller changed. Reloading page...');
                window.location.reload();
            });
        }
    }, []);
    */
    // ---------------------------------------------------

    useEffect(() => {
        const isVolunteer = userProfile?.role === 'volunteer';

        // Only apply theme if user is a volunteer
        if (isVolunteer) {
            if (theme === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
            localStorage.setItem('theme', theme);
        } else {
            // If not a volunteer, ensure light mode and clear storage
            document.documentElement.classList.remove('dark');
            localStorage.removeItem('theme');
        }
    }, [theme, userProfile?.role]);

    const toggleTheme = useCallback(() => {
        setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
    }, []);

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
            const metadataRole = currentSession.user.user_metadata?.role;

            // Fetch LGPD status and role from the 'profiles' table for all users.
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('lgpd_accepted, role')
                .eq('id', currentSession.user.id)
                .single();

            if (profileError && profileError.code !== 'PGRST116') { // Ignore "row not found" error
                console.error("Error fetching profile for LGPD check:", getErrorMessage(profileError));
                // CRITICAL FIX: If fetch fails (e.g. network error), DO NOT proceed.
                // Proceeding would default lgpd_accepted to false, causing the screen to reappear.
                // By returning here, we keep the previous state (if any) or stay in loading state.
                return;
            }

            const lgpdAccepted = profileData?.lgpd_accepted ?? false;
            // Prioritize role from DB, fallback to metadata
            const userRole = profileData?.role || metadataRole;

            if (userStatus === 'Inativo') {
                setUserProfile({ role: userRole, department_id: null, volunteer_id: null, status: 'Inativo', lgpd_accepted: lgpdAccepted });
                setIsLoading(false);
                return;
            }

            if (!userRole) {
                console.error("User role not found in metadata or database.");
                setUserProfile(null);
                return;
            }

            if (userStatus === 'Pendente') {
                setUserProfile({ role: userRole, status: 'Pendente', department_id: null, volunteer_id: null, lgpd_accepted: lgpdAccepted });
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
                    lgpd_accepted: lgpdAccepted
                };

            } else { // Admin/Leader
                const { data: leaderDept, error: leaderDeptError } = await supabase
                    .from('department_leaders')
                    .select('department_id')
                    .eq('user_id', currentSession.user.id)
                    .maybeSingle();

                if (leaderDeptError) {
                    console.error("Error fetching admin/leader department:", getErrorMessage(leaderDeptError));
                }

                profile = {
                    role: userRole,
                    department_id: leaderDept?.department_id || null,
                    volunteer_id: null,
                    status: userStatus,
                    lgpd_accepted: lgpdAccepted
                };
            }
            setUserProfile(profile);
        } catch (err) {
            console.error("Error fetching core user data:", getErrorMessage(err));
            setUserProfile(null);
        } finally {
            setIsLoading(false);
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
        refetchUserData();
        // A navegação para o dashboard será bloqueada pela verificação da LGPD
    }, [refetchUserData]);

    const refetchNotificationCount = useCallback(() => {
        // Invalidate the notifications cache to trigger a refetch
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }, []);

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
        if (!userId) {
            setLeaders([]);
            return;
        }
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
    }, [userId]);

    useEffect(() => {
        fetchLeaders();
    }, [fetchLeaders]);

    // Helper variables to stabilize dependencies for the fetch callback
    const userRole = userProfile?.role;
    const userDepartmentId = userProfile?.department_id;
    const userVolunteerId = userProfile?.volunteer_id;

    // REFACTORED: Use React Query for Today's Events to ensure sync with other components
    const { data: todaysEventsData = [] } = useTodaysEvents(
        userId || '',
        userRole || '',
        userDepartmentId,
        userVolunteerId
    );

    const todaysEvents = useMemo(() => {
        return (todaysEventsData as unknown as AppEvent[]) || [];
    }, [todaysEventsData]);

    // REFACTORED: Check Local Logic - Runs every minute using cached data (No DB hits)
    const checkActiveEventLocally = useCallback(() => {
        if (todaysEvents.length === 0) {
            setActiveEvent(null);
            return;
        }

        const now = new Date();
        const liveEvent = todaysEvents.find(event => {
            const { dateTime: startDateTime, isValid: startIsValid } = convertUTCToLocal(event.date, event.start_time);
            const { dateTime: endDateTime, isValid: endIsValid } = convertUTCToLocal(event.date, event.end_time);

            if (!startIsValid || !endIsValid || !startDateTime || !endDateTime) {
                return false;
            }

            if (endDateTime < startDateTime) {
                endDateTime.setDate(endDateTime.getDate() + 1);
            }

            // QR Code disponível: do início do evento até 10 minutos após o fim
            const toleranceAfter = 10 * 60 * 1000;  // 10 minutes
            return now.getTime() >= startDateTime.getTime() && now.getTime() <= (endDateTime.getTime() + toleranceAfter);
        });

        setActiveEvent(liveEvent || null);
    }, [todaysEvents]);

    // Effect 1: Removed manual fetch effect as useTodaysEvents handles it
    // useEffect(() => {
    //    if (!userId) return;
    //    fetchTodaysEvents();
    // }, [userId, fetchTodaysEvents]);

    // Effect 2: Check local time against cached data frequently (e.g., every 1 minute)
    // This is cheap CPU calculation, does NOT hit the database.
    useEffect(() => {
        checkActiveEventLocally();
        const interval = setInterval(checkActiveEventLocally, 60000); // 1 minute check (Local only)
        return () => clearInterval(interval);
    }, [checkActiveEventLocally]);

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
            setAuthView(prevAuthView => {
                const newAuthView = getInitialAuthView();
                // This is the race condition fix: Supabase auto-signs-in the user with the recovery/invite token,
                // then it cleans the URL hash. The hash change triggers this handler, which would
                // incorrectly set the view to 'login', kicking the user out of the flow.
                // This check prevents that from happening. The auth flow components (AcceptInvitationPage,
                // ResetPasswordPage) are responsible for navigation when they are done.
                if ((prevAuthView === 'reset-password' || prevAuthView === 'accept-invite') && newAuthView === 'login') {
                    return prevAuthView; // Keep the current auth view
                }
                return newAuthView; // Otherwise, update to the new view from the URL
            });
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
        // Handles initial redirect and post-login actions.
        // This should NOT run if the user is in the middle of a special auth flow.
        if (session && userProfile && !hasLoginRedirected.current && authView !== 'accept-invite' && authView !== 'reset-password') {
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
    }, [session, userProfile, handleNavigate, pushPermissionStatus, authView]);

    // Real-time notifications subscription
    // OTIMIZADO: Realtime de notificações só quando app está visível e em páginas relevantes
    useEffect(() => {
        if (!session?.user?.id) {
            return;
        }

        // Páginas onde Realtime é útil (notificações em tempo real)
        const realtimePages = ['notifications', 'dashboard'];
        const shouldConnect = realtimePages.includes(activePage);

        if (!shouldConnect) {
            return; // Não conecta Realtime em outras páginas
        }

        // Só conecta se app estiver visível (não em background)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                supabase.removeChannel(channel);
            } else if (document.visibilityState === 'visible') {
                channel.subscribe();
            }
        };

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
                            type: 'info',
                        },
                    ]);

                    // Refetch unread count to update the sidebar badge
                    refetchNotificationCount();
                }
            )
            .subscribe();

        // Listener para detectar quando app vai para background
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            supabase.removeChannel(channel);
        };

    }, [session, refetchNotificationCount, activePage]);

    // OTIMIZADO: Realtime de status do voluntário - Substituído por polling a cada 60s
    // (Mudanças de status são raras, não precisa de Realtime constante)
    useEffect(() => {
        if (!session?.user?.id || userProfile?.role !== 'volunteer') {
            return;
        }

        // Polling a cada 60 segundos, só quando app está visível
        const checkStatusUpdate = async () => {
            if (document.visibilityState === 'visible') {
                try {
                    const { data } = await supabase
                        .from('volunteers')
                        .select('status')
                        .eq('user_id', session.user.id)
                        .single();

                    if (data && userProfile && data.status !== userProfile.status) {
                        if (data.status === 'Inativo') {
                            setUserProfile(prev => prev ? { ...prev, status: 'Inativo' } : null);
                        } else if (data.status === 'Ativo') {
                            refetchUserData();
                        }
                    }
                } catch (error) {
                    console.error('Error checking volunteer status:', error);
                }
            }
        };

        // Verificar imediatamente
        checkStatusUpdate();

        // Depois verificar a cada 60 segundos
        const interval = setInterval(checkStatusUpdate, 60000);

        return () => {
            clearInterval(interval);
        };
    }, [session?.user?.id, userProfile?.role, userProfile?.status, refetchUserData, setUserProfile]);

    // OTIMIZADO: Realtime de departamentos do líder - Substituído por polling a cada 60s
    // (Mudanças de departamento são raras, não precisa de Realtime constante)
    useEffect(() => {
        if (!session?.user?.id || (userProfile?.role !== 'leader' && userProfile?.role !== 'lider')) {
            return;
        }

        // Polling a cada 60 segundos, só quando app está visível
        const checkDepartmentChanges = async () => {
            if (document.visibilityState === 'visible') {
                try {
                    const { data } = await supabase
                        .from('department_leaders')
                        .select('department_id')
                        .eq('user_id', session.user.id);

                    // Se houver mudança, refetch user data
                    if (data && userProfile?.department_id) {
                        const currentDeptId = data[0]?.department_id;
                        if (currentDeptId !== userProfile.department_id) {
                            console.log('Detected a change in leader department assignments. Refetching user data...');
                            refetchUserData();
                        }
                    }
                } catch (error) {
                    console.error('Error checking department changes:', error);
                }
            }
        };

        // Verificar imediatamente
        checkDepartmentChanges();

        // Depois verificar a cada 60 segundos
        const interval = setInterval(checkDepartmentChanges, 60000);

        return () => {
            clearInterval(interval);
        };
    }, [session?.user?.id, userProfile?.role, userProfile?.department_id, refetchUserData]);

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
                    // FIX: Add missing userRole prop to NotificationsPage
                    return <NotificationsPage session={session} onDataChange={refetchNotificationCount} onNavigate={handleNavigate} userRole={userProfile.role} />;
                case 'ranking':
                    return <RankingPage session={session} userProfile={userProfile} />;
                case 'dashboard':
                default:
                    // FIX: Removed `onDataChange` prop from VolunteerDashboard call. The error indicates it's not an expected prop.
                    return <VolunteerDashboard session={session} activeEvent={activeEvent} onNavigate={handleNavigate} leaders={leaders} />;
            }
        }

        // Admin and Leader pages
        switch (activePage) {
            case 'volunteers':
                // FIX: Pass the single leaderDepartmentId to VolunteersPage.
                return <VolunteersPage isFormOpen={isVolunteerFormOpen} setIsFormOpen={setIsVolunteerFormOpen} userRole={userProfile.role} leaderDepartmentId={userProfile.department_id} activeEvent={eventForSidebar} onDataChange={refetchUserData} />;
            case 'ranking':
                return <RankingPage session={session} userProfile={userProfile} />;
            case 'departments':
                // FIX: Pass the single leaderDepartmentId to DepartmentsPage.
                return <DepartmentsPage userRole={userProfile.role} leaderDepartmentId={userProfile.department_id} leaders={leaders} onLeadersChange={fetchLeaders} />;
            case 'events':
                // FIX: Pass `leaders` prop to SchedulesPage to satisfy its prop requirements.
                return <SchedulesPage isFormOpen={isEventFormOpen} setIsFormOpen={setIsEventFormOpen} userRole={userProfile.role} leaderDepartmentId={userProfile.department_id} onDataChange={refetchNotificationCount} leaders={leaders} />;
            case 'timelines':
                return <TimelinesPage />;
            case 'calendar':
                // FIX: Pass the single leaderDepartmentId to CalendarPage.
                return <CalendarPage userRole={userProfile.role} leaderDepartmentId={userProfile.department_id} onDataChange={refetchNotificationCount} setIsSidebarOpen={setIsSidebarOpen} />;
            case 'admin':
                if (adminSubPage === 'notifications') {
                    return <AdminNotificationsPage onDataChange={fetchLeaders} />;
                }
                return <AdminPage onDataChange={fetchLeaders} />;
            case 'frequency':
                // FIX: Remove unused `leaders` prop from `FrequencyPage` component call to fix type error, as the component no longer requires it.
                return <FrequencyPage />;
            case 'notifications':
                // FIX: Add missing userRole prop to NotificationsPage
                return <NotificationsPage session={session} onDataChange={refetchNotificationCount} onNavigate={handleNavigate} userRole={userProfile.role} />;
            case 'my-profile':
                // FIX: Pass the 'leaders' prop to UserProfilePage to satisfy its prop requirements.
                return <UserProfilePage session={session} onUpdate={refetchUserData} leaders={leaders} />;
            case 'whatsapp-settings':
                return <WhatsAppSettingsPage session={session} />;
            case 'general-settings':
                return <GeneralSettingsPage />;
            case 'chat':
                return <ChatPage session={session} userRole={userProfile.role} departmentId={userProfile.department_id} />;
            case 'dashboard':
            default:
                if (userProfile.role === 'admin') {
                    // FIX: Removed `onDataChange` prop from AdminDashboard call as it's unused and causes an error.
                    return <AdminDashboard activeEvent={activeEvent} onNavigate={handleNavigate} />;
                }
                // FIX: Pass the updated userProfile (with single department_id) to LeaderDashboard.
                return <LeaderDashboard userProfile={userProfile} activeEvent={activeEvent} onNavigate={handleNavigate} />;
        }
    };

    // If API keys are not configured, show the configuration page.
    if (!areApiKeysConfigured) {
        return <ApiConfigPage />;
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-slate-50 dark:bg-slate-900" aria-live="polite" aria-busy="true">
                <div
                    className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"
                    role="status"
                >
                    <span className="sr-only">Carregando...</span>
                </div>
                <p className="mt-4 text-lg font-semibold text-slate-700 dark:text-slate-300">Carregando...</p>
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

    // At this point, we have a session.
    // CRITICAL FIX: If the user is on the accept-invite URL, KEEP them there,
    // even if they now have a session. This prevents the redirect race condition.
    // The AcceptInvitationPage will handle the final sign-out and redirect.
    if (authView === 'accept-invite') {
        return <AcceptInvitationPage setAuthView={setAuthView} onRegistrationComplete={handleRegistrationComplete} />;
    }

    // **NOVO: Verificação de Redefinição de Senha**
    // Se o usuário estiver na URL de recuperação, MANTENHA-O na página de redefinição,
    // mesmo que ele já tenha uma sessão. Isso corrige a condição de corrida onde o
    // Supabase faz login automático antes que o usuário possa redefinir a senha.
    if (authView === 'reset-password') {
        return <ResetPasswordPage setAuthView={setAuthView} />;
    }

    if (!userProfile) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 p-4 dark:from-slate-900 dark:to-slate-800">
                <div className="w-full max-w-lg p-8 space-y-6 bg-white dark:bg-slate-800 rounded-2xl shadow-lg text-center">
                    <div className="flex justify-center mb-4">
                        <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300 rounded-xl flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                            </svg>
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Erro ao Carregar Perfil</h1>
                    <p className="text-slate-600 dark:text-slate-300">
                        Não foi possível carregar os dados do seu perfil. Isso pode acontecer se sua conta não estiver configurada corretamente.
                    </p>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                        Se o problema persistir, por favor, entre em contato com o administrador do sistema.
                    </p>
                    <div className="pt-4">
                        <button
                            onClick={async () => await supabase.auth.signOut()}
                            className="w-full inline-flex justify-center rounded-lg border border-transparent px-4 py-2 bg-slate-600 text-base font-semibold text-white shadow-sm hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500"
                        >
                            Sair
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (isUserDisabled) {
        return <DisabledUserPage userRole={userProfile.role} />;
    }

    if (!userProfile.lgpd_accepted) {
        return <LgpdConsentPage session={session} onConsentAccepted={refetchUserData} />;
    }

    if (!hasPermission) {
        return <PermissionDeniedPage onNavigate={handleNavigate} />;
    }

    return (
        <div className="flex h-screen bg-slate-50 text-gray-800 font-display antialiased dark:bg-slate-900 dark:text-slate-300">
            <Sidebar
                activePage={activePage}
                onNavigate={handleNavigate}
                onNewVolunteer={handleNewVolunteer}
                onNewEvent={handleNewEvent}
                isOpen={isSidebarOpen}
                setIsOpen={setIsSidebarOpen}
                userRole={userProfile.role}
                session={session}
                unreadCount={unreadCount}
                pushPermissionStatus={pushPermissionStatus}
                onSubscribeToPush={subscribeToPushNotifications}
                canInstallPwa={!!installPromptEvent || (isIOS && !isStandalone)}
                onInstallPrompt={handleInstallPrompt}
                theme={theme}
                toggleTheme={toggleTheme}
                adminSubPage={adminSubPage}
                onAdminSubPageChange={setAdminSubPage}
            />

            <div className="flex-1 flex flex-col overflow-hidden">
                {activePage !== 'chat' && <Header onMenuClick={() => setIsSidebarOpen(true)} />}
                <main className={`flex-1 overflow-x-hidden overflow-y-auto bg-slate-50 dark:bg-slate-900 ${activePage === 'calendar' ? 'p-0' : 'p-4 sm:p-6 lg:p-8'}`}>
                    {renderPage()}
                </main>
            </div>

            <div className="fixed top-4 right-4 z-[9999] w-full max-w-sm space-y-3">
                {notifications.map(notification => (
                    <NotificationToast
                        key={notification.id}
                        notification={notification}
                        onClose={removeNotification}
                    />
                ))}
            </div>

            <PushNotificationModal
                isOpen={isPushPromptOpen}
                onConfirm={subscribeToPushNotifications}
                onClose={() => setIsPushPromptOpen(false)}
            />

            <IOSInstallPromptModal
                isOpen={isIOSInstallPromptOpen}
                onClose={() => setIsIOSInstallPromptOpen(false)}
            />
        </div>
    );
};

// Envolver App com QueryClientProvider para habilitar React Query
const AppWithProviders = () => {
    const [showSplash, setShowSplash] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setShowSplash(false);
        }, 2000);

        return () => clearTimeout(timer);
    }, []);

    return (
        <QueryClientProvider client={queryClient}>
            <SplashScreen isVisible={showSplash} />
            <App />
            {/* DevTools apenas em desenvolvimento */}
            {/* {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />} */}
        </QueryClientProvider>
    );
};

export default AppWithProviders;
