import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AuthView } from '../types';
import logoNovaUrl from '../assets/icons/logonova.svg';

interface LoginPageProps {
    setAuthView: (view: AuthView) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ setAuthView }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [view, setView] = useState<'sign_in' | 'forgot_password'>('sign_in');

    const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccessMessage(null);
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (error) {
                throw error;
            }
        } catch (error: any) {
            if (error.message === 'Invalid login credentials') {
                setError('E-mail ou senha incorretos. Se você esqueceu sua senha, clique em "Esqueci minha senha" abaixo.');
            } else {
                setError(error.message || 'Falha ao fazer login.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordReset = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccessMessage(null);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email);
            if (error) {
                throw error;
            }
            setSuccessMessage('Se o e-mail estiver correto, você receberá um link para redefinir sua senha.');
        } catch (error: any) {
            setError(error.message || 'Falha ao enviar e-mail de recuperação.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 p-4">
            <div className="w-full max-w-md">
                <div className="flex items-center justify-center space-x-4 mb-6">
    <img src={logoNovaUrl} alt="Logo" className="h-16 w-auto" />
    <h1 className="text-3xl font-bold text-slate-800">Volunteers</h1>
</div>

                <div className="p-6 sm:p-8 space-y-8 bg-white rounded-2xl shadow-lg">
                    <div className="text-left">
                        <h1 className="text-3xl font-bold text-slate-800">
                            {view === 'sign_in' ? 'Entrar' : 'Recuperar Senha'}
                        </h1>
                        {view === 'sign_in' ? (
                            <p className="mt-2 text-slate-500">
                                Insira suas credenciais abaixo:
                            </p>
                        ) : (
                            <p className="mt-2 text-slate-500">
                                Digite seu e-mail para receber um link de recuperação de senha.
                            </p>
                        )}
                    </div>

                    {view === 'sign_in' ? (
                        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
                            <div className="-space-y-px">
                                <div>
                                    <label htmlFor="email-address" className="sr-only">Email</label>
                                    <input
                                        id="email-address" name="email" type="email" autoComplete="email" required
                                        className="appearance-none rounded-none relative block w-full px-3 py-3 border border-slate-300 placeholder-slate-500 text-slate-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                        placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="password-address" className="sr-only">Senha</label>
                                    <input
                                        id="password" name="password" type="password" autoComplete="current-password" required
                                        className="appearance-none rounded-none relative block w-full px-3 py-3 border border-slate-300 placeholder-slate-500 text-slate-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                        placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)}
                                    />
                                </div>
                            </div>

                            {error && <p className="text-sm text-red-600 text-center pt-4">{error}</p>}

                            <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <input id="remember-me" name="remember-me" type="checkbox" className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded" />
                                    <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-600">Permanecer conectado</label>
                                </div>
                                <div className="text-sm">
                                    <button type="button" onClick={() => { setView('forgot_password'); setError(null); }} className="font-medium text-blue-600 hover:text-blue-500">
                                        Esqueci minha senha
                                    </button>
                                </div>
                            </div>

                            <div className="pt-2">
                                <button type="submit" disabled={loading} className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400">
                                    {loading ? 'Entrando...' : 'Entrar'}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <form className="mt-8 space-y-6" onSubmit={handlePasswordReset}>
                            <div>
                                <label htmlFor="email-address-reset" className="sr-only">Email</label>
                                <input
                                    id="email-address-reset" name="email" type="email" autoComplete="email" required
                                    className="appearance-none relative block w-full px-3 py-3 border border-slate-300 placeholder-slate-500 text-slate-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                    placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>

                            {error && <p className="text-sm text-red-600 text-center pt-4">{error}</p>}
                            {successMessage && <p className="text-sm text-green-600 text-center pt-4">{successMessage}</p>}

                            <div className="pt-2">
                                <button type="submit" disabled={loading || !!successMessage} className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400">
                                    {loading ? 'Enviando...' : 'Enviar Link de Recuperação'}
                                </button>
                            </div>
                            <div className="text-center text-sm">
                               <button type="button" onClick={() => { setView('sign_in'); setError(null); setSuccessMessage(null); }} className="font-medium text-blue-600 hover:text-blue-500">
                                    Voltar para o Login
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LoginPage;