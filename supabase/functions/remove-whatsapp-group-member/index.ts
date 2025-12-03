import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RemoveMemberRequest {
    groupId: string;
    userId: string;
    phone: string;
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
        console.log('=== Iniciando remoção de membro do grupo ===');

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

        // Obter dados da requisição
        const requestBody = await req.json();
        const { groupId, userId, phone }: RemoveMemberRequest = requestBody;

        if (!groupId || !userId || !phone) {
            throw new Error('ID do grupo, ID do usuário e telefone são obrigatórios');
        }

        // Verificar permissões (Admin, Líder ou Admin do Grupo)
        const userRole = user.user_metadata?.role;
        let canRemove = false;

        if (userRole === 'admin' || userRole === 'leader' || userRole === 'lider') {
            canRemove = true;
        } else {
            // Verificar se é admin do grupo
            const { data: memberData } = await supabaseClient
                .from('whatsapp_group_members')
                .select('is_admin')
                .eq('group_id', groupId)
                .eq('user_id', user.id)
                .single();

            if (memberData?.is_admin) {
                canRemove = true;
            }
        }

        if (!canRemove) {
            throw new Error('Apenas admins, líderes ou admins do grupo podem remover membros');
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

        const whatsappGroupId = groupData.whatsapp_group_id;
        if (!whatsappGroupId) {
            throw new Error('Este grupo não possui ID do WhatsApp vinculado');
        }

        // Buscar configurações do WhatsApp
        const { data: settings, error: settingsError } = await supabaseClient
            .from('whatsapp_settings')
            .select('*')
            .eq('active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (settingsError || !settings) {
            throw new Error('Configurações do WhatsApp não encontradas ou inativas');
        }

        const whatsappSettings = settings as WhatsAppSettings;

        // Remover membro no WhatsApp
        // Formatar telefone
        let cleanPhone = phone.replace(/\D/g, '');
        let memberPhone = cleanPhone.includes('@') ? cleanPhone : `${cleanPhone}@s.whatsapp.net`;

        const updateParticipantUrl = `${whatsappSettings.evolution_url}/group/updateParticipant/${whatsappSettings.session_name}?groupJid=${whatsappGroupId}`;

        console.log(`Removendo ${memberPhone} do grupo ${whatsappGroupId}...`);

        let success = false;
        let errorMsg = '';

        try {
            const response = await fetch(updateParticipantUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': whatsappSettings.token,
                    'ngrok-skip-browser-warning': 'true',
                },
                body: JSON.stringify({
                    action: 'remove',
                    groupId: whatsappGroupId,
                    participants: [memberPhone]
                }),
            });

            const responseText = await response.text();

            if (response.ok) {
                success = true;
                console.log('Removido com sucesso do WhatsApp:', responseText);
            } else {
                console.warn('Falha ao remover do WhatsApp:', responseText);
                errorMsg = responseText;

                // Fallback para números BR (remover 9º dígito) se falhar
                if (cleanPhone.length === 13 && cleanPhone.startsWith('55')) {
                    const phoneWithout9 = cleanPhone.slice(0, 4) + cleanPhone.slice(5);
                    const phoneWithout9Jid = `${phoneWithout9}@s.whatsapp.net`;
                    console.log(`Tentando fallback sem o 9 dígito: ${phoneWithout9Jid}`);

                    const fallbackResponse = await fetch(updateParticipantUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': whatsappSettings.token,
                            'ngrok-skip-browser-warning': 'true',
                        },
                        body: JSON.stringify({
                            action: 'remove',
                            groupId: whatsappGroupId,
                            participants: [phoneWithout9Jid]
                        }),
                    });

                    if (fallbackResponse.ok) {
                        success = true;
                        console.log('Removido com sucesso do WhatsApp (fallback)');
                    } else {
                        console.warn('Falha no fallback:', await fallbackResponse.text());
                    }
                }
            }
        } catch (e) {
            console.error('Erro na requisição ao WhatsApp:', e);
            errorMsg = e.message;
        }

        if (success) {
            const { error: dbError } = await supabaseClient
                .from('whatsapp_group_members')
                .delete()
                .eq('group_id', groupId)
                .eq('user_id', userId);

            if (dbError) {
                console.error('Erro ao remover do banco:', dbError);
                throw new Error('Removido do WhatsApp, mas erro ao remover do banco: ' + dbError.message);
            }
        } else {
            // Se falhou no WhatsApp, mas é ADMIN ou tem permissão de remover (Líder/Admin do Grupo), permite remover do banco (Force Remove)
            // A variável `canRemove` já validou se é Admin, Líder ou Admin do Grupo.
            // Vamos permitir que qualquer um com permissão de remover possa forçar a remoção do banco se o WhatsApp falhar.
            // Isso resolve o caso do criador do grupo não conseguir remover alguém porque a API falhou.

            if (canRemove) {
                console.log(`Falha no WhatsApp (${errorMsg}), mas usuário tem permissão. Forçando remoção do banco...`);

                const { error: dbError } = await supabaseClient
                    .from('whatsapp_group_members')
                    .delete()
                    .eq('group_id', groupId)
                    .eq('user_id', userId);

                if (dbError) {
                    console.error('Erro ao remover do banco (Force):', dbError);
                    throw new Error('Falha ao remover do WhatsApp e do banco: ' + dbError.message);
                }

                return new Response(
                    JSON.stringify({
                        success: true,
                        message: 'Membro removido do sistema (WhatsApp impediu a remoção remota ou falhou)'
                    }),
                    {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                        status: 200,
                    }
                );
            }

            // Se não tiver permissão (o que não deve acontecer aqui pois já validou canRemove antes), retorna erro
            throw new Error('Falha ao remover do WhatsApp: ' + errorMsg);
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: 'Membro removido com sucesso'
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        );

    } catch (error) {
        console.error('Erro na função remove-whatsapp-group-member:', error);
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
