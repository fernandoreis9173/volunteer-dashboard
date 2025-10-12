import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
// FIX: Use 'type' import for User to resolve potential module resolution issues with Supabase v2.
import type { User } from '@supabase/supabase-js';
import EditUserModal from './EditUserModal';
import ConfirmationModal from './ConfirmationModal';
import { EnrichedUser } from '../types';
import { getErrorMessage } from '../lib/utils';

interface AdminPageProps {
  onDataChange: () => void; // Kept for now if global changes are needed, but component logic is self-contained
}

const AdminPage: React.FC<AdminPageProps> = ({ onDataChange }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('leader');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    
    const [invitedUsers, setInvitedUsers] = useState<EnrichedUser[]>([]);
    const [listLoading, setListLoading] = useState(true);
    const [listError, setListError] = useState<string | null>(null);

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [activeMenu, setActiveMenu] = useState<string | null>(null);

    const [isActionModalOpen, setIsActionModalOpen] = useState(false);
    const [userToAction, setUserToAction] = useState<User | null>(null);
    const [actionType, setActionType] = useState<'disable' | 'enable' | null>(null);
    
    // State for broadcast notifications
    const [broadcastMessage, setBroadcastMessage] = useState('');
    const [broadcastLoading, setBroadcastLoading] = useState(false);
    const [broadcastError, setBroadcastError] = useState<string | null>(null);
    const [broadcastSuccess, setBroadcastSuccess] = useState<string | null>(null);

    const fetchInvitedUsers = async () => {
        setListLoading(true);
        setListError(null);
        
        const { data, error: fetchError } = await supabase.functions.invoke('list-users');

        if (fetchError) {
            const errorMessage = getErrorMessage(fetchError);
            setListError(`Falha ao carregar a lista de convidados: ${errorMessage}`);
            console.error('Error fetching invited users:', fetchError);
        } else if (data && data.error) {
            setListError(`Erro retornado pela função: ${data.error}`);
            console.error('Error payload from function:', data.error);
            setInvitedUsers([]);
        } else {
            setInvitedUsers(data.users || []);
        }
        setListLoading(false);
    };

    useEffect(() => {
        fetchInvitedUsers();
    }, []);


    const handleInviteSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !name) {
            setError('Por favor, insira um nome e um endereço de e-mail válido.');
            return;
        }

        setLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const { error: invokeError } = await supabase.functions.invoke('invite-user', {
                body: { email, role, name },
            });

            if (invokeError) {
                throw invokeError;
            }
            
            setSuccessMessage(`Convite enviado com sucesso para ${email}!`);
            setEmail('');
            setName('');
            setRole('leader');
            await fetchInvitedUsers();

        } catch (err) {
            const errorMessage = getErrorMessage(err);
            console.error('Error inviting user:', err);
            setError(`Falha ao enviar convite: ${errorMessage}`);
        } finally {
            setLoading(false);
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
            const { data, error: invokeError } = await supabase.functions.invoke('create-notifications', {
                body: { broadcastMessage },
            });

            if (invokeError) throw invokeError;
            if (data?.error) throw new Error(data.error);
            
            setBroadcastSuccess(data?.message || 'Notificação enviada com sucesso!');
            setBroadcastMessage('');

        } catch (err) {
            const errorMessage = getErrorMessage(err);
            console.error('Error sending broadcast:', err);
            setBroadcastError(`Falha ao enviar notificação: ${errorMessage}`);
        } finally {
            setBroadcastLoading(false);
        }
    };


    const formatDate = (dateString: string | undefined) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };
    
    const getRoleForDisplay = (user: User) => {
        const userRole = user.user_metadata?.role || user.user_metadata?.papel;
        if (userRole === 'admin') return 'Admin';
        if (userRole === 'leader' || userRole === 'lider') return 'Líder';
        if (userRole === 'volunteer') return 'Voluntário';
        return 'N/A';
    };
    
    const getStatusBadge = (user: EnrichedUser) => {
        switch (user.app_status) {
            case 'Inativo':
                return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-800">Inativo</span>;
            case 'Ativo':
                return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800">Ativo</span>;
            case 'Pendente':
            default:
                return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Pendente</span>;
        }
    };


    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-slate-800">Painel Administrativo</h1>
                <p className="text-slate-500 mt-1">Gerencie o acesso e convide novos usuários para o sistema.</p>
            </div>
            
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
                     <div className="flex items-center space-x-3 mb-6">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                        </svg>
                        <h2 className="text-2xl font-bold text-slate-800">Convidar Usuários</h2>
                    </div>
                    <p className="text-sm text-slate-600 mb-6">Insira o e-mail do usuário que você deseja convidar. Ele receberá um link para criar sua conta e definir uma senha.</p>
                    <form onSubmit={handleInviteSubmit} className="space-y-4">
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="invite-name" className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label>
                                <input type="text" id="invite-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do líder" required className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900" />
                            </div>
                            <div>
                                <label htmlFor="invite-email" className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
                                <input type="email" id="invite-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="exemplo@igreja.com" required className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900" />
                            </div>
                            <div className="sm:col-span-2">
                                <label htmlFor="invite-role" className="block text-sm font-medium text-slate-700 mb-1">Permissão</label>
                                <select id="invite-role" value={role} onChange={(e) => setRole(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900">
                                    <option value="leader">Líder de Departamento</option>
                                    <option value="admin">Admin (Líder Geral)</option>
                                </select>
                            </div>
                        </div>
                        {error && <p className="text-sm text-red-600">{error}</p>}
                        {successMessage && <p className="text-sm text-green-600">{successMessage}</p>}
                        <div className="pt-2">
                             <button type="submit" disabled={loading} className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg flex items-center justify-center space-x-2 hover:bg-blue-700 disabled:bg-blue-400">
                                {loading ? <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.493 5.334a59.768 59.768 0 0 1 17.014 0L18 12m-6 0h6" /></svg>}
                                <span>{loading ? 'Enviando...' : 'Enviar Convite'}</span>
                            </button>
                        </div>
                    </form>
                </div>

                <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center space-x-3 mb-6">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688 0-1.25-.562-1.25-1.25s.562-1.25 1.25-1.25 1.25.562 1.25 1.25-.562 1.25-1.25 1.25Zm0 0H9.11m4.23-4.58 2.12-2.12M13.4 10.34l-2.12 2.12m0 0-2.12 2.12m2.12-2.12 2.12 2.12M3 12a9 9 0 1 1 18 0 9 9 0 0 1-18 0Z" /></svg>
                        <h2 className="text-2xl font-bold text-slate-800">Notificação em Massa</h2>
                    </div>
                     <p className="text-sm text-slate-600 mb-6">
                        Envie uma notificação push para todos os usuários que ativaram as notificações. Use com moderação.
                    </p>
                    <form onSubmit={handleBroadcastSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="broadcast-message" className="block text-sm font-medium text-slate-700 mb-1">Mensagem</label>
                            <textarea
                                id="broadcast-message"
                                value={broadcastMessage}
                                onChange={(e) => setBroadcastMessage(e.target.value)}
                                placeholder="Digite sua mensagem aqui..."
                                required
                                rows={4}
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900"
                            />
                        </div>
                        {broadcastError && <p className="text-sm text-red-600">{broadcastError}</p>}
                        {broadcastSuccess && <p className="text-sm text-green-600">{broadcastSuccess}</p>}
                        <div className="pt-2">
                            <button type="submit" disabled={broadcastLoading} className="px-6 py-2.5 bg-amber-500 text-white font-semibold rounded-lg flex items-center justify-center space-x-2 hover:bg-amber-600 disabled:bg-amber-300">
                                {broadcastLoading ? <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l9.75 7.5-9.75-7.5Z" /></svg>}
                                <span>{broadcastLoading ? 'Enviando...' : 'Enviar para Todos'}</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
                 <div className="flex items-center space-x-3 mb-6">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m-7.5-2.226a3 3 0 0 0-4.682 2.72 9.094 9.094 0 0 0 3.741.479m7.5-2.226V18a2.25 2.25 0 0 1-2.25 2.25H12a2.25 2.25 0 0 1-2.25-2.25V18.226m3.75-10.5a3.375 3.375 0 0 0-6.75 0v1.5a3.375 3.375 0 0 0 6.75 0v-1.5ZM10.5 8.25a3.375 3.375 0 0 0-6.75 0v1.5a3.375 3.375 0 0 0 6.75 0v-1.5Z" />
                    </svg>
                    <h2 className="text-2xl font-bold text-slate-800">Usuários do Sistema</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Email</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Data do Convite</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase w-1/5">Permissão</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase w-1/6">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {listLoading ? (
                                <tr><td colSpan={5} className="px-6 py-4 text-center">Carregando...</td></tr>
                            ) : listError ? (
                                <tr><td colSpan={5} className="px-6 py-4 text-center text-red-500">{listError}</td></tr>
                            ) : invitedUsers.length === 0 ? (
                                <tr><td colSpan={5} className="px-6 py-4 text-center text-slate-500">Nenhum usuário encontrado.</td></tr>
                            ) : invitedUsers.map(user => {
                                return (
                                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{user.email ?? 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{formatDate(user.invited_at)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-semibold">{getRoleForDisplay(user)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">{getStatusBadge(user)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium relative">
                                        <button onClick={() => setActiveMenu(activeMenu === user.id ? null : user.id)} className="text-slate-500 hover:text-slate-700 p-1 rounded-full hover:bg-slate-200">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" /></svg>
                                        </button>
                                        {activeMenu === user.id && (
                                            <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                                                <div className="py-1" role="menu" aria-orientation="vertical">
                                                    <button onClick={() => { setEditingUser(user); setIsEditModalOpen(true); setActiveMenu(null); }} className="w-full text-left block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Editar Permissões</button>
                                                    {user.app_status === 'Inativo' ? (
                                                        <button onClick={() => handleRequestAction(user, 'enable')} className="w-full text-left block px-4 py-2 text-sm text-green-700 hover:bg-green-50">Reativar Usuário</button>
                                                    ) : (
                                                        <button onClick={() => handleRequestAction(user, 'disable')} className="w-full text-left block px-4 py-2 text-sm text-red-700 hover:bg-red-50">Desativar Usuário</button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            {isEditModalOpen && editingUser && (
                <EditUserModal 
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    user={editingUser}
                    onSave={handleUpdateUser}
                />
            )}
            <ConfirmationModal
                isOpen={isActionModalOpen}
                onClose={() => setIsActionModalOpen(false)}
                onConfirm={handleConfirmAction}
                title={actionType === 'disable' ? 'Confirmar Desativação' : 'Confirmar Reativação'}
                message={
                    actionType === 'disable' 
                    ? `Tem certeza que deseja desativar ${userToAction?.email ?? 'este usuário'}? Ele não poderá mais acessar o sistema.`
                    : `Tem certeza que deseja reativar ${userToAction?.email ?? 'este usuário'}? Ele poderá acessar o sistema novamente.`
                }
            />
        </div>
    );
};

export default AdminPage;