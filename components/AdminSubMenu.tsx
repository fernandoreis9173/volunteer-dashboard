import React, { useState } from 'react';
import AdminPage from './AdminPage';
import AdminNotificationsPage from './AdminNotificationsPage';

interface AdminSubMenuProps {
    onDataChange: () => void;
}

type AdminTab = 'users' | 'notifications';

const AdminSubMenu: React.FC<AdminSubMenuProps> = ({ onDataChange }) => {
    const [activeTab, setActiveTab] = useState<AdminTab>('users');

    return (
        <div className="space-y-6">
            {/* Tabs */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-1 inline-flex">
                <button
                    onClick={() => setActiveTab('users')}
                    className={`px-6 py-2 rounded-lg font-semibold text-sm transition-colors ${activeTab === 'users'
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                        }`}
                >
                    Usuários
                </button>
                <button
                    onClick={() => setActiveTab('notifications')}
                    className={`px-6 py-2 rounded-lg font-semibold text-sm transition-colors ${activeTab === 'notifications'
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                        }`}
                >
                    Notificações
                </button>
            </div>

            {/* Content */}
            <div>
                {activeTab === 'users' && <AdminPage onDataChange={onDataChange} />}
                {activeTab === 'notifications' && <AdminNotificationsPage onDataChange={onDataChange} />}
            </div>
        </div>
    );
};

export default AdminSubMenu;
