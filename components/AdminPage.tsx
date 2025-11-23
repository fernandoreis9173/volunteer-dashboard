import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
// FIX: Import the 'User' type from the central 'types.ts' module to resolve the export error.
import { EnrichedUser, User } from '../types';
import EditUserModal from './EditUserModal';
import ConfirmationModal from './ConfirmationModal';
import { getErrorMessage, getInitials } from '../lib/utils';

interface AdminPageProps {
    onDataChange: () => void;
}

const AdminPage: React.FC<AdminPageProps> = ({ onDataChange }) => {
    // States for User Management
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('leader');
    const [inviteLoading, setInviteLoading] = useState(false);
    const [inviteError, setInviteError] = useState<string | null>(null);
    const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
    const [invitedUsers, setInvitedUsers] = useState<EnrichedUser[]>([]);
    const [listLoading, setListLoading] = useState(true);
    const [listError, setListError] = useState<string | null>(null);
    const [inputValue, setInputValue] = useState(''); // For immediate input
    const [searchQuery, setSearchQuery] = useState(''); // For debounced filtering
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const [isActionModalOpen, setIsActionModalOpen] = useState(false);
    const [userToAction, setUserToAction] = useState<User | null>(null);
    const [actionType, setActionType] = useState<'disable' | 'enable' | 'demote' | null>(null);

    // States for custom role dropdown
    const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
    const roleDropdownRef = useRef<HTMLDivElement>(null);

    // Cache Ref for Users
    const usersCache = useRef<{ data: EnrichedUser[], timestamp: number } | null>(null);
    const CACHE_DURATION = 60000; // 1 minute

    // Fetch Logic for User Management
    const fetchInvitedUsers = useCallback(async (force = false) => {
        // Check cache first
        if (!force && usersCache.current && (Date.now() - usersCache.current.timestamp < CACHE_DURATION)) {
            setInvitedUsers(usersCache.current.data);
            setListLoading(false);
            return;
        }

        setListLoading(true);
        setListError(null);

        const { data, error: fetchError } = await supabase.functions.invoke('list-users');

        if (fetchError) {
            const errorMessage = getErrorMessage(fetchError);
            setListError(`Falha ao carregar la lista de convidados: ${errorMessage}`);
        } else if (data && data.error) {
            setListError(`Erro retornado pela função: ${data.error}`);
            setInvitedUsers([]);
        } else {
            const users = data.users || [];
            setInvitedUsers(users);
            // Update cache
            usersCache.current = { data: users, timestamp: Date.now() };
        }
        setListLoading(false);
    }, []);

    useEffect(() => {
        fetchInvitedUsers();
    }, [fetchInvitedUsers]);

    // Debounce search query
    useEffect(() => {
        const timer = setTimeout(() => {
            setSearchQuery(inputValue);
        }, 300); // 300ms delay

        return () => {
            clearTimeout(timer);
        };
    }, [inputValue]);


    // Effect for closing dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (roleDropdownRef.current && !roleDropdownRef.current.contains(event.target as Node)) {
                setIsRoleDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);


    const filteredUsers = useMemo(() => {
        // Filter out volunteers, as they are managed separately on the Volunteers page.
        const nonVolunteers = invitedUsers.filter(user => user.user_metadata?.role !== 'volunteer');

        if (!searchQuery) {
            return nonVolunteers;
        }
        const lowercasedQuery = searchQuery.toLowerCase();
        return nonVolunteers.filter(user =>
            (user.user_metadata?.name?.toLowerCase().includes(lowercasedQuery)) ||
            (user.email?.toLowerCase().includes(lowercasedQuery))
        );
    }, [searchQuery, invitedUsers]);


    const handleInviteSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !name) {
            setInviteError('Por favor, insira um nome e um endereço de e-mail válido.');
            return;
        }
        setInviteLoading(true);
        setInviteError(null);
        setInviteSuccess(null);
        try {
            const { error: invokeError } = await supabase.functions.invoke('invite-user', {
                body: { email, role, name },
            });
            if (invokeError) throw invokeError;
            setInviteSuccess(`Convite enviado com sucesso para ${email}!`);
            setEmail('');
            setName('');
            setRole('leader');
            await fetchInvitedUsers(true); // Force refetch
        } catch (err) {
            setInviteError(`Falha ao enviar convite: ${getErrorMessage(err)}`);
        } finally {
            setInviteLoading(false);
        }
    };

    const handleUpdateUser = async (userId: string, newRole: string, newPermissions: string[]) => {
        const { data, error } = await supabase.functions.invoke('update-permissions', {
            body: { userId, role: newRole, permissions: newPermissions }
        });
        if (error) {
            alert(`Falha ao atualizar permissões: ${getErrorMessage(error)}`);
        } else {
            await fetchInvitedUsers(true); // Force refetch
            setIsEditModalOpen(false);
        }
    };

    const handleRequestAction = (user: User, type: 'disable' | 'enable' | 'demote') => {
        setUserToAction(user);
        setActionType(type);
        setIsActionModalOpen(true);
        setActiveMenu(null);
    };

    const handleConfirmAction = async () => {
        if (!userToAction || !actionType) return;

        if (actionType === 'demote') {
            const { error } = await supabase.functions.invoke('demote-to-volunteer', {
                body: { userId: userToAction.id },
            });
            if (error) {
                alert(`Falha ao rebaixar líder: ${getErrorMessage(error)}`);
            } else {
                await fetchInvitedUsers(true); // Force refetch
                onDataChange(); // Refetch leaders list in App.tsx
            }
        } else {
            // Existing disable/enable logic
            const functionName = actionType === 'disable' ? 'disable-user' : 'enable-user';
            const { error } = await supabase.functions.invoke(functionName, {
                body: { userId: userToAction.id },
            });
            if (error) {
                alert(`Falha ao ${actionType === 'disable' ? 'desativar' : 'reativar'} usuário: ${getErrorMessage(error)}`);
            } else {
                await fetchInvitedUsers(true); // Force refetch
            }
        }

        setIsActionModalOpen(false);
        setUserToAction(null);
        setActionType(null);
    };



    const getStatusInfo = (status?: 'Ativo' | 'Inativo' | 'Pendente') => {
        switch (status) {
            case 'Ativo':
                return { text: 'Ativo', color: 'bg-green-100 text-green-800' };
            case 'Inativo':
                return { text: 'Inativo', color: 'bg-red-100 text-red-800' };
            case 'Pendente':
                return { text: 'Pendente', color: 'bg-yellow-100 text-yellow-800' };
            default:
                return { text: 'Desconhecido', color: 'bg-slate-100 text-slate-800' };
        }
    };

    const roleOptions = [
        { value: 'leader', label: 'Líder' },
        { value: 'admin', label: 'Admin' },
    ];
    const selectedRoleLabel = roleOptions.find(o => o.value === role)?.label;

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-slate-800">Painel do Administrador</h1>
                <p className="text-slate-500 mt-1">Gerencie usuários e permissões da organização.</p>
            </div>

            {/* Invite User Form */}
            <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200 max-w-2xl">
                <h2 className="text-xl font-bold text-slate-800 mb-4">Convidar Novo Administrador/Líder</h2>
                <form onSubmit={handleInviteSubmit} className="space-y-4 flex-grow flex flex-col">
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label>
                                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Permissão</label>
                            <div className="relative" ref={roleDropdownRef}>
                                <button
                                    type="button"
                                    onClick={() => setIsRoleDropdownOpen(prev => !prev)}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg flex justify-between items-center cursor-pointer text-left"
                                    aria-haspopup="listbox"
                                    aria-expanded={isRoleDropdownOpen}
                                >
                                    <span className="text-slate-900">{selectedRoleLabel}</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-slate-400 transition-transform ${isRoleDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                                </button>
                                {isRoleDropdownOpen && (
                                    <div className="absolute z-10 w-full top-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg">
                                        <ul className="py-1" role="listbox">
                                            {roleOptions.map(option => (
                                                <li
                                                    key={option.value}
                                                    onClick={() => {
                                                        setRole(option.value);
                                                        setIsRoleDropdownOpen(false);
                                                    }}
                                                    className="px-4 py-2 hover:bg-slate-100 cursor-pointer text-slate-700"
                                                    role="option"
                                                    aria-selected={role === option.value}
                                                >
                                                    {option.label}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex-grow"></div>

                    {inviteError && <p className="text-sm text-red-500">{inviteError}</p>}
                    {inviteSuccess && <p className="text-sm text-green-500">{inviteSuccess}</p>}
                    <div className="text-right mt-auto">
                        <button type="submit" disabled={inviteLoading} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg disabled:bg-blue-400">
                            {inviteLoading ? 'Enviando...' : 'Enviar Convite'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Users List */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="text-xl font-bold text-slate-800 mb-4">Gerenciar Usuários</h2>
                <input type="text" placeholder="Buscar por nome ou email..." value={inputValue} onChange={(e) => setInputValue(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-4" />

                {listLoading ? <p>Carregando usuários...</p> : listError ? <p className="text-red-500">{listError}</p> : (
                    <div className="-mx-6 overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th scope="col" className="py-3.5 pl-6 pr-3 text-left text-sm font-semibold text-slate-900">Usuário</th>
                                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Email</th>
                                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900 whitespace-nowrap">Permissão</th>
                                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900 whitespace-nowrap">Status</th>
                                    <th scope="col" className="relative py-3.5 pl-3 pr-6"><span className="sr-only">Ações</span></th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {filteredUsers.map(user => {
                                    const statusInfo = getStatusInfo(user.app_status);
                                    return (
                                        <tr key={user.id}>
                                            <td className="py-4 pl-6 pr-3 text-sm">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-200 flex-shrink-0">
                                                        {user.user_metadata?.avatar_url ? (
                                                            <img src={user.user_metadata.avatar_url} alt={user.user_metadata.name || 'Avatar'} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full bg-blue-500 text-white flex items-center justify-center font-bold text-xs">
                                                                {getInitials(user.user_metadata?.name || '')}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className="font-medium text-slate-900 truncate">{user.user_metadata?.name || 'N/A'}</span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-4 text-sm text-slate-500 break-words">
                                                {user.email}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500 capitalize">
                                                {user.user_metadata?.role === 'leader' || user.user_metadata?.role === 'lider' ? 'Líder' : user.user_metadata?.role}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusInfo.color}`}>{statusInfo.text}</span>
                                            </td>
                                            <td className="relative whitespace-nowrap py-4 pl-3 pr-6 text-right text-sm font-medium">
                                                <div className="relative inline-block">
                                                    <button onClick={() => setActiveMenu(activeMenu === user.id ? null : user.id)} className="p-1 text-slate-500 rounded-md hover:bg-slate-100">
                                                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
                                                    </button>
                                                    {activeMenu === user.id && (
                                                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border border-slate-200">
                                                            <ul className="py-1">
                                                                <li><button onClick={() => { setEditingUser(user); setIsEditModalOpen(true); setActiveMenu(null); }} className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Editar Permissões</button></li>
                                                                {(user.user_metadata?.role === 'leader' || user.user_metadata?.role === 'lider') && (
                                                                    <li><button onClick={() => handleRequestAction(user, 'demote')} className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Tornar Voluntário</button></li>
                                                                )}
                                                                {user.app_status === 'Inativo' ? (
                                                                    <li><button onClick={() => handleRequestAction(user, 'enable')} className="block w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-green-50">Reativar Usuário</button></li>
                                                                ) : (
                                                                    user.user_metadata?.role !== 'admin' && (
                                                                        <li><button onClick={() => handleRequestAction(user, 'disable')} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">Desativar Usuário</button></li>
                                                                    )
                                                                )}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {editingUser && (
                <EditUserModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} user={editingUser} onSave={handleUpdateUser} />
            )}

            <ConfirmationModal
                isOpen={isActionModalOpen}
                onClose={() => setIsActionModalOpen(false)}
                onConfirm={handleConfirmAction}
                title={
                    actionType === 'demote' ? 'Tornar Voluntário' :
                        `${actionType === 'disable' ? 'Desativar' : 'Reativar'} Usuário`
                }
                message={
                    actionType === 'demote' ? `Tem certeza de que deseja tornar ${userToAction?.user_metadata?.name} para voluntário? Ele será removido da liderança e seu perfil de voluntário será reativado.` :
                        `Tem certeza de que deseja ${actionType === 'disable' ? 'desativar' : 'reativar'} o usuário ${userToAction?.email}?`
                }
            />
        </div>
    );
};
// FIX: Added a default export to the AdminPage component to resolve the module import error.
export default AdminPage;