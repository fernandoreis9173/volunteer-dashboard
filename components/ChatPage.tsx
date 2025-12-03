import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Session } from '@supabase/supabase-js';
import { getErrorMessage } from '../lib/utils';

interface ChatPageProps {
    session: Session | null;
    userRole: string;
    departmentId?: number | null;
}

interface Contact {
    id: string;
    name: string;
    phone: string;
    role: string;
    department?: string;
    department_ids?: number[]; // IDs dos departamentos
    lastMessage?: string;
    lastMessageTime?: string;
    unreadCount?: number;
    avatar_url?: string | null;
}

interface Message {
    id: number;
    sender_id: string;
    receiver_id: string;
    message: string;
    created_at: string;
    read: boolean;
}

const ChatPage: React.FC<ChatPageProps> = ({ session, userRole, departmentId }) => {
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
    const [groups, setGroups] = useState<Array<{ id: string, name: string, members: string[], whatsappGroupId?: string, avatar_url?: string | null, unreadCount?: number, lastMessageTime?: Date | null }>>([]);
    const [creatingGroup, setCreatingGroup] = useState(false);
    const [includeMe, setIncludeMe] = useState(true); // Estado para incluir o próprio usuário
    const [memberSearchQuery, setMemberSearchQuery] = useState(''); // Estado para busca de membros
    const [toast, setToast] = useState<{ show: boolean, message: string, type: 'success' | 'error' | 'info' }>({
        show: false,
        message: '',
        type: 'info'
    });
    const [selectedGroup, setSelectedGroup] = useState<{ id: string, name: string, members: string[], whatsappGroupId?: string, avatar_url?: string | null, unreadCount?: number, lastMessageTime?: Date | null } | null>(null);
    const [groupMessages, setGroupMessages] = useState<any[]>([]);
    const [whatsappEnabled, setWhatsappEnabled] = useState(true);

    // Estados para detalhes do grupo
    const [showGroupDetailsModal, setShowGroupDetailsModal] = useState(false);
    const [groupDetailsMembers, setGroupDetailsMembers] = useState<Contact[]>([]);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    // Estado para o modal de confirmação de exclusão
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [groupToDelete, setGroupToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
    const [showChatMenu, setShowChatMenu] = useState(false);
    const [showClearChatModal, setShowClearChatModal] = useState(false);
    const [activeSession, setActiveSession] = useState<{ id: string, leader_id: string, leader_name?: string } | null>(null);

    useEffect(() => {
        if (selectedContact) {
            checkActiveSession(selectedContact.id);
        } else {
            setActiveSession(null);
        }
    }, [selectedContact]);

    const checkActiveSession = async (volunteerId: string) => {
        console.log('Verificando sessão para:', volunteerId);
        const { data, error } = await supabase
            .from('chat_sessions')
            .select('id, leader_id')
            .eq('volunteer_id', volunteerId)
            .eq('status', 'active')
            .maybeSingle();

        if (error) {
            console.error('Erro ao verificar sessão:', error);
        } else {
            console.log('Sessão encontrada:', data);
        }

        if (data) {
            const leaderContact = contacts.find(c => c.id === data.leader_id);
            const leaderName = leaderContact?.name || 'Outro Líder';
            setActiveSession({ id: data.id, leader_id: data.leader_id, leader_name: leaderName });
        } else {
            setActiveSession(null);
        }
    };

    const handleCloseSession = async () => {
        if (!activeSession) return;

        const { error } = await supabase
            .from('chat_sessions')
            .update({ status: 'closed', closed_at: new Date().toISOString() })
            .eq('id', activeSession.id);

        if (!error) {
            setActiveSession(null);
            showToast('Atendimento encerrado', 'success');
        } else {
            console.error('Erro ao encerrar sessão:', error);
            showToast('Erro ao encerrar atendimento', 'error');
        }
    };

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const tabsContainerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll para a aba ativa
    useEffect(() => {
        if (filterTab === 'grupos' && tabsContainerRef.current) {
            const gruposTab = document.getElementById('tab-grupos');
            if (gruposTab) {
                // Scroll suave para mostrar a aba de grupos
                tabsContainerRef.current.scrollTo({
                    left: gruposTab.offsetLeft - 20, // Um pouco de margem
                    behavior: 'smooth'
                });
            }
        } else if (tabsContainerRef.current) {
            // Voltar para o início se não for grupos (simplificação)
            tabsContainerRef.current.scrollTo({
                left: 0,
                behavior: 'smooth'
            });
        }
    }, [filterTab]);

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

    const selectedGroupRef = useRef(selectedGroup);
    useEffect(() => {
        selectedGroupRef.current = selectedGroup;
    }, [selectedGroup]);

    // Realtime para Grupos
    useEffect(() => {
        if (!session?.user?.id) return;

        const channel = supabase
            .channel('group_chat_realtime')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'whatsapp_group_messages'
                },
                (payload) => {
                    const newMessage = payload.new;
                    const currentSelectedGroup = selectedGroupRef.current;

                    // Se o grupo da mensagem for o selecionado, atualizar mensagens
                    if (currentSelectedGroup?.id === newMessage.group_id) {
                        setGroupMessages((prev) => {
                            if (prev.some(m => m.id === newMessage.id)) return prev;
                            return [...prev, newMessage];
                        });
                        // Marcar como lido imediatamente
                        // markGroupAsRead(newMessage.group_id); // Comentado pois pode causar loop ou race condition, melhor deixar o usuário clicar ou focar
                    }

                    // Sempre atualizar a lista de grupos (contador e última mensagem)
                    // Se estiver selecionado, o contador será zerado pelo markGroupAsRead no click/focus, 
                    // mas aqui incrementamos para garantir consistência visual se o usuário sair e voltar
                    setGroups(prev => prev.map(g => {
                        if (g.id === newMessage.group_id) {
                            const isSelected = currentSelectedGroup?.id === newMessage.group_id;
                            return {
                                ...g,
                                unreadCount: isSelected ? 0 : (g.unreadCount || 0) + 1,
                                lastMessageTime: new Date(newMessage.created_at)
                            };
                        }
                        return g;
                    }));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [session?.user?.id]);

    const fetchContacts = async () => {
        try {
            setLoading(true);

            // 1. Buscar contatos via RPC (já traz avatares e unifica volunteers/profiles)
            const { data: contactsData, error: contactsError } = await supabase
                .rpc('get_contacts_with_departments', { current_user_id: session?.user?.id });

            if (contactsError) throw contactsError;



            // 2. Buscar avatar do usuário atual separadamente
            if (session?.user?.id) {
                const { data: userData } = await supabase
                    .from('profiles')
                    .select('avatar_url')
                    .eq('id', session.user.id)
                    .single();

                if (userData?.avatar_url) {
                    setCurrentUserAvatar(userData.avatar_url);
                }
            }

            // 3. Buscar todas as mensagens do usuário atual
            const { data: messagesData, error: messagesError } = await supabase
                .from('chat_messages')
                .select('*')
                .or(`sender_id.eq.${session?.user?.id},receiver_id.eq.${session?.user?.id}`)
                .order('created_at', { ascending: false });

            if (messagesError) throw messagesError;

            // 4. Preparar mapa de contatos
            const contactsMap = new Map();

            contactsData?.forEach((contact: any) => {
                contactsMap.set(contact.id, {
                    id: contact.id,
                    name: contact.name || 'Sem nome',
                    phone: contact.phone,
                    role: contact.role,
                    email: contact.email,
                    avatar_url: contact.avatar_url,
                    department_ids: contact.department_ids || [] // IMPORTANTE: preservar department_ids
                });
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
                    department_ids: contact.department_ids || [], // IMPORTANTE: preservar department_ids
                    lastMessage: lastMsg ? lastMsg.message : undefined,
                    lastMessageTime: lastMsg ? new Date(lastMsg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : undefined,
                    lastMessageDate: lastMsg ? new Date(lastMsg.created_at) : undefined,
                    unreadCount: unreadCount,
                    avatar_url: contact.avatar_url
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

    const handleClearChat = async () => {
        if (!selectedContact || !session?.user?.id) return;

        try {
            const { error } = await supabase
                .from('chat_messages')
                .delete()
                .or(`and(sender_id.eq.${session.user.id},receiver_id.eq.${selectedContact.id}),and(sender_id.eq.${selectedContact.id},receiver_id.eq.${session.user.id})`);

            if (error) throw error;

            setMessages([]);
            setShowClearChatModal(false);
            setShowChatMenu(false);
            fetchContacts(); // Atualizar lista para remover última mensagem
            showToast('Conversa limpa com sucesso', 'success');
        } catch (error) {
            console.error('Erro ao limpar conversa:', error);
            showToast('Erro ao limpar conversa', 'error');
        }
    };

    const handleClearGroupChat = async () => {
        if (!selectedGroup) return;

        try {
            const { error } = await supabase
                .from('whatsapp_group_messages')
                .delete()
                .eq('group_id', selectedGroup.id);

            if (error) throw error;

            setGroupMessages([]);
            setShowClearChatModal(false);
            setShowChatMenu(false);
            showToast('Conversa do grupo limpa com sucesso', 'success');
        } catch (error) {
            console.error('Erro ao limpar conversa do grupo:', error);
            showToast('Erro ao limpar conversa do grupo', 'error');
        }
    };

    const sendMessage = async () => {
        if (!newMessage.trim() || !selectedContact || !session) return;

        try {
            setSending(true);

            // Verificar/Criar sessão ativa
            if (!activeSession) {
                const { data: sessionData, error: sessionError } = await supabase
                    .from('chat_sessions')
                    .insert({
                        volunteer_id: selectedContact.id,
                        leader_id: session.user.id,
                        status: 'active'
                    })
                    .select()
                    .single();

                if (sessionData) {
                    setActiveSession({ id: sessionData.id, leader_id: session.user.id });
                } else if (sessionError) {
                    // Se erro for duplicidade (já existe ativa), buscar quem é
                    const { data: existingSession } = await supabase
                        .from('chat_sessions')
                        .select('id, leader_id')
                        .eq('volunteer_id', selectedContact.id)
                        .eq('status', 'active')
                        .maybeSingle();

                    if (existingSession) {
                        const leaderContact = contacts.find(c => c.id === existingSession.leader_id);
                        const leaderName = leaderContact?.name || 'Outro Líder';
                        setActiveSession({ id: existingSession.id, leader_id: existingSession.leader_id, leader_name: leaderName });

                        if (existingSession.leader_id !== session.user.id) {
                            showToast('Este voluntário está em atendimento', 'error');
                            setSending(false);
                            return; // Bloquear envio
                        }
                    }
                }
            } else if (activeSession.leader_id !== session.user.id) {
                showToast('Este voluntário está em atendimento', 'error');
                setSending(false);
                return;
            }

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

    const closeGroupModal = () => {
        setShowGroupModal(false);
        setGroupName('');
        setSelectedMembers(new Set());
        setMemberSearchQuery('');
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
                let membersData = contacts
                    .filter(c => selectedMembers.has(c.id))
                    .map(c => ({
                        userId: c.id,
                        phone: c.phone
                    }));

                // Se includeMe estiver marcado, adicionar o próprio usuário
                if (includeMe && session?.user?.id) {
                    // Buscar telefone do usuário atual
                    const { data: currentUserData } = await supabase
                        .from('profiles')
                        .select('phone')
                        .eq('id', session.user.id)
                        .single();

                    if (currentUserData?.phone) {
                        membersData = [
                            {
                                userId: session.user.id,
                                phone: currentUserData.phone
                            },
                            ...membersData
                        ];
                    }
                }

                console.log('Membros enviados para criação do grupo:', membersData);

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
                closeGroupModal();
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
                .rpc('get_groups_with_unread_count', { current_user_id: session?.user?.id });

            if (error) throw error;

            console.log('Grupos carregados:', data);

            if (data) {
                const formattedGroups = data.map((g: any) => ({
                    id: g.id,
                    name: g.name,
                    whatsappGroupId: g.whatsapp_group_id,
                    avatar_url: g.avatar_url,
                    members: g.members.map((m: any) => m.phone),
                    unreadCount: g.unread_count,
                    lastMessageTime: g.last_message_time ? new Date(g.last_message_time) : null
                }));
                setGroups(formattedGroups);
            }
        } catch (error) {
            console.error('Erro ao buscar grupos:', error);
        }
    };

    const markGroupAsRead = async (groupId: string) => {
        if (!session?.user?.id) return;
        try {
            const { error } = await supabase
                .from('whatsapp_group_reads')
                .upsert({
                    group_id: groupId,
                    user_id: session.user.id,
                    last_read_at: new Date().toISOString()
                }, { onConflict: 'group_id, user_id' });

            if (error) throw error;

            // Atualizar localmente
            setGroups(prev => prev.map(g => g.id === groupId ? { ...g, unreadCount: 0 } : g));
        } catch (error) {
            console.error('Erro ao marcar grupo como lido:', error);
        }
    };

    const fetchGroupMembersDetails = async (groupId: string) => {
        try {
            // Buscar membros do grupo (telefones)
            const { data: groupData, error: groupError } = await supabase
                .from('whatsapp_groups')
                .select(`
                    whatsapp_group_members (
                        phone
                    )
                `)
                .eq('id', groupId)
                .single();

            if (groupError) throw groupError;

            const memberPhones = groupData.whatsapp_group_members.map((m: any) => m.phone);

            // Buscar detalhes desses telefones na lista de contatos já carregada
            const membersDetails = contacts.filter(c => memberPhones.includes(c.phone));

            // Identificar telefones que não foram encontrados nos contatos
            const foundPhones = new Set(membersDetails.map(m => m.phone));
            const unknownPhones = memberPhones.filter((phone: string) => !foundPhones.has(phone));

            let additionalMembers: any[] = [];

            if (unknownPhones.length > 0) {
                // Tentar buscar esses telefones na tabela profiles
                const { data: profilesData } = await supabase
                    .from('profiles')
                    .select('id, name, phone, role, avatar_url')
                    .in('phone', unknownPhones);

                if (profilesData) {
                    additionalMembers = profilesData.map(p => ({
                        id: p.id,
                        name: p.name,
                        phone: p.phone,
                        role: p.role === 'leader' || p.role === 'lider' ? 'Líder' : p.role === 'admin' ? 'Admin' : 'Membro',
                        avatar_url: p.avatar_url
                    }));
                }

                // Adicionar ainda os que não foram encontrados nem no profiles (apenas telefone)
                const foundInProfiles = new Set(additionalMembers.map(m => m.phone));
                const stillUnknown = unknownPhones
                    .filter((phone: string) => !foundInProfiles.has(phone))
                    .map((phone: string) => ({
                        id: phone,
                        name: phone,
                        phone: phone,
                        role: 'Membro',
                        avatar_url: null
                    }));

                additionalMembers = [...additionalMembers, ...stillUnknown];
            }

            setGroupDetailsMembers([...membersDetails, ...additionalMembers]);
        } catch (error) {
            console.error('Erro ao buscar detalhes dos membros:', error);
        }
    };

    const handleGroupAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || event.target.files.length === 0 || !selectedGroup) {
            return;
        }

        try {
            setUploadingAvatar(true);
            const file = event.target.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${selectedGroup.id}-${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            // Upload
            const { error: uploadError } = await supabase.storage
                .from('group-avatars')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // Get URL
            const { data: { publicUrl } } = supabase.storage
                .from('group-avatars')
                .getPublicUrl(filePath);

            // Update group
            const { error: updateError } = await supabase
                .from('whatsapp_groups')
                .update({ avatar_url: publicUrl })
                .eq('id', selectedGroup.id);

            if (updateError) throw updateError;

            // Update local state
            setSelectedGroup(prev => prev ? { ...prev, avatar_url: publicUrl } : null);
            setGroups(prev => prev.map(g => g.id === selectedGroup.id ? { ...g, avatar_url: publicUrl } : g));

            showToast('Foto do grupo atualizada!', 'success');

            // Chamar Edge Function para atualizar no WhatsApp
            try {
                const { error: fnError } = await supabase.functions.invoke('update-whatsapp-group-icon', {
                    body: { groupId: selectedGroup.id, avatarUrl: publicUrl }
                });
                if (fnError) console.warn('Erro ao atualizar ícone no WhatsApp (Edge Function):', fnError);
            } catch (apiError) {
                console.error('Erro ao atualizar ícone no WhatsApp:', apiError);
            }

        } catch (error) {
            console.error('Erro ao atualizar foto do grupo:', error);
            showToast('Erro ao atualizar foto', 'error');
        } finally {
            setUploadingAvatar(false);
        }
    };

    useEffect(() => {
        if (session) {
            fetchGroups();
        }
    }, [session]);

    const handleDeleteClick = (groupId: string) => {
        setGroupToDelete(groupId);
        setShowDeleteModal(true);
    };

    const confirmDeleteGroup = async () => {
        if (!groupToDelete) return;

        setIsDeleting(true);
        try {
            const { error } = await supabase
                .from('whatsapp_groups')
                .delete()
                .eq('id', groupToDelete);

            if (error) throw error;

            setGroups(prev => prev.filter(g => g.id !== groupToDelete));

            // Se o grupo deletado for o selecionado, limpar seleção
            if (selectedGroup?.id === groupToDelete) {
                setSelectedGroup(null);
            }

            showToast('Grupo deletado com sucesso', 'success');
            setShowDeleteModal(false);
            setGroupToDelete(null);
        } catch (error) {
            console.error('Erro ao deletar grupo:', error);
            showToast('Erro ao deletar grupo', 'error');
        } finally {
            setIsDeleting(false);
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
                            {(userRole === 'admin' || ['leader', 'lider', 'líder'].includes(userRole?.toLowerCase())) && (
                                <button
                                    onClick={() => setShowGroupModal(true)}
                                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                                    title="Criar novo grupo"
                                >
                                    <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                    </svg>
                                </button>
                            )}
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
                        <div
                            ref={tabsContainerRef}
                            className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide scroll-smooth"
                        >
                            <button
                                onClick={() => setFilterTab('tudo')}
                                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${filterTab === 'tudo'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                            >
                                Tudo
                            </button>
                            <button
                                onClick={() => setFilterTab('nao_lidas')}
                                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${filterTab === 'nao_lidas'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                            >
                                Não lidas
                            </button>
                            <button
                                onClick={() => setFilterTab('favoritas')}
                                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${filterTab === 'favoritas'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                            >
                                Favoritas
                            </button>
                            <button
                                id="tab-grupos" // ID para referência
                                onClick={() => setFilterTab('grupos')}
                                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${filterTab === 'grupos'
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
                            let filteredGroups = groups;

                            // Filtro por busca
                            if (searchQuery.trim()) {
                                const query = searchQuery.toLowerCase();
                                filteredContacts = filteredContacts.filter(c =>
                                    c.name.toLowerCase().includes(query) ||
                                    c.phone.includes(searchQuery)
                                );
                                filteredGroups = filteredGroups.filter(g =>
                                    g.name.toLowerCase().includes(query)
                                );
                            }

                            // Filtro por aba
                            if (filterTab === 'nao_lidas') {
                                filteredContacts = filteredContacts.filter(c => c.unreadCount && c.unreadCount > 0);
                                filteredGroups = filteredGroups.filter(g => (g.unreadCount || 0) > 0);
                            } else if (filterTab === 'favoritas') {
                                filteredContacts = filteredContacts.filter(c => favorites.has(c.id));
                                filteredGroups = [];
                            } else if (filterTab === 'grupos') {
                                filteredContacts = [];
                            } else if (filterTab === 'tudo') {
                                // Mantém ambos
                            }

                            const hasItems = filteredGroups.length > 0 || filteredContacts.length > 0;

                            if (!hasItems) {
                                return (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
                                        <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                        <p className="font-medium">Nenhum contato ou grupo encontrado</p>
                                    </div>
                                );
                            }

                            return (
                                <>
                                    {filteredGroups.map((group) => (
                                        <div
                                            key={group.id}
                                            className="w-full p-3 flex items-center gap-1 hover:bg-slate-50 transition-colors group"
                                        >
                                            <button
                                                onClick={() => {
                                                    setSelectedGroup(group);
                                                    setSelectedContact(null);
                                                    fetchGroupMessages(group.id);
                                                    markGroupAsRead(group.id);
                                                }}
                                                className={`flex items-start gap-3 flex-1 min-w-0 text-left ${selectedGroup?.id === group.id ? 'bg-slate-100 rounded-lg -m-2 p-2' : ''}`}
                                            >
                                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-semibold flex-shrink-0 mt-1 overflow-hidden relative">
                                                    {group.avatar_url ? (
                                                        <img src={group.avatar_url} alt={group.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                                            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                                                        </svg>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0 py-1">
                                                    <div className="flex items-start justify-between mb-1">
                                                        <div className="flex items-center gap-1.5 min-w-0 pr-2">
                                                            <h3 className="font-semibold text-slate-800 truncate text-[15px]">{group.name}</h3>
                                                            <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                                                                Grupo
                                                            </span>
                                                        </div>
                                                        {group.lastMessageTime && (
                                                            <span className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">
                                                                {group.lastMessageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <p className="text-sm text-slate-500 truncate">
                                                            {group.members.length} {group.members.length === 1 ? 'membro' : 'membros'}
                                                        </p>
                                                        {group.unreadCount && group.unreadCount > 0 ? (
                                                            <span className="bg-green-500 text-white text-xs font-bold h-5 min-w-[20px] px-1.5 flex items-center justify-center rounded-full">
                                                                {group.unreadCount}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteClick(group.id);
                                                }}
                                                className="p-2 rounded-full hover:bg-red-100 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                                title="Deletar grupo"
                                            >
                                                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))}

                                    {filteredContacts.map((contact) => (
                                        <div
                                            key={contact.id}
                                            className={`w-full p-3 flex items-start gap-3 hover:bg-slate-50 transition-colors relative group ${selectedContact?.id === contact.id ? 'bg-slate-100' : ''
                                                }`}
                                        >
                                            <button
                                                onClick={() => {
                                                    setSelectedContact(contact);
                                                    if (contact.unreadCount && contact.unreadCount > 0) {
                                                        markMessagesAsRead(contact.id);
                                                        setContacts(prev => prev.map(c =>
                                                            c.id === contact.id ? { ...c, unreadCount: 0 } : c
                                                        ));
                                                    }
                                                }}
                                                className="flex items-start gap-3 flex-1 min-w-0 pr-8"
                                            >
                                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold flex-shrink-0 mt-1 overflow-hidden">
                                                    {contact.avatar_url ? (
                                                        <img src={contact.avatar_url} alt={contact.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        contact.name.charAt(0).toUpperCase()
                                                    )}
                                                </div>
                                                <div className="flex-1 text-left min-w-0 py-1">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <div className="flex items-center gap-1.5 min-w-0 pr-2">
                                                            <h3 className="font-semibold text-slate-800 truncate text-[15px]">
                                                                {contact.name}
                                                            </h3>
                                                            {contact.role === 'Admin' && (
                                                                <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                                                                    Admin
                                                                </span>
                                                            )}
                                                            {(contact.role === 'Líder' || contact.role === 'leader') && (
                                                                <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                                                                    Líder
                                                                </span>
                                                            )}
                                                            {contact.role === 'Voluntário' && (
                                                                <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                                                    Vol
                                                                </span>
                                                            )}
                                                        </div>
                                                        {contact.lastMessageTime && (
                                                            <span className="text-xs text-slate-500 flex-shrink-0">{contact.lastMessageTime}</span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-sm text-slate-500 truncate flex-1">
                                                            {contact.lastMessage || contact.role}
                                                        </p>
                                                        {(contact.unreadCount || 0) > 0 && (
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
                                    ))}
                                </>
                            );
                        })()}
                    </div >
                </div>

                {/* Área de Chat */}
                <div className="flex-1 flex flex-col">
                    {selectedContact ? (
                        <>
                            {/* Header do Chat */}
                            <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold overflow-hidden">
                                        {selectedContact.avatar_url ? (
                                            <img src={selectedContact.avatar_url} alt={selectedContact.name} className="w-full h-full object-cover" />
                                        ) : (
                                            selectedContact.name.charAt(0).toUpperCase()
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-800">{selectedContact.name}</h3>
                                        <p className="text-sm text-slate-500">{selectedContact.phone}</p>
                                        {activeSession ? (
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${activeSession.leader_id === session?.user?.id
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-red-100 text-red-700'
                                                    }`}>
                                                    {activeSession.leader_id === session?.user?.id
                                                        ? 'Em atendimento com você'
                                                        : 'Em atendimento'}
                                                </span>
                                                {activeSession.leader_id === session?.user?.id && (
                                                    <button
                                                        onClick={handleCloseSession}
                                                        className="ml-2 px-2 py-0.5 bg-red-100 text-red-600 hover:bg-red-200 rounded text-xs font-medium transition-colors"
                                                    >
                                                        Encerrar Atendimento
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="mt-1">
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                                                    Disponível
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="relative">
                                    <button
                                        onClick={() => setShowChatMenu(!showChatMenu)}
                                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                                    >
                                        <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                        </svg>
                                    </button>

                                    {showChatMenu && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-10"
                                                onClick={() => setShowChatMenu(false)}
                                            ></div>
                                            <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-100 z-20 py-1">
                                                <button
                                                    onClick={() => {
                                                        setShowClearChatModal(true);
                                                        setShowChatMenu(false);
                                                    }}
                                                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                    Limpar conversa
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
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
                                                    className={`flex ${isSent ? 'justify-end' : 'justify-start'} items-end gap-2`}
                                                >
                                                    {!isSent && (
                                                        <div className="w-8 h-8 rounded-full bg-slate-200 flex-shrink-0 overflow-hidden mb-1">
                                                            {selectedContact.avatar_url ? (
                                                                <img src={selectedContact.avatar_url} alt={selectedContact.name} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-500">
                                                                    {selectedContact.name.charAt(0).toUpperCase()}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    <div
                                                        className={`max-w-[70%] rounded-2xl px-4 py-2 ${isSent
                                                            ? 'bg-blue-600 text-white'
                                                            : 'bg-white text-slate-800 border border-slate-200'
                                                            }`}
                                                    >
                                                        {!isSent && (
                                                            <p className="text-xs font-bold text-blue-600 mb-1">
                                                                {selectedContact.name}
                                                            </p>
                                                        )}
                                                        <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                                                        <p className={`text-xs mt-1 ${isSent ? 'text-blue-100' : 'text-slate-400'}`}>
                                                            {new Date(msg.created_at).toLocaleTimeString('pt-BR', {
                                                                hour: '2-digit',
                                                                minute: '2-digit',
                                                            })}
                                                        </p>
                                                    </div>

                                                    {isSent && (
                                                        <div className="w-8 h-8 rounded-full bg-blue-700 flex-shrink-0 overflow-hidden mb-1">
                                                            {currentUserAvatar ? (
                                                                <img src={currentUserAvatar} alt="Eu" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white">
                                                                    {session?.user?.user_metadata?.name?.charAt(0).toUpperCase() || 'E'}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
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
                                <div
                                    className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-2 rounded-lg transition-colors -ml-2"
                                    onClick={() => {
                                        if (selectedGroup) {
                                            fetchGroupMembersDetails(selectedGroup.id);
                                            setShowGroupDetailsModal(true);
                                        }
                                    }}
                                >
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-semibold overflow-hidden">
                                        {selectedGroup.avatar_url ? (
                                            <img src={selectedGroup.avatar_url} alt={selectedGroup.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                                            </svg>
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-800">{selectedGroup.name}</h3>
                                        <p className="text-sm text-slate-500">{selectedGroup.members.length} membros</p>
                                    </div>
                                </div>
                                <div className="relative">
                                    <button
                                        onClick={() => setShowChatMenu(!showChatMenu)}
                                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                                    >
                                        <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                        </svg>
                                    </button>

                                    {showChatMenu && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-10"
                                                onClick={() => setShowChatMenu(false)}
                                            ></div>
                                            <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-100 z-20 py-1">
                                                <button
                                                    onClick={() => {
                                                        setShowClearChatModal(true);
                                                        setShowChatMenu(false);
                                                    }}
                                                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                    Limpar conversa
                                                </button>
                                            </div>
                                        </>
                                    )}
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
                                                    className={`flex ${isSent ? 'justify-end' : 'justify-start'} items-end gap-2`}
                                                >
                                                    {!isSent && (
                                                        <div className="w-8 h-8 rounded-full bg-slate-200 flex-shrink-0 overflow-hidden mb-1">
                                                            {(() => {
                                                                const senderContact = contacts.find(c => c.id === msg.sender_id);
                                                                const avatarUrl = senderContact?.avatar_url;
                                                                const initial = (senderContact?.name || msg.sender_name || msg.sender_phone || '?').charAt(0).toUpperCase();

                                                                return avatarUrl ? (
                                                                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-500">
                                                                        {initial}
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    )}

                                                    <div
                                                        className={`max-w-[70%] rounded-2xl px-4 py-2 ${isSent
                                                            ? 'bg-green-600 text-white'
                                                            : 'bg-white text-slate-800 border border-slate-200'
                                                            }`}
                                                    >
                                                        {!isSent && (
                                                            <p className="text-xs font-bold text-orange-500 mb-1">
                                                                {(() => {
                                                                    const senderContact = contacts.find(c => c.id === msg.sender_id);
                                                                    return senderContact?.name || msg.sender_name || msg.sender_phone || 'Membro';
                                                                })()}
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

                                                    {isSent && (
                                                        <div className="w-8 h-8 rounded-full bg-green-700 flex-shrink-0 overflow-hidden mb-1">
                                                            {currentUserAvatar ? (
                                                                <img src={currentUserAvatar} alt="Eu" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white">
                                                                    {session?.user?.user_metadata?.name?.charAt(0).toUpperCase() || 'E'}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
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
                                            onKeyPress={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleSendGroupMessage();
                                                }
                                            }}
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

            {/* Modal de Detalhes do Grupo */}
            {showGroupDetailsModal && selectedGroup && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-slate-800">Dados do Grupo</h3>
                            <button
                                onClick={() => setShowGroupDetailsModal(false)}
                                className="text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto">
                            {/* Foto do Grupo */}
                            <div className="flex flex-col items-center mb-8">
                                <div className="relative group cursor-pointer">
                                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white text-3xl font-semibold overflow-hidden shadow-lg">
                                        {selectedGroup.avatar_url ? (
                                            <img src={selectedGroup.avatar_url} alt={selectedGroup.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                                            </svg>
                                        )}
                                    </div>
                                    <label className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                        {uploadingAvatar ? (
                                            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        ) : (
                                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                        )}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleGroupAvatarUpload}
                                            disabled={uploadingAvatar}
                                        />
                                    </label>
                                </div>
                                <h4 className="mt-3 text-lg font-semibold text-slate-800">{selectedGroup.name}</h4>
                                <p className="text-sm text-slate-500">Grupo • {selectedGroup.members.length} membros</p>
                            </div>

                            {/* Lista de Membros */}
                            <div>
                                <h5 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Membros ({groupDetailsMembers.length})</h5>
                                <div className="space-y-3">
                                    {groupDetailsMembers.map((member) => (
                                        <div key={member.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg transition-colors">
                                            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-semibold flex-shrink-0 overflow-hidden">
                                                {member.avatar_url ? (
                                                    <img src={member.avatar_url} alt={member.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    member.name.charAt(0).toUpperCase()
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <p className="font-medium text-slate-800 truncate">{member.name}</p>
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${member.role === 'Admin' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                                                        (member.role === 'Líder' || member.role === 'leader') ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                                            'bg-slate-100 text-slate-600 border-slate-200'
                                                        }`}>
                                                        {member.role === 'leader' ? 'Líder' : member.role}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500 truncate">{member.phone}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Criar Grupo */}
            {showGroupModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={closeGroupModal}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
                        {/* Header */}
                        <div className="p-6 border-b border-slate-200">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-bold text-slate-800">Criar Grupo</h3>
                                <button
                                    onClick={closeGroupModal}
                                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-6">
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

                                {/* Opção para incluir a si mesmo */}
                                <div className="mb-4 p-3 bg-blue-50 rounded-lg flex items-center gap-3 border border-blue-100">
                                    <input
                                        type="checkbox"
                                        id="includeMe"
                                        checked={includeMe}
                                        onChange={(e) => setIncludeMe(e.target.checked)}
                                        className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                                    />
                                    <label htmlFor="includeMe" className="flex items-center gap-3 cursor-pointer flex-1">
                                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-semibold flex-shrink-0 overflow-hidden">
                                            {currentUserAvatar ? (
                                                <img src={currentUserAvatar} alt="Eu" className="w-full h-full object-cover" />
                                            ) : (
                                                session?.user?.user_metadata?.name?.charAt(0).toUpperCase() || 'E'
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-semibold text-slate-800 text-sm">Você ({session?.user?.user_metadata?.name || 'Eu'})</p>
                                            <p className="text-xs text-slate-500">Adicionar-me ao grupo</p>
                                        </div>
                                    </label>
                                </div>

                                {/* Campo de busca de membros */}
                                <div className="mb-3">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={memberSearchQuery}
                                            onChange={(e) => setMemberSearchQuery(e.target.value)}
                                            placeholder="Buscar voluntário..."
                                            className="w-full px-4 py-2 pl-10 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        <svg className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                    </div>
                                </div>

                                {/* Lista de membros com scroll único */}
                                <div className="space-y-2 max-h-60 overflow-y-auto pr-2 scrollbar-glass">
                                    {contacts
                                        .filter(contact => {
                                            // Filtro de telefone obrigatório
                                            if (!contact.phone) return false;

                                            // Filtro de busca por nome
                                            if (memberSearchQuery.trim()) {
                                                const searchLower = memberSearchQuery.toLowerCase();
                                                if (!contact.name.toLowerCase().includes(searchLower)) {
                                                    return false;
                                                }
                                            }

                                            // Se for admin, mostra todos (que tenham telefone)
                                            if (userRole === 'admin') return true;

                                            // Se for líder, filtra por departamento
                                            const normalizedRole = userRole?.toLowerCase();
                                            if (['leader', 'lider', 'líder'].includes(normalizedRole)) {
                                                if (!departmentId) return false;

                                                // Normalizar department_ids (pode vir como array ou string JSON)
                                                let deptIds = contact.department_ids;
                                                if (typeof deptIds === 'string') {
                                                    try {
                                                        deptIds = JSON.parse(deptIds);
                                                    } catch (e) {
                                                        deptIds = [];
                                                    }
                                                }

                                                // Garantir que é array
                                                if (!Array.isArray(deptIds)) return false;

                                                return deptIds.includes(Number(departmentId));
                                            }

                                            return true; // Fallback
                                        })
                                        .map((contact) => (
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
                                        ))
                                    }
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-slate-200 flex gap-3">
                            <button
                                onClick={closeGroupModal}
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

            {/* Modal de Confirmação de Exclusão */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]" onClick={() => !isDeleting && setShowDeleteModal(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6 text-center">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2">Excluir Grupo?</h3>
                            <p className="text-slate-600 mb-6">
                                Tem certeza que deseja excluir este grupo? Esta ação não pode ser desfeita e todas as mensagens serão perdidas.
                            </p>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowDeleteModal(false)}
                                    disabled={isDeleting}
                                    className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium disabled:opacity-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmDeleteGroup}
                                    disabled={isDeleting}
                                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isDeleting ? (
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        'Sim, Excluir'
                                    )}
                                </button>
                            </div>
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
            {/* Modal de Confirmação de Limpar Conversa */}
            {showClearChatModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4 text-red-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">Limpar conversa?</h3>
                            <p className="text-slate-500 mb-6">
                                Tem certeza que deseja apagar todas as mensagens desta conversa? Esta ação não pode ser desfeita.
                            </p>
                            <div className="flex gap-3 w-full">
                                <button
                                    onClick={() => setShowClearChatModal(false)}
                                    className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={selectedGroup ? handleClearGroupChat : handleClearChat}
                                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
                                >
                                    Limpar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatPage;
