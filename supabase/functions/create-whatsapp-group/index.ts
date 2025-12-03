import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Member {
    userId: string;
    phone: string;
}

interface CreateGroupRequest {
    groupName: string;
    members: Member[];
}

interface WhatsAppSettings {
    evolution_url: string;
    token: string;
    session_name: string;
    active: boolean;
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        console.log('=== Iniciando criação de grupo ===');

        // Criar cliente Supabase
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Verificar autenticação
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            console.error('Sem header de autorização');
            throw new Error('Não autorizado');
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

        if (authError || !user) {
            console.error('Erro de autenticação:', authError);
            throw new Error('Não autorizado');
        }

        console.log('Usuário autenticado:', user.email);

        // Verificar se é admin ou líder
        const userRole = user.user_metadata?.role;
        if (userRole !== 'admin' && userRole !== 'leader' && userRole !== 'lider') {
            throw new Error('Apenas admins e líderes podem criar grupos');
        }

        // Obter dados da requisição
        const requestBody = await req.json();
        console.log('Request body recebido:', JSON.stringify(requestBody));

        const { groupName, members }: CreateGroupRequest = requestBody;

        if (!groupName || !members || members.length === 0) {
            console.error('Dados inválidos:', { groupName, membersCount: members?.length });
            throw new Error('Nome do grupo e membros são obrigatórios');
        }

        console.log('Criando grupo:', groupName, 'com', members.length, 'membros');

        // Buscar configurações do WhatsApp
        const { data: settings, error: settingsError } = await supabaseClient
            .from('whatsapp_settings')
            .select('*')
            .eq('active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (settingsError || !settings) {
            console.error('Erro ao buscar configurações:', settingsError);
            throw new Error('Configurações do WhatsApp não encontradas ou inativas');
        }

        const whatsappSettings = settings as WhatsAppSettings;

        // Formatar números de telefone para o formato do WhatsApp
        const formattedMembers = members.map(m => {
            // Remover caracteres não numéricos
            const cleanPhone = m.phone.replace(/\D/g, '');
            // Adicionar @s.whatsapp.net se não tiver
            return cleanPhone.includes('@') ? cleanPhone : `${cleanPhone}@s.whatsapp.net`;
        });

        // Buscar telefone do usuário criador
        const { data: creatorProfile } = await supabaseClient
            .from('profiles')
            .select('phone')
            .eq('id', user.id)
            .single();

        let initialParticipants: string[] = [];
        let membersToAddLater = [...formattedMembers];

        if (creatorProfile?.phone) {
            const cleanCreatorPhone = creatorProfile.phone.replace(/\D/g, '');
            const creatorWhatsapp = cleanCreatorPhone.includes('@') ? cleanCreatorPhone : `${cleanCreatorPhone}@s.whatsapp.net`;

            // Filtrar criador da lista de membros disponíveis para criação inicial
            const otherMembers = formattedMembers.filter(p => p !== creatorWhatsapp);

            if (otherMembers.length > 0) {
                // TENTATIVA DE SOLUÇÃO DEFINITIVA:
                // Enviar TODOS os membros (exceto criador) JÁ na criação do grupo.
                // Isso evita depender da rota updateParticipant que está falhando com erro 400.
                initialParticipants = otherMembers;

                // Ninguém para adicionar depois (exceto talvez o criador se a lógica mudasse, mas ele entra auto)
                membersToAddLater = [];
            } else {
                // Se só tem o criador
                initialParticipants = [creatorWhatsapp];
                membersToAddLater = [];
            }
        } else {
            // Se não achou telefone do criador, tenta criar com todos
            if (formattedMembers.length > 0) {
                initialParticipants = formattedMembers;
                membersToAddLater = [];
            }
        }

        // Criar grupo via Evolution API
        const evolutionUrl = `${whatsappSettings.evolution_url}/group/create/${whatsappSettings.session_name}`;

        console.log('Criando grupo no WhatsApp com participante inicial:', {
            url: evolutionUrl,
            groupName,
            initialParticipants
        });

        const evolutionPayload = {
            subject: groupName,
            participants: initialParticipants
        };

