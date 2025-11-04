import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
// FIX: Use 'type' import for User to resolve potential module resolution issues with Supabase v2.
import type { User } from '@supabase/supabase-js';
import EditUserModal from './EditUserModal';
import ConfirmationModal from './ConfirmationModal';
import { EnrichedUser } from '../types';
import { getErrorMessage } from '../lib/utils';

const AdminPage: React.FC = () => {
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
    const [actionType, setActionType] = useState<'disable' | 'enable' | null>(null);
    
    // States for custom role dropdown
    const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
    const roleDropdownRef = useRef<HTMLDivElement>(null);

    // States for Broadcast Notifications
    const [broadcastMessage, setBroadcastMessage] = useState('');
    const [broadcastLoading, setBroadcastLoading] = useState(false);
    const [broadcastError, setBroadcastError] = useState<string | null>(null);
    const [broadcastSuccess, setBroadcastSuccess] = useState<string | null>(null);

    // Fetch Logic for User Management
    const fetchInvitedUsers = useCallback(async () => {
        setListLoading(true);
        setListError(null);
        
        const { data, error: fetchError } = await supabase.functions.invoke('list-users');

        if (fetchError) {
            const errorMessage = getErrorMessage(fetchError);
            setListError(`Falha ao carregar a lista de convidados: ${errorMessage}`);
        } else if (data && data.error) {
            setListError(`Erro retornado pela função: ${data.error}`);
            setInvitedUsers([]);
        } else {
            setInvitedUsers(data.users || []);
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
            await fetchInvitedUsers();
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
            await fetchInvitedUsers();
            setIsEditModalOpen(false);
        }
    };

    const handleRequestAction = (user: User, type: 'disable' | 'enable') => {
        setUserToAction(user);
        setActionType(type);
        setIsActionModalOpen(true);
        setActiveMenu(null);
    };

    const handleConfirmAction = async () => {
        if (!userToAction || !actionType) return;
        const functionName = actionType === 'disable' ? 'disable-user' : 'enable-user';
        const { error } = await supabase.functions.invoke(functionName, {
            body: { userId: userToAction.id },
        });
        if (error) {
            alert(`Falha ao ${actionType === 'disable' ? 'desativar' : 'reativar'} usuário: ${getErrorMessage(error)}`);
        } else {
            await fetchInvitedUsers();
        }
        setIsActionModalOpen(false);
        setUserToAction(null);
        setActionType(null);
    };

    // FIX: Completed the handleBroadcastSubmit function to fix a syntax error and implement the broadcast logic.
    const handleBroadcastSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!broadcastMessage.trim()) {
            setBroadcastError('A mensagem não pode estar vazia.');
            return;
        }
        setBroadcastLoading(true);
        setBroadcastError(null);
        setBroadcastSuccess(null);
        try {
            const { error: invokeError } = await supabase.functions.invoke('create-notifications', {
                body: { broadcastMessage },
            });

            if (invokeError) throw invokeError;

            setBroadcastSuccess('Mensagem de broadcast enviada com sucesso!');
            setBroadcastMessage('');
        } catch (err) {
            setBroadcastError(`Falha ao enviar broadcast: ${getErrorMessage(err)}`);
        } finally {
            setBroadcastLoading(false);
        }
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
                <p className="text-slate-500 mt-1">Gerencie usuários e envie notificações.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                {/* Invite User Form */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-full flex flex-col">
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

                 {/* Broadcast Form */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-full flex flex-col">
                    <h2 className="text-xl font-bold text-slate-800 mb-4">Notificação em Massa</h2>
                    <form onSubmit={handleBroadcastSubmit} className="space-y-4 flex-grow flex flex-col">
                        <div className="flex-grow">
                            <label htmlFor="broadcast-message" className="block text-sm font-medium text-slate-700 mb-1">Mensagem</label>
                            <textarea id="broadcast-message" value={broadcastMessage} onChange={e => setBroadcastMessage(e.target.value)} rows={4} className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="Digite a mensagem que será enviada para todos os usuários com notificações ativas..."></textarea>
                        </div>
                        {broadcastError && <p className="text-sm text-red-500">{broadcastError}</p>}
                        {broadcastSuccess && <p className="text-sm text-green-500">{broadcastSuccess}</p>}
                        <div className="text-right mt-auto">
                            <button type="submit" disabled={broadcastLoading} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg disabled:bg-blue-400">
                                {broadcastLoading ? 'Enviando...' : 'Enviar para Todos'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Users List */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="text-xl font-bold text-slate-800 mb-4">Gerenciar Usuários</h2>
                <input type="text" placeholder="Buscar por nome ou email..." value={inputValue} onChange={(e) => setInputValue(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-4"/>
                
                {listLoading ? <p>Carregando usuários...</p> : listError ? <p className="text-red-500">{listError}</p> : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-slate-500">
                            <thead className="text-xs text-slate-700 uppercase bg-slate-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3">Nome</th>
                                    <th scope="col" className="px-6 py-3">Email</th>
                                    <th scope="col" className="px-6 py-3">Permissão</th>
                                    <th scope="col" className="px-6 py-3">Status</th>
                                    <th scope="col" className="px-6 py-3"><span className="sr-only">Ações</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map(user => {
                                    const statusInfo = getStatusInfo(user.app_status);
                                    return (
                                    <tr key={user.id} className="bg-white border-b hover:bg-slate-50">
                                        <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">{user.user_metadata?.name || 'N/A'}</td>
                                        <td className="px-6 py-4">{user.email}</td>
                                        <td className="px-6 py-4 capitalize">{user.user_metadata?.role === 'leader' || user.user_metadata?.role === 'lider' ? 'Líder' : user.user_metadata?.role}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusInfo.color}`}>{statusInfo.text}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="relative inline-block">
                                                <button onClick={() => setActiveMenu(activeMenu === user.id ? null : user.id)} className="p-1 text-slate-500 rounded-md hover:bg-slate-100">...</button>
                                                {activeMenu === user.id && (
                                                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border border-slate-200">
                                                        <ul className="py-1">
                                                            <li><button onClick={() => { setEditingUser(user); setIsEditModalOpen(true); setActiveMenu(null); }} className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Editar Permissões</button></li>
                                                            {user.app_status === 'Inativo' ? (
                                                                <li><button onClick={() => handleRequestAction(user, 'enable')} className="block w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-green-50">Reativar Usuário</button></li>
                                                            ) : (
                                                                <li><button onClick={() => handleRequestAction(user, 'disable')} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">Desativar Usuário</button></li>
                                                            )}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )})}
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
                title={`${actionType === 'disable' ? 'Desativar' : 'Reativar'} Usuário`}
                message={`Tem certeza de que deseja ${actionType === 'disable' ? 'desativar' : 'reativar'} o usuário ${userToAction?.email}?`}
            />
        </div>
    );
};
// FIX: Added a default export to the AdminPage component to resolve the module import error.
export default AdminPage;