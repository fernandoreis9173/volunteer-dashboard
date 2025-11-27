import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
// FIX: Removed problematic Supabase type imports and used 'any' as a workaround.
// import { type Session, type User } from '@supabase/supabase-js';
import { DetailedVolunteer } from '../types';
import { getErrorMessage, parseArrayFromString } from '../lib/utils';

interface VolunteerProfileProps {
    session: any | null;
    onUpdate: () => void;
    leaders: any[];
}

const Tag: React.FC<{ children: React.ReactNode; color: 'yellow' | 'blue' }> = ({ children, color }) => {
    const baseClasses = "px-3 py-1 text-sm font-semibold rounded-full";
    const colorClasses = {
        yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200",
        blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200",
    };
    return <span className={`${baseClasses} ${colorClasses[color]}`}>{children}</span>
};

const VolunteerProfile: React.FC<VolunteerProfileProps> = ({ session, onUpdate, leaders }) => {
    const [volunteerData, setVolunteerData] = useState<DetailedVolunteer | null>(null);
    const [departmentDetails, setDepartmentDetails] = useState<{ name: string; leader: string | null; }[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState({ name: '', phone: '' });
    const [skills, setSkills] = useState<string[]>([]);
    const [availability, setAvailability] = useState({
        domingo: false, segunda: false, terca: false,
        quarta: false, quinta: false, sexta: false, sabado: false,
    });
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [defaultMapIframe, setDefaultMapIframe] = useState('');

    // FIX: Stabilize dependency by extracting the user ID. This prevents the fetch effect
    // from re-running on every session token refresh, which caused the page to loop/refresh.
    const userId = session?.user?.id;


    const showSuccess = (message: string) => {
        setSuccessMessage(message);
        setTimeout(() => setSuccessMessage(null), 3000);
    };

    const fetchProfileData = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        setError(null);
        try {
            const { data: volunteerProfile, error: fetchError } = await supabase
                .from('volunteers')
                .select('*, volunteer_departments(departments(id, name))')
                .eq('user_id', userId)
                .single();

            if (fetchError) throw fetchError;

            const departments = (volunteerProfile.volunteer_departments || []).map((vd: any) => vd.departments).filter(Boolean);
            const transformedProfile = {
                ...volunteerProfile,
                departments: departments
            };
            setVolunteerData(transformedProfile as DetailedVolunteer);

            // Fetch profile data (default map)
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('default_map_iframe')
                .eq('id', userId)
                .single();

            if (profileData) {
                setDefaultMapIframe(profileData.default_map_iframe || '');
            }

            const departmentIds = departments.map((d: any) => d.id);

            if (departmentIds.length > 0) {
                const { data: deptLeaders, error: leadersError } = await supabase
                    .from('department_leaders')
                    .select('department_id, user_id')
                    .in('department_id', departmentIds);
                if (leadersError) throw leadersError;

                const deptLeaderMap = new Map<number, string>();
                (deptLeaders || []).forEach((rel: any) => {
                    const leaderUser = leaders.find(u => u.id === rel.user_id);
                    if (leaderUser) {
                        deptLeaderMap.set(rel.department_id, leaderUser.user_metadata?.name || 'Líder');
                    }
                });

                const finalDepartmentDetails = departments.map((dept: any) => {
                    const leaderName = deptLeaderMap.get(dept.id);

                    return {
                        name: dept.name,
                        leader: leaderName || 'Não atribuído'
                    };
                });
                setDepartmentDetails(finalDepartmentDetails);
            } else {
                setDepartmentDetails([]);
            }

        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    }, [userId, leaders]);


    useEffect(() => {
        fetchProfileData();
    }, [fetchProfileData]);

    useEffect(() => {
        if (volunteerData) {
            setFormData({
                name: volunteerData.name || '',
                phone: volunteerData.phone || ''
            });
            setSkills(parseArrayFromString(volunteerData.skills));

            const availabilityKeys = { domingo: false, segunda: false, terca: false, quarta: false, quinta: false, sexta: false, sabado: false };
            const availabilityArray = parseArrayFromString(volunteerData.availability).map(d => d.toLowerCase());

            availabilityArray.forEach(day => {
                if (day in availabilityKeys) {
                    availabilityKeys[day as keyof typeof availabilityKeys] = true;
                }
            });
            setAvailability(availabilityKeys);
        }
    }, [volunteerData]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setAvailability(prev => ({ ...prev, [e.target.name]: e.target.checked }));
    };

    const handleSave = async () => {
        if (!supabase || !volunteerData) return;
        setIsSaving(true);
        setError(null);

        try {
            const selectedAvailability = Object.entries(availability).filter(([, v]) => v).map(([k]) => k);
            const { error: updateError } = await supabase
                .from('volunteers')
                .update({
                    name: formData.name,
                    phone: formData.phone,
                    skills: skills,
                    availability: JSON.stringify(selectedAvailability)
                })
                .eq('id', volunteerData.id);

            if (updateError) throw updateError;

            // Update profile data (default map)
            if (userId) {
                const { error: profileUpdateError } = await supabase
                    .from('profiles')
                    .update({ default_map_iframe: defaultMapIframe })
                    .eq('id', userId);

                if (profileUpdateError) throw profileUpdateError;
            }

            // FIX: Use the correct Supabase v2 API `updateUser` to update user metadata.
            await supabase.auth.updateUser({ data: { name: formData.name } });

            await fetchProfileData();
            onUpdate();
            setIsEditing(false);

        } catch (e: any) {
            setError(`Falha ao salvar: ${e.message}`);
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
        if (newPassword.length < 6) {
            setError('A nova senha deve ter pelo menos 6 caracteres.');
            return;
        }
        if (newPassword !== confirmNewPassword) {
            setError('As novas senhas não coincidem.');
            return;
        }

        setIsSaving(true);
        try {
            if (!session?.user?.email) {
                throw new Error("Email do usuário não encontrado para verificação.");
            }

            // 1. Verify current password
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: session.user.email,
                password: currentPassword,
            });

            if (signInError) {
                if (signInError.message === 'Invalid login credentials') {
                    throw new Error('Sua senha atual está incorreta.');
                }
                throw signInError;
            }

            // 2. Update to the new password
            const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
            if (updateError) throw updateError;

            // Reset fields and close form
            setNewPassword('');
            setConfirmNewPassword('');
            setCurrentPassword('');
            setIsChangingPassword(false);
            showSuccess('Senha alterada com sucesso!');

        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setIsSaving(false);
        }
    };

    const cancelPasswordChange = () => {
        setIsChangingPassword(false);
        setError(null);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
    };

    if (loading) {
        return <p>Carregando perfil...</p>;
    }
    if (error && !isChangingPassword) { // Don't show page-level error for password form errors
        return <p className="text-red-500">Erro ao carregar perfil: {error}</p>;
    }
    if (!volunteerData) {
        return <p className="text-red-500">Erro ao carregar perfil.</p>;
    }

    const skillsList = parseArrayFromString(volunteerData.skills);
    const availabilityList = parseArrayFromString(volunteerData.availability);


    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <style>{`
                input[type="checkbox"]:checked {
                    background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e");
                }
                @keyframes fade-in-scale {
                from { opacity: 0; transform: translateY(10px) scale(0.98); }
                to { opacity: 1; transform: translateY(0) scale(1); }
                }
                .animate-fade-in-scale {
                animation: fade-in-scale 0.3s ease-out forwards;
                }
            `}</style>
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Meu Perfil</h1>
                {!isEditing && (
                    <button onClick={() => setIsEditing(true)} disabled={isChangingPassword} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">
                        Editar Perfil
                    </button>
                )}
            </div>

            <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                {isEditing ? (
                    <div className="space-y-6">
                        <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Nome Completo</label><input type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full mt-1 p-2 border rounded-md dark:bg-slate-900 dark:border-slate-600 dark:text-slate-300" /></div>
                        <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Telefone</label><input type="text" name="phone" value={formData.phone} onChange={handleInputChange} className="w-full mt-1 p-2 border rounded-md dark:bg-slate-900 dark:border-slate-600 dark:text-slate-300" /></div>
                        <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Habilidades</label><input type="text" value={skills.join(', ')} onChange={e => setSkills(e.target.value.split(',').map(s => s.trim()))} className="w-full mt-1 p-2 border rounded-md dark:bg-slate-900 dark:border-slate-600 dark:text-slate-300" placeholder="Ex: Canto, Fotografia, etc" /></div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Disponibilidade</label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {Object.keys(availability).map(day => (
                                    <div key={day} className="flex items-center"><input type="checkbox" name={day} id={day} checked={availability[day as keyof typeof availability]} onChange={handleCheckboxChange} className="mr-2 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-500" /><label htmlFor={day} className="capitalize text-slate-700 dark:text-slate-300">{day}</label></div>
                                ))}
                            </div>
                        </div>

                        {session?.user?.user_metadata?.role === 'admin' && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Localizador Padrão (Google Maps Iframe)</label>
                                <textarea
                                    value={defaultMapIframe}
                                    onChange={e => setDefaultMapIframe(e.target.value)}
                                    rows={3}
                                    className="w-full mt-1 p-2 border rounded-md dark:bg-slate-900 dark:border-slate-600 dark:text-slate-300 font-mono text-xs"
                                    placeholder='<iframe src="https://www.google.com/maps/embed?..."></iframe>'
                                />
                                <p className="text-xs text-slate-500 mt-1">Cole aqui o código de incorporação do Google Maps para ser usado como padrão em novos eventos.</p>
                            </div>
                        )}

                        {error && <p className="text-red-500">{error}</p>}
                        <div className="flex justify-end gap-4">
                            <button onClick={() => setIsEditing(false)} disabled={isSaving} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 dark:text-slate-200 rounded-lg">Cancelar</button>
                            <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 bg-green-500 text-white rounded-lg">{isSaving ? 'Salvando...' : 'Salvar Alterações'}</button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-slate-700 dark:text-slate-300">
                            <p><strong>Nome:</strong> {volunteerData.name}</p>
                            <p><strong>Email:</strong> {volunteerData.email}</p>
                            <p><strong>Telefone:</strong> {volunteerData.phone || 'Não informado'}</p>
                            <p><strong>Disponibilidade:</strong> {availabilityList.map(item => item ? item.charAt(0).toUpperCase() + item.slice(1) : '').join(', ') || 'Nenhuma'}</p>
                        </div>

                        {session?.user?.user_metadata?.role === 'admin' && (
                            <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
                                <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Localização Padrão</h4>
                                {defaultMapIframe ? (
                                    <div className="w-full h-64 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                                        <div dangerouslySetInnerHTML={{ __html: defaultMapIframe }} className="w-full h-full" />
                                    </div>
                                ) : (
                                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-6 text-center border border-dashed border-slate-300 dark:border-slate-700">
                                        <p className="text-slate-500 dark:text-slate-400 mb-3 text-sm">Nenhuma localização padrão configurada.</p>
                                        <button
                                            onClick={() => setIsEditing(true)}
                                            className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                                        >
                                            Adicionar Localização
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
                            <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Departamentos</h4>
                            {departmentDetails.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {departmentDetails.map(dept => (
                                        <div key={dept.name} className="p-4 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/30">
                                            <p className="font-bold text-yellow-900 dark:text-yellow-200">{dept.name}</p>
                                            {dept.leader ? (
                                                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1 flex items-center gap-1.5">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                                                    {dept.leader}
                                                </p>
                                            ) : (
                                                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1 italic">Líder não definido</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum departamento associado.</p>}
                        </div>

                        <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
                            <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Habilidades</h4>
                            {skillsList.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {skillsList.map(skill => <Tag key={skill} color="blue">{skill}</Tag>)}
                                </div>
                            ) : <p className="text-sm text-slate-500 dark:text-slate-400">Nenhuma habilidade registrada.</p>}
                        </div>
                    </div>
                )}

                <div className="mt-8 pt-8 border-t border-slate-200 dark:border-slate-700">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Segurança</h3>
                    {isChangingPassword ? (
                        <form onSubmit={handleSavePassword} className="mt-4 space-y-4 max-w-sm">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Senha Atual *</label>
                                <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-100" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nova Senha *</label>
                                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required placeholder="Mínimo de 6 caracteres" className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-100" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Confirmar Nova Senha *</label>
                                <input type="password" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} required className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-100" />
                            </div>
                            {error && <p className="text-sm text-red-500">{error}</p>}
                            <div className="flex items-center gap-2 pt-2">
                                <button type="submit" disabled={isSaving} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg text-sm disabled:bg-blue-400">
                                    {isSaving ? 'Salvando...' : 'Salvar Senha'}
                                </button>
                                <button type="button" onClick={cancelPasswordChange} className="px-4 py-2 bg-slate-100 dark:bg-slate-600 dark:text-slate-200 text-slate-700 font-semibold rounded-lg text-sm">
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div className="mt-4 flex items-center justify-between">
                            <p className="text-slate-600 dark:text-slate-400">Altere sua senha de acesso ao sistema.</p>
                            <button onClick={() => setIsChangingPassword(true)} disabled={isEditing} className="px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-semibold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                                Alterar Senha
                            </button>
                        </div>
                    )}
                </div>
            </div>
            {successMessage && (
                <div className="fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg animate-fade-in-scale">
                    {successMessage}
                </div>
            )}
        </div>
    );
};

export default VolunteerProfile;