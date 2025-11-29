import React, { useState, useEffect } from 'react';
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

    const [activeTab, setActiveTab] = useState<'config' | 'test' | 'history'>('config');

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-4xl mx-auto">
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
                                    defaultValue="Olá! Teste de integração do Volunteer Dashboard."
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

                                        const { data, error } = await supabase.functions.invoke('send-whatsapp', {
                                            body: {
                                                number: phoneInput.value.replace(/\D/g, ''),
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
