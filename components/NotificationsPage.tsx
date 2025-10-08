
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
// FIX: Use 'type' import for Session to resolve potential module resolution issues with Supabase v2.
import { type Session } from '@supabase/supabase-js';
import { NotificationRecord, Page } from '../types';

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
                <button 
                    onClick={markAllAsRead}
                    disabled={!notifications.some(n => !n.is_read)}
                    className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Marcar todas como lidas
                </button>
            </div>
            
            <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
                <ul className="divide-y divide-slate-200">
                    {notifications.length > 0 ? notifications.map(n => (
                        <li 
                            key={n.id} 
                            className={`flex items-start space-x-4 p-4 -mx-4 sm:-mx-6 transition-colors ${!n.is_read ? 'bg-blue-50/50' : ''} ${n.related_event_id ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                            onClick={() => handleNotificationClick(n)}
                        >
                            <NotificationIcon type={n.type} />
                            <div className="flex-1">
                                <p className="text-sm text-slate-700">{n.message}</p>
                                <p className="text-xs text-slate-500 mt-1">{timeAgo(n.created_at)}</p>
                            </div>
                            {!n.is_read && (
                                <div className="flex-shrink-0 flex items-center">
                                    <span className="w-2.5 h-2.5 bg-blue-500 rounded-full" title="Não lida"></span>
                                </div>
                            )}
                        </li>
                    )) : (
                        <li className="text-center py-12 text-slate-500">
                            <h3 className="text-lg font-medium text-slate-800">Nenhuma notificação</h3>
                            <p className="mt-1 text-sm">Você não tem nenhuma notificação no momento.</p>
                        </li>
                    )}
                </ul>
            </div>
        </div>
    );
};

export default NotificationsPage;
