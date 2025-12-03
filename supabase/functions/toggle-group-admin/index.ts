import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ToggleAdminRequest {
    groupId: string;
    userId: string; // ID do usuário alvo
    phone: string;
    action: 'promote' | 'demote';
}

interface WhatsAppSettings {
    evolution_url: string;
    token: string;
    session_name: string;
    active: boolean;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Não autorizado');

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

        if (authError || !user) throw new Error('Não autorizado');

        const requestBody = await req.json();
        const { groupId, userId, phone, action }: ToggleAdminRequest = requestBody;

        if (!groupId || !userId || !phone || !action) {
            throw new Error('Dados incompletos');
        }

        // 1. Verificar permissões do solicitante
        // Pode promover se: Admin do Sistema OU Criador do Grupo OU Admin do Grupo
        const userRole = user.user_metadata?.role;

        const { data: groupData, error: groupError } = await supabaseClient
            .from('whatsapp_groups')
            .select('*')
            .eq('id', groupId)
            .single();

        if (groupError || !groupData) throw new Error('Grupo não encontrado');

        let canManage = false;

        if (userRole === 'admin') {
            canManage = true;
        } else if (groupData.created_by === user.id) {
            canManage = true;
        } else {
            // Verificar se é admin do grupo
            const { data: memberData } = await supabaseClient
                .from('whatsapp_group_members')
                .select('is_admin')
                .eq('group_id', groupId)
                .eq('user_id', user.id)
                .single();

            if (memberData?.is_admin) {
                canManage = true;
            }
        }

        if (!canManage) {
            throw new Error('Você não tem permissão para gerenciar administradores deste grupo');
        }

        // 2. Atualizar no WhatsApp
        const whatsappGroupId = groupData.whatsapp_group_id;
        if (whatsappGroupId) {
            const { data: settings } = await supabaseClient
                .from('whatsapp_settings')
                .select('*')
                .eq('active', true)
                .limit(1)
                .single();

            if (settings) {
                const whatsappSettings = settings as WhatsAppSettings;
                let cleanPhone = phone.replace(/\D/g, '');
                let memberPhone = cleanPhone.includes('@') ? cleanPhone : `${cleanPhone}@s.whatsapp.net`;

                const updateParticipantUrl = `${whatsappSettings.evolution_url}/group/updateParticipant/${whatsappSettings.session_name}?groupJid=${whatsappGroupId}`;

                // action: 'promote' | 'demote'
                try {
                    await fetch(updateParticipantUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': whatsappSettings.token
                        },
                        body: JSON.stringify({
                            action: action,
                            groupId: whatsappGroupId,
                            participants: [memberPhone]
                        }),
                    });
                } catch (e) {
                    console.error('Erro ao atualizar WhatsApp:', e);
                    // Não vamos travar se der erro no WhatsApp, mas logamos
                }
            }
        }

        // 3. Atualizar no Banco
        const { error: updateError } = await supabaseClient
            .from('whatsapp_group_members')
            .update({ is_admin: action === 'promote' })
            .eq('group_id', groupId)
            .eq('user_id', userId);

        if (updateError) throw updateError;

        return new Response(
            JSON.stringify({ success: true, message: `Usuário ${action === 'promote' ? 'promovido' : 'rebaixado'} com sucesso` }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );

    } catch (error) {
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }
});
