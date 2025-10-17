import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
// FIX: Use 'type' import for Session to resolve potential module resolution issues with Supabase v2.
import { type Session } from '@supabase/supabase-js';
import { NotificationRecord, Page } from '../types';
import ConfirmationModal from './ConfirmationModal';
import { getErrorMessage } from '../lib/utils';

interface NotificationsPageProps {
  session: Session | null;
  onDataChange: () => void;
  onNavigate: (page: Page) => void;
}

const NOTIFICATIONS_PER_PAGE = 15;

const timeAgo = (dateString?: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    
    let interval = seconds / 31536000;
    if (interval > 1) return `há ${Math.floor(interval)} anos`;
    
    interval = seconds / 2592000;
    if (interval > 1) return `há ${Math.floor(interval)} meses`;
    
    interval = seconds / 86400;
    if (interval > 1) return `há ${Math.floor(interval)} dias`;
    
    interval = seconds / 3600;
    if (interval > 1) return `há ${Math.floor(interval)} horas`;
    
    interval = seconds / 60;
    if (interval > 1) return `há ${Math.floor(interval)} minutos`;
    
    return "agora mesmo";
};

const NotificationIcon: React.FC<{ type: NotificationRecord['type'] }> = ({ type }) => {
    switch (type) {
        case 'new_schedule':
            return <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>;
        case 'invitation_received':
            return <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg></div>;
        case 'event_update':
        case 'new_event_for_department':
        case 'new_event_for_leader':
        case 'info':
        default:
            return <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>;
    }
};

