import React, { useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AuthView } from '../types';

import { LogoMobileIcon, VolunteerIcon, CalendarIcon, RankingIcon } from '../assets/icons';

// ... (existing code)

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

    const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setEmail(e.target.value);
    }, []);

    const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setPassword(e.target.value);
    }, []);

    const handleRememberMeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setRememberMe(e.target.checked);
    }, []);

    const handleLogin = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
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
    }, [email, password, rememberMe]);

    const handleGoogleLogin = useCallback(async () => {
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
    }, []);

    const handlePasswordReset = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
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
    }, [email]);

    return (
        <div className="min-h-screen w-full flex bg-white font-sans overflow-hidden">
            {/* Left Side - Form */}
            <div className="w-full lg:w-1/2 flex flex-col items-center px-6 pt-8 pb-8 lg:p-24 bg-white relative z-10 min-h-screen overflow-y-auto">
                <div className="w-full max-w-md space-y-6 lg:space-y-8 my-auto">
                    {/* Header */}
                    <div className="text-left">
                        <div className="flex items-center gap-3 mb-6 lg:mb-8">
                            <img src={LogoMobileIcon} alt="Logo" className="h-12 w-12 lg:h-16 lg:w-16" />
                            <span className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">Volunteers</span>
                        </div>
                        <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-2">
                            {view === 'sign_in' ? 'Login' : 'Recuperar Senha'}
                        </h1>
                        <p className="text-slate-500 text-base lg:text-lg">
                            {view === 'sign_in'
                                ? 'Bem-vindo de volta! Por favor, insira seus dados.'
                                : 'Insira seu email para receber as instruções de recuperação.'}
                        </p>
                    </div>

                    {/* Google Button */}
                    {view === 'sign_in' && (
                        <>
                            <button
                                onClick={handleGoogleLogin}
                                disabled={loading}
                                className="w-full flex items-center justify-center px-4 py-3 border border-slate-200 rounded-full text-slate-700 font-medium hover:bg-slate-50 transition-all duration-200 shadow-sm hover:shadow-md"
                            >
                                <svg className="h-5 w-5 mr-3" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                                    <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                                        <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z" />
                                        <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z" />
                                        <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.734 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.489 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.989 -25.464 56.619 L -21.484 53.529 Z" />
                                        <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z" />
                                    </g>
                                </svg>
                                Entrar com Google
                            </button>

                            <div className="relative flex py-2 items-center">
                                <div className="flex-grow border-t border-slate-200"></div>
                                <span className="flex-shrink-0 mx-4 text-slate-400 text-sm">ou Entrar com Email</span>
                                <div className="flex-grow border-t border-slate-200"></div>
                            </div>
                        </>
                    )}

                    {/* Form */}
                    <form className="space-y-6" onSubmit={view === 'sign_in' ? handleLogin : handlePasswordReset}>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="email-address" className="block text-sm font-medium text-slate-700 ml-1 mb-1">Email</label>
                                <input
                                    id="email-address" name="email" type="email" autoComplete="email" required
                                    className="appearance-none block w-full px-4 py-3 border border-slate-200 rounded-full placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="seu@email.com" value={email} onChange={handleEmailChange}
                                />
                            </div>
                            {view === 'sign_in' && (
                                <div>
                                    <label htmlFor="password" className="block text-sm font-medium text-slate-700 ml-1 mb-1">Senha</label>
                                    <input
                                        id="password" name="password" type="password" autoComplete="current-password" required
                                        className="appearance-none block w-full px-4 py-3 border border-slate-200 rounded-full placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="••••••••" value={password} onChange={handlePasswordChange}
                                    />
                                </div>
                            )}
                        </div>

                        {error && <p className="text-sm text-red-600 text-center bg-red-50 p-3 rounded-lg">{error}</p>}
                        {successMessage && <p className="text-sm text-green-600 text-center bg-green-50 p-3 rounded-lg">{successMessage}</p>}

                        {view === 'sign_in' && (
                            <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <input
                                        id="remember-me"
                                        name="remember-me"
                                        type="checkbox"
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                                        checked={rememberMe}
                                        onChange={handleRememberMeChange}
                                    />
                                    <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-600">Lembrar de mim</label>
                                </div>
                                <div className="text-sm">
                                    <button type="button" onClick={() => { setView('forgot_password'); setError(null); }} className="font-medium text-blue-600 hover:text-blue-500 transition-colors">
                                        Esqueceu a senha?
                                    </button>
                                </div>
                            </div>
                        )}

                        <button type="submit" disabled={loading} className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-full text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 shadow-lg shadow-blue-600/30 transition-all hover:shadow-xl hover:-translate-y-0.5">
                            {loading ? 'Processando...' : (view === 'sign_in' ? 'Entrar' : 'Enviar Link')}
                        </button>

                        {view === 'forgot_password' && (
                            <div className="text-center">
                                <button type="button" onClick={() => { setView('sign_in'); setError(null); setSuccessMessage(null); }} className="text-sm font-medium text-blue-600 hover:text-blue-500 transition-colors">
                                    Voltar para o Login
                                </button>
                            </div>
                        )}
                    </form>


                </div>
            </div>

            {/* Right Side - Visuals */}
            <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-blue-600 to-indigo-700 relative overflow-hidden flex-col justify-center items-center p-12 text-white">
                {/* Simple Background Elements */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full -mr-48 -mt-48"></div>
                    <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-400 rounded-full -ml-40 -mb-40"></div>
                </div>

                {/* Central Logo */}
                <div className="relative z-10 mb-12">
                    <div className="w-32 h-32 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/30">
                        <img src={LogoMobileIcon} className="h-16 w-16" alt="Logo" />
                    </div>
                </div>

                {/* Text Content */}
                <div className="relative z-10 text-center max-w-md">
                    <h2 className="text-4xl font-bold mb-4">Conectando Propósitos</h2>
                    <p className="text-blue-100 text-lg leading-relaxed">
                        Gerencie escalas, acompanhe frequências e engaje seus voluntários em um só lugar.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;