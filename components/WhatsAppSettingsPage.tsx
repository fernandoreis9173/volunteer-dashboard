import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabaseClient';
import { Session } from '@supabase/supabase-js';

interface WhatsAppSettingsPageProps {
    session: Session | null;
}

interface WhatsAppSettings {
    id?: string;
    evolution_url: string;
    token: string;
    session_name: string;
    active: boolean;
    provider: 'evolution' | 'generic';
}

const CustomSelect = ({ options, value, onChange, placeholder, disabled }: {
    options: { id: string; name: string; date?: string }[],
    value: string,
    onChange: (val: string) => void,
    placeholder: string,
    disabled: boolean
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const selectedOption = options.find(o => o.id === value);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={wrapperRef}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`w-full px-4 py-2 text-left bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg flex justify-between items-center transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-blue-400 focus:ring-2 focus:ring-blue-500'
                    }`}
            >
                <span className={`block truncate ${!selectedOption ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-slate-100'}`}>
                    {selectedOption ? (
                        <span>
                            {selectedOption.name}
                            {selectedOption.date && (
                                <span className="text-slate-500 dark:text-slate-400 text-xs ml-2">
                                    ({new Date(selectedOption.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })})
                                </span>
                            )}
                        </span>
                    ) : placeholder}
                </span>
                <svg
                    className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`}
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                >
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-800 shadow-xl max-h-60 rounded-lg py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm border border-slate-100 dark:border-slate-700">
                    {options.length === 0 ? (
                        <div className="cursor-default select-none relative py-3 px-4 text-slate-500 dark:text-slate-400 italic text-center">
                            Nenhuma opção disponível
                        </div>
                    ) : (
                        options.map((option) => (
                            <div
                                key={option.id}
                                onClick={() => {
                                    onChange(option.id);
                                    setIsOpen(false);
                                }}
                                className={`cursor-pointer select-none relative py-3 pl-4 pr-9 transition-colors ${option.id === value
                                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                                    : 'text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700'
                                    }`}
                            >
                                <span className={`block truncate ${option.id === value ? 'font-semibold' : 'font-normal'}`}>
                                    {option.name}
                                    {option.date && (
                                        <span className={`text-xs ml-2 ${option.id === value ? 'text-blue-500 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                            ({new Date(option.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })})
                                        </span>
                                    )}
                                </span>
                                {option.id === value && (
                                    <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-blue-600 dark:text-blue-400">
                                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    </span>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

const WhatsAppSettingsPage: React.FC<WhatsAppSettingsPageProps> = ({ session }) => {
    const [settings, setSettings] = useState<WhatsAppSettings>({
        evolution_url: '',
        token: '',
        session_name: '',
        active: true,
        provider: 'evolution',
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [showToken, setShowToken] = useState(false);

    useEffect(() => {
        fetchSettings();
        fetchLogs();
    }, []);

    interface WhatsAppLog {
        id: string;
        created_at: string;
        recipient_phone: string;
        message_content: string;
        status: 'success' | 'error';
        error_message?: string;
    }

    const [logs, setLogs] = useState<WhatsAppLog[]>([]);

    const fetchLogs = async () => {
        try {
            const { data, error } = await supabase
                .from('whatsapp_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) throw error;
            if (data) setLogs(data as WhatsAppLog[]);
        } catch (error) {
            console.error('Erro ao buscar logs:', error);
        }
    };

    const fetchSettings = async () => {
        try {
            setIsLoading(true);
            const { data, error } = await supabase
                .from('whatsapp_settings')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            if (data) {
                setSettings(data);
            }
        } catch (error: any) {
            console.error('Erro ao carregar configurações:', error);
            setMessage({ type: 'error', text: 'Erro ao carregar configurações do WhatsApp' });
        } finally {
            setIsLoading(false);
        }
    };

    const fetchTemplates = async () => {
        try {
            setIsLoadingTemplates(true);
            setMessage(null); // Clear previous messages
            const { data, error } = await supabase
                .from('whatsapp_message_templates')
                .select('*')
                .order('template_type');

            if (error) {
                console.error('Erro detalhado ao carregar templates:', {
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code
                });
                throw error;
            }

            console.log('Templates carregados com sucesso:', data);
            if (data) setTemplates(data);
        } catch (error: any) {
            console.error('Erro ao carregar templates:', error);
            setMessage({ type: 'error', text: `Erro ao carregar templates de mensagens: ${error.message || 'Erro desconhecido'}` });
        } finally {
            setIsLoadingTemplates(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setMessage(null);

        try {
            // Validações
            if (!settings.evolution_url || !settings.token || !settings.session_name) {
                setMessage({ type: 'error', text: 'Todos os campos são obrigatórios' });
                setIsSaving(false);
                return;
            }

            // Validar URL
            try {
                new URL(settings.evolution_url);
            } catch {
                setMessage({ type: 'error', text: 'URL da Evolution API inválida' });
                setIsSaving(false);
                return;
            }

            if (settings.id) {
                // Atualizar configuração existente
                const { error } = await supabase
                    .from('whatsapp_settings')
                    .update({
                        evolution_url: settings.evolution_url,
                        token: settings.token,
                        session_name: settings.session_name,
                        active: settings.active,
                        provider: settings.provider,
                    })
                    .eq('id', settings.id);

                if (error) throw error;
            } else {
                // Criar nova configuração
                const { data, error } = await supabase
                    .from('whatsapp_settings')
                    .insert([
                        {
                            evolution_url: settings.evolution_url,
                            token: settings.token,
                            session_name: settings.session_name,
                            active: settings.active,
                            provider: settings.provider,
                        },
                    ])
                    .select()
                    .single();

                if (error) throw error;
                if (data) {
                    setSettings(data);
                }
            }

            setMessage({ type: 'success', text: 'Configurações salvas com sucesso!' });
        } catch (error: any) {
            console.error('Erro ao salvar configurações:', error);
            setMessage({ type: 'error', text: error.message || 'Erro ao salvar configurações' });
        } finally {
            setIsSaving(false);
        }
    };

    const [activeTab, setActiveTab] = useState<'config' | 'test' | 'history' | 'bulk' | 'templates'>('config');
    const [bulkType, setBulkType] = useState<'department' | 'event'>('department');
    const [bulkTargetId, setBulkTargetId] = useState<string>('');
    const [bulkMessage, setBulkMessage] = useState<string>('Olá {nome}, ');
    const [targetOptions, setTargetOptions] = useState<{ id: string; name: string; date?: string }[]>([]);
    const [isFetchingTargets, setIsFetchingTargets] = useState(false);
    const [isSendingBulk, setIsSendingBulk] = useState(false);
    const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number; success: number; error: number } | null>(null);

    // Templates state
    interface MessageTemplate {
        id: string;
        template_type: string;
        message_content: string;
        variables: string[];
        active: boolean;
    }
    const [templates, setTemplates] = useState<MessageTemplate[]>([]);
    const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
    const [showConfirmationModal, setShowConfirmationModal] = useState(false);
    const [preparedVolunteers, setPreparedVolunteers] = useState<any[]>([]);
    const [bulkStats, setBulkStats] = useState({ total: 0, unique: 0 });

    // Estado para logs em tempo real
    interface LiveLog {
        id: string;
        time: string;
        name: string;
        status: 'sending' | 'success' | 'error';
        details?: string;
    }
    const [liveLogs, setLiveLogs] = useState<LiveLog[]>([]);
    const logsEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll para o final dos logs
    useEffect(() => {
        if (activeTab === 'bulk') {
            logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [liveLogs, activeTab]);

    // Carregar opções de alvo quando a aba ou tipo mudar
    useEffect(() => {
        if (activeTab === 'bulk') {
            fetchBulkTargets();
        }
        if (activeTab === 'templates') {
            fetchTemplates();
        }
    }, [activeTab, bulkType]);

    const fetchBulkTargets = async () => {
        setIsFetchingTargets(true);
        setTargetOptions([]);
        setBulkTargetId('');
        try {
            let data: any[] | null = null;
            let error = null;

            if (bulkType === 'department') {
                const response = await supabase
                    .from('departments')
                    .select('id, name')
                    .eq('status', 'Ativo')
                    .order('name');
                data = response.data;
                error = response.error;
            } else {
                // Eventos futuros apenas (a partir de hoje)
                const today = new Date();

                const response = await supabase
                    .from('events')
                    .select('id, name, date')
                    .gte('date', today.toISOString().split('T')[0])
                    .order('date', { ascending: true });
                data = response.data;
                error = response.error;
            }

            if (error) throw error;
            if (data) {
                setTargetOptions(data.map((item: any) => ({
                    id: item.id.toString(),
                    name: item.name,
                    date: item.date
                })));
            }
        } catch (err) {
            console.error('Erro ao buscar opções:', err);
            setMessage({ type: 'error', text: 'Erro ao carregar lista de departamentos/eventos.' });
        } finally {
            setIsFetchingTargets(false);
        }
    };

    const handleBulkSendClick = async () => {
        if (!bulkTargetId || !bulkMessage) return;

        setIsFetchingTargets(true);
        try {
            let volunteers: any[] = [];

            if (bulkType === 'department') {
                const { data, error } = await supabase
                    .from('volunteer_departments')
                    .select('volunteer:volunteers(name, phone)')
                    .eq('department_id', bulkTargetId);

                if (error) throw error;
                volunteers = data?.map((item: any) => item.volunteer) || [];
            } else {
                const { data, error } = await supabase
                    .from('event_volunteers')
                    .select('volunteer:volunteers(name, phone)')
                    .eq('event_id', bulkTargetId);
                if (error) throw error;
                volunteers = data?.map((item: any) => item.volunteer) || [];
            }

            // Filtrar duplicados e sem telefone
            const uniqueVolunteers = volunteers.filter((v, i, self) =>
                v.phone &&
                self.findIndex(t => t.phone === v.phone) === i
            );

            if (uniqueVolunteers.length === 0) {
                alert('Nenhum voluntário com telefone encontrado para este alvo.');
                return;
            }

            setBulkStats({ total: volunteers.length, unique: uniqueVolunteers.length });
            setPreparedVolunteers(uniqueVolunteers);
            setShowConfirmationModal(true);

        } catch (error: any) {
            console.error('Erro ao preparar envio:', error);
            alert('Erro ao buscar voluntários: ' + error.message);
        } finally {
            setIsFetchingTargets(false);
        }
    };

    const confirmBulkSend = async () => {
        setShowConfirmationModal(false);
        setIsSendingBulk(true);
        const uniqueVolunteers = preparedVolunteers;
        setBulkProgress({ current: 0, total: uniqueVolunteers.length, success: 0, error: 0 });
        setLiveLogs([]); // Limpar logs anteriores
        setMessage(null);

        try {
            // 2. Enviar Mensagens (Iterativo)
            let successCount = 0;
            let errorCount = 0;

            for (let i = 0; i < uniqueVolunteers.length; i++) {
                const volunteer = uniqueVolunteers[i];
                const personalizedMessage = bulkMessage.replace('{nome}', volunteer.name.split(' ')[0]); // Primeiro nome
                const logId = Math.random().toString(36).substr(2, 9);
                const now = new Date().toLocaleTimeString();

                // Adicionar log de "Enviando..."
                setLiveLogs(prev => [...prev, {
                    id: logId,
                    time: now,
                    name: volunteer.name,
                    status: 'sending'
                }]);

                try {
                    const cleanNumber = volunteer.phone.replace(/\D/g, '');
                    const whatsappJid = `${cleanNumber}@s.whatsapp.net`;

                    const { data, error } = await supabase.functions.invoke('send-whatsapp', {
                        body: {
                            number: whatsappJid,
                            message: personalizedMessage
                        }
                    });

                    if (error) {
                        console.error(`Erro na requisição para ${volunteer.name}:`, error);
                        errorCount++;
                        // Atualizar log para erro
                        setLiveLogs(prev => prev.map(log => log.id === logId ? { ...log, status: 'error', details: 'Erro de requisição' } : log));
                    } else if (!data.success) {
                        console.error(`API retornou erro para ${volunteer.name}:`, data.error);
                        errorCount++;
                        // Atualizar log para erro
                        setLiveLogs(prev => prev.map(log => log.id === logId ? { ...log, status: 'error', details: data.error } : log));
                    } else {
                        successCount++;
                        // Atualizar log para sucesso
                        setLiveLogs(prev => prev.map(log => log.id === logId ? { ...log, status: 'success' } : log));
                    }
                } catch (err: any) {
                    console.error(`Exceção ao enviar para ${volunteer.name}:`, err);
                    errorCount++;
                    // Atualizar log para erro
                    setLiveLogs(prev => prev.map(log => log.id === logId ? { ...log, status: 'error', details: err.message || 'Erro desconhecido' } : log));
                }

                // Atualizar progresso
                setBulkProgress({
                    current: i + 1,
                    total: uniqueVolunteers.length,
                    success: successCount,
                    error: errorCount
                });

                // Delay aleatório entre 2s e 5s para evitar banimento e rate limits
                if (i < uniqueVolunteers.length - 1) {
                    const delay = Math.floor(Math.random() * 3000) + 2000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }

            setMessage({ type: 'success', text: `Envio finalizado! Sucesso: ${successCount}, Erros: ${errorCount}` });
            // Atualizar histórico geral
            fetchLogs();

        } catch (error: any) {
            console.error('Erro no processo de envio em massa:', error);
            setMessage({ type: 'error', text: 'Erro ao processar envio em massa: ' + (error.message || error) });
        } finally {
            setIsSendingBulk(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
                    Configurações do WhatsApp
                </h1>
                <p className="text-slate-600 dark:text-slate-400 mt-2">
                    Gerencie a integração, realize testes e monitore os envios.
                </p>
            </div>

            {/* Navegação por Abas */}
            <div className="flex space-x-4 mb-6 border-b border-slate-200 dark:border-slate-700">
                <button
                    onClick={() => setActiveTab('config')}
                    className={`pb-2 px-4 font-medium transition-colors relative ${activeTab === 'config'
                        ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                >
                    Configuração API
                </button>
                <button
                    onClick={() => setActiveTab('test')}
                    className={`pb-2 px-4 font-medium transition-colors relative ${activeTab === 'test'
                        ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                >
                    Teste e Automação
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`pb-2 px-4 font-medium transition-colors relative ${activeTab === 'history'
                        ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                >
                    Histórico de Envios
                </button>
                <button
                    onClick={() => setActiveTab('bulk')}
                    className={`pb-2 px-4 font-medium transition-colors relative ${activeTab === 'bulk'
                        ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                >
                    Envio em Massa
                </button>
                <button
                    onClick={() => setActiveTab('templates')}
                    className={`pb-2 px-4 font-medium transition-colors relative ${activeTab === 'templates'
                        ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                >
                    Templates de Mensagens
                </button>
            </div>

            {message && (
                <div
                    className={`mb-6 p-4 rounded-lg ${message.type === 'success'
                        ? 'bg-green-100 text-green-800 border border-green-200'
                        : 'bg-red-100 text-red-800 border border-red-200'
                        }`}
                >
                    {message.text}
                </div>
            )}

            {/* Conteúdo da Aba: Configuração */}
            {activeTab === 'config' && (
                <>
                    <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 space-y-6">
                        <div>
                            <label htmlFor="provider" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Provedor de API *
                            </label>
                            <select
                                id="provider"
                                value={settings.provider}
                                onChange={(e) => setSettings({ ...settings, provider: e.target.value as 'evolution' | 'generic' })}
                                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-slate-100"
                            >
                                <option value="evolution">Evolution API (Padrão)</option>
                                <option value="generic">Outra / Genérica (Futuro)</option>
                            </select>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                Selecione qual serviço de API você está utilizando.
                            </p>
                        </div>

                        <div>
                            <label htmlFor="evolution_url" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Evolution URL *
                            </label>
                            <input
                                type="url"
                                id="evolution_url"
                                value={settings.evolution_url}
                                onChange={(e) => setSettings({ ...settings, evolution_url: e.target.value })}
                                placeholder="https://sua-evolution-api.com"
                                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-slate-100"
                                required
                            />
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                URL base da sua instância
                            </p>
                        </div>

                        <div>
                            <label htmlFor="token" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Token *
                            </label>
                            <div className="relative">
                                <input
                                    type={showToken ? 'text' : 'password'}
                                    id="token"
                                    value={settings.token}
                                    onChange={(e) => setSettings({ ...settings, token: e.target.value })}
                                    placeholder="Seu token de autenticação"
                                    className="w-full px-4 py-2 pr-12 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-slate-100"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowToken(!showToken)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                                >
                                    {showToken ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                Token de autenticação
                            </p>
                        </div>

                        <div>
                            <label htmlFor="session_name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Nome da Sessão *
                            </label>
                            <input
                                type="text"
                                id="session_name"
                                value={settings.session_name}
                                onChange={(e) => setSettings({ ...settings, session_name: e.target.value })}
                                placeholder="minha-sessao"
                                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-slate-100"
                                required
                            />
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                Nome da sessão do WhatsApp
                            </p>
                        </div>

                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                id="active"
                                checked={settings.active}
                                onChange={(e) => setSettings({ ...settings, active: e.target.checked })}
                                className="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-slate-800 focus:ring-2 dark:bg-slate-700 dark:border-slate-600"
                            />
                            <label htmlFor="active" className="ml-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                                Ativar integração do WhatsApp
                            </label>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                * Campos obrigatórios
                            </p>
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                            >
                                {isSaving ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>Salvando...</span>
                                    </>
                                ) : (
                                    <>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span>Salvar Configurações</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>

                    <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2 flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Informações
                        </h3>
                        <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1 ml-7">
                            <li>• As configurações são usadas pelas Edge Functions para enviar mensagens via WhatsApp</li>
                            <li>• Certifique-se de que a API está configurada e acessível</li>
                            <li>• O token deve ter permissões para enviar mensagens</li>
                            <li>• Desative a integração se não quiser enviar mensagens via WhatsApp</li>
                        </ul>
                    </div>
                </>
            )}

            {/* Conteúdo da Aba: Teste & Automação */}
            {activeTab === 'test' && (
                <>
                    {/* Área de Teste */}
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 mb-8">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">Teste de Envio Manual</h2>
                        <p className="text-slate-600 dark:text-slate-400 mb-4">
                            Envie uma mensagem de teste para verificar se a integração está funcionando corretamente.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="test_phone" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Número de Telefone (com DDD)
                                </label>
                                <input
                                    type="text"
                                    id="test_phone"
                                    placeholder="5511999999999"
                                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-slate-100"
                                />
                            </div>
                            <div>
                                <label htmlFor="test_message" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Mensagem
                                </label>
                                <input
                                    type="text"
                                    id="test_message"
                                    defaultValue="Olá! Bem-vindo ao Chat Volunteers."
                                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-slate-100"
                                />
                            </div>
                        </div>

                        <div className="mt-4">
                            <button
                                type="button"
                                onClick={async () => {
                                    const phoneInput = document.getElementById('test_phone') as HTMLInputElement;
                                    const messageInput = document.getElementById('test_message') as HTMLInputElement;
                                    const btn = document.getElementById('btn-test-send') as HTMLButtonElement;
                                    const resultDiv = document.getElementById('test-result');

                                    if (!phoneInput.value) {
                                        alert('Por favor, digite um número de telefone.');
                                        return;
                                    }

                                    try {
                                        btn.disabled = true;
                                        btn.innerText = 'Enviando...';
                                        if (resultDiv) resultDiv.innerHTML = '';

                                        const { supabase } = await import('../lib/supabaseClient');

                                        const cleanNumber = phoneInput.value.replace(/\D/g, '');
                                        const whatsappJid = `${cleanNumber}@s.whatsapp.net`;

                                        const { data, error } = await supabase.functions.invoke('send-whatsapp', {
                                            body: {
                                                number: whatsappJid,
                                                message: messageInput.value
                                            }
                                        });

                                        if (error) throw error;

                                        if (data.success) {
                                            alert('Mensagem enviada com sucesso!');
                                            if (resultDiv) {
                                                resultDiv.innerHTML = `<p class="text-green-600 mt-2">✅ Sucesso: ${JSON.stringify(data)}</p>`;
                                            }
                                            // Atualizar logs após envio
                                            fetchLogs();
                                        } else {
                                            throw new Error(data.error || 'Erro desconhecido');
                                        }
                                    } catch (err: any) {
                                        console.error(err);
                                        alert('Erro ao enviar: ' + (err.message || err));
                                        if (resultDiv) {
                                            resultDiv.innerHTML = `<p class="text-red-600 mt-2">❌ Erro: ${err.message || JSON.stringify(err)}</p>`;
                                        }
                                        // Atualizar logs mesmo com erro
                                        fetchLogs();
                                    } finally {
                                        btn.disabled = false;
                                        btn.innerText = 'Enviar Teste';
                                    }
                                }}
                                id="btn-test-send"
                                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
                            >
                                Enviar Teste
                            </button>
                        </div>
                        <div id="test-result" className="mt-2 text-sm break-all"></div>
                    </div>

                    {/* Automação */}
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">Automação de Notificações</h2>
                        <p className="text-slate-600 dark:text-slate-400 mb-4">
                            O sistema verifica automaticamente a cada hora se há eventos próximos (24h ou 2h antes) para enviar lembretes.
                            Você pode forçar uma verificação manual agora clicando no botão abaixo.
                        </p>
                        <button
                            type="button"
                            onClick={async () => {
                                const btn = document.getElementById('btn-auto-check') as HTMLButtonElement;
                                try {
                                    btn.disabled = true;
                                    btn.innerText = 'Verificando...';
                                    const { supabase } = await import('../lib/supabaseClient');
                                    const { data, error } = await supabase.functions.invoke('auto-notify');

                                    if (error) throw error;

                                    alert(`Verificação concluída!\nMensagens enviadas: ${data.sent_count}`);
                                    fetchLogs();
                                } catch (err: any) {
                                    console.error(err);
                                    alert('Erro na verificação: ' + (err.message || err));
                                } finally {
                                    btn.disabled = false;
                                    btn.innerText = 'Executar Verificação Manual Agora';
                                }
                            }}
                            id="btn-auto-check"
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                        >
                            Executar Verificação Manual Agora
                        </button>
                    </div>
                </>
            )}
            {/* Conteúdo da Aba: Envio em Massa */}
            {activeTab === 'bulk' && (
                <div className="flex flex-col lg:flex-row gap-8 items-start">
                    {/* Coluna Esquerda: Formulário */}
                    <div className="flex-1 w-full bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 h-fit">
                        {!settings.active && (
                            <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-200 dark:border-yellow-600 rounded-r-lg">
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        <svg className="h-5 w-5 text-yellow-400 dark:text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div className="ml-3">
                                        <p className="text-sm font-medium">
                                            Integração Desativada
                                        </p>
                                        <p className="text-sm mt-1">
                                            O envio de mensagens está desabilitado. Ative a integração na aba "Configuração API" para continuar.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">Envio em Massa</h2>
                        <p className="text-slate-600 dark:text-slate-400 mb-6">
                            Envie mensagens para todos os voluntários de um departamento ou escalados em um evento.
                        </p>

                        {/* Seleção de Tipo */}
                        <div className="flex space-x-6 mb-6">
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="bulkType"
                                    value="department"
                                    checked={bulkType === 'department'}
                                    onChange={() => setBulkType('department')}
                                    className="form-radio text-blue-600 w-4 h-4"
                                />
                                <span className="text-slate-700 dark:text-slate-300">Por Departamento</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="bulkType"
                                    value="event"
                                    checked={bulkType === 'event'}
                                    onChange={() => setBulkType('event')}
                                    className="form-radio text-blue-600 w-4 h-4"
                                />
                                <span className="text-slate-700 dark:text-slate-300">Por Evento</span>
                            </label>
                        </div>

                        {/* Seleção do Alvo */}
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Selecione o {bulkType === 'department' ? 'Departamento' : 'Evento'}
                            </label>
                            <CustomSelect
                                options={targetOptions}
                                value={bulkTargetId}
                                onChange={setBulkTargetId}
                                placeholder={isFetchingTargets ? 'Carregando...' : 'Selecione...'}
                                disabled={isFetchingTargets || isSendingBulk}
                            />
                        </div>

                        {/* Mensagem */}
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Mensagem
                            </label>
                            <textarea
                                value={bulkMessage}
                                onChange={(e) => setBulkMessage(e.target.value)}
                                rows={4}
                                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
                                placeholder="Digite sua mensagem aqui..."
                                disabled={isSendingBulk}
                            />
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                Dica: Use <code>{'{nome}'}</code> para inserir o primeiro nome do voluntário automaticamente.
                            </p>
                        </div>

                        {/* Botão de Envio */}
                        <button
                            onClick={handleBulkSendClick}
                            disabled={isSendingBulk || !bulkTargetId || !bulkMessage || !settings.active}
                            className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                        >
                            {isSendingBulk ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    <span>Enviando...</span>
                                </>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                    </svg>
                                    <span>Enviar Mensagens</span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Coluna Direita: Simulação de iPhone */}
                    <div className="w-full lg:w-[380px] flex-shrink-0 flex justify-center items-start pt-2">
                        <div className="relative w-[340px] h-[680px] bg-black rounded-[3rem] border-[8px] border-[#1f1f1f] shadow-2xl overflow-hidden ring-4 ring-slate-300 dark:ring-slate-700">
                            {/* Notch / Dynamic Island */}
                            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-28 h-7 bg-black rounded-b-2xl z-20 flex justify-center items-center">
                                <div className="w-16 h-4 bg-black rounded-full"></div>
                            </div>

                            {/* Tela do App (WhatsApp) */}
                            <div className="w-full h-full bg-[#111b21] pt-10 flex flex-col relative">
                                {/* Cabeçalho do App */}
                                <div className="px-4 pb-3 pt-2 flex items-center justify-between bg-[#111b21] z-10">
                                    <h2 className="text-white text-xl font-semibold">Conversas</h2>
                                    <div className="flex space-x-4 text-[#00a884]">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /></svg>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                    </div>
                                </div>

                                {/* Campo de Busca Simulado */}
                                <div className="px-4 pb-2">
                                    <div className="bg-[#202c33] rounded-lg h-8 flex items-center px-3">
                                        <svg className="w-4 h-4 text-[#8696a0]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                        <span className="text-[#8696a0] text-sm ml-2">Pesquisar</span>
                                    </div>
                                </div>

                                {/* Lista de Conversas */}
                                <div className="flex-1 overflow-y-auto custom-scrollbar no-scrollbar">
                                    {liveLogs.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-[#8696a0] p-8 text-center opacity-60">
                                            <div className="w-24 h-24 bg-[#202c33] rounded-full flex items-center justify-center mb-4 opacity-50">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                                </svg>
                                            </div>
                                            <p className="text-sm">As mensagens enviadas aparecerão aqui.</p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col-reverse pb-16">
                                            {liveLogs.map((log) => (
                                                <div key={log.id} className="flex items-center px-4 py-3 active:bg-[#202c33] transition-colors animate-fadeIn border-b border-[#202c33]">
                                                    {/* Avatar */}
                                                    <div className="flex-shrink-0 mr-3">
                                                        <div className="w-12 h-12 rounded-full bg-slate-600 flex items-center justify-center text-white font-bold text-lg overflow-hidden relative">
                                                            <div className={`absolute inset-0 bg-gradient-to-br from-blue-400 to-purple-500 opacity-80`}></div>
                                                            <span className="relative z-10">{log.name.charAt(0)}</span>
                                                        </div>
                                                    </div>

                                                    {/* Conteúdo */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-baseline mb-0.5">
                                                            <h4 className="text-[#e9edef] font-medium text-base truncate">{log.name}</h4>
                                                            <span className={`text-[11px] ${log.status === 'success' ? 'text-[#00a884]' : 'text-[#8696a0]'}`}>
                                                                {log.time.slice(0, 5)}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center text-[#8696a0] text-sm truncate">
                                                            {log.status === 'sending' && (
                                                                <svg className="w-3.5 h-3.5 mr-1 animate-spin" fill="none" viewBox="0 0 24 24">
                                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                </svg>
                                                            )}
                                                            {log.status === 'success' && (
                                                                <span className="mr-1 text-[#53bdeb]">
                                                                    <svg viewBox="0 0 16 11" height="11" width="16" preserveAspectRatio="xMidYMid meet" className="" version="1.1" x="0px" y="0px" enableBackground="new 0 0 16 11">
                                                                        <path fill="currentColor" d="M11.057,9.734L11.057,9.734L6.486,5.163l1.914-1.914l2.657,2.657l5.429-5.429l1.914,1.914L11.057,9.734z"></path>
                                                                        <path fill="currentColor" d="M9.629,9.734L9.629,9.734L5.057,5.163l1.914-1.914l2.657,2.657l5.429-5.429l1.914,1.914L9.629,9.734z"></path>
                                                                        <path fill="currentColor" d="M4.571,9.734L4.571,9.734L0,5.163l1.914-1.914l2.657,2.657l5.429-5.429l1.914,1.914L4.571,9.734z"></path>
                                                                    </svg>
                                                                </span>
                                                            )}
                                                            {log.status === 'error' && (
                                                                <span className="mr-1 text-red-500">⚠</span>
                                                            )}
                                                            <span className="truncate">
                                                                {log.status === 'sending' ? 'Enviando...' :
                                                                    log.status === 'error' ? 'Falha' :
                                                                        bulkMessage.replace('{nome}', log.name.split(' ')[0])}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <div ref={logsEndRef} />
                                </div>

                                {/* Barra de Progresso (Integrada) */}
                                {bulkProgress && bulkProgress.total > 0 && (
                                    <div className="absolute bottom-16 left-0 w-full bg-[#202c33]/95 backdrop-blur-sm p-2 border-t border-slate-700 z-10">
                                        <div className="flex justify-between text-[10px] text-[#8696a0] mb-1 px-1">
                                            <span>Enviando: {bulkProgress.current} de {bulkProgress.total}</span>
                                            <span>{Math.round((bulkProgress.current / bulkProgress.total) * 100)}%</span>
                                        </div>
                                        <div className="w-full bg-[#37404a] rounded-full h-1 overflow-hidden">
                                            <div
                                                className="h-1 rounded-full transition-all duration-300 bg-[#00a884]"
                                                style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                )}

                                {/* Barra de Navegação Inferior (Simulada) */}
                                <div className="absolute bottom-0 w-full bg-[#202c33] h-16 border-t border-slate-700 flex justify-around items-center text-[#8696a0] z-20">
                                    <div className="flex flex-col items-center text-[#00a884]">
                                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" /></svg>
                                        <span className="text-[10px] mt-1">Conversas</span>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        <span className="text-[10px] mt-1">Status</span>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                        <span className="text-[10px] mt-1">Chamadas</span>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                        <span className="text-[10px] mt-1">Config</span>
                                    </div>
                                </div>

                                {/* Home Indicator */}
                                <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-32 h-1 bg-white/20 rounded-full z-20"></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Modal de Confirmação Customizado (com Portal) */}
            {showConfirmationModal && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm w-screen h-screen top-0 left-0">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 transform transition-all scale-100 relative z-[10000]">
                        <div className="flex items-center justify-center w-12 h-12 mx-auto bg-blue-100 dark:bg-blue-900/30 rounded-full mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-bold text-center text-slate-900 dark:text-white mb-2">
                            Confirmar Envio em Massa
                        </h3>
                        <p className="text-center text-slate-600 dark:text-slate-300 mb-6">
                            Encontrados <strong>{bulkStats.total}</strong> voluntários.<br />
                            Serão enviadas <strong>{bulkStats.unique}</strong> mensagens.<br />
                            <span className="text-xs text-slate-500">(Números duplicados ou sem telefone foram removidos automaticamente)</span>
                        </p>
                        <div className="flex space-x-3">
                            <button
                                onClick={() => setShowConfirmationModal(false)}
                                className="flex-1 px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg font-medium transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmBulkSend}
                                className="flex-1 px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors shadow-lg shadow-blue-500/30"
                            >
                                Confirmar Envio
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Conteúdo da Aba: Templates de Mensagens */}
            {activeTab === 'templates' && (
                <div className="space-y-6">
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2 flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Sobre os Templates
                        </h3>
                        <p className="text-sm text-blue-800 dark:text-blue-300">
                            Personalize as mensagens automáticas enviadas pelo sistema. Use as variáveis disponíveis para inserir dados dinâmicos.
                        </p>
                    </div>

                    {isLoadingTemplates ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        templates
                            .filter(template => !template.template_type.startsWith('push_'))
                            .map((template) => {
                                const templateLabels: Record<string, string> = {
                                    '24h_before': 'WhatsApp: Notificação 24h Antes',
                                    '2h_before': 'WhatsApp: Notificação 2h Antes',
                                    'attendance_confirmed': 'WhatsApp: Confirmação de Presença',
                                    'new_schedule': 'WhatsApp: Nova Escala',
                                    'push_24h_before': 'Push: Lembrete 24h Antes',
                                    'push_2h_before': 'Push: Lembrete 2h Antes',
                                    'push_attendance_confirmed': 'Push: Presença Confirmada'
                                };

                                const templateDescriptions: Record<string, string> = {
                                    '24h_before': 'Mensagem WhatsApp enviada 24 horas antes do evento',
                                    '2h_before': 'Mensagem WhatsApp enviada 2 horas antes do evento',
                                    'attendance_confirmed': 'Mensagem WhatsApp ao confirmar presença',
                                    'new_schedule': 'Mensagem WhatsApp enviada ao escalar um voluntário',
                                    'push_24h_before': 'Notificação push (celular) enviada 24 horas antes',
                                    'push_2h_before': 'Notificação push (celular) enviada 2 horas antes',
                                    'push_attendance_confirmed': 'Notificação push (celular) ao confirmar presença'
                                };

                                const isEditing = editingTemplate === template.template_type;

                                return (
                                    <div key={template.id} className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border border-slate-200 dark:border-slate-700">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                                                    {templateLabels[template.template_type]}
                                                </h3>
                                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                                    {templateDescriptions[template.template_type]}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => setEditingTemplate(isEditing ? null : template.template_type)}
                                                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                                            >
                                                {isEditing ? 'Cancelar' : 'Editar'}
                                            </button>
                                        </div>

                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                                    Variáveis Disponíveis
                                                </label>
                                                <div className="flex flex-wrap gap-2">
                                                    {template.variables.map((variable: string) => (
                                                        <span
                                                            key={variable}
                                                            className="px-3 py-1 text-xs font-mono font-semibold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
                                                        >
                                                            {`{${variable}}`}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                                    Mensagem
                                                </label>
                                                <textarea
                                                    id={`template-${template.template_type}`}
                                                    defaultValue={template.message_content}
                                                    disabled={!isEditing}
                                                    rows={4}
                                                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-slate-100 ${isEditing
                                                        ? 'border-slate-300 dark:border-slate-600'
                                                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 cursor-not-allowed'
                                                        }`}
                                                />
                                            </div>

                                            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                                                    Preview (Exemplo)
                                                </p>
                                                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                                                    {(document.getElementById(`template-${template.template_type}`) as HTMLTextAreaElement)?.value
                                                        ?.replace('{nome}', 'João')
                                                        ?.replace('{evento}', 'Culto de Domingo')
                                                        ?.replace('{horario}', '09:00') || template.message_content
                                                            .replace('{nome}', 'João')
                                                            .replace('{evento}', 'Culto de Domingo')
                                                            .replace('{horario}', '09:00')}
                                                </p>
                                            </div>

                                            {isEditing && (
                                                <div className="flex space-x-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                                                    <button
                                                        onClick={async () => {
                                                            const textarea = document.getElementById(`template-${template.template_type}`) as HTMLTextAreaElement;
                                                            const newContent = textarea.value;

                                                            try {
                                                                const { error } = await supabase
                                                                    .from('whatsapp_message_templates')
                                                                    .update({ message_content: newContent, updated_at: new Date().toISOString() })
                                                                    .eq('template_type', template.template_type);

                                                                if (error) throw error;

                                                                setMessage({ type: 'success', text: 'Template atualizado com sucesso!' });
                                                                fetchTemplates();
                                                                setEditingTemplate(null);
                                                            } catch (error: any) {
                                                                console.error('Erro ao salvar template:', error);
                                                                setMessage({ type: 'error', text: 'Erro ao salvar template: ' + error.message });
                                                            }
                                                        }}
                                                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                                                    >
                                                        Salvar Alterações
                                                    </button>
                                                    <button
                                                        onClick={async () => {
                                                            if (!confirm('Tem certeza que deseja restaurar o template padrão? Esta ação não pode ser desfeita.')) return;

                                                            const defaultTemplates: Record<string, string> = {
                                                                '24h_before': 'Olá {nome}, lembrete: Você está escalado para o evento *{evento}* amanhã às {horario}.',
                                                                '2h_before': 'Olá {nome}, lembrete: O evento *{evento}* começa em breve (às {horario}).',
                                                                'attendance_confirmed': 'Olá {nome}, sua presença foi confirmada no evento *{evento}*. Bom serviço!'
                                                            };

                                                            try {
                                                                const { error } = await supabase
                                                                    .from('whatsapp_message_templates')
                                                                    .update({ message_content: defaultTemplates[template.template_type], updated_at: new Date().toISOString() })
                                                                    .eq('template_type', template.template_type);

                                                                if (error) throw error;

                                                                setMessage({ type: 'success', text: 'Template restaurado para o padrão!' });
                                                                fetchTemplates();
                                                                setEditingTemplate(null);
                                                            } catch (error: any) {
                                                                console.error('Erro ao restaurar template:', error);
                                                                setMessage({ type: 'error', text: 'Erro ao restaurar template: ' + error.message });
                                                            }
                                                        }}
                                                        className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-semibold rounded-lg transition-colors"
                                                    >
                                                        Restaurar Padrão
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                    )}
                </div>
            )}

            {/* Conteúdo da Aba: Histórico */}
            {activeTab === 'history' && (
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md overflow-hidden border border-slate-200 dark:border-slate-700">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Histórico de Envios</h2>
                        <button onClick={fetchLogs} className="text-sm text-blue-600 hover:underline">Atualizar Lista</button>
                    </div>
                    <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 relative">
                            <thead className="bg-slate-50 dark:bg-slate-700 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider bg-slate-50 dark:bg-slate-700">Data/Hora</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider bg-slate-50 dark:bg-slate-700">Destinatário</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider bg-slate-50 dark:bg-slate-700">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider bg-slate-50 dark:bg-slate-700">Detalhes</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                                {logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                                            Nenhum registro encontrado.
                                        </td>
                                    </tr>
                                ) : (
                                    logs.map((log) => (
                                        <tr key={log.id}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                                                {new Date(log.created_at).toLocaleString('pt-BR')}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                                                {log.recipient_phone}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {log.status === 'success' ? (
                                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                                        Sucesso
                                                    </span>
                                                ) : (
                                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                                        Erro
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400 max-w-xs truncate" title={log.error_message || log.message_content}>
                                                {log.status === 'error' ? log.error_message : log.message_content}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WhatsAppSettingsPage;
