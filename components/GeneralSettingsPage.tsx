import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getErrorMessage } from '../lib/utils';

const TIMEZONES = [
    { value: 'America/Sao_Paulo', label: 'Brasília (UTC-3)' },
    { value: 'America/Manaus', label: 'Manaus (UTC-4)' },
    { value: 'America/Rio_Branco', label: 'Rio Branco (UTC-5)' },
    { value: 'America/Campo_Grande', label: 'Campo Grande (UTC-4)' },
    { value: 'America/Cuiaba', label: 'Cuiabá (UTC-4)' },
    { value: 'America/Belem', label: 'Belém (UTC-3)' },
    { value: 'America/Fortaleza', label: 'Fortaleza (UTC-3)' },
    { value: 'America/Recife', label: 'Recife (UTC-3)' },
    { value: 'America/Noronha', label: 'Fernando de Noronha (UTC-2)' },
];

const GeneralSettingsPage: React.FC = () => {
    const [timezone, setTimezone] = useState('America/Sao_Paulo');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'timezone')
                .single();

            if (error && error.code !== 'PGRST116') throw error;

            if (data) {
                setTimezone(data.value);
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
            setMessage({ text: 'Erro ao carregar configurações.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);

        try {
            const { error } = await supabase
                .from('app_settings')
                .upsert({
                    key: 'timezone',
                    value: timezone,
                    description: 'Fuso horário padrão do sistema'
                });

            if (error) throw error;

            setMessage({ text: 'Configurações salvas com sucesso!', type: 'success' });

            // Opcional: Recarregar a página para aplicar o novo fuso se ele for usado globalmente
            // window.location.reload(); 
        } catch (error) {
            console.error('Error saving settings:', error);
            setMessage({ text: getErrorMessage(error), type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-slate-500">Carregando configurações...</div>;
    }

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-slate-800 mb-6">Configurações do Fuso Horário</h1>

            {message && (
                <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {message.text}
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                    <h2 className="text-lg font-semibold text-slate-800 mb-1">Localização e Hora</h2>
                    <p className="text-sm text-slate-500">Defina o fuso horário padrão para a organização.</p>
                </div>

                <div className="p-6 space-y-6">
                    <div>
                        <label htmlFor="timezone" className="block text-sm font-medium text-slate-700 mb-2">
                            Fuso Horário
                        </label>
                        <select
                            id="timezone"
                            value={timezone}
                            onChange={(e) => setTimezone(e.target.value)}
                            className="w-full md:w-1/2 rounded-lg border-slate-300 focus:border-blue-500 focus:ring-blue-500 shadow-sm"
                        >
                            {TIMEZONES.map((tz) => (
                                <option key={tz.value} value={tz.value}>
                                    {tz.label}
                                </option>
                            ))}
                        </select>
                        <p className="mt-2 text-sm text-slate-500">
                            Isso afetará como os horários dos eventos são exibidos e calculados para todos os usuários.
                        </p>
                    </div>
                </div>

                <div className="bg-slate-50 px-6 py-4 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {saving ? (
                            <>
                                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Salvando...
                            </>
                        ) : (
                            'Salvar Alterações'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GeneralSettingsPage;
