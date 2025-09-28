import React, { useState, useEffect } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { User } from '@supabase/supabase-js';

interface AdminPageProps {
  supabase: SupabaseClient | null;
}

const AdminPage: React.FC<AdminPageProps> = ({ supabase }) => {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('leader'); // 'leader' or 'admin'
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    
    const [invitedUsers, setInvitedUsers] = useState<User[]>([]);
    const [listLoading, setListLoading] = useState(true);
    const [listError, setListError] = useState<string | null>(null);

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
            if (invitedUser) {
                // Manually create a user object to reflect the change immediately
                // FIX: Corrected a TypeScript type mismatch when creating a user object for an optimistic UI update. Casting to 'unknown' before 'User' resolves the error and is safe as the object has all properties required by the component's rendering logic.
                const newUser = {
                    id: invitedUser.id,
                    email: invitedUser.email,
                    invited_at: invitedUser.invited_at,
                    user_metadata: { role: role },
                    // Add other fields with default values if needed
                } as unknown as User;
                setInvitedUsers(prevUsers => [newUser, ...prevUsers.filter(u => u.id !== newUser.id)]);
            } else {
                fetchInvitedUsers(); // Fallback to refetch
            }
        }

        setLoading(false);
    };

    const formatDate = (dateString: string | undefined) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };
    
    const getRoleForDisplay = (user: User) => {
        const userRole = user.user_metadata?.role || user.user_metadata?.papel;
        if (userRole === 'admin') return 'Admin';
        if (userRole === 'leader' || userRole === 'líder') return 'Líder';
        return 'N/A';
    };


    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-slate-800">Painel Administrativo</h1>
                <p className="text-slate-500 mt-1">Gerencie o acesso e convide novos líderes para o sistema.</p>
            </div>
            
            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 max-w-2xl">
                 <div className="flex items-center space-x-3 mb-6">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <h2 className="text-2xl font-bold text-slate-800">Convidar Líder de Ministério</h2>
                </div>
                <p className="text-sm text-slate-600 mb-6">
                    Insira o e-mail do líder que você deseja convidar para o sistema. Ele receberá um link para criar sua conta e definir uma senha.
                </p>

                <form onSubmit={handleInviteSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="sm:col-span-2">
                            <label htmlFor="invite-email" className="block text-sm font-medium text-slate-700 mb-1">
                                E-mail do Líder
                            </label>
                            <input 
                                type="email" 
                                id="invite-email"
                                name="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="exemplo@igreja.com"
                                required
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-400 text-slate-900"
                            />
                        </div>
                        <div>
                            <label htmlFor="invite-role" className="block text-sm font-medium text-slate-700 mb-1">
                                Permissão
                            </label>
                            <select 
                                id="invite-role"
                                name="role"
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-slate-900"
                            >
                                <option value="leader">Líder de Ministério</option>
                                <option value="admin">Admin (Líder Geral)</option>
                            </select>
                        </div>
                    </div>
                    
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    {successMessage && <p className="text-sm text-green-600">{successMessage}</p>}
                    
                    <div className="pt-2">
                         <button 
                            type="submit"
                            disabled={loading}
                            className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg flex items-center justify-center space-x-2 hover:bg-blue-700 transition-colors shadow-sm disabled:bg-blue-400 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                                </svg>
                            )}
                            <span>{loading ? 'Enviando...' : 'Enviar Convite'}</span>
                        </button>
                    </div>
                </form>
            </div>
            
            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
                 <div className="flex items-center space-x-3 mb-6">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                       <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283-.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <h2 className="text-2xl font-bold text-slate-800">Líderes Convidados</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Email</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Data do Convite</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Permissão</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {listLoading ? (
                                <tr><td colSpan={4} className="px-6 py-4 text-center text-slate-500">Carregando...</td></tr>
                            ) : listError ? (
                                <tr><td colSpan={4} className="px-6 py-4 text-center text-red-500">{listError}</td></tr>
                            ) : invitedUsers.length === 0 ? (
                                <tr><td colSpan={4} className="px-6 py-4 text-center text-slate-500">Nenhum líder convidado ainda.</td></tr>
                            ) : (
                                invitedUsers.map(user => (
                                    <tr key={user.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{user.email}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{formatDate(user.invited_at)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-semibold">{getRoleForDisplay(user)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            {user.last_sign_in_at ? (
                                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                                    Aceito
                                                </span>
                                            ) : (
                                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                                    Pendente
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AdminPage;