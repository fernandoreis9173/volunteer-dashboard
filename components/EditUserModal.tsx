import React, { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { Page } from '../types';

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onSave: (userId: string, role: string, permissions: string[]) => void;
}

const allPages: { id: Page; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'volunteers', label: 'Voluntários' },
    { id: 'ministries', label: 'Ministérios' },
    { id: 'schedules', label: 'Eventos' },
    { id: 'admin', label: 'Admin' },
];

const EditUserModal: React.FC<EditUserModalProps> = ({ isOpen, onClose, user, onSave }) => {
    const [role, setRole] = useState('leader');
    const [pagePermissions, setPagePermissions] = useState<string[]>([]);
    
    useEffect(() => {
        if (user) {
            setRole(user.user_metadata?.role || 'leader');
            const currentPermissions = user.user_metadata?.page_permissions;
            // If user has no permissions set, default based on role
            if (!currentPermissions || !Array.isArray(currentPermissions)) {
                if(user.user_metadata?.role === 'admin') {
                    setPagePermissions(allPages.map(p => p.id));
                } else {
                    setPagePermissions(allPages.filter(p => p.id !== 'admin').map(p => p.id));
                }
            } else {
                setPagePermissions(currentPermissions);
            }
        }
    }, [user]);

    const handlePermissionChange = (pageId: string) => {
        setPagePermissions(prev => 
            prev.includes(pageId) ? prev.filter(p => p !== pageId) : [...prev, pageId]
        );
    };

    const handleSave = () => {
        onSave(user.id, role, pagePermissions);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-40 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 m-4">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-slate-900">Editar Permissões</h3>
                    <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700">&times;</button>
                </div>
                <p className="text-sm text-slate-600 mb-2">Editando: <span className="font-semibold">{user.email}</span></p>

                <div className="space-y-6">
                    <div>
                        <label htmlFor="user-role" className="block text-sm font-medium text-slate-700 mb-1">Permissão Principal</label>
                        <select id="user-role" value={role} onChange={(e) => setRole(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900">
                            <option value="leader">Líder</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Acesso às Páginas</label>
                        <div className="grid grid-cols-2 gap-4">
                            {allPages.map(page => (
                                <div key={page.id} className="flex items-center">
                                    <input 
                                        type="checkbox" 
                                        id={`perm-${page.id}`}
                                        checked={pagePermissions.includes(page.id)}
                                        onChange={() => handlePermissionChange(page.id)}
                                        disabled={page.id === 'admin' && role !== 'admin'}
                                        className="h-4 w-4 rounded border-slate-300"
                                    />
                                    <label htmlFor={`perm-${page.id}`} className="ml-2 text-sm text-slate-700 capitalize">{page.label}</label>
                                </div>
                            ))}
                        </div>
                         {role !== 'admin' && <p className="text-xs text-slate-500 mt-2">A página de Admin só é acessível para a permissão de Admin.</p>}
                    </div>
                </div>

                <div className="mt-8 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg">Cancelar</button>
                    <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg">Salvar Alterações</button>
                </div>
            </div>
        </div>
    );
};

export default EditUserModal;