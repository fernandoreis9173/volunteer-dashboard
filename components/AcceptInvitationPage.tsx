import React, { useState, useEffect } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { AuthView } from '../types';

interface AcceptInvitationPageProps {
    supabase: SupabaseClient;
    setAuthView: (view: AuthView) => void;
}

export const AcceptInvitationPage: React.FC<AcceptInvitationPageProps> = ({ supabase, setAuthView }) => {
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    useEffect(() => {
        const hash = window.location.hash;
        if (!hash.includes('access_token')) {
            setError("Token de convite inválido ou ausente. Por favor, use o link do seu e-mail.");
        }
    }, []);

    const handleAcceptInvite = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!fullName.trim()) {
            setError("Por favor, insira seu nome completo.");
            return;
        }
        if (password.length < 6) {
            setError("A senha deve ter pelo menos 6 caracteres.");
            return;
        }

        setLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            // The user is already signed in via the magic link at this point.
            // We just need to update their password and metadata.
            const { data, error: updateError } = await supabase.auth.updateUser({
                password: password,
                data: {
                    name: fullName,
                    status: 'Ativo' // Set status to 'Ativo'
                }
            });

            if (updateError) {
                throw updateError;
            }

            setSuccessMessage('Sua conta foi ativada com sucesso! Você será redirecionado para o login em alguns segundos.');
            
            // Wait a bit, then sign out the temporary session from the magic link
            // and redirect to the login page so they can sign in properly.
            setTimeout(async () => {
                await supabase.auth.signOut();
                window.location.hash = ''; // Clear hash from URL
                setAuthView('login');
            }, 4000);

        } catch (error: any) {
            console.error("Error accepting invitation:", error);
            setError(error.message || 'Falha ao ativar sua conta. O link pode ter expirado ou já ter sido usado.');
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
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                           <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
                        </svg>
                      </div>
                    </div>
                    <h1 className="text-3xl font-bold text-slate-800">
                        Ative Sua Conta
                    </h1>
                    <p className="mt-2 text-slate-500">
                        Você foi convidado para o Sistema de Voluntários. Crie sua senha para começar.
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleAcceptInvite}>
                    <div className="rounded-md shadow-sm -space-y-px">
                        <div>
                            <label htmlFor="full-name" className="sr-only">Nome Completo</label>
                            <input
                                id="full-name" name="fullName" type="text" autoComplete="name" required
                                className="appearance-none rounded-none relative block w-full px-3 py-3 border border-slate-300 placeholder-slate-500 text-slate-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                placeholder="Nome Completo" value={fullName} onChange={(e) => setFullName(e.target.value)}
                            />
                        </div>
                        <div>
                            <label htmlFor="password" className="sr-only">Nova Senha</label>
                            <input
                                id="password" name="password" type="password" required
                                className="appearance-none rounded-none relative block w-full px-3 py-3 border border-slate-300 placeholder-slate-500 text-slate-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                placeholder="Crie sua senha (mínimo 6 caracteres)" value={password} onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    {error && <p className="text-sm text-red-600 text-center pt-4">{error}</p>}
                    {successMessage && <p className="text-sm text-green-600 text-center pt-4">{successMessage}</p>}

                    <div className="pt-2">
                        <button type="submit" disabled={loading || !!successMessage} className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400">
                            {loading ? 'Ativando...' : 'Ativar Conta e Entrar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};