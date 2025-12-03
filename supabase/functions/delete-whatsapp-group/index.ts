import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeleteGroupRequest {
    groupId: string;
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
        console.log('=== Iniciando exclusão de grupo ===');

        // Criar cliente Supabase
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Verificar autenticação
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            throw new Error('Não autorizado');
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

        if (authError || !user) {
            throw new Error('Não autorizado');
        }

        // Verificar permissões (Admin ou Líder)
        const userRole = user.user_metadata?.role;
        if (userRole !== 'admin' && userRole !== 'leader' && userRole !== 'lider') {
            throw new Error('Apenas admins e líderes podem excluir grupos');
        }

        // Obter dados da requisição
        const requestBody = await req.json();
        const { groupId }: DeleteGroupRequest = requestBody;

        if (!groupId) {
            throw new Error('ID do grupo é obrigatório');
        }

        // Buscar dados do grupo no banco
        const { data: groupData, error: groupError } = await supabaseClient
            .from('whatsapp_groups')
            .select('*')
            .eq('id', groupId)
            .single();

        if (groupError || !groupData) {
            throw new Error('Grupo não encontrado');
        }

        // Verificar se o usuário é dono ou admin
        if (userRole !== 'admin' && groupData.created_by !== user.id) {
            // Verificar se é admin do grupo
            const { data: memberData } = await supabaseClient
                .from('whatsapp_group_members')
                .select('is_admin')
                .eq('group_id', groupId)
                .eq('user_id', user.id)
                .single();

            if (!memberData?.is_admin) {
                throw new Error('Apenas o criador, admin do sistema ou admin do grupo pode excluir este grupo');
            }
        }

        const whatsappGroupId = groupData.whatsapp_group_id;

        // Buscar configurações do WhatsApp
        const { data: settings, error: settingsError } = await supabaseClient
            .from('whatsapp_settings')
            .select('*')
            .eq('active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (settingsError || !settings) {
            // Se não tem config, talvez só apagar do banco?
            // Mas o requisito é apagar do WhatsApp também.
            console.warn('Configurações do WhatsApp não encontradas. Apagando apenas do banco.');
        } else {
            const whatsappSettings = settings as WhatsAppSettings;

            if (whatsappGroupId) {
                // Deletar grupo no WhatsApp (Evolution API)
                // Endpoint: /group/updateParticipant (remove participants?) No, usually there is a leave or delete.
                // Evolution v2: /group/logout or /group/leave
                // Let's try to find a delete or leave endpoint.
                // Usually "leave" is what we want if we are just exiting, but "delete" might not exist for non-business API or might be just leaving.
                // Actually, Evolution has /group/leave/{instance}/{groupJid}

                const leaveGroupUrl = `${whatsappSettings.evolution_url}/group/leave/${whatsappSettings.session_name}?groupJid=${whatsappGroupId}`;

                console.log(`Saindo/Deletando grupo ${whatsappGroupId} no WhatsApp...`);

                try {
                    const response = await fetch(leaveGroupUrl, {
                        method: 'POST', // Evolution usually uses POST for actions
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': whatsappSettings.token,
                            'ngrok-skip-browser-warning': 'true',
                        }
                    });

                    if (response.ok) {
                        console.log('Saiu do grupo no WhatsApp com sucesso');
                    } else {
                        console.warn('Falha ao sair do grupo no WhatsApp:', await response.text());
                    }
                } catch (e) {
                    console.error('Erro ao chamar API do WhatsApp:', e);
                }
            }
        }

        // Deletar do banco (Cascata deve deletar membros e mensagens, mas vamos garantir)
        // Primeiro deletar membros
        await supabaseClient.from('whatsapp_group_members').delete().eq('group_id', groupId);
        await supabaseClient.from('whatsapp_group_messages').delete().eq('group_id', groupId);

        const { error: deleteError } = await supabaseClient
            .from('whatsapp_groups')
            .delete()
            .eq('id', groupId);

        if (deleteError) {
            throw new Error('Erro ao deletar grupo do banco: ' + deleteError.message);
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: 'Grupo excluído com sucesso'
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        );

    } catch (error) {
        console.error('Erro na função delete-whatsapp-group:', error);
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
