import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { type Session } from '@supabase/supabase-js';
import { DetailedVolunteer } from '../types';
import { getErrorMessage } from '../lib/utils';

interface VolunteerProfileProps {
    session: Session | null;
    onUpdate: () => void;
}

const renderArrayData = (data: string[] | string | null | undefined, emptyText: string = 'Nenhuma'): string => {
    let items: string[] = [];
    if (!data) return emptyText;

    if (Array.isArray(data)) {
        items = data;
    } else if (typeof data === 'string') {
        if (data.startsWith('[') && data.endsWith(']')) {
            try {
                const parsed = JSON.parse(data);
                if (Array.isArray(parsed)) items = parsed;
            } catch (e) { /* ignore */ }
        }
        else if (data.startsWith('{') && data.endsWith('}')) {
             items = data.substring(1, data.length - 1).split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        }
        else if (data.trim()) {
            items = data.split(',').map(s => s.trim());
        }
    }

    if (items.length === 0 || (items.length === 1 && items[0] === '')) {
        return emptyText;
    }
    return items.map(item => item ? item.charAt(0).toUpperCase() + item.slice(1) : '').join(', ');
};


const VolunteerProfile: React.FC<VolunteerProfileProps> = ({ session, onUpdate }) => {
    const [volunteerData, setVolunteerData] = useState<DetailedVolunteer | null>(null);
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
        if (!session) return;
        setLoading(true);
        try {
            const { data, error: fetchError } = await supabase
                .from('volunteers')
                .select('*')
                .eq('user_id', session.user.id)
                .single();
            if (fetchError) throw fetchError;
            setVolunteerData(data as DetailedVolunteer);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    }, [session]);

    useEffect(() => {
        fetchProfileData();
    }, [fetchProfileData]);

    useEffect(() => {
        if (volunteerData) {
            setFormData({
                name: volunteerData.name || '',
                phone: volunteerData.phone || ''
            });
            setSkills(renderArrayData(volunteerData.skills, '').split(', ').filter(Boolean));
            
            const availabilityKeys = { domingo: false, segunda: false, terca: false, quarta: false, quinta: false, sexta: false, sabado: false };
            const availabilityArray = renderArrayData(volunteerData.availability, '').toLowerCase().split(', ').filter(Boolean);
            
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
            
            await supabase.auth.updateUser({ data: { name: formData.name } });

            await fetchProfileData(); // Refetch local data
            onUpdate(); // Propagate global changes if needed (like notification count)
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
                    <div className="space-y-4 text-slate-700">
                        <p><strong>Nome:</strong> {volunteerData.name}</p>
                        <p><strong>Email:</strong> {volunteerData.email}</p>
                        <p><strong>Telefone:</strong> {volunteerData.phone || 'Não informado'}</p>
                        <p><strong>Departamentos:</strong> {renderArrayData(volunteerData.departments, 'Nenhum')}</p>
                        <p><strong>Habilidades:</strong> {renderArrayData(volunteerData.skills, 'Nenhuma')}</p>
                        <p><strong>Disponibilidade:</strong> {renderArrayData(volunteerData.availability, 'Nenhuma')}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VolunteerProfile;