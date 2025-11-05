import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
// FIX: Removed problematic Supabase type imports and used 'any' as a workaround.
// import { type Session, type User } from '@supabase/supabase-js';
import { DetailedVolunteer, DepartmentJoinRequest } from '../types';
import { getErrorMessage, parseArrayFromString } from '../lib/utils';

interface VolunteerProfileProps {
    session: any | null;
    onUpdate: () => void;
    leaders: any[];
}

const Tag: React.FC<{ children: React.ReactNode; color: 'yellow' | 'blue' }> = ({ children, color }) => {
  const baseClasses = "px-3 py-1 text-sm font-semibold rounded-full";
  const colorClasses = {
    yellow: "bg-yellow-100 text-yellow-800",
    blue: "bg-blue-100 text-blue-800",
  };
  return <span className={`${baseClasses} ${colorClasses[color]}`}>{children}</span>
};

const VolunteerProfile: React.FC<VolunteerProfileProps> = ({ session, onUpdate, leaders }) => {
    const [volunteerData, setVolunteerData] = useState<DetailedVolunteer | null>(null);
    const [departmentDetails, setDepartmentDetails] = useState<{ name: string; leader: string | null; status: 'aprovado' | 'pendente' }[]>([]);
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

    const showSuccess = (message: string) => {
        setSuccessMessage(message);
        setTimeout(() => setSuccessMessage(null), 3000);
    };
    
    const fetchProfileData = useCallback(async () => {
        if (!session?.user) return;
        setLoading(true);
        setError(null);
        try {
            const { data: volunteerProfile, error: fetchError } = await supabase
                .from('volunteers')
                .select('*, volunteer_departments(departments(id, name))')
                .eq('user_id', session.user.id)
                .single();
    
            if (fetchError) throw fetchError;
    
            const transformedProfile = {
                ...volunteerProfile,
                departments: (volunteerProfile.volunteer_departments || []).map((vd: any) => vd.departments).filter(Boolean)
            };
            setVolunteerData(transformedProfile as DetailedVolunteer);
    
            // Combine approved departments with pending requests
            const approvedDeptIds = transformedProfile.departments.map((d: any) => d.id);
            const { data: pendingRequestsData, error: requestError } = await supabase
                .from('department_join_requests')
                .select('*, departments(id, name)')
                .eq('volunteer_id', transformedProfile.id)
                .eq('status', 'pendente');
    
            if (requestError) {
                const errorMessage = getErrorMessage(requestError);
                // Only log a warning if the error is not the expected "table not found" issue.
                if (!errorMessage.includes('Could not find the table')) {
                    console.warn("Could not fetch department join requests, proceeding without them. Error:", errorMessage);
                }
            }

            const pendingRequests = (pendingRequestsData as DepartmentJoinRequest[]) || [];
    
            const allDepartmentIds = [...new Set([...approvedDeptIds, ...pendingRequests.map(r => r.department_id)])];
            
            let finalDepartmentDetails: { name: string; leader: string | null; status: 'aprovado' | 'pendente' }[] = [];
    
            if (allDepartmentIds.length > 0) {
                const { data: leadersData, error: leadersError } = await supabase
                    .from('department_leaders')
                    .select('department_id, leader_id')
                    .in('department_id', allDepartmentIds);
                if (leadersError) throw leadersError;
    
                const leaderMap = new Map(leaders.map(l => [l.id, l.user_metadata?.name]));
                
                transformedProfile.departments.forEach((dept: any) => {
                    const deptLeaders = leadersData.filter(rel => rel.department_id === dept.id).map(rel => leaderMap.get(rel.leader_id)).filter(Boolean);
                    finalDepartmentDetails.push({ name: dept.name, leader: deptLeaders.join(', ') || 'Não atribuído', status: 'aprovado' });
                });
    
                pendingRequests.forEach(req => {
                    const dept = req.departments as {id: number, name: string};
                    if (dept) {
                         const deptLeaders = leadersData.filter(rel => rel.department_id === dept.id).map(rel => leaderMap.get(rel.leader_id)).filter(Boolean);
                         finalDepartmentDetails.push({ name: dept.name, leader: deptLeaders.join(', ') || 'Não atribuído', status: 'pendente' });
                    }
                });
            }
            setDepartmentDetails(finalDepartmentDetails);
    
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    }, [session, leaders]);


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
        setFormData(prev => ({...prev, [e.target.name]: e.target.value }));
    };

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setAvailability(prev => ({ ...prev, [e.target.name]: e.target.checked }));
    };

    const handleSave = async () => {
        if (!supabase || !volunteerData) return;
        setIsSaving(true);
        setError(null);
        
        try {
            const selectedAvailability = Object.entries(availability).filter(([,v]) => v).map(([k]) => k);
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
        return <p className="text-red-500">Erro ao carregar perfil.</p>
    }
    
    const skillsList = parseArrayFromString(volunteerData.skills);
    const availabilityList = parseArrayFromString(volunteerData.availability);


    return (
        <div className="space-y-6 max-w-4xl mx-auto">
             <style>{`
                @keyframes fade-in-scale {
                from { opacity: 0; transform: translateY(10px) scale(0.98); }
                to { opacity: 1; transform: translateY(0) scale(1); }
                }
                .animate-fade-in-scale {
                animation: fade-in-scale 0.3s ease-out forwards;
                }
            `}</style>
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-slate-800">Meu Perfil</h1>
                {!isEditing && (
                    <button onClick={() => setIsEditing(true)} disabled={isChangingPassword} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">
                        Editar Perfil
                    </button>
                )}
            </div>
            
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                {isEditing ? (
                    <div className="space-y-6">
                        <div><label className="block text-sm font-medium text-slate-700">Nome Completo</label><input type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full mt-1 p-2 border rounded-md"/></div>
                        <div><label className="block text-sm font-medium text-slate-700">Telefone</label><input type="text" name="phone" value={formData.phone} onChange={handleInputChange} className="w-full mt-1 p-2 border rounded-md"/></div>
                        <div><label className="block text-sm font-medium text-slate-700 mb-2">Habilidades</label><input type="text" value={skills.join(', ')} onChange={e => setSkills(e.target.value.split(',').map(s => s.trim()))} className="w-full mt-1 p-2 border rounded-md" placeholder="Ex: Canto, Fotografia, etc"/></div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Disponibilidade</label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {Object.keys(availability).map(day => (
                                    <div key={day} className="flex items-center"><input type="checkbox" name={day} id={day} checked={availability[day as keyof typeof availability]} onChange={handleCheckboxChange} className="mr-2"/><label htmlFor={day} className="capitalize">{day}</label></div>
                                ))}
                            </div>
                        </div>
                        {error && <p className="text-red-500">{error}</p>}
                        <div className="flex justify-end gap-4">
                            <button onClick={() => setIsEditing(false)} disabled={isSaving} className="px-4 py-2 bg-slate-200 rounded-lg">Cancelar</button>
                            <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 bg-green-500 text-white rounded-lg">{isSaving ? 'Salvando...' : 'Salvar Alterações'}</button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-slate-700">
                            <p><strong>Nome:</strong> {volunteerData.name}</p>
                            <p><strong>Email:</strong> {volunteerData.email}</p>
                            <p><strong>Telefone:</strong> {volunteerData.phone || 'Não informado'}</p>
                            <p><strong>Disponibilidade:</strong> {availabilityList.map(item => item ? item.charAt(0).toUpperCase() + item.slice(1) : '').join(', ') || 'Nenhuma'}</p>
                        </div>

                        <div className="pt-6 border-t border-slate-200">
                            <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Departamentos</h4>
                            {departmentDetails.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {departmentDetails.map(dept => (
                                        <div key={dept.name} className={`p-4 rounded-xl border ${dept.status === 'aprovado' ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200'}`}>
                                            <div className="flex items-center justify-between">
                                                <p className={`font-bold ${dept.status === 'aprovado' ? 'text-yellow-900' : 'text-gray-800'}`}>{dept.name}</p>
                                                {dept.status === 'pendente' && (
                                                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">Pendente</span>
                                                )}
                                            </div>
                                            {dept.leader ? (
                                                <p className={`text-xs mt-1 flex items-center gap-1.5 ${dept.status === 'aprovado' ? 'text-yellow-700' : 'text-gray-600'}`}>
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                                                    {dept.leader}
                                                </p>
                                            ) : (
                                                <p className={`text-xs mt-1 italic ${dept.status === 'aprovado' ? 'text-yellow-600' : 'text-gray-500'}`}>Líder não definido</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : <p className="text-sm text-slate-500">Nenhum departamento associado.</p>}
                        </div>

                        <div className="pt-6 border-t border-slate-200">
                            <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Habilidades</h4>
                            {skillsList.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {skillsList.map(skill => <Tag key={skill} color="blue">{skill}</Tag>)}
                                </div>
                            ) : <p className="text-sm text-slate-500">Nenhuma habilidade registrada.</p>}
                        </div>
                    </div>
                )}

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
                                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required placeholder="Mínimo de 6 caracteres" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar Nova Senha *</label>
                                <input type="password" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} required className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"/>
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
                            <button onClick={() => setIsChangingPassword(true)} disabled={isEditing} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
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