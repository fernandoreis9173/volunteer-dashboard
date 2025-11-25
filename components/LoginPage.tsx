import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AuthView } from '../types';
import { LogoMobileIcon } from '../assets/icons';

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
    const [rememberMe, setRememberMe] = useState(true);

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
            if (rememberMe) {
                sessionStorage.removeItem('supabase.auth.no-persist');
            } else {
                sessionStorage.setItem('supabase.auth.no-persist', 'true');
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

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError(null);
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin,
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    },
                },
            });
            if (error) throw error;
        } catch (error: any) {
            setError(error.message || 'Falha ao conectar com Google.');
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
                <div className="flex justify-center items-center mb-6 space-x-1">
                    <img src={LogoMobileIcon} alt="Logo" className="h-14 w-14" />
                    <span className="text-2xl font-bold text-slate-800">Volunteers</span>
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
                                    <input
                                        id="remember-me"
                                        name="remember-me"
                                        type="checkbox"
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                    />
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

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-slate-300"></div>
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="px-2 bg-white text-slate-500">Ou continue com</span>
                                </div>
                            </div>

                            <div>
                                <button
                                    type="button"
                                    onClick={handleGoogleLogin}
                                    disabled={loading}
                                    className="w-full flex items-center justify-center px-4 py-3 border border-slate-300 shadow-sm text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                                >
                                    <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                                        <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                                            <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z" />
                                            <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z" />
                                            <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.734 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.489 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.989 -25.464 56.619 L -21.484 53.529 Z" />
                                            <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z" />
                                        </g>
                                    </svg>
                                    Entrar com Google
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