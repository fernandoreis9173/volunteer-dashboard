import React from 'react';
import type { EnrichedUser } from '../types';

interface ActivityFeedProps {
    leaders: EnrichedUser[] | undefined;
}

const timeAgo = (dateString?: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

    let interval = seconds / 31536000;
    if (interval > 1) return `${Math.floor(interval)} anos atrás`;

    interval = seconds / 2592000;
    if (interval > 1) return `${Math.floor(interval)} meses atrás`;

    interval = seconds / 86400;
    if (interval > 1) return `${Math.floor(interval)} dias atrás`;

    interval = seconds / 3600;
    if (interval > 1) return `${Math.floor(interval)} horas atrás`;

    interval = seconds / 60;
    if (interval > 1) return `${Math.floor(interval)} minutos atrás`;

    return "Agora mesmo";
};

const getInitials = (name?: string): string => {
    if (!name) return '??';
    const parts = name.trim().split(' ').filter(p => p);
    if (parts.length === 0) return '??';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + (parts[parts.length - 1][0] || '')).toUpperCase();
};

const ActivityFeed: React.FC<ActivityFeedProps> = ({ leaders }) => {
    const loading = leaders === undefined;

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-full flex flex-col">
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-2xl font-bold text-slate-800">Líderes Ativos</h2>
            </div>
            <p className="text-sm text-slate-500 mb-6">Atividade recente dos líderes no sistema.</p>

            <div className="flex-grow overflow-y-auto -mr-3 pr-3 space-y-6">
                {loading ? (
                    Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="flex items-center space-x-4 animate-pulse">
                            <div className="w-10 h-10 rounded-full bg-slate-200"></div>
                            <div className="flex-1 space-y-2">
                                <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                                <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                            </div>
                        </div>
                    ))
                ) : leaders && leaders.length > 0 ? (
                    <ul className="relative">
                        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-200" aria-hidden="true"></div>
                        {leaders.map((leader) => {
                            // FIX: Removed optional chaining as the corrected EnrichedUser type ensures user_metadata exists.
                            const leaderName = leader.user_metadata.name || leader.email || 'Líder';
                            const initials = getInitials(leaderName);
                            const avatarUrl = leader.user_metadata.avatar_url || leader.user_metadata.picture;

                            return (
                                <li key={leader.id} className="relative pl-12 pb-6">
                                    <div className="absolute left-0 top-0">
                                        <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm border-4 border-white overflow-hidden">
                                            {avatarUrl ? (
                                                <img src={avatarUrl} alt={leaderName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                            ) : (
                                                initials
                                            )}
                                        </div>
                                    </div>
                                    <div className="ml-4">
                                        <p className="font-semibold text-slate-800 text-sm">
                                            {leaderName}
                                            <span className="font-normal text-slate-500"> está ativo no sistema.</span>
                                        </p>
                                        {/* FIX: Removed optional chaining as the corrected EnrichedUser type ensures created_at exists. */}
                                        <p className="text-xs text-slate-400 mt-1">{timeAgo(leader.last_sign_in_at)}</p>
                                    </div>
                                </li>
                            )
                        })}
                    </ul>
                ) : (
                    <div className="text-center py-10">
                        <p className="text-slate-500">Nenhuma atividade de líder para mostrar.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ActivityFeed;