import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { type Session, type User } from '@supabase/supabase-js';
import { DetailedVolunteer } from '../types';
import { getErrorMessage, parseArrayFromString } from '../lib/utils';

interface UserProfilePageProps {
    session: Session | null;
    onUpdate: () => void;
    leaders: User[];
}

const formatPhoneNumber = (value: string) => {
    if (!value) return '';
    const cleaned = value.replace(/\D/g, '');
    // Formato: 55995199962 -> (+55) 99519-9962
    if (cleaned.length === 11 && cleaned.startsWith('55')) {
        const part1 = cleaned.substring(2, 7);
        const part2 = cleaned.substring(7);
        return `(+55) ${part1}-${part2}`;
    }

    // Formato: 5511999999999 -> (+55) 11 99999-9999
    if (cleaned.length === 13 && cleaned.startsWith('55')) {
        const ddd = cleaned.substring(2, 4);
        const part1 = cleaned.substring(4, 9);
        const part2 = cleaned.substring(9);
        return `(+55) ${ddd} ${part1}-${part2}`;
    }

    // Formato: 551199999999 -> (+55) 11 9999-9999
    if (cleaned.length === 12 && cleaned.startsWith('55')) {
        const ddd = cleaned.substring(2, 4);
        const part1 = cleaned.substring(4, 8);
        const part2 = cleaned.substring(8);
        return `(+55) ${ddd} ${part1}-${part2}`;
    }

    // Fallback para formatação simples se não começar com 55 ou tiver tamanho diferente
    const phoneNumber = cleaned.slice(0, 11);
    const { length } = phoneNumber;
    if (length <= 2) return `(${phoneNumber}`;
    if (length <= 6) return `(${phoneNumber.slice(0, 2)}) ${phoneNumber.slice(2)}`;
    if (length <= 10) return `(${phoneNumber.slice(0, 2)}) ${phoneNumber.slice(2, 6)}-${phoneNumber.slice(6)}`;
    return `(${phoneNumber.slice(0, 2)}) ${phoneNumber.slice(2, 7)}-${phoneNumber.slice(7)}`;

};

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
    const [defaultMapIframe, setDefaultMapIframe] = useState('');
    const [defaultLocationName, setDefaultLocationName] = useState('');

    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    const userId = session?.user?.id; // Use stable userId for dependency
    const user = session?.user;
    const userRole = user?.user_metadata?.role;
    const roleDisplay = userRole === 'admin' ? 'Administrador' : 'Líder';

    useEffect(() => {
        const fetchProfileData = async () => {
            if (!session?.user) return;
            const currentUser = session.user;
            const currentUserRole = currentUser.user_metadata?.role;

            setLoading(true);
            setError(null);
            setName(currentUser.user_metadata?.name || '');
            setPhone(currentUser.user_metadata?.phone || '');

            try {
                if (currentUserRole === 'leader' || currentUserRole === 'lider') {
                    // 1. Get the leader's department (assuming 1 leader -> 1 department constraint)
                    const { data: leaderDeptRel, error: leaderDeptRelError } = await supabase
                        .from('department_leaders')
                        .select('department_id')
                        .eq('user_id', currentUser.id)
                        .single();

                    if (leaderDeptRelError && leaderDeptRelError.code !== 'PGRST116') throw leaderDeptRelError;

                    const departmentId = leaderDeptRel?.department_id;

                    if (departmentId) {
                        // 2. Get department details
                        const { data: departmentData, error: departmentError } = await supabase
                            .from('departments')
                            .select('id, name')
                            .eq('id', departmentId)
                            .single();

                        if (departmentError) throw departmentError;

                        // 3. Get ALL leaders for this department
                        const { data: allLeadersRel, error: allLeadersError } = await supabase
                            .from('department_leaders')
                            .select('user_id')
                            .eq('department_id', departmentId);

                        if (allLeadersError) throw allLeadersError;

                        // 4. Map leader IDs to names using the 'leaders' prop
                        const leaderIds = allLeadersRel.map(r => r.user_id);
                        const departmentLeadersNames = leaders
                            .filter(l => leaderIds.includes(l.id))
                            .map(l => l.user_metadata?.name)
                            .filter(Boolean)
                            .join(', ');

                        setDepartmentDetails([{
                            name: departmentData.name,
                            leader: departmentLeadersNames || 'Não atribuído'
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
        };

        if (userId) {
            fetchProfileData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, leaders]);

    useEffect(() => {
        const fetchMap = async () => {
            if (userId) {
                const { data } = await supabase
                    .from('profiles')
                    .select('default_map_iframe, default_location_data')
                    .eq('id', userId)
                    .single();
                if (data) {
                    if (data.default_location_data) {
                        // @ts-ignore
                        setDefaultMapIframe(data.default_location_data.iframe || '');
                        // @ts-ignore
                        setDefaultLocationName(data.default_location_data.name || '');
                    } else {
                        // Fallback for migration
                        setDefaultMapIframe(data.default_map_iframe || '');
                        setDefaultLocationName('Chama Church'); // Default name for existing
                    }
                }
            }
        };
        fetchMap();
    }, [userId]);


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
            let cleanPhone = phone.replace(/[^\d]/g, '');

            // Auto-add Brazil country code (55) if missing and looks like a valid BR number
            if (cleanPhone && !cleanPhone.startsWith('55') && (cleanPhone.length === 10 || cleanPhone.length === 11)) {
                cleanPhone = '55' + cleanPhone;
            }

            const { error: updateError } = await supabase.auth.updateUser({
                data: {
                    name: name.trim(),
                    phone: cleanPhone
                }
            });
            if (updateError) throw updateError;

            // Step 2: Update profile map iframe and location data
            const locationData = {
                name: defaultLocationName,
                iframe: defaultMapIframe
            };

            const { error: profileError } = await supabase
                .from('profiles')
                .update({
                    default_map_iframe: defaultMapIframe, // Keep syncing for now
                    default_location_data: locationData, name: name.trim(), phone: cleanPhone
                })
                .eq('id', user.id);

            if (profileError) throw profileError;

            // Step 3: Refresh UI and show success
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
                    <div className="w-24 h-24 rounded-full bg-blue-600 flex-shrink-0 flex items-center justify-center text-white font-bold text-4xl overflow-hidden border-4 border-white shadow-md">
                        {(user?.user_metadata?.avatar_url || user?.user_metadata?.picture) ? (
                            <img src={user?.user_metadata?.avatar_url || user?.user_metadata?.picture} alt={user?.user_metadata?.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                            getInitials(user?.user_metadata?.name)
                        )}
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
                            <button onClick={() => setIsEditingProfile(true)} disabled={isChangingPassword} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                                Editar Perfil
                            </button>
                        )}
                    </div>
                </div>

                {userRole === 'admin' && (
                    <div className="mt-8 pt-8 border-t border-slate-200">
                        <h3 className="text-xl font-bold text-slate-800 mb-4">Localização Padrão</h3>

                        {isEditingProfile ? (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Nome do Local</label>
                                    <input
                                        type="text"
                                        value={defaultLocationName}
                                        onChange={e => setDefaultLocationName(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Ex: Chama Church"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Google Maps Iframe</label>
                                    <textarea
                                        value={defaultMapIframe}
                                        onChange={e => setDefaultMapIframe(e.target.value)}
                                        rows={3}
                                        className="w-full p-2 border border-slate-300 rounded-md font-mono text-xs focus:ring-blue-500 focus:border-blue-500"
                                        placeholder='<iframe src="https://www.google.com/maps/embed?..."></iframe>'
                                    />
                                    <p className="text-xs text-slate-500 mt-1">Cole aqui o código de incorporação do Google Maps para ser usado como padrão em novos eventos.</p>
                                </div>
                            </div>
                        ) : (
                            defaultMapIframe ? (
                                <div className="space-y-2">
                                    {defaultLocationName && (
                                        <p className="font-semibold text-slate-800">{defaultLocationName}</p>
                                    )}
                                    <div className="w-full h-64 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                                        <div dangerouslySetInnerHTML={{ __html: defaultMapIframe }} className="w-full h-full" />
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-slate-50 rounded-lg p-6 text-center border border-dashed border-slate-300">
                                    <p className="text-slate-500 mb-3 text-sm">Nenhuma localização padrão configurada.</p>
                                    <button
                                        onClick={() => setIsEditingProfile(true)}
                                        className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg text-sm hover:bg-slate-50 transition-colors"
                                    >
                                        Adicionar Localização
                                    </button>
                                </div>
                            )
                        )}
                    </div>
                )}

                <div className="mt-8 pt-8 border-t border-slate-200">
                    <h3 className="text-xl font-bold text-slate-800">Segurança</h3>
                    {isChangingPassword ? (
                        <form onSubmit={handleSavePassword} className="mt-4 space-y-4 max-w-sm">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Senha Atual *</label>
                                <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nova Senha *</label>
                                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Mínimo de 6 caracteres" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar Nova Senha *</label>
                                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg" />
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
                            <button onClick={() => setIsChangingPassword(true)} disabled={isEditingProfile} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
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
