import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendGroupMessageRequest {
    groupId: string; // ID do banco de dados
    message: string;
    formattedMessage?: string; // Mensagem formatada para o WhatsApp (com assinatura)
    messageId?: string;
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

        // Auth check
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Não autorizado');
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
        if (authError || !user) throw new Error('Não autorizado');

        const { groupId, message, messageId }: SendGroupMessageRequest = await req.json();

        if (!groupId || !message) throw new Error('ID do grupo e mensagem são obrigatórios');

        // 1. Buscar dados do grupo
        const { data: group, error: groupError } = await supabaseClient
            .from('whatsapp_groups')
            .select('*')
            .eq('id', groupId)
            .single();

        if (groupError || !group) throw new Error('Grupo não encontrado');

        // 1.1 Buscar nome do remetente para assinatura
        let senderName = 'Admin';

        // Tentar buscar no profiles
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('name')
            .eq('id', user.id)
            .single();

        if (profile?.name) {
            senderName = profile.name;
        } else {
            // Se não achar, tenta volunteers
            const { data: volunteer } = await supabaseClient
                .from('volunteers')
                .select('name')
                .eq('user_id', user.id)
                .single();
            if (volunteer?.name) senderName = volunteer.name;
        }

        // 1.2 Buscar template de mensagem do dashboard
        const { data: template } = await supabaseClient
            .from('whatsapp_message_templates')
            .select('*')
            .eq('template_type', 'dashboard_message')
            .eq('active', true)
            .single();

        let formattedMessage = '';

        if (template) {
            formattedMessage = template.message_content
                .replace('{mensagem}', message)
                .replace('{remetente}', senderName);
        } else {
            // Fallback se não houver template
            formattedMessage = `📱 *Mensagem do Dashboard*\n\n${message}\n\n_Enviado por: ${senderName}_`;
        }

        // 2. Buscar configurações
        const { data: settings, error: settingsError } = await supabaseClient
            .from('whatsapp_settings')
            .select('*')
            .eq('active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (settingsError || !settings) throw new Error('Configurações do WhatsApp não encontradas');
        const whatsappSettings = settings as WhatsAppSettings;

        // 3. Enviar mensagem via Evolution API
        const evolutionUrl = `${whatsappSettings.evolution_url}/message/sendText/${whatsappSettings.session_name}`;

        const payload = {
            number: group.whatsapp_group_id, // O ID do grupo no WhatsApp (JID)
            text: formattedMessage // Usa a mensagem formatada gerada aqui
        };

        const response = await fetch(evolutionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': whatsappSettings.token
            },
            body: JSON.stringify(payload)
        });

        const responseText = await response.text();
        if (!response.ok) {
            console.error('Erro Evolution API:', responseText);
            throw new Error(`Erro ao enviar mensagem: ${responseText}`);
        }

        let result;
        try {
            result = JSON.parse(responseText);
        } catch (e) {
            result = { id: 'unknown' };
        }

        // 4. Salvar mensagem no banco
        const { error: saveError } = await supabaseClient
            .from('whatsapp_group_messages')
            .insert({
                id: messageId, // Usar ID fornecido pelo frontend se existir
                group_id: groupId,
                sender_id: user.id,
                message: message, // Salva sempre a mensagem original (sem assinatura)
                whatsapp_message_id: result.key?.id || result.id
            });

        if (saveError) console.error('Erro ao salvar mensagem no banco:', saveError);

        return new Response(
            JSON.stringify({ success: true, data: result }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error: any) {
        console.error('Erro:', error);
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }
});
