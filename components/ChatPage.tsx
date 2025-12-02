import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Session } from '@supabase/supabase-js';
import { getErrorMessage } from '../lib/utils';

interface ChatPageProps {
    session: Session | null;
    userRole: string;
}

interface Contact {
    id: string;
    name: string;
    phone: string;
    role: string;
    department?: string;
    lastMessage?: string;
    lastMessageTime?: string;
    unreadCount?: number;
}

interface Message {
    id: number;
    sender_id: string;
    receiver_id: string;
    message: string;
    created_at: string;
    read: boolean;
}

const ChatPage: React.FC<ChatPageProps> = ({ session, userRole }) => {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [filterTab, setFilterTab] = useState<'tudo' | 'nao_lidas' | 'favoritas' | 'grupos'>('tudo');
    const [searchQuery, setSearchQuery] = useState('');
    const [favorites, setFavorites] = useState<Set<string>>(new Set());
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
    const [groups, setGroups] = useState<Array<{ id: string, name: string, members: string[], whatsappGroupId?: string }>>([]);
    const [creatingGroup, setCreatingGroup] = useState(false);
    const [toast, setToast] = useState<{ show: boolean, message: string, type: 'success' | 'error' | 'info' }>({
        show: false,
        message: '',
        type: 'info'
    });
    const [selectedGroup, setSelectedGroup] = useState<{ id: string, name: string, members: string[], whatsappGroupId?: string } | null>(null);
    const [groupMessages, setGroupMessages] = useState<any[]>([]);
    const [whatsappEnabled, setWhatsappEnabled] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, groupMessages]);

    // Carregar contatos apenas uma vez
    const contactsLoadedRef = useRef(false);

    useEffect(() => {
        if (session && !contactsLoadedRef.current) {
            fetchContacts();
            contactsLoadedRef.current = true;
        }
    }, [session]);

    useEffect(() => {
        if (selectedContact && session) {
            fetchMessages(selectedContact.id);
            markMessagesAsRead(selectedContact.id);
            setSelectedGroup(null); // Limpar grupo selecionado
        }
    }, [selectedContact, session]);

    useEffect(() => {
        if (selectedGroup) {
            fetchGroupMessages(selectedGroup.id);
            setSelectedContact(null); // Limpar contato selecionado

            // Realtime para mensagens do grupo
            const channel = supabase
                .channel(`group_chat:${selectedGroup.id}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'whatsapp_group_messages',
                        filter: `group_id=eq.${selectedGroup.id}`,
                    },
                    (payload) => {
                        console.log('Nova mensagem realtime recebida:', payload);
                        setGroupMessages(prev => {
                            // Evitar duplicatas (se já adicionamos via optimistic UI)
                            if (prev.some(m => m.id === payload.new.id)) return prev;
                            return [...prev, payload.new];
                        });
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [selectedGroup]);

    // Monitorar status da integração do WhatsApp
    useEffect(() => {
        const checkWhatsAppStatus = async () => {
            try {
                const { data, error } = await supabase
                    .from('whatsapp_settings')
                    .select('active')
                    .single();

                if (error) {
                    console.error('Erro ao verificar status do WhatsApp:', error);
                    return;
                }

                setWhatsappEnabled(data?.active || false);
            } catch (error) {
                console.error('Erro ao verificar status do WhatsApp:', error);
            }
        };

        if (session) {
            checkWhatsAppStatus();

            // Monitorar mudanças em tempo real
            const channel = supabase
                .channel('whatsapp_settings_changes')
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'whatsapp_settings',
                    },
                    (payload) => {
                        if (payload.new && 'active' in payload.new) {
                            setWhatsappEnabled((payload.new as any).active || false);
                            if (!(payload.new as any).active) {
                                showToast('Integração do WhatsApp foi desativada pelo administrador', 'info');
                            }
                        }
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [session]);

    const handleSendGroupMessage = async () => {
        const messageText = newMessage.trim();
        if (!messageText || !selectedGroup) return;

        // Gerar ID temporário (UUID v4)
        const tempId = crypto.randomUUID();

        // 1. Optimistic Update: Adicionar mensagem imediatamente
        const optimisticMessage = {
            id: tempId,
            group_id: selectedGroup.id,
            sender_id: session?.user?.id,
            message: messageText,
            created_at: new Date().toISOString(),
            sender: { email: session?.user?.email } // Mock sender info
        };

        setNewMessage(''); // Limpar input imediatamente
        setGroupMessages(prev => [...prev, optimisticMessage]);

        // Não bloquear UI com sending state para permitir digitação contínua
        // setSending(true); 

        try {
            const { error } = await supabase.functions.invoke('send-whatsapp-group-message', {
                body: {
                    groupId: selectedGroup.id,
                    message: messageText,
                    messageId: tempId // Enviar ID gerado para o backend usar
                }
            });

            if (error) {
                // Tentar extrair mensagem de erro do corpo se disponível
                let errorMessage = error.message;
                if (error instanceof Error && 'context' in error) {
                    // @ts-ignore
                    const context = error.context as any;
                    if (context && context.json) {
                        const json = await context.json();
                        if (json.error) errorMessage = json.error;
                    }
                }
                throw new Error(errorMessage);
            }

            // Sucesso: A mensagem real virá via Realtime, mas como usamos o mesmo ID,
            // a lógica de deduplicação no useEffect vai impedir duplicatas.

        } catch (error) {
            console.error('Erro detalhado ao enviar mensagem:', error);
            // @ts-ignore
            showToast('Erro ao enviar: ' + (error as Error).message, 'error');

            // Reverter optimistic update em caso de erro
            setGroupMessages(prev => prev.filter(m => m.id !== tempId));
            setNewMessage(messageText); // Restaurar texto
        }
    };

    const fetchGroupMessages = async (groupId: string) => {
        try {
            const { data, error } = await supabase
                .from('whatsapp_group_messages')
                .select('*')
                .eq('group_id', groupId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setGroupMessages(data || []);
        } catch (error) {
            console.error('Erro ao buscar mensagens do grupo:', error);
        }
    };

    // Realtime Subscription Global
    const selectedContactRef = useRef<Contact | null>(null);

    useEffect(() => {
        selectedContactRef.current = selectedContact;
    }, [selectedContact]);

    // Realtime Subscription Global
    useEffect(() => {
        if (!session?.user?.id) return;

        const channel = supabase
            .channel('chat_realtime_global')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'chat_messages',
                    filter: `receiver_id=eq.${session.user.id}`,
                },
                (payload) => {
                    const newMessage = payload.new as Message;
                    const currentSelected = selectedContactRef.current;

                    // 1. Se estiver com o chat aberto com quem enviou, adiciona na lista de mensagens
                    if (currentSelected && newMessage.sender_id === currentSelected.id) {
                        setMessages((prev) => [...prev, newMessage]);
                        markMessagesAsRead(currentSelected.id);
                    }

                    // 2. Atualiza a lista de contatos (última mensagem, horário, contador)
                    setContacts((prevContacts) => {
                        return prevContacts.map(contact => {
                            if (contact.id === newMessage.sender_id) {
                                return {
                                    ...contact,
                                    lastMessage: newMessage.message,
                                    lastMessageTime: new Date(newMessage.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                                    unreadCount: (currentSelected?.id === contact.id) ? 0 : (contact.unreadCount || 0) + 1
                                };
                            }
                            return contact;
                        }).sort((a, b) => {
                            // Opcional: Reordenar para colocar quem mandou mensagem no topo
                            if (a.id === newMessage.sender_id) return -1;
                            if (b.id === newMessage.sender_id) return 1;
                            return 0;
                        });
                    });
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'chat_messages',
                    filter: `sender_id=eq.${session.user.id}`,
                },
                (payload) => {
                    const newMessage = payload.new as Message;
                    const currentSelected = selectedContactRef.current;

                    // 1. Se estiver com o chat aberto para quem enviei, adiciona na lista
                    if (currentSelected && newMessage.receiver_id === currentSelected.id) {
                        // Evitar duplicação se já tiver sido adicionado localmente (embora tenhamos removido o fetchMessages)
                        setMessages((prev) => {
                            if (prev.some(m => m.id === newMessage.id)) return prev;
                            return [...prev, newMessage];
                        });
                    }

                    // 2. Atualiza a lista de contatos (última mensagem enviada)
                    setContacts((prevContacts) => {
                        return prevContacts.map(contact => {
                            if (contact.id === newMessage.receiver_id) {
                                return {
                                    ...contact,
                                    lastMessage: newMessage.message,
                                    lastMessageTime: new Date(newMessage.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                                };
                            }
                            return contact;
                        });
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [session?.user?.id]); // Dependência selectedContact REMOVIDA para evitar recriação do canal

    const fetchContacts = async () => {
        try {
            setLoading(true);

            // 1. Buscar contatos de volunteers (com telefone)
            const { data: volunteersData, error: volError } = await supabase
                .from('volunteers')
                .select('user_id, name, phone, email')
                .not('phone', 'is', null);

            if (volError) throw volError;

            // 2. Buscar contatos de profiles (admins/leaders com telefone)
            const { data: profilesData, error: profError } = await supabase
                .from('profiles')
                .select('id, name, phone, role')
                .not('phone', 'is', null);

            if (profError) throw profError;

            // 3. Buscar todas as mensagens do usuário atual
            const { data: messagesData, error: messagesError } = await supabase
                .from('chat_messages')
                .select('*')
                .or(`sender_id.eq.${session?.user?.id},receiver_id.eq.${session?.user?.id}`)
                .order('created_at', { ascending: false });

            if (messagesError) throw messagesError;

            // 4. Combinar contatos (volunteers + profiles, evitando duplicatas)
            const contactsMap = new Map();

            // Adicionar volunteers
            volunteersData?.forEach(vol => {
                if (vol.phone && vol.phone.trim() && vol.user_id !== session?.user?.id) {
                    contactsMap.set(vol.user_id, {
                        id: vol.user_id,
                        name: vol.name || 'Sem nome',
                        phone: vol.phone,
                        role: 'Voluntário',
                        email: vol.email
                    });
                }
            });

            // Adicionar profiles (se não existir como volunteer)
            profilesData?.forEach(prof => {
                if (prof.phone && prof.phone.trim() && prof.id !== session?.user?.id && !contactsMap.has(prof.id)) {
                    contactsMap.set(prof.id, {
                        id: prof.id,
                        name: prof.name || 'Sem nome',
                        phone: prof.phone,
                        role: prof.role === 'admin' ? 'Admin' : prof.role === 'leader' ? 'Líder' : 'Voluntário',
                        email: null
                    });
                }
            });

            const allMessages = messagesData || [];

            // 5. Formatar contatos com informações de mensagens
            const formattedContacts: Contact[] = Array.from(contactsMap.values()).map((contact: any) => {
                const userMessages = allMessages.filter(m =>
                    m.sender_id === contact.id || m.receiver_id === contact.id
                );

                const lastMsg = userMessages[0];

                const unreadCount = userMessages.filter(m =>
                    m.sender_id === contact.id &&
                    m.receiver_id === session?.user?.id &&
                    !m.read
                ).length;

                return {
                    id: contact.id,
                    name: contact.name,
                    phone: contact.phone,
                    role: contact.role,
                    department: '',
                    lastMessage: lastMsg ? lastMsg.message : undefined,
                    lastMessageTime: lastMsg ? new Date(lastMsg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : undefined,
                    lastMessageDate: lastMsg ? new Date(lastMsg.created_at) : undefined,
                    unreadCount: unreadCount
                };
            });

            // 6. Ordenar por data da última mensagem
            const sortedContacts = formattedContacts.sort((a: any, b: any) => {
                if (a.lastMessageDate && b.lastMessageDate) {
                    return b.lastMessageDate.getTime() - a.lastMessageDate.getTime();
                }
                if (a.lastMessageDate) return -1;
                if (b.lastMessageDate) return 1;
                return a.name.localeCompare(b.name);
            });

            setContacts(sortedContacts);
        } catch (error) {
            console.error('Erro ao buscar contatos:', getErrorMessage(error));
        } finally {
            setLoading(false);
        }
    };

    const fetchMessages = async (contactId: string) => {
        if (!session?.user?.id) return;

        const { data, error } = await supabase
            .from('chat_messages')
            .select('*')
            .or(`and(sender_id.eq.${session.user.id},receiver_id.eq.${contactId}),and(sender_id.eq.${contactId},receiver_id.eq.${session.user.id})`)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Erro ao carregar mensagens:', error);
        } else {
            setMessages(data || []);
        }
    };

    const markMessagesAsRead = async (contactId: string) => {
        try {
            await supabase
                .from('chat_messages')
                .update({ read: true })
                .eq('receiver_id', session?.user?.id)
                .eq('sender_id', contactId)
                .eq('read', false);
        } catch (error) {
            console.error('Erro ao marcar mensagens como lidas:', getErrorMessage(error));
        }
    };

    const sendMessage = async () => {
        if (!newMessage.trim() || !selectedContact || !session) return;

        try {
            setSending(true);

            // 1. Salvar mensagem no banco de dados
            const { error: dbError } = await supabase
                .from('chat_messages')
                .insert({
                    sender_id: session.user.id,
                    receiver_id: selectedContact.id,
                    message: newMessage.trim(),
                });

            if (dbError) throw dbError;

            // 2. Enviar via WhatsApp se o contato tiver telefone
            if (selectedContact.phone && selectedContact.phone !== 'Sem telefone') {
                try {
                    // Forçar o uso do JID para evitar que a API remova o 9º dígito
                    const cleanNumber = selectedContact.phone.replace(/\D/g, '');
                    const whatsappJid = `${cleanNumber}@s.whatsapp.net`;

                    // Não aguardamos a resposta para não travar a UI (fire and forget visualmente, mas logamos erro)
                    supabase.functions.invoke('send-whatsapp', {
                        body: {
                            number: whatsappJid,
                            message: `📱 *Mensagem do Dashboard*\n\n${newMessage.trim()}\n\n_Enviado por: ${session.user.user_metadata?.name || 'Admin'}_`
                        }
                    }).then(({ data, error }) => {
                        if (error) console.error('Erro ao enviar WhatsApp:', error);
                        else if (!data?.success) console.warn('WhatsApp não enviado:', data?.error);
                    });
                } catch (whatsappErr: any) {
                    console.error('Exceção ao enviar WhatsApp:', whatsappErr);
                }
            }

            setNewMessage('');
            // fetchMessages(selectedContact.id); // Removido para evitar duplicação com Realtime
        } catch (error) {
            console.error('Erro ao enviar mensagem:', getErrorMessage(error));
        } finally {
            setSending(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const toggleFavorite = (contactId: string) => {
        setFavorites(prev => {
            const newFavorites = new Set(prev);
            if (newFavorites.has(contactId)) {
                newFavorites.delete(contactId);
            } else {
                newFavorites.add(contactId);
            }
            return newFavorites;
        });
    };

    const toggleMember = (contactId: string) => {
        setSelectedMembers(prev => {
            const newMembers = new Set(prev);
            if (newMembers.has(contactId)) {
                newMembers.delete(contactId);
            } else {
                newMembers.add(contactId);
            }
            return newMembers;
        });
    };

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setToast({ show: true, message, type });
        setTimeout(() => {
            setToast({ show: false, message: '', type: 'info' });
        }, 4000);
    };

    const createGroup = async () => {
        if (groupName.trim() && selectedMembers.size > 0) {
            setCreatingGroup(true);
            showToast('Criando grupo no WhatsApp...', 'info');

            try {
                // Preparar membros com ID e telefone
                const membersData = contacts
                    .filter(c => selectedMembers.has(c.id))
                    .map(c => ({
                        userId: c.id,
                        phone: c.phone
                    }));

                // Chamar Edge Function para criar grupo no WhatsApp
                const { data, error } = await supabase.functions.invoke('create-whatsapp-group', {
                    body: {
                        groupName: groupName.trim(),
                        members: membersData
                    }
                });

                if (error) {
                    console.error('Erro ao criar grupo no WhatsApp:', error);
                    showToast('Erro ao criar grupo no WhatsApp: ' + error.message, 'error');
                    setCreatingGroup(false);
                    return;
                }

                if (!data.success) {
                    console.error('Erro ao criar grupo:', data.error);
                    showToast('Erro ao criar grupo: ' + data.error, 'error');
                    setCreatingGroup(false);
                    return;
                }

                // Criar grupo localmente
                const newGroup = {
                    id: data.groupId || Date.now().toString(),
                    name: groupName.trim(),
                    members: Array.from(selectedMembers),
                    whatsappGroupId: data.groupId
                };

                setGroups(prev => [...prev, newGroup]);
                setShowGroupModal(false);
                setGroupName('');
                setSelectedMembers(new Set());
                setCreatingGroup(false);

                showToast('Grupo criado com sucesso!', 'success');

                // Mudar para a aba de grupos e selecionar o grupo criado
                setFilterTab('grupos');

                // Recarregar grupos do banco
                fetchGroups();
            } catch (error) {
                console.error('Erro ao criar grupo:', error);
                showToast('Erro ao criar grupo: ' + (error as Error).message, 'error');
                setCreatingGroup(false);
            }
        }
    };

    const fetchGroups = async () => {
        try {
            const { data, error } = await supabase
                .from('whatsapp_groups')
                .select(`
                    id,
                    name,
                    whatsapp_group_id,
                    whatsapp_group_members (
                        phone
                    )
                `);

            if (error) throw error;

            if (data) {
                const formattedGroups = data.map(g => ({
                    id: g.id,
                    name: g.name,
                    whatsappGroupId: g.whatsapp_group_id,
                    members: g.whatsapp_group_members.map((m: any) => m.phone)
                }));
                setGroups(formattedGroups);
            }
        } catch (error) {
            console.error('Erro ao buscar grupos:', error);
        }
    };

    useEffect(() => {
        if (session) {
            fetchGroups();
        }
    }, [session]);

    const deleteGroup = async (groupId: string) => {
        if (confirm('Tem certeza que deseja deletar este grupo?')) {
            try {
                const { error } = await supabase
                    .from('whatsapp_groups')
                    .delete()
                    .eq('id', groupId);

                if (error) throw error;

                setGroups(prev => prev.filter(g => g.id !== groupId));
                showToast('Grupo deletado com sucesso', 'success');
            } catch (error) {
                console.error('Erro ao deletar grupo:', error);
            }
        }
    };

    return (
        <div className="-m-4 sm:-m-6 lg:-m-8 h-screen bg-white relative">
            <style>{`
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                
                /* Glass Scrollbar */
                .scrollbar-glass::-webkit-scrollbar {
                    width: 8px;
                }
                .scrollbar-glass::-webkit-scrollbar-track {
                    background: rgba(148, 163, 184, 0.1);
                    border-radius: 10px;
                }
                .scrollbar-glass::-webkit-scrollbar-thumb {
                    background: rgba(59, 130, 246, 0.3);
                    border-radius: 10px;
                    backdrop-filter: blur(10px);
                }
                .scrollbar-glass::-webkit-scrollbar-thumb:hover {
                    background: rgba(59, 130, 246, 0.5);
                }
                
                /* Toast Animation */
                @keyframes slideUp {
                    from {
                        transform: translateY(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
                .animate-slide-up {
                    animation: slideUp 0.3s ease-out;
                }
            `}</style>

            {/* Overlay de bloqueio quando WhatsApp está desativado */}
            {!whatsappEnabled && (
                <div className="absolute inset-0 z-50 flex items-center justify-center backdrop-blur-lg bg-slate-900/20">
                    <div className="bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl p-12 max-w-md mx-4 border border-slate-200/50 transform transition-all animate-slide-up">
                        <div className="flex flex-col items-center text-center">
                            {/* Ícone de WhatsApp bloqueado */}
                            <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mb-6 shadow-xl relative">
                                <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                </svg>
                                {/* Ícone de bloqueio */}
                                <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-red-500 rounded-full flex items-center justify-center shadow-lg border-4 border-white">
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </div>
                            </div>

                            {/* Título */}
                            <h3 className="text-3xl font-bold text-slate-800 mb-3">
                                Chat Desativado
                            </h3>

                            {/* Mensagem */}
                            <p className="text-slate-600 mb-6 leading-relaxed text-base">
                                A integração do WhatsApp foi desativada pelo administrador.
                                Entre em contato com a administração para mais informações.
                            </p>

                            {/* Ícone de alerta */}
                            <div className="flex items-center gap-3 px-5 py-4 bg-yellow-50 border-2 border-yellow-200 rounded-2xl w-full">
                                <svg className="w-6 h-6 text-yellow-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <span className="text-sm font-semibold text-yellow-800">
                                    Funcionalidade temporariamente indisponível
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex h-full">
                {/* Sidebar - Lista de Contatos */}
                <div className="w-96 border-r border-slate-200 flex flex-col bg-white">
                    {/* Header */}
                    <div className="p-4 border-b border-slate-200">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-2xl font-bold text-slate-800">Chat</h2>
                            <button
                                onClick={() => setShowGroupModal(true)}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                </svg>
                            </button>
                        </div>

                        {/* Search Bar */}
                        <div className="relative mb-4">
                            <input
                                type="text"
                                placeholder="Pesquisar ou começar uma nova conversa"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <svg className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>

                        {/* Filter Tabs */}
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                            <button
                                onClick={() => setFilterTab('tudo')}
                                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filterTab === 'tudo'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                            >
                                Tudo
                            </button>
                            <button
                                onClick={() => setFilterTab('nao_lidas')}
                                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filterTab === 'nao_lidas'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                            >
                                Não lidas
                            </button>
                            <button
                                onClick={() => setFilterTab('favoritas')}
                                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filterTab === 'favoritas'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                            >
                                Favoritas
                            </button>
                            <button
                                onClick={() => setFilterTab('grupos')}
                                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filterTab === 'grupos'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                            >
                                Grupos
                            </button>
                        </div>
                    </div>

                    {/* Lista de Contatos */}
                    <div className="flex-1 overflow-y-auto scrollbar-glass">
                        {loading ? (
                            <div className="flex items-center justify-center h-32">
                                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : (() => {
                            // Aplicar filtros
                            let filteredContacts = contacts;

                            // Filtro por busca
                            if (searchQuery.trim()) {
                                filteredContacts = filteredContacts.filter(c =>
                                    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    c.phone.includes(searchQuery)
                                );
                            }

                            // Filtro por aba
                            if (filterTab === 'nao_lidas') {
                                filteredContacts = filteredContacts.filter(c => c.unreadCount && c.unreadCount > 0);
                            } else if (filterTab === 'favoritas') {
                                filteredContacts = filteredContacts.filter(c => favorites.has(c.id));
                            } else if (filterTab === 'grupos') {
                                // Mostrar grupos criados
                                return groups.length > 0 ? (
                                    groups.map((group) => (
                                        <div
                                            key={group.id}
                                            className="w-full p-3 flex items-start gap-3 hover:bg-slate-50 transition-colors relative group"
                                        >
                                            <button
                                                onClick={() => {
                                                    setSelectedGroup(group);
                                                    setSelectedContact(null);
                                                }}
                                                className={`flex items-start gap-3 flex-1 min-w-0 ${selectedGroup?.id === group.id ? 'bg-slate-100 rounded-lg -m-2 p-2' : ''}`}
                                            >
                                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-semibold flex-shrink-0 mt-1">
                                                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                                        <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                                                    </svg>
                                                </div>
                                                <div className="flex-1 text-left min-w-0 py-1">
                                                    <div className="flex items-start justify-between mb-1">
                                                        <h3 className="font-semibold text-slate-800 truncate text-[15px] pr-2">{group.name}</h3>
                                                    </div>
                                                    <p className="text-sm text-slate-500 truncate">
                                                        {group.members.length} {group.members.length === 1 ? 'membro' : 'membros'}
                                                    </p>
                                                </div>
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteGroup(group.id);
                                                }}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-red-100 opacity-0 group-hover:opacity-100 transition-opacity"
                                                title="Deletar grupo"
                                            >
                                                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
                                        <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                        <p className="font-medium">Nenhum grupo criado</p>
                                        <p className="text-sm mt-1">Clique no + para criar seu primeiro grupo</p>
                                    </div>
                                );
                            }

                            return filteredContacts.length > 0 ? (
                                filteredContacts.map((contact) => (
                                    <div
                                        key={contact.id}
                                        className={`w-full p-3 flex items-start gap-3 hover:bg-slate-50 transition-colors relative group ${selectedContact?.id === contact.id ? 'bg-slate-100' : ''
                                            }`}
                                    >
                                        <button
                                            onClick={() => setSelectedContact(contact)}
                                            className="flex items-start gap-3 flex-1 min-w-0 pr-8"
                                        >
                                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold flex-shrink-0 mt-1">
                                                {contact.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-1 text-left min-w-0 py-1">
                                                <div className="flex items-start justify-between mb-1">
                                                    <h3 className="font-semibold text-slate-800 truncate text-[15px] pr-2">{contact.name}</h3>
                                                    {contact.lastMessageTime && (
                                                        <span className="text-xs text-slate-500 flex-shrink-0">{contact.lastMessageTime}</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <p className="text-sm text-slate-500 truncate flex-1">
                                                        {contact.lastMessage || contact.role}
                                                    </p>
                                                    {contact.unreadCount && contact.unreadCount > 0 && (
                                                        <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold ml-2 flex-shrink-0">
                                                            {contact.unreadCount}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleFavorite(contact.id);
                                            }}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-slate-200 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <svg
                                                className={`w-4 h-4 ${favorites.has(contact.id) ? 'fill-yellow-400 text-yellow-400' : 'text-slate-400'}`}
                                                fill={favorites.has(contact.id) ? 'currentColor' : 'none'}
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                            </svg>
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
                                    <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                    </svg>
                                    <p className="font-medium">
                                        {filterTab === 'nao_lidas' ? 'Nenhuma mensagem não lida' :
                                            filterTab === 'grupos' ? 'Grupos em breve' :
                                                filterTab === 'favoritas' ? 'Nenhuma conversa favorita' :
                                                    searchQuery ? 'Nenhum resultado encontrado' : 'Nenhuma conversa'}
                                    </p>
                                    <p className="text-sm mt-1">
                                        {filterTab === 'nao_lidas' ? 'Todas as conversas estão em dia!' :
                                            filterTab === 'grupos' ? 'Funcionalidade em desenvolvimento' :
                                                filterTab === 'favoritas' ? 'Marque conversas como favoritas' :
                                                    searchQuery ? 'Tente outro termo de busca' : 'Selecione um contato para começar'}
                                    </p>
                                </div>
                            );
                        })()}
                    </div>
                </div>

                {/* Área de Chat */}
                <div className="flex-1 flex flex-col">
                    {selectedContact ? (
                        <>
                            {/* Header do Chat */}
                            <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold">
                                        {selectedContact.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-800">{selectedContact.name}</h3>
                                        <p className="text-sm text-slate-500">{selectedContact.phone}</p>
                                    </div>
                                </div>
                                <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                                    <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                    </svg>
                                </button>
                            </div>

                            {/* Mensagens */}
                            <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
                                {messages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                        <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                        </svg>
                                        <p className="font-medium">Nenhuma mensagem ainda</p>
                                        <p className="text-sm mt-1">Envie uma mensagem para começar a conversa</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {messages.map((msg) => {
                                            const isSent = msg.sender_id === session?.user?.id;
                                            return (
                                                <div
                                                    key={msg.id}
                                                    className={`flex ${isSent ? 'justify-end' : 'justify-start'}`}
                                                >
                                                    <div
                                                        className={`max-w-[70%] rounded-2xl px-4 py-2 ${isSent
                                                            ? 'bg-blue-600 text-white'
                                                            : 'bg-white text-slate-800 border border-slate-200'
                                                            }`}
                                                    >
                                                        <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                                                        <p className={`text-xs mt-1 ${isSent ? 'text-blue-100' : 'text-slate-400'}`}>
                                                            {new Date(msg.created_at).toLocaleTimeString('pt-BR', {
                                                                hour: '2-digit',
                                                                minute: '2-digit',
                                                            })}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <div ref={messagesEndRef} />
                                    </div>
                                )}
                            </div>

                            {/* Input de Mensagem */}
                            <div className="p-4 border-t border-slate-200 bg-white">
                                {!whatsappEnabled ? (
                                    <div className="flex items-center justify-center gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                                        <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        <span className="text-sm font-medium text-yellow-800">
                                            Integração do WhatsApp desativada pelo administrador
                                        </span>
                                    </div>
                                ) : (
                                    <div className="flex items-end gap-2">
                                        <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0">
                                            <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                            </svg>
                                        </button>
                                        <textarea
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            onKeyPress={handleKeyPress}
                                            placeholder="Enviar mensagem..."
                                            className="flex-1 resize-none border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent max-h-32"
                                            rows={1}
                                        />
                                        <button
                                            onClick={sendMessage}
                                            disabled={!newMessage.trim() || sending}
                                            className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                                        >
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                            </svg>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : selectedGroup ? (
                        <>
                            {/* Header do Grupo */}
                            <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-semibold">
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-800">{selectedGroup.name}</h3>
                                        <p className="text-sm text-slate-500">{selectedGroup.members.length} membros</p>
                                    </div>
                                </div>
                            </div>

                            {/* Mensagens do Grupo */}
                            <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
                                {groupMessages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                        <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                        <p className="font-medium">Nenhuma mensagem no grupo</p>
                                        <p className="text-sm mt-1">Envie a primeira mensagem!</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {groupMessages.map((msg) => {
                                            const isSent = msg.sender_id === session?.user?.id;
                                            return (
                                                <div
                                                    key={msg.id}
                                                    className={`flex ${isSent ? 'justify-end' : 'justify-start'}`}
                                                >
                                                    <div
                                                        className={`max-w-[70%] rounded-2xl px-4 py-2 ${isSent
                                                            ? 'bg-green-600 text-white'
                                                            : 'bg-white text-slate-800 border border-slate-200'
                                                            }`}
                                                    >
                                                        {!isSent && (
                                                            <p className="text-xs font-bold text-orange-500 mb-1">
                                                                {msg.sender?.email?.split('@')[0] || msg.sender_name || msg.sender_phone || 'Membro'}
                                                            </p>
                                                        )}
                                                        <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                                                        <p className={`text-xs mt-1 ${isSent ? 'text-green-100' : 'text-slate-400'}`}>
                                                            {new Date(msg.created_at).toLocaleTimeString('pt-BR', {
                                                                hour: '2-digit',
                                                                minute: '2-digit',
                                                            })}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <div ref={messagesEndRef} />
                                    </div>
                                )}
                            </div>

                            {/* Input de Mensagem do Grupo */}
                            <div className="p-4 border-t border-slate-200 bg-white">
                                {!whatsappEnabled ? (
                                    <div className="flex items-center justify-center gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                                        <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        <span className="text-sm font-medium text-yellow-800">
                                            Integração do WhatsApp desativada pelo administrador
                                        </span>
                                    </div>
                                ) : (
                                    <div className="flex items-end gap-2">
                                        <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0">
                                            <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                            </svg>
                                        </button>
                                        <textarea
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendGroupMessage()}
                                            placeholder="Enviar mensagem para o grupo..."
                                            className="flex-1 resize-none border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent max-h-32"
                                            rows={1}
                                        />
                                        <button
                                            onClick={handleSendGroupMessage}
                                            disabled={!newMessage.trim() || sending}
                                            className="p-3 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                                        >
                                            {sending ? (
                                                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-slate-50">
                            <svg className="w-24 h-24 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            <p className="text-lg font-medium">Olá! Bem-vindo ao Chat Volunteers.</p>
                            <p className="text-sm mt-2">Selecione um contato para começar a conversar</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal de Criar Grupo */}
            {showGroupModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowGroupModal(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
                        {/* Header */}
                        <div className="p-6 border-b border-slate-200">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-bold text-slate-800">Criar Grupo</h3>
                                <button
                                    onClick={() => setShowGroupModal(false)}
                                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-6 max-h-96 overflow-y-auto scrollbar-glass">
                            {/* Nome do Grupo */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Nome do Grupo
                                </label>
                                <input
                                    type="text"
                                    value={groupName}
                                    onChange={(e) => setGroupName(e.target.value)}
                                    placeholder="Ex: Equipe de Louvor"
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {/* Seleção de Membros */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Adicionar Membros ({selectedMembers.size})
                                </label>
                                <div className="space-y-2">
                                    {contacts.map((contact) => (
                                        <button
                                            key={contact.id}
                                            onClick={() => toggleMember(contact.id)}
                                            className={`w-full p-3 flex items-center gap-3 rounded-lg transition-colors ${selectedMembers.has(contact.id)
                                                ? 'bg-blue-50 border-2 border-blue-500'
                                                : 'bg-slate-50 border-2 border-transparent hover:bg-slate-100'
                                                }`}
                                        >
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                                                {contact.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-1 text-left">
                                                <h4 className="font-semibold text-slate-800 text-sm">{contact.name}</h4>
                                                <p className="text-xs text-slate-500">{contact.role}</p>
                                            </div>
                                            {selectedMembers.has(contact.id) && (
                                                <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-slate-200 flex gap-3">
                            <button
                                onClick={() => setShowGroupModal(false)}
                                className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={createGroup}
                                disabled={!groupName.trim() || selectedMembers.size === 0 || creatingGroup}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {creatingGroup && (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                )}
                                {creatingGroup ? 'Criando...' : 'Criar Grupo'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast Notification */}
            {toast.show && (
                <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
                    <div className={`px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 ${toast.type === 'success' ? 'bg-green-600' :
                        toast.type === 'error' ? 'bg-red-600' :
                            'bg-blue-600'
                        }`}>
                        {toast.type === 'success' && (
                            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                        )}
                        {toast.type === 'error' && (
                            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                        )}
                        {toast.type === 'info' && (
                            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                        )}
                        <p className="text-white font-medium">{toast.message}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatPage;
