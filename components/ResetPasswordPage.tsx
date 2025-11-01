import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AuthView } from '../types';
import { getErrorMessage } from '../lib/utils';

interface ResetPasswordPageProps {
    setAuthView: (view: AuthView) => void;
}

const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({ setAuthView }) => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        
        if (password.length < 6) {
            setError("A senha deve ter pelo menos 6 caracteres.");
            return;
        }
        if (password !== confirmPassword) {
            setError("As senhas não coincidem. Por favor, verifique.");
            return;
        }
        
        setLoading(true);
        setError(null);
        setSuccessMessage(null);
        
        try {
            // FIX: Updated to Supabase v2 API `updateUser` to match library version.
            const { error: updateError } = await supabase.auth.updateUser({ password });

            if (updateError) throw updateError;
            
            setSuccessMessage('Sua senha foi redefinida com sucesso! Você será redirecionado para a tela de login em alguns segundos.');
            
            setTimeout(async () => {
                // FIX: Reverted to Supabase v1 API `signOut` to fix method error.
                await supabase.auth.signOut();
                setAuthView('login');
                // We don't want the recovery hash in the URL on the login page.
                window.location.hash = ''; 
            }, 3000);

        } catch (err) {
            const errorMessage = getErrorMessage(err);
            console.error("Error resetting password:", err);
            setError(`Falha ao redefinir a senha: ${errorMessage}`);
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
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                        </svg>
                      </div>
                    </div>
                    <h1 className="text-3xl font-bold text-slate-800">
                        Redefinir Senha
                    </h1>
                    <p className="mt-2 text-slate-500">
                        Crie uma nova senha para acessar sua conta.
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleResetPassword}>
                    <div className="space-y-4">
                         <div>
                            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">Nova Senha</label>
                            <input
                                id="password" name="password" type="password" required
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-sm"
                                placeholder="Mínimo de 6 caracteres" value={password} onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                         <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-1">Confirme a Nova Senha</label>
                            <input
                                id="confirmPassword" name="confirmPassword" type="password" required
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-sm"
                                placeholder="Repita a nova senha" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                        </div>
                    </div>
                    
                    {error && <p className="text-sm text-red-600 text-center pt-4">{error}</p>}
                    {successMessage && <p className="text-sm text-green-600 text-center pt-4">{successMessage}</p>}

                    <div className="pt-2">
                        <button type="submit" disabled={loading || !!successMessage} className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400">
                            {loading ? 'Salvando...' : 'Salvar Nova Senha'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ResetPasswordPage;