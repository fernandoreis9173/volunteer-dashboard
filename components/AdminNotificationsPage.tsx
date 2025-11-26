import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Department, Event } from '../types';
import { getErrorMessage } from '../lib/utils';

import CustomSelect from './CustomSelect';

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

    const selectedDepartmentName = useMemo(() => {
        return departments.find(d => d.id === selectedDepartmentId)?.name || '';
    }, [departments, selectedDepartmentId]);

    const selectedEventName = useMemo(() => {
        return events.find(e => e.id === selectedEventId)?.name || '';
    }, [events, selectedEventId]);

    return (
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
            </form >
        </div >
    );
};

export default AdminNotificationsPage;
