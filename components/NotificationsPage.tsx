import React, { useState, useEffect, useCallback } from 'react';
import { SupabaseClient, Session } from '@supabase/supabase-js';
import { NotificationRecord, Page } from '../types';

interface NotificationsPageProps {
  supabase: SupabaseClient | null;
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
        case 'info':
        default:
            return <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>;
    }
};


const NotificationsPage: React.FC<NotificationsPageProps> = ({ supabase, session, onDataChange, onNavigate }) => {
    const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchNotifications = useCallback(async () => {
        if (!supabase || !session) return;
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
    }, [supabase, session]);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    const markAsRead = async (id: number) => {
        if (!supabase) return;
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        const { error: updateError } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
        if (updateError) {
            console.error("Failed to mark as read:", updateError);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: false } : n));
        }
        onDataChange();
    };

    const markAllAsRead = async () => {
        if (!supabase || !session) return;
        const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
        if (unreadIds.length === 0) return;

        setNotifications(prev => prev.map(n => ({...n, is_read: true })));
        const { error: updateError } = await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds);
        if (updateError) {
             console.error("Failed to mark all as read:", updateError);
             fetchNotifications(); // Re-fetch to correct UI
        }
        onDataChange();
    };
    
    const handleNotificationClick = async (n: NotificationRecord) => {
        if (!n.is_read) {
            await markAsRead(n.id);
        }
        if (n.related_event_id) {
            sessionStorage.setItem('highlightEventId', String(n.related_event_id));
            onNavigate('events');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Notificações</h1>
                    <p className="text-slate-500 mt-1">Seu histórico de alertas e atualizações</p>
                </div>
                <button 
                  onClick={markAllAsRead}
                  disabled={!notifications.some(n => !n.is_read)}
                  className="bg-white text-slate-700 font-semibold px-4 py-2 rounded-lg flex items-center space-x-2 border border-slate-300 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    <span>Marcar todas como lidas</span>
                </button>
            </div>
            
            <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
                {loading ? (
                    <p className="text-center text-slate-500 py-10">Carregando...</p>
                ) : error ? (
                    <p className="text-center text-red-500 py-10">{error}</p>
                ) : notifications.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1"><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" /></svg>
                        <h3 className="mt-2 text-lg font-medium text-slate-800">Nenhuma notificação</h3>
                        <p className="mt-1 text-sm">Você não tem nenhuma notificação ainda.</p>
                    </div>
                ) : (
                    <ul className="divide-y divide-slate-200">
                        {notifications.map(n => {
                            const isClickable = !!n.related_event_id;
                            return (
                                <li key={n.id} 
                                    onClick={isClickable ? () => handleNotificationClick(n) : undefined}
                                    className={`transition-colors ${!n.is_read ? 'bg-blue-50' : 'bg-white'} ${isClickable ? 'hover:bg-slate-100' : ''}`}
                                >
                                    <div className={`p-4 flex items-start space-x-4 ${isClickable ? 'cursor-pointer' : ''}`}>
                                        {!n.is_read && (
                                            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" aria-label="Não lida"></div>
                                        )}
                                        <div className={`flex-shrink-0 ${n.is_read ? 'ml-[10px]' : ''}`}>
                                            <NotificationIcon type={n.type} />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm text-slate-700">{n.message}</p>
                                            <p className="text-xs text-slate-500 mt-1">{timeAgo(n.created_at)}</p>
                                        </div>
                                        {!n.is_read && isClickable && (
                                            <button className="text-sm font-semibold text-blue-600 hover:text-blue-800 flex-shrink-0">Ver Evento</button>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default NotificationsPage;