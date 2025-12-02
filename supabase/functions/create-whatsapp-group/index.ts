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

        // Criar grupo via Evolution API
        const evolutionUrl = `${whatsappSettings.evolution_url}/group/create/${whatsappSettings.session_name}`;

        console.log('Criando grupo no WhatsApp:', {
            url: evolutionUrl,
            groupName,
            membersCount: formattedMembers.length,
            members: formattedMembers
        });

        const evolutionPayload = {
            subject: groupName,
            participants: formattedMembers
        };

        console.log('Evolution payload:', JSON.stringify(evolutionPayload));

        const response = await fetch(evolutionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': whatsappSettings.token,
                'ngrok-skip-browser-warning': 'true',
            },
            body: JSON.stringify(evolutionPayload),
        });

        console.log('Response status:', response.status);
        const responseText = await response.text();
        console.log('Response body:', responseText);

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

        console.log('Grupo criado com sucesso no WhatsApp:', result);

        // Salvar grupo no banco de dados
        const whatsappGroupId = result.id || result.groupId;

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
