import React, { useState } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';

interface SignUpPageProps {
    supabase: SupabaseClient;
    onSwitchToLogin: () => void;
}

const SignUpPage: React.FC<SignUpPageProps> = ({ supabase, onSwitchToLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError('As senhas não coincidem.');
            return;
        }
        setLoading(true);
        setError(null);
        setSuccessMessage(null);
        try {
            const { error } = await supabase.auth.signUp({
                email,
                password,
            });
            if (error) {
                throw error;
            }
            setSuccessMessage('Cadastro realizado com sucesso! Verifique seu email para confirmar a conta.');
        } catch (error: any) {
            setError(error.message || 'Falha ao criar a conta.');
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
                          <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                      </div>
                    </div>
                    <h1 className="text-3xl font-bold text-slate-800">Criar Conta</h1>
                    <p className="mt-2 text-slate-500">Sistema de Voluntários da Igreja</p>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleSignUp}>
                    <div className="-space-y-px">
                        <div>
                            <label htmlFor="email-address-signup" className="sr-only">Email</label>
                            <input
                                id="email-address-signup"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                className="appearance-none rounded-none relative block w-full px-3 py-3 border border-slate-300 placeholder-slate-500 text-slate-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                placeholder="Email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div>
                            <label htmlFor="password-signup" className="sr-only">Senha</label>
                            <input
                                id="password-signup"
                                name="password"
                                type="password"
                                autoComplete="new-password"
                                required
                                className="appearance-none rounded-none relative block w-full px-3 py-3 border border-slate-300 placeholder-slate-500 text-slate-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                placeholder="Senha"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                         <div>
                            <label htmlFor="confirm-password-signup" className="sr-only">Confirmar Senha</label>
                            <input
                                id="confirm-password-signup"
                                name="confirmPassword"
                                type="password"
                                autoComplete="new-password"
                                required
                                className="appearance-none rounded-none relative block w-full px-3 py-3 border border-slate-300 placeholder-slate-500 text-slate-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                placeholder="Confirmar Senha"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    {error && (
                        <p className="text-sm text-red-600 text-center pt-4">{error}</p>
                    )}
                    {successMessage && (
                         <p className="text-sm text-green-600 text-center pt-4">{successMessage}</p>
                    )}

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={loading || !!successMessage}
                            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400"
                        >
                            {loading ? 'Criando...' : 'Criar Conta'}
                        </button>
                    </div>
                </form>
                <p className="mt-4 text-center text-sm text-slate-600">
                    Já tem uma conta?{' '}
                    <button 
                        type="button" 
                        onClick={onSwitchToLogin} 
                        className="font-medium text-blue-600 hover:text-blue-500 focus:outline-none focus:underline"
                    >
                        Faça login
                    </button>
                </p>
            </div>
        </div>
    );
};

export default SignUpPage;