import React, { useState, useEffect } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { AuthView } from '../types';

interface AcceptInvitationPageProps {
    supabase: SupabaseClient;
    setAuthView: (view: AuthView) => void;
}

const AcceptInvitationPage: React.FC<AcceptInvitationPageProps> = ({ supabase, setAuthView }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    
    useEffect(() => {
        // Supabase session context is available here after the PASSWORD_RECOVERY event
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user?.email) {
                setEmail(session.user.email);
            }
        });
    }, [supabase]);

    const handleUpdateUser = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        
        if (password !== confirmPassword) {
            setError('As senhas não coincidem.');
            return;
        }
        if (password.length < 6) {
            setError('A senha deve ter pelo menos 6 caracteres.');
            return;
        }
        if (!name.trim()) {
            setError('Por favor, insira seu nome completo.');
            return;
        }

        setLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const { data: updateData, error: updateError } = await supabase.auth.updateUser({
                password: password,
                data: { name: name.trim() } // This updates user_metadata
            });

            if (updateError) {
                throw updateError;
            }
            const user = updateData.user;
            if (!user) {
                throw new Error("Não foi possível obter os dados do usuário após a atualização.");
            }
            
            // Create the corresponding leader profile
            const nameParts = name.trim().split(' ');
            const initials = ((nameParts[0]?.[0] || '') + (nameParts.length > 1 ? nameParts[nameParts.length - 1]?.[0] || '' : '')).toUpperCase();

            const { error: insertError } = await supabase
                .from('leaders')
                .insert({
                    user_id: user.id,
                    name: name.trim(),
                    email: email,
                    status: 'Ativo',
                    initials: initials,
                    phone: '',
                    ministries: [],
                    skills: [],
                    availability: [],
                });

            if (insertError) {
                console.error("Failed to create leader profile:", insertError);
                // Throw an error to be caught by the catch block, stopping the success flow.
                throw new Error("Sua conta foi criada, mas houve um problema ao criar seu perfil de líder. Por favor, contate o suporte.");
            }


            setSuccessMessage('Sua conta foi criada com sucesso! Você será redirecionado para o login.');
            
            // Sign out the temporary session to force a fresh login
            await supabase.auth.signOut();

            setTimeout(() => {
                window.location.hash = ''; // Clear the hash to avoid re-entering this page
                setAuthView('login');
            }, 3000);

        } catch (error: any) {
            setError(error.message || 'Falha ao atualizar a conta.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 p-4">
            <div className="w-full max-w-md p-6 sm:p-8 space-y-8 bg-white rounded-2xl shadow-lg">
                <div className="text-center">
                    <div className="flex justify-center mb-4">
                      <div className="p-3 bg-blue-600 text-white rounded-xl">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </div>
                    </div>
                    <h1 className="text-3xl font-bold text-slate-800">
                       Aceitar Convite
                    </h1>
                    <p className="mt-2 text-slate-500">Bem-vindo! Finalize seu cadastro.</p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleUpdateUser}>
                    <div className="rounded-md shadow-sm -space-y-px">
                        <div>
                            <label htmlFor="email-address" className="sr-only">Email</label>
                            <input
                                id="email-address" name="email" type="email" required disabled
                                className="appearance-none rounded-none relative block w-full px-3 py-3 border border-slate-300 bg-slate-100 text-slate-500 rounded-t-md focus:outline-none sm:text-sm"
                                placeholder="Email" value={email}
                            />
                        </div>
                         <div>
                            <label htmlFor="full-name" className="sr-only">Nome Completo</label>
                            <input
                                id="full-name" name="name" type="text" autoComplete="name" required
                                className="appearance-none rounded-none relative block w-full px-3 py-3 border border-slate-300 placeholder-slate-500 text-slate-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                placeholder="Nome Completo" value={name} onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                        <div>
                            <label htmlFor="password-new" className="sr-only">Nova Senha</label>
                            <input
                                id="password-new" name="password" type="password" required
                                className="appearance-none rounded-none relative block w-full px-3 py-3 border border-slate-300 placeholder-slate-500 text-slate-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                placeholder="Crie uma senha" value={password} onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                        <div>
                            <label htmlFor="password-confirm" className="sr-only">Confirmar Senha</label>
                            <input
                                id="password-confirm" name="password-confirm" type="password" required
                                className="appearance-none rounded-none relative block w-full px-3 py-3 border border-slate-300 placeholder-slate-500 text-slate-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                placeholder="Confirme sua senha" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    {error && <p className="text-sm text-red-600 text-center">{error}</p>}
                    {successMessage && <p className="text-sm text-green-600 text-center">{successMessage}</p>}
                    
                    <div>
                        <button type="submit" disabled={loading || !!successMessage} className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400">
                            {loading ? 'Finalizando...' : 'Finalizar Cadastro'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AcceptInvitationPage;