const NotificationsPage: React.FC<NotificationsPageProps> = ({ session, onDataChange, onNavigate }) => {
    const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
    
    const fetchNotifications = useCallback(async () => {
        if (!session) return;
        setLoading(true);
        setError(null);
        try {
            const { data, error: fetchError } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', session.user.id)
                .order('created_at', { ascending: false })
                .limit(NOTIFICATIONS_PER_PAGE);
            
            if (fetchError) throw fetchError;
            setNotifications(data || []);
            setHasMore((data || []).length === NOTIFICATIONS_PER_PAGE);
        } catch (err: any) {
            setError('Falha ao carregar notificações.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [session]);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    const handleLoadMore = async () => {
        if (!session || loadingMore || !hasMore) return;
        setLoadingMore(true);
        try {
            const { data, error: fetchError } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', session.user.id)
                .order('created_at', { ascending: false })
                .range(notifications.length, notifications.length + NOTIFICATIONS_PER_PAGE - 1);
            
            if (fetchError) throw fetchError;

            if (data && data.length > 0) {
                setNotifications(prev => [...prev, ...data]);
                setHasMore(data.length === NOTIFICATIONS_PER_PAGE);
            } else {
                setHasMore(false);
            }
        } catch (err) {
            console.error("Failed to load more notifications:", err);
            setError("Falha ao carregar mais notificações.");
        } finally {
            setLoadingMore(false);
        }
    };

    const markAsRead = async (id: number) => {
        const originalNotifications = [...notifications];
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        const { error: updateError } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
        if (updateError) {
            console.error("Failed to mark notification as read:", updateError);
            setNotifications(originalNotifications);
            alert('Falha ao marcar notificação como lida.');
        } else {
            onDataChange();
        }
    };

    const markAllAsRead = async () => {
        if (!session) return;
        const originalNotifications = [...notifications];
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        const { error: updateError } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', session.user.id);
        if (updateError) {
            console.error("Failed to mark all as read:", updateError);
            setNotifications(originalNotifications);
            alert('Falha ao marcar todas as notificações como lidas.');
        } else {
            onDataChange();
        }
    };

    const handleDeleteNotification = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation(); 

        try {
            const { error } = await supabase.functions.invoke('delete-notifications', {
                body: { notificationId: id },
            });

            if (error) throw error;

            setNotifications(prev => prev.filter(n => n.id !== id));
            onDataChange(); 
        } catch (deleteError: any) {
            console.error("Failed to delete notification via function:", deleteError);
            alert(`Falha ao excluir a notificação: ${getErrorMessage(deleteError)}`);
        }
    };

    const handleConfirmDeleteAll = async () => {
        setIsDeleteAllModalOpen(false);

        try {
            const { error } = await supabase.functions.invoke('delete-notifications', {
                body: { deleteAll: true },
            });
            
            if (error) throw error;
            
            setNotifications([]);
            onDataChange();
            
        } catch (deleteError: any) {
            console.error("Failed to delete all notifications via function:", deleteError);
            alert(`Falha ao excluir todas as notificações: ${getErrorMessage(deleteError)}`);
        }
    };
    
    const handleNotificationClick = (notification: NotificationRecord) => {
        if (!notification.is_read) {
            markAsRead(notification.id);
        }
        if (notification.related_event_id) {
            sessionStorage.setItem('showEventDetailsForId', String(notification.related_event_id));
            onNavigate('dashboard');
        }
    };

    if (loading) {
        return <p className="text-center text-slate-500 mt-10">Carregando notificações...</p>;
    }

    if (error) {
        return <p className="text-center text-red-500 mt-10">{error}</p>;
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Notificações</h1>
                    <p className="text-slate-500 mt-1">Veja suas atualizações mais recentes.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={markAllAsRead}
                        disabled={!notifications.some(n => !n.is_read)}
                        className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Marcar como lidas
                    </button>
                    <button 
                        onClick={() => setIsDeleteAllModalOpen(true)}
                        disabled={notifications.length === 0}
                        className="px-4 py-2 bg-red-50 border border-red-200 text-red-700 font-semibold rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Limpar Todas
                    </button>
                </div>
            </div>
            
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
                <ul className="divide-y divide-slate-200">
                    {notifications.length > 0 ? notifications.map(n => (
                        <li key={n.id} className="group">
                            <div className={`flex items-center space-x-4 p-4 ${!n.is_read ? 'bg-blue-50/50' : 'bg-white'}`}>
                                <div 
                                    className="flex-grow flex items-start space-x-4 cursor-pointer"
                                    onClick={() => handleNotificationClick(n)}
                                >
                                    <NotificationIcon type={n.type} />
                                    <div className="flex-1">
                                        <p className="text-sm text-slate-700">{n.message}</p>
                                        <p className="text-xs text-slate-500 mt-1">{timeAgo(n.created_at)}</p>
                                    </div>
                                </div>
                                <div className="flex-shrink-0 flex items-center gap-2">
                                    {!n.is_read && (
                                        <span className="w-2.5 h-2.5 bg-blue-500 rounded-full" title="Não lida"></span>
                                    )}
                                    <button
                                        onClick={(e) => handleDeleteNotification(n.id, e)}
                                        className="p-1.5 rounded-full text-slate-400 hover:bg-red-100 hover:text-red-600 transition-colors"
                                        aria-label="Apagar notificação"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.134-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.067-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </li>
                    )) : (
                        <li className="text-center py-12 text-slate-500">
                            <h3 className="text-lg font-medium text-slate-800">Nenhuma notificação</h3>
                            <p className="mt-1 text-sm">Você não tem nenhuma notificação no momento.</p>
                        </li>
                    )}
                </ul>
                {hasMore && notifications.length > 0 && (
                    <div className="mt-6 text-center p-4">
                        <button
                            onClick={handleLoadMore}
                            disabled={loadingMore}
                            className="px-6 py-2 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-wait"
                        >
                            {loadingMore ? 'Carregando...' : 'Ver mais notificações'}
                        </button>
                    </div>
                )}
            </div>
             <ConfirmationModal
                isOpen={isDeleteAllModalOpen}
                onClose={() => setIsDeleteAllModalOpen(false)}
                onConfirm={handleConfirmDeleteAll}
                title="Limpar Todas as Notificações"
                message="Tem certeza de que deseja excluir todas as suas notificações? Esta ação não pode ser desfeita."
            />
        </div>
    );
};

export default NotificationsPage;