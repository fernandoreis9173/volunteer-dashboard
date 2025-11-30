import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Department, Event } from '../types';
import { getErrorMessage } from '../lib/utils';

import CustomSelect from './CustomSelect';

interface MessageTemplate {
    id: number;
    template_type: string;
    message_content: string;
    variables: string[];
    active: boolean;
}

interface AdminNotificationsPageProps {
    onDataChange: () => void;
}

interface Recipient {
    id: string;
    name: string;
    email: string;
    role: string;
}

const AdminNotificationsPage: React.FC<AdminNotificationsPageProps> = ({ onDataChange }) => {
    // Tab State
    const [activeTab, setActiveTab] = useState<'notifications' | 'templates'>('notifications');

    // Filter Type
    const [filterType, setFilterType] = useState<'department' | 'event'>('department');

    // Department Filter States
    const [departments, setDepartments] = useState<Department[]>([]);
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null);
    const [includeLeaders, setIncludeLeaders] = useState(true);
    const [includeVolunteers, setIncludeVolunteers] = useState(true);

    // Event Filter States
    const [events, setEvents] = useState<Event[]>([]);
    const [selectedEventId, setSelectedEventId] = useState<number | null>(null);

    // Message and Recipients
    const [message, setMessage] = useState('');
    const [recipients, setRecipients] = useState<Recipient[]>([]);
    const [loadingRecipients, setLoadingRecipients] = useState(false);

    // Sending States
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Template States
    const [templates, setTemplates] = useState<MessageTemplate[]>([]);
    const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<string | null>(null);

    // Fetch departments on mount
    useEffect(() => {
        const fetchDepartments = async () => {
            const { data, error } = await supabase
                .from('departments')
                .select('*')
                .order('name');

            if (!error && data) {
                setDepartments(data);
            }
        };
        fetchDepartments();
    }, []);

    // Fetch future/active events on mount
    useEffect(() => {
        const fetchEvents = async () => {
            const today = new Date().toISOString().split('T')[0];
            const { data, error } = await supabase
                .from('events')
                .select('*')
                .gte('date', today)
                .order('date', { ascending: true });

            if (!error && data) {
                setEvents(data);
            }
        };
        fetchEvents();
    }, []);

    // Fetch recipients when filters change
    useEffect(() => {
        const fetchRecipients = async () => {
            setRecipients([]);
            setLoadingRecipients(true);

            if (filterType === 'department' && selectedDepartmentId) {
                await fetchDepartmentRecipients();
            } else if (filterType === 'event' && selectedEventId) {
                await fetchEventRecipients();
            }

            setLoadingRecipients(false);
        };

        fetchRecipients();
    }, [filterType, selectedDepartmentId, includeLeaders, includeVolunteers, selectedEventId]);

    // Fetch templates when Templates tab is active
    useEffect(() => {
        if (activeTab === 'templates') {
            fetchTemplates();
        }
    }, [activeTab]);

    const fetchDepartmentRecipients = async () => {
        if (!selectedDepartmentId) return;

        const recipientsList: Recipient[] = [];
        const departmentIds = [selectedDepartmentId]; // Assuming selectedDepartmentId is a single ID

        // Fetch leaders if selected
        if (includeLeaders) {
            // Primeiro busca os IDs dos líderes do departamento
            const { data: leadersIds } = await supabase
                .from('department_leaders')
                .select('user_id')
                .in('department_id', departmentIds);

            if (leadersIds) {
                const ids = leadersIds.map((l: any) => l.user_id);

                // Busca os detalhes dos usuários (líderes) via edge function para garantir acesso
                const { data: usersData, error: usersError } = await supabase.functions.invoke('list-users');

                if (!usersError && usersData && usersData.users) {
                    const leadersDetails = usersData.users.filter((user: any) => ids.includes(user.id));

                    leadersDetails.forEach((leader: any) => {
                        recipientsList.push({
                            id: leader.id,
                            name: leader.user_metadata?.name || 'Líder (Sem nome)',
                            email: leader.email || 'Email não disponível',
                            role: 'Líder'
                        });
                    });
                }
            }
        }

        // Fetch volunteers if selected
        if (includeVolunteers) {
            const { data: volunteersData } = await supabase
                .from('volunteer_departments')
                .select('volunteers(id, name, email, user_id)')
                .eq('department_id', selectedDepartmentId);

            if (volunteersData) {
                volunteersData.forEach((item: any) => {
                    if (item.volunteers && item.volunteers.user_id) {
                        recipientsList.push({
                            id: item.volunteers.user_id,
                            name: item.volunteers.name,
                            email: item.volunteers.email,
                            role: 'Voluntário'
                        });
                    }
                });
            }
        }

        // Remove duplicates by user ID
        const uniqueRecipients = Array.from(
            new Map(recipientsList.map(r => [r.id, r])).values()
        );

        setRecipients(uniqueRecipients);
    };

    const fetchEventRecipients = async () => {
        if (!selectedEventId) return;

        const { data: eventVolunteersData } = await supabase
            .from('event_volunteers')
            .select('volunteers(id, name, email, user_id)')
            .eq('event_id', selectedEventId);

        if (eventVolunteersData) {
            const recipientsList: Recipient[] = [];
            eventVolunteersData.forEach((item: any) => {
                if (item.volunteers && item.volunteers.user_id) {
                    recipientsList.push({
                        id: item.volunteers.user_id,
                        name: item.volunteers.name,
                        email: item.volunteers.email,
                        role: 'Voluntário Escalado'
                    });
                }
            });

            // Remove duplicates
            const uniqueRecipients = Array.from(
                new Map(recipientsList.map(r => [r.id, r])).values()
            );

            setRecipients(uniqueRecipients);
        }
    };

    const handleSendNotification = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!message.trim()) {
            setError('A mensagem não pode estar vazia.');
            return;
        }

        if (recipients.length === 0) {
            setError('Nenhum destinatário selecionado.');
            return;
        }

        setSending(true);
        setError(null);
        setSuccess(null);

        try {
            const userIds = recipients.map(r => r.id);

            const { error: invokeError } = await supabase.functions.invoke('create-notifications', {
                body: {
                    message: message.trim(),
                    targetType: filterType,
                    departmentId: filterType === 'department' ? selectedDepartmentId : undefined,
                    includeLeaders: filterType === 'department' ? includeLeaders : undefined,
                    includeVolunteers: filterType === 'department' ? includeVolunteers : undefined,
                    eventId: filterType === 'event' ? selectedEventId : undefined,
                    userIds
                },
            });

            if (invokeError) throw invokeError;

            setSuccess(`Notificação enviada com sucesso para ${recipients.length} ${recipients.length === 1 ? 'destinatário' : 'destinatários'}!`);
            setMessage('');
            onDataChange();
        } catch (err) {
            setError(`Falha ao enviar notificação: ${getErrorMessage(err)}`);
        } finally {
            setSending(false);
        }
    };

    const fetchTemplates = async () => {
        try {
            setIsLoadingTemplates(true);
            const { data, error } = await supabase
                .from('whatsapp_message_templates')
                .select('*')
                .eq('active', true)
                .order('template_type');

            if (error) throw error;
            if (data) {
                setTemplates(data);
            }
        } catch (error: any) {
            console.error('Erro ao carregar templates:', error);
            setError('Erro ao carregar templates de notificação');
        } finally {
            setIsLoadingTemplates(false);
        }
    };

    const handleSaveTemplate = async (templateType: string) => {
        try {
            const textarea = document.getElementById(`template-${templateType}`) as HTMLTextAreaElement;
            if (!textarea) return;

            const newContent = textarea.value;
            const { error } = await supabase
                .from('whatsapp_message_templates')
                .update({ message_content: newContent, updated_at: new Date().toISOString() })
                .eq('template_type', templateType);

            if (error) throw error;

            setSuccess('Template atualizado com sucesso!');
            setEditingTemplate(null);
            await fetchTemplates();
            setTimeout(() => setSuccess(null), 3000);
        } catch (error: any) {
            setError(`Erro ao salvar template: ${error.message}`);
        }
    };

    const handleRestoreTemplate = async (templateType: string) => {
        const defaultTemplates: Record<string, string> = {
            'push_24h_before': 'Lembrete (24h): Você está escalado para "{evento}" amanhã às {horario}.',
            'push_2h_before': 'Lembrete (2h): Você está escalado para "{evento}" hoje às {horario}.',
            'push_attendance_confirmed': 'Presença Confirmada! Sua presença foi confirmada no evento: "{evento}".'
        };

        const defaultContent = defaultTemplates[templateType];
        if (!defaultContent) return;

        try {
            const { error } = await supabase
                .from('whatsapp_message_templates')
                .update({ message_content: defaultContent, updated_at: new Date().toISOString() })
                .eq('template_type', templateType);

            if (error) throw error;

            setSuccess('Template restaurado para o padrão!');
            await fetchTemplates();
            setTimeout(() => setSuccess(null), 3000);
        } catch (error: any) {
            setError(`Erro ao restaurar template: ${error.message}`);
        }
    };

    const selectedDepartmentName = useMemo(() => {
        return departments.find(d => d.id === selectedDepartmentId)?.name || '';
    }, [departments, selectedDepartmentId]);

    const selectedEventName = useMemo(() => {
        return events.find(e => e.id === selectedEventId)?.name || '';
    }, [events, selectedEventId]);

    return (
        <div className="space-y-6">
            {/* Tab Navigation */}
            <div className="border-b border-slate-200">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => setActiveTab('notifications')}
                        className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'notifications'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                            }`}
                    >
                        Notificações Direcionadas
                    </button>
                    <button
                        onClick={() => setActiveTab('templates')}
                        className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'templates'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                            }`}
                    >
                        Templates de Notificações
                    </button>
                </nav>
            </div>

            {/* Notifications Tab Content */}
            {activeTab === 'notifications' && (
                <div className="space-y-6">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Notificações Direcionadas</h1>
                        <p className="text-slate-500 mt-1">Envie notificações específicas para departamentos ou eventos.</p>
                    </div>

                    <form onSubmit={handleSendNotification} className="space-y-6">
                        {/* Filter Type Selection */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                            <h2 className="text-lg font-bold text-slate-800 mb-4">Selecionar Destinatários</h2>

                            <div className="space-y-4">
                                {/* Radio Buttons */}
                                <div className="flex gap-6">
                                    <label className="flex items-center cursor-pointer">
                                        <input
                                            type="radio"
                                            name="filterType"
                                            value="department"
                                            checked={filterType === 'department'}
                                            onChange={() => setFilterType('department')}
                                            className="mr-2"
                                        />
                                        <span className="text-sm font-medium text-slate-700">Por Departamento</span>
                                    </label>
                                    <label className="flex items-center cursor-pointer">
                                        <input
                                            type="radio"
                                            name="filterType"
                                            value="event"
                                            checked={filterType === 'event'}
                                            onChange={() => setFilterType('event')}
                                            className="mr-2"
                                        />
                                        <span className="text-sm font-medium text-slate-700">Por Evento</span>
                                    </label>
                                </div>



                                {/* Department Filter */}
                                {filterType === 'department' && (
                                    <div className="space-y-4 pt-4 border-t border-slate-200">
                                        <div>
                                            <CustomSelect
                                                label="Departamento"
                                                value={selectedDepartmentId || ''}
                                                onChange={(val) => setSelectedDepartmentId(Number(val))}
                                                options={departments.map(dept => ({
                                                    value: dept.id,
                                                    label: dept.name
                                                }))}
                                                placeholder="Selecione um departamento..."
                                            />
                                        </div>

                                        <div>
                                            <p className="text-sm font-medium text-slate-700 mb-2">Incluir:</p>
                                            <div className="space-y-2">
                                                <label className="flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={includeLeaders}
                                                        onChange={(e) => setIncludeLeaders(e.target.checked)}
                                                        className="mr-2"
                                                    />
                                                    <span className="text-sm text-slate-600">Líderes do departamento</span>
                                                </label>
                                                <label className="flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={includeVolunteers}
                                                        onChange={(e) => setIncludeVolunteers(e.target.checked)}
                                                        className="mr-2"
                                                    />
                                                    <span className="text-sm text-slate-600">Voluntários do departamento</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Event Filter */}
                                {filterType === 'event' && (
                                    <div className="pt-4 border-t border-slate-200">
                                        <CustomSelect
                                            label="Evento"
                                            value={selectedEventId || ''}
                                            onChange={(val) => setSelectedEventId(Number(val))}
                                            options={events.map(event => ({
                                                value: event.id,
                                                label: `${event.name} - ${event.date.split('-').reverse().join('/')}`
                                            }))}
                                            placeholder="Selecione um evento..."
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Recipients Preview */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-bold text-slate-800">
                                    Destinatários ({recipients.length})
                                </h2>
                                {filterType === 'department' && selectedDepartmentName && (
                                    <span className="text-sm text-slate-500">{selectedDepartmentName}</span>
                                )}
                                {filterType === 'event' && selectedEventName && (
                                    <span className="text-sm text-slate-500">{selectedEventName}</span>
                                )}
                            </div>

                            {loadingRecipients ? (
                                <p className="text-sm text-slate-500">Carregando destinatários...</p>
                            ) : recipients.length > 0 ? (
                                <div className="max-h-60 overflow-y-auto space-y-2">
                                    {recipients.map(recipient => (
                                        <div
                                            key={recipient.id}
                                            className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                                        >
                                            <div>
                                                <p className="font-medium text-slate-800 text-sm">{recipient.name}</p>
                                                <p className="text-xs text-slate-500">{recipient.email}</p>
                                            </div>
                                            <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                                                {recipient.role}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-slate-500 text-center py-8">
                                    {filterType === 'department'
                                        ? 'Selecione um departamento e marque pelo menos uma opção'
                                        : 'Selecione um evento'}
                                </p>
                            )}
                        </div>

                        {/* Message */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                            <h2 className="text-lg font-bold text-slate-800 mb-4">Mensagem</h2>
                            <div>
                                <label htmlFor="notification-message" className="block text-sm font-medium text-slate-700 mb-1">
                                    Conteúdo da Notificação
                                </label>
                                <textarea
                                    id="notification-message"
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    rows={4}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                    placeholder="Digite a mensagem que será enviada..."
                                    maxLength={500}
                                />
                                <p className="text-xs text-slate-500 mt-1">{message.length}/500 caracteres</p>
                            </div>
                        </div>

                        {/* Submit */}
                        <div className="flex justify-between items-center">
                            <div>
                                {error && <p className="text-sm text-red-500">{error}</p>}
                                {success && <p className="text-sm text-green-500">{success}</p>}
                            </div>
                            <button
                                type="submit"
                                disabled={sending || recipients.length === 0 || !message.trim()}
                                className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
                            >
                                {sending ? 'Enviando...' : `Enviar para ${recipients.length} ${recipients.length === 1 ? 'pessoa' : 'pessoas'}`}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Templates Tab Content */}
            {activeTab === 'templates' && (
                <div className="space-y-6">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Templates de Notificações Push</h1>
                        <p className="text-slate-500 mt-1">Personalize as mensagens de notificação push (PWA) enviadas automaticamente.</p>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm text-blue-800">
                            💡 <strong>Dica:</strong> Estes templates controlam as notificações push que aparecem no celular.

                        </p>
                    </div>

                    {isLoadingTemplates ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        templates
                            .filter(template => template.template_type.startsWith('push_'))
                            .map((template) => {
                                const templateLabels: Record<string, string> = {
                                    'push_24h_before': 'Lembrete 24h Antes',
                                    'push_2h_before': 'Lembrete 3h Antes',
                                    'push_attendance_confirmed': 'Presença Confirmada'
                                };

                                const templateDescriptions: Record<string, string> = {
                                    'push_24h_before': 'Notificação push enviada 24 horas antes do evento',
                                    'push_2h_before': 'Notificação push enviada 3 horas antes do evento',
                                    'push_attendance_confirmed': 'Notificação push ao confirmar presença'
                                };

                                const isEditing = editingTemplate === template.template_type;

                                return (
                                    <div key={template.id} className="bg-white rounded-lg shadow-md p-6 border border-slate-200">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h3 className="text-lg font-bold text-slate-800">
                                                    {templateLabels[template.template_type]}
                                                </h3>
                                                <p className="text-sm text-slate-500 mt-1">
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
                                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                                    Variáveis Disponíveis
                                                </label>
                                                <div className="flex flex-wrap gap-2">
                                                    {template.variables.map((variable: string) => (
                                                        <span
                                                            key={variable}
                                                            className="px-3 py-1 text-xs font-mono font-semibold rounded-full bg-purple-100 text-purple-800"
                                                        >
                                                            {`{${variable}}`}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                                    Mensagem
                                                </label>
                                                <textarea
                                                    id={`template-${template.template_type}`}
                                                    defaultValue={template.message_content}
                                                    disabled={!isEditing}
                                                    rows={4}
                                                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isEditing
                                                        ? 'border-slate-300'
                                                        : 'border-slate-200 bg-slate-50 cursor-not-allowed'
                                                        }`}
                                                />
                                            </div>

                                            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                                    Preview (Exemplo)
                                                </p>
                                                <p className="text-sm text-slate-700 whitespace-pre-wrap">
                                                    {(document.getElementById(`template-${template.template_type}`) as HTMLTextAreaElement)?.value
                                                        ?.replace('{evento}', 'Culto de Domingo')
                                                        ?.replace('{horario}', '09:00') || template.message_content
                                                            .replace('{evento}', 'Culto de Domingo')
                                                            .replace('{horario}', '09:00')}
                                                </p>
                                            </div>

                                            {isEditing && (
                                                <div className="flex gap-3 pt-2">
                                                    <button
                                                        onClick={() => handleSaveTemplate(template.template_type)}
                                                        className="flex-1 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                                                    >
                                                        Salvar Alterações
                                                    </button>
                                                    <button
                                                        onClick={() => handleRestoreTemplate(template.template_type)}
                                                        className="px-4 py-2 bg-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-300 transition-colors"
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
        </div>
    );
};

export default AdminNotificationsPage;
