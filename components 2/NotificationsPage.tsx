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
                .order('created_at', { ascending: false });
            
            if (fetchError) throw fetchError;
            setNotifications(data || []);
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
            sessionStorage.setItem('highlightEventId', String(notification.related_event_id));
            onNavigate('events');
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
            
            <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
                <ul className="divide-y divide-slate-200">
                    {notifications.length > 0 ? notifications.map(n => (
                        <li 
                            key={n.id} 
                            className={`group flex items-start space-x-4 p-4 -mx-4 sm:-mx-6 transition-colors ${!n.is_read ? 'bg-blue-50/50' : ''} ${n.related_event_id ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                            onClick={() => handleNotificationClick(n)}
                        >
                            <NotificationIcon type={n.type} />
                            <div className="flex-1">
                                <p className="text-sm text-slate-700">{n.message}</p>
                                <p className="text-xs text-slate-500 mt-1">{timeAgo(n.created_at)}</p>
                            </div>
                            <div className="flex-shrink-0 flex items-center gap-4">
                                {!n.is_read && (
                                    <span className="w-2.5 h-2.5 bg-blue-500 rounded-full" title="Não lida"></span>
                                )}
                                <button
                                    onClick={(e) => handleDeleteNotification(n.id, e)}
                                    className="p-1 rounded-full text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-slate-200 hover:text-slate-600 transition-opacity"
                                    aria-label="Dispensar notificação"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </li>
                    )) : (
                        <li className="text-center py-12 text-slate-500">
                            <h3 className="text-lg font-medium text-slate-800">Nenhuma notificação</h3>
                            <p className="mt-1 text-sm">Você não tem nenhuma notificação no momento.</p>
                        </li>
                    )}
                </ul>
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