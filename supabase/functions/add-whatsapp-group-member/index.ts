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

interface AddMemberRequest {
    groupId: string;
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
        console.log('=== Iniciando adição de membros ao grupo ===');

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
            throw new Error('Apenas admins e líderes podem adicionar membros');
        }

        // Obter dados da requisição
        const requestBody = await req.json();
        const { groupId, members }: AddMemberRequest = requestBody;

        if (!groupId || !members || members.length === 0) {
            throw new Error('ID do grupo e membros são obrigatórios');
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

        // Adicionar membros no WhatsApp
        console.log(`Adicionando ${members.length} membros ao grupo ${whatsappGroupId}...`);
        const results = [];

        for (const member of members) {
            // Formatar telefone
            let cleanPhone = member.phone.replace(/\D/g, '');
            let memberPhone = cleanPhone.includes('@') ? cleanPhone : `${cleanPhone}@s.whatsapp.net`;

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
                        groupId: whatsappGroupId,
                        participants: [memberPhone]
                    }),
                });

                let success = addResponse.ok;
                let responseText = await addResponse.text();

                if (!success) {
                    console.warn(`Falha ao adicionar ${memberPhone}:`, responseText);

                    // Fallback para números BR (remover 9º dígito)
                    if (memberPhone.length === 13 + 15 && memberPhone.startsWith('55')) { // 13 digits + @s.whatsapp.net
                        // Actually simple check: starts with 55 and length is roughly expected
                        // cleanPhone is just digits.
                    }

                    if (cleanPhone.length === 13 && cleanPhone.startsWith('55')) {
                        const phoneWithout9 = cleanPhone.slice(0, 4) + cleanPhone.slice(5);
                        const phoneWithout9Jid = `${phoneWithout9}@s.whatsapp.net`;
                        console.log(`Tentando fallback sem o 9 dígito: ${phoneWithout9Jid}`);

                        const fallbackResponse = await fetch(addMemberUrl, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'apikey': whatsappSettings.token,
                                'ngrok-skip-browser-warning': 'true',
                            },
                            body: JSON.stringify({
                                action: 'add',
                                groupId: whatsappGroupId,
                                participants: [phoneWithout9Jid]
                            }),
                        });

                        if (fallbackResponse.ok) {
                            success = true;
                            memberPhone = phoneWithout9Jid; // Update to the one that worked
                        }
                    }
                }

                if (success) {
                    // Salvar no banco
                    const { error: dbError } = await supabaseClient
                        .from('whatsapp_group_members')
                        .insert({
                            group_id: groupId,
                            user_id: member.userId,
                            phone: member.phone // Keep original phone in DB for record
                        });

                    if (dbError) {
                        console.error('Erro ao salvar membro no banco:', dbError);
                        results.push({ userId: member.userId, success: true, dbSaved: false, error: dbError.message });
                    } else {
                        results.push({ userId: member.userId, success: true, dbSaved: true });
                    }
                } else {
                    results.push({ userId: member.userId, success: false, error: responseText });
                }

            } catch (err) {
                console.error(`Erro ao processar membro ${member.userId}:`, err);
                results.push({ userId: member.userId, success: false, error: err.message });
            }

            // Delay para evitar rate limit
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        return new Response(
            JSON.stringify({
                success: true,
                results
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        );

    } catch (error) {
        console.error('Erro na função add-whatsapp-group-member:', error);
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
