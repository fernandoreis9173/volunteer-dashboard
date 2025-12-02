import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const payload = await req.json()
        console.log('DEPLOY_CHECK_V4: Webhook payload received');

        // Verificar se é um evento de mensagem
        // Evolution API pode enviar 'event' ou 'type', e o valor pode ser 'messages.upsert' ou 'MESSAGES_UPSERT'
        const eventType = payload.event || payload.type;

        if (eventType === 'MESSAGES_UPSERT' || eventType === 'messages.upsert') {
            const messageData = payload.data

            // Verificar se é mensagem de grupo
            if (messageData.key.remoteJid && messageData.key.remoteJid.includes('@g.us')) {
                const whatsappGroupId = messageData.key.remoteJid

                // Extrair conteúdo da mensagem
                let messageContent = ''
                if (messageData.message?.conversation) {
                    messageContent = messageData.message.conversation
                } else if (messageData.message?.extendedTextMessage?.text) {
                    messageContent = messageData.message.extendedTextMessage.text
                } else {
                    // Ignorar outros tipos por enquanto (imagem, áudio, etc)
                    console.log('Tipo de mensagem não suportado (não é texto simples).')
                }

                if (!messageContent) {
                    await supabaseClient.from('webhook_logs').insert({
                        payload: messageData,
                        message: 'Ignorado: Sem conteúdo de texto'
                    });
                    return new Response(JSON.stringify({ message: 'Ignored (no text content)' }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                        status: 200,
                    })
                }

                // Buscar o grupo no banco de dados
                const { data: group, error: groupError } = await supabaseClient
                    .from('whatsapp_groups')
                    .select('id')
                    .eq('whatsapp_group_id', whatsappGroupId)
                    .single()

                if (groupError || !group) {
                    await supabaseClient.from('webhook_logs').insert({
                        payload: { whatsappGroupId },
                        message: 'Grupo não encontrado no banco'
                    });
                    console.log(`Grupo não encontrado no banco: ${whatsappGroupId}`)
                    return new Response(JSON.stringify({ message: 'Group not found in DB' }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                        status: 200,
                    })
                }

                // Tentar identificar o remetente (user_id) pelo telefone
                // O participant vem como '5511999999999@s.whatsapp.net' ou LID
                let participantJid = messageData.key.participant || messageData.participant

                // Fix for LID in groups - use participantAlt if available
                // Payload example: { participant: "123@lid", participantAlt: "551199...@s.whatsapp.net" }
                // Note: The key might be in messageData.key or messageData directly depending on the event structure
                const participantAlt = messageData.key.participantAlt || messageData.participantAlt;
                if (participantAlt && participantJid && participantJid.includes('@lid')) {
                    participantJid = participantAlt;
                }

                const participantPhone = participantJid ? participantJid.split('@')[0] : ''
                const pushName = messageData.pushName || participantPhone

                let senderId = null
                if (participantPhone) {
                    // Tentar achar usuário pelo telefone usando a função robusta (lida com 9º dígito)
                    const { data: userId } = await supabaseClient
                        .rpc('find_user_by_phone', { search_phone: participantPhone });

                    if (userId) {
                        senderId = userId;
                    }
                }

                // Verificar se a mensagem já existe (deduplicação)
                // Importante: Mensagens enviadas pelo próprio sistema (via send-whatsapp-group-message)
                // já são salvas. O webhook vai receber o evento 'fromMe: true' ou 'fromMe: false'.
                // Se 'fromMe: true', geralmente é o bot enviando. Se já salvamos no envio, podemos ignorar ou atualizar.
                // Vamos verificar pelo ID do WhatsApp.

                const { data: existingMessage } = await supabaseClient
                    .from('whatsapp_group_messages')
                    .select('id')
                    .eq('whatsapp_message_id', messageData.key.id)
                    .single()

                if (existingMessage) {
                    console.log('Mensagem já existe no banco, ignorando.')
                    return new Response(JSON.stringify({ message: 'Already exists' }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                        status: 200,
                    })
                }

                // Salvar mensagem
                const { error: insertError } = await supabaseClient
                    .from('whatsapp_group_messages')
                    .insert({
                        group_id: group.id,
                        sender_id: senderId, // Pode ser null se for alguém fora do sistema
                        sender_name: pushName, // Salvar nome do WhatsApp
                        sender_phone: participantPhone, // Salvar telefone
                        message: messageContent,
                        whatsapp_message_id: messageData.key.id,
                        // Timestamp vem em segundos no Webhook
                        created_at: messageData.messageTimestamp ? new Date(messageData.messageTimestamp * 1000).toISOString() : new Date().toISOString()
                    })

                if (insertError) {
                    await supabaseClient.from('webhook_logs').insert({
                        payload: { error: insertError, messageData },
                        message: 'Erro ao inserir mensagem'
                    });
                    console.error('Erro ao salvar mensagem:', insertError)
                    throw insertError
                }

                console.log('Mensagem salva com sucesso!')
                await supabaseClient.from('webhook_logs').insert({
                    payload: { groupId: group.id, messageId: messageData.key.id },
                    message: 'Mensagem salva com sucesso'
                });
            } else {
                // MENSAGEM INDIVIDUAL
                let participantJid = messageData.key.remoteJid;
                console.log('Processing individual message from:', participantJid);

                // Fix for LID (Living ID) addressing mode - use remoteJidAlt if available
                if (messageData.key.remoteJidAlt && participantJid && participantJid.includes('@lid')) {
                    console.log('LID detected (individual), swapping with remoteJidAlt:', messageData.key.remoteJidAlt);
                    participantJid = messageData.key.remoteJidAlt;
                }

                const participantPhone = participantJid ? participantJid.split('@')[0] : '';
                console.log('Extracted phone for individual message:', participantPhone);

                // Extrair conteúdo
                let messageContent = ''
                if (messageData.message?.conversation) {
                    messageContent = messageData.message.conversation
                } else if (messageData.message?.extendedTextMessage?.text) {
                    messageContent = messageData.message.extendedTextMessage.text
                }

                if (messageContent && participantPhone) {
                    // Buscar ID do usuário
                    const { data: userId, error: userError } = await supabaseClient
                        .rpc('find_user_by_phone', { search_phone: participantPhone });

                    if (userId) {
                        // Descobrir destinatário (última conversa)
                        const { data: lastMessage } = await supabaseClient
                            .from('chat_messages')
                            .select('sender_id, receiver_id')
                            .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
                            .order('created_at', { ascending: false })
                            .limit(1)
                            .single();

                        let receiverId = null;
                        if (lastMessage) {
                            receiverId = lastMessage.sender_id === userId ? lastMessage.receiver_id : lastMessage.sender_id;
                        } else {
                            await supabaseClient.from('webhook_logs').insert({
                                payload: { participantPhone, userId },
                                message: 'Sem histórico para definir destinatário individual'
                            });
                        }

                        if (receiverId) {
                            // Verificar duplicidade para mensagem individual também
                            // A tabela chat_messages não tem whatsapp_message_id, então vamos confiar no conteúdo/tempo ou ignorar por enquanto
                            // Idealmente adicionaríamos whatsapp_message_id na chat_messages também.

                            const { error: insertError } = await supabaseClient.from('chat_messages').insert({
                                sender_id: userId,
                                receiver_id: receiverId,
                                message: messageContent,
                                read: false
                            });

                            if (insertError) {
                                console.error('Erro ao salvar mensagem individual:', insertError);
                                await supabaseClient.from('webhook_logs').insert({
                                    payload: { error: insertError },
                                    message: 'Erro ao salvar mensagem individual'
                                });
                            } else {
                                console.log('Mensagem individual salva com sucesso');
                                await supabaseClient.from('webhook_logs').insert({
                                    payload: { senderId: userId, receiverId },
                                    message: 'Mensagem individual salva'
                                });
                            }
                        }
                    } else {
                        console.log('Usuário não encontrado para o telefone:', participantPhone);
                        await supabaseClient.from('webhook_logs').insert({
                            payload: { participantPhone, messageData },
                            message: 'Usuário não encontrado para mensagem individual'
                        });
                    }
                }
            }
        }

        return new Response(JSON.stringify({ message: 'Processed' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    } catch (error) {
        console.error(error)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})
