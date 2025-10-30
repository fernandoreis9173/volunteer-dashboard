import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
// FIX: Restored Supabase v2 types for type safety.
import { type Session, type User } from '@supabase/supabase-js';
import { DetailedVolunteer } from '../types';
// FIX: Import 'formatPhoneNumber' from utils to resolve reference errors.
import { getErrorMessage, parseArrayFromString, formatPhoneNumber } from '../lib/utils';

interface UserProfilePageProps {
    session: Session | null;
    onUpdate: () => void;
    leaders: User[];
}

const Tag: React.FC<{ children: React.ReactNode; color: 'yellow' | 'blue' }> = ({ children, color }) => {
  const baseClasses = "px-3 py-1 text-sm font-semibold rounded-full";
  const colorClasses = {
    yellow: "bg-yellow-100 text-yellow-800",
    blue: "bg-blue-100 text-blue-800",
  };
  return <span className={`${baseClasses} ${colorClasses[color]}`}>{children}</span>
};

const UserProfilePage: React.FC<UserProfilePageProps> = ({ session, onUpdate, leaders }) => {
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const [departmentDetails, setDepartmentDetails] = useState<{ name: string; leader: string | null }[]>([]);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    
    const user = session?.user;
    const userRole = user?.user_metadata?.role;
    const roleDisplay = userRole === 'admin' ? 'Administrador' : 'Líder';

    const fetchProfileData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        setError(null);
        setName(user.user_metadata?.name || '');
        setPhone(user.user_metadata?.phone || '');
        
        try {
            if (userRole === 'leader' || userRole === 'lider') {
                const { data: leaderDeptRel, error: leaderDeptRelError } = await supabase
                    .from('department_leaders')
                    .select('department_id')
                    .eq('leader_id', user.id)
                    .single();
    
                if (leaderDeptRelError) throw leaderDeptRelError;
                
                const departmentId = leaderDeptRel.department_id;
    
                if (departmentId) {
                    const { data: departmentData, error: departmentError } = await supabase
                        .from('departments')
                        .select('id, name')
                        .eq('id', departmentId)
                        .single();
                    
                    if (departmentError) throw departmentError;
    
                    const leaderForDept = leaders.find(l => l.id === user.id);
                    
                    setDepartmentDetails([{
                        name: departmentData.name,
                        leader: leaderForDept?.user_metadata?.name || 'Não atribuído'
                    }]);
                } else {
                    setDepartmentDetails([]);
                }
            }
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    }, [user, userRole, leaders]);

    useEffect(() => {
        fetchProfileData();
    }, [fetchProfileData]);
    
    const showSuccess = (message: string) => {
        setSuccessMessage(message);
        setTimeout(() => setSuccessMessage(null), 3000);
    };

    const handleSaveProfile = async () => {
        if (!user || !name.trim()) return;
        setIsSaving(true);
        setError(null);
        try {
            // Step 1: Update the user's auth metadata (name, phone)
            // FIX: Updated to Supabase v2 API `updateUser` to match library version.
            const { error: updateError } = await supabase.auth.updateUser({
                data: { 
                    name: name.trim(),
                    phone: phone.replace(/[^\d]/g, '')
                }
            });
            if (updateError) throw updateError;
            
            // Step 2: Refresh UI and show success
            onUpdate(); // Refreshes sidebar etc.
            setIsEditingProfile(false);
            showSuccess('Perfil atualizado com sucesso!');
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setIsSaving(false);
        }
    };

    const handleSavePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!currentPassword) {
            setError('Por favor, informe sua senha atual.');
            return;
        }
        if (password.length < 6) {
            setError('A nova senha deve ter pelo menos 6 caracteres.');
            return;
        }
        if (password !== confirmPassword) {
            setError('As novas senhas não coincidem.');
            return;
        }

        setIsSaving(true);
        try {
            if (!user?.email) {
                throw new Error("Email do usuário não encontrado para verificação.");
            }

            // 1. Verify current password by attempting to sign in.
            // FIX: Updated to Supabase v2 API `signInWithPassword` to match library version.
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: currentPassword,
            });

            if (signInError) {
                if (signInError.message === 'Invalid login credentials') {
                    throw new Error('Sua senha atual está incorreta.');
                }
                throw signInError; // Throw other potential sign-in errors
            }

            // 2. If verification is successful, update to the new password.
            // FIX: Updated to Supabase v2 API `updateUser` to match library version.
            const { error: updateError } = await supabase.auth.updateUser({ password });
            if (updateError) throw updateError;

            // Reset all fields and close the form on success
            setPassword('');
            setConfirmPassword('');
            setCurrentPassword('');
            setIsChangingPassword(false);
            showSuccess('Senha alterada com sucesso!');

        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setIsSaving(false);
        }
    };
    
    const getInitials = (nameStr?: string): string => {
        if (!nameStr) return '??';
        const parts = nameStr.trim().split(' ');
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[0][0] + (parts[parts.length - 1][0] || '')).toUpperCase();
    };
    
    const cancelPasswordChange = () => {
        setIsChangingPassword(false);
        setError(null);
        setCurrentPassword('');
        setPassword('');
        setConfirmPassword('');
    };


    if (loading) {
        return <div className="text-center p-8">Carregando perfil...</div>;
    }

    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold text-slate-800">Meu Perfil</h1>
            
            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                    <div className="w-24 h-24 rounded-full bg-blue-600 flex-shrink-0 flex items-center justify-center text-white font-bold text-4xl">
                        {getInitials(user?.user_metadata?.name)}
                    </div>
                    <div className="flex-1 text-center sm:text-left">
                        {isEditingProfile ? (
                             <div className="space-y-2">
                                <input 
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="text-2xl font-bold text-slate-800 border-b-2 border-blue-500 focus:outline-none bg-transparent"
                                />
                                <input
                                    type="tel"
                                    value={formatPhoneNumber(phone)}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="(xx) xxxxx-xxxx"
                                    className="text-base text-slate-500 border-b-2 border-blue-500 focus:outline-none bg-transparent w-full"
                                />
                             </div>
                        ) : (
                            <>
                                <h2 className="text-3xl font-bold text-slate-800">{user?.user_metadata?.name}</h2>
                                <p className="text-slate-500 mt-1">{user?.email}</p>
                                <p className="text-slate-500 mt-1">{formatPhoneNumber(phone) || 'Telefone não informado'}</p>
                            </>
                        )}
                        <div className="mt-2 flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                            <span className="px-3 py-1 text-sm font-semibold rounded-full bg-indigo-100 text-indigo-800">{roleDisplay}</span>
                            {departmentDetails.map(dept => (
                                <span key={dept.name} className="px-3 py-1 text-sm font-semibold rounded-full bg-slate-100 text-slate-700">{dept.name}</span>
                            ))}
                            {departmentDetails.length === 0 && (userRole === 'leader' || userRole === 'lider') && (
                                <span className="px-3 py-1 text-sm font-semibold rounded-full bg-slate-100 text-slate-700">Nenhum departamento</span>
                            )}
                        </div>
                    </div>
                     <div className="flex items-center gap-2 mt-4 sm:mt-0">
                        {isEditingProfile ? (
                            <>
                                <button onClick={handleSaveProfile} disabled={isSaving} className="px-4 py-2 bg-green-500 text-white font-semibold rounded-lg text-sm disabled:bg-green-300">Salvar</button>
                                <button onClick={() => { setIsEditingProfile(false); setName(user?.user_metadata?.name || ''); setPhone(user?.user_metadata?.phone || ''); }} className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg text-sm">Cancelar</button>
                            </>
                        ) : (
                            <button onClick={() => setIsEditingProfile(true)} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 text-sm">
                                Editar Perfil
                            </button>
                        )}
                    </div>
                </div>

                <div className="mt-8 pt-8 border-t border-slate-200">
                    <h3 className="text-xl font-bold text-slate-800">Segurança</h3>
                    {isChangingPassword ? (
                        <form onSubmit={handleSavePassword} className="mt-4 space-y-4 max-w-sm">
                             <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Senha Atual *</label>
                                <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nova Senha *</label>
                                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Mínimo de 6 caracteres" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"/>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar Nova Senha *</label>
                                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"/>
                            </div>
                            {error && <p className="text-sm text-red-500">{error}</p>}
                             <div className="flex items-center gap-2 pt-2">
                                <button type="submit" disabled={isSaving} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg text-sm disabled:bg-blue-400">
                                    {isSaving ? 'Salvando...' : 'Salvar Senha'}
                                </button>
                                <button type="button" onClick={cancelPasswordChange} className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg text-sm">
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div className="mt-4 flex items-center justify-between">
                            <p className="text-slate-600">Altere sua senha de acesso ao sistema.</p>
                            <button onClick={() => setIsChangingPassword(true)} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 text-sm">
                                Alterar Senha
                            </button>
                        </div>
                    )}
                </div>

                {successMessage && (
                     <div className="fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg animate-fade-in-scale">
                        {successMessage}
                     </div>
                )}
            </div>
            <style>{`
                @keyframes fade-in-scale {
                from { opacity: 0; transform: translateY(10px) scale(0.98); }
                to { opacity: 1; transform: translateY(0) scale(1); }
                }
                .animate-fade-in-scale {
                animation: fade-in-scale 0.3s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

export default UserProfilePage;