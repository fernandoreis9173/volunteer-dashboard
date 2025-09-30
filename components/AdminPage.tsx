import React, { useState, useEffect } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { User } from '@supabase/supabase-js';
import EditUserModal from './EditUserModal';
import ConfirmationModal from './ConfirmationModal';

interface AdminPageProps {
  supabase: SupabaseClient | null;
}

const AdminPage: React.FC<AdminPageProps> = ({ supabase }) => {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('leader');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    
    const [invitedUsers, setInvitedUsers] = useState<User[]>([]);
    const [listLoading, setListLoading] = useState(true);
    const [listError, setListError] = useState<string | null>(null);

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [activeMenu, setActiveMenu] = useState<string | null>(null);

    const [isActionModalOpen, setIsActionModalOpen] = useState(false);
    const [userToAction, setUserToAction] = useState<User | null>(null);
    const [actionType, setActionType] = useState<'disable' | 'enable' | null>(null);


    const fetchInvitedUsers = async () => {
        if (!supabase) return;
        setListLoading(true);
        setListError(null);
        
        const { data, error: fetchError } = await supabase.functions.invoke('list-invited-users');

        if (fetchError) {
            setListError('Falha ao carregar a lista de convidados.');
            console.error('Error fetching invited users:', fetchError);
        } else {
            setInvitedUsers(data.users || []);
        }
        setListLoading(false);
    };

    useEffect(() => {
        fetchInvitedUsers();
    }, [supabase]);


    const handleInviteSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) {
            setError('Por favor, insira um endereço de e-mail válido.');
            return;
        }
        if (!supabase) {
            setError('Cliente Supabase não inicializado.');
            return;
        }

        setLoading(true);
        setError(null);
        setSuccessMessage(null);

        const { data: invitedUser, error: invokeError } = await supabase.functions.invoke('invite-user', {
            body: { email, role },
        });

        if (invokeError) {
            console.error('Error inviting user:', invokeError);
            setError(`Falha ao enviar convite: ${invokeError.message}`);
        } else {
            setSuccessMessage(`Convite enviado com sucesso para ${email}!`);
            setEmail('');
            setRole('leader');
            await fetchInvitedUsers();
        }

        setLoading(false);
    };
    
    const handleUpdateUser = async (userId: string, newRole: string, newPermissions: string[]) => {
        if (!supabase) return;
        
        const { data, error } = await supabase.functions.invoke('update-user-permissions', {
            body: { userId, role: newRole, permissions: newPermissions }
        });

        if (error) {
            alert(`Falha ao atualizar permissões: ${error.message}`);
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
        if (!userToAction || !actionType || !supabase) return;
        
        const functionName = actionType === 'disable' ? 'disable-user' : 'enable-user';

        const { error } = await supabase.functions.invoke(functionName, {
            body: { userId: userToAction.id }
        });

        if (error) {
            alert(`Falha ao ${actionType === 'disable' ? 'desativar' : 'reativar'} usuário: ${error.message}`);
        } else {
            await fetchInvitedUsers();
        }

        setIsActionModalOpen(false);
        setUserToAction(null);
        setActionType(null);
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
        if (userRole === 'leader' || userRole === 'líder') return 'Líder';
        return 'N/A';
    };
    
    const getStatusBadge = (user: User) => {
        const isBanned = user.banned_until && new Date(user.banned_until) > new Date();
        if (isBanned) {
            return <span className="px-2 text-xs font-semibold rounded-full bg-red-100 text-red-800">Inativo</span>;
        }
        if (user.last_sign_in_at) {
            return <span className="px-2 text-xs font-semibold rounded-full bg-green-100 text-green-800">Aceito</span>;
        }
        return <span className="px-2 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Pendente</span>;
    };


    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-slate-800">Painel Administrativo</h1>
                <p className="text-slate-500 mt-1">Gerencie o acesso e convide novos líderes para o sistema.</p>
            </div>
            
            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 max-w-2xl">
                 <div className="flex items-center space-x-3 mb-6">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    <h2 className="text-2xl font-bold text-slate-800">Convidar Líder de Ministério</h2>
                </div>
                <p className="text-sm text-slate-600 mb-6">Insira o e-mail do líder que você deseja convidar. Ele receberá um link para criar sua conta e definir uma senha.</p>
                <form onSubmit={handleInviteSubmit} className="space-y-4">
                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="sm:col-span-2">
                            <label htmlFor="invite-email" className="block text-sm font-medium text-slate-700 mb-1">E-mail do Líder</label>
                            <input type="email" id="invite-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="exemplo@igreja.com" required className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900" />
                        </div>
                        <div>
                            <label htmlFor="invite-role" className="block text-sm font-medium text-slate-700 mb-1">Permissão</label>
                            <select id="invite-role" value={role} onChange={(e) => setRole(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900">
                                <option value="leader">Líder de Ministério</option>
                                <option value="admin">Admin (Líder Geral)</option>
                            </select>
                        </div>
                    </div>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    {successMessage && <p className="text-sm text-green-600">{successMessage}</p>}
                    <div className="pt-2">
                         <button type="submit" disabled={loading} className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg flex items-center justify-center space-x-2 hover:bg-blue-700 disabled:bg-blue-400">
                            {loading ? <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" /><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" /></svg>}
                            <span>{loading ? 'Enviando...' : 'Enviar Convite'}</span>
                        </button>
                    </div>
                </form>
            </div>
            
            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
                 <div className="flex items-center space-x-3 mb-6">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656-.126-1.283-.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    <h2 className="text-2xl font-bold text-slate-800">Líderes Convidados</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Email</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Data do Convite</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Permissão</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {listLoading ? (
                                <tr><td colSpan={5} className="px-6 py-4 text-center">Carregando...</td></tr>
                            ) : listError ? (
                                <tr><td colSpan={5} className="px-6 py-4 text-center text-red-500">{listError}</td></tr>
                            ) : invitedUsers.map(user => {
                                const isBanned = user.banned_until && new Date(user.banned_until) > new Date();
                                return (
                                <tr key={user.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{user.email}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{formatDate(user.invited_at)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-semibold">{getRoleForDisplay(user)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">{getStatusBadge(user)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium relative">
                                        <button onClick={() => setActiveMenu(activeMenu === user.id ? null : user.id)} className="text-slate-500 hover:text-slate-700">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
                                        </button>
                                        {activeMenu === user.id && (
                                            <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                                                <div className="py-1" role="menu" aria-orientation="vertical">
                                                    <button onClick={() => { setEditingUser(user); setIsEditModalOpen(true); setActiveMenu(null); }} className="w-full text-left block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Editar Permissões</button>
                                                    {isBanned ? (
                                                        <button onClick={() => handleRequestAction(user, 'enable')} className="w-full text-left block px-4 py-2 text-sm text-green-700 hover:bg-green-50">Reativar Líder</button>
                                                    ) : (
                                                        <button onClick={() => handleRequestAction(user, 'disable')} className="w-full text-left block px-4 py-2 text-sm text-red-700 hover:bg-red-50">Desativar Líder</button>
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
                    ? `Tem certeza que deseja desativar ${userToAction?.email}? Ele não poderá mais fazer login no sistema.`
                    : `Tem certeza que deseja reativar ${userToAction?.email}? Ele poderá acessar o sistema novamente.`
                }
            />
        </div>
    );
};

export default AdminPage;