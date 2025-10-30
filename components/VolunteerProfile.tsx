import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
// FIX: Restored Supabase v2 types for type safety.
import { type Session, type User } from '@supabase/supabase-js';
import { DetailedVolunteer } from '../types';
import { getErrorMessage, parseArrayFromString } from '../lib/utils';

interface VolunteerProfileProps {
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

const VolunteerProfile: React.FC<VolunteerProfileProps> = ({ session, onUpdate, leaders }) => {
    const [volunteerData, setVolunteerData] = useState<DetailedVolunteer | null>(null);
    const [departmentDetails, setDepartmentDetails] = useState<{ name: string; leader: string | null }[]>([]);
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

            const departmentIds = transformedProfile.departments.map((d: any) => d.id);

            if (departmentIds.length > 0) {
                const { data: leadersData, error: leadersError } = await supabase
                    .from('department_leaders')
                    .select('department_id, leader_id')
                    .in('department_id', departmentIds);
                if (leadersError) throw leadersError;

                const leaderMap = new Map(leaders.map(l => [l.id, l.user_metadata?.name]));

                const enrichedDepts = transformedProfile.departments.map((dept: any) => {
                    const deptLeaders = leadersData
                        .filter(rel => rel.department_id === dept.id)
                        .map(rel => leaderMap.get(rel.leader_id))
                        .filter(Boolean);
                    
                    return {
                        name: dept.name,
                        leader: deptLeaders.join(', ') || 'Não atribuído'
                    };
                });
                setDepartmentDetails(enrichedDepts);
            } else {
                setDepartmentDetails([]);
            }
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

    if (loading) {
        return <p>Carregando perfil...</p>;
    }
    if (error || !volunteerData) {
        return <p className="text-red-500">Erro ao carregar perfil: {error}</p>;
    }
    
    const skillsList = parseArrayFromString(volunteerData.skills);
    const availabilityList = parseArrayFromString(volunteerData.availability);


    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-slate-800">Meu Perfil</h1>
                {!isEditing && (
                    <button onClick={() => setIsEditing(true)} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg">
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
                                        <div key={dept.name} className="p-4 rounded-xl bg-yellow-50 border border-yellow-200">
                                            <p className="font-bold text-yellow-900">{dept.name}</p>
                                            {dept.leader ? (
                                                <p className="text-xs text-yellow-700 mt-1 flex items-center gap-1.5">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                                                    {dept.leader}
                                                </p>
                                            ) : (
                                                <p className="text-xs text-yellow-600 mt-1 italic">Líder não definido</p>
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
            </div>
        </div>
    );
};

export default VolunteerProfile;