        const response = await fetch(evolutionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': whatsappSettings.token,
                'ngrok-skip-browser-warning': 'true',
            },
            body: JSON.stringify(evolutionPayload),
        });

        const responseText = await response.text();
        console.log('Response status (criação):', response.status);

        if (!response.ok) {
            console.error('Erro ao criar grupo:', responseText);
            throw new Error(`Erro ao criar grupo no WhatsApp: ${response.status} - ${responseText}`);
        }

        let result;
        try {
            result = JSON.parse(responseText);
        } catch (e) {
            console.error('Erro ao parsear resposta:', e);
            throw new Error('Resposta inválida da API do WhatsApp');
        }

        console.log('Grupo criado com sucesso:', result);

        // Obter ID do grupo criado
        const whatsappGroupId = result.id || result.groupId;

        // Aguardar um pouco para garantir que o grupo foi propagado no WhatsApp
        console.log('Aguardando 4 segundos para propagação do grupo...');
        await new Promise(resolve => setTimeout(resolve, 4000));

        // Adicionar o restante dos membros um por um
        if (membersToAddLater.length > 0) {
            console.log(`Adicionando ${membersToAddLater.length} membros restantes ao grupo ${whatsappGroupId}...`);

            for (const memberPhone of membersToAddLater) {
                // Adicionar groupJid na query string (sem encode manual excessivo, o fetch lida com a URL)
                // E também manter no body para garantir compatibilidade com diferentes versões
                const addMemberUrl = `${whatsappSettings.evolution_url}/group/updateParticipant/${whatsappSettings.session_name}?groupJid=${whatsappGroupId}`;

                try {
                    console.log(`Tentando adicionar: ${memberPhone}`);
                    let addResponse = await fetch(addMemberUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': whatsappSettings.token,
                            'ngrok-skip-browser-warning': 'true',
                        },
                        body: JSON.stringify({
                            action: 'add',
                            groupId: whatsappGroupId, // Recolocando no body por garantia
                            participants: [memberPhone]
                        }),
                    });

                    let addText = await addResponse.text();

                    if (addResponse.ok) {
                        console.log(`Sucesso ao adicionar ${memberPhone}:`, addText);
                    } else {
                        console.warn(`Falha ao adicionar ${memberPhone} (Status ${addResponse.status}):`, addText);

                        // TENTATIVA DE FALLBACK: Remover o 9 dígito (para números BR)
                        // Formato BR: 55 + 2 DDD + 9 dígitos = 13 dígitos
                        if (memberPhone.length === 13 && memberPhone.startsWith('55')) {
                            const phoneWithout9 = memberPhone.slice(0, 4) + memberPhone.slice(5);
                            console.log(`Tentando fallback sem o 9 dígito: ${phoneWithout9}`);

                            const addResponseFallback = await fetch(addMemberUrl, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'apikey': whatsappSettings.token,
                                    'ngrok-skip-browser-warning': 'true',
                                },
                                body: JSON.stringify({
                                    action: 'add',
                                    participants: [phoneWithout9]
                                }),
                            });

                            const addTextFallback = await addResponseFallback.text();

                            if (addResponseFallback.ok) {
                                console.log(`Sucesso ao adicionar ${phoneWithout9} (fallback):`, addTextFallback);
                            } else {
                                console.warn(`Falha no fallback para ${phoneWithout9}:`, addTextFallback);
                            }
                        }
                    }
                } catch (err) {
                    console.error(`Erro de exceção ao adicionar ${memberPhone}:`, err);
                }

                // Pequeno delay
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        // Salvar grupo no banco de dados
        const { data: groupData, error: groupError } = await supabaseClient
            .from('whatsapp_groups')
            .insert({
                name: groupName,
                whatsapp_group_id: whatsappGroupId,
                created_by: user.id
            })
            .select()
            .single();

        if (groupError) {
            console.error('Erro ao salvar grupo no banco:', groupError);
            // Não lançar erro para não falhar a operação inteira, já que o grupo foi criado no WhatsApp
        } else {
            console.log('Grupo salvo no banco:', groupData);

            // Salvar membros
            const membersToInsert = members.map(m => ({
                group_id: groupData.id,
                user_id: m.userId,
                phone: m.phone
            }));

            const { error: membersError } = await supabaseClient
                .from('whatsapp_group_members')
                .insert(membersToInsert);

            if (membersError) {
                console.error('Erro ao salvar membros no banco:', membersError);
            } else {
                console.log('Membros salvos no banco');
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: 'Grupo criado com sucesso no WhatsApp e salvo no banco',
                groupId: whatsappGroupId,
                dbGroupId: groupData?.id,
                data: result
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        );

    } catch (error) {
        console.error('Erro na função create-whatsapp-group:', error);
        return new Response(
            JSON.stringify({
                success: false,
                error: error.message
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        );
    }
});